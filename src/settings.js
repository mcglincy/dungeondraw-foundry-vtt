import * as constants from "./constants.js";

export class Settings {
  static register() {
    game.settings.register(
      constants.MODULE_NAME,
      constants.SETTING_3DCANVAS_ENABLED,
      {
        name: "Enable support for 3D Canvas module",
        scope: "client",
        default: true,
        type: Boolean,
        config: true,
      }
    );
    game.settings.register(
      constants.MODULE_NAME,
      constants.SETTING_SNAP_TO_GRID,
      {
        name: "Snap to grid",
        scope: "client",
        default: true,
        type: Boolean,
        config: true,
        onChange: (value) => {
          // make sure DungeonLayer instance has latest value
          canvas.dungeon.options.snapToGrid = value;
        },
      }
    );
    game.settings.register(
      constants.MODULE_NAME,
      constants.SETTING_RELEASE_NOTES_VERSION,
      {
        name: "Last version we showed release notes.",
        scope: "client",
        default: "",
        type: String,
        config: false,
      }
    );
    game.settings.register(
      constants.MODULE_NAME,
      constants.SETTING_CUSTOM_THEMES,
      {
        name: "Custom themes data.",
        scope: "client",
        default: "{}",
        type: String,
        config: false,
      }
    );
    game.settings.register(
      constants.MODULE_NAME,
      constants.SETTING_THEME_PAINTER_THEME,
      {
        name: "Theme painter theme key.",
        scope: "client",
        default: "module.cavern",
        type: String,
        config: false,
      }
    );
  }

  static threeDCanvasEnabled() {
    return game.settings.get(
      constants.MODULE_NAME,
      constants.SETTING_3DCANVAS_ENABLED
    );
  }

  static snapToGrid() {
    return game.settings.get(
      constants.MODULE_NAME,
      constants.SETTING_SNAP_TO_GRID
    );
  }
}
