import { makeWalls } from "./wallmaker.js";
import * as geo from "./geo-utils.js";
import { defaultConfig, getTheme } from "./themes.js";

export class DungeonState {
  static FLAG_KEY = "dungeonState";

  constructor(geometry, themeAreas, doors, secretDoors, interiorWalls, invisibleWalls, config) {
    this.geometry = geometry;
    this.themeAreas = themeAreas;
    this.doors = doors;
    this.secretDoors = secretDoors;
    this.interiorWalls = interiorWalls;
    this.invisibleWalls = invisibleWalls;
    this.config = config;
  }

  static startState() {
    return new DungeonState(null, [], [], [], [], [], defaultConfig());
  }

  clone() {
    return new DungeonState(
      this.geometry ? this.geometry.copy() : null,
      JSON.parse(JSON.stringify(this.themeAreas)),
      JSON.parse(JSON.stringify(this.doors)),
      this.secretDoors ? [...this.secretDoors] : [],
      this.interiorWalls ? [...this.interiorWalls] : [],
      this.invisibleWalls ? [...this.invisibleWalls] : [],
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
      invisibleWalls: this.invisibleWalls,
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
    const doors = obj.doors ? obj.doors : [];
    const secretDoors = obj.secretDoors ? obj.secretDoors : [];
    const interiorWalls = obj.interiorWalls ? obj.interiorWalls : [];
    const invisibleWalls = obj.invisibleWalls ? obj.invisibleWalls : [];
    // fill in any new defaults
    const config = foundry.utils.mergeObject(defaultConfig(), obj.config);
    return new DungeonState(
      geometry,
      themeAreas,
      doors,
      secretDoors,
      interiorWalls,
      invisibleWalls,
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
      const dungeonState = DungeonState.fromString(journalEntry.data.content);
      await dungeonState.maybeMigrateAndSave(journalEntry);
      return dungeonState;
    } else {
      console.log("Loading dungeon from start state");
      return DungeonState.startState();
    }
  }

  async maybeMigrateAndSave(journalEntry) {
    if (!game.user.isGM) {
      return;
    }

    let needsSave = false;

    // fix any old themeArea.themeKey fields
    for (const themeArea of this.themeAreas) {
      if (themeArea.themeKey) {
        const theme = getTheme(themeArea.themeKey);
        if (theme) {
          themeArea.config = theme.config;
          delete themeArea.themeKey;
          needsSave = true;
        }
      }
    }
    if (needsSave) {
      await this.saveToJournalEntry(journalEntry);
    }
  }
}
