import { ConfigSheet } from "./configsheet.js";
import { DungeonLayer } from "./dungeonlayer.js";
import * as constants from "./constants.js";
import { GeneratorSheet } from "./generatorsheet.js";
import { Settings } from "./settings";

export class DungeonDraw {
  static init() {
    Settings.register();
  }

  static ready() {
    DungeonDraw.maybeShowReleaseNotes();
  }

  static async maybeShowReleaseNotes() {
    if (!game.user.isGM) {
      // GMs only
      return;
    }
    const moduleVersion = game.modules.get(constants.MODULE_NAME).data.version;
    const settingsVersion = game.settings.get(
      constants.MODULE_NAME,
      constants.SETTING_RELEASE_NOTES_VERSION
    );
    if (moduleVersion === settingsVersion) {
      // they've already seen it
      return;
    }
    const resp = await fetch("modules/dungeon-draw/CHANGELOG.md");
    const changelog = await resp.text();
    // keep only the most recent changelog section
    const firstChangelog = "#" + changelog.split("#")[1];
    // show it in a Dialog
    const html = await renderTemplate(
      "modules/dungeon-draw/templates/release-notes.html",
      {
        data: {
          version: moduleVersion,
          changelog: firstChangelog,
        },
      }
    );
    const dialog = new Dialog(
      {
        title: game.i18n.localize("DD.ReleaseNotes"),
        content: html,
        buttons: {
          roll: {
            icon: '<i class="fas fa-check"></i>',
            label: "OK",
          },
        },
      },
      {
        width: 600,
      }
    );
    dialog.render(true);
    // mark this version as shown
    await game.settings.set(
      constants.MODULE_NAME,
      "releaseNotesVersion",
      moduleVersion
    );
  }

  static getSceneControlButtons(controls) {
    if (CONFIG.Canvas.layers.background?.group) {
      // v9+ layer setup
      CONFIG.Canvas.layers.dungeon = {
        layerClass: DungeonLayer,
        group: "primary",
      };
    } else {
      // v8 layer setup
      // TODO: remove this if/else once v8 is gone from existence
      CONFIG.Canvas.layers.dungeon = DungeonLayer;
    }

    CONFIG.Dungeon = {
      //documentClass: DungeonDocument,
      layerClass: DungeonLayer,
      //sheetClass: DungeonConfig
    };

    controls.push({
      name: "dungeondraw",
      title: "DD.SceneControlTitle",
      layer: DungeonLayer.LAYER_NAME,
      icon: "fas fa-dungeon",
      visible: game.user.isTrusted,
      tools: [
        {
          name: "generate",
          title: "DD.ButtonTitleGenerate",
          icon: "fas fa-magic",
          onClick: async () => new GeneratorSheet().render(true),
          button: true,
        },
        {
          name: "addrect",
          title: "DD.ButtonTitleAddRect",
          icon: "fas fa-plus-square",
        },
        {
          name: "subtractrect",
          title: "DD.ButtonTitleSubtractRect",
          icon: "fas fa-minus-square",
        },
        {
          name: "addpoly",
          title: "DD.ButtonTitleAddPoly",
          icon: "fas fa-draw-polygon",
        },
        {
          name: "freehand",
          title: "DD.ButtonTitleFreehand",
          icon: "fas fa-signature",
        },
        {
          name: "addwall",
          title: "DD.ButtonTitleAddWall",
          icon: "fas fa-bars",
        },
        {
          name: "adddoor",
          title: "DD.ButtonTitleAddDoor",
          icon: "fas fa-door-open",
        },
        {
          name: "addsecretdoor",
          title: "DD.ButtonTitleAddSecretDoor",
          icon: "fas fa-mask",
        },
        {
          name: "subtractdoor",
          title: "DD.ButtonTitleSubtractDoorsAndWalls",
          icon: "fas fa-window-close",
        },
        {
          name: "themepainter",
          title: "DD.ButtonTitleThemePainter",
          icon: "fas fa-brush",
        },
        {
          name: "themeeraser",
          title: "DD.ButtonTitleThemeEraser",
          icon: "fas fa-eraser",
        },
        {
          name: "undo",
          title: "DD.ButtonTitleUndo",
          icon: "fas fa-undo",
          onClick: async () => {
            await canvas.dungeon.dungeon.undo();
          },
          button: true,
        },
        {
          name: "redo",
          title: "DD.ButtonTitleRedo",
          icon: "fas fa-redo",
          onClick: async () => {
            await canvas.dungeon.dungeon.redo();
          },
          button: true,
        },
        {
          name: "config",
          title: "DD.ButtonTitleConfig",
          icon: "fas fa-cog",
          onClick: () => new ConfigSheet().render(true),
          button: true,
        },
        {
          name: "savetoscene",
          title: "DD.ButtonTitleSaveToSceneBackground",
          icon: "fas fa-sign-out-alt",
          visible: game.user.isGM,
          onClick: async () => {
            await canvas.dungeon.dungeon.saveToSceneBackground();
          },
          button: true,
        },
        {
          name: "clear",
          title: "DD.ButtonTitleClear",
          icon: "fas fa-trash",
          visible: game.user.isGM,
          onClick: () => canvas.dungeon.deleteAll(),
          button: true,
        },
      ],
      activeTool: "addrect",
    });
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
}

Hooks.on("init", DungeonDraw.init);
Hooks.on("ready", DungeonDraw.ready);
Hooks.on("getSceneControlButtons", DungeonDraw.getSceneControlButtons);
Hooks.on("canvasReady", DungeonDraw.canvasReady);
Hooks.on("updateJournalEntry", DungeonDraw.updateJournalEntry);
