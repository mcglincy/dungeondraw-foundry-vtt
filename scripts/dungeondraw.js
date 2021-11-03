import { DungeonConfig } from "./dungeonconfig.js";
import { DungeonDocument } from "./dungeondocument.js";
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
    game.settings.register(DungeonDraw.MODULE_NAME, DungeonLayer.CONFIG_SETTING, 
      DungeonConfig.defaultConfig);
  }

  static getSceneControlButtons(controls) {
    // if (!game.user.isGM) {
    //   return;
    // }

    CONFIG.Canvas.layers.dungeon = DungeonLayer;
    CONFIG.Dungeon = {
      documentClass: DungeonDocument,
      layerClass: DungeonLayer,
      sheetClass: DungeonConfig
    };

    controls.push({
      name: "dungeondraw",
      title: "DD.SceneControlTitle",
      layer: DungeonLayer.LAYER_NAME,
      icon: "fas fa-dungeon",
      // TODO: use module-specific perms?
      //visible: game.user.can("DRAWING_CREATE"),
      visible: true,
      tools: [
        // TODO: implement
        // {
        //   name: "select",
        //   title: "DD.ButtonTitleSelect",
        //   icon: "fas fa-expand",
        //   onClick: () => {
        //     notImplementedYet();
        //   },
        // },
        {
          name: "addrect",
          title: "DD.ButtonTitleAddRect",
          icon: "fas fa-plus-square",
          onClick: () => {
          },
        },
        {
          name: "subtractrect",
          title: "DD.ButtonTitleSubtractRect",
          icon: "fas fa-minus-square",
          onClick: () => {
          },
        },
        {
          name: "adddoor",
          title: "DD.ButtonTitleAddDoor",
          icon: "fas fa-door-open",
          onClick: () => {
          },
        },
        {
          name: "subtractdoor",
          title: "DD.ButtonTitleSubtractDoor",
          icon: "fas fa-door-closed",
          onClick: () => {
          },
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

  static async canvasReady(canvase) {
    await canvas.dungeon.loadDungeon();
  }
}

Hooks.on("init", DungeonDraw.init);
Hooks.on("getSceneControlButtons", DungeonDraw.getSceneControlButtons);
Hooks.on("canvasReady", DungeonDraw.canvasReady);
