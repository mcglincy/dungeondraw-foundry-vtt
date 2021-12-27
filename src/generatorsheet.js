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
      height: 30,
      width: 30,

      // 2d-dungeon
      centerExits: false,
      circularPaths: false,
      generate2DDungeonDoors: true,
      maxRoomSize: 7,
      minRoomSize: 3,
      roomCount: 15,

      // dungeoneer
      generateDungeoneerDoors: true,

      // rot-js-cellular
      connectCaves: true,
      smoothing: 0,
    };
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="generate"]').click(this.generate.bind(this));
    html
      .find('select[name="algorithm"]')
      .change(this.changeAlgorithm.bind(this));
    this.changeAlgorithm();
  }

  async changeAlgorithm(event) {
    event?.preventDefault();
    const formData = this._getSubmitData();
    const algClass = `.${formData.algorithm}`;
    $(".alg-fields").filter(algClass).show();
    $(".alg-fields").not(algClass).hide();
  }

  async generate(event) {
    event.preventDefault();
    const formData = this._getSubmitData();
    console.log(formData);
    await canvas.dungeon.generate(formData);
  }
}
