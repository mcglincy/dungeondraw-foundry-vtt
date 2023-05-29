import * as constants from "./constants.js";
import { Dungeon } from "./dungeon.js";
import { regenerate } from "./generator.js";
import { Settings } from "./settings.js";

const FOLDER_NAME = "Dungeon Draw";

/** Handle both v8 and v9 styles of detecting shift */
const shiftPressed = () => {
  if (KeyboardManager.MODIFIER_KEYS?.SHIFT) {
    return game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.SHIFT);
  }
  return game.keyboard.isDown("SHIFT");
};

const findDungeonEntryAndNote = () => {
  for (const note of canvas.scene.notes) {
    const journalEntry = game.journal.get(note.entryId);
    if (journalEntry) {
      const flag = journalEntry.getFlag(
        constants.MODULE_NAME,
        "dungeonVersion"
      );
      if (flag) {
        return { journalEntry, note };
      }
    }
  }
  return { journalEntry: null, note: null };
};

const createDungeonEntryAndNote = async () => {
  const journalEntry = await createDungeonEntry();
  const note = await createDungeonNote(journalEntry);
  return { journalEntry, note };
};

const createDungeonEntry = async () => {
  let folder = game.folders
    .filter((f) => f.type === "JournalEntry" && f.name === FOLDER_NAME)
    .pop();
  if (!folder) {
    folder = await Folder.create({
      name: FOLDER_NAME,
      type: "JournalEntry",
    });
  }

  const journalEntry = await JournalEntry.create({
    name: canvas.scene.name,
    folder: folder.id,
    flags: {
      "dungeon-draw": {
        // extract string constant somewhere
        dungeonVersion: "1.0",
      },
    },
  });
  return journalEntry;
};

const createDungeonNote = async (journalEntry) => {
  await canvas.scene.createEmbeddedDocuments("Note", [
    {
      entryId: journalEntry.id,
      fontSize: 20,
      icon: "icons/svg/cave.svg",
      iconSize: 32,
      textAnchor: 1,
      textColor: "#FFFFFF",
      x: 50,
      y: 50,
      iconTint: "",
      text: "Dungeon Draw",
      flags: {},
    },
  ]);
};

const onFreeHandMouseDraw = (preview, event) => {
  const { destination } = event.interactionData;
  const position = destination;
  const now = Date.now();
  const temporary =
    now - preview._drawTime < preview.constructor.FREEHAND_SAMPLE_RATE;
  const snap = false;
  preview._addPoint(position, { snap, temporary });
  preview.refresh();
};

const createDataOffsetPoints = (createData) => {
  const offsetPoints = [];
  for (let i = 0; i <= createData.shape.points.length - 2; i += 2) {
    offsetPoints.push([
      createData.shape.points[i] + createData.x,
      createData.shape.points[i + 1] + createData.y,
    ]);
  }
  return offsetPoints;
};

/**
 *
 * @extends {PlaceablesLayer}
 */
export class DungeonLayer extends PlaceablesLayer {
  static LAYER_NAME = "dungeon";

  constructor() {
    super();
    this.dungeon = null;
  }

  /** @inheritdoc */
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: DungeonLayer.LAYER_NAME,
      canDragCreate: true,
      // we use our own snapToGrid setting to control snap
      snapToGrid: Settings.snapToGrid(),
      zIndex: -1, // under tiles and background image
      quadtree: true,
    });
  }

  /**
   * Use an adaptive precision depending on the size of the grid
   * @type {number}
   */
  // get gridPrecision() {
  //   if ( canvas.scene.data.gridType === CONST.GRID_TYPES.GRIDLESS ) return 0;
  //   return canvas.dimensions.size >= 128 ? 16 : 8;
  // }

  // TODO: figure out what documentName / embeddedName / type we should be using
  /** @inheritdoc */
  static documentName = "Drawing";

  /**
   * Get initial data for a new drawing.
   * Start with some global defaults, apply user default config, then apply mandatory overrides per tool.
   * @param {Object} origin     The initial coordinate
   * @return {Object}           The new drawing data
   */
  _getNewDrawingData(origin) {
    const data = {
      fillColor: game.user.color,
      strokeColor: game.user.color,
      strokeWidth: 8,
    };
    // Mandatory additions
    data.x = origin.x;
    data.y = origin.y;
    data.author = game.user.id;
    data.shape = {};

    if (game.activeDungeonDrawMode === "add") {
      switch (game.activeDungeonDrawTool) {
        case "rectangle":
          data.shape.type = CONST.DRAWING_TYPES.RECTANGLE;
          data.shape.width = 1;
          data.shape.height = 1;
          break;
        case "polygon":
        case "interiorwall":
        case "door":
        case "secretdoor":
        case "invisiblewall":
        case "themepainter":
          data.type = CONST.DRAWING_TYPES.POLYGON;
          data.points = [0, 0];
          data.bezierFactor = 0;
          break;
        case "freehand":
          data.type = CONST.DRAWING_TYPES.POLYGON;
          data.points = [0, 0];
          data.bezierFactor = data.bezierFactor ?? 0.5;
          break;
        case "ellipse":
          data.type = CONST.DRAWING_TYPES.ELLIPSE;
          data.shape.width = 1;
          data.shape.height = 1;
          break;
      }
    } else if (game.activeDungeonDrawMode === "remove") {
      switch (game.activeDungeonDrawTool) {
        case "rectangle":
        case "interiorwall":
        case "door":
        case "secretdoor":
        case "invisiblewall":
        case "themepainter":
          data.type = CONST.DRAWING_TYPES.RECTANGLE;
          data.shape.width = 1;
          data.shape.height = 1;
          break;
        case "polygon":
          data.type = CONST.DRAWING_TYPES.POLYGON;
          data.points = [0, 0];
          data.bezierFactor = 0;
          break;
        case "freehand":
          data.type = CONST.DRAWING_TYPES.POLYGON;
          data.points = [0, 0];
          data.bezierFactor = data.bezierFactor ?? 0.5;
          break;
        case "ellipse":
          data.type = CONST.DRAWING_TYPES.ELLIPSE;
          data.shape.width = 1;
          data.shape.height = 1;
          break;
      }
    }
    return data;
  }

  /** @override */
  async undoHistory() {
    return super.undoHistory();
  }

  /** @override */
  async deleteAll() {
    if (!game.user.isGM) {
      throw new Error(`You do not have permission to clear all.`);
    }
    return Dialog.confirm({
      title: game.i18n.localize("DD.ButtonTitleClearAll"),
      content: `<p>${game.i18n.localize("DD.ClearAllDialogContent")}</p>`,
      yes: () => this.dungeon?.deleteAll(),
    });
  }

  async generate(config) {
    if (this.dungeon) {
      await this.dungeon.deleteAll();
    } else {
      await this.createNewDungeon();
    }
    await regenerate(this.dungeon, config);
  }

  /* -------------------------------------------- */

  async loadDungeon() {
    const { journalEntry, note } = await findDungeonEntryAndNote();
    if (journalEntry) {
      this.dungeon = new Dungeon(journalEntry, note);
      await this.dungeon.loadFromJournalEntry();
      // add dungeon underneath any placeables or drawing preview
      this.addChildAt(this.dungeon, 0);
    } else {
      // no journal entry and note found, so make sure dungeon is nulled on this layer
      this.dungeon = null;
    }
  }

  async createNewDungeon() {
    await createDungeonEntryAndNote();
    await this.loadDungeon();
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async draw() {
    await super.draw();
    return this;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  _onClickLeft(event) {
    const { preview, drawingsState, destination } = event.interactionData;

    // Continue polygon point placement
    if (drawingsState >= 1 && preview.isPolygon) {
      let point = destination;
      const snap = !event.shiftKey;
      if (snap)
        point = canvas.grid.getSnappedPosition(
          point.x,
          point.y,
          this.gridPrecision
        );
      preview._addPoint(point, false);
      // TODO: this v11 addPoint snap doesn't seem to work for our polygon drawing
      // preview._addPoint(point, {snap, round: true});
      preview._chain = true; // Note that we are now in chain mode
      return preview.refresh();
    }
    super._onClickLeft(event);
  }

  /** @override */
  _onClickLeft2(event) {
    const { drawingsState, preview } = event.interactionData;

    // Conclude polygon placement with double-click
    if (drawingsState >= 1 && preview.isPolygon) {
      event.interactionData.drawingsState = 2;
      return this._onDragLeftDrop(event);
    }

    super._onClickLeft2(event);
  }

  /** @override */
  async _onDragLeftStart(event) {
    // TODO: DrawingsLayer _onDragLeftStart isn't seeing the shift key press,
    // so set it for them ourselves :P
    // TODO: double-check that this is still the case for v11
    //event.data.originalEvent.isShift = shiftPressed();

    // superclass will handle layerOptions.snapToGrid
    await super._onDragLeftStart(event);
    const interaction = event.interactionData;
    // we use a Drawing as our preview, but then on end-drag/completion,
    // update our single Dungeon instance.
    const data = this._getNewDrawingData(event.interactionData.origin);
    const document = new DrawingDocument(data, { parent: canvas.scene });
    const drawing = new Drawing(document);
    interaction.preview = this.preview.addChild(drawing);
    interaction.drawingsState = 1;
    return drawing.draw();
  }

  /** @override */
  _onDragLeftMove(event) {
    const { preview, drawingsState } = event.interactionData;
    if (!preview || preview._destroyed) {
      return;
    }
    if (preview.parent === null) {
      // In theory this should never happen, but rarely does
      this.preview.addChild(preview);
    }
    if (drawingsState >= 1) {
      // TODO: deal with v10 having freehand-tool specific handling in DrawingShape :P
      if (game.activeDungeonDrawTool === "freehand") {
        onFreeHandMouseDraw(preview, event);
      } else {
        preview._onMouseDraw(event);
      }
      // easy single opcode
      const opcode = game.activeDungeonDrawMode + game.activeDungeonDrawTool;
      if (
        preview.document.shape.type !== CONST.DRAWING_TYPES.POLYGON ||
        opcode === "adddoor" ||
        opcode === "addinteriorwall" ||
        opcode === "addsecretdoor" ||
        opcode === "addinvisiblewall"
      ) {
        event.interactionData.drawingsState = 2;
      }
    }
  }

  _maybeSnappedRect(createData) {
    if (Settings.snapToGrid() && !shiftPressed()) {
      const snapPos = canvas.grid.getSnappedPosition(
        createData.x + createData.shape.width,
        createData.y + createData.shape.height,
        this.gridPrecision
      );
      createData.shape.height = snapPos.y - createData.y;
      createData.shape.width = snapPos.x - createData.x;
    }
    const rect = {
      x: createData.x,
      y: createData.y,
      height: createData.shape.height,
      width: createData.shape.width,
    };
    return rect;
  }

  _maybeSnapLastPoint(createData) {
    const length = createData.shape.points.length;
    if (length === 0) {
      return;
    }
    if (Settings.snapToGrid() && !shiftPressed()) {
      const snapPos = canvas.grid.getSnappedPosition(
        createData.shape.points[length - 2],
        createData.shape.points[length - 1],
        this.gridPrecision
      );
      createData.shape.points[length - 2] = snapPos.x;
      createData.shape.points[length - 1] = snapPos.y;
    }
  }

  _autoClosePolygon(createData) {
    const length = createData.shape.points.length;
    if (
      length > 4 &&
      (createData.shape.points[0] !== createData.shape.points[length - 2] ||
        createData.shape.points[1] !== createData.shape.points[length - 1])
    ) {
      // auto-close the polygon
      createData.shape.points.push(
        createData.shape.points[0],
        createData.shape.points[1]
      );
    }
  }

  /** @override */
  async _onDragLeftDrop(event) {
    // preview is of type Drawing.
    // Drawing.DrawingDocument.shape is shape data
    const { destination, origin, preview } = event.interactionData;
    let drawingsState = event.interactionData.drawingsState;

    // recognize completed polygons
    if (
      game.activeDungeonDrawTool === "polygon" ||
      game.activeDungeonDrawTool === "themepainter"
    ) {
      const length = preview.document.shape.points.length;
      const closedPolygon =
        preview.isPolygon &&
        length > 4 &&
        preview.document.shape.points[0] ==
          preview.document.shape.points[length - 2] &&
        preview.document.shape.points[1] ==
          preview.document.shape.points[length - 1];
      if (closedPolygon) {
        // advance the drawing state to finish it
        drawingsState = 2;
      }
    }

    // easy single opcode
    const opcode = game.activeDungeonDrawMode + game.activeDungeonDrawTool;

    // Successful drawing completion
    // TODO: why is freehand not properly advancing drawingsState?
    // TODO: verify this is still the case in v11
    if (drawingsState === 2 || game.activeDungeonDrawTool === "freehand") {
      // create a new dungeon if we don't already have one
      if (!this.dungeon) {
        await this.createNewDungeon();
      }
      const distance = Math.hypot(
        destination.x - origin.x,
        destination.y - origin.y
      );
      const minDistance = distance >= canvas.dimensions.size / 8;
      const completePolygon =
        preview.isPolygon && preview.document.shape.points.length > 4;

      // Clean up and DRY up these if/else blocks
      if (opcode === "adddoor") {
        event.interactionData.drawingsState = 0;
        // clone the shape data
        const data = preview.document.toObject(false);
        preview._chain = false;
        this._maybeSnapLastPoint(data);
        await this.dungeon.addDoor(
          data.x,
          data.y,
          data.x + data.shape.points[2],
          data.y + data.shape.points[3]
        );
      } else if (opcode === "addsecretdoor") {
        event.interactionData.drawingsState = 0;
        const data = preview.document.toObject(false);
        preview._chain = false;
        this._maybeSnapLastPoint(data);
        await this.dungeon.addSecretDoor(
          data.x,
          data.y,
          data.x + data.shape.points[2],
          data.y + data.shape.points[3]
        );
      } else if (opcode === "addinteriorwall") {
        event.interactionData.drawingsState = 0;
        const data = preview.document.toObject(false);
        preview._chain = false;
        this._maybeSnapLastPoint(data);
        await this.dungeon.addInteriorWall(
          data.x,
          data.y,
          data.x + data.shape.points[2],
          data.y + data.shape.points[3]
        );
      } else if (opcode === "addinvisiblewall") {
        event.interactionData.drawingsState = 0;
        const data = preview.document.toObject(false);
        preview._chain = false;
        this._maybeSnapLastPoint(data);
        await this.dungeon.addInvisibleWall(
          data.x,
          data.y,
          data.x + data.shape.points[2],
          data.y + data.shape.points[3]
        );
      } else if (minDistance || completePolygon) {
        event.interactionData.drawingsState = 0;
        const data = preview.document.toObject(false);
        preview._chain = false;
        // TODO: do we care about normalizing the shape? maybe for freehand curves/lines?
        const createData = this.constructor.placeableClass.normalizeShape(data);
        if (opcode === "addellipse") {
          const x = createData.x + createData.shape.width / 2;
          const y = createData.y + createData.shape.height / 2;
          await this.dungeon.addEllipse(
            x,
            y,
            createData.shape.width,
            createData.shape.height
          );
        } else if (opcode === "addfreehand") {
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          await this.dungeon.addPolygon(offsetPoints);
        } else if (opcode === "addpolygon") {
          this._maybeSnapLastPoint(createData);
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          await this.dungeon.addPolygon(offsetPoints);
        } else if (opcode === "addrectangle") {
          const rect = this._maybeSnappedRect(createData);
          await this.dungeon.addRectangle(rect);
        } else if (opcode === "addthemepainter") {
          this._maybeSnapLastPoint(createData);
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          await this.dungeon.addThemeArea(offsetPoints);
        } else if (opcode === "removedoor") {
          const rect = this._maybeSnappedRect(createData);
          // TODO: need to spam out methods to various different flavor deletions
          await this.dungeon.removeDoors(rect);
        } else if (opcode === "removeellipse") {
          const x = createData.x + createData.shape.width / 2;
          const y = createData.y + createData.shape.height / 2;
          await this.dungeon.removeEllipse(
            x,
            y,
            createData.shape.width,
            createData.shape.height
          );
        } else if (opcode === "removefreehand") {
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          await this.dungeon.removePolygon(offsetPoints);
        } else if (opcode === "removesecretdoor") {
          const rect = this._maybeSnappedRect(createData);
          await this.dungeon.removeSecretDoors(rect);
        } else if (opcode === "removeinteriorwall") {
          const rect = this._maybeSnappedRect(createData);
          await this.dungeon.removeInteriorWalls(rect);
        } else if (opcode === "removeinvisiblewall") {
          const rect = this._maybeSnappedRect(createData);
          await this.dungeon.removeInvisibleWalls(rect);
        } else if (opcode === "removepolygon") {
          this._maybeSnapLastPoint(createData);
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          await this.dungeon.removePolygon(offsetPoints);
        } else if (opcode === "removerectangle") {
          const rect = this._maybeSnappedRect(createData);
          await this.dungeon.removeRectangle(rect);
        } else if (opcode === "removethemepainter") {
          const rect = this._maybeSnappedRect(createData);
          await this.dungeon.removeThemeAreas(rect);
        }
      }

      // Cancel the preview
      return this._onDragLeftCancel(event);
    }

    // In-progress polygon
    if (drawingsState === 1 && preview.isPolygon) {
      event.preventDefault();
      if (preview._chain) {
        return;
      }
      return this._onClickLeft(event);
    }

    // Incomplete drawing
    return this._onDragLeftCancel(event);
  }
}
