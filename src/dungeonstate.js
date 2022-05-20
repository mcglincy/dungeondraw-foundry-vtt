import { makeWalls } from "./wallmaker.js";
import * as geo from "./geo-utils.js";
import { defaultConfig, getTheme } from "./themes.js";

export class DungeonState {
  static FLAG_KEY = "dungeonState";

  constructor(geometry, themeAreas, doors, secretDoors, interiorWalls, config) {
    this.geometry = geometry;
    this.themeAreas = themeAreas;
    this.doors = doors;
    this.secretDoors = secretDoors;
    this.interiorWalls = interiorWalls;
    this.config = config;
  }

  static startState() {
    return new DungeonState(null, [], [], [], [], defaultConfig());
  }

  clone() {
    return new DungeonState(
      this.geometry ? this.geometry.copy() : null,
      JSON.parse(JSON.stringify(this.themeAreas)),
      JSON.parse(JSON.stringify(this.doors)),
      this.secretDoors ? [...this.secretDoors] : [],
      this.interiorWalls ? [...this.interiorWalls] : [],
      JSON.parse(JSON.stringify(this.config))
    );
  }

  /* -------------------------------------------- */

  toString() {
    return JSON.stringify({
      // serialize the geometry object as a WKT string
      wkt: geo.geometryToWkt(this.geometry),
      themeAreas: this.themeAreas,
      doors: this.doors,
      secretDoors: this.secretDoors,
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
    const themeAreas = obj.themeAreas ? obj.themeAreas : [];
    // migrate any themeAreas with legacy themeKey
    for (const themeArea of themeAreas) {
      if (themeArea.themeKey) {
        const theme = getTheme(themeArea.themeKey);
        if (theme) {
          themeArea.config = theme.config;
          delete themeArea.themeKey;
        }
      }
    }
    const doors = obj.doors ? obj.doors : [];
    const secretDoors = obj.secretDoors ? obj.secretDoors : [];
    const interiorWalls = obj.interiorWalls ? obj.interiorWalls : [];
    // fill in any new defaults
    const config = foundry.utils.mergeObject(defaultConfig(), obj.config);
    return new DungeonState(
      geometry,
      themeAreas,
      doors,
      secretDoors,
      interiorWalls,
      config
    );
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
}
