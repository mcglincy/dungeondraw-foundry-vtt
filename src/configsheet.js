import { Settings } from "./settings.js";
import {
  defaultConfig,
  getCustomThemes,
  getThemePainterThemeKey,
  setCustomThemes,
  setThemePainterThemeKey,
  themes,
} from "./themes.js";
import { ThemeSheet } from "./themesheet.js";

/**
 * Sheet for dungeon config/settings.
 *
 * @extends {FormApplication}
 */
export class ConfigSheet extends FormApplication {
  constructor(activeTab = "settings") {
    super();
    this._tabs[0].active = activeTab;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dd-config-sheet",
      classes: ["sheet"],
      template: "modules/dungeon-draw/templates/config-sheet.html",
      width: 480,
      height: Settings.threeDCanvasEnabled() ? 1220 : 1100,
      tabs: [
        { navSelector: ".tabs", contentSelector: "form", initial: "position" },
      ],
    });
  }

  /** @override */
  get title() {
    return game.i18n.localize("DD.ConfigSheetTitle");
  }

  /** @override */
  getData() {
    let config = canvas.dungeon.dungeon?.state().config;
    if (!config) {
      config = defaultConfig();
    }
    const customThemes = getCustomThemes();
    const customThemeKeys = Object.keys(customThemes).sort();
    const themeKeys = Object.keys(themes).sort();
    const themePainterThemeKey = getThemePainterThemeKey();
    const threeDCanvasEnabled = Settings.threeDCanvasEnabled();
    console.log("**** getData");
    console.log(config);
    return {
      config,
      customThemes,
      customThemeKeys,
      themes,
      themeKeys,
      themePainterThemeKey,
      threeDCanvasEnabled,
    };
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    // TODO: handle customThemeName vs. config better
    delete formData.customThemeName;
    delete formData.themePainterTheme;
    console.log("_updateObject");
    console.log(formData);
    canvas.dungeon.dungeon?.setConfig(formData);
    if (game.user.isGM) {
      // need GM privs to update scene
      await canvas.scene.update({
        backgroundColor: formData.sceneBackgroundColor,
        gridAlpha: formData.sceneGridAlpha,
        gridColor: formData.sceneGridColor,
      });
    }
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
    html
      .find('button[name="resetDefault"]')
      .click(this._onResetDefaults.bind(this));
    html.find(".dd-theme-name").click(this._onThemeNameClick.bind(this));
    html
      .find(".dd-save-as-theme-button")
      .click(this._onSaveAsThemeClick.bind(this));
    html.find(".dd-theme-edit").click(this._onEditThemeClick.bind(this));
    html.find(".dd-theme-copy").click(this._onCopyThemeClick.bind(this));
    html.find(".dd-theme-delete").click(this._onDeleteThemeClick.bind(this));
    html
      .find('select[name="themePainterThemeKey"]')
      .change(this._onThemePainterThemeSelect.bind(this));
    html
      .find(".dd-export-themes-button")
      .click(this._onExportThemesClick.bind(this));
    html
      .find(".dd-import-themes-button")
      .click(this._onImportThemesClick.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Reset the user Drawing configuration settings to their default values
   * @param {PointerEvent} event      The originating mouse-click event
   * @protected
   */
  _onResetDefaults(event) {
    event.preventDefault();
    canvas.dungeon.dungeon?.setConfig(defaultConfig());
    canvas.dungeon.dungeon.refresh();
    this.render();
  }

  async _onThemeNameClick(event) {
    event.preventDefault();
    const themeRow = $(event.currentTarget).parent(".dd-theme-row");
    const themeKey = themeRow.data("theme");
    const isCustom = themeRow.data("themetype") === "custom";
    let theme;
    if (isCustom) {
      const customThemes = getCustomThemes();
      theme = customThemes[themeKey];
    } else {
      theme = themes[themeKey];
    }
    const newConfig = { ...theme.config };
    await canvas.dungeon.dungeon?.setConfig(newConfig);
    if (game.user.isGM) {
      // need GM privs to update scene
      await canvas.scene.update({
        backgroundColor: newConfig.sceneBackgroundColor,
        gridAlpha: newConfig.sceneGridAlpha,
        gridColor: newConfig.sceneGridColor,
      });
    }
    this.render();
  }

  async _onSaveAsThemeClick(event) {
    event.preventDefault();
    const input = $(event.currentTarget)
      .closest(".form-fields")
      .children(".saveAsThemeName");
    const saveAsThemeName = input.val();
    const formData = this._getSubmitData();
    // TODO: handle saveAsThemeName better
    delete formData.saveAsThemeName;
    delete formData.themePainterThemeKey;
    const customThemes = getCustomThemes();
    customThemes[saveAsThemeName] = {
      name: saveAsThemeName,
      config: formData,
    };
    setCustomThemes(customThemes);
    this._tabs[0].active = "themes";
    this.render();
  }

  async _onEditThemeClick(event) {
    event.preventDefault();
    const themeRow = $(event.currentTarget).closest(".dd-theme-row");
    const themeKey = themeRow.data("theme");
    new ThemeSheet(themeKey).render(true);
  }

  _onCopyThemeClick(event) {
    event.preventDefault();
    const themeRow = $(event.currentTarget).closest(".dd-theme-row");
    const themeKey = themeRow.data("theme");
    const customThemes = getCustomThemes();
    const oldTheme = customThemes[themeKey];
    const newTheme = JSON.parse(JSON.stringify(oldTheme));
    // deal with possible name collisions
    let num = 1;
    let newName;
    let done = false;
    while (!done) {
      newName = `${oldTheme.name} (${num})`;
      if (newName in customThemes) {
        num++;
      } else {
        done = true;
      }
    }
    newTheme.name = newName;
    customThemes[newName] = newTheme;
    setCustomThemes(customThemes);
    this.render();
  }

  _onDeleteThemeClick(event) {
    event.preventDefault();
    const themeRow = $(event.currentTarget).closest(".dd-theme-row");
    const themeKey = themeRow.data("theme");
    const customThemes = getCustomThemes();
    delete customThemes[themeKey];
    setCustomThemes(customThemes);
    this.render();
  }

  _onExportThemesClick(event) {
    event.preventDefault();
    const customThemesString = JSON.stringify(getCustomThemes(), null, 2);
    saveDataToFile(
      customThemesString,
      "application/json",
      "dd-custom-themes.json"
    );
  }

  async _onImportThemesClick(event) {
    event.preventDefault();
    // this Dialog based on Foundry's importFromJSONDialog()
    new Dialog(
      {
        title: game.i18n.localize("DD.ImportCustomThemes"),
        content: await renderTemplate("templates/apps/import-data.html", {
          hint1: game.i18n.localize("DD.ImportCustomThemesHint"),
        }),
        buttons: {
          import: {
            icon: '<i class="fas fa-file-import"></i>',
            label: game.i18n.localize("DD.Import"),
            callback: (html) => {
              const form = html.find("form")[0];
              if (!form.data.files.length) {
                return ui.notifications.error(
                  "You did not upload a data file!"
                );
              }
              readTextFromFile(form.data.files[0]).then((text) => {
                const json = JSON.parse(text);
                setCustomThemes(json);
                this.render();
              });
            },
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("DD.Cancel"),
          },
        },
        default: "import",
      },
      {
        width: 400,
      }
    ).render(true);
  }

  _onThemePainterThemeSelect(event) {
    const themeKey = $(event.currentTarget).val();
    setThemePainterThemeKey(themeKey);
  }
}
