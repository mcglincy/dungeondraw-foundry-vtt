import {
  getCustomThemes,
  getThemePainterThemeKey,
  setThemePainterThemeKey,
  themes,
} from "./themes.js";

export class Toolbar extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dd-toolbar",
      // classes: ["sheet"],
      popOut: false,
      template: "modules/dungeon-draw/templates/toolbar.html",
      // width: 480,
      // height: 500,
      // tabs: [
      //   { navSelector: ".tabs", contentSelector: "form", initial: "position" },
      // ],
    });
  }

  constructor() {
    super();
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".addremove-toggle").click(this.addRemoveClick.bind(this));
    html
      .find('select[name="themePainterThemeKey"]')
      .change(this.themeSelectChange.bind(this));
    html.find(".control-tool").click(this.controlToolClick.bind(this));
    html
      .find('select[name="themePainterThemeKey"]')
      .change(this.themeSelectChange.bind(this));
  }

  /** @override */
  getData() {
    const customThemes = getCustomThemes();
    const customThemeKeys = Object.keys(customThemes).sort();
    const themeKeys = Object.keys(themes).sort();
    const themePainterThemeKey = getThemePainterThemeKey();
    const toggleAddClass =
      game.activeDungeonDrawMode === "add" ? "toggle-on" : "";
    const toggleRemoveClass =
      game.activeDungeonDrawMode === "remove" ? "toggle-on" : "";

    const data = {
      customThemes,
      customThemeKeys,
      row1: [
        {
          name: "rectangle",
          title: "DD.ButtonTitleRectangle",
          icon: "fas fa-square",
          class: "add",
          isActive: game.activeDungeonDrawTool === "rectangle",
        },
        {
          name: "polygon",
          title: "DD.ButtonTitlePolygon",
          icon: "fas fa-draw-polygon",
          isActive: game.activeDungeonDrawTool === "polygon",
        },
        {
          name: "ellipse",
          title: "DD.ButtonTitleEllipse",
          icon: "fas fa-circle",
          isActive: game.activeDungeonDrawTool === "ellipse",
        },
        {
          name: "freehand",
          title: "DD.ButtonTitleFreehand",
          icon: "fas fa-signature",
          isActive: game.activeDungeonDrawTool === "freehand",
        },
      ],
      row2: [
        {
          name: "interiorwall",
          title: "DD.ButtonTitleInteriorWall",
          icon: "fas fa-bars",
          isActive: game.activeDungeonDrawTool === "interiorwall",
        },
        {
          name: "door",
          title: "DD.ButtonTitleDoor",
          icon: "fas fa-door-open",
          isActive: game.activeDungeonDrawTool === "door",
        },
        {
          name: "secretdoor",
          title: "DD.ButtonTitleSecretDoor",
          icon: "fas fa-mask",
          isActive: game.activeDungeonDrawTool === "secretdoor",
        },
      ],
      row3: [
        {
          name: "themepainter",
          title: "DD.ButtonTitleThemePainter",
          icon: "fas fa-brush",
          isActive: game.activeDungeonDrawTool === "themepainter",
        },
      ],
      themeKeys,
      themePainterThemeKey,
      themes,
      toggleAddClass,
      toggleRemoveClass,
    };
    return data;
  }

  render(force = false, options = {}) {
    super.render(force, options);
  }

  updateActiveCss() {
    this._element.find(".control-tool").removeClass("active");
    this._element
      .find(`[data-tool='${game.activeDungeonDrawTool}']`)
      .addClass("active");
  }

  addRemoveClick(event) {
    game.activeDungeonDrawMode = $(event.target).data("addremove");
    this._element.find(".addremove-toggle").removeClass("toggle-on");
    $(event.currentTarget).addClass("toggle-on");
  }

  controlToolClick(event) {
    const activeTool = $(event.currentTarget).data("tool");
    game.activeDungeonDrawTool = activeTool;
    this.updateActiveCss();
  }

  themeSelectChange(event) {
    const themeKey = $(event.currentTarget).val();
    setThemePainterThemeKey(themeKey);
  }
}
