import { Dungeon } from "./dungeon.js";
import { DungeonDraw } from "./dungeondraw.js";
import { DungeonLayer } from "./dungeonlayer.js";
import { themes } from "./themes.js";


/**
 * The Application responsible for configuring a single Dungeon document within a parent Scene.
 * @extends {FormApplication}
 *
 * @param {Dungeon} dungeon         The Dungeon object being configured
 * @param {object} options          Additional application rendering options
 */
export class DungeonConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dungeon-config",
      classes: ["sheet"],
      template: "modules/dungeon-draw/templates/dungeon-config.html",
      width: 480,
      height: 770,
      tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "position"}]
    });
  }

  /** @override */
  get title() {
    const title = "DD.ConfigTitle";
    return game.i18n.localize(title);
  }

  /** @override */
  getData(options) {
    let config = canvas.dungeon.dungeon?.state().config;
    if (!config) {
      config = Dungeon.defaultConfig();
    }
    const customThemes = this.getCustomThemes();
    const customThemeKeys = Object.keys(customThemes).sort();
    const themeKeys = Object.keys(themes).sort();
    return {
      customThemes,
      customThemeKeys,
      object: config,
      options: this.options,
      themes,
      themeKeys,
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
    canvas.dungeon.dungeon?.setConfig(formData);
  }

  /* -------------------------------------------- */

  /** @override */
  async close(options) {
    await super.close(options);
    if (this.preview) {
      this.preview.removeChildren();
      this.preview = null;
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="resetDefault"]').click(this._onResetDefaults.bind(this));
    html.find('.dd-theme-name').click(this._onThemeNameClick.bind(this));
    html.find('.dd-save-as-theme-button').click(this._onSaveAsThemeClick.bind(this));
    html.find('.dd-theme-delete').click(this._onDeleteThemeClick.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Reset the user Drawing configuration settings to their default values
   * @param {PointerEvent} event      The originating mouse-click event
   * @protected
   */
  _onResetDefaults(event) {
    event.preventDefault();
    canvas.dungeon.dungeon?.setConfig(Dungeon.defaultConfig());
    canvas.dungeon.dungeon.refresh();
    this.render();
  }

  async _onThemeNameClick(event) {
    event.preventDefault();
    const themeRow = $(event.currentTarget).parent(".dd-theme-row");
    const themeKey = themeRow.data("theme");
    const isCustom = themeRow.data("iscustom");
    let theme;
    if (isCustom) {
      const customThemes = this.getCustomThemes();
      theme = customThemes[themeKey];
    } else {
      theme = themes[themeKey];
    }
    const newConfig = {...theme.config};
    await canvas.dungeon.dungeon?.setConfig(newConfig);
    if (game.user.isGM) {
      // need GM privs to update scene
      await canvas.scene.update({
        backgroundColor: newConfig.sceneBackgroundColor,
        gridAlpha: newConfig.sceneGridAlpha,
        gridColor: newConfig.sceneGridColor,
      })
    }
    this.render();
  }

  async _onSaveAsThemeClick(event) {
    event.preventDefault();
    const input = $(event.currentTarget).closest(".form-fields").children(".saveAsThemeName");
    const saveAsThemeName = input.val();
    const formData = this._getSubmitData();
    const customThemes = this.getCustomThemes();
    customThemes[saveAsThemeName] = {
      name: saveAsThemeName,
      config: formData
    };
    this.saveCustomThemes(customThemes);
    canvas.dungeon.dungeon?.setConfig(formData);
    canvas.dungeon.dungeon.refresh();
    this.render();
  }

  async _onDeleteThemeClick(event) {
    event.preventDefault();
    const themeRow = $(event.currentTarget).closest(".dd-theme-row");
    const themeKey = themeRow.data("theme");
    const customThemes = this.getCustomThemes();
    delete customThemes[themeKey];
    this.saveCustomThemes(customThemes);
    this.render();
  }
}
