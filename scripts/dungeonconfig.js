import { DungeonDraw } from "./dungeondraw.js";
import { DungeonLayer } from "./dungeonlayer.js";

/**
 * The Application responsible for configuring a single Dungeon document within a parent Scene.
 * @extends {FormApplication}
 *
 * @param {Dungeon} dungeon         The Dungeon object being configured
 * @param {object} options          Additional application rendering options
 * @param {boolean} [options.configureDefault=false]  Configure the default dungeonsettings, instead of a specific Dungeon
 * @param {boolean} [options.preview]  Configure a preview version of the Dungeon which is not yet saved
 */
export class DungeonConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dungeon-config",
      classes: ["sheet"],
      template: "modules/dungeon-draw/templates/dungeon-config.html",
      width: 480,
      height: 360,
      configureDefault: false,
      tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "position"}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    const title = this.options.configureDefault ? "DD.ConfigDefaultTitle" : "DD.ConfigTitle";
    return game.i18n.localize(title);
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    const author = game.users.get(this.object.data.author);

    // Submit text
    let submit;
    if ( this.options.configureDefault ) {
      submit = "DD.SubmitDefault";
    } else {
      submit = this.options.preview ? "DD.SubmitCreate" : "DD.SubmitUpdate";
    }

    // Return data
    return {
      author: author ? author.name : "",
      isDefault: this.options.configureDefault,
      object: this.object.toJSON(),
      options: this.options,
      submitText: submit
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    if (!this.object.isOwner) {
      throw new Error("You do not have the ability to configure this Dungeon object.");
    }

    // Configure the default Dungeon settings
    if (this.options.configureDefault) {
      formData.author = game.user.id;
      const newDefault = new DungeonDocument(formData);
      return game.settings.set("dungeondraw", DungeonLayer.DEFAULT_CONFIG_SETTING, newDefault.toJSON());
    }

    // Create or update a Drawing
    if (this.object.id) {
      return this.object.update(formData);
    }
    return this.object.constructor.create(formData);
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
    game.settings.set(DungeonDraw.MODULE_NAME, DungeonLayer.DEFAULT_CONFIG_SETTING, {});
    const defaultValues = new DungeonData(canvas.dungeon._getNewDungeonData({})).toJSON();
    this.object.data.update(defaultValues);
    this.render();
  }
}
