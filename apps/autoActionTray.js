const { ApplicationV2 } = foundry.applications.api
const { api, sheets } = foundry.applications
import { AbilityTray } from './components/abilityTray.js'
import { CustomTray } from './components/customTray.js'
import { StaticTray } from './components/staticTray.js'
import { CustomStaticTray } from './components/customStaticTray.js'
import { ActivityTray } from './components/activityTray.js'
import { EquipmentTray } from './components/equipmentTray.js'
import { SkillTray } from './components/skillTray.js'
import { CombatHandler } from './components/combatHandler.js'
import { registerHandlebarsHelpers } from './helpers/handlebars.js'
import { AnimationHandler } from './helpers/animationHandler.js'
import { DragDropHandler } from './helpers/dragDropHandler.js'
import { DrawSVGPlugin, Draggable } from '/scripts/greensock/esm/all.js'
import { TrayConfig } from './helpers/trayConfig.js'
import { Actions } from './helpers/actions.js'
import { EffectTray } from './components/effectTray.js'

export class AutoActionTray extends api.HandlebarsApplicationMixin(ApplicationV2) {
  // Constructor

  constructor(options = {}) {
    gsap.registerPlugin(DrawSVGPlugin)
    super(options)
    this.enabled = true
    this.debugtime = 0

    this.animating = false
    this.selectingActivity = false
    this.animationDuration = 0.7

    this.#dragDrop = this.#createDragDropHandlers()
    this.isEditable = true

    this.actor = null

    this.meleeWeapon = null
    this.rangedWeapon = null
    this.hpTextActive = false
    this.actorHealthPercent = 100
    this.currentTray = null
    this.targetTray = null
    this.customTrays = []
    this.staticTrays = []
    this.activityTray = null
    this.equipmentTray = null
    this.skillTray = null
    this.effectsTray = new EffectTray()

    this.itemSelectorEnabled = false
    this.currentDice = 0
    this.dice = ['20', '12', '10', '8', '6', '4']
    this.trayInformation = ''
    this.trayOptions = {
      locked: false,
      skillTrayPage: 0,
      currentTray: 'common',
      fastForward: true,
      imageType: 'portrait',
      imageScale: 1,
      imageX: 0,
      imageY: 0,
      healthIndicator: true,
      concentrationColor: '#ff0000',
      customStaticTrays: [],
      autoAddItems: true,
    }

    let rowCount = 2
    let columnCount = 10
    let iconSize = 75
    this.styleSheet
    for (let sheet of document.styleSheets) {
      if (sheet.href && sheet.href.includes('auto-action-tray/styles/styles.css')) {
        this.styleSheet = sheet
        break
      }

      if (game.settings.get('auto-action-tray', 'iconSize')) {
        iconSize = game.settings.get('auto-action-tray', 'iconSize')
        document.documentElement.style.setProperty('--item-size', iconSize + 'px')
        document.documentElement.style.setProperty('--text-scale-ratio', iconSize / 75)
      }
      if (game.settings.get('auto-action-tray', 'rowCount')) {
        rowCount = game.settings.get('auto-action-tray', 'rowCount')
        document.documentElement.style.setProperty('--item-tray-item-height-count', rowCount)
      }
      if (game.settings.get('auto-action-tray', 'columnCount')) {
        columnCount = game.settings.get('auto-action-tray', 'columnCount')
        document.documentElement.style.setProperty('--item-tray-item-width-count', columnCount)
      }

      this.totalabilities = rowCount * columnCount
    }

    Hooks.on('controlToken', this._onControlToken.bind(this))
    Hooks.on('updateActor', this._onUpdateActor.bind(this))
    Hooks.on('updateItem', this._onUpdateItem.bind(this))
    Hooks.on('dropCanvasData', (canvas, data) => this._onDropCanvas(data))
    Hooks.on('dnd5e.beginConcentrating', (actor) => {
      if (actor == this.actor) this.render(this.render({ parts: ['characterImage'] }))
    })
    Hooks.on('dnd5e.endConcentration', (actor) => {
      if (actor == this.actor) this.render({ parts: ['characterImage'] })
    })
    Hooks.on('updateCombat', this._onUpdateCombat.bind(this))
    Hooks.on('deleteCombatant', this._onUpdateCombat.bind(this))
    Hooks.on('createCombatant', this._onUpdateCombat.bind(this))
    Hooks.on('updateCombatant', this._onUpdateCombat.bind(this))
    Hooks.on('deleteCombat', this._onUpdateCombat.bind(this))
    Hooks.on('createItem', CustomTray._onCreateItem.bind(this))
    Hooks.on('deleteItem', CustomTray._onDeleteItem.bind(this))
    Hooks.on('createActiveEffect', this._onCreateActiveEffect.bind(this))
    Hooks.on('deleteActiveEffect', this._onDeleteActiveEffect.bind(this))
    Hooks.on('updateActiveEffect', this._onUpdateActiveEffect.bind(this))
    Hooks.on('renderHotbar', () => {})

    ui.hotbar.collapse()

    registerHandlebarsHelpers()
    if (!game.user.isGM) {
      this.actor = canvas.tokens.controlled[0].actor

      this.initialTraySetup(this.actor)
    }
  }

  static DEFAULT_OPTIONS = {
    tag: 'form',
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],
    form: {
      handler: AutoActionTray.myFormHandler,
      submitOnChange: true,
      closeOnSubmit: false,
      id: 'AutoActionTray',
    },
    window: {
      frame: false,
      positioned: false,
    },

    actions: {
      openSheet: AutoActionTray.openSheet,
      selectWeapon: AutoActionTray.selectWeapon,
      useItem: AutoActionTray.useItem,
      viewItem: AutoActionTray.viewItem,
      setTray: AutoActionTray.setTray,
      endTurn: AutoActionTray.endTurn,
      useSkillSave: AutoActionTray.useSkillSave,
      toggleSkillTrayPage: AutoActionTray.toggleSkillTrayPage,
      toggleLock: AutoActionTray.toggleLock,
      toggleFastForward: AutoActionTray.toggleFastForward,
      minimizeTray: AutoActionTray.minimizeTray,
      toggleItemSelector: AutoActionTray.toggleItemSelector,
      trayConfig: AutoActionTray.trayConfig,
      toggleHpText: AutoActionTray.toggleHpText,
      useActivity: ActivityTray.useActivity,
      cancelSelection: ActivityTray.cancelSelection,
      useSlot: ActivityTray.useSlot,
      rollD20: AutoActionTray.rollDice,
    },
  }

  static PARTS = {
    characterImage: {
      template: 'modules/auto-action-tray/templates/topParts/character-image.hbs',
      id: 'character-image',
      forms: {
        '.hpinput': AutoActionTray.myFormHandler,
      },
    },
    equipmentMiscTray: {
      template: 'modules/auto-action-tray/templates/topParts/equipment-misc-tray.hbs',
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
    effectsTray: {
      template: 'modules/auto-action-tray/templates/topParts/effect-tray.hbs',
      id: 'effect-tray',
    },
  }

  //#region Hooks
  _onControlToken = (event, controlled) => {
    this.hpTextActive = false
    switch (true) {
      case event == null || controlled == false || this.actor == event.actor:
        return
      case controlled == true && this.actor != event.actor:
        this.actor = event.actor ? event.actor : event
        this.initialTraySetup(this.actor)
    }
  }

  initialTraySetup(actor) {
    if (this.selectingActivity == true) {
      this.activityTray.rejectActivity(new Error('User canceled activity selection'))
      this.activityTray.rejectActivity = null
    }

    this.actorHealthPercent = this.updateActorHealthPercent(actor)

    this.staticTrays = StaticTray.generateStaticTrays(actor, {
      application: this,
    })
    this.customTrays = CustomTray.generateCustomTrays(actor, {
      application: this,
    })
    this.effectsTray.setActor(actor, this)
    let data = actor.getFlag('auto-action-tray', 'delayedItems')
    if (data != undefined) {
      let delayedItems = JSON.parse(data)

      if (
        this.trayOptions['autoAddItems'] &&
        delayedItems != undefined &&
        delayedItems.length > 0
      ) {
        delayedItems.forEach((item) => {
          let foundItem = actor.items.get(item)
          if (foundItem != undefined) {
            CustomTray._onCreateItem.bind(this, foundItem)()
          }
        })
        actor.unsetFlag('auto-action-tray', 'delayedItems')
      }
    }

    this.equipmentTray = EquipmentTray.generateCustomTrays(actor, {
      application: this,
    })
    this.activityTray = ActivityTray.generateActivityTray(actor, {
      application: this,
    })

    this.setDefaultTray()
    this.meleeWeapon = this.equipmentTray.getMeleeWeapon()
    this.rangedWeapon = this.equipmentTray.getRangedWeapon()
    this.skillTray = SkillTray.generateCustomTrays(actor)
    this.combatHandler = new CombatHandler(actor, this)
    this.trayOptions = {
      locked: false,
      skillTrayPage: 0,
      currentTray: 'common',
      fastForward: true,
      imageType: 'portrait',
      imageScale: 1,
      imageX: 0,
      imageY: 0,
      healthIndicator: true,
      concentrationColor: '#ff0000',
      customStaticTrays: [],
      autoAddItems: true,
    }
    let config = this.getTrayConfig()
    if (config) {
      this.trayOptions = Object.assign({}, this.trayOptions, config)
    }

    this.render({
      parts: ['characterImage', 'centerTray', 'equipmentMiscTray', 'skillTray'],
    })
  }

  _onUpdateItem(item, change, options, userId) {
    if (item.actor != this.actor) return
    this.staticTrays = StaticTray.generateStaticTrays(this.actor)
    this.currentTray = this.getTray(this.currentTray.id)
    this.currentTray.active = true
    this.effectsTray.setEffects()
    if (this.animating == false) {
      this.render({ parts: ['centerTray'] })
    }
  }

  _onUpdateActor(actor, change, options, userId) {
    if (actor != this.actor) return
    this.staticTrays = StaticTray.generateStaticTrays(this.actor)
    this.currentTray = this.getTray(this.currentTray.id)
    this.currentTray.active = true
    this.actorHealthPercent = this.updateActorHealthPercent(actor)
    this.effectsTray.setEffects()
    if (this.combatHandler.inCombat) {
      this.combatHandler.setCombat(this.actor)
    }
    if (this.animating == false) {
      this.render({ parts: ['centerTray'] })
    }
  }

  _onUpdateCombat = (event) => {
    if (this.combatHandler == null || this.combatHandler.inCombat == false) return
    this.combatHandler.updateCombat(this.actor, event)
  }
  _onCreateActiveEffect = (effect) => {
    if (effect.parent != this.actor) return
    this.effectsTray.setEffects()
  }
  _onDeleteActiveEffect = (effect) => {
    if (effect.parent != this.actor) return
    this.effectsTray.setEffects()
  }
  _onUpdateActiveEffect = (effect) => {
    if (effect.parent != this.actor) return
    this.effectsTray.setEffects()
  }

  static async myFormHandler(event, form, formData) {
    let data = foundry.utils.expandObject(formData.object)
    this.updateHp(data.hpinputText)
    this.hpTextActive = false
  }

  //#region Rendering
  async _preparePartContext(partId, context) {
    context = {
      partId: `${this.id}-${partId}`,
      actor: this.actor,
      animating: this.animating,
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
      itemSelectorEnabled: this.itemSelectorEnabled,
      hpTextActive: this.hpTextActive,
      selectingActivity: this.selectingActivity,
      currentDice: this.currentDice,
      effectsTray: this.effectsTray,
    }

    return context
  }
  //#region Frame Listeners
  _configureRenderOptions(options) {
    super._configureRenderOptions(options)
  }

  _attachFrameListeners() {
    super._attachFrameListeners()

    let itemContextMenu = [
      {
        name: 'DND5E.ItemView',
        icon: '<i class="fas fa-eye"></i>',
        callback: (li) => {
          this._onAction(li[0], 'view')
        },
      },
      {
        name: 'Remove',
        icon: "<i class='fas fa-trash fa-fw'></i>",
        callback: (li) => this._onAction(li[0], 'remove'),
      },
    ]

    let characterContextMenu = [
      {
        name: 'View Sheet',
        icon: '<i class="fas fa-eye"></i>',
        callback: () => {
          this.actor.sheet.render(true)
        },
      },

      {
        name: 'Reset Data',
        icon: '<i class="fa-solid fa-delete-right"></i>',
        callback: (li) => {
          this.actor.unsetFlag('auto-action-tray', 'data')
          this.actor.unsetFlag('auto-action-tray', 'config')
          this.trayOptions = {
            locked: false,
            skillTrayPage: 0,
            currentTray: 'common',
            fastForward: true,
            imageType: 'portrait',
            imageScale: 1,
            imageX: 0,
            imageY: 0,
            healthIndicator: true,
            concentrationColor: '#ff0000',
            customStaticTrays: [],
            autoAddItems: true,
          }
          this.render(true)
        },
      },
    ]
    new ContextMenu(this.element, '.character-image', characterContextMenu, {
      onOpen: this._onOpenContextMenu(),
      jQuery: true,
      _expandUp: true,
    })

    new ContextMenu(this.element, '.ability-button', itemContextMenu, {
      onOpen: this._onOpenContextMenu(),
      jQuery: true,
    })
    new ContextMenu(
      this.element,
      '.effect-tray-icon',
      {},
      {
        onOpen: EffectTray.removeEffect.bind(this),
        jQuery: true,
      },
    )
    new ContextMenu(
      this.element,
      '.end-turn-btn-dice',
      {},
      {
        onOpen: Actions.changeDice.bind(this),
        jQuery: true,
      },
    )
  }

  _onOpenContextMenu(event) {
    return
  }

  _onAction(li, action) {
    switch (action) {
      case 'view':
        this.actor.items.get(li.dataset.itemId).sheet.render(true)
        break
      // case "edit":
      //   this.actor.items.get(li.dataset.itemId).sheet.render(true);
      //   break;
      case 'remove':
        this.currentTray.abilities[li.dataset.index] = null
        this.render(true)
        break
    }
  }
  //#region Actions

  setDefaultTray() {
    Actions.setDefaultTray.bind(this)()
  }

  setTrayConfig(config) {
    this.actor.setFlag('auto-action-tray', 'config', config)
  }

  getTrayConfig() {
    return Actions.getTrayConfig.bind(this)()
  }

  getTray(trayId) {
    return Actions.getTray.bind(this)(trayId)
  }

  static openSheet(event, target) {
    Actions.openSheet.bind(this)(event, target)
  }

  updateActorHealthPercent(actor) {
    Actions.updateActorHealthPercent.bind(this)(actor)
  }

  static async endTurn(event, target) {
    Actions.endTurn.bind(this)(event, target)
  }

  static async setTray(event, target) {
    Actions.setTray.bind(this)(event, target)
  }
  static toggleLock() {
    Actions.toggleLock.bind(this)()
  }
  static toggleSkillTrayPage() {
    Actions.toggleSkillTrayPage.bind(this)()
  }
  static toggleFastForward() {
    Actions.toggleFastForward.bind(this)()
  }

  static toggleItemSelector() {
    Actions.toggleItemSelector.bind(this)()
  }
  static minimizeTray() {
    Actions.minimizeTray.bind(this)()
  }

  static async trayConfig() {
    TrayConfig.trayConfig.bind(this)()
    return
  }

  static toggleHpText() {
    Actions.toggleHpText.bind(this)()
  }

  async updateHp(data) {
    Actions.updateHp.bind(this)(data)
  }

  static async useItem(event, target) {
    Actions.useItem.bind(this)(event, target)
  }

  static useSkillSave(event, target) {
    Actions.useSkillSave.bind(this)(event, target)
  }

  static async rollDice() {
    Actions.rollDice.bind(this)()
  }
  static changeDice() {
    Actions.changeDice.bind(this)()
  }

  static viewItem(event, target) {
    Actions.viewItem.bind(this)(event, target)
  }

  static selectWeapon(event, target) {
    Actions.selectWeapon.bind(this)(event, target)
  }

  //#region DragDrop
  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      }
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      }
      return new DragDrop(d)
    })
  }

  #dragDrop

  get dragDrop() {
    return this.#dragDrop
  }

  _onRender(context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element))
  }

  _canDragStart(selector) {
    return this.isEditable && !this.trayOptions['locked']
  }

  _canDragDrop(selector) {
    return this.isEditable
  }

  _onDragStart(event) {
    DragDropHandler._onDragStart(event, this)
  }

  _onDragOver(event) {
    DragDropHandler._onDragOver(event, this)
  }

  async _onDrop(event) {
    DragDropHandler._onDrop(event, this)
  }
  _onDropCanvas(data) {
    DragDropHandler._onDropCanvas(data, this)
  }
}
