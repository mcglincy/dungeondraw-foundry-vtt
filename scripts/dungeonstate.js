import { Dungeon } from "./dungeon.js";
import { makeWalls } from "./wallmaker.js";
import * as geo from "./geo-utils.js";
import { defaultConfig } from "./themes.js";

export class DungeonState {
  static FLAG_KEY = "dungeonState";

  constructor(geometry, themePaintings, doors, interiorWalls, config) {
    this.geometry = geometry;
    this.themePaintings = themePaintings;
    this.doors = doors;
    this.interiorWalls = interiorWalls;
    this.config = config;
  }

  clone() {
    return new DungeonState(
      this.geometry ? this.geometry.copy() : null,
      JSON.parse(JSON.stringify(this.themePaintings)),      
      JSON.parse(JSON.stringify(this.doors)),
      this.interiorWalls ? [...this.interiorWalls] : [],
      JSON.parse(JSON.stringify(this.config))
      );
  }

  /* -------------------------------------------- */  

  toString() {
    return JSON.stringify({
      // serialize the geometry object as a WKT string
      wkt: geo.geometryToWkt(this.geometry),
      themePaintings: this.themePaintings,
      doors: this.doors,
      interiorWalls: this.interiorWalls,
      config: this.config,
    });
  }

  // TODO: implement as fromJSON?
  static fromString(s) {
    if (!s) {
      return DungeonState.startState();
    }
    const obj = JSON.parse(s);
    const geometry = geo.wktToGeometry(obj.wkt);
    const themePaintings = obj.themePaintings ? obj.themePaintings : [];
    const doors = obj.doors ? obj.doors : [];
    const interiorWalls = obj.interiorWalls ? obj.interiorWalls : [];
    // fill in any new defaults
    const config = foundry.utils.mergeObject(defaultConfig(), obj.config);
    return new DungeonState(geometry, themePaintings, doors, interiorWalls, config);
  }

  /* -------------------------------------------- */  

  async saveToJournalEntry(journalEntry) {
    const serialized = this.toString();
    // update walls before we update the journal
    await makeWalls(this);
    await journalEntry.update({
      content: serialized,
    });
  }

  static async loadFromJournalEntry(journalEntry) {
    if (journalEntry.data.content) {
      console.log(`Loading dungeon from JournalEntry ${journalEntry.name}`);
      return DungeonState.fromString(journalEntry.data.content);
    } else {
      console.log("Loading dungeon from start state");
      return DungeonState.startState();
    }
  }

  static startState() {
    return new DungeonState(null, [], [], defaultConfig());
  }
}
