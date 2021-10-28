import { Dungeon } from "./dungeon.js";
import { DungeonConfig } from "./dungeonconfig.js";
import { DungeonDocument } from "./dungeondocument.js";

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

  /** @inheritdoc */
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: DungeonLayer.LAYER_NAME,
      canDragCreate: true,
      controllableObjects: true,
      rotatableObjects: true,
      zIndex: 2
    });
  }

  /** @inheritdoc */
  static documentName = "Dungeon";

  /**
   * Get initial data for a new dungeon.
   * Start with some global defaults, apply user default config, then apply mandatory overrides per tool.
   * @param {Object} origin     The initial coordinate
   * @return {Object}           The new drawing data
   */
  _getNewDungeonData(origin) {
    const tool = game.activeTool;

    // Get saved user defaults
    const defaults = game.settings.get("dungeondraw", this.constructor.DEFAULT_CONFIG_SETTING) || {};
    const data = foundry.utils.mergeObject(defaults, {
      fillColor: game.user.color,
      strokeColor: game.user.color,
      fontFamily: CONFIG.defaultFontFamily
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
   * Obtain a reference to the Collection of embedded Document instances within the currently viewed Scene
   * @type {Collection|null}
   */
  get documentCollection() {
    // TODO
    // Error: Dungeon is not a valid embedded Document within the Scene Document
    //return canvas.scene?.getEmbeddedCollection(this.constructor.documentName) || null;
    return null;
  }

  /* in Document.mjs:
  getEmbeddedCollection(embeddedName) {
    const cls = this.constructor.metadata.embedded[embeddedName];
    if ( !cls ) {
      throw new Error(`${embeddedName} is not a valid embedded Document within the ${this.documentName} Document`);
    }
    return this[cls.collectionName];
  }  
  */

  /**
   * Render a configuration sheet to configure the default Drawing settings
   */
  configureDefault() {
    const defaults = this._getNewDungeonData({});
    const d = new DungeonDocument(defaults);
    new DungeonConfig(d, {configureDefault: true}).render(true);
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
    const data = this._getNewDungeonData(event.data.origin);
    const document = new DungeonDocument(data, {parent: canvas.scene});
    const dungeon = new Dungeon(document);
    event.data.preview = this.preview.addChild(dungeon);
    return dungeon.draw();
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
      if ( preview.data.type !== CONST.DRAWING_TYPES.POLYGON ) event.data.createState = 2;
    }    
  }

  /** @override */
  _onDragLeftDrop(event) {
    super._onDragLeftDrop(event);
  }
}
