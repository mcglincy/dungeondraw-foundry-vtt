import * as jsts from "./jsts.js";

/**
 * @extends {PlaceableObject}
 */
export class Dungeon extends PlaceableObject {
  constructor(...args) {
    super(...args);

    this.rectangles = [];
    this.polyPoints = null;
    this.geometry = null;

    /**
     * The inner drawing container
     * @type {PIXI.Container}
     */
    this.drawing = null;

    /**
     * The primary drawing shape
     * @type {PIXI.Graphics}
     */
    this.shape = null;

    /**
     * Text content, if included
     * @type {PIXI.Text}
     */
    this.text = null;

    /**
     * The Graphics outer frame and handles
     * @type {PIXI.Container}
     */
    this.frame = null;

    /**
     * Internal timestamp for the previous freehand draw time, to limit sampling
     * @type {number}
     * @private
     */
    this._drawTime = 0;
    this._sampleTime = 0;

    /**
     * Internal flag for the permanent points of the polygon
     * @type {boolean}
     * @private
     */
    this._fixedPoints = foundry.utils.deepClone(this.data.points || []);

    console.log(jsts);
    console.log(jsts.io);

  }

  /* -------------------------------------------- */

  // TODO: figure out what documentName / embeddedName / type we should be using
  /** @inheritdoc */
  // static embeddedName = "Dungeon";
  static embeddedName = "Drawing";

  /* -------------------------------------------- */

  /**
   * The rate at which points are sampled (in milliseconds) during a freehand drawing workflow
   * @type {number}
   */
  static FREEHAND_SAMPLE_RATE = 75;

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * A Boolean flag for whether or not the Drawing utilizes a tiled texture background
   * @type {boolean}
   */
  get isTiled() {
    return this.data.fillType === CONST.DRAWING_FILL_TYPES.PATTERN;
  }

  /* -------------------------------------------- */

  /**
   * A Boolean flag for whether or not the Drawing is a Polygon type (either linear or freehand)
   * @type {boolean}
   */
  get isPolygon() {
    return [CONST.DRAWING_TYPES.POLYGON, CONST.DRAWING_TYPES.FREEHAND].includes(this.data.type);
  }

  _cleanData() {
    // TODO
  }

  deleteAll() {
    this.rectangles = [];
    this.polyPoints = null;
    this.geometry = null;
    this.refresh();
  }

  /**
   * Create the components of the drawing element, the drawing container, the drawn shape, and the overlay text
   */
  _createDrawing() {
    // Drawing container
    this.drawing = this.addChild(new PIXI.Container());

    // Drawing Shape
    this.shape = this.drawing.addChild(new PIXI.Graphics());
  }

    /**
   * Create elements for the Drawing border and handles
   * @private
   */
  _createFrame() {
    this.frame = this.addChild(new PIXI.Container());
    this.frame.border = this.frame.addChild(new PIXI.Graphics());
    this.frame.handle = this.frame.addChild(new ResizeHandle([1,1]));
  }

  /* -------------------------------------------- */
  /* Rendering                                    */
  /* -------------------------------------------- */

  /** @override */
  async draw() {
    //this.clear();
    // this._cleanData();


    /*
    // Load the background texture, if one is defined
    // if ( this.data.texture ) {
    //   this.texture = await loadTexture(this.data.texture, {fallback: 'icons/svg/hazard.svg'});
    // } else {
    //   this.texture = null;
    // }

    // Create the inner Drawing container
    this._createDrawing();

    // Control Border
    this._createFrame();

    // Apply the z-index
    this.zIndex = this.data.z;

    // Render Appearance
    this.refresh();

    // Enable Interactivity, if this is a true Drawing
    if ( this.id ) this.activateListeners();
    */

    this.refresh();
    return this;
  }  

  /* -------------------------------------------- */

  rectToWKTPolygonString(rect) {
    const p = [
      rect.x, rect.y,
      rect.x + rect.width, rect.y,
      rect.x + rect.width, rect.y + rect.height,
      rect.x, rect.y + rect.height,
      // close off poly
      rect.x, rect.y,
    ];
    return `POLYGON((${p[0]} ${p[1]}, ${p[2]} ${p[3]}, ${p[4]} ${p[5]}, ${p[6]} ${p[7]}, ${p[8]} ${p[9]}))`;
  }

  addRectangle(rect) {
    const reader = new jsts.io.WKTReader(); 
    const polyString = this.rectToWKTPolygonString(rect);
    const poly = reader.read(polyString);

    if (this.geometry) {
      this.geometry = this.geometry.union(poly);
    } else {
      this.geometry = poly;
    }

    this.refresh();
  }

  _drawRect(gfx, rect) {
    gfx.beginFill(0xF2EDDF, 1.0);
    gfx.drawRect(rect.x, rect.y, rect.width, rect.height);
    gfx.endFill();
    gfx.lineStyle(10, 0x000000, 1.0).drawRect(rect.x, rect.y, rect.width, rect.height);
  }

  _drawPolygon(gfx, poly) {
    const nums = poly.getCoordinates().map(c => [c.x, c.y]).flat();
    gfx.beginFill(0xF2EDDF, 1.0);
    gfx.drawPolygon(nums);
    gfx.endFill();
    gfx.lineStyle(10, 0x000000, 1.0).drawPolygon(nums);
  }

  _drawMultiPolygon(gfx, multi) {
    for (let i = 0; i < multi.getNumGeometries(); i++) {
      const poly = multi.getGeometryN(i);
      console.log(poly);
      if (poly) {
        this._drawPolygon(gfx, poly);        
      }
    }
  }

  /** @override */
  refresh() {
    //if ( this._destroyed || this.shape._destroyed ) return;

    this.clear();

    const gfx = new PIXI.Graphics();
    if (this.geometry) {
      if (this.geometry instanceof jsts.geom.MultiPolygon) {
        this._drawMultiPolygon(gfx, this.geometry);
      } else if (this.geometry instanceof jsts.geom.Polygon) {
        this._drawPolygon(gfx, this.geometry);
      }
    }
    this.addChild(gfx);
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse movement which modifies the dimensions of the drawn shape
   * @param {PIXI.InteractionEvent} event
   * @private
   */
  _onMouseDraw(event) {
    const {destination, originalEvent} = event.data;
    const isShift = originalEvent.shiftKey;
    const isAlt = originalEvent.altKey;

    // Determine position
    let position = destination;
    if (!isShift) {
      position = canvas.grid.getSnappedPosition(position.x, position.y, this.layer.gridPrecision);
    } else {
      position = {x: Math.round(position.x), y: Math.round(position.y)};
    }

    // Drag differently depending on shape type
    switch ( this.data.type ) {
      // Polygon Shapes
      case CONST.DRAWING_TYPES.POLYGON:
        this._addPoint(position, true);
        break;

      // Geometric Shapes
      default:
        let dx = (position.x - this.data.x) || (canvas.dimensions.size * Math.sign(this.data.width) * 0.5);
        let dy = (position.y - this.data.y) || (canvas.dimensions.size * Math.sign(this.data.height) * 0.5);
        if ( isAlt ) {
          dx = Math.abs(dy) < Math.abs(dx) ? Math.abs(dy) * Math.sign(dx) : dx;
          dy = Math.abs(dx) < Math.abs(dy) ? Math.abs(dx) * Math.sign(dy) : dy;
        }
        this.data.update({width: dx, height: dy});
    }

    // Refresh the display
    this.refresh();
  }

  /**
   * Add a new polygon point to the drawing, ensuring it differs from the last one
   * @private
   */
  _addPoint(position, temporary=true) {
    const point = [position.x - this.data.x, position.y - this.data.y];
    const points = this._fixedPoints.concat([point]);
    this.data.update({points});
    if ( !temporary ) {
      this._fixedPoints = points
      this._drawTime = Date.now();
    }
  }

  /* -------------------------------------------- */

  /**
   * Remove the last fixed point from the polygon
   * @private
   */
  _removePoint() {
    if ( this._fixedPoints.length ) this._fixedPoints.pop();
    this.data.update({points: this._fixedPoints});
  }  
}
