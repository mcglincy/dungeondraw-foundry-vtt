import { FLAG_DUNGEON_STATE, MODULE_NAME } from "./constants.js";
import { Settings } from "./settings.js";
import { makeWalls } from "./wallmaker.js";
import * as geo from "./geo-utils.js";
import { defaultConfig } from "./themes.js";

export class DungeonState {
  static FLAG_KEY = "dungeonState";

  constructor(
    geometry,
    themeAreas,
    doors,
    secretDoors,
    interiorWalls,
    invisibleWalls,
    stairs,
    config
  ) {
    this.geometry = geometry;
    this.themeAreas = themeAreas;
    this.doors = doors;
    this.secretDoors = secretDoors;
    this.interiorWalls = interiorWalls;
    this.invisibleWalls = invisibleWalls;
    this.stairs = stairs;
    this.config = config;
  }

  static startState() {
    return new DungeonState(null, [], [], [], [], [], [], defaultConfig());
  }

  clone() {
    // Inconsistent cloning - some arrays use shallow copy ([...arr]),
    // others use deep copy (JSON.parse/stringify). Shallow copies of arrays
    // stairs uses deep copy because it contains objects.
    return new DungeonState(
      this.geometry ? this.geometry.copy() : null,
      JSON.parse(JSON.stringify(this.themeAreas)),
      JSON.parse(JSON.stringify(this.doors)),
      this.secretDoors ? [...this.secretDoors] : [],
      this.interiorWalls ? [...this.interiorWalls] : [],
      this.invisibleWalls ? [...this.invisibleWalls] : [],
      this.stairs ? JSON.parse(JSON.stringify(this.stairs)) : [],
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
      stairs: this.stairs,
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
    const stairs = obj.stairs ? obj.stairs : [];
    // fill in any new defaults
    const config = foundry.utils.mergeObject(defaultConfig(), obj.config);
    return new DungeonState(
      geometry,
      themeAreas,
      doors,
      secretDoors,
      interiorWalls,
      invisibleWalls,
      stairs,
      config
    );
  }

  /* -------------------------------------------- */

  async saveToJournalEntry(journalEntry) {
    const serialized = this.toString();
    if (Settings.makeFoundryWalls()) {
      // update walls before we update the journal
      await makeWalls(this);
    }
    await journalEntry.setFlag(MODULE_NAME, FLAG_DUNGEON_STATE, serialized);
  }

  static async loadFromJournalEntry(journalEntry) {
    await this.maybeMigrateJournalEntry(journalEntry);
    const content = journalEntry.getFlag(MODULE_NAME, FLAG_DUNGEON_STATE);
    return DungeonState.fromString(content);
  }

  static async maybeMigrateJournalEntry(journalEntry) {
    if (!game.user.isGM) {
      return;
    }
    if (journalEntry.pages) {
      // v10
      const page = journalEntry.pages.find((p) => p.type === "text");
      if (page?.text?.content) {
        console.log("Migrating v10 page.text.content");
        const dungeonState = DungeonState.fromString(page.text.content);
        await dungeonState.saveToJournalEntry(journalEntry);
        await page.delete();
      }
    } else if (journalEntry.data.content) {
      // v9
      console.log("Migrating v9 journalEntry.data.content");
      const dungeonState = DungeonState.fromString(journalEntry.data.content);
      await dungeonState.saveToJournalEntry(journalEntry);
      await journalEntry.update({ content: null });
    }
  }
}
