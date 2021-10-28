import { DungeonConfig } from "./dungeonconfig.js";
import { DungeonDocument } from "./dungeondocument.js";
import { DungeonLayer } from "./dungeonlayer.js";

class DungeonDraw {

  static MODULE_ID = "DD";
  static MODULE_NAME = "dungeondraw"

  static init() {
    console.log("***** DUNGEON DRAW *****");
    // game.settings.register(DungeonDraw.MODULE_NAME, DungeonLayer.DEFAULT_CONFIG_SETTING, ???);
    game.settings.register("dungeondraw", "defaultDungeonConfig", {});

    
  //   , {
  //   name: 'foreground-drawings.CONTROLS.ClearDrawingsOnlyOnActiveLayerSetting',
  //   hint: 'foreground-drawings.CONTROLS.ClearDrawingsOnlyOnActiveLayerSettingHint',
  //   scope: 'client',
  //   config: true,
  //   type: Boolean,
  //   default: true,
  //   onChange: () => window.location.reload(),
  // });
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
      visible: game.user.can("DRAWING_CREATE"),
      tools: [
        {
          name: "select",
          title: "CONTROLS.DrawingSelect",
          icon: "fas fa-expand"
        },
        {
          name: "rect",
          title: "DP.ButtonTitleRect",
          icon: "fas fa-square",
          onClick: () => {
            console.log("***** rectangle");
          },
        },
        {
          name: "config",
          title: "DP.ButtonTitleConfig",
          icon: "fas fa-cog",
          onClick: () => canvas.dungeon.configureDefault(),
          button: true
        },
        {
          name: "clear",
          title: "CONTROLS.DrawingClear",
          icon: "fas fa-trash",
          // visible: isGM,
          visible: true,
          // TODO: deal with error
          // document.mjs:479 Uncaught (in promise) Error: Dungeon is not a valid embedded Document within the Scene Document
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
