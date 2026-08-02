/**
 * Foundry v14 moved interactive shape creation out of the Drawing placeable and
 * into the new layer/placeable shape mixins, deleting the API that Dungeon Draw
 * builds its own drag-to-draw workflow on top of: `_fixedPoints`, `_addPoint`,
 * and `_onMouseDraw`. Our previews use this subclass so that behavior survives.
 *
 * The implementations are ports of Foundry v13's Drawing methods, with the
 * private #drawTime replaced by the `_drawTime` property the freehand sampler
 * in DungeonLayer already expects.
 */
export class PreviewDrawing extends foundry.canvas.placeables.Drawing {
  /**
   * The committed points of an in-progress polygon, relative to the drawing
   * origin. Temporary points (the one tracking the cursor) are not included.
   * @type {number[]}
   */
  _fixedPoints = [];

  /**
   * Timestamp of the last committed point, used to throttle freehand sampling.
   * @type {number}
   */
  _drawTime = 0;

  /**
   * Add a new polygon point to the drawing, ensuring it differs from the last one.
   * @param {Point} position                     The drawing point to add
   * @param {object} [options]                   Options which configure how the point is added
   * @param {boolean} [options.round=false]      Round the point to integer coordinates?
   * @param {boolean} [options.snap=false]       Snap the point to grid precision?
   * @param {boolean} [options.temporary=false]  Is this a temporary control point?
   */
  _addPoint(position, { round = false, snap = false, temporary = false } = {}) {
    if (snap) position = this.layer.getSnappedPoint(position);
    if (round) {
      position.x = Math.round(position.x);
      position.y = Math.round(position.y);
    }

    // Avoid adding duplicate points
    const last = this._fixedPoints.slice(-2);
    const next = [position.x - this.document.x, position.y - this.document.y];
    if (next.equals(last)) return;

    // Append the new point and update the shape
    const points = this._fixedPoints.concat(next);
    this.document.shape.updateSource({ points });
    if (!temporary) {
      this._fixedPoints = points;
      this._drawTime = Date.now();
    }
  }

  /**
   * Remove the last fixed point from the polygon.
   */
  _removePoint() {
    this._fixedPoints.splice(-2);
    this.document.shape.updateSource({ points: this._fixedPoints });
  }

  /**
   * Handle mouse movement which modifies the dimensions of the drawn shape.
   * @param {PIXI.FederatedEvent} event
   */
  _onMouseDraw(event) {
    const { destination, origin } = event.interactionData;
    const isShift = event.shiftKey;
    const isAlt = event.altKey;
    let position = destination;

    switch (this.type) {
      // Polygon shapes accumulate points
      case foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON: {
        const isFreehand = game.activeDungeonDrawTool === "freehand";
        let temporary = true;
        if (isFreehand) {
          temporary =
            Date.now() - this._drawTime < this.constructor.FREEHAND_SAMPLE_RATE;
        }
        const snap = !(isShift || isFreehand);
        this._addPoint(position, { snap, temporary });
        break;
      }

      // Other shapes are resized between origin and destination
      default: {
        if (!isShift) position = this.layer.getSnappedPoint(position);
        const shape = this.document.shape;
        const strokeWidth = this.document.strokeWidth;
        let dx = position.x - origin.x;
        let dy = position.y - origin.y;
        if (Math.abs(dx) <= strokeWidth) {
          dx = (strokeWidth + 1) * (Math.sign(shape.width) || 1);
        }
        if (Math.abs(dy) <= strokeWidth) {
          dy = (strokeWidth + 1) * (Math.sign(shape.height) || 1);
        }
        if (isAlt) {
          dx = Math.abs(dy) < Math.abs(dx) ? Math.abs(dy) * Math.sign(dx) : dx;
          dy = Math.abs(dx) < Math.abs(dy) ? Math.abs(dx) * Math.sign(dy) : dy;
        }
        const r = new PIXI.Rectangle(origin.x, origin.y, dx, dy).normalize();
        this.document.updateSource({
          x: r.x,
          y: r.y,
          shape: {
            width: r.width,
            height: r.height,
          },
        });
        break;
      }
    }

    this.renderFlags.set({ refreshPosition: true, refreshSize: true });
  }
}
