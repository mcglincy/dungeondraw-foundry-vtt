import { DungeonDraw } from "./dungeondraw.js";
import { DungeonLayer } from "./dungeonlayer.js";
import { DungeonState } from "./dungeonstate.js";
import { render } from "./renderer.js";
import * as geo from "./geo-utils.js";


/**
 * @extends {PlaceableObject}
 */
// TODO: does Dungeon even need to be a PlaceableObject? Or could it just extend PIXI.Container?
export class Dungeon extends PlaceableObject {

  static defaultConfig() {
    return {
      doorThickness: 25,
      doorColor: "#000000",
      doorFillColor: "#ffffff",
      doorFillOpacity: 0.0,
      exteriorShadowColor: "#000000",
      exteriorShadowThickness: 20,
      exteriorShadowOpacity: 0.5,
      floorColor: "#F2EDDF",
      floorTexture: "",
      floorTextureTint: "",
      interiorShadowColor: "#000000",
      interiorShadowThickness: 8,
      interiorShadowOpacity: 0.5,
      sceneBackgroundColor: "#999999",
      sceneGridColor: "#000000",
      sceneGridOpacity: 0.2,
      wallColor: "#000000",
      wallThickness: 8,
    };
  };


  // expects JournalEntry for constructor
  constructor(journalEntry, note) {
    // note will be saved as this.document
    super(note);
    this.journalEntry = journalEntry;
    // time-ordered array of DungeonStates
    this.history = [DungeonState.startState()];
    this.historyIndex = 0;
  }

  /* -------------------------------------------- */

  // TODO: figure out what documentName / embeddedName / type we should be using
  /** @inheritdoc */
  static embeddedName = "Drawing";

  /* -------------------------------------------- */

  deleteAll() {
    // keep our most recent config around
    const lastState = this.state();
    const resetState = DungeonState.startState();
    resetState.config = lastState.config;
    this.history = [resetState];
    this.historyIndex = 0;
    this.history[this.historyIndex].saveToJournalEntry(this.journalEntry);
    this.refresh();
  }

  state() {
    return this.history[this.historyIndex];
  }

  /* -------------------------------------------- */
  /* Rendering                                    */
  /* -------------------------------------------- */

  /** @override */
  draw() {
    this.refresh();
    return this;
  }  

  /** @override */
  refresh() {
    render(this, this.state());
  } 

  async maybeRefresh(journalEntry) {
    if (journalEntry.id === this.journalEntry.id) {
      const savedState = await DungeonState.loadFromJournalEntry(this.journalEntry);
      // update state, but don't save to journal
      await this.pushState(savedState, false);
    }
  }

  /* -------------------------------------------- */

  async loadFromJournalEntry() {
    const savedState = await DungeonState.loadFromJournalEntry(this.journalEntry);
    this.history = [savedState];
    this.historyIndex = 0;
    await this.refresh();
  };

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

  async pushState(newState, saveToJournalEntry=true) {
    // throw away any history states after current
    for (let i = this.history.length - 1; i > this.historyIndex; i--) {
      this.history.pop();
    }
    // and add our new state    
    this.history.push(newState);
    this.historyIndex++;

    if (saveToJournalEntry) {
      await newState.saveToJournalEntry(this.journalEntry);      
    }
    await this.refresh();
  }

  async setConfig(config) {
    const newState = this.state().clone();
    newState.config = config;
    await this.pushState(newState);
  }

  async addDoor(x1, y1, x2, y2) {
    const newState = this.history[this.historyIndex].clone();
    const doorPoly = geo.twoPointsToLineString(x1, y1, x2, y2);

    // possibly split interior walls
    const wallsToDelete = [];
    const wallsToAdd = [];
    for (let wall of newState.interiorWalls) {
      const wallPoly = geo.twoPointsToLineString(wall[0], wall[1], wall[2], wall[3]);
      const contains = wallPoly.contains(doorPoly);
      if (contains) {
        wallsToDelete.push(wall);
        // make sure points are consistently ordered
        const w1 = geo.lesserPoint(wall[0], wall[1], wall[2], wall[3]);
        const w2 = geo.greaterPoint(wall[0], wall[1], wall[2], wall[3]);
        const d1 = geo.lesserPoint(x1, y1, x2, y2);
        const d2 = geo.greaterPoint(x1, y1, x2, y2);
        wallsToAdd.push([w1[0], w1[1], d1[0], d1[1]]);
        wallsToAdd.push([d2[0], d2[1], w2[0], w2[1]]);
      }
    }
    newState.interiorWalls = newState.interiorWalls.filter(w => wallsToDelete.indexOf(w) === -1);
    newState.interiorWalls = newState.interiorWalls.concat(wallsToAdd);
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

  /**
   * Split the wall if it's drawn over an existing door.
   * 
   * @returns [[x1, y1, x2, y2], ...]
   */
  _maybeSplitWall(x1, y1, x2, y2, doors) {
    // TODO: this logic doesn't handle two doors side by side
    const wallPoly = geo.twoPointsToLineString(x1, y1, x2, y2);
    for (let door of doors) {
      const doorPoly = geo.twoPointsToLineString(door[0], door[1], door[2], door[3]);
      const contains = wallPoly.contains(doorPoly);
      if (contains) {
        // make sure points are consistently ordered
        const w1 = geo.lesserPoint(x1, y1, x2, y2);
        const w2 = geo.greaterPoint(x1, y1, x2, y2);
        const d1 = geo.lesserPoint(door[0], door[1], door[2], door[3]);
        const d2 = geo.greaterPoint(door[0], door[1], door[2], door[3]);
        return [
          [w1[0], w1[1], d1[0], d1[1]],
          [d2[0], d2[1], w2[0], w2[1]]
        ];
      } 
    }
    // wall didn't contain any door, so return as-is
    return [[x1, y1, x2, y2]];
  }

  async addInteriorWall(x1, y1, x2, y2) {
    const newState = this.history[this.historyIndex].clone();
    const wallsToAdd = this._maybeSplitWall(x1, y1, x2, y2, newState.doors);
    newState.interiorWalls = newState.interiorWalls.concat(wallsToAdd);
    await this.pushState(newState);
  }

  async subtractInteriorWalls(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const wallsToKeep = this.history[this.historyIndex].interiorWalls.filter(w => {
      const wallPoly = geo.twoPointsToLineString(w[0], w[1], w[2], w[3]);
      return !rectPoly.intersects(wallPoly);
    });
    if (wallsToKeep.length != this.history[this.historyIndex].interiorWalls.length) {
      const newState = this.history[this.historyIndex].clone();
      newState.interiorWalls = wallsToKeep;
      await this.pushState(newState);      
    }
  }

  async subtractDoorsAndInteriorWalls(rect) {
    const rectPoly = geo.rectToPolygon(rect);
    const oldState = this.history[this.historyIndex];
    const doorsToKeep = oldState.doors.filter(d => {
      const doorPoly = geo.twoPointsToLineString(d[0], d[1], d[2], d[3]);
      return !rectPoly.intersects(doorPoly);
    });
    const wallsToKeep = oldState.interiorWalls.filter(w => {
      const wallPoly = geo.twoPointsToLineString(w[0], w[1], w[2], w[3]);
      return !rectPoly.intersects(wallPoly);
    });
    if (doorsToKeep.length != oldState.doors.length || wallsToKeep.length != oldState.interiorWalls.length) {
      const newState = oldState.clone();
      newState.doors = doorsToKeep;
      newState.interiorWalls = wallsToKeep;
      await this.pushState(newState);      
    }
  }

  async _addPoly(poly) {
    const oldState = this.history[this.historyIndex];
    const newState = oldState.clone();    
    if (newState.geometry) {
      newState.geometry = newState.geometry.union(poly);
      const touches = oldState.geometry.touches(poly);
      if (touches) {
        const intersection = oldState.geometry.intersection(poly);
        const coordinates = intersection.getCoordinates();
        // TODO: do we need to handle more complicated overlaps, GeometryCollection etc?
        // this coordinate 2-step is flimsy
        if (coordinates.length > 1 && coordinates.length % 2 === 0) {
          console.log(coordinates);
          for (let i = 0; i < coordinates.length; i+=2) {
            const wallsToAdd = this._maybeSplitWall(coordinates[i].x, coordinates[i].y, coordinates[i+1].x, coordinates[i+1].y, newState.doors);
            newState.interiorWalls = newState.interiorWalls.concat(wallsToAdd);
          }
        }
      } else {
        // also nuke any interior walls in this new poly
        const wallsToKeep = newState.interiorWalls.filter(w => {
          const wallPoly = geo.twoPointsToLineString(w[0], w[1], w[2], w[3]);
          return !poly.intersects(wallPoly);
        });
        if (wallsToKeep.length != newState.interiorWalls.length) {
          newState.interiorWalls = wallsToKeep;
        }        
      }
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
}
