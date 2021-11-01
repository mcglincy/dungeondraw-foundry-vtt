import { DungeonDraw } from "./dungeondraw.js";
import { DungeonLayer } from "./dungeonlayer.js";
// TODO: decide if we want to use turf.js instead
import * as jsts from "./jsts.js";

const geometryToWkt = (geometry) => {
  if (!geometry) {
    return null;
  }
  const precisionModel = new jsts.geom.PrecisionModel();
  const factory = new jsts.geom.GeometryFactory(precisionModel);
  const wktWriter = new jsts.io.WKTWriter(factory);
  return wktWriter.write(geometry);
};

const wktToGeometry = (wkt) => {
  if (!wkt) {
    return null;
  }
  const wktReader = new jsts.io.WKTReader(); 
  return wktReader.read(wkt);
};

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
      wkt: geometryToWkt(this.geometry),
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
    return new DungeonState(wktToGeometry(obj.wkt), obj.doors);
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
    this.history[this.historyIndex].saveToScene();
    this.refresh();
  }

  redo() {
    this.historyIndex = Math.min(this.history.length - 1, this.historyIndex + 1);
    this.history[this.historyIndex].saveToScene();
    this.refresh();
  }

  /* -------------------------------------------- */

  async loadFromScene() {
    const savedState = await DungeonState.loadFromScene();
    this.pushState(savedState);
  };

  pushState(newState) {
    // throw away any history states after current
    for (let i = this.history.length - 1; i > this.historyIndex; i--) {
      this.history.pop();
    }
    // and add our new state    
    this.history.push(newState);
    this.historyIndex++;

    // TODO: make this await?
    newState.saveToScene();
    this.refresh();
  }

  addDoor(x1, y1, x2, y2) {
    const newState = this.history[this.historyIndex].clone();
    newState.doors.push([x1, y1, x2, y2]);
    this.pushState(newState);
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

  /** @override */
  async refresh() {
    //if ( this._destroyed || this.shape._destroyed ) return;

    // stash latest-greatest config settings
    this.config = game.settings.get(DungeonDraw.MODULE_NAME, DungeonLayer.CONFIG_SETTING);        
    await this._refreshGraphics();
    // TODO can refresh be async, and we can await refreshing/deleting walls?
    await this._refreshWalls();
  }

  _refreshGraphics() {
    this.clear();
    const gfx = new PIXI.Graphics();
    const state = this.history[this.historyIndex];
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
    const coords = poly.getCoordinates();
    for (let i = 0; i < coords.length - 1; i++) {
      const wallData = {
        c: [coords[i].x, coords[i].y, coords[i+1].x, coords[i+1].y],
      };
      allWalls.push(wallData);
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
