import * as constants from "../constants.js";

const FOLDER_NAME = "Dungeon Draw";

/**
 * Find existing dungeon journal entry and note in the current scene.
 * @returns {Object} { journalEntry, note } or { journalEntry: null, note: null }
 */
export function findDungeonEntryAndNote() {
  for (const note of canvas.scene.notes) {
    const journalEntry = game.journal.get(note.entryId);
    if (journalEntry) {
      const flag = journalEntry.getFlag(
        constants.MODULE_NAME,
        "dungeonVersion"
      );
      if (flag) {
        return { journalEntry, note };
      }
    }
  }
  return { journalEntry: null, note: null };
}

/**
 * Create a new dungeon journal entry and note.
 * @returns {Object} { journalEntry, note }
 */
export async function createDungeonEntryAndNote() {
  const journalEntry = await createDungeonEntry();
  const note = await createDungeonNote(journalEntry);
  return { journalEntry, note };
}

/**
 * Create a new dungeon journal entry in the Dungeon Draw folder.
 * @returns {JournalEntry} The created journal entry
 */
async function createDungeonEntry() {
  let folder = game.folders
    .filter((f) => f.type === "JournalEntry" && f.name === FOLDER_NAME)
    .pop();
  if (!folder) {
    folder = await Folder.create({
      name: FOLDER_NAME,
      type: "JournalEntry",
    });
  }

  const journalEntry = await JournalEntry.create({
    name: canvas.scene.name,
    folder: folder.id,
    flags: {
      "dungeon-draw": {
        dungeonVersion: "1.0",
      },
    },
  });
  return journalEntry;
}

/**
 * Create a note on the canvas linked to the dungeon journal entry.
 * @param {JournalEntry} journalEntry - The journal entry to link
 */
async function createDungeonNote(journalEntry) {
  await canvas.scene.createEmbeddedDocuments("Note", [
    {
      entryId: journalEntry.id,
      fontSize: 20,
      icon: "icons/svg/cave.svg",
      iconSize: 32,
      textAnchor: 1,
      textColor: "#FFFFFF",
      x: 50,
      y: 50,
      iconTint: "",
      text: "Dungeon Draw",
      flags: {},
    },
  ]);
}
