const { ApplicationV2 } = foundry.applications.api
const { api } = foundry.applications
import { CustomTray } from './components/customTray.js'
import { StaticTray } from './components/staticTray.js'
import { ActivityTray } from './components/activityTray.js'
import { EquipmentTray } from './components/equipmentTray.js'
import { SkillTray } from './components/skillTray.js'
import { CombatHandler } from './helpers/combatHandler.js'
import { registerHandlebarsHelpers } from './helpers/handlebars.js'
import { AnimationHandler } from './helpers/animationHandler.js'
import { DragDropHandler } from './helpers/dragDropHandler.js'
import { DrawSVGPlugin, Draggable } from '/scripts/greensock/esm/all.js'
import { TrayConfig } from './helpers/trayConfig.js'
import { Actions } from './helpers/actions.js'
import { EffectTray } from './components/effectTray.js'
import { StackedTray } from './components/stackedTray.js'
import { TargetHelper } from './helpers/targetHelper.js'
import { ConditionTray } from './components/conditionsTray.js'

export class AutoActionTray extends api.HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    gsap.registerPlugin(DrawSVGPlugin)
    super(options)
    this.socket = options.socket

    this.animating = false

    // this.animationDuration = 0.7

    this.#dragDrop = this.#createDragDropHandlers()
    this.isEditable = true

    this.actor = null
    this.targetHelper = new TargetHelper({ hotbar: this, socket: this.socket })

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

    this.itemConfigItem = null
    this.skillTray = null
    this.stackedTray = new StackedTray({
      id: 'stacked',
      hotbar: this,
      type: 'stacked',
      name: 'stacked',
    })
    this.effectsTray = new EffectTray()
    this.animationHandler = new AnimationHandler({ hotbar: this, defaultTray: 'stacked' })
    this.combatHandler = new CombatHandler({
      hotbar: this,
    })
    this.conditionTray = new ConditionTray({ application: this })

    this.itemSelectorEnabled = false
    this.currentDice = 0
    this.dice = ['20', '12', '10', '8', '6', '4']
    this.trayInformation = ''
    this.trayOptions = {
      locked: false,
      skillTrayPage: 0,
      currentTray: 'stacked',
      fastForward: true,
      imageType: 'portrait',
      imageScale: 1,
      imageX: 0,
      imageY: 0,
      healthIndicator: true,
      customStaticTrays: [],
      autoAddItems: true,
      enableTargetHelper: true,
      concentrationColor: '#9600d1',
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
        document.documentElement.style.setProperty('--item-size', iconSize / 16 + 'rem')
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
      this.rowCount = rowCount
      this.columnCount = columnCount
      this.iconSize = iconSize
    }

    Hooks.on('controlToken', this._onControlToken.bind(this))
    Hooks.on('updateActor', this._onUpdateActor.bind(this))
    Hooks.on('updateItem', this._onUpdateItem.bind(this))
    Hooks.on('dropCanvasData', (canvas, data) => this._onDropCanvas(data))
    Hooks.on('dnd5e.beginConcentrating', (actor) => {
      if (actor == this.actor) this.render({ parts: ['characterImage'] })
    })
    Hooks.on('dnd5e.endConcentration', (actor) => {
      if (actor == this.actor) this.render({ parts: ['characterImage'] })
    })
    Hooks.on('updateCombat', this._onUpdateCombat.bind(this))
    Hooks.on('deleteCombatant', this._onUpdateCombat.bind(this))
    Hooks.on('createCombatant', this._onCreateCombatant.bind(this))
    Hooks.on('updateCombatant', this._onUpdateCombat.bind(this))
    Hooks.on('combatStart', this._onUpdateCombat.bind(this))
    Hooks.on('deleteCombat', this._onCombatDelete.bind(this))
    Hooks.on('createItem', CustomTray._onCreateItem.bind(this))
    Hooks.on('deleteItem', CustomTray._onDeleteItem.bind(this))
    Hooks.on('createActiveEffect', this._onCreateActiveEffect.bind(this))
    Hooks.on('deleteActiveEffect', this._onDeleteActiveEffect.bind(this))
    Hooks.on('updateActiveEffect', this._onUpdateActiveEffect.bind(this))
    Hooks.on('renderHotbar', () => {})

    ui.hotbar.collapse()

    registerHandlebarsHelpers()
    if (!game.user.isGM) {
      this.actor = game.user.character

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
      toggleTargetHelper: AutoActionTray.toggleTargetHelper,
      minimizeTray: AutoActionTray.minimizeTray,
      toggleItemSelector: AutoActionTray.toggleItemSelector,
      trayConfig: AutoActionTray.trayConfig,
      toggleHpText: AutoActionTray.toggleHpText,
      useActivity: ActivityTray.useActivity,
      cancelSelection: Actions.cancelSelection,
      useSlot: ActivityTray.useSlot,
      rollD20: AutoActionTray.rollDice,
      increaseTargetCount: AutoActionTray.increaseTargetCount,
      decreaseTargetCount: AutoActionTray.decreaseTargetCount,
      confirmTargets: AutoActionTray.confirmTargets,
      toggleCondition: AutoActionTray.toggleCondition,
      toggleConditionTray: AutoActionTray.toggleConditionTray,
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
    if(this.targetHelper.selectingTargets) return
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
    
    this.generateTrays(this.actor)
    this.setActor(actor)
    this.setDefaultTray()

    document.documentElement.style.setProperty('--stacked-spacer-width', 17 + 'px')

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

    this.trayInformation = ''
    this.trayOptions = {
      locked: false,
      skillTrayPage: 0,
      currentTray: 'stacked',
      fastForward: true,
      imageType: 'portrait',
      imageScale: 1,
      imageX: 0,
      imageY: 0,
      healthIndicator: true,
      customStaticTrays: [],
      autoAddItems: true,
      enableTargetHelper: true,
      concentrationColor: '#9600d1',
    }
    let config = this.getTrayConfig()
    if (config) {
      this.trayOptions = Object.assign({}, this.trayOptions, config)
    }
    this.render({
      parts: ['characterImage', 'centerTray', 'equipmentMiscTray', 'skillTray'],
    })
  }

  generateTrays(actor) {
    this.staticTrays = StaticTray.generateStaticTrays(actor, {
      application: this,
    })
    this.customTrays = CustomTray.generateCustomTrays(actor, {
      application: this,
    })
    this.equipmentTray = EquipmentTray.generateCustomTrays(actor, {
      application: this,
    })
    this.activityTray = ActivityTray.generateActivityTray(actor, {
      application: this,
    })
    this.meleeWeapon = this.equipmentTray.getMeleeWeapon()
    this.rangedWeapon = this.equipmentTray.getRangedWeapon()
    this.skillTray = SkillTray.generateCustomTrays(actor)
    this.stackedTray.setInactive()
    this.stackedTray.setTrays(this.customTrays.slice(0, 3))
    this.customTrays = [this.stackedTray, ...this.customTrays]
  }

  setActor(actor) {
    this.actorHealthPercent = this.updateActorHealthPercent(actor)
    this.effectsTray.setActor(actor, this)
    this.combatHandler.setActor(actor)
    this.conditionTray.setActor(actor)
    this.stackedTray.setActor(actor)
  }

  _onUpdateItem(item, change, options, userId) {
    if (item.actor != this.actor) return
    this.staticTrays = StaticTray.generateStaticTrays(this.actor)
    this.currentTray = this.getTray(this.currentTray.id)
    this.currentTray.setActive()
    this.effectsTray.setEffects()
    this.stackedTray.setActor(this.actor)
    if (this.animating == false) {
      this.render({ parts: ['centerTray'] })
    }
  }

  async _onUpdateActor(actor, change, options, userId) {
    if (actor != this.actor || Object.keys(change).includes('flags')) return
    this.staticTrays = StaticTray.generateStaticTrays(this.actor)
    this.currentTray = this.getTray(this.currentTray.id)
    this.currentTray.setActive()
    this.actorHealthPercent = this.updateActorHealthPercent(actor)
    this.effectsTray.setEffects()
    this.stackedTray.setActor(actor)
    if (this.combatHandler.inCombat) {
      this.combatHandler.setCombat(this.actor)
    }
    if (!this.animating) {
      this.render({ parts: ['centerTray'] })
    }
  }

  _onUpdateCombat = (event) => {
    if (this.combatHandler == null || this.combatHandler.inCombat == false) return
    this.combatHandler.updateCombat(this.actor, event)
  }
  _onCombatDelete = (event) => {
    if (this.combatHandler == null) return
    this.combatHandler.updateCombat(this.actor, event)
  }
  _onCreateCombatant = (event) => {
    if (this.actor != event.actor) return
    this.combatHandler.setCombat(this.actor, event)
  }

  _onCreateActiveEffect = (effect) => {
    if (effect.parent != this.actor) return
    this.effectsTray.setEffects()
    if (this.currentTray.id == 'condition') {
      this.conditionTray.setConditions()
      this.render({ parts: ['centerTray'] })
    }
  }
  _onDeleteActiveEffect = (effect) => {
    if (effect.parent != this.actor) return
    this.effectsTray.setEffects()
    if (this.currentTray.id == 'condition') {
      this.conditionTray.setConditions()
      this.render({ parts: ['centerTray'] })
    }
  }
  _onUpdateActiveEffect = (effect) => {
    if (effect.parent != this.actor) return
    this.effectsTray.setEffects()
    if (this.currentTray.id == 'condition') {
      this.conditionTray.setConditions()
      this.render({ parts: ['centerTray'] })
    }
  }

  static _onTokenSelect(hotbar, wrapped, ...args) {
    const [, event] = args

    if (!event) {
      return wrapped(...args)
    }

    if (hotbar.targetHelper.active && hotbar.targetHelper.selectingTargets) {
      let token = event.currentTarget

      hotbar.targetHelper.selectTarget(token)
      return event.stopPropagation()
    } else return wrapped(...args)
  }

  static _onTokenSelect2(hotbar, wrapped, ...args) {
    const [event] = args

    if (!event) {
      return wrapped(...args)
    }

    if (hotbar.targetHelper.active && hotbar.targetHelper.selectingTargets) {
      let token = event.currentTarget

      hotbar.targetHelper.selectTarget(token)
      return event.stopPropagation()
    } else return wrapped(...args)
  }

  static _onTokenCancel(hotbar, wrapped, ...args) {
    const event = args[0]
    if (hotbar.targetHelper.active && hotbar.targetHelper.selectingTargets) {
      let token = event.interactionData.object
      hotbar.targetHelper.removeTarget(token)
      return event.stopPropagation()
    } else return wrapped(...args)
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
      enableTargetHelper: this.trayOptions['enableTargetHelper'],
      trayOptions: this.trayOptions,
      trayInformation: this.trayInformation,
      activityTray: this.activityTray,
      combatHandler: this.combatHandler,
      itemSelectorEnabled: this.itemSelectorEnabled,
      hpTextActive: this.hpTextActive,
      selectingActivity: this.selectingActivity,
      currentDice: this.currentDice,
      effectsTray: this.effectsTray,
      stackedTray: this.stackedTray,
      conditionTray: this.conditionTray,
      itemConfigItem: this.itemConfigItem,
      targetHelper: this.targetHelper,
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
        callback: () => {
          this.deleteData(this.actor)
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
        this.currentTray.deleteItem(li.dataset.itemId)
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

  async deleteData(actor) {
    Actions.deleteData.bind(this)(actor)
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
  static toggleTargetHelper() {
    Actions.toggleTargetHelper.bind(this)()
  }

  static toggleItemSelector() {
    Actions.toggleItemSelector.bind(this)()
  }
  toggleItemSelector() {
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

  static increaseTargetCount() {
    Actions.increaseTargetCount.bind(this)()
  }
  static decreaseTargetCount() {
    Actions.decreaseTargetCount.bind(this)()
  }
  static confirmTargets() {
    Actions.confirmTargets.bind(this)()
  }

  static async toggleCondition(event, target) {
    this.conditionTray.toggleCondition(event, target)
  }

  static toggleConditionTray(event, target) {
    if (this.animating || this.selectingActivity || this.targetHelper.selectingTargets) return
    if (this.conditionTray.active) {
      this.animationHandler.popTray()
    } else {
      this.animationHandler.pushTray('condition')
    }
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

    if (this.animating || !this.stackedTray.active || !options.parts.includes('centerTray')) return

    this.animationHandler.setAllStackedTrayPos(this.currentTray)
    const hotbar = this
    let handleSize = hotbar.iconSize / 3 + 2
    let spacerSize = 17

    let classFeatures = Draggable.create('.container-classFeatures', {
      type: 'x',
      bounds: {
        minX: 22,
        maxX: hotbar.stackedTray.trays[2].xPos - handleSize,
      },
      handle: '.handle-classFeatures',
      inertia: true,
      zIndexBoost: false,
      maxDuration: 0.1,
      snap: {
        x: function (value) {
          return Math.floor(value / hotbar.iconSize) * hotbar.iconSize
        },
      },
      onThrowComplete: function () {
        hotbar.stackedTray.setTrayPosition(
          'classFeatures',
          Math.floor(this.endX / hotbar.iconSize) * hotbar.iconSize,
        )
        items[0].applyBounds({
          minX: this.endX + handleSize,
          maxX: hotbar.columnCount * hotbar.iconSize - handleSize - spacerSize,
        })
      },
    })

    let items = Draggable.create('.container-items', {
      type: 'x',
      bounds: {
        minX: hotbar.stackedTray.trays[1].xPos + handleSize,
        maxX: hotbar.columnCount * hotbar.iconSize - handleSize - spacerSize,
      },
      handle: '.handle-items',
      zIndexBoost: false,
      inertia: true,
      maxDuration: 0.1,
      snap: {
        x: function (value) {
          return Math.floor(value / hotbar.iconSize) * hotbar.iconSize + handleSize
        },
      },
      onThrowComplete: function () {
        hotbar.stackedTray.setTrayPosition(
          'items',
          Math.floor(this.endX / hotbar.iconSize) * hotbar.iconSize + handleSize,
        )
        classFeatures[0].applyBounds({ minX: handleSize, maxX: this.endX - handleSize })
      },
    })
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
