const { ApplicationV2 } = foundry.applications.api;
const { api, sheets } = foundry.applications;
import { AbilityTray } from './components/abilityTray.js';
import { CustomTray } from './components/customTray.js';
import { StaticTray } from './components/staticTray.js';
import { ActivityTray } from './components/activityTray.js';
import { EquipmentTray } from './components/equipmentTray.js';
import { SkillTray } from './components/skillTray.js';
import { CombatHandler } from './components/combatHandler.js';
import { registerHandlebarsHelpers } from './helpers/handlebars.js';
import { AnimationHandler } from './helpers/animationHandler.js';
import { DragDropHandler } from './helpers/dragDropHandler.js';
import { DrawSVGPlugin } from '/scripts/greensock/esm/all.js';

export class AutoActionTray extends api.HandlebarsApplicationMixin(
  ApplicationV2
) {
  // Constructor

  constructor(options = {}) {
    gsap.registerPlugin(DrawSVGPlugin);
    super(options);

    this.animating = false;
    this.selectingActivity = false;
    this.animationDuration = 0.7;

    this.totalabilities = 20;

    this.#dragDrop = this.#createDragDropHandlers();
    this.isEditable = true;

    this.actor = null;
    this.meleeWeapon = null;
    this.rangedWeapon = null;

    this.currentTray = null;
    this.targetTray = null;
    this.customTrays = [];
    this.staticTrays = [];
    this.activityTray = null;
    this.equipmentTray = null;
    this.skillTray = null;
    this.skillTray = null;
    this.trayInformation = '';
    this.trayOptions = {
      locked: false,
      skillTrayPage: 0,
      currentTray: 'common',
      fastForward: true,
    };
    this.styleSheet;
    for (let sheet of document.styleSheets) {
      if (
        sheet.href &&
        sheet.href.includes('auto-action-tray/styles/styles.css')
      ) {
        this.styleSheet = sheet;

        break;
      }
    }

    Hooks.on('controlToken', this._onControlToken.bind(this));
    Hooks.on('updateActor', this._onUpdateActor.bind(this));
    Hooks.on('updateItem', this._onUpdateItem.bind(this));
    Hooks.on('dropCanvasData', (canvas, data) => this._onDropCanvas(data));
    Hooks.on('dnd5e.beginConcentrating', (actor) => {
      if (actor == this.actor)
        this.render(this.render({ parts: ['characterImage'] }));
    });
    Hooks.on('dnd5e.endConcentration', (actor) => {
      if (actor == this.actor) this.render({ parts: ['characterImage'] });
    });
    Hooks.on('updateCombat', this._onUpdateCombat.bind(this));
    Hooks.on('deleteCombatant', this._onUpdateCombat.bind(this));
    Hooks.on('createCombatant', this._onUpdateCombat.bind(this));
    Hooks.on('updateCombatant', this._onUpdateCombat.bind(this));
    Hooks.on('deleteCombat', this._onUpdateCombat.bind(this));
    
    ui.hotbar.collapse();
    registerHandlebarsHelpers();
  }

  //#region Hooks
  _onUpdateItem(item, change, options, userId) {
    if (item.actor != this.actor) return;
    this.staticTrays = StaticTray.generateStaticTrays(this.actor);
    this.refresh();
  }

  _onUpdateActor(actor, change, options, userId) {
    if (actor != this.actor) return;
    // if (item.actor != this.actor) return;
    this.staticTrays = StaticTray.generateStaticTrays(this.actor);
    if (this.currentTray instanceof StaticTray) { 
       this.staticTrays.find(e=> e.id == this.currentTray.id).active = true;
    }
    this.render({ parts: ['centerTray'] });
  }
   _onControlToken = (event, controlled) => {
    if (event == null || controlled == false) {
      return;
    }
    if (event.actor != this.actor || this.actor == event) {
      if (this.selectingActivity == true) {
        this.activityTray.rejectActivity(
          new Error('User canceled activity selection')
        );
        this.activityTray.rejectActivity = null;
      }

      this.actor = event.actor ? event.actor : event;
      this.staticTrays = StaticTray.generateStaticTrays(this.actor);
      this.customTrays = CustomTray.generateCustomTrays(this.actor);
      this.equipmentTray = EquipmentTray.generateCustomTrays(this.actor);
      this.activityTray = ActivityTray.generateActivityTray(this.actor);
      this.setDefaultTray();
      this.meleeWeapon = this.equipmentTray.getMeleeWeapon();
      this.rangedWeapon = this.equipmentTray.getRangedWeapon();
      this.skillTray = SkillTray.generateCustomTrays(this.actor);
      this.combatHandler = new CombatHandler(this.actor, this);
      // this.render({ parts: ['endTurn'] });
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
      
      this.render({ parts: ['characterImage', 'centerTray', 'equipmentMiscTray', 'skillTray'] });
    }
  };

  _onUpdateCombat = (event) => {
    if (this.combatHandler == null || this.combatHandler.inCombat == false)
      return;
    this.combatHandler.updateCombat(this.actor, event);
  };

  refresh = () => {
    if (this.animating == true || this.actor == null) return;
    this.currentTray = this.getTray(this.currentTray.id);
    this.currentTray.active = true;
    if (this.combatHandler.inCombat) {
      this.combatHandler.setCombat(this.actor);
    }
    this.render({ parts: ['centerTray'] });
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
      toggleSkillTrayPage: AutoActionTray.toggleSkillTrayPage,
      toggleLock: AutoActionTray.toggleLock,
      toggleFastForward: AutoActionTray.toggleFastForward,
      useActivity: ActivityTray.useActivity,
      cancelSelection: ActivityTray.cancelSelection,
    },
  };

  static PARTS = {
    characterImage: {
      template:
        'modules/auto-action-tray/templates/topParts/character-image.hbs',
      id: 'character-image',
    },
    equipmentMiscTray: {
      template:
        'modules/auto-action-tray/templates/topParts/equipment-misc-tray.hbs',
      id: 'equipment-misc-tray',
    },
    centerTray: {
      template: 'modules/auto-action-tray/templates/topParts/center-tray.hbs',
      id: 'center-tray',
    },
    skillTray: {
      template: 'modules/auto-action-tray/templates/topParts/skill-tray.hbs',
      id: 'skill-tray',
    },
    endTurn: {
      template: 'modules/auto-action-tray/templates/topParts/end-turn.hbs',
      id: 'end-turn',
    },
  };

  static async myFormHandler(event, form, formData) {}

  //#region Rendering
  async _preparePartContext(partId, context) {
    context = {
      partId: `${this.id}-${partId}`,
      actor: this.actor,
      totalabilities: this.totalabilities,
      meleeWeapon: this.meleeWeapon,
      rangedWeapon: this.rangedWeapon,
      currentTray: this.currentTray,
      targetTray: this.targetTray,
      staticTrays: this.staticTrays,
      customTrays: this.customTrays,
      equipmentTray: this.equipmentTray,
      skillTray: this.skillTray,
      locked: this.trayOptions['locked'],
      skillTrayPage: this.trayOptions['skillTrayPage'],
      trayOptions: this.trayOptions,
      trayInformation: this.trayInformation,
      activityTray: this.activityTray,
      combatHandler: this.combatHandler,
    };

    return context;
  }
  //#region Frame Listeners
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
  //#region Actions

  setDefaultTray() {
    this.currentTray = this.customTrays.find((e) => e.id == 'common');

    this.currentTray.active = true;
    // this.render({ parts: ['centerTray'] });
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

  getTray(trayId) {
    return (
      this.staticTrays.find((tray) => tray.id == trayId) ||
      this.customTrays.find((tray) => tray.id == trayId) ||
      [this.activityTray].find((tray) => tray.id == trayId)
    );
  }

  static openSheet(event, target) {
    this.actor.sheet.render(true);
  }

  static async endTurn(event, target) {
    if (this.combatHandler == null) return;
    if (this.combatHandler.combat.current.combatantId =! this.actor.getActiveTokens()[0].combatant._id) {
return}
    this.combatHandler.combat.nextTurn();
    // this.actor.unsetFlag('auto-action-tray', 'data');
    // this.actor.unsetFlag('auto-action-tray', 'config');
  }

  static async setTray(event, target) {
    if (this.animating == true || this.selectingActivity == true) return;

    AnimationHandler.animateTrays(target.dataset.id, this.currentTray.id, this);
  }
  static toggleLock() {
    if (this.selectingActivity) return;
    this.trayOptions['locked'] = !this.trayOptions['locked'];
    this.setTrayConfig({ locked: this.trayOptions['locked'] });
    this.render({ parts:  ['equipmentMiscTray'] });;
  }
  static toggleSkillTrayPage() {
    if (this.selectingActivity) return;
    this.trayOptions['skillTrayPage'] =
      this.trayOptions['skillTrayPage'] == 0 ? 1 : 0;
    this.setTrayConfig({ skillTrayPage: this.trayOptions['skillTrayPage'] });

    this.render({ parts:  ['skillTray'] });
  }
  static toggleFastForward() {
    if (this.selectingActivity) return;
    this.trayOptions['fastForward'] = !this.trayOptions['fastForward'];
    this.setTrayConfig({ fastForward: this.trayOptions['fastForward'] });
    this.render({ parts:  ['equipmentMiscTray'] });
  }

  static async useItem(event, target) {
    game.tooltip.deactivate();
    let itemId = target.dataset.itemId;
    let item = this.actor.items.get(itemId);
    this.activityTray.getActivities(item, this.actor);
    let selectedSpellLevel = null,
      activity = null;

    if (!this.trayOptions['fastForward']) {
      if (this.activityTray?.abilities?.length > 1) {
        activity = await this.activityTray.selectAbility(
          item,
          this.actor,
          this
        );
        selectedSpellLevel = !selectedSpellLevel
          ? activity['selectedSpellLevel']
          : '';
        if (activity == null) return;
      } else {
        activity = item.system.activities[0];
      }
    } else {
      activity = item.system.activities.contents[0];
      selectedSpellLevel = this.currentTray.spellLevel;
    }

    selectedSpellLevel =
      item.system.preparation?.mode == 'pact'
        ? { slot: 'pact' }
        : { slot: 'spell' + selectedSpellLevel };

    item.system.activities
      .get(
        activity?.itemId ||
          activity?._id ||
          item.system.activities.contents[0].id
      )
      .use({ spell: selectedSpellLevel }, { configure: false });
  }

  static useSkillSave(event, target) {
    let type = target.dataset.type;
    let skillsave = target.dataset.skill;
    
    
    let skipDialog = (this.trayOptions['fastForward'])? {fastForward: true} : null;

    if (type == 'skill') {
      this.actor.rollSkill(skillsave, skipDialog);
    } else {
      this.actor.rollAbilitySave(skillsave, skipDialog);
    }
  }
  static selectWeapon(event, target) {
    if (target.classList.contains('selected')) {
      target.classList.remove('selected');
      return;
    }
    target.classList.add('selected');
  }
  //#region DragDrop
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
