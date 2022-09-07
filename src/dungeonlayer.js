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
    const journalEntry = game.journal.get(note.data.entryId);
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
    .filter((f) => f.data.type === "JournalEntry" && f.name === FOLDER_NAME)
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
      // canDragCreate: game.user.isGM,
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

    if (game.activeDungeonDrawMode === "add") {
      switch (game.activeDungeonDrawTool) {
        case "rectangle":
          data.type = CONST.DRAWING_TYPES.RECTANGLE;
          data.points = [];
          break;
        case "polygon":
        case "interiorwall":
        case "door":
        case "secretdoor":
        case "invisiblewall":
        case "themepainter":
          data.type = CONST.DRAWING_TYPES.POLYGON;
          data.points = [[0, 0]];
          break;
        case "freehand":
          data.type = CONST.DRAWING_TYPES.FREEHAND;
          data.points = [[0, 0]];
          data.bezierFactor = data.bezierFactor ?? 0.5;
          break;
        case "ellipse":
          data.type = CONST.DRAWING_TYPES.ELLIPSE;
          data.points = [];
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
          data.points = [];
          break;
        case "polygon":
          data.type = CONST.DRAWING_TYPES.POLYGON;
          data.points = [[0, 0]];
          break;
        case "freehand":
          data.type = CONST.DRAWING_TYPES.FREEHAND;
          data.points = [[0, 0]];
          data.bezierFactor = data.bezierFactor ?? 0.5;
          break;
        case "ellipse":
          data.type = CONST.DRAWING_TYPES.ELLIPSE;
          data.points = [];
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
    const { preview, createState, originalEvent } = event.data;

    // Continue polygon point placement
    if (createState >= 1 && preview.isPolygon) {
      let point = event.data.destination;
      if (!originalEvent.shiftKey)
        point = canvas.grid.getSnappedPosition(
          point.x,
          point.y,
          this.gridPrecision
        );
      preview._addPoint(point, false);
      preview._chain = true; // Note that we are now in chain mode
      return preview.refresh();
    }
    super._onClickLeft(event);
  }

  /** @override */
  _onClickLeft2(event) {
    const { createState, preview } = event.data;

    // Conclude polygon placement with double-click
    if (createState >= 1 && preview.isPolygon) {
      event.data.createState = 2;
      return this._onDragLeftDrop(event);
    }

    super._onClickLeft2(event);
  }

  /** @override */
  async _onDragLeftStart(event) {
    // TODO: DrawingsLayer _onDragLeftStart isn't seeing the shift key press,
    // so set it for them ourselves :P
    event.data.originalEvent.isShift = shiftPressed();

    // superclass will handle layerOptions.snapToGrid
    await super._onDragLeftStart(event);

    // TODO: why is super._onDragleftStart() not setting createState?
    event.data.createState = 1;

    // we use a Drawing as our preview, but then on end-drag/completion,
    // update our single Dungeon instance.
    const data = this._getNewDrawingData(event.data.origin);
    const document = new DrawingDocument(data, { parent: canvas.scene });
    const drawing = new Drawing(document);
    event.data.preview = this.preview.addChild(drawing);
    return drawing.draw();
  }

  /** @override */
  _onDragLeftMove(event) {
    // easy single opcode
    const opcode = game.activeDungeonDrawMode + game.activeDungeonDrawTool;

    const { preview, createState } = event.data;
    if (!preview) {
      return;
    }
    if (preview.parent === null) {
      // In theory this should never happen, but rarely does
      this.preview.addChild(preview);
    }
    if (createState >= 1) {
      preview._onMouseDraw(event);
      if (
        preview.data.type !== CONST.DRAWING_TYPES.POLYGON ||
        opcode === "adddoor" ||
        opcode === "addinteriorwall" ||
        opcode === "addsecretdoor" ||
        opcode === "addinvisiblewall"
      ) {
        event.data.createState = 2;
      }
    }
  }

  _maybeSnappedEndPoint(data) {
    const endPoint = data.points[1];
    if (Settings.snapToGrid() && !shiftPressed()) {
      const snapPos = canvas.grid.getSnappedPosition(
        endPoint[0],
        endPoint[1],
        this.gridPrecision
      );
      endPoint[0] = snapPos.x;
      endPoint[1] = snapPos.y;
    }
    return endPoint;
  }

  _maybeSnappedRect(createData) {
    if (Settings.snapToGrid() && !shiftPressed()) {
      const snapPos = canvas.grid.getSnappedPosition(
        createData.x + createData.width,
        createData.y + createData.height,
        this.gridPrecision
      );
      createData.height = snapPos.y - createData.y;
      createData.width = snapPos.x - createData.x;
    }
    const rect = {
      x: createData.x,
      y: createData.y,
      height: createData.height,
      width: createData.width,
    };
    return rect;
  }

  _maybeSnapLastPoint(createData) {
    const length = createData.points.length;
    if (length === 0) {
      return;
    }
    if (Settings.snapToGrid() && !shiftPressed()) {
      const snapPos = canvas.grid.getSnappedPosition(
        createData.points[length - 1][0],
        createData.points[length - 1][1],
        this.gridPrecision
      );
      createData.points[length - 1][0] = snapPos.x;
      createData.points[length - 1][1] = snapPos.y;
    }
  }

  _autoClosePolygon(createData) {
    const length = createData.points.length;
    if (
      length > 2 &&
      (createData.points[0][0] !== createData.points[length - 1][0] ||
        createData.points[0][1] !== createData.points[length - 1][1])
    ) {
      // auto-close the polygon
      createData.points.push(createData.points[0]);
    }
  }

  /** @override */
  async _onDragLeftDrop(event) {
    const { createState, destination, origin, preview } = event.data;

    // easy single opcode
    const opcode = game.activeDungeonDrawMode + game.activeDungeonDrawTool;

    // Successful drawing completion
    // TODO: why is freehand not properly advancing createState?
    if (createState === 2 || game.activeDungeonDrawTool === "freehand") {
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
        preview.isPolygon && preview.data.points.length > 2;

      // Clean up and DRY up these if/else blocks
      if (opcode === "adddoor") {
        event.data.createState = 0;
        const data = preview.data.toObject(false);
        preview._chain = false;
        //const endPoint = this._maybeSnappedEndPoint(data);
        this._maybeSnapLastPoint(data);
        await this.dungeon.addDoor(
          data.x,
          data.y,
          // data.x + endPoint[0],
          // data.y + endPoint[1]
          data.x + data.points[1][0],
          data.y + data.points[1][1]
        );
      } else if (opcode === "addsecretdoor") {
        event.data.createState = 0;
        const data = preview.data.toObject(false);
        preview._chain = false;
        // const endPoint = this._maybeSnappedEndPoint(data);
        this._maybeSnapLastPoint(data);
        await this.dungeon.addSecretDoor(
          data.x,
          data.y,
          // data.x + endPoint[0],
          // data.y + endPoint[1]
          data.x + data.points[1][0],
          data.y + data.points[1][1]
        );
      } else if (opcode === "addinteriorwall") {
        event.data.createState = 0;
        const data = preview.data.toObject(false);
        preview._chain = false;
        // const endPoint = this._maybeSnappedEndPoint(data);
        this._maybeSnapLastPoint(data);
        await this.dungeon.addInteriorWall(
          data.x,
          data.y,
          // data.x + endPoint[0],
          // data.y + endPoint[1]
          data.x + data.points[1][0],
          data.y + data.points[1][1]
        );
      } else if (opcode === "addinvisiblewall") {
        event.data.createState = 0;
        const data = preview.data.toObject(false);
        preview._chain = false;
        // const endPoint = this._maybeSnappedEndPoint(data);
        this._maybeSnapLastPoint(data);
        await this.dungeon.addInvisibleWall(
          data.x,
          data.y,
          // data.x + endPoint[0],
          // data.y + endPoint[1]
          data.x + data.points[1][0],
          data.y + data.points[1][1]
        );
      } else if (minDistance || completePolygon) {
        event.data.createState = 0;
        const data = preview.data.toObject(false);
        preview._chain = false;
        // TODO: do we care about normalizing the shape? maybe for freehand curves/lines?
        const createData = this.constructor.placeableClass.normalizeShape(data);
        if (opcode === "addellipse") {
          const x = createData.x + createData.width / 2;
          const y = createData.y + createData.height / 2;
          await this.dungeon.addEllipse(
            x,
            y,
            createData.width,
            createData.height
          );
        } else if (opcode === "addfreehand") {
          this._autoClosePolygon(createData);
          const offsetPoints = createData.points.map((p) => [
            p[0] + createData.x,
            p[1] + createData.y,
          ]);
          await this.dungeon.addPolygon(offsetPoints);
        } else if (opcode === "addpolygon") {
          this._maybeSnapLastPoint(createData);
          this._autoClosePolygon(createData);
          const offsetPoints = createData.points.map((p) => [
            p[0] + createData.x,
            p[1] + createData.y,
          ]);
          await this.dungeon.addPolygon(offsetPoints);
        } else if (opcode === "addrectangle") {
          const rect = this._maybeSnappedRect(createData);
          await this.dungeon.addRectangle(rect);
        } else if (opcode === "addthemepainter") {
          this._maybeSnapLastPoint(createData);
          this._autoClosePolygon(createData);
          const offsetPoints = createData.points.map((p) => [
            p[0] + createData.x,
            p[1] + createData.y,
          ]);
          await this.dungeon.addThemeArea(offsetPoints);
        } else if (opcode === "removedoor") {
          const rect = this._maybeSnappedRect(createData);
          // TODO: need to spam out methods to various different flavor deletions
          await this.dungeon.removeDoors(rect);
        } else if (opcode === "removeellipse") {
          const x = createData.x + createData.width / 2;
          const y = createData.y + createData.height / 2;
          await this.dungeon.removeEllipse(
            x,
            y,
            createData.width,
            createData.height
          );
        } else if (opcode === "removefreehand") {
          this._autoClosePolygon(createData);
          const offsetPoints = createData.points.map((p) => [
            p[0] + createData.x,
            p[1] + createData.y,
          ]);
          await this.dungeon.removePolygon(offsetPoints);
        } else if (opcode === "removesecretdoor") {
          const rect = this._maybeSnappedRect(createData);
          // TODO: need to spam out methods to various different flavor deletions
          await this.dungeon.removeSecretDoors(rect);
        } else if (opcode === "removeinteriorwall") {
          const rect = this._maybeSnappedRect(createData);
          // TODO: need to spam out methods to various different flavor deletions
          await this.dungeon.removeInteriorWalls(rect);
        } else if (opcode === "removeinvisiblewall") {
          const rect = this._maybeSnappedRect(createData);
          // TODO: need to spam out methods to various different flavor deletions
          await this.dungeon.removeInvisibleWalls(rect);
        } else if (opcode === "removepolygon") {
          this._maybeSnapLastPoint(createData);
          this._autoClosePolygon(createData);
          const offsetPoints = createData.points.map((p) => [
            p[0] + createData.x,
            p[1] + createData.y,
          ]);
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
    if (createState === 1 && preview.isPolygon) {
      event.data.originalEvent.preventDefault();
      if (preview._chain) {
        return;
      }
      return this._onClickLeft(event);
    }

    // Incomplete drawing
    return this._onDragLeftCancel(event);
  }
}
