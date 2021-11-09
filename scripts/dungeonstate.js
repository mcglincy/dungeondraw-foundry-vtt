import { Dungeon } from "./dungeon.js";
import { makeWalls } from "./wallmaker.js";
import * as geo from "./geo-utils.js";


export class DungeonState {
  static FLAG_KEY = "dungeonState";

  constructor(geometry, doors, config) {
    this.geometry = geometry;
    this.doors = doors;
    this.config = config;
  }

  clone() {
    return new DungeonState(
      this.geometry ? this.geometry.copy() : null,
      JSON.parse(JSON.stringify(this.doors)),
      JSON.parse(JSON.stringify(this.config))
      );
  }

  /* -------------------------------------------- */  

  toString() {
    return JSON.stringify({
      // serialize the geometry object as a WKT string
      wkt: geo.geometryToWkt(this.geometry),
      doors: this.doors,
      config: this.config,
    });
  }

  // TODO: implement as fromJSON?
  static fromString(s) {
    if (!s) {
      return DungeonState.startState();
    }
    const obj = JSON.parse(s);
    return new DungeonState(geo.wktToGeometry(obj.wkt), obj.doors, obj.config);
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
      return DungeonState.fromString(journalEntry.data.content);
    } else {
      return DungeonState.startState();
    }
  }

  static startState() {
    return new DungeonState(null, [], Dungeon.defaultConfig());
  }
}
