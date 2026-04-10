import { DungeonState } from "./dungeonstate.js";
import { render } from "./renderer.js";
import * as geo from "./geo-utils.js";
import { getTheme, getThemePainterThemeKey } from "./themes.js";
import * as constants from "./constants.js";

/**
 * @extends {PlaceableObject}
 */
// TODO: does Dungeon even need to be a PlaceableObject? Or could it just extend PIXI.Container?
export class Dungeon extends foundry.canvas.placeables.PlaceableObject {
  // expects JournalEntry for constructor
  constructor(journalEntry, note) {
    // note will be saved as this.document
    super(note);
    this.journalEntry = journalEntry;
    // time-ordered array of DungeonStates
    this.history = [DungeonState.startState()];
    this.historyIndex = 0;
  }

  /* -------------------------------------------- */

  // TODO: figure out what documentName / embeddedName / type we should be using
  /** @inheritdoc */
  static embeddedName = "Dungeon";

  /** Convenience method to get most recent state. */
  state() {
    return this.history[this.historyIndex];
  }

  /* -------------------------------------------- */

  async deleteAll() {
    // keep our most recent config around
    const lastState = this.state();
    const resetState = DungeonState.startState();
    resetState.config = lastState.config;
    this.history = [resetState];
    this.historyIndex = 0;
    await this.history[this.historyIndex].saveToJournalEntry(this.journalEntry);
    this.refresh();
  }

  /* -------------------------------------------- */

  async clearDrawing() {
    // Remove the dungeon-draw tracking flag from all DD-owned walls so they
    // are no longer managed by this module (and won't be deleted by Clear All).
    const ddWalls = canvas.scene
      .getEmbeddedCollection("Wall")
      .filter((w) =>
        w.getFlag(constants.MODULE_NAME, constants.FLAG_DUNGEON_VERSION)
      );
    if (ddWalls.length) {
      const flagPath = `flags.${constants.MODULE_NAME}.-=${constants.FLAG_DUNGEON_VERSION}`;
      await canvas.scene.updateEmbeddedDocuments(
        "Wall",
        ddWalls.map((w) => ({ _id: w.id, [flagPath]: null }))
      );
    }

    // Reset the dungeon drawing state without touching walls (makeWalls will
    // find no DD-flagged walls left, so nothing gets deleted).
    const lastState = this.state();
    const resetState = DungeonState.startState();
    resetState.config = lastState.config;
    this.history = [resetState];
    this.historyIndex = 0;
    await this.history[this.historyIndex].saveToJournalEntry(this.journalEntry);
    this.refresh();
  }

  /* -------------------------------------------- */

  async saveToSceneBackground() {
    const tempContainer = new PIXI.Container();

    // clip to just the scene
    const mask = new PIXI.Graphics();
    // padding is rounded up to the nearest grid size increment
    const xOffset =
      Math.ceil(
        (canvas.scene.width * canvas.scene.padding) / canvas.scene.grid.size
      ) * canvas.scene.grid.size;
    const yOffset =
      Math.ceil(
        (canvas.scene.height * canvas.scene.padding) / canvas.scene.grid.size
      ) * canvas.scene.grid.size;
    const maskCoords = [
      xOffset,
      yOffset,
      xOffset + canvas.scene.width,
      yOffset,
      xOffset + canvas.scene.width,
      yOffset + canvas.scene.height,
      xOffset,
      yOffset + canvas.scene.height,
      xOffset,
      yOffset,
    ];
    mask.beginFill(PIXI.utils.string2hex("#FFFFFF"), 1.0);
    mask.drawPolygon(maskCoords);
    mask.endFill();
    tempContainer.mask = mask;
    this.mask = mask;

    // force container to scene dimensions
    const sizeForcer = new PIXI.Sprite();
    sizeForcer.height = canvas.scene.height;
    sizeForcer.width = canvas.scene.width;
    sizeForcer.position.x = xOffset;
    sizeForcer.position.y = yOffset;
    tempContainer.addChild(sizeForcer);

    tempContainer.addChild(this);

    // TODO: decide if we want a folder, and if so, how to precreate
    // const folder = "Dungeon Draw";
    const folder = "";
    // uncomment for jpg+compression
    //const filename = `${canvas.scene.name}-dungeon.jpg`;
    //const base64 = await canvas.app.renderer.extract.base64(this, "image/jpeg", 0.5);
    const filename = `${canvas.scene.name}-dungeon.png`;
    const base64 = await canvas.app.renderer.extract.base64(tempContainer);
    const res = await fetch(base64);
    const blob = await res.blob();
    //const file = new File([blob], filename, { type: "image/jpeg" });
    const file = new File([blob], filename, { type: "image/png" });
    await foundry.applications.apps.FilePicker.implementation.upload(
      "data",
      folder,
      file,
      {}
    );
    const path = folder ? folder + "/" + filename : filename;
    // make sure we don't keep using a cached copy
    // TODO: TextureLoader #cache is now a private instance var
    // TextureLoader.loader.cache.delete(path);
    if (canvas.scene.background.src === path) {
      // cheat to force a scene update when we're re-saving to the same filename
      await canvas.scene.update({ "background.src": path }, { render: false });
    }
    await canvas.scene.update({ "background.src": path });

    // remove our mask
    this.mask = null;
  }

  /* -------------------------------------------- */

  async saveToTile() {
    const state = this.state();
    if (!state.geometry) {
      return;
    }

    // Compute tight world-space bounding box from all dungeon content.
    // All coordinates are in canvas world space (scene coords + padding offset).
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const expandPoint = (x, y) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    };

    // Main dungeon geometry
    for (const coord of state.geometry.getCoordinates()) {
      expandPoint(coord.x, coord.y);
    }

    // Doors, secret doors, interior walls, invisible walls, windows: [x0, y0, x1, y1]
    for (const seg of [
      ...state.doors,
      ...(state.secretDoors || []),
      ...state.interiorWalls,
      ...(state.invisibleWalls || []),
      ...(state.windows || []),
    ]) {
      expandPoint(seg[0], seg[1]);
      expandPoint(seg[2], seg[3]);
    }

    // Stairs: { x1, y1, x2, y2, x3, y3, x4, y4 }
    for (const stair of state.stairs || []) {
      expandPoint(stair.x1, stair.y1);
      expandPoint(stair.x2, stair.y2);
      expandPoint(stair.x3, stair.y3);
      expandPoint(stair.x4, stair.y4);
    }

    // Wall shapes (interior + invisible): [[x, y], ...]
    for (const shape of [
      ...(state.interiorWallShapes || []),
      ...(state.invisibleWallShapes || []),
    ]) {
      for (const [x, y] of shape) {
        expandPoint(x, y);
      }
    }

    // Expand by wall thickness + exterior shadow to avoid clipping rendered edges
    const margin =
      (state.config.wallThickness || 8) +
      (state.config.exteriorShadowThickness || 0);
    minX -= margin;
    minY -= margin;
    maxX += margin;
    maxY += margin;

    const tileWidth = maxX - minX;
    const tileHeight = maxY - minY;

    const tempContainer = new PIXI.Container();

    // Anchor the PIXI extract bounds to our tight bbox
    const sizeForcer = new PIXI.Sprite();
    sizeForcer.width = tileWidth;
    sizeForcer.height = tileHeight;
    sizeForcer.position.x = minX;
    sizeForcer.position.y = minY;
    tempContainer.addChild(sizeForcer);

    // Save original parent so we can restore it after extraction.
    // PIXI's addChild reparents the object, removing it from DungeonLayer.
    const originalParent = this.parent;
    const originalIndex = originalParent?.getChildIndex(this) ?? -1;
    tempContainer.addChild(this);

    // Use a timestamp suffix to avoid PIXI serving a cached texture from a
    // previous save when the tile dimensions or position have changed.
    const folder = "";
    const filename = `${canvas.scene.name}-dungeon-tile-${Date.now()}.png`;
    const base64 = await canvas.app.renderer.extract.base64(tempContainer);
    const res = await fetch(base64);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: "image/png" });
    await foundry.applications.apps.FilePicker.implementation.upload(
      "data",
      folder,
      file,
      {}
    );
    const path = folder ? folder + "/" + filename : filename;

    // Restore dungeon to its original place in DungeonLayer
    if (originalParent) {
      originalParent.addChildAt(this, originalIndex);
    } else {
      tempContainer.removeChild(this);
    }

    // Tile positions use canvas world coordinates (same space as geometry coords),
    // so place the tile directly at the computed bounds — no offset adjustment needed.
    await canvas.scene.createEmbeddedDocuments("Tile", [
      {
        texture: { src: path },
        x: minX,
        y: minY,
        width: tileWidth,
        height: tileHeight,
        z: 0,
        overhead: false,
      },
    ]);
  }

  /* -------------------------------------------- */
  /* Rendering                                    */
  /* -------------------------------------------- */

  /** @override */
  draw() {
    this.refresh();
    return this;
  }

  /** @override */
  refresh() {
    render(this, this.state());
  }

  async maybeRefresh(journalEntry) {
    if (journalEntry.id === this.journalEntry.id) {
      const savedState = await DungeonState.loadFromJournalEntry(
        this.journalEntry
      );
      // update state, but don't save to journal
      await this.pushState(savedState, false);
    }
  }

  /* -------------------------------------------- */

  async loadFromJournalEntry() {
    const savedState = await DungeonState.loadFromJournalEntry(
      this.journalEntry
    );
    this.history = [savedState];
    this.historyIndex = 0;
    this.refresh();
  }

  /* -------------------------------------------- */

  async undo() {
    this.historyIndex = Math.max(0, this.historyIndex - 1);
    await this.history[this.historyIndex].saveToJournalEntry(this.journalEntry);
    await this.refresh();
  }

  async redo() {
    this.historyIndex = Math.min(
      this.history.length - 1,
      this.historyIndex + 1
    );
    await this.history[this.historyIndex].saveToJournalEntry(this.journalEntry);
    await this.refresh();
  }

  /* -------------------------------------------- */

  async pushState(newState, saveToJournalEntry = true) {
    // throw away any history states after current
    for (let i = this.history.length - 1; i > this.historyIndex; i--) {
      this.history.pop();
    }
    // and add our new state
    this.history.push(newState);
    this.historyIndex++;

    if (saveToJournalEntry) {
      await newState.saveToJournalEntry(this.journalEntry);
    }
    await this.refresh();
  }

  async setConfig(config) {
    const newState = this.state().clone();
    newState.config = config;
    await this.pushState(newState);
  }

  async addDoor(x1, y1, x2, y2) {
    await this._addDoor(x1, y1, x2, y2, "doors");
  }

  async addSecretDoor(x1, y1, x2, y2) {
    await this._addDoor(x1, y1, x2, y2, "secretDoors");
  }

  async addInvisibleWall(x1, y1, x2, y2) {
    await this._addDoor(x1, y1, x2, y2, "invisibleWalls");
  }

  async addWindow(x1, y1, x2, y2) {
    await this._addDoor(x1, y1, x2, y2, "windows");
  }

  // Batch add multiple invisible wall segments in a single pushState
  async addInvisibleWallSegments(segments) {
    const newState = this.history[this.historyIndex].clone();
    for (const seg of segments) {
      newState.invisibleWalls.push([seg[0], seg[1], seg[2], seg[3]]);
    }
    await this.pushState(newState);
  }

  // Add invisible wall shape (dense points for smooth rendering)
  async addInvisibleWallShape(points) {
    const newState = this.history[this.historyIndex].clone();
    newState.invisibleWallShapes.push(points);
    await this.pushState(newState);
  }

  // Add ellipse as invisible wall shape
  async addInvisibleWallEllipse(x, y, width, height) {
    const ellipsePoly = geo.ellipse(x, y, width, height);
    const coords = ellipsePoly.getExteriorRing().getCoordinates();
    const points = coords.map((c) => [c.x, c.y]);
    await this.addInvisibleWallShape(points);
  }

  async _addDoor(x1, y1, x2, y2, doorProperty) {
    const newState = this.history[this.historyIndex].clone();
    const doorPoly = geo.twoPointsToLineString(x1, y1, x2, y2);

    // possibly split interior walls
    const wallsToDelete = [];
    const wallsToAdd = [];
    for (const wall of newState.interiorWalls) {
      const wallPoly = geo.twoPointsToLineString(
        wall[0],
        wall[1],
        wall[2],
        wall[3]
      );
      const contains = geo.contains(wallPoly, doorPoly);
      if (contains) {
        wallsToDelete.push(wall);
        // make sure points are consistently ordered
        const w1 = geo.lesserPoint(wall[0], wall[1], wall[2], wall[3]);
        const w2 = geo.greaterPoint(wall[0], wall[1], wall[2], wall[3]);
        const d1 = geo.lesserPoint(x1, y1, x2, y2);
        const d2 = geo.greaterPoint(x1, y1, x2, y2);
        wallsToAdd.push([w1[0], w1[1], d1[0], d1[1]]);
        wallsToAdd.push([d2[0], d2[1], w2[0], w2[1]]);
      }
    }
    newState.interiorWalls = newState.interiorWalls.filter(
      (w) => wallsToDelete.indexOf(w) === -1
    );
    newState.interiorWalls = newState.interiorWalls.concat(wallsToAdd);
    newState[doorProperty].push([x1, y1, x2, y2]);
    await this.pushState(newState);
  }

  async addInteriorWall(x1, y1, x2, y2) {
    const newState = this.history[this.historyIndex].clone();
    const wallsToAdd = geo.maybeSplitWall(x1, y1, x2, y2, newState.doors);
    newState.interiorWalls = newState.interiorWalls.concat(wallsToAdd);
    await this.pushState(newState);
  }

  // Batch add multiple interior wall segments in a single pushState
  async addInteriorWallSegments(segments) {
    const newState = this.history[this.historyIndex].clone();
    for (const seg of segments) {
      const wallsToAdd = geo.maybeSplitWall(
        seg[0],
        seg[1],
        seg[2],
        seg[3],
        newState.doors
      );
      newState.interiorWalls = newState.interiorWalls.concat(wallsToAdd);
    }
    await this.pushState(newState);
  }

  // Add interior wall shape (dense points for smooth rendering)
  async addInteriorWallShape(points) {
    const newState = this.history[this.historyIndex].clone();
    newState.interiorWallShapes.push(points);
    await this.pushState(newState);
  }

  // Add ellipse as interior wall shape
  async addInteriorWallEllipse(x, y, width, height) {
    const ellipsePoly = geo.ellipse(x, y, width, height);
    const coords = ellipsePoly.getExteriorRing().getCoordinates();
    const points = coords.map((c) => [c.x, c.y]);
    await this.addInteriorWallShape(points);
  }

  // {x:, y:, height:, width:}
  async removeInteriorWalls(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const oldState = this.history[this.historyIndex];

    // Filter existing segments
    const wallsToKeep = oldState.interiorWalls.filter((w) => {
      const wallPoly = geo.twoPointsToLineString(w[0], w[1], w[2], w[3]);
      return !geo.intersects(rectPoly, wallPoly);
    });

    // Filter shapes
    const shapesToKeep = (oldState.interiorWallShapes || []).filter((shape) => {
      try {
        const shapePoly = geo.pointsToPolygon(shape);
        return !geo.intersects(rectPoly, shapePoly);
      } catch (error) {
        console.warn(
          "DungeonDraw: Invalid interior wall shape, removing:",
          error
        );
        return false;
      }
    });

    const hasRemovals =
      wallsToKeep.length !== oldState.interiorWalls.length ||
      shapesToKeep.length !== (oldState.interiorWallShapes || []).length;

    if (hasRemovals) {
      const newState = oldState.clone();
      newState.interiorWalls = wallsToKeep;
      newState.interiorWallShapes = shapesToKeep;
      await this.pushState(newState);
    }
  }

  // {x:, y:, height:, width:}
  async removeInvisibleWalls(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const oldState = this.history[this.historyIndex];

    // Filter existing segments
    const wallsToKeep = oldState.invisibleWalls.filter((w) => {
      const wallPoly = geo.twoPointsToLineString(w[0], w[1], w[2], w[3]);
      return !geo.intersects(rectPoly, wallPoly);
    });

    // Filter shapes
    const shapesToKeep = (oldState.invisibleWallShapes || []).filter(
      (shape) => {
        try {
          const shapePoly = geo.pointsToPolygon(shape);
          return !geo.intersects(rectPoly, shapePoly);
        } catch (error) {
          console.warn(
            "DungeonDraw: Invalid invisible wall shape, removing:",
            error
          );
          return false;
        }
      }
    );

    const hasRemovals =
      wallsToKeep.length !== oldState.invisibleWalls.length ||
      shapesToKeep.length !== (oldState.invisibleWallShapes || []).length;

    if (hasRemovals) {
      const newState = oldState.clone();
      newState.invisibleWalls = wallsToKeep;
      newState.invisibleWallShapes = shapesToKeep;
      await this.pushState(newState);
    }
  }

  // {x:, y:, height:, width:}
  async removeDoors(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const oldState = this.history[this.historyIndex];
    const doorsToKeep = oldState.doors.filter((d) => {
      const doorPoly = geo.twoPointsToLineString(d[0], d[1], d[2], d[3]);
      return !geo.intersects(rectPoly, doorPoly);
    });
    if (doorsToKeep.length != oldState.doors.length) {
      const newState = oldState.clone();
      newState.doors = doorsToKeep;
      await this.pushState(newState);
    }
  }

  // {x:, y:, height:, width:}
  async removeSecretDoors(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const oldState = this.history[this.historyIndex];
    const secretDoorsToKeep = oldState.secretDoors.filter((d) => {
      const doorPoly = geo.twoPointsToLineString(d[0], d[1], d[2], d[3]);
      return !geo.intersects(rectPoly, doorPoly);
    });
    if (secretDoorsToKeep.length != oldState.secretDoors.length) {
      const newState = oldState.clone();
      newState.secretDoors = secretDoorsToKeep;
      await this.pushState(newState);
    }
  }

  // {x:, y:, height:, width:}
  async removeWindows(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const oldState = this.history[this.historyIndex];
    const windowsToKeep = oldState.windows.filter((w) => {
      const windowPoly = geo.twoPointsToLineString(w[0], w[1], w[2], w[3]);
      return !geo.intersects(rectPoly, windowPoly);
    });
    if (windowsToKeep.length != oldState.windows.length) {
      const newState = oldState.clone();
      newState.windows = windowsToKeep;
      await this.pushState(newState);
    }
  }

  async _addPoly(poly) {
    const oldState = this.history[this.historyIndex];
    const newState = oldState.clone();
    if (newState.geometry) {
      newState.geometry = geo.union(newState.geometry, poly);
      const touches = geo.touches(oldState.geometry, poly);
      if (touches) {
        const intersection = geo.intersection(oldState.geometry, poly);
        const coordinates = intersection.getCoordinates();
        // TODO: do we need to handle more complicated overlaps, GeometryCollection etc?
        // this coordinate 2-step is flimsy
        if (coordinates.length > 1 && coordinates.length % 2 === 0) {
          for (let i = 0; i < coordinates.length; i += 2) {
            const wallsToAdd = geo.maybeSplitWall(
              coordinates[i].x,
              coordinates[i].y,
              coordinates[i + 1].x,
              coordinates[i + 1].y,
              newState.doors
            );
            newState.interiorWalls = newState.interiorWalls.concat(wallsToAdd);
          }
        }
      } else {
        // also nuke any interior walls in this new poly
        const wallsToKeep = newState.interiorWalls.filter((w) => {
          const wallPoly = geo.twoPointsToLineString(w[0], w[1], w[2], w[3]);
          return !geo.intersects(poly, wallPoly);
        });
        if (wallsToKeep.length != newState.interiorWalls.length) {
          newState.interiorWalls = wallsToKeep;
        }
      }
    } else {
      newState.geometry = poly;
    }
    await this.pushState(newState);
  }

  // {x:, y:, height:, width:}
  async addRectangle(rect) {
    const poly = geo.rectToPolygon(rect);
    this._addPoly(poly);
  }

  // {x:, y:, height:, width:}
  async removeRectangle(rect) {
    const poly = geo.rectToPolygon(rect);
    await this._removePoly(poly);
  }

  async addGridPaintedArea(multiPoly) {
    if (!geo.isValid(multiPoly)) {
      ui.notifications.error(game.i18n.localize("DD.ErrorInvalidShape"));
      return;
    }
    try {
      this._addPoly(multiPoly);
    } catch (error) {
      console.log(error);
      //TODO add a "error adding multigon" localization?
      ui.notifications.error(game.i18n.localize("DD.ErrorAddingPolygon"));
    }
  }

  async removeGridPaintedArea(multiPoly) {
    if (!geo.isValid(multiPoly)) {
      ui.notifications.error(game.i18n.localize("DD.ErrorInvalidShape"));
      return;
    }
    try {
      this._removePoly(multiPoly);
    } catch (error) {
      console.log(error);
      //TODO add a "error removing multigon" localization?
      ui.notifications.error(game.i18n.localize("DD.ErrorAddingPolygon"));
    }
  }

  async _removePoly(poly) {
    // only makes sense to remove if we have geometry
    if (!this.history[this.historyIndex].geometry) {
      return;
    }
    // and if the poly intersects existing geometry
    if (!geo.intersects(this.history[this.historyIndex].geometry, poly)) {
      return;
    }
    const newState = this.history[this.historyIndex].clone();
    newState.geometry = geo.difference(newState.geometry, poly);
    await this.pushState(newState);
  }

  // [[x,y]...]
  async addPolygon(points) {
    const poly = geo.pointsToPolygon(points);
    if (!geo.isValid(poly)) {
      ui.notifications.error(game.i18n.localize("DD.ErrorInvalidShape"));
      return;
    }
    try {
      await this._addPoly(poly);
    } catch (error) {
      console.log(error);
      ui.notifications.error(game.i18n.localize("DD.ErrorAddingPolygon"));
    }
  }

  // [[x,y]...]
  async removePolygon(points) {
    const poly = geo.pointsToPolygon(points);
    if (!geo.isValid(poly)) {
      ui.notifications.error(game.i18n.localize("DD.ErrorInvalidShape"));
      return;
    }
    try {
      await this._removePoly(poly);
    } catch (error) {
      console.log(error);
      ui.notifications.error(game.i18n.localize("DD.ErrorRemovingPolygon"));
    }
  }

  async addEllipse(x, y, width, height) {
    const poly = geo.ellipse(x, y, width, height);
    if (!geo.isValid(poly)) {
      ui.notifications.error(game.i18n.localize("DD.ErrorInvalidShape"));
      return;
    }
    try {
      await this._addPoly(poly);
    } catch (error) {
      console.log(error);
      ui.notifications.error(game.i18n.localize("DD.ErrorAddingPolygon"));
    }
  }

  async removeEllipse(x, y, width, height) {
    const poly = geo.ellipse(x, y, width, height);
    if (!geo.isValid(poly)) {
      ui.notifications.error(game.i18n.localize("DD.ErrorInvalidShape"));
      return;
    }
    try {
      await this._removePoly(poly);
    } catch (error) {
      console.log(error);
      ui.notifications.error(game.i18n.localize("DD.ErrorRemovingPolygon"));
    }
  }

  async addThemeArea(points) {
    // make sure we can create a valid polygon from the points
    const poly = geo.pointsToPolygon(points);
    if (!geo.isValid(poly)) {
      ui.notifications.error(game.i18n.localize("DD.ErrorInvalidShape"));
      return;
    }

    const themeKey = getThemePainterThemeKey();
    const theme = getTheme(themeKey);
    const newArea = {
      points,
      config: theme.config,
    };
    const newState = this.history[this.historyIndex].clone();
    newState.themeAreas.push(newArea);
    await this.pushState(newState);
  }

  async addThemeAreaFromGeometry(geometry) {
    if (!geo.isValid(geometry)) {
      ui.notifications.error(game.i18n.localize("DD.ErrorInvalidShape"));
      return;
    }

    const themeKey = getThemePainterThemeKey();
    const theme = getTheme(themeKey);

    // Extract points from the geometry's exterior ring
    // Handle both Polygon and MultiPolygon
    let exteriorRing;
    if (geometry.getExteriorRing) {
      exteriorRing = geometry.getExteriorRing();
    } else if (geometry.getNumGeometries && geometry.getNumGeometries() > 0) {
      const firstGeom = geometry.getGeometryN(0);
      exteriorRing = firstGeom?.getExteriorRing?.();
    }
    if (!exteriorRing) {
      ui.notifications.error(game.i18n.localize("DD.ErrorInvalidShape"));
      return;
    }
    const coords = exteriorRing.getCoordinates();

    const points = coords.map((c) => [c.x, c.y]);

    const newArea = {
      points,
      config: theme.config,
    };
    const newState = this.history[this.historyIndex].clone();
    newState.themeAreas.push(newArea);
    await this.pushState(newState);
  }

  // {x:, y:, height:, width:}
  async removeThemeAreas(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const areasToKeep = this.history[this.historyIndex].themeAreas.filter(
      (a) => {
        try {
          const areaPoly = geo.pointsToPolygon(a.points);
          return !geo.intersects(rectPoly, areaPoly);
        } catch (error) {
          console.log(error);
          return false;
        }
      }
    );
    if (
      areasToKeep.length != this.history[this.historyIndex].themeAreas.length
    ) {
      const newState = this.history[this.historyIndex].clone();
      newState.themeAreas = areasToKeep;
      await this.pushState(newState);
    }
  }

  // { x1, y1, x2, y2, x3, y3, x4, y4 }
  async addStairs(stairData) {
    const newState = this.history[this.historyIndex].clone();
    newState.stairs.push(stairData);
    await this.pushState(newState);
  }

  // {x:, y:, height:, width:}
  async removeStairs(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const oldState = this.history[this.historyIndex];
    const stairsToKeep = oldState.stairs.filter((s) => {
      try {
        // Create polygon from the 4 corners of the stair trapezoid
        const stairPoints = [
          [s.x1, s.y1],
          [s.x2, s.y2],
          [s.x4, s.y4],
          [s.x3, s.y3],
          [s.x1, s.y1],
        ];
        const stairPoly = geo.pointsToPolygon(stairPoints);
        return !geo.intersects(rectPoly, stairPoly);
      } catch (error) {
        console.log(error);
        return false;
      }
    });
    if (stairsToKeep.length != oldState.stairs.length) {
      const newState = oldState.clone();
      newState.stairs = stairsToKeep;
      await this.pushState(newState);
    }
  }
}
