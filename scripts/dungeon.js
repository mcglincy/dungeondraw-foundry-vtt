/**
 * @extends {PlaceableObject}
 */
export class Dungeon extends PlaceableObject {
  constructor(...args) {
    super(...args);

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
  }

  _cleanData() {
    // TODO
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
    this.clear();
    this._cleanData();

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
    return this;
  }  

  /* -------------------------------------------- */

  /** @override */
  refresh() {
    //if ( this._destroyed || this.shape._destroyed ) return;
    if ( this._destroyed || this.shape._destroyed ) return;

    /*
    const isTextPreview = (this.data.type === CONST.DRAWING_TYPES.TEXT) && this._controlled;
    this.shape.clear();

    // Outer Stroke
    if ( this.data.strokeWidth || isTextPreview ) {
      let sc = foundry.utils.colorStringToHex(this.data.strokeColor || "#FFFFFF");
      const sw = isTextPreview ? 8 : this.data.strokeWidth ?? 8;
      this.shape.lineStyle(sw, sc, this.data.strokeAlpha ?? 1);
    }

    // Fill Color or Texture
    if ( this.data.fillType || isTextPreview ) {
      const fc = foundry.utils.colorStringToHex(this.data.fillColor || "#FFFFFF");
      if ( (this.data.fillType === CONST.DRAWING_FILL_TYPES.PATTERN) && this.texture ) {
        this.shape.beginTextureFill({
          texture: this.texture,
          color: fc || 0xFFFFFF,
          alpha: fc ? this.data.fillAlpha : 1
        });
      } else {
        const fa = isTextPreview ? 0.25 : this.data.fillAlpha;
        this.shape.beginFill(fc, fa);
      }
    }

    // Draw the shape
    switch ( this.data.type ) {
      case CONST.DRAWING_TYPES.RECTANGLE:
      case CONST.DRAWING_TYPES.TEXT:
        this._drawRectangle();
        break;
      case CONST.DRAWING_TYPES.ELLIPSE:
        this._drawEllipse();
        break;
      case CONST.DRAWING_TYPES.POLYGON:
        this._drawPolygon();
        break;
      case CONST.DRAWING_TYPES.FREEHAND:
        this._drawFreehand();
        break;
    }

    // Conclude fills
    this.shape.lineStyle(0x000000, 0.0).closePath();
    this.shape.endFill();

    // Set shape rotation, pivoting about the non-rotated center
    this.shape.pivot.set(this.data.width / 2, this.data.height / 2);
    this.shape.position.set(this.data.width / 2, this.data.height / 2);
    this.shape.rotation = Math.toRadians(this.data.rotation || 0);

    // Determine shape bounds and update the frame
    const bounds = this.drawing.getLocalBounds();
    if ( this.id && this._controlled ) this._refreshFrame(bounds);
    else this.frame.visible = false;

    // Toggle visibility
    this.position.set(this.data.x, this.data.y);
    this.drawing.hitArea = bounds;
    this.alpha = this.data.hidden ? 0.5 : 1.0;
    this.visible = !this.data.hidden || game.user.isGM;
    */
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
