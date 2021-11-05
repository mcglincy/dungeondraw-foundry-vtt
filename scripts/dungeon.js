import { DungeonDraw } from "./dungeondraw.js";
import { DungeonLayer } from "./dungeonlayer.js";
import * as geo from "./geo-utils.js";
// TODO: decide if we want to use turf.js instead
import "./lib/jsts.min.js";
import "./lib/pixi-filters.min.js";

export class DungeonState {
  static FLAG_KEY = "dungeonState";

  constructor(geometry, doors) {
    this.geometry = geometry;
    this.doors = doors;
  }

  clone() {
    return new DungeonState(
      this.geometry ? this.geometry.copy() : null,
      JSON.parse(JSON.stringify(this.doors))
      );
  }

  toString() {
    return JSON.stringify({
      // serialize the geometry object as a WKT string
      wkt: geo.geometryToWkt(this.geometry),
      doors: this.doors,
    });
  }

  async saveToScene() {
    const serialized = this.toString();
    await canvas.scene.setFlag(DungeonDraw.MODULE_NAME, DungeonState.FLAG_KEY, serialized);
  }

  static async loadFromScene() {
    const flagVal = canvas.scene.getFlag(DungeonDraw.MODULE_NAME, DungeonState.FLAG_KEY);
    if (flagVal) {
      return DungeonState.fromString(flagVal);
    } else {
      return DungeonState.startState();
    }
  }

  static startState() {
    return new DungeonState(null, []);
  }

  static fromString(s) {
    if (!s) {
      return DungeonState.startState();
    }
    const obj = JSON.parse(s);
    return new DungeonState(geo.wktToGeometry(obj.wkt), obj.doors);
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
  }

  /* -------------------------------------------- */

  // TODO: figure out what documentName / embeddedName / type we should be using
  /** @inheritdoc */
  // static embeddedName = "Dungeon";
  static embeddedName = "Drawing";

  /* -------------------------------------------- */

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /* -------------------------------------------- */

  deleteAll() {
    this.history = [DungeonState.startState()];
    this.historyIndex = 0;
    this.history[this.historyIndex].saveToScene();
    this.refresh();
  }

  /* -------------------------------------------- */
  /* Rendering                                    */
  /* -------------------------------------------- */

  /** @override */
  async draw() {
    await this.refresh();
    return this;
  }  

  /* -------------------------------------------- */

  async undo() {
    this.historyIndex = Math.max(0, this.historyIndex - 1);
    this.history[this.historyIndex].saveToScene();
    await this.refresh();
  }

  async redo() {
    this.historyIndex = Math.min(this.history.length - 1, this.historyIndex + 1);
    this.history[this.historyIndex].saveToScene();
    await this.refresh();
  }

  /* -------------------------------------------- */

  async loadFromScene() {
    const savedState = await DungeonState.loadFromScene();
    await this.pushState(savedState);
  };

  async pushState(newState) {
    // throw away any history states after current
    for (let i = this.history.length - 1; i > this.historyIndex; i--) {
      this.history.pop();
    }
    // and add our new state    
    this.history.push(newState);
    this.historyIndex++;

    // TODO: make this await?
    await newState.saveToScene();
    await this.refresh();
  }

  async addDoor(x1, y1, x2, y2) {
    const newState = this.history[this.historyIndex].clone();
    newState.doors.push([x1, y1, x2, y2]);
    await this.pushState(newState);
  }

  async subtractDoors(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const doorsToKeep = this.history[this.historyIndex].doors.filter(d => {
      const doorPoly = geo.twoPointsToLineString(d[0], d[1], d[2], d[3]);
      return !rectPoly.intersects(doorPoly);
    });
    if (doorsToKeep.length != this.history[this.historyIndex].doors.length) {
      const newState = this.history[this.historyIndex].clone();
      newState.doors = doorsToKeep;
      await this.pushState(newState);      
    }
  }

  // {x, y, height, width}
  async addRectangle(rect) {
    const poly = geo.rectToPolygon(rect);
    const newState = this.history[this.historyIndex].clone();    
    if (newState.geometry) {
      newState.geometry = newState.geometry.union(poly);
    } else {
      newState.geometry = poly;
    }
    await this.pushState(newState);
  }

  // {x, y, height, width}
  async subtractRectangle(rect) {
    // only makes sense to subtract if we have geometry
    if (!this.history[this.historyIndex].geometry) {
      return;
    }
    const poly = geo.rectToPolygon(rect);
    // and if the poly intersects existing geometry
    if (!this.history[this.historyIndex].geometry.intersects(poly)) {
      return;
    }
    const newState = this.history[this.historyIndex].clone();    
    newState.geometry = newState.geometry.difference(poly);
    await this.pushState(newState);
  };

  _rectangleForSegment(x1, y1, x2, y2) {
    const slope = geo.slope(x1, y1, x2, y2);
    const rectDelta = this.config.doorThickness / 2.0;

    // slope is delta y / delta x
    if (slope === 0) {
      // door is horizontal
      return [
        x1,
        y1 + rectDelta,
        x2,
        y1 + rectDelta,
        x2,
        y1 - rectDelta,
        x1,
        y1 - rectDelta,
      ];
    }
    if (slope === Infinity) {
      // door is vertical
      return [
        x1 - rectDelta,
        y1,
        x1 - rectDelta,
        y2,
        x2 + rectDelta,
        y2,
        x2 + rectDelta,
        y1,        
      ];
    };

    const inverseSlope = geo.inverseSlope(slope);

    // TODO: do the math
    return [
      0, 0, 0, 0
    ];
  }

  // TODO: this is wrong for first drawn rectangle
  // maybe simple poly has different vertex ordering?
  // or we should adjust our POLY string vertex order
  _needsShadow(x1, y1, x2, y2) {
    if (x1 === x2 && y2 > y1) {
      // south to north vertical
      return true;
    }
    if (y1 === y2 && x1 > x2) {
      // east to west horizontal
      return true;
    }
    return false;
  }

  // _inflateGeometry(geometry, distance) {
  //   return geometry.buffer(spacing, jsts.operation.buffer.BufferParameters.CAP_FLAT);
  // }

  _drawPolygonRoom(gfx, poly) {
    const exterior = poly.getExteriorRing();
    const coords = exterior.getCoordinates();
    const flatCoords = coords.map(c => [c.x, c.y]).flat();

    // draw outside shadow
    // const expanded = exterior.buffer(25.0);
    // gfx.lineStyle(0, PIXI.utils.string2hex(this.config.wallColor), 1.0);
    // gfx.beginFill(0x000000, 0.2);
    // gfx.drawPolygon(expanded.getCoordinates().map(c => [c.x, c.y]).flat());
    // gfx.endFill();

    // draw floor
    gfx.beginFill(PIXI.utils.string2hex(this.config.floorColor), 1.0);
    gfx.drawPolygon(flatCoords);
    gfx.endFill();

    // cut out holes
    const numHoles = poly.getNumInteriorRing();    
    for (let i = 0; i < numHoles; i++) {
      const hole = poly.getInteriorRingN(i);
      const coords = hole.getCoordinates();
      const flatCoords = coords.map(c => [c.x, c.y]).flat();
      gfx.lineStyle(0, 0x000000, 1.0, 1, 0.5);
      gfx.beginHole();
      gfx.drawPolygon(flatCoords);
      gfx.endHole();
    }

    // draw inner wall drop shadows
    gfx.lineStyle(this.config.wallThickness / 2.0 + 8.0, 0x000000, 0.2, 1);
    for (let i = 0; i < coords.length - 1; i++) {
      gfx.moveTo(coords[i].x, coords[i].y);
      if (this._needsShadow(coords[i].x, coords[i].y, coords[i+1].x, coords[i+1].y)) {
        gfx.lineTo(coords[i+1].x, coords[i+1].y);
      } 
    }

    // draw outer wall poly
    gfx.lineStyle(this.config.wallThickness, PIXI.utils.string2hex(this.config.wallColor), 1.0, 0.5);
    gfx.drawPolygon(flatCoords);

    // draw interior hole walls/shadows
    //const numHoles = poly.getNumInteriorRing();    
    for (let i = 0; i < numHoles; i++) {

      const hole = poly.getInteriorRingN(i);
      const coords = hole.getCoordinates();
      const flatCoords = coords.map(c => [c.x, c.y]).flat();

      // draw hole inside shadow
      // TODO: hole.buffer() with negative number results in no-coord poly, 
      // so just draw a line with inner alignment
      // gfx.lineStyle(25, 0x000000, 0.2, 0);
      // gfx.drawPolygon(flatCoords);

      // draw hole wall outer drop shadows
      gfx.lineStyle(this.config.wallThickness / 2.0 + 8.0, 0x000000, 0.2, 1);
      for (let i = 0; i < coords.length - 1; i++) {
        gfx.moveTo(coords[i].x, coords[i].y);
        if (this._needsShadow(coords[i].x, coords[i].y, coords[i+1].x, coords[i+1].y)) {
          gfx.lineTo(coords[i+1].x, coords[i+1].y);
        } 
      }      
      // draw hole wall poly
      gfx.lineStyle(this.config.wallThickness, PIXI.utils.string2hex(this.config.wallColor), 1.0);
      gfx.drawPolygon(flatCoords);
    }
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
    const jambLength = 20;
    const rectLength = totalLength - (2 * jambLength);
    const jambFraction = jambLength / totalLength;
    const rectFraction = rectLength / totalLength;
    const rectEndFraction = jambFraction + rectFraction;
    const deltaX = door[2] - door[0];
    const deltaY = door[3] - door[1];
    const jamb1End = [door[0] + (deltaX * jambFraction), door[1] + (deltaY * jambFraction)];
    const rectEnd = [door[0] + (deltaX * rectEndFraction), door[1] + (deltaY * rectEndFraction)]

    const doorRect = this._rectangleForSegment(jamb1End[0], jamb1End[1], rectEnd[0], rectEnd[1]);
    gfx.lineStyle(this.config.wallThickness, PIXI.utils.string2hex(this.config.wallColor), 1.0, 0.5);    
    gfx.moveTo(door[0], door[1]);
    gfx.lineTo(jamb1End[0], jamb1End[1]);
    gfx.moveTo(rectEnd[0], rectEnd[1]);
    gfx.lineTo(door[2], door[3]);
    gfx.drawPolygon(
      doorRect[0], doorRect[1], doorRect[2], doorRect[3],
      doorRect[4], doorRect[5], doorRect[6], doorRect[7],
      doorRect[0], doorRect[1]
      );
  }

  /** @override */
  async refresh() {
    //if ( this._destroyed || this.shape._destroyed ) return;

    // stash latest-greatest config settings
    this.config = game.settings.get(DungeonDraw.MODULE_NAME, DungeonLayer.CONFIG_SETTING);        
    await this._refreshGraphics();
    // TODO can refresh be async, and we can await refreshing/deleting walls?
    await this._refreshWalls();
  }

  _addOuterShadow() {
    const outerShadow = new PIXI.Graphics();
    const expanded = this.history[this.historyIndex].geometry.buffer(20.0);
    outerShadow.beginFill(0x000000, 0.5);
    outerShadow.drawPolygon(expanded.getCoordinates().map(c => [c.x, c.y]).flat());
    outerShadow.endFill();
    const blurFilter = new PIXI.filters.BlurFilter();
    outerShadow.filters = [blurFilter];
    this.addChild(outerShadow);
  }

  _refreshGraphics() {
    this.clear();
    const gfx = new PIXI.Graphics();
    const state = this.history[this.historyIndex];
    if (state.geometry) {
      // draw an outer surrounding blurred shadow
      this._addOuterShadow();
      // draw the dungeon geometry room(s)
      if (state.geometry instanceof jsts.geom.MultiPolygon) {
        this._drawMultiPolygonRoom(gfx, state.geometry);
      } else if (state.geometry instanceof jsts.geom.Polygon) {
        this._drawPolygonRoom(gfx, state.geometry);
      }
    }
    // draw doors
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

  async _deleteAllWalls() {
    const ids = canvas.scene.walls.map(w => w.id);
    try {
      await canvas.scene.deleteEmbeddedDocuments("Wall", ids);
    } catch(error) {
      console.error(error);
    }
  }

  async _makeWallsFromMulti(multi) {
    for (let i = 0; i < multi.getNumGeometries(); i++) {
      const poly = multi.getGeometryN(i);
      if (poly) {
        await this._makeWallsFromPoly(poly);
      }
    }
  }

  async _makeWallsFromPoly(poly) {
    const allWalls = [];
    const exterior = poly.getExteriorRing();
    const coords = exterior.getCoordinates();
    for (let i = 0; i < coords.length - 1; i++) {
      const wallData = {
        c: [coords[i].x, coords[i].y, coords[i+1].x, coords[i+1].y],
      };
      allWalls.push(wallData);
    }
    const numHoles = poly.getNumInteriorRing();    
    for (let i = 0; i < numHoles; i++) {
      const hole = poly.getInteriorRingN(i);
      const coords = hole.getCoordinates();
      for (let i = 0; i < coords.length - 1; i++) {
        const wallData = {
          c: [coords[i].x, coords[i].y, coords[i+1].x, coords[i+1].y],
        };
        allWalls.push(wallData);
      }      
    }
    if (allWalls.length) {      
      await canvas.scene.createEmbeddedDocuments("Wall", allWalls);
    }
  }

  /** [[x1,y1,x2,y2],...] */
  async _makeDoors(doors) {
    const allDoors = [];
    for (const door of doors) {
      const doorData = {
        c: [door[0], door[1], door[2], door[3]],
        door: 1
      };
      allDoors.push(doorData);
    }
    if (allDoors.length) {
      await canvas.scene.createEmbeddedDocuments("Wall", allDoors);
    }
  }  
}
