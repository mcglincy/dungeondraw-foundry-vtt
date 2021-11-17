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
      await this.pushState(savedState);
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

  async setConfig(config) {
    const newState = this.state().clone();
    newState.config = config;
    await this.pushState(newState);
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
}
