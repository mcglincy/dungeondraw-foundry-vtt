import * as constants from "./constants.js";
import { DungeonLayer } from "./dungeonlayer.js";
import { toolbar } from "./dungeondraw.js";

export class Keybindings {
  static register() {
    // Undo/Redo
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

    // Row 1 - Shape Tools (Q, W, E, R, T)
    game.keybindings.register(constants.MODULE_NAME, "toolRectangle", {
      name: "DD.KeybindingRectangle",
      editable: [{ key: "KeyQ" }],
      onDown: () => Keybindings.setActiveTool("rectangle"),
    });

    game.keybindings.register(constants.MODULE_NAME, "toolPolygon", {
      name: "DD.KeybindingPolygon",
      editable: [{ key: "KeyW" }],
      onDown: () => Keybindings.setActiveTool("polygon"),
    });

    game.keybindings.register(constants.MODULE_NAME, "toolEllipse", {
      name: "DD.KeybindingEllipse",
      editable: [{ key: "KeyE" }],
      onDown: () => Keybindings.setActiveTool("ellipse"),
    });

    game.keybindings.register(constants.MODULE_NAME, "toolFreehand", {
      name: "DD.KeybindingFreehand",
      editable: [{ key: "KeyR" }],
      onDown: () => Keybindings.setActiveTool("freehand"),
    });

    game.keybindings.register(constants.MODULE_NAME, "toolGridPainter", {
      name: "DD.KeybindingGridPainter",
      editable: [{ key: "KeyT" }],
      onDown: () => Keybindings.setActiveTool("gridpainter"),
    });

    // Row 2 - Wall/Door Tools (A, S, D, F)
    game.keybindings.register(constants.MODULE_NAME, "toolInteriorWall", {
      name: "DD.KeybindingInteriorWall",
      editable: [{ key: "KeyA" }],
      onDown: () => Keybindings.setActiveTool("interiorwall"),
    });

    game.keybindings.register(constants.MODULE_NAME, "toolDoor", {
      name: "DD.KeybindingDoor",
      editable: [{ key: "KeyS" }],
      onDown: () => Keybindings.setActiveTool("door"),
    });

    game.keybindings.register(constants.MODULE_NAME, "toolSecretDoor", {
      name: "DD.KeybindingSecretDoor",
      editable: [{ key: "KeyD" }],
      onDown: () => Keybindings.setActiveTool("secretdoor"),
    });

    game.keybindings.register(constants.MODULE_NAME, "toolInvisibleWall", {
      name: "DD.KeybindingInvisibleWall",
      editable: [{ key: "KeyF" }],
      onDown: () => Keybindings.setActiveTool("invisiblewall"),
    });

    // Row 3 - Other Tools (Z)
    game.keybindings.register(constants.MODULE_NAME, "toolThemePainter", {
      name: "DD.KeybindingThemePainter",
      editable: [{ key: "KeyZ" }],
      onDown: () => Keybindings.setActiveTool("themepainter"),
    });

    // Mode Toggle (1, 2)
    game.keybindings.register(constants.MODULE_NAME, "modeAdd", {
      name: "DD.KeybindingAddMode",
      editable: [{ key: "Digit1" }],
      onDown: () => Keybindings.setActiveMode("add"),
    });

    game.keybindings.register(constants.MODULE_NAME, "modeRemove", {
      name: "DD.KeybindingRemoveMode",
      editable: [{ key: "Digit2" }],
      onDown: () => Keybindings.setActiveMode("remove"),
    });
  }

  static setActiveTool(toolName) {
    if (!canvas.ready) {
      return false;
    }
    const layer = canvas.activeLayer;
    if (!(layer instanceof DungeonLayer)) {
      return false;
    }

    game.activeDungeonDrawTool = toolName;
    toolbar.updateActiveCss();
    return true;
  }

  static setActiveMode(mode) {
    if (!canvas.ready) {
      return false;
    }
    const layer = canvas.activeLayer;
    if (!(layer instanceof DungeonLayer)) {
      return false;
    }

    game.activeDungeonDrawMode = mode;
    toolbar.render(true);
    return true;
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
