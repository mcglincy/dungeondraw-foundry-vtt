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

  /* -------------------------------------------- */  

  toString() {
    return JSON.stringify({
      // serialize the geometry object as a WKT string
      wkt: geo.geometryToWkt(this.geometry),
      doors: this.doors,
    });
  }

  static fromString(s) {
    if (!s) {
      return DungeonState.startState();
    }
    const obj = JSON.parse(s);
    return new DungeonState(geo.wktToGeometry(obj.wkt), obj.doors);
  }

  async saveToJournalEntry(journalEntry) {
    const serialized = this.toString();
    await journalEntry.update({
      content: serialized,
    });
  }

  static async loadFromJournalEntry(journalEntry) {
    if (journalEntry.data.content) {
      return DungeonState.fromString(journalEntry.data.content);
    } else {
      return DungeonState.startState();
    }
  }

  static startState() {
    return new DungeonState(null, []);
  }
}

/**
 * @extends {PlaceableObject}
 */
// TODO: does Dungeon even need to be a PlaceableObject?
// or could it just extend PIXI.Container?
export class Dungeon extends PlaceableObject {
  // expects JournalEntry for constructor
  constructor(journalEntry, note) {
    // note will be saved as this.document
    super(note);

    this.journalEntry = journalEntry;

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

  deleteAll() {
    this.history = [DungeonState.startState()];
    this.historyIndex = 0;
    this.history[this.historyIndex].saveToJournalEntry(this.journalEntry);
    this.refresh();
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */
  /* Rendering                                    */
  /* -------------------------------------------- */

  /** @override */
  async draw() {
    await this.refresh();
    return this;
  }  

  async maybeRefresh(journalEntry) {
    if (journalEntry.id === this.journalEntry.id) {
      const savedState = await DungeonState.loadFromJournalEntry(this.journalEntry);
      this.pushState(savedState);
      this.refresh();
    }
  }

  /* -------------------------------------------- */

  async undo() {
    this.historyIndex = Math.max(0, this.historyIndex - 1);
    await this.history[this.historyIndex].saveToJournalEntry(this.journalEntry);
    await this.refresh();
  }

  async redo() {
    this.historyIndex = Math.min(this.history.length - 1, this.historyIndex + 1);
    await this.history[this.historyIndex].saveToJournalEntry(this.journalEntry);
    await this.refresh();
  }

  /* -------------------------------------------- */

  async loadFromJournalEntry() {
    const savedState = await DungeonState.loadFromJournalEntry(this.journalEntry);
    this.history = [savedState];
    this.historyIndex = 0;
    await this.refresh();
  };

  async pushState(newState) {
    // throw away any history states after current
    for (let i = this.history.length - 1; i > this.historyIndex; i--) {
      this.history.pop();
    }
    // and add our new state    
    this.history.push(newState);
    this.historyIndex++;

    await newState.saveToJournalEntry(this.journalEntry);
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

  async _addPoly(poly) {
    const newState = this.history[this.historyIndex].clone();    
    if (newState.geometry) {
      newState.geometry = newState.geometry.union(poly);
    } else {
      newState.geometry = poly;
    }
    await this.pushState(newState);    
  }

  // {x, y, height, width}
  async addRectangle(rect) {
    const poly = geo.rectToPolygon(rect);
    this._addPoly(poly);
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

  // [[x,y]...]
  async addPolygon(points) {
    try {
      const poly = geo.pointsToPolygon(points);
      await this._addPoly(poly);
    } catch (error) {
      console.log(error);
    }
  }

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

    // https://math.stackexchange.com/questions/656500/given-a-point-slope-and-a-distance-along-that-slope-easily-find-a-second-p/656512
    const theta = Math.atan(slope);
    // flipped dx/dy and +/- to make things work
    const dy = rectDelta * Math.cos(theta);
    const dx = rectDelta * Math.sin(theta);
    return [
      // lower right - more x, more y
      x1 - dx,
      y1 + dy,
      // upper right - more x, less y
      x2 - dx,
      y2 + dy,
      // upper left - less x, less y
      x2 + dx, 
      y2 - dy,
      // lower left - less x, more y
      x1 + dx, 
      y1 - dy,
      // close the polygon
      x1 + dy,
      y1 - dx,
    ];
  }

  // TODO: this is wrong for first drawn rectangle
  // maybe simple poly has different vertex ordering?
  // or we should adjust our POLY string vertex order
  _needsShadow(x1, y1, x2, y2) {
    if (x1 === x2) {
      // north to south vertical
      return y2 > y1;
    }
    if (y1 === y2) {
      // east to west horizontal
      return x1 > x2;
    }
    const slope = geo.slope(x1, y1, x2, y2);
    // we know slope is non-zero and non-infinity because of earlier checks
    return slope < 0 && y2 > y1;
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
    gfx.lineStyle({
      width: this.config.wallThickness / 2.0 + 8.0,
      color: 0x000000,
      alpha: 0.2,
      alignment: 1,
      join: "round"
    });

    gfx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
      if (this._needsShadow(coords[i-1].x, coords[i-1].y, coords[i].x, coords[i].y)) {
        gfx.lineTo(coords[i].x, coords[i].y);
      } else {
        gfx.moveTo(coords[i].x, coords[i].y);
      }
    }

    // draw outer wall poly
    gfx.lineStyle(this.config.wallThickness, PIXI.utils.string2hex(this.config.wallColor), 1.0, 0.5);
    gfx.drawPolygon(flatCoords);

    // draw interior hole walls/shadows
    for (let i = 0; i < numHoles; i++) {

      const hole = poly.getInteriorRingN(i);
      const coords = hole.getCoordinates();
      const flatCoords = coords.map(c => [c.x, c.y]).flat();

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
      doorRect[0], doorRect[1], 
      doorRect[2], doorRect[3],
      doorRect[4], doorRect[5], 
      doorRect[6], doorRect[7],
      doorRect[0], doorRect[1]
      );
  }

  /** @override */
  async refresh() {
    //if ( this._destroyed || this.shape._destroyed ) return;

    // stash latest-greatest config settings
    this.config = game.settings.get(DungeonDraw.MODULE_NAME, DungeonLayer.CONFIG_SETTING);        
    await this._refreshGraphics();
    await this._refreshWalls();
  }

  _addOuterShadow() {
    const state = this.history[this.historyIndex];
    if (state.geometry instanceof jsts.geom.MultiPolygon) {
      for (let i = 0; i < state.geometry.getNumGeometries(); i++) {
        const poly = state.geometry.getGeometryN(i);
        this._addOuterShadowForPoly(poly);
      }
    } else if (state.geometry instanceof jsts.geom.Polygon) {
      this._addOuterShadowForPoly(state.geometry);
    }
  }

  _addOuterShadowForPoly(poly) {
    const outerShadow = new PIXI.Graphics();
    const expanded = poly.buffer(20.0);
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
      await this._makeWallsFromPoly(poly);
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
