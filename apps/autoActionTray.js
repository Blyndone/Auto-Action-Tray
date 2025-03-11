const { ApplicationV2 } = foundry.applications.api;
const { api, sheets } = foundry.applications;
import { AbilityTray } from './components/abilityTray.js';
import { CustomTray } from './components/customTray.js';
import { StaticTray } from './components/staticTray.js';
import { ActivityTray } from './components/activityTray.js';
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
    this.selectingActivity = false;
    this.animationDuration = 0.7;

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
    this.targetTray = null; 
    this.currentTrayTemplate = 'AAT.full-tray';

    this.allAbilities = {};

    this.customTrays = [];
    this.staticTrays = [];
    this.activityTray = null;
    this.equipmentTray = null;
    this.skillTray = null;
    this.trayInformation = '';
    this.trayOptions = {
      locked: false,
      skillTrayPage: 0,
      currentTray: 'common',
      fastForward: true,
    };

    this.abilities = new Array(this.totalabilities).fill(null);
    this.init = false;
    Hooks.on('controlToken', this._onControlToken);
    Hooks.on('updateActor', this._onUpdateActor.bind(this));
    Hooks.on('updateItem', this._onUpdateItem.bind(this));
    Hooks.on('dropCanvasData', (canvas, data) => this._onDropCanvas(data));
    Hooks.on('dnd5e.beginConcentrating', (actor) => {
      if (actor == this.actor) this.render(true);
    });
    Hooks.on('dnd5e.endConcentration', (actor) => {
      if (actor == this.actor) this.render(true);
    });

    ui.hotbar.collapse();
    registerHandlebarsHelpers();
  }

  setDefaultTray() {
    this.currentTray = this.customTrays.find((e) => e.id == 'common');

    this.currentTray.active = true;
    this.render();
  }


  setTrayConfig(config) {
    this.actor.setFlag('auto-action-tray', 'config', config);
  }

  getTrayConfig() {
    let data = this.actor.getFlag('auto-action-tray', 'config');
    if (data) {
      return data;
    } else {
      return null;
    }
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
      this.activityTray = ActivityTray.generateActivityTray(this.actor);
      this.setDefaultTray();
      this.meleeWeapon = this.equipmentTray.getMeleeWeapon();
      this.rangedWeapon = this.equipmentTray.getRangedWeapon();
      this.skillTray = SkillTray.generateCustomTrays(this.actor);
      let config = this.getTrayConfig();
      if (config) {
        this.trayOptions = Object.assign({}, this.trayOptions, config);
      } else {
        this.trayOptions = {
          locked: false,
          skillTrayPage: 0,
          currentTray: 'common',
        };
      }
    }
    this.refresh();
  };

  refresh = () => {
    if (this.animating == true || this.actor == null) return;

    // this.currentTray = this.staticTrays.find((e) => e.id == this.currentTray.id)
    //   ? this.staticTrays.find((e) => e.id == this.currentTray.id)
    //   : this.customTrays.find((e) => e.id == this.currentTray.id);
  
    
   
    
    this.currentTray.active = true;
    this.render(true);
  };

  static DEFAULT_OPTIONS = {
    tag: 'div',
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],

    form: {
      handler: AutoActionTray.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    window: {
      frame: false,
      positioned: false,
    },


    actions: {
      openSheet: AutoActionTray.openSheet,
      selectWeapon: AutoActionTray.selectWeapon,
      useItem: AutoActionTray.useItem,
      setTray: AutoActionTray.setTray,
      endTurn: AutoActionTray.endTurn,
      useSkillSave: AutoActionTray.useSkillSave,
      swapSkillTray: AutoActionTray.toggleSkillTrayPage,
      toggleLock: AutoActionTray.toggleLock,
      toggleFastForward: AutoActionTray.toggleFastForward,
      useActivity: ActivityTray.useActivity,
      cancelSelection: ActivityTray.cancelSelection,
    },
  };



  static PARTS = {
    autoActionTray: {
      template: 'modules/auto-action-tray/templates/auto-action-tray.hbs',
      id: 'tray',
    },
  };


  static async myFormHandler(event, form, formData) {

  }


  async _preparePartContext(partId, context) {
    context = {
      partId: `${this.id}-${partId}`,
      actor: this.actor,
      meleeWeapon: this.meleeWeapon,
      rangedWeapon: this.rangedWeapon,
      spells: this.spells,
      consumables: this.consumables,
      abilities: this.abilities,
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
      locked: this.trayOptions['locked'],
      skillTrayPage: this.trayOptions['skillTrayPage'],
      trayOptions: this.trayOptions,
      trayInformation: this.trayInformation,
      activityTray: this.activityTray,
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
    this.actor.unsetFlag('auto-action-tray', 'config');
  }

  static async setTray(event, target) {
    if (this.animating == true || this.selectingActivity == true) return;


    AnimationHandler.animateTrays( target.dataset.id ,this.currentTray.id, this);
  }
  static toggleLock() {
    if(this.selectingActivity) return;
    this.trayOptions['locked'] = !this.trayOptions['locked'];
    this.setTrayConfig({ locked: this.trayOptions['locked'] });
    this.render(true);
  }
  static toggleSkillTrayPage() {
    if(this.selectingActivity) return;
    this.trayOptions['skillTrayPage'] =
      this.trayOptions['skillTrayPage'] == 0 ? 1 : 0;
    this.setTrayConfig({ skillTrayPage: this.trayOptions['skillTrayPage'] });

    this.render(true);
  }
  static toggleFastForward() {
    if(this.selectingActivity) return;
    this.trayOptions['fastForward'] = !this.trayOptions['fastForward'];
    this.setTrayConfig({ fastForward: this.trayOptions['fastForward'] });
    this.render(true);
  }

  static async useItem(event, target) {
    game.tooltip.deactivate();
    let itemId = target.dataset.itemId;
    let item = this.actor.items.get(itemId);
    this.activityTray.getActivities(item, this.actor);
    let selectedSpellLevel, activity;
    let fast = this.trayOptions['fastForward'];
    let skipDialog = { configure: false };
    if (!fast) {
      if (this.activityTray?.abilities?.length > 1) {
        activity = await this.activityTray.selectAbility(
          item,
          this.actor,
          this
        );
        if (activity == null) return;
      } else {
        activity = item.system.activities[0];
      }
      selectedSpellLevel = (selectedSpellLevel) ? activity['selectedSpellLevel'] : '';

    } else {
      activity = item.system.activities.contents[0];
      selectedSpellLevel = this.currentTray.spellLevel;
    }


    item.system.activities.get(activity?.itemId || activity?._id ||item.system.activities.contents[0].id).use(
      { spell: { slot: 'spell' + selectedSpellLevel } },
      skipDialog
    );


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
    return this.isEditable && !this.trayOptions['locked'];
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
