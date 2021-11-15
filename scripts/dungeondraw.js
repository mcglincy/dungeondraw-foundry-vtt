import { DungeonConfig } from "./dungeonconfig.js";
import { DungeonLayer } from "./dungeonlayer.js";


const notImplementedYet = () => {
  ui.notifications.info("Not implemented yet", {permanent: false});
}

export class DungeonDraw {

  static MODULE_ID = "DD";
  // module name from module.json
  static MODULE_NAME = "dungeon-draw"

  static init() {
    console.log("***** DUNGEON DRAW *****");
    // game.settings.register(DungeonDraw.MODULE_NAME, DungeonLayer.CONFIG_SETTING, 
    //   DungeonConfig.defaultConfig);
  }

  static getSceneControlButtons(controls) {
    CONFIG.Canvas.layers.dungeon = DungeonLayer;
    CONFIG.Dungeon = {
      //documentClass: DungeonDocument,
      layerClass: DungeonLayer,
      sheetClass: DungeonConfig
    };

    controls.push({
      name: "dungeondraw",
      title: "DD.SceneControlTitle",
      layer: DungeonLayer.LAYER_NAME,
      icon: "fas fa-dungeon",
      visible: game.user.isGM,
      tools: [
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
          name: "adddoor",
          title: "DD.ButtonTitleAddDoor",
          icon: "fas fa-door-open",
        },
        {
          name: "subtractdoor",
          title: "DD.ButtonTitleSubtractDoor",
          icon: "fas fa-door-closed",
        },
        {
          name: "undo",
          title: "DD.ButtonTitleUndo",
          icon: "fas fa-undo",
          onClick: async () => {
            await canvas.dungeon.dungeon.undo();
          },
          button: true
        },
        {
          name: "redo",
          title: "DD.ButtonTitleRedo",
          icon: "fas fa-redo",
          onClick: async () => {
            await canvas.dungeon.dungeon.redo();
          },          
          button: true
        },
        {
          name: "config",
          title: "DD.ButtonTitleConfig",
          icon: "fas fa-cog",
          onClick: () => canvas.dungeon.configureSettings(),
          button: true
        },
        {
          name: "clear",
          title: "DD.ButtonTitleClear",
          icon: "fas fa-trash",
          // visible: isGM,
          visible: true,
          onClick: () => canvas.dungeon.deleteAll(),
          button: true
        }
      ],
      activeTool: "addrect"
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
Hooks.on("getSceneControlButtons", DungeonDraw.getSceneControlButtons);
Hooks.on("canvasReady", DungeonDraw.canvasReady);
Hooks.on("updateJournalEntry", DungeonDraw.updateJournalEntry);
