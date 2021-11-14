import { Dungeon } from "./dungeon.js";
import { DungeonDraw } from "./dungeondraw.js";
import { DungeonLayer } from "./dungeonlayer.js";

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
      height: 610,
      tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "position"}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    const title = "DD.ConfigTitle";
    return game.i18n.localize(title);
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    let config = canvas.dungeon.dungeon?.state().config;
    if (!config) {
      config = Dungeon.defaultConfig();
    }
    return {
      object: config,
      options: this.options,
    }
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
}
