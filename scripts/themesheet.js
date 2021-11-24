import { ConfigSheet } from "./configsheet.js";
import { Dungeon } from "./dungeon.js";
import { DungeonDraw } from "./dungeondraw.js";
import { DungeonLayer } from "./dungeonlayer.js";
import { themes } from "./themes.js";


/**
 * Sheet for Theme editing.
 * 
 * @extends {FormApplication}
 */
export class ThemeSheet extends FormApplication {

  constructor(themeKey) {
    super()
    this.themeKey = themeKey;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dd-theme-sheet",
      classes: ["sheet"],
      template: "modules/dungeon-draw/templates/theme-sheet.html",
      width: 480,
      height: 730,
      tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "position"}]
    });
  }

  /** @override */
  get title() {
    return game.i18n.localize("DD.ThemeSheetTitle");
  }

  /** @override */
  getData() {
    const customThemes = this.getCustomThemes();
    const theme = customThemes[this.themeKey];
    return {      
      config: theme.config,
      themeName: theme.name,
    }
  }

  /* -------------------------------------------- */

  getCustomThemes() {
    try {
      const customThemesString = game.settings.get(DungeonDraw.MODULE_NAME, "customThemes");
      return JSON.parse(customThemesString);
    } catch(e) {
      console.log(e);
      return {};
    }
  }

  saveCustomThemes(customThemes) {
    const themesString = JSON.stringify(customThemes);
    game.settings.set(DungeonDraw.MODULE_NAME, "customThemes", themesString);
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    const customThemes = this.getCustomThemes();
    const themeName = formData.themeName;
    delete formData.themeName;
    // overwrite the theme at our key
    customThemes[this.themeKey] = {
      name: themeName,
      config: formData
    };
    this.saveCustomThemes(customThemes);
    // force already-open config sheet to re-render
    new ConfigSheet("themes").render(true);
  }
}
