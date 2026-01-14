const { ApplicationV2 } = foundry.applications.api
const { api } = foundry.applications
import { CustomTray } from './components/customTray.js'
import { StaticTray } from './components/staticTray.js'
import { ActivityTray } from './components/activityTray.js'
import { SpellLevelTray } from './components/spellLevelTray.js'
import { EquipmentTray } from './components/equipmentTray.js'
import { SkillTray } from './components/skillTray.js'
import { CombatHandler } from './handlers/combatHandler.js'
import { registerHandlebarsHelpers } from './helpers/handlebars.js'
import { AnimationHandler } from './handlers/animationHandler.js'
import { DragDropHandler } from './handlers/dragDropHandler.js'
import { DrawSVGPlugin, Draggable } from '/scripts/greensock/esm/all.js'
import { TrayConfig } from './dialogs/trayConfig.js'
import { Actions } from './helpers/actions.js'
import { EffectTray } from './components/effectTray.js'
import { StackedTray } from './components/stackedTray.js'
import { TargetHelper } from './helpers/targetHelper.js'
import { QuickActionHelper } from './helpers/quickActionHelper.js'
import { ConditionTray } from './components/conditionsTray.js'
import { AATItem } from './items/item.js'
import { ItemConfig } from './dialogs/itemConfig.js'
import { DraggableTrayContainer } from './handlers/draggableHandler.js'

export class AutoActionTray extends api.HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    gsap.registerPlugin(DrawSVGPlugin)
    gsap.config({
      force3D: false,
    })

    super(options)
    this.socket = options.socket

    this.animating = false
    this.completeAnimation = null
    this.renderQueue = []
    this.pendingRender = false

    this.throttledRender = foundry.utils.throttle(async () => await this.completeRender(), 500)
    this.throttledHover = foundry.utils.throttle((...args) => this.handleHoverToken(...args), 100)

    this.#dragDrop = this.#createDragDropHandlers()
    this.isEditable = true

    this.actor = null
    this.token = null
    this.targetHelper = new TargetHelper({ hotbar: this, socket: this.socket })

    this.meleeWeapon = null
    this.rangedWeapon = null
    this.hpTextActive = false
    this.actorHealthPercent = 100
    this.currentTray = null
    this.targetTray = null
    this.useSlot = true

    this.customTrays = []
    this.staticTrays = []
    this.activityTray = null
    this.equipmentTray = null

    this.savedActors = []

    this.itemConfigItem = null
    this.skillTray = null
    this.stackedTray = new StackedTray({
      id: 'stacked',
      hotbar: this,
      type: 'stacked',
      name: 'stacked',
    })

    this.effectsTray = new EffectTray()
    this.activeEffects = []
    this.concentrationItem = null

    this.combatHandler = new CombatHandler({
      hotbar: this,
    })
    this.quickActionHelper = new QuickActionHelper({
      app: this,
      targetHelper: this.targetHelper,
      combatHandler: this.combatHandler,
    })

    this.conditionTray = new ConditionTray({ application: this })

    this.itemSelectorEnabled = false
    this.rangeBoundaryEnabled = true
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
      rangeBoundaryEnabled: game.settings.get('auto-action-tray', 'defaultRangeBoundary'),
    }

    let rowCount = 2
    let columnCount = 10
    let scale = 0.6
    this.styleSheet

    for (let sheet of document.styleSheets) {
      if (sheet.href && sheet.href.includes('auto-action-tray/styles/styles.css')) {
        this.styleSheet = sheet
        break
      }

      if (game.settings.get('auto-action-tray', 'scale')) {
        scale = game.settings.get('auto-action-tray', 'scale')
        document.documentElement.style.setProperty('--aat-scale', scale)
      }
      if (game.settings.get('auto-action-tray', 'rowCount')) {
        rowCount = game.settings.get('auto-action-tray', 'rowCount')
        document.documentElement.style.setProperty('--aat-item-tray-item-height-count', rowCount)
      }
      if (game.settings.get('auto-action-tray', 'columnCount')) {
        columnCount = game.settings.get('auto-action-tray', 'columnCount')
        document.documentElement.style.setProperty('--aat-item-tray-item-width-count', columnCount)
      }
      if (
        game.settings.get('auto-action-tray', 'bgOpacity') != null &&
        game.settings.get('auto-action-tray', 'bgOpacity') != undefined
      ) {
        let value = game.settings.get('auto-action-tray', 'bgOpacity')
        const baseColor = `5b5b5b`
        const hex = Math.floor(value * 255)
          .toString(16)
          .padStart(2, '0')
        document.documentElement.style.setProperty('--aat-background-color', `#${baseColor}${hex}`)
      }

      this.quickActionHelperEnabled = game.settings.get('auto-action-tray', 'quickActionHelper')

      this.totalabilities = rowCount * columnCount
      this.rowCount = rowCount
      this.columnCount = columnCount
      this.iconSize = 100
    }
    this.animationHandler = new AnimationHandler({ hotbar: this, defaultTray: 'stacked' })
    this.draggableTrays = new DraggableTrayContainer({
      application: this,
    })

    Hooks.on('controlToken', this._onControlToken.bind(this))
    Hooks.on('updateActor', this._onUpdateActor.bind(this))
    Hooks.on('updateItem', this._onUpdateItem.bind(this))
    Hooks.on('dropCanvasData', (canvas, data) => this._onDropCanvas(data))
    Hooks.on('dnd5e.beginConcentrating', (actor) => {
      if (actor == this.actor) this.requestRender('characterImage')
    })
    Hooks.on('dnd5e.endConcentration', (actor) => {
      if (actor == this.actor) this.requestRender('characterImage')
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
    Hooks.on('hoverToken', this._onHoverToken.bind(this))
    Hooks.on('renderHotbar', () => {})

    if (!game.settings.get('auto-action-tray', 'customTargettingCursors')) {
      const AUTOACTIONTRAY_MODULE_NAME = 'auto-action-tray'
      libWrapper.unregister(AUTOACTIONTRAY_MODULE_NAME, 'PIXI.EventSystem.prototype.setCursor')
    }

    this.altDown = false
    this.ctrlDown = false
    window.addEventListener('keydown', (e) => {
      if (e.altKey) this.altDown = true
      if (e.ctrlKey) this.ctrlDown = true
      if ((this.altDown && this.ctrlDown) || (!this.altDown && !this.ctrlDown)) {
        return
      }
      let color = this.altDown ? 'rgb(0, 173, 0)' : this.ctrlDown ? 'rgb(173, 0, 0)' : ''
      document
        .getElementById('auto-action-tray')
        ?.style.setProperty('--aat-modifier-highlight-color', color)
      const elements = document.querySelectorAll('.modifier-highlight')
      elements.forEach((el) => {
        el.classList.add('modifier-active')
      })
    })

    window.addEventListener('keyup', (e) => {
      if (!e.altKey) this.altDown = false
      if (!e.ctrlKey) this.ctrlDown = false

      const elements = document.querySelectorAll('.modifier-highlight')
      document
        .getElementById('auto-action-tray')
        ?.style.setProperty('--aat-modifier-highlight-color', '')
      elements.forEach((el) => {
        el.classList.remove('modifier-active')
      })
    })

    const defaultHotbar = document.querySelector('#hotbar')

    if (defaultHotbar) {
      defaultHotbar.style.visibility = 'hidden'
    }

    registerHandlebarsHelpers()
    if (!game.user.isGM) {
      this.actor = game.user.character
      let event = null
      this.generateActorItems(this.actor, event)
      this.initialTraySetup(this.actor, event)
      this.render(true)
    } else {
      this.render(true)
      Actions.minimizeTray.bind(this)()
      Hooks.once('controlToken', () => {
        document.getElementById('aat-maximize-button').remove()
        this.render(true)
      })
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
      toggleRangeBoundary: AutoActionTray.toggleRangeBoundary,
      trayConfig: AutoActionTray.trayConfig,
      toggleHpText: AutoActionTray.toggleHpText,
      useActivity: ActivityTray.useActivity,
      useSpellLevel: SpellLevelTray.useActivity,
      cancelSelection: Actions.cancelSelection,
      toggleUseSlot: AutoActionTray.toggleUseSlot,
      rollD20: AutoActionTray.rollDice,
      increaseTargetCount: AutoActionTray.increaseTargetCount,
      decreaseTargetCount: AutoActionTray.decreaseTargetCount,
      confirmTargets: AutoActionTray.confirmTargets,
      toggleCondition: AutoActionTray.toggleCondition,
      toggleConditionTray: AutoActionTray.toggleConditionTray,
      rollDeathSave: AutoActionTray.rollDeathSave,
      increaseRowCount: AutoActionTray.increaseRowCount,
      decreaseRowCount: AutoActionTray.decreaseRowCount,
      removeConcentration: AutoActionTray.removeConcentration,
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
    effectsTray: {
      template: 'modules/auto-action-tray/templates/topParts/effect-tray.hbs',
      id: 'effect-tray',
    },
    skillTray: {
      template: 'modules/auto-action-tray/templates/topParts/skill-tray.hbs',
      id: 'skill-tray',
    },
    endTurn: {
      template: 'modules/auto-action-tray/templates/topParts/end-turn.hbs',
      id: 'end-turn',
    },
  }

  //#region Hooks
  _onControlToken = (event, controlled) => {
    if (event?.actor.type == 'vehicle' || event?.actor.type == 'group') return
    if (this.targetHelper.getState() >= this.targetHelper.STATES.TARGETING) return
    this.hpTextActive = false
    switch (true) {
      case event == null || controlled == false || this.actor == event.actor:
        return
      case controlled == true && this.actor != event.actor:
        this.actor = event.actor ? event.actor : event
        this.token = event
        this.initialTraySetup(this.actor, event)
    }
  }

  startAnimation() {
    this.animating = true
    this.completeAnimation = new Promise((resolve) => {
      this._resolveAnimation = resolve
    })
  }

  endAnimation() {
    this.animating = false
    if (this._resolveAnimation) {
      this._resolveAnimation()
      this._resolveAnimation = null
    }
  }

  async requestRender(partID, force = false) {
    const arr = Array.isArray(partID) ? partID : [partID]
    this.renderQueue.push(...arr)
    this.renderQueue = [...new Set(this.renderQueue)]

    if (this.pendingRender && !force) return

    if (this.animating && !force) {
      this.pendingRender = true
      await this.completeAnimation
    }

    if (force) {
      await this.completeRender()
      return Promise.resolve()
    } else {
      this.throttledRender()
    }
  }

  async completeRender() {
    const tmp = this.renderQueue
    this.renderQueue = []
    await this.render({ parts: tmp })
    this.pendingRender = false
    return Promise.resolve()
  }

  async generateActorItems(actor, event) {
    let token = event == null ? await actor.getTokenDocument() : event.document
    let savedActor = this.getSavedActor(actor, token)

    if (savedActor) {
      if (actor.items.size != savedActor.abilities.length) {
        savedActor.abilities = actor.items.map((i) => new AATItem(i))
        return
      }
      this.checkTrayDiff()
      return
    }

    if (this.savedActors.length > 10) {
      this.savedActors.shift()
    }
    let items
    if (token?.actorLink || actor.token == null) {
      items = actor.items
    } else {
      items = actor.token.delta.items
    }

    let urls = items.map((e) => e.img)
    urls.forEach((url) => {
      const img = new Image()
      img.src = url
    })

    this.savedActors.push({
      name: actor.name,
      id: actor.id,
      tokenId: actor?.token?.id,
      type: actor.type,
      abilities: items.map((i) => new AATItem(i)),
    })
  }

  getSavedActor(actor, token) {
    if (token.actorLink) {
      return this.savedActors.find((a) => a.id == actor.id)
    } else {
      return this.savedActors.find((a) => a.id == actor.id && a.tokenId == token.id)
    }
  }

  deleteSavedActor(actor, token) {
    if (token.actorLink) {
      this.savedActors = this.savedActors.filter((a) => a.id !== actor.id)
    } else {
      this.savedActors = this.savedActors.filter(
        (a) => !(a.id === actor.id && a.tokenId === token.id),
      )
    }
  }

  getActorAbilities(actorUuid) {
    const actor = fromUuidSync(actorUuid)
    const token = actor?.token ? actor.token : actor.getTokenDocument()
    if (!actor || !token) {
      return []
    }
    let savedActor = this.getSavedActor(actor, token)
    if (!savedActor) {
      return []
    }

    return savedActor.abilities
  }

  deleteActorAbility(itemId) {
    const actor = this.savedActors.find((a) => a.id === this.actor.id)
    if (actor) {
      actor.abilities = actor.abilities.filter((e) => e.id !== itemId)
    }
  }

  setTheme(actor) {
    if (actor.type == 'character') {
      const highestLevelClass = Object.keys(actor.classes).reduce(
        (highest, e) => {
          const currentClass = actor.classes[e]
          if (currentClass.system.levels > highest.level) {
            return { name: currentClass.name, level: currentClass.system.levels }
          }
          return highest
        },
        { level: -Infinity },
      )
      if (highestLevelClass.name) {
        game.settings.set(
          'auto-action-tray',
          'tempTheme',
          'theme-' + highestLevelClass.name.toLowerCase(),
        )
      } else {
        game.settings.set(
          'auto-action-tray',
          'tempTheme',
          game.settings.get('auto-action-tray', 'theme'),
        )
      }
    } else {
      let creatureType = actor.system.details.type.value
      let theme = ''
      switch (creatureType) {
        case 'aberration':
          theme = 'theme-warlock'
          break
        case 'beast':
          theme = 'theme-ranger'
          break
        case 'celestial':
          theme = 'theme-cleric'
          break
        case 'construct':
          theme = 'theme-fighter'
          break
        case 'dragon':
          theme = 'theme-barbarian'
          break
        case 'elemental':
          theme = 'theme-bard'
          break
        case 'fey':
          theme = 'theme-sorcerer'
          break
        case 'fiend':
          theme = 'theme-ember'
          break
        case 'giant':
          theme = 'theme-titan'
          break
        case 'humanoid':
          if (actor.system.details.type.subtype == 'Goblinoid') {
            theme = 'theme-monk'
          } else {
            theme = 'theme-slate'
          }
          break
        case 'monstrosity':
          theme = 'theme-rogue'
          break
        case 'ooze':
          theme = 'theme-artificer'
          break
        case 'plant':
          theme = 'theme-druid'
          break
        case 'undead':
          theme = 'theme-subterfuge'
          break
        default:
          theme = 'theme-slate'
          break
      }

      game.settings.set('auto-action-tray', 'tempTheme', theme)
    }
  }

  async initialTraySetup(actor, token = null, currentTrayId = null) {
    if (this.selectingActivity == true) {
      this.activityTray.rejectActivity(new Error('User canceled activity selection'))
      this.activityTray.rejectActivity = null
      this.spellLevelTray.rejectActivity(new Error('User canceled activity selection'))
      this.spellLevelTray.rejectActivity = null
    }

    let config = this.getTrayConfig()

    if (config?.rowCount && this.rowCount != config.rowCount) {
      this.rowCount = config.rowCount
      this.totalabilities = this.rowCount * this.columnCount
      const root = document.getElementById('auto-action-tray')
    }
    if (!config?.rowCount) {
      this.rowCount = game.settings.get('auto-action-tray', 'rowCount')
      this.totalabilities = this.rowCount * this.columnCount
    }

    await this.generateActorItems(actor, token)
    this.generateTrays(this.actor)
    this.setActor(actor)
    if (this.quickActionHelperEnabled) {
      this.quickActionHelper.setData(actor)
    }
    if (currentTrayId) {
      this.currentTray.setInactive()
      let tray = this.getTray(currentTrayId)
      tray.setActive()
      this.currentTray = tray
      this.trayInformation = tray.label
    } else {
      this.setDefaultTray()
    }

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

    this.trayInformation = this.currentTray.label
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
      rowCount: game.settings.get('auto-action-tray', 'rowCount'),
      rangeBoundaryEnabled: game.settings.get('auto-action-tray', 'defaultRangeBoundary'),
    }

    if (config?.theme && config?.theme != '') {
      game.settings.set('auto-action-tray', 'tempTheme', config.theme)
    } else {
      if (game.settings.get('auto-action-tray', 'autoTheme')) {
        this.setTheme(actor)
      }
    }

    if (config) {
      this.trayOptions = Object.assign({}, this.trayOptions, config)
    }

    document
      .getElementById('auto-action-tray')
      ?.style.setProperty('--aat-item-tray-item-height-count', this.rowCount)
    this.render({
      parts: ['characterImage', 'centerTray', 'equipmentMiscTray', 'skillTray'],
    })
  }

  generateTrays(actor) {
    let abilities = this.getActorAbilities(actor.uuid)
    this.staticTrays = StaticTray.generateStaticTrays(actor, {
      application: this,
      cachedAbilities: abilities,
    })
    this.customTrays = CustomTray.generateCustomTrays(actor, {
      application: this,
      cachedAbilities: abilities,
    })
    this.equipmentTray = EquipmentTray.generateCustomTrays(actor, {
      application: this,
      cachedAbilities: abilities,
    })
    this.activityTray = ActivityTray.generateActivityTray(actor, {
      application: this,
    })
    this.spellLevelTray = SpellLevelTray.generateActivityTray(actor, {
      application: this,
    })
    this.meleeWeapon = this.equipmentTray.getMeleeWeapon()
    this.rangedWeapon = this.equipmentTray.getRangedWeapon()
    this.quickActionHelper.setEquipmentTray(this.equipmentTray)
    this.skillTray = SkillTray.generateCustomTrays(actor)
    this.stackedTray.setInactive()
    const favoriteTray = this.customTrays.find((e) => e.id === 'favoriteItems')
    this.stackedTray.setTrays([
      ...this.customTrays.slice(0, 3),
      ...(favoriteTray ? [favoriteTray] : []),
    ])
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

    const abilities = this.getActorAbilities(this.actor.uuid)
    const index = abilities.findIndex((e) => e.id === item.id)

    if (index !== -1) {
      let newItem = new AATItem(item)
      if (abilities[index]?.multigroup) {
        newItem.multigroup = abilities[index].multigroup
      }
      abilities[index] = newItem
    }

    this.staticTrays = StaticTray.generateStaticTrays(this.actor, { application: this })
    this.currentTray = this.getTray(this.currentTray.id)
    this.currentTray.setActive()
    this.effectsTray.setEffects()
    this.stackedTray.setActor(this.actor)
    this.checkTrayDiff()
    this.requestRender('centerTray')
  }

  checkTrayDiff() {
    const allItems = this.getActorAbilities(this.actor.uuid)
    const itemMap = new Map(allItems.map((item) => [item.id, item]))
    this.stackedTray.checkDiff(itemMap)
    this.customTrays.forEach((tray) => {
      tray.checkDiff(itemMap)
    })
    this.staticTrays.forEach((tray) => {
      tray.checkDiff(itemMap)
    })
  }

  async _onUpdateActor(actor, change, options, userId) {
    if (actor != this.actor || Object.keys(change).includes('flags')) return
    this.staticTrays = StaticTray.generateStaticTrays(this.actor, { application: this })
    this.currentTray = this.getTray(this.currentTray.id)
    this.currentTray.setActive()
    this.actorHealthPercent = this.updateActorHealthPercent(actor)
    this.effectsTray.setEffects()
    this.stackedTray.setActor(actor)
    if (this.combatHandler.inCombat) {
      this.combatHandler.setCombat(this.actor)
    }
    if (change?.system?.favorites) {
      Actions.refreshFavorites.bind(this)(actor, { application: this })
    }
    this.requestRender(['centerTray', 'characterImage'])
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
    }
    this.requestRender('centerTray', 'characterImage')
  }
  _onDeleteActiveEffect = (effect) => {
    if (effect.parent != this.actor) return
    this.effectsTray.setEffects()
    if (this.currentTray.id == 'condition') {
      this.conditionTray.setConditions()
    }
    this.requestRender('centerTray', 'characterImage')
  }
  _onUpdateActiveEffect = (effect) => {
    if (effect.parent != this.actor) return
    this.effectsTray.setEffects()
    if (this.currentTray.id == 'condition') {
      this.conditionTray.setConditions()
      this.requestRender('centerTray')
    }
  }

  static _onTokenSelect(hotbar, wrapped, ...args) {
    const [, event] = args

    if (!event) {
      return wrapped(...args)
    }

    if (
      // hotbar.targetHelper.getState() === hotbar.targetHelper.STATES.ACTIVE &&
      hotbar.targetHelper.getState() >= hotbar.targetHelper.STATES.TARGETING
    ) {
      if (event.target.actor == hotbar.actor) {
        return wrapped(...args)
      }
      let token = event.currentTarget

      hotbar.targetHelper.selectTarget(token)
      return event.stopPropagation()
    } else {
      if (event.target.actor == hotbar.actor) {
        let currentTrayId = hotbar.currentTray.id

        hotbar.initialTraySetup(hotbar.actor, event.target, currentTrayId)
      }
      return wrapped(...args)
    }
  }

  static _canControl(hotbar, wrapped, ...args) {
    if (hotbar.quickActionHelper.controllable) {
      return wrapped(...args)
    }
    const [, event] = args

    if (!event) {
      return wrapped(...args)
    }

    if (
      // hotbar.targetHelper.getState() === hotbar.targetHelper.STATES.ACTIVE &&
      hotbar.targetHelper.getState() >= hotbar.targetHelper.STATES.TARGETING
    ) {
      // if (event.target.actor == hotbar.actor) {
      //   return wrapped(...args)
      // }
      let token = event.currentTarget

      hotbar.targetHelper.selectTarget(token)
      return event.stopPropagation()
    } else {
      if (event.target.actor == hotbar.actor) {
        let currentTrayId = hotbar.currentTray.id

        hotbar.initialTraySetup(hotbar.actor, event.target, currentTrayId)
      }
      return wrapped(...args)
    }
  }

  _onHoverToken(token, hovered) {
    this.throttledHover(token, hovered)
  }

  handleHoverToken(token, hovered) {
    if (!this.actor) return
    if (this.targetHelper.getState() >= this.targetHelper.STATES.TARGETING && hovered) {
      this.targetHelper.setState('HOVERING')
    } else if (this.targetHelper.getState() >= this.targetHelper.STATES.TARGETING && !hovered) {
      this.targetHelper.setState('TARGETING')
    }

    if (this.quickActionHelperEnabled) {
      if (this.quickActionHelper.getState() !== this.quickActionHelper.STATES.ATTACKING) {
        const dis1 = this.actor?.token?.disposition ?? this.actor?.prototypeToken?.disposition
        const dis2 = token?.document?.disposition

        const { currentTray, quickActionHelper, combatHandler } = this

        const invalidTrays = new Set(['target-helper', 'activity', 'spellLevel'])
        const trayId = currentTray?.id

        const quickState = quickActionHelper.getState()
        const isValidQuickState =
          quickState === quickActionHelper.STATES.ACTIVE ||
          quickState === quickActionHelper.STATES.TARGETTING

        const canQuickAct =
          !invalidTrays.has(trayId) &&
          quickActionHelper.hasActiveSlot() &&
          dis1 !== dis2 &&
          isValidQuickState &&
          combatHandler.inCombat &&
          combatHandler.isTurn

        if (canQuickAct) {
          if (hovered) {
            this.quickActionHelper.startQuickAction()
            this.quickActionHelper.displayTokenGhost(token)
          } else {
            this.quickActionHelper.cancelQuickAction()
            this.quickActionHelper.removeTokenGhost()
          }
        }
      }
    }

    const hoverEnabled = game.settings.get('auto-action-tray', 'enableRangeHover')
    if (!hoverEnabled || !token || token == this.token || !this.token) return
    if (!hovered) {
      const allItems = document.querySelectorAll('.in-range')
      // gsap.killTweensOf(allItems)
      if (allItems.length > 0) {
        gsap.to(allItems, {
          opacity: 0,
          duration: 0.2,
          overwrite: true,
        })
      }
      return
    }

    let xDist = Math.abs(this.token.x - token.x) / canvas.grid.size
    let yDist = Math.abs(this.token.y - token.y) / canvas.grid.size
    let distance = Math.ceil(Math.abs(Math.max(xDist, yDist))) * 5

    const allItems = document.querySelectorAll('[data-action-range]')
    const filteredItems = Array.from(allItems).filter((el) => {
      let range = parseFloat(el.getAttribute('data-action-range'))
      return range != 0 && !isNaN(range) && range >= distance
    })
    const targetElements = filteredItems.map((el) => el.querySelector('.in-range')).filter(Boolean)
    if (targetElements.length != 0) {
      gsap.to(targetElements, { opacity: 0.9, overwrite: true })
    }
  }

  static _onTokenSelect2(hotbar, wrapped, ...args) {
    const [event] = args

    if (!event) {
      return wrapped(...args)
    }

    if (
      // hotbar.targetHelper.getState() === hotbar.targetHelper.STATES.ACTIVE &&
      hotbar.targetHelper.getState() >= hotbar.targetHelper.STATES.TARGETING
    ) {
      let token = event.currentTarget

      hotbar.targetHelper.selectTarget(token)
      return event.stopPropagation()
    } else return wrapped(...args)
  }
  static _onCursorChange(hotbar, wrapped, ...args) {
    if (
      // hotbar.targetHelper.getState() === hotbar.targetHelper.STATES.ACTIVE &&
      hotbar.targetHelper.getState() >= hotbar.targetHelper.STATES.TARGETING
    ) {
      const canvas = document.getElementById('board')
      canvas.style.cursor =
        "url('modules/auto-action-tray/icons/cursors/Crosshair.cur') 16 16, auto"
      return wrapped("url('modules/auto-action-tray/icons/cursors/Crosshair.cur') 16 16, auto")
    } else {
      return wrapped(...args)
    }
  }
  static _onTokenCancel(hotbar, wrapped, ...args) {
    const event = args[0]
    if (
      // hotbar.targetHelper.getState() === hotbar.targetHelper.STATES.ACTIVE &&
      hotbar.targetHelper.getState() >= hotbar.targetHelper.STATES.TARGETING
    ) {
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
      useSlot: this.useSlot,
      spellLevelTray: this.spellLevelTray,
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
      actions: this.combatHandler.actions,
      activeEffects: this.activeEffects,
      concentrationItem: this.concentrationItem,
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
        name: 'Configure Item',
        icon: "<i class='fas fa-cog fa-fw'></i>",
        callback: (li) => {
          let item = this.getActorAbilities(this.actor.uuid).find(
            (e) => e.id == li[0].dataset.itemId,
          ).item
          ItemConfig.itemConfig.bind(this)(item)
        },
      },
      {
        name: 'Display in Chat',
        icon: "<i class='fas fa-comment-dots fa-fw'></i>",
        callback: (li) => {
          let item = this.getActorAbilities(this.actor.uuid).find(
            (e) => e.id == li[0].dataset.itemId,
          ).item
          item.displayCard()
        },
      },
      {
        name: 'Toggle Favorite',
        icon: "<i class='fas fa-star fa-fw'></i>",
        callback: (li) => {
          const item = this.getActorAbilities(this.actor.uuid).find(
            (e) => e.id == li[0].dataset.itemId,
          ).item
          let itemId = item.getRelativeUUID(this.actor)
          let type = 'item'
          if (li[0].dataset.activityId) {
            itemId += `.Activity.${li[0].dataset.activityId}`
            type = 'activity'
          }
          if (this.actor.system.hasFavorite(itemId)) {
            this.actor.system.removeFavorite(itemId)
          } else {
            this.actor.system.addFavorite({ type: type, id: itemId })
          }
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
        name: 'Macro Directory',
        icon: '<i class="fas fa-folder-open"></i>',
        callback: () => {
          game.macros.directory.activate()
        },
      },

      {
        name: 'Reset Data',
        icon: '<i class="fa-solid fa-delete-right"></i>',
        callback: () => {
          this.deleteData(this.actor)
        },
      },

      {
        name: 'Reset Tray Data',
        icon: '<i class="fa-solid fa-delete-right"></i>',
        callback: () => {
          this.deleteTrayData(this.actor)
        },
      },
    ]
    new foundry.applications.ux.ContextMenu(
      this.element,
      '.character-image',
      characterContextMenu,
      {
        onOpen: this._onOpenContextMenu(),
        jQuery: true,
        _expandUp: true,
      },
    )

    new AltContextMenu(
      this.element,
      '.ability-button',
      itemContextMenu,
      {
        onOpen: (target) => {
          this._onOpenContextMenu(target)
        },
        jQuery: true,
      },
      'auto-action-tray',
    )
    new foundry.applications.ux.ContextMenu(this.element, '.effect-tray-icon', [], {
      onOpen: EffectTray.removeEffect.bind(this),
      jQuery: true,
    })

    // new ContextMenu(this.element, '.concentration-item', [], {
    //   onOpen: EffectTray.removeEffect.bind(this),
    //   jQuery: true,
    // })

    new foundry.applications.ux.ContextMenu(this.element, '.end-turn-btn-dice', [], {
      onOpen: Actions.changeDice.bind(this),
      jQuery: true,
    })

    if (this.quickActionHelperEnabled) {
      new foundry.applications.ux.ContextMenu(this.element, '.quick-slot-1', [], {
        onOpen: () => this.quickActionHelper.toggleSlot(1),
        jQuery: true,
      })
      new foundry.applications.ux.ContextMenu(this.element, '.quick-slot-2', [], {
        onOpen: () => this.quickActionHelper.toggleSlot(2),
        jQuery: true,
      })
    }
  }

  _onOpenContextMenu(target) {
    // if (!target) return
    // console.log(target)
    // const rect = target.getBoundingClientRect()

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

  async deleteTrayData(actor) {
    Actions.deleteTrayData.bind(this)(actor)
  }

  getTrayConfig() {
    return Actions.getTrayConfig.bind(this)()
  }

  getTray(trayId) {
    return Actions.getTray.bind(this)(trayId)
  }
  static removeConcentration(event, element) {
    EffectTray.removeConcentration.bind(this)(event, element)
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

  static toggleRangeBoundary() {
    Actions.toggleRangeBoundary.bind(this)()
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

  static toggleUseSlot(event, target) {
    Actions.toggleUseSlot.bind(this)(event, target)
  }

  static async rollDice() {
    Actions.rollDice.bind(this)()
  }
  static async rollDeathSave() {
    Actions.rollDeathSave.bind(this)()
  }
  static async increaseRowCount() {
    Actions.increaseRowCount.bind(this)()
  }
  static async decreaseRowCount() {
    Actions.decreaseRowCount.bind(this)()
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
    if (
      this.animating ||
      this.selectingActivity ||
      this.targetHelper.getState() >= this.targetHelper.STATES.TARGETING
    )
      return
    if (this.conditionTray.active) {
      this.animationHandler.popTray()
    } else {
      this.animationHandler.pushTray('condition')
    }
  }

  static toggleActionHover(type) {}

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
      return new foundry.applications.ux.DragDrop.implementation(d)
    })
  }

  #dragDrop

  get dragDrop() {
    return this.#dragDrop
  }

  createDraggable(trayId, index) {}

  _onRender(context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element))
    
    if (options.parts.includes('characterImage')) {
      if (this.hpTextActive) {
        setTimeout(() => {
          const inputField = document.querySelector('.hpinput')
          inputField.focus()
        }, 100)
      }
    }

    if (options.parts.includes('centerTray')) {
      if (this.trayOptions['rangeBoundaryEnabled']) {
        const rangedItems = document.querySelectorAll('[data-action-range]')
        const filtered = Array.from(rangedItems).filter(
          (node) => parseInt(node.dataset.actionRange) > 0,
        )

        filtered.forEach((node) => {
          node.addEventListener('mouseenter', () => {
            const range = node.dataset.actionRange
            this.targetHelper.createRangeBoundary(range / 5, this.actor)
          })
        })

        filtered.forEach((node) => {
          node.addEventListener('mouseleave', () => {
            this.targetHelper.destroyRangeBoundary()
          })
        })
      }

      document.querySelectorAll('.action-hover').forEach((source) => {
        let targetSelector = source.getAttribute('data-action-type')
        switch (targetSelector) {
          case 'action':
            targetSelector = '.icon-action'
            break
          case 'bonus':
            targetSelector = '.icon-bonus'
            break
          default:
            targetSelector = null
            break
        }

        if (targetSelector) {
          const target = document.querySelector(targetSelector)

          source.addEventListener('mouseenter', () => {
            target?.classList.add('highlight')
          })

          source.addEventListener('mouseleave', () => {
            target?.classList.remove('highlight')
          })
        }
      })
    }

    if (this.animating || !this.stackedTray.active || !options.parts.includes('centerTray')) return

    this.draggableTrays.createAllDraggables()
    this.animationHandler.setAllStackedTrayPos(this.draggableTrays.draggableTrays)

    if (this.currentTray.id == 'stacked') {
      let spacerWidth =
        (this.iconSize - (((this.draggableTrays.trayCount - 1) % 3) * this.iconSize) / 3) %
        this.iconSize
      spacerWidth = spacerWidth == 0 ? 0 : spacerWidth + 14
      document
        .getElementById('auto-action-tray')
        ?.style.setProperty('--aat-stacked-spacer-width', spacerWidth + 'px')
    } else {
      document
        .getElementById('auto-action-tray')
        ?.style.setProperty('--aat-stacked-spacer-width', '0px')
    }
    return
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
class AltContextMenu extends foundry.applications.ux.ContextMenu {
  constructor(element, selector, menuItems, options, parentSelector) {
    super(element, selector, menuItems, options)
    this.parentSelector = parentSelector
  }
  async _animate(open = true) {
    const menu = this.menu
    console.log('AltContextMenu animate open')
    const newParent = document.getElementById(this.parentSelector)
    const scale = 1 / game.settings.get('auto-action-tray', 'scale')
    const menuEl = menu[0]

    const triggerRect = menuEl.parentElement.getBoundingClientRect()
    const parentRect = newParent.getBoundingClientRect()
    const menuRect = menuEl.getBoundingClientRect()

    let top = (triggerRect.top - parentRect.top) * scale
    let left = (triggerRect.left - parentRect.left + triggerRect.width + 5) * scale

    newParent.appendChild(menuEl)
    menuEl.style.position = 'absolute'
    menuEl.style.visibility = 'hidden'
    menuEl.style.top = '0px'
    menuEl.style.left = '0px'
    const measuredMenuRect = menuEl.getBoundingClientRect()
    const menuHeight = measuredMenuRect.height * scale
    const menuWidth = measuredMenuRect.width * scale
    menuEl.style.visibility = 'visible'

    const maxTop = parentRect.height * scale - menuHeight
    const maxLeft = parentRect.width * scale - menuWidth

    top = Math.min(top, Math.max(0, maxTop))
    left = Math.min(left, Math.max(0, maxLeft))

    menuEl.style.top = `${top}px`
    menuEl.style.left = `${left}px`
    menuEl.style.transformOrigin = 'top left'
    await super._animate((open = true))
  }
}
