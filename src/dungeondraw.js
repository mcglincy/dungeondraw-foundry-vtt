import { ConfigSheet } from "./configsheet.js";
import { DungeonLayer } from "./dungeonlayer.js";
import * as constants from "./constants.js";
import { GeneratorSheet } from "./generatorsheet.js";
import { Keybindings } from "./keybindings";
import { Settings } from "./settings";
import { DungeonDrawToolbar } from "./toolbar";

const toolbar = new DungeonDrawToolbar();

export class DungeonDraw {
  static init() {
    Settings.register();
    Keybindings.register();

    game.activeDungeonDrawTool = "rectangle";
    game.activeDungeonDrawMode = "add";
  }

  static ready() {}

  static controlsVisible() {
    if (game.user.isGM) {
      return true;
    }
    const allowTrustedPlayer = game.settings.get(
      constants.MODULE_NAME,
      constants.SETTING_ALLOW_TRUSTED_PLAYER
    );
    return allowTrustedPlayer && game.user.isTrusted;
  }

  static getSceneControlButtons(controls) {
    CONFIG.Canvas.layers[DungeonLayer.LAYER_NAME] = {
      layerClass: DungeonLayer,
      group: "primary",
    };
    CONFIG.Dungeon = {
      layerClass: DungeonLayer,
    };

    controls.dungeondraw = {
      name: "dungeondraw",
      title: "DD.SceneControlTitle",
      layer: DungeonLayer.LAYER_NAME,
      icon: "fas fa-dungeon",
      visible: DungeonDraw.controlsVisible(),
      tools: {
        drawmap: {
          name: "drawmap",
          title: "DD.ButtonTitleDrawMap",
          icon: "fas fa-dungeon",
        },
        undo: {
          name: "undo",
          title: "DD.ButtonTitleUndo",
          icon: "fas fa-undo",
          onClick: async () => {
            await canvas.dungeon.dungeon.undo();
          },
          button: true,
        },
        redo: {
          name: "redo",
          title: "DD.ButtonTitleRedo",
          icon: "fas fa-redo",
          onClick: async () => {
            await canvas.dungeon.dungeon.redo();
          },
          button: true,
        },
        generate: {
          name: "generate",
          title: "DD.ButtonTitleGenerate",
          icon: "fas fa-magic",
          onClick: async () => new GeneratorSheet().render(true),
          button: true,
        },
        config: {
          name: "config",
          title: "DD.ButtonTitleConfig",
          icon: "fas fa-cog",
          onClick: () => new ConfigSheet().render(true),
          button: true,
        },
        savetoscene: {
          name: "savetoscene",
          title: "DD.ButtonTitleSaveToSceneBackground",
          icon: "fas fa-sign-out-alt",
          visible: game.user.isGM,
          onClick: async () => {
            await canvas.dungeon.dungeon.saveToSceneBackground();
          },
          button: true,
        },
        clear: {
          name: "clear",
          title: "DD.ButtonTitleClearAll",
          icon: "fas fa-trash",
          visible: game.user.isGM,
          onClick: () => canvas.dungeon.deleteAll(),
          button: true,
        },
      },
      activeTool: "drawmap",
      // eslint-disable-next-line no-unused-vars
      onChange: (event, active) => {},
      onToolChange: () => {},
    };
    console.log("controls", controls);
  }

  static async canvasReady(canvas) {
    await canvas.dungeon.loadDungeon();
  }

  static async updateJournalEntry(document, change, options, userId) {
    if (game.user.id !== userId) {
      // if somebody else changed the backing JournalEntry, we need to refresh
      await canvas.dungeon.dungeon?.maybeRefresh(document);
    }
  }

  static async renderSceneControls(controls) {
    if (controls.control.name !== "dungeondraw") {
      // TODO: not found?
      await toolbar.close();
      return;
    }
    toolbar.render(true);
  }

  static async activateSceneControls() {
    $("#controls").append(toolbar.element);
    toolbar.element.addClass("active");
  }
}

Hooks.on("init", DungeonDraw.init);
Hooks.on("ready", DungeonDraw.ready);
Hooks.on("getSceneControlButtons", DungeonDraw.getSceneControlButtons);
Hooks.on("canvasReady", DungeonDraw.canvasReady);
Hooks.on("updateJournalEntry", DungeonDraw.updateJournalEntry);
Hooks.on("renderSceneControls", DungeonDraw.renderSceneControls);
Hooks.on("renderDungeonDrawToolbar", DungeonDraw.activateSceneControls);
