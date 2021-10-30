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
            notImplementedYet();
          },
        },
        {
          name: "redo",
          title: "DD.ButtonTitleRedo",
          icon: "fas fa-redo",
          onClick: () => {
            notImplementedYet();
          },          
        },
        {
          name: "config",
          title: "DD.ButtonTitleConfig",
          icon: "fas fa-cog",
          onClick: () => canvas.dungeon.configureDefault(),
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
