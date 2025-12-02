import * as constants from "./constants.js";
import { DungeonLayer } from "./dungeonlayer.js";

export class Keybindings {
  static register() {
    game.keybindings.register(constants.MODULE_NAME, "redo", {
      name: "DD.ButtonTitleRedo",
      uneditable: [
        {
          key: "KeyY",
          modifiers: [
            foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.CONTROL,
          ],
        },
      ],
      onDown: Keybindings.onRedo,
    });

    game.keybindings.register(constants.MODULE_NAME, "undo", {
      name: "DD.ButtonTitleUndo",
      uneditable: [
        {
          key: "KeyZ",
          modifiers: [
            foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.CONTROL,
          ],
        },
      ],
      onDown: Keybindings.onUndo,
    });
  }

  static onRedo() {
    if (!canvas.ready) {
      return false;
    }
    const layer = canvas.activeLayer;
    if (!(layer instanceof DungeonLayer)) {
      return false;
    }

    layer.dungeon?.redo();
    return true;
  }

  static onUndo() {
    if (!canvas.ready) {
      return false;
    }
    const layer = canvas.activeLayer;
    if (!(layer instanceof DungeonLayer)) {
      return false;
    }

    layer.dungeon?.undo();
    return true;
  }
}
