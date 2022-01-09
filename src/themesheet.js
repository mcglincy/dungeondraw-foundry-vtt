// TODO: fix this circular dependency
// import { ConfigSheet } from "./configsheet.js";
import { Settings } from "./settings.js";
import { getCustomThemes, setCustomThemes } from "./themes.js";

/**
 * Sheet for Theme editing.
 *
 * @extends {FormApplication}
 */
export class ThemeSheet extends FormApplication {
  constructor(themeKey) {
    super();
    this.themeKey = themeKey;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dd-theme-sheet",
      classes: ["sheet"],
      template: "modules/dungeon-draw/templates/theme-sheet.html",
      width: 480,
      height: Settings.threeDCanvasEnabled() ? 1160 : 1040,
      tabs: [
        { navSelector: ".tabs", contentSelector: "form", initial: "position" },
      ],
    });
  }

  /** @override */
  get title() {
    return game.i18n.localize("DD.ThemeSheetTitle");
  }

  /** @override */
  getData() {
    const customThemes = getCustomThemes();
    const theme = customThemes[this.themeKey];
    const threeDCanvasEnabled = Settings.threeDCanvasEnabled();
    return {
      config: theme.config,
      themeName: theme.name,
      threeDCanvasEnabled,
    };
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    const customThemes = getCustomThemes();
    const themeName = formData.themeName;
    delete formData.themeName;
    // overwrite the theme at our key
    customThemes[this.themeKey] = {
      name: themeName,
      config: formData,
    };
    setCustomThemes(customThemes);
    // re-draw the dungeon
    // draw() and refresh() on the layer makes the dungeon disappear
    //canvas.dungeon.draw();
    //canvas.dungeon.refresh();
    // refresh on the dungeon does nothing
    await canvas.dungeon.dungeon?.refresh();

    // force already-open config sheet to re-render
    // TODO: fix this circular dependency
    // new ConfigSheet("themes").render(true);
  }
}
