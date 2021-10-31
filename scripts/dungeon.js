import { DungeonDraw } from "./dungeondraw.js";
import { DungeonLayer } from "./dungeonlayer.js";
// TODO: decide if we want to use turf.js instead
import * as jsts from "./jsts.js";

class DungeonState {
  constructor(geometry, doors) {
    this.geometry = geometry;
    this.doors = doors;
  }

  clone() {
    const geoClone = this.geometry ? this.geometry.copy() : null;
    return new DungeonState(
      geoClone,
      JSON.parse(JSON.stringify(this.doors))
      );
  }

  static startState() {
    return new DungeonState(null, []);
  }
}

/**
 * @extends {PlaceableObject}
 */
export class Dungeon extends PlaceableObject {
  constructor(...args) {
    super(...args);

    /** local copy of Dungeon config from settings */
    this.config = null;

    /** time-ordered array of DungeonStates */
    this.history = [DungeonState.startState()];
    this.historyIndex = 0;

    /**
     * Internal timestamp for the previous freehand draw time, to limit sampling
     * @type {number}
     * @private
     */
    // this._drawTime = 0;
    // this._sampleTime = 0;

    /**
     * Internal flag for the permanent points of the polygon
     * @type {boolean}
     * @private
     */
    // this._fixedPoints = foundry.utils.deepClone(this.data.points || []);
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
  //static FREEHAND_SAMPLE_RATE = 75;

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * A Boolean flag for whether or not the Drawing utilizes a tiled texture background
   * @type {boolean}
   */
  // get isTiled() {
  //   return this.data.fillType === CONST.DRAWING_FILL_TYPES.PATTERN;
  // }

  /* -------------------------------------------- */

  deleteAll() {
    this.history = [DungeonState.startState()];
    this.historyIndex = 0;
    this.refresh();
  }

  /* -------------------------------------------- */
  /* Rendering                                    */
  /* -------------------------------------------- */

  /** @override */
  async draw() {
    this.refresh();
    return this;
  }  

  /* -------------------------------------------- */

  undo() {
    this.historyIndex = Math.max(0, this.historyIndex - 1);
    this.refresh();
  }

  redo() {
    this.historyIndex = Math.min(this.history.length - 1, this.historyIndex + 1);
    this.refresh();
  }

  /* -------------------------------------------- */

  pushState(newState) {
    // throw away any history states after current
    for (let i = this.history.length - 1; i > this.historyIndex; i--) {
      this.history.pop();
    }
    // and add our new state    
    this.history.push(newState);
    this.historyIndex++;
  }

  addDoor(x1, y1, x2, y2) {
    const newState = this.history[this.historyIndex].clone();
    newState.doors.push([x1, y1, x2, y2]);
    this.pushState(newState);
    this.refresh();
  }

  addRectangle(rect) {
    const reader = new jsts.io.WKTReader(); 
    const polyString = this._rectToWKTPolygonString(rect);
    const poly = reader.read(polyString);

    const newState = this.history[this.historyIndex].clone();    
    if (newState.geometry) {
      newState.geometry = newState.geometry.union(poly);
    } else {
      newState.geometry = poly;
    }
    this.pushState(newState);
    this.refresh();
  }

  _rectToWKTPolygonString(rect) {
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

  _drawPolygonRoom(gfx, poly) {
    const nums = poly.getCoordinates().map(c => [c.x, c.y]).flat();
    gfx.beginFill(PIXI.utils.string2hex(this.config.floorColor), 1.0);
    gfx.drawPolygon(nums);
    gfx.endFill();
    gfx.lineStyle(this.config.wallThickness, PIXI.utils.string2hex(this.config.wallColor), 1.0);
    gfx.drawPolygon(nums);
  }

  _drawMultiPolygonRoom(gfx, multi) {
    for (let i = 0; i < multi.getNumGeometries(); i++) {
      const poly = multi.getGeometryN(i);
      if (poly) {
        this._drawPolygonRoom(gfx, poly);        
      }
    }
  }

  _distanceBetweenPoints(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  _drawDoor(gfx, door) {
    const totalLength = this._distanceBetweenPoints(door[0], door[1], door[2], door[3]);
    const jambLength = 10;
    const rectLength = totalLength - (2 * jambLength);
    const jambFraction = jambLength / totalLength;
    const rectFraction = rectLength / totalLength;
    const rectEndFraction = jambFraction + rectFraction;
    const deltaX = door[2] - door[0];
    const deltaY = door[3] - door[1];
    const jamb1End = [door[0] + (deltaX * jambFraction), door[1] + (deltaY * jambFraction)];
    const rectEnd = [door[0] + (deltaX * rectEndFraction), door[1] + (deltaY * rectEndFraction)]

    // jamb1, rectangle, jamb2
    gfx.lineStyle(this.config.doorThickness, PIXI.utils.string2hex(this.config.doorColor), 1.0);
    gfx.moveTo(door[0], door[1]);
    gfx.lineTo(jamb1End[0], jamb1End[1]);
    // cheating with just a thicker line; TODO: make an actual rect with some additional trig
    gfx.lineStyle(this.config.doorThickness * 4, PIXI.utils.string2hex(this.config.doorColor), 1.0);
    gfx.lineTo(rectEnd[0], rectEnd[1]);
    gfx.lineStyle(this.config.doorThickness, PIXI.utils.string2hex(this.config.doorColor), 1.0);
    gfx.lineTo(door[2], door[3]);
  }

  async _deleteAllWalls() {
    // this includes doors, which are just walls with a door value set
    for (const wall of canvas.scene.data.walls) {
      await wall.delete();
    }
  }

  _makeWallsFromMulti(multi) {
    for (let i = 0; i < multi.getNumGeometries(); i++) {
      const poly = multi.getGeometryN(i);
      if (poly) {
        this._makeWallsFromPoly(poly);
      }
    }
  }

  async _makeWallsFromPoly(poly) {
    const coords = poly.getCoordinates();
    for (let i = 0; i < coords.length - 1; i++) {
      const wallData = {
        c: [coords[i].x, coords[i].y, coords[i+1].x, coords[i+1].y],
      };
      const wallDoc = await WallDocument.create(wallData, {parent: canvas.scene});
    }
  }

  /** [[x1,y1,x2,y2],...] */
  async _makeDoors(doors) {
    for (const door of doors) {
      const doorData = {
        c: [door[0], door[1], door[2], door[3]],
        door: 1
      };
      const wallDoc = await WallDocument.create(doorData, {parent: canvas.scene});
    }
  }

  /** @override */
  refresh() {
    //if ( this._destroyed || this.shape._destroyed ) return;

    // stash latest-greatest config settings
    this.config = game.settings.get(DungeonDraw.MODULE_NAME, DungeonLayer.CONFIG_SETTING);        
    this._refreshGraphics();
    this._refreshWalls();
  }

  _refreshGraphics() {
    this.clear();

    const state = this.history[this.historyIndex];

    const gfx = new PIXI.Graphics();
    if (state.geometry) {
      if (state.geometry instanceof jsts.geom.MultiPolygon) {
        this._drawMultiPolygonRoom(gfx, state.geometry);
      } else if (state.geometry instanceof jsts.geom.Polygon) {
        this._drawPolygonRoom(gfx, state.geometry);
      }
    }
    for (let door of state.doors) {
      this._drawDoor(gfx, door);
    }
    this.addChild(gfx);
  }

  async _refreshWalls() {
    await this._deleteAllWalls();

    const state = this.history[this.historyIndex];

    if (state.geometry) {
      if (state.geometry instanceof jsts.geom.MultiPolygon) {
        await this._makeWallsFromMulti(state.geometry);
      } else if (state.geometry instanceof jsts.geom.Polygon) {
        await this._makeWallsFromPoly(state.geometry);
      }
    }

    await this._makeDoors(state.doors);
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse movement which modifies the dimensions of the drawn shape
   * @param {PIXI.InteractionEvent} event
   * @private
   */
   /*
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
  */

  /**
   * Add a new polygon point to the drawing, ensuring it differs from the last one
   * @private
   */
  // _addPoint(position, temporary=true) {
  //   const point = [position.x - this.data.x, position.y - this.data.y];
  //   const points = this._fixedPoints.concat([point]);
  //   this.data.update({points});
  //   if ( !temporary ) {
  //     this._fixedPoints = points
  //     this._drawTime = Date.now();
  //   }
  // }

  /* -------------------------------------------- */

  /**
   * Remove the last fixed point from the polygon
   * @private
   */
  // _removePoint() {
  //   if ( this._fixedPoints.length ) this._fixedPoints.pop();
  //   this.data.update({points: this._fixedPoints});
  // }  
}
