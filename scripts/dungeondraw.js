import { DungeonConfig } from "./dungeonconfig.js";
import { DungeonDocument } from "./dungeondocument.js";
import { DungeonLayer } from "./dungeonlayer.js";


const notImplementedYet = () => {
  ui.notifications.info("Not implemented yet", {permanent: false});
}

export class DungeonDraw {

  static MODULE_ID = "DD";
  static MODULE_NAME = "dungeondraw"

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
    //     if ( control ) canvas[control.layer].activate();
    CONFIG.Dungeon = {
      documentClass: DungeonDocument,
      layerClass: DungeonLayer,
      sheetClass: DungeonConfig
    };

    controls.push({
      name: "dungeondraw",
      title: "DP.SceneControlTitle",
      layer: DungeonLayer.LAYER_NAME,
      icon: "fas fa-dungeon",
      // TODO: use module-specific perms?
      //visible: game.user.can("DRAWING_CREATE"),
      visible: true,
      tools: [
        {
          name: "select",
          title: "DD.ButtonTitleSelect",
          icon: "fas fa-expand",
          onClick: () => {
            notImplementedYet();
          },
        },
        {
          name: "rect",
          title: "DD.ButtonTitleRect",
          icon: "fas fa-square",
          onClick: () => {
          },
        },
        {
          name: "door",
          title: "DD.ButtonTitleDoor",
          icon: "fas fa-door-open",
          onClick: () => {
            notImplementedYet();
          },
        },
        {
          name: "undo",
          title: "DD.ButtonTitleUndo",
          icon: "fas fa-undo",
          onClick: () => {
            canvas.dungeon.dungeon.undo();
          },
          button: true
        },
        {
          name: "redo",
          title: "DD.ButtonTitleRedo",
          icon: "fas fa-redo",
          onClick: () => {
            canvas.dungeon.dungeon.redo();
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
      activeTool: "rect"
    });
  }
}

Hooks.on("init", DungeonDraw.init);
Hooks.on("getSceneControlButtons", DungeonDraw.getSceneControlButtons);
