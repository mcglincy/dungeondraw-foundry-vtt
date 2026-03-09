import {
  getCustomThemes,
  getThemePainterThemeKey,
  setThemePainterThemeKey,
  themes,
} from "./themes.js";

export class DungeonDrawToolbar extends Application {
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

    // Set up context menus for tools with multiple drawing modes
    this._setupToolContextMenus(html);
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
        {
          name: "gridpainter",
          title: "DD.ButtonTitleGridPainter",
          icon: "fas fa-th",
          isActive: game.activeDungeonDrawTool === "gridpainter",
        },
      ],
      row2: [
        {
          name: "interiorwall",
          title: "DD.ButtonTitleInteriorWall",
          titleSuffix: "DD.RightClickForOptions",
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
          icon: "fas fa-user-secret",
          isActive: game.activeDungeonDrawTool === "secretdoor",
        },
        {
          name: "invisiblewall",
          title: "DD.ButtonTitleInvisibleWall",
          titleSuffix: "DD.RightClickForOptions",
          icon: "fas fa-eye-slash",
          isActive: game.activeDungeonDrawTool === "invisiblewall",
        },
        {
          name: "stairs",
          title: "DD.ButtonTitleStairs",
          icon: "fas fa-stairs",
          isActive: game.activeDungeonDrawTool === "stairs",
        },
        {
          name: "window",
          title: "DD.ButtonTitleWindow",
          icon: "fab fa-microsoft",
          isActive: game.activeDungeonDrawTool === "window",
        },
      ],
      row3: [
        {
          name: "themepainter",
          title: "DD.ButtonTitleThemePainter",
          titleSuffix: "DD.RightClickForOptions",
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
    // Clean up stairs preview state when switching away from stairs tool
    if (game.activeDungeonDrawTool === "stairs" && activeTool !== "stairs") {
      canvas.dungeon?._resetStairsState?.();
    }
    game.activeDungeonDrawTool = activeTool;
    this.updateActiveCss();
  }

  themeSelectChange(event) {
    const themeKey = $(event.currentTarget).val();
    setThemePainterThemeKey(themeKey);
  }

  /** Set up context menus for tools with drawing mode options */
  _setupToolContextMenus(html) {
    const toolbar = this;
    const supportedTools = ["interiorwall", "invisiblewall", "themepainter"];

    // Use custom context menu handler since Foundry's ContextMenu doesn't fit our use case well
    for (const toolName of supportedTools) {
      const toolElement = html.find(`[data-tool="${toolName}"]`);
      if (!toolElement.length) continue;

      toolElement.on("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._showShapeMenu(event, toolName, toolbar);
      });
    }
  }

  /** Show a custom shape selection menu */
  _showShapeMenu(event, tool, toolbar) {
    const toolModes = {
      interiorwall: ["line", "square", "ellipse", "polygon"],
      invisiblewall: ["line", "square", "ellipse", "polygon"],
      themepainter: ["square", "ellipse", "polygon", "grid"],
    };

    const modes = toolModes[tool] || [];

    // Remove any existing menu
    $("#dd-shape-menu").remove();

    // Build menu HTML with inline styles for visibility
    const menuHtml = `
      <nav id="dd-shape-menu" style="
        position: fixed;
        z-index: 10000;
        background: #1a1a1a;
        border: 1px solid #444;
        border-radius: 4px;
        padding: 4px 0;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        min-width: 120px;
      ">
        <ol style="list-style: none; margin: 0; padding: 0;">
          ${modes
            .map(
              (mode) => `
            <li class="dd-shape-menu-item" data-mode="${mode}" style="
              padding: 6px 12px;
              cursor: pointer;
              color: #eee;
              display: flex;
              align-items: center;
              gap: 8px;
            ">
              ${this._getShapeIcon(mode)}
              ${game.i18n.localize(
                `DD.DrawMode.${mode.charAt(0).toUpperCase() + mode.slice(1)}`
              )}
            </li>
          `
            )
            .join("")}
        </ol>
      </nav>
    `;

    // Add menu to body
    const menu = $(menuHtml).appendTo(document.body);

    // Position near the click
    menu.css({
      left: event.clientX + "px",
      top: event.clientY + "px",
    });

    // Add hover effect
    menu
      .find(".dd-shape-menu-item")
      .on("mouseenter", function () {
        $(this).css("background", "#333");
      })
      .on("mouseleave", function () {
        $(this).css("background", "transparent");
      });

    // Handle menu item clicks
    menu.find(".dd-shape-menu-item").on("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mode = $(e.currentTarget).data("mode");
      // Defensive check for game.dungeonDrawShapes
      if (!game.dungeonDrawShapes) game.dungeonDrawShapes = {};
      game.dungeonDrawShapes[tool] = mode;
      game.activeDungeonDrawTool = tool;
      toolbar.updateActiveCss();
      menu.remove();
    });

    // Close menu when clicking elsewhere using capture phase for reliable detection
    const closeHandler = (e) => {
      if (!$(e.target).closest("#dd-shape-menu").length) {
        menu.remove();
        document.removeEventListener("mousedown", closeHandler, true);
        document.removeEventListener("contextmenu", closeHandler, true);
      }
    };
    document.addEventListener("mousedown", closeHandler, true);
    document.addEventListener("contextmenu", closeHandler, true);
  }

  /** Get FontAwesome icon for a shape mode */
  _getShapeIcon(mode) {
    const icons = {
      line: '<i class="fas fa-minus"></i>',
      square: '<i class="fas fa-square"></i>',
      ellipse: '<i class="fas fa-circle"></i>',
      polygon: '<i class="fas fa-draw-polygon"></i>',
      grid: '<i class="fas fa-th"></i>',
    };
    return icons[mode] || "";
  }
}
