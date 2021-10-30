import { Dungeon } from "./dungeon.js";
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
   * The named game setting which persists default drawing configuration for the User
   * @type {string}
   */
  static DEFAULT_CONFIG_SETTING = "defaultDungeonConfig";  

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
      zIndex: 2
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
   * Get initial data for a new dungeon.
   * Start with some global defaults, apply user default config, then apply mandatory overrides per tool.
   * @param {Object} origin     The initial coordinate
   * @return {Object}           The new drawing data
   */
  _getNewDungeonData(origin) {
    const tool = game.activeTool;

    // Get saved user defaults
    const defaults = game.settings.get(DungeonDraw.MODULE_NAME, this.constructor.DEFAULT_CONFIG_SETTING) || {};
    const data = foundry.utils.mergeObject(defaults, {
      fillColor: game.user.color,
      strokeColor: game.user.color,
    }, {overwrite: false, inplace: false});

    // Mandatory additions
    data.x = origin.x;
    data.y = origin.y;
    data.author = game.user.id;

    // Tool-based settings
    switch ( tool ) {
      case "rect":
        // TODO: use our own type
        data.type = CONST.DRAWING_TYPES.RECTANGLE;
        data.points = [];
        break;
    }
    return data;
  }

  /**
   * Get initial data for a new drawing.
   * Start with some global defaults, apply user default config, then apply mandatory overrides per tool.
   * @param {Object} origin     The initial coordinate
   * @return {Object}           The new drawing data
   */
  _getNewDrawingData(origin) {
    const tool = game.activeTool;

    // Get saved user defaults
    // const defaults = game.settings.get("core", DrawingsLayer.DEFAULT_CONFIG_SETTING) || {};
    // const data = foundry.utils.mergeObject(defaults, {
    //   fillColor: game.user.color,
    //   strokeColor: game.user.color,
    //   fontFamily: CONFIG.defaultFontFamily
    // }, {overwrite: false, inplace: false});

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
      case "rect":
        data.type = CONST.DRAWING_TYPES.RECTANGLE;
        data.points = [];
        break;
      case "ellipse":
        data.type = CONST.DRAWING_TYPES.ELLIPSE;
        data.points = [];
        break;
      case "polygon":
        data.type = CONST.DRAWING_TYPES.POLYGON;
        data.points = [[0, 0]];
        break;
    }
    return data;
  }  

  /**
   * Render a configuration sheet to configure the default Drawing settings
   */
  configureDefault() {
    const defaults = this._getNewDungeonData({});
    const d = new DungeonDocument(defaults);
    new DungeonConfig(d, {configureDefault: true}).render(true);
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

    // TODO: push all this drawing foo into Dungeon class?

    const data = this._getNewDrawingData({x: 0, y: 0});
    const document = new DungeonDocument(data, {parent: canvas.scene});
    this.dungeon = new Dungeon(document);
    // TODO: where should draw be done?
    this.dungeon.draw();
    this.addChild(this.dungeon);

    // const sd = canvas.scene.data;

    // Draw the outline
    // const outline = new PIXI.Graphics();
    // outline.lineStyle(20, 0xFF0000, 1.0).drawShape(canvas.dimensions.rect);
    // this.addChildAt(outline, 0);

    return this;
  }  

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  async _onClickLeft(event) {
    await super._onClickLeft(event);
  }

  /** @override */
  _onClickLeft2(event) {
    super._onClickLeft2(event);
  }

  /** @override */
  async _onDragLeftStart(event) {
    await super._onDragLeftStart(event);

    // creating a new dungeon data / drawing data....
    // but we need to differentiate between the preview thingy
    // and the master dungeon/doc/structure...
    // const data = this._getNewDungeonData(event.data.origin);
    // const document = new DungeonDocument(data, {parent: canvas.scene});
    // const dungeon = new Dungeon(document);
    // event.data.preview = this.preview.addChild(dungeon);
    // return dungeon.draw();

    // idea: use a Drawing as our preview, but then on end-drag/completion,
    // update our master dungeon structure thingy
    const data = this._getNewDrawingData(event.data.origin);
    const document = new DrawingDocument(data, {parent: canvas.scene});
    const drawing = new Drawing(document);
    event.data.preview = this.preview.addChild(drawing);
    return drawing.draw();
  }

  /** @override */
  _onDragLeftCancel(event) {
    super._onDragLeftCancel(event);
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
      if (preview.data.type !== CONST.DRAWING_TYPES.POLYGON) {
        event.data.createState = 2;
      }
    }    
  }

  /** @override */
  async _onDragLeftDrop(event) {
    const { createState, destination, origin, preview } = event.data;

    // Successful drawing completion
    if ( createState === 2 ) {
      const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y);
      const minDistance = distance >= (canvas.dimensions.size / 8);
      const completePolygon = preview.isPolygon && (preview.data.points.length > 2);

      // Create a completed drawing
      if (minDistance || completePolygon) {
        event.data.createState = 0;
        const data = preview.data.toObject(false);
        // preview - Foundry Drawing,
        // preview.data - Foundry DrawingData
        // preview.drawing - PIXI.Container
        // preview.shape - PIXI.Graphics, child of preview.drawing

        // Create the object
        preview._chain = false;
        const createData = this.constructor.placeableClass.normalizeShape(data);

        // const bgData = foundry.utils.mergeObject(createData, {
        //   fillColor: "#EFE9DA",
        //   fillType: 1,
        //   strokeColor: "#000000",
        //   strokeWidth: 8,
        // }, {overwrite: true, inplace: false});
        // console.log("****** about to create()");
        // console.log(self.objects);
        // const cls = getDocumentClass("Drawing");  // DrawingDocument
        // const bgDrawing = await cls.create(bgData, {parent: canvas.scene});
        // const o = bgDrawing.object;
        // o._creating = true;
        // o._pendingText = "";
        // o.control({isNew: true});

        // type = "r"
        const newRect = {
          // (x,y) is upper left corner
          x: createData.x, 
          y: createData.y,
          height: createData.height,
          width: createData.width
        };
        this.dungeon.addRectangle(newRect);

        // XXXX
        // const drawing = await cls.create(createData, {parent: canvas.scene});
        // const o = drawing.object;
        // o._creating = true;
        // o._pendingText = "";
        // o.control({isNew: true});
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
