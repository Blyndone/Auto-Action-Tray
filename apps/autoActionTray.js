const { ApplicationV2 } = foundry.applications.api;
const { api, sheets } = foundry.applications;
import { AbilityTray } from './components/abilityTray.js';
import { CustomTray } from './components/customTray.js';
import { StaticTray } from './components/staticTray.js';
import { EquipmentTray } from './components/equipmentTray.js';
import { SkillTray } from './components/skillTray.js';
import { registerHandlebarsHelpers } from './helpers/handlebars.js';
import { AnimationHandler } from './helpers/animationHandler.js';
import { DragDropHandler } from './helpers/dragDropHandler.js';

export class AutoActionTray extends api.HandlebarsApplicationMixin(
  ApplicationV2
) {
  // Constructor

  constructor(options = {}) {
    super(options);

    this.animating = false;
    this.animationDuration = 0.8;

    this.abilityHeight = 2;

    this.section1Width = 4;
    this.section2Width = 4;
    this.section3Width = 2;
    this.abilityHeight = 2;

    this.section1Total = this.section1Width * this.abilityHeight;
    this.section2Total = this.section2Width * this.abilityHeight;
    this.section3Total = this.section3Width * this.abilityHeight;

    this.section1End = this.section1Total;
    this.section2End = this.section1End + this.section2Total;
    this.section3End = this.section2End + this.section3Total;

    this.totalabilities =
      this.section1Total + this.section2Total + this.section3Total;

    this.section1Px = this.section1Width * 78;
    this.section2Px = this.section2Width * 78;
    this.section3Px = this.section3Width * 78;
    this.totalWidthPx = (this.totalabilities / this.abilityHeight) * 78;
    this.#dragDrop = this.#createDragDropHandlers();

    this.isEditable = true;

    this.actor = null;
    this.meleeWeapon = null;
    this.rangedWeapon = null;

    this.currentTray = null;
    this.currentCustomTray = null;
    this.currentStaticTray = null;

    this.currentTrayTemplate = 'AAT.full-tray';

    this.allAbilities = {};

    this.customTrays = [];
    this.staticTrays = [];
    this.equipmentTray = null;
    this.skillTray = null;

    this.abilities = new Array(this.totalabilities).fill(null);
    this.init = false;
    Hooks.on('controlToken', this._onControlToken);
    Hooks.on('updateActor', this._onUpdateActor.bind(this));
    Hooks.on('updateItem', this._onUpdateItem.bind(this));
    Hooks.on('dropCanvasData', (canvas, data) => this._onDropCanvas(data));

    ui.hotbar.collapse();
    registerHandlebarsHelpers();
  }

  setDefaultTray() {
    this.currentTray = this.customTrays.find((e) => e.id == 'common');
    // this.abilities = this.currentTray.getAbilities();
    this.currentTray.active = true;
    this.render();
  }
  //
  // locked: Boolean
  // skillTrayPage: 1, 2
  
  setTrayConfig({config}) { 
    this.actor.setFlag('auto-action-tray', 'config', {config});
  }

  getTrayConfig() { 
    return this.actor.getFlag('auto-action-tray', 'config');
  }

  _onUpdateItem(item, change, options, userId) {
    if (item.actor != this.actor) return;
    this.staticTrays = StaticTray.generateStaticTrays(this.actor);
    this.refresh();
  }

  _onUpdateActor(actor, change, options, userId) {
    if (actor != this.actor) return;
    // if (item.actor != this.actor) return;
    this.staticTrays = StaticTray.generateStaticTrays(this.actor);
    this.refresh();
  }
  _onControlToken = (event, controlled) => {
    if (event == null || controlled == false) {
      return;
    }
    if (event.actor != this.actor || this.actor == event) {
      this.actor = event.actor ? event.actor : event;
      this.staticTrays = StaticTray.generateStaticTrays(this.actor);
      this.customTrays = CustomTray.generateCustomTrays(this.actor);
      this.equipmentTray = EquipmentTray.generateCustomTrays(this.actor);
      this.setDefaultTray();
      this.meleeWeapon = this.equipmentTray.getMeleeWeapon();
      this.rangedWeapon = this.equipmentTray.getRangedWeapon();
      this.skillTray = SkillTray.generateCustomTrays(this.actor);
    }
    this.refresh();
  };

  refresh = () => {
    if (this.animating == true || this.actor == null) return;

    this.currentTray = this.staticTrays.find((e) => e.id == this.currentTray.id)
      ? this.staticTrays.find((e) => e.id == this.currentTray.id)
      : this.customTrays.find((e) => e.id == this.currentTray.id);
    // this.abilities = this.currentTray.getAbilities();
    this.currentTray.active = true;
    this.render(true);
  };

  static DEFAULT_OPTIONS = {
    tag: 'div',
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],
    // dragDrop: [{ dragSelector: '.item-button', dropSelector: null }],
    form: {
      handler: AutoActionTray.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    window: {
      frame: false,
      positioned: false,
    },

    // position: { width: 1500, height: 250, top: 1000, zIndex: 1000 },
    actions: {
      openSheet: AutoActionTray.openSheet,
      selectWeapon: AutoActionTray.selectWeapon,
      useItem: AutoActionTray.useItem,
      setTray: AutoActionTray.setTray,
      endTurn: AutoActionTray.endTurn,
      useSkillSave: AutoActionTray.useSkillSave,
      swapSkillTray: AutoActionTray.swapSkillTray,
    },
  };

  /**
   * @typedef {Object} HandlebarsTemplatePart
   * @property {string} template                      The template entry-point for the part
   * @property {string} [id]                          A CSS id to assign to the top-level element of the rendered part.
   *                                                  This id string is automatically prefixed by the application id.
   * @property {string[]} [classes]                   An array of CSS classes to apply to the top-level element of the
   *                                                  rendered part.
   * @property {string[]} [templates]                 An array of templates that are required to render the part.
   *                                                  If omitted, only the entry-point is inferred as required.
   * @property {string[]} [scrollable]                An array of selectors within this part whose scroll positions should
   *                                                  be persisted during a re-render operation. A blank string is used
   *                                                  to denote that the root level of the part is scrollable.
   * @property {Record<string, ApplicationFormConfiguration>} [forms]  A registry of forms selectors and submission handlers.
   */

  static PARTS = {
    autoActionTray: {
      template: 'modules/auto-action-tray/templates/auto-action-tray.hbs',
      id: 'tray',
    },
  };

  /**
   * Process form submission for the sheet
   * @this {AutoActionTray}                      The handler is called with the application as its bound scope
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @returns {Promise<void>}
   */
  static async myFormHandler(event, form, formData) {
    // Do things with the returned FormData
  }

  /**
   * Prepare context that is specific to only a single rendered part.
   *
   * It is recommended to augment or mutate the shared context so that downstream methods like _onRender have
   * visibility into the data that was used for rendering. It is acceptable to return a different context object
   * rather than mutating the shared context at the expense of this transparency.
   *
   * @param {string} partId                         The part being rendered
   * @param {ApplicationRenderContext} context      Shared context provided by _prepareContext
   * @returns {Promise<ApplicationRenderContext>}   Context data for a specific part
   * @protected
   */
  async _preparePartContext(partId, context) {
    context = {
      partId: `${this.id}-${partId}`,
      actor: this.actor,
      meleeWeapon: this.meleeWeapon,
      rangedWeapon: this.rangedWeapon,
      spells: this.spells,
      consumables: this.consumables,
      abilities: this.abilities,
      // section1: this.section1,
      // section2: this.section2,
      // section3: this.section3,
      section1Px: this.section1Px,
      section2Px: this.section2Px,
      section3Px: this.section3Px,
      totalWidthPx: this.totalWidthPx,
      section1Total: this.section1Total,
      section2Total: this.section2Total,
      section3Total: this.section3Total,
      section1End: this.section1End,
      section2End: this.section2End,
      section3End: this.section3End,
      totalabilities: this.totalabilities,
      currentTrayTemplate: this.currentTrayTemplate,
      currentTray: this.currentTray,
      targetTray: this.targetTray,
      allAbilities: this.allAbilities,
      staticTrays: this.staticTrays,
      staticTray: this.staticTray,
      customTrays: this.customTrays,
      equipmentTray: this.equipmentTray,
      skillTray: this.skillTray,
    };

    return context;
  }

  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
  }

  _attachFrameListeners() {
    super._attachFrameListeners();

    let itemContextMenu = [
      {
        name: 'DND5E.ItemView',
        icon: '<i class="fas fa-eye"></i>',
        callback: (li) => {
          this._onAction(li[0], 'view');
        },
      },
      {
        name: 'Remove',
        icon: "<i class='fas fa-trash fa-fw'></i>",
        callback: (li) => this._onAction(li[0], 'remove'),
      },
    ];

    let characterContextMenu = [
      {
        name: 'View Sheet',
        icon: '<i class="fas fa-eye"></i>',
        callback: () => {
          this.actor.sheet.render(true);
        },
      },

      {
        name: 'Reset Data',
        icon: '<i class="fa-solid fa-delete-right"></i>',
        callback: (li) => {
          this.actor.unsetFlag('auto-action-tray', 'data');
          this.refresh();
        },
      },
    ];
    new ContextMenu(this.element, '.character-image', characterContextMenu, {
      onOpen: this._onOpenContextMenu(),
      jQuery: true,
      _expandUp: true,
    });

    new ContextMenu(this.element, '.ability-button', itemContextMenu, {
      onOpen: this._onOpenContextMenu(),
      jQuery: true,
    });
  }

  _onOpenContextMenu(event) {
    return;
  }

  _onAction(li, action) {
    // console.log(li, action, li.dataset.itemId)

    switch (action) {
      case 'view':
        this.actor.items.get(li.dataset.itemId).sheet.render(true);
        break;
      // case "edit":
      //   this.actor.items.get(li.dataset.itemId).sheet.render(true);
      //   break;
      case 'remove':
        // //CHANGE THIS TO USE THE CURRENT TRAY
        this.currentTray.abilities[li.dataset.index] = null;
        // this.abilities[li.dataset.index] = null;
        // this.setAbilities();
        this.render(true);
        break;
    }
  }

  static openSheet(event, target) {
    this.actor.sheet.render(true);
  }

  static async endTurn(event, target) {
    this.actor.unsetFlag('auto-action-tray', 'data');
  }

  static async setTray(event, target) {
    if (this.animating == true) return;

    this.targetTray = this.staticTrays.find((e) => e.id == target.dataset.id)
      ? this.staticTrays.find((e) => e.id == target.dataset.id)
      : this.customTrays.find((e) => e.id == target.dataset.id);
    this.targetTray.active = true;
    this.currentTray.active = true;

    if (this.currentTray == this.targetTray) return;

    await this.render(true);
    AnimationHandler.animateSwapTrays(this.targetTray, this.currentTray, this);
  }

  static swapSkillTray() {
 
    this.skillTray.swapSkillTrays();
    this.render(true);
  }

  static async useItem(event, target) {
    game.tooltip.deactivate();
    let itemId = target.dataset.itemId;
    let item = this.actor.items.get(itemId);
    await item.use();
  }

  static useSkillSave(event, target) {
    let type = target.dataset.type;
    let skillsave = target.dataset.skill;
    if (type == 'skill') {
      this.actor.rollSkill(skillsave);
    } else {
      this.actor.rollAbilitySave(skillsave);
    }
  }
  static selectWeapon(event, target) {
    if (target.classList.contains('selected')) {
      target.classList.remove('selected');
      return;
    }
    target.classList.add('selected');
  }

  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      };
      return new DragDrop(d);
    });
  }

  #dragDrop;

  get dragDrop() {
    return this.#dragDrop;
  }

  _onRender(context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element));
  }

  _canDragStart(selector) {
    return this.isEditable;
  }

  _canDragDrop(selector) {
    return this.isEditable;
  }

  _onDragStart(event) {
    DragDropHandler._onDragStart(event, this);
  }

  _onDragOver(event) {
    DragDropHandler._onDragOver(event, this);
  }

  async _onDrop(event) {
    DragDropHandler._onDrop(event, this);
  }
  _onDropCanvas(data) {
    DragDropHandler._onDropCanvas(data, this);
  }
}
