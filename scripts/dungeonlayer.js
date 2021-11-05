import { Dungeon, DungeonState } from "./dungeon.js";
import { DungeonConfig } from "./dungeonconfig.js";
import { DungeonDocument } from "./dungeondocument.js";
import { DungeonDraw } from "./dungeondraw.js";

/**
 * 
 * @extends {PlaceablesLayer} 
 */
export class DungeonLayer extends PlaceablesLayer {

  static LAYER_NAME = "dungeon";

  /**
   * The named game setting which persists dungeon configuration for the User
   * @type {string}
   */
  static CONFIG_SETTING = "dungeonConfig";  

  constructor() {
    super();
    this.dungeonContainer = null;
    this.dungeon = null;
  }

  /** @inheritdoc */
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: DungeonLayer.LAYER_NAME,
      // canDragCreate: game.user.isGM,
      canDragCreate: true,
      zIndex: -1  // under tiles and background image
    });
  }

  // TODO: figure out what documentName / embeddedName / type we should be using
  // Error: Dungeon is not a valid embedded Document within the Scene Document
  //return canvas.scene?.getEmbeddedCollection(this.constructor.documentName) || null;
  /* in Document.mjs:
  getEmbeddedCollection(embeddedName) {
    const cls = this.constructor.metadata.embedded[embeddedName];
    if ( !cls ) {
      throw new Error(`${embeddedName} is not a valid embedded Document within the ${this.documentName} Document`);
    }
    return this[cls.collectionName];
  }  
  */
  /** @inheritdoc */
  //static documentName = "Dungeon";
  static documentName = "Drawing";

  /**
   * Get initial data for a new drawing.
   * Start with some global defaults, apply user default config, then apply mandatory overrides per tool.
   * @param {Object} origin     The initial coordinate
   * @return {Object}           The new drawing data
   */
  _getNewDrawingData(origin) {
    const tool = game.activeTool;
    const data = {
      fillColor: game.user.color,
      strokeColor: game.user.color,
      strokeWidth: 2,
    };
    // Mandatory additions
    data.x = origin.x;
    data.y = origin.y;
    data.author = game.user.id;
    // Tool-based settings
    switch ( tool ) {
      case "addrect":
      case "subtractdoor":
      case "subtractrect":
        data.type = CONST.DRAWING_TYPES.RECTANGLE;
        data.points = [];
        break;
      case "adddoor":
        data.type = CONST.DRAWING_TYPES.POLYGON;
        data.points = [[0, 0]];
        break;        
      case "ellipse":
        data.type = CONST.DRAWING_TYPES.ELLIPSE;
        data.points = [];
        break;
      case "addpoly":
        data.type = CONST.DRAWING_TYPES.POLYGON;
        data.points = [[0, 0]];
        break;
    }
    return data;
  }  

  /**
   * Render a configuration sheet to configure the Dungeon settings
   */
  configureSettings() {
    const defaults = {};
    const d = new DungeonDocument(defaults);
    new DungeonConfig(d, {}).render(true);
  }  

  /** @override */
  async deleteAll() {
    const type = this.constructor.documentName;
    if ( !game.user.isGM ) {
      throw new Error(`You do not have permission to delete ${type} objects from the Scene.`);
    }
    return Dialog.confirm({
      title: game.i18n.localize("CONTROLS.ClearAll"),
      content: `<p>${game.i18n.format("CONTROLS.ClearAllHint", {type})}</p>`,
      yes: () => this._deleteAll()
    });
  }

  // actually delete everything
  async _deleteAll() {
    this.dungeon?.deleteAll();
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async draw() {
    await super.draw();
    return this;
  }  

  async loadDungeon() {
    const data = {};
    // TODO: it seems like DungeonDocument isn't really needed here?    
    const document = new DungeonDocument(data, {parent: canvas.scene});
    this.dungeon = new Dungeon(document);
    await this.dungeon.loadFromScene();
    // add dungeon underneath any placeables or drawing preview
    this.addChildAt(this.dungeon, 0);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  async _onClickLeft(event) {
    const {preview, createState, originalEvent} = event.data;

    // Continue polygon point placement
    if ( createState >= 1 && preview.isPolygon ) {
      let point = event.data.destination;
      if ( !originalEvent.shiftKey ) point = canvas.grid.getSnappedPosition(point.x, point.y, this.gridPrecision);
      preview._addPoint(point, false);
      preview._chain = true; // Note that we are now in chain mode
      return preview.refresh();
    }

    await super._onClickLeft(event);
  }

  /** @override */
  _onClickLeft2(event) {
    const {createState, preview} = event.data;

    // Conclude polygon placement with double-click
    if ( createState >= 1 && preview.isPolygon ) {
      event.data.createState = 2;
      return this._onDragLeftDrop(event);
    }

    super._onClickLeft2(event);
  }

  /** @override */
  async _onDragLeftStart(event) {
    await super._onDragLeftStart(event);
    console.log(this.preview);

    // we use a Drawing as our preview, but then on end-drag/completion,
    // update our single Dungeon instance.
    const data = this._getNewDrawingData(event.data.origin);
    const document = new DrawingDocument(data, {parent: canvas.scene});
    const drawing = new Drawing(document);
    event.data.preview = this.preview.addChild(drawing);
    return drawing.draw();
  }

  /** @override */
  _onDragLeftMove(event) {
    const {preview, createState} = event.data;
    if (!preview) {
      return;
    }
    if (preview.parent === null) { 
      // In theory this should never happen, but rarely does
      this.preview.addChild(preview);
    }
    if (createState >= 1) {
      preview._onMouseDraw(event);
      if (preview.data.type !== CONST.DRAWING_TYPES.POLYGON || game.activeTool === "adddoor") {
        event.data.createState = 2;
      }
    }    
  }

  /** @override */
  async _onDragLeftDrop(event) {
    const { createState, destination, origin, preview } = event.data;

    // Successful drawing completion
    if (createState === 2) {
      const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y);
      const minDistance = distance >= (canvas.dimensions.size / 8);
      const completePolygon = preview.isPolygon && (preview.data.points.length > 2);

      if (game.activeTool === "adddoor") {
        event.data.createState = 0;
        const data = preview.data.toObject(false);
        preview._chain = false;
        await this.dungeon.addDoor(data.x, data.y,
          data.x + data.points[1][0], data.y + data.points[1][1]);
      } else if (minDistance || completePolygon) {

        event.data.createState = 0;
        const data = preview.data.toObject(false);
        preview._chain = false;
        const createData = this.constructor.placeableClass.normalizeShape(data);

        if (game.activeTool === "addrect") {
          const rect = {
            x: createData.x, 
            y: createData.y,
            height: createData.height,
            width: createData.width
          };
          await this.dungeon.addRectangle(rect);
        } else if (game.activeTool === "subtractrect") {
          const rect = {
            x: createData.x, 
            y: createData.y,
            height: createData.height,
            width: createData.width
          };
          await this.dungeon.subtractRectangle(rect);
        } else if (game.activeTool === "subtractdoor") {
          const rect = {
            x: createData.x, 
            y: createData.y,
            height: createData.height,
            width: createData.width
          };
          await this.dungeon.subtractDoors(rect);
        } else if (game.activeTool === "addpoly") {
          console.log(createData);
          const offsetPoints = createData.points.map(p => [p[0] + createData.x, p[1] + createData.y]);
          await this.dungeon.addPolygon(offsetPoints);
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
