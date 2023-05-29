import { DungeonState } from "./dungeonstate.js";
import { render } from "./renderer.js";
import * as geo from "./geo-utils.js";
import { getTheme, getThemePainterThemeKey } from "./themes.js";

/**
 * @extends {PlaceableObject}
 */
// TODO: does Dungeon even need to be a PlaceableObject? Or could it just extend PIXI.Container?
export class Dungeon extends PlaceableObject {
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
  static embeddedName = "Drawing";

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
    await FilePicker.upload("data", folder, file, {});
    const path = folder ? folder + "/" + filename : filename;
    console.log(path);
    // make sure we don't keep using a cached copy
    // TODO: TextureLoader #cache is now a private instance var
    // TextureLoader.loader.cache.delete(path);
    if (canvas.scene.img === path) {
      // cheat to force a scene update when we're re-saving to the same filename
      await canvas.scene.update({ img: null }, { render: false });
    }
    await canvas.scene.update({ img: path });

    // remove our mask
    this.mask = null;
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

  // {x:, y:, height:, width:}
  async removeInteriorWalls(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const wallsToKeep = this.history[this.historyIndex].interiorWalls.filter(
      (w) => {
        const wallPoly = geo.twoPointsToLineString(w[0], w[1], w[2], w[3]);
        return !geo.intersects(rectPoly, wallPoly);
      }
    );
    if (
      wallsToKeep.length != this.history[this.historyIndex].interiorWalls.length
    ) {
      const newState = this.history[this.historyIndex].clone();
      newState.interiorWalls = wallsToKeep;
      await this.pushState(newState);
    }
  }

  // {x:, y:, height:, width:}
  async removeInvisibleWalls(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const wallsToKeep = this.history[this.historyIndex].invisibleWalls.filter(
      (w) => {
        const wallPoly = geo.twoPointsToLineString(w[0], w[1], w[2], w[3]);
        return !geo.intersects(rectPoly, wallPoly);
      }
    );
    if (
      wallsToKeep.length !=
      this.history[this.historyIndex].invisibleWalls.length
    ) {
      const newState = this.history[this.historyIndex].clone();
      newState.invisibleWalls = wallsToKeep;
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
}
