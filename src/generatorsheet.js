/**
 * Sheet for dungeon generation ettings.
 *
 * @extends {FormApplication}
 */
export class GeneratorSheet extends FormApplication {
  constructor(activeTab = "settings") {
    super();
    this._tabs[0].active = activeTab;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dd-generator-sheet",
      classes: ["sheet"],
      template: "modules/dungeon-draw/templates/generator-sheet.html",
      width: 480,
      height: 800,
      tabs: [
        { navSelector: ".tabs", contentSelector: "form", initial: "position" },
      ],
    });
  }

  /** @override */
  get title() {
    return game.i18n.localize("DD.GeneratorSheetTitle");
  }

  /** @override */
  getData() {
    return {
      height: 20,
      width: 20,
      simplification: 5,
    };
  }

  /* -------------------------------------------- */

  /** @override */
  // TODO: kill this?
  async _updateObject(event, formData) {}

  /* -------------------------------------------- */

  /** @override */
  async close(options) {
    await super.close(options);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="generate"]').click(this.generate.bind(this));
  }

  async generate(event) {
    event.preventDefault();
    const formData = this._getSubmitData();
    await canvas.dungeon.generate(formData);
  }
}
