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
import {
  gsap,
  DrawSVGPlugin,
  Draggable,
  InertiaPlugin,
  PixiPlugin,
} from '/scripts/greensock/esm/all.js'
import { TrayConfig } from './dialogs/trayConfig.js'
import { Actions } from './helpers/actions.js'
import { EffectTray } from './components/effectTray.js'
import { StackedTray } from './components/stackedTray.js'
import { TargetHelper } from './helpers/targetHelper.js'
import { QuickActionHelper } from './helpers/quickActionHelper.js'
import { ConditionTray } from './components/conditionsTray.js'
import { ReactionPromptTray } from './components/reactionPromptTray.js'
import { AATItem } from './items/item.js'
import { DraggableTrayContainer } from './handlers/draggableHandler.js'
import { ActorAbilityCache } from './helpers/abilityCache.js'
import { attachContextMenus } from './handlers/contextMenus.js'
import { mark, time, drainCounts } from './helpers/perfTrace.js'
import { activateTooltipListener, pruneTooltipSources } from './helpers/tooltipRenderer.js'

/**
 * Pass-throughs to the identically named `Actions` helper, called with the application as `this`.
 *
 * The number is how many arguments reach the helper. Foundry invokes every action as
 * `(event, target)` and most of these take none, so forwarding blindly would pass
 * `Actions.toggleRangeBoundary` the target element as its `force` argument.
 */
const DELEGATED_ACTIONS = {
  openSheet: 2,
  endTurn: 2,
  setTray: 2,
  useItem: 2,
  useSkillSave: 2,
  toggleUseSlot: 2,
  viewItem: 2,
  selectWeapon: 2,
  toggleLock: 0,
  toggleSkillTrayPage: 0,
  toggleFastForward: 0,
  toggleTargetHelper: 0,
  toggleRangeBoundary: 0,
  toggleHpText: 0,
  minimizeTray: 0,
  rollDice: 0,
  rollDeathSave: 0,
  increaseButtonAction: 0,
  decreaseButtonAction: 0,
  increaseTargetCount: 0,
  decreaseTargetCount: 0,
  confirmTargets: 0,
}

/** The same arrangement for instance methods rather than static action handlers. */
const DELEGATED_METHODS = {
  setDefaultTray: 0,
  getTrayConfig: 0,
  getTray: 1,
  deleteData: 1,
  deleteTrayData: 1,
  updateActorHealthPercent: 1,
  updateHp: 1,
}

/** One delegate, named so it appears in stack traces, returning the helper's result. */
function makeDelegate(name, arity) {
  const fn = function (...args) {
    return Actions[name].apply(this, args.slice(0, arity))
  }
  Object.defineProperty(fn, 'name', { value: name, configurable: true })
  return fn
}

export class AutoActionTray extends api.HandlebarsApplicationMixin(ApplicationV2) {
  // Runs before the static fields below, so DEFAULT_OPTIONS.actions can reference these by
  // name. Defined rather than assigned, to keep them non-enumerable like real class methods.
  static {
    for (const [name, arity] of Object.entries(DELEGATED_ACTIONS)) {
      Object.defineProperty(this, name, {
        value: makeDelegate(name, arity),
        writable: true,
        configurable: true,
      })
    }
    for (const [name, arity] of Object.entries(DELEGATED_METHODS)) {
      Object.defineProperty(this.prototype, name, {
        value: makeDelegate(name, arity),
        writable: true,
        configurable: true,
      })
    }
  }

  //#region Initialization
  constructor(options = {}) {
    super(options)
    this.socket = options.socket

    this._configureGsap()
    this._initializeState()
    this._initializeTraysAndHelpers()

    const { rowCount, columnCount, scale } = this._applyUiSettings()
    this.animationHandler = new AnimationHandler({ hotbar: this, defaultTray: 'stacked' })
    let initialHeight = this.iconSize * this.rowCount * scale + 50
    this.animationHandler.setHotbarHeight(initialHeight)

    this.draggableTrays = new DraggableTrayContainer({
      application: this,
    })

    this._registerHooks()

    if (!game.settings.get('auto-action-tray', 'customTargetingCursors')) {
      const AUTOACTIONTRAY_MODULE_NAME = 'auto-action-tray'
      libWrapper.unregister(AUTOACTIONTRAY_MODULE_NAME, 'PIXI.EventSystem.prototype.setCursor')
    }

    this.altDown = false
    this.ctrlDown = false
    this._registerModifierListeners()

    const defaultHotbar = document.querySelector('#hotbar')

    if (defaultHotbar) {
      defaultHotbar.style.visibility = 'hidden'
    }

    registerHandlebarsHelpers()
    activateTooltipListener()
    if (!game.user.isGM) {
      this.actor = game.user.character
      this.generateActorItems(this.actor)
      this.initialTraySetup(this.actor)
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

  /** Register the GSAP plugins this module uses. */
  _configureGsap() {
    // Foundry v13 defines no global `gsap`, so plugins cannot self-register.
    // InertiaPlugin must precede Draggable: Draggable caches gsap.plugins.inertia on init, and
    // draggableHandler creates Draggables with `inertia: true`. PixiPlugin finds PIXI itself.
    gsap.registerPlugin(DrawSVGPlugin, PixiPlugin, InertiaPlugin, Draggable)
    gsap.config({
      force3D: false,
      nullTargetWarn: false,
    })
  }

  /** Set every instance field to its starting value. Runs before any tray or hook exists. */
  _initializeState() {
    this.animating = false
    this.tokenDeleted = false
    this.trayMinimized = false
    this.completeAnimation = null
    // A Set, so the queue is inherently deduped. ApplicationV2 renders one part per entry in
    // `parts`, and a repeated id builds that part twice in the same pass.
    this.renderQueue = new Set()
    this.pendingRender = false
    this.suspendRenders = false

    // Resolved by completeRender once the queue it drains has actually rendered. See
    // #nextRenderPromise.
    this._nextRender = null
    this._resolveNextRender = null

    this.throttledRender = foundry.utils.throttle(() => this.completeRender(), 500)
    this.throttledHover = foundry.utils.throttle((...args) => this.handleHoverToken(...args), 100)

    this.#dragDrop = this.#createDragDropHandlers()
    this.isEditable = true

    this.actor = null
    this.token = null

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

    this.abilityCache = new ActorAbilityCache()

    this.itemConfigItem = null
    this.skillTray = null

    this.activeEffects = []
    this.concentrationItem = null

    this.itemSelectorEnabled = false
    this.rangeBoundaryEnabled = true
    this.currentDice = 0
    this.dice = ['20', '12', '10', '8', '6', '4', '100']
    this.trayInformation = ''
    this.trayOptions = AutoActionTray.defaultTrayOptions()
  }

  /**
   * Per-actor defaults, before the saved `config` flag merges over them. Fresh each call:
   * `customStaticTrays` is mutable and must not be shared between actors.
   */
  static defaultTrayOptions() {
    return {
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
  }

  /** Construct the trays and helpers that live for the whole session, not per actor. */
  _initializeTraysAndHelpers() {
    this.targetHelper = new TargetHelper({ hotbar: this, socket: this.socket })
    this.stackedTray = new StackedTray({
      id: 'stacked',
      hotbar: this,
      type: 'stacked',
      name: 'stacked',
    })
    this.effectsTray = new EffectTray()
    this.combatHandler = new CombatHandler({
      hotbar: this,
    })
    this.quickActionHelper = new QuickActionHelper({
      app: this,
      targetHelper: this.targetHelper,
      combatHandler: this.combatHandler,
    })
    this.conditionTray = new ConditionTray({ application: this })
    this.reactionPromptTray = new ReactionPromptTray({ application: this })
  }

  /**
   * Read the layout settings and publish them as CSS custom properties on the document root.
   *
   * @returns {{rowCount: number, columnCount: number, scale: number}} the values the caller needs
   *   to size the tray before its first render.
   */
  _applyUiSettings() {
    const scale = game.settings.get('auto-action-tray', 'scale') ?? 0.6
    const rowCount = game.settings.get('auto-action-tray', 'rowCount') ?? 2
    const columnCount = game.settings.get('auto-action-tray', 'columnCount') ?? 10
    const bgOpacity = game.settings.get('auto-action-tray', 'bgOpacity')

    document.documentElement.style.setProperty('--aat-scale', scale)
    document.documentElement.style.setProperty('--aat-item-tray-item-height-count', rowCount)
    document.documentElement.style.setProperty('--aat-item-tray-item-width-count', columnCount)

    if (bgOpacity != null) {
      const hex = Math.floor(bgOpacity * 255)
        .toString(16)
        .padStart(2, '0')
      document.documentElement.style.setProperty('--aat-background-color', `#5b5b5b${hex}`)
    }

    this.quickActionHelperEnabled = game.settings.get('auto-action-tray', 'quickActionHelper')
    this.rowCount = rowCount
    this.columnCount = columnCount
    this.totalAbilities = rowCount * columnCount
    this.iconSize = 100

    return { rowCount, columnCount, scale }
  }

  /**
   * Registered through #on so the ids can be released in destroy(). Some hooks are intentionally
   * bound twice: 'deleteToken' drives both tray minimise and the quick-action grid cache.
   */
  _registerHooks() {
    this.#on('controlToken', this._onControlToken.bind(this))
    this.#on('deleteToken', this._onDeleteToken.bind(this))
    this.#on('updateActor', this._onUpdateActor.bind(this))
    this.#on('updateItem', this._onUpdateItem.bind(this))
    this.#on('dropCanvasData', (canvas, data) => this._onDropCanvas(data))
    this.#on('dnd5e.beginConcentrating', (actor) => {
      if (actor == this.actor) this.requestRender('characterImage')
    })
    this.#on('dnd5e.endConcentration', (actor) => {
      if (actor == this.actor) this.requestRender('characterImage')
    })
    this.#on('updateCombat', this._onUpdateCombat.bind(this))
    this.#on('deleteCombatant', this._onUpdateCombat.bind(this))
    this.#on('createCombatant', this._onCreateCombatant.bind(this))
    this.#on('updateCombatant', this._onUpdateCombat.bind(this))
    this.#on('combatStart', this._onUpdateCombat.bind(this))
    this.#on('deleteCombat', this._onCombatDelete.bind(this))
    this.#on('createItem', CustomTray._onCreateItem.bind(this))
    this.#on('deleteItem', CustomTray._onDeleteItem.bind(this))
    this.#on('createActiveEffect', this._onCreateActiveEffect.bind(this))
    this.#on('deleteActiveEffect', this._onDeleteActiveEffect.bind(this))
    this.#on('updateActiveEffect', this._onUpdateActiveEffect.bind(this))
    this.#on('hoverToken', this._onHoverToken.bind(this))
    this.#on('collapseSidebar', this._onCollapseSidebar.bind(this))
    // The quick-action ring depends on what currently occupies the grid, so any token appearing,
    // moving or leaving invalidates it.
    this.#on('updateToken', this._onGridOccupancyChanged)
    this.#on('createToken', this._onGridOccupancyChanged)
    this.#on('deleteToken', this._onGridOccupancyChanged)

    if (
      game.settings.get('auto-action-tray', 'interceptMidiReactions') &&
      game.modules.get('midi-qol')?.active
    ) {
      this.#on('renderReactionDialog', this._onRenderReactionDialog.bind(this))
      this.#on('closeReactionDialog', this._onCloseReactionDialog.bind(this))
    }
  }

  /** Hooks.on, remembering the id so destroy() can unregister it. */
  #on(hook, handler) {
    this.#hookIds.push([hook, Hooks.on(hook, handler)])
  }

  #hookIds = []
  #windowListeners = []

  /**
   * Release the hooks and window listeners. Nothing calls this today - the tray is a session-long
   * singleton - but it must never be wired to _onClose: close() means "hide" here (minimizeTray
   * closes, then re-renders the same instance), so releasing 'controlToken' there leaves the tray
   * unable to notice the next token selection.
   */
  destroy() {
    for (const [hook, id] of this.#hookIds) Hooks.off(hook, id)
    this.#hookIds = []
    for (const [type, handler] of this.#windowListeners) {
      window.removeEventListener(type, handler)
    }
    this.#windowListeners = []
    clearTimeout(this._animationSafetyTimer)
  }

  /**
   * Replace midi-qol's reaction popup with the tray's own prompt row.
   *
   * ReactionDialog is internal to midi-qol and never exported, so this relies on undocumented
   * internals and bails out to the native popup whenever the shape is not what we expect.
   */
  _onRenderReactionDialog(dialogApp, element) {
    // ReactionDialog is internal to midi-qol and never exported, so this relies on undocumented
    // internals. Bail out and let the native popup show if the shape is not what we expect.
    if (
      typeof dialogApp?.data?.buttons != 'object' ||
      typeof dialogApp?.submit != 'function' ||
      typeof dialogApp?.close != 'function'
    ) {
      return
    }
    // Only intercept reactions for the actor currently shown in this client's tray.
    if (dialogApp.data.actor?.uuid !== this.actor?.uuid) return

    // ApplicationV2 with height:'auto' re-renders once to settle its height, firing this hook
    // twice per popup. Without the guard, pushTray() stacks a second entrance tween.
    if (this.reactionPromptTray.dialogApp === dialogApp) {
      element.style.display = 'none'
      return
    }

    element.style.display = 'none'
    this.reactionPromptTray.intercept(dialogApp, this)
    // midi-qol can call dialog.close() almost immediately after the user picks a choice (before
    // the activity even resolves). Track when the entrance tween genuinely finishes so a close
    // that lands mid-entrance can wait for it instead of reversing the tween mid-flight.
    this.reactionPromptTray.enterPromise = (async () => {
      await this.animationHandler.pushTray('reaction-prompt')
      await this.completeAnimation
      this.reactionPromptTray.entered = true
    })()
  }

  /** Hook entry point for a reaction dialog closing. */
  _onCloseReactionDialog(dialogApp) {
    // Fallback only: timeouts, GM force-closes. A user click animates directly via
    // closeReactionPrompt, because this hook fires only after ApplicationV2.close() completes.
    return this.closeReactionPrompt(dialogApp)
  }

  /** Retract the reaction prompt row, waiting out any entrance tween still in flight. */
  async closeReactionPrompt(dialogApp) {
    if (this.reactionPromptTray.dialogApp !== dialogApp) return
    // midi's ReactionDialog.submit() calls close() twice per selection; without this guard both
    // run popTray() concurrently, producing competing tweens on one element.
    if (this.reactionPromptTray.closing) return
    this.reactionPromptTray.closing = true

    this.reactionPromptTray.stopTicking()
    // Let the entrance tween finish before starting the exit tween, otherwise GSAP has to
    // reverse/kill it mid-flight, which is a second source of glitchy animation.
    if (this.reactionPromptTray.enterPromise) await this.reactionPromptTray.enterPromise
    await this.animationHandler.popTray()
    // animateTrays() resolves tray state only once endAnimation() fires, which completeAnimation
    // tracks. Rendering before that rips the DOM out from under a running tween.
    await this.completeAnimation
    // No render here: animateTrays() already renders and then re-applies the stacked containers'
    // GSAP transforms via setStackedTrayPos(). A render after that compensation resets them.
    this.reactionPromptTray.reset()
  }

  /**
   * Alt/Ctrl highlight, driven by one class on the tray root (`.modifiers-active` in core.scss)
   * rather than a class per node - keydown repeats at the OS key-repeat rate while a key is held.
   *
   * Both modifiers together leave the current highlight in place; any keyup clears it.
   */
  _registerModifierListeners() {
    this.#onWindow('keydown', (e) => {
      if (e.altKey) this.altDown = true
      if (e.ctrlKey) this.ctrlDown = true
      if ((this.altDown && this.ctrlDown) || (!this.altDown && !this.ctrlDown)) {
        return
      }
      // Exactly one modifier is down by this point, so ctrl is the only remaining alternative.
      this.#applyModifierHighlight(this.altDown ? 'rgb(0, 173, 0)' : 'rgb(173, 0, 0)')
    })

    this.#onWindow('keyup', (e) => {
      if (!e.altKey) this.altDown = false
      if (!e.ctrlKey) this.ctrlDown = false
      this.#applyModifierHighlight('')
    })
  }

  /** window.addEventListener, remembering the handler so destroy() can remove it. */
  #onWindow(type, handler) {
    this.#windowListeners.push([type, handler])
    window.addEventListener(type, handler)
  }

  /** Empty string clears the highlight. No-ops when the requested state is already applied. */
  #applyModifierHighlight(color) {
    if (this.#modifierHighlight === color) return
    this.#modifierHighlight = color
    // Not this.element: these listeners are registered in the constructor, before the first
    // render, and the root element is the one node that survives every part render.
    const root = document.getElementById('auto-action-tray')
    if (!root) return
    root.style.setProperty('--aat-modifier-highlight-color', color)
    root.classList.toggle('modifiers-active', color !== '')
  }

  #modifierHighlight = ''

  //#region Appv2 Configuration
  static DEFAULT_OPTIONS = {
    tag: 'form',
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],
    form: {
      handler: AutoActionTray.onHpSubmit,
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
      increaseButtonAction: AutoActionTray.increaseButtonAction,
      decreaseButtonAction: AutoActionTray.decreaseButtonAction,
      removeConcentration: AutoActionTray.removeConcentration,
      reactionPromptSelect: AutoActionTray.reactionPromptSelect,
      reactionPromptDecline: AutoActionTray.reactionPromptDecline,
    },
  }

  static PARTS = {
    characterImage: {
      template: 'modules/auto-action-tray/templates/topParts/character-image.hbs',
      id: 'character-image',
      forms: {
        '.hpinput': AutoActionTray.onHpSubmit,
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
    if (this.tokenDeleted) {
      Actions.minimizeTray.bind(this)()
      this.tokenDeleted = false
    }
    if (event?.actor?.type === 'vehicle' || event?.actor?.type === 'group') return
    if (this.targetHelper.getState() >= this.targetHelper.STATES.TARGETING) return
    this.hpTextActive = false
    if (event == null || controlled == false || this.actor == event.actor) return
    if (controlled == true && this.actor != event.actor) {
      this.actor = event.actor ? event.actor : event
      this.token = event
      this.initialTraySetup(this.actor, event).catch((err) => {
        console.error('AAT | Failed to set up tray for the selected token.', err)
        ui.notifications?.error(
          'Auto Action Tray: failed to load actions for this token — see console (F12).',
        )
      })
    }
  }

  /** Minimise the tray when the token it is showing is removed from the scene. */
  _onDeleteToken = (event) => {
    // `this.actor` is null until the first token is controlled (the GM path never assigns it up
    // front), so both links have to be optional or deleting any token before that throws.
    if (event.id === this.actor?.token?.id && this.trayMinimized === false) {
      this.tokenDeleted = true
      Actions.minimizeTray.bind(this)()
    }
  }

  /** Re-measure the tray when the sidebar collapses, since it changes the available height. */
  _onCollapseSidebar(sidebar, collapsed) {
    this.animationHandler.animateSidebarHeight()
  }

  //#region Actor/Item Management
  // Thin forwarders onto ActorAbilityCache, which owns the savedActors LRU and its keying rules.
  // They stay here because trays, dialogs and drag handlers reach the cache via the hotbar.

  /** The cache entries, for callers that still read the list directly. */
  get savedActors() {
    return this.abilityCache.entries
  }

  /**
   * Ensure the cache holds a current ability list for this actor.
   *
   * @param {Actor5e} actor
   * @param {Token|null} token  The Token placeable just selected (callers pass `event.target`),
   *                            or null to fall back to the actor's own token document.
   */
  async generateActorItems(actor, token = null) {
    const cacheToken = token == null ? this.abilityCache.getCacheToken(actor) : token.document
    const savedActor = this.abilityCache.find(actor, cacheToken)

    if (savedActor) {
      this.abilityCache.sync(savedActor, actor)
      this.checkTrayDiff()
      return
    }

    this.abilityCache.populate(actor, cacheToken)
  }

  /** The token document the cache keys this actor against. */
  getCacheToken(actor) {
    return this.abilityCache.getCacheToken(actor)
  }

  /** The cache entry for this actor/token pair, or undefined. */
  getSavedActor(actor, token) {
    return this.abilityCache.find(actor, token)
  }

  /** Drop this actor's cache entry, so the next selection rebuilds it from scratch. */
  deleteSavedActor(actor, token) {
    this.abilityCache.delete(actor, token)
  }

  /** The cached AATItem list for an actor uuid. Shared by reference with every tray. */
  getActorAbilities(actorUuid) {
    return this.abilityCache.abilitiesForUuid(actorUuid)
  }

  /** Remove one ability from the current actor's cache entry. */
  deleteActorAbility(itemId) {
    // Keyed the same way as getSavedActor/deleteSavedActor. Matching on actor id alone picked
    // the first cache entry, so with two unlinked copies of one NPC on the scene the ability was
    // dropped from whichever copy happened to be cached first rather than the selected one.
    this.abilityCache.deleteAbility(this.actor, itemId)
  }

  //#region Themes
  /** The theme applied to an NPC, by its dnd5e creature type. */
  static THEME_BY_CREATURE_TYPE = {
    aberration: 'theme-warlock',
    beast: 'theme-ranger',
    celestial: 'theme-cleric',
    construct: 'theme-fighter',
    dragon: 'theme-barbarian',
    elemental: 'theme-bard',
    fey: 'theme-sorcerer',
    fiend: 'theme-ember',
    giant: 'theme-titan',
    humanoid: 'theme-slate',
    monstrosity: 'theme-rogue',
    ooze: 'theme-artificer',
    plant: 'theme-druid',
    undead: 'theme-subterfuge',
  }

  static DEFAULT_CREATURE_THEME = 'theme-slate'

  /** Work out which theme an actor should use, without applying it. */
  #themeForActor(actor) {
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
      return highestLevelClass.name
        ? 'theme-' + highestLevelClass.name.toLowerCase()
        : game.settings.get('auto-action-tray', 'theme')
    }

    const details = actor.system.details.type
    // Goblinoids are the one subtype that overrides its creature type; every other humanoid
    // falls through to the map's own 'theme-slate'.
    if (details.value === 'humanoid' && details.subtype === 'Goblinoid') return 'theme-monk'
    return (
      AutoActionTray.THEME_BY_CREATURE_TYPE[details.value] ?? AutoActionTray.DEFAULT_CREATURE_THEME
    )
  }

  /** Apply the actor's theme, skipping the write when it is already the active one. */
  setTheme(actor) {
    const theme = this.#themeForActor(actor)
    // game.settings.set is async and fires the setting's onChange even when the value is
    // identical, so an unguarded write re-applied the theme on every single token select.
    if (game.settings.get('auto-action-tray', 'tempTheme') === theme) return
    game.settings.set('auto-action-tray', 'tempTheme', theme)
  }

  //#region Tray Setup
  async initialTraySetup(actor, token = null, currentTrayId = null) {
    // Setup rebuilds the whole tray, and several steps along the way each request a render of
    // their own. They are collected into renderQueue and flushed once at the end instead.
    this.suspendRenders = true
    try {
      return await this.#runInitialTraySetup(actor, token, currentTrayId)
    } finally {
      // Still suspended here means the flush at the end of the run was never reached, i.e. it
      // threw partway through. Release the queue rather than leaving the tray unrendered until
      // something else happens to ask.
      const missedFlush = this.suspendRenders
      this.suspendRenders = false
      if (missedFlush && this.renderQueue.size > 0) this.throttledRender()
    }
  }

  /**
   * Rebuild every tray for `actor` and render once at the end.
   *
   * Renders stay suspended for the duration - see initialTraySetup, which owns that flag and
   * releases it if this throws. `currentTrayId` reopens the tray that was showing before, which is
   * how re-selecting the same token keeps your place.
   */
  async #runInitialTraySetup(actor, token = null, currentTrayId = null) {
    if (this.selectingActivity == true) {
      this.activityTray.rejectActivity(new Error('User canceled activity selection'))
      this.activityTray.rejectActivity = null
      this.spellLevelTray.rejectActivity(new Error('User canceled activity selection'))
      this.spellLevelTray.rejectActivity = null
    }

    let config = this.getTrayConfig()

    if (config?.rowCount && this.rowCount != config.rowCount) {
      this.rowCount = config.rowCount
      this.totalAbilities = this.rowCount * this.columnCount
    }
    if (!config?.rowCount) {
      this.rowCount = game.settings.get('auto-action-tray', 'rowCount')
      this.totalAbilities = this.rowCount * this.columnCount
    }

    const endSetup = time(`setup "${actor.name}" (${actor.items.size} items)`)
    await mark('  items', () => this.generateActorItems(actor, token))
    mark('  trays', () => this.generateTrays(this.actor))
    endSetup()
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
    this.trayOptions = AutoActionTray.defaultTrayOptions()

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
    const firstsetup = this.element == null
    document
      .getElementById('auto-action-tray')
      ?.style.setProperty('--aat-item-tray-item-height-count', this.rowCount)
    // One render for the whole setup: the parts this function is responsible for, unioned with
    // whatever queued up while renders were suspended. completeRender() drains renderQueue, so
    // nothing that was requested along the way is lost.
    for (const part of ['characterImage', 'centerTray', 'equipmentMiscTray', 'skillTray']) {
      this.renderQueue.add(part)
    }
    this.suspendRenders = false
    await mark('  setup render', () => this.completeRender())
    if (firstsetup) {
      this.animationHandler.animateAATHidden.bind(this)(true)
    }
  }

  /**
   * Build every tray from the actor's cached abilities.
   *
   * The ability list is fetched once and passed into each generator as `cachedAbilities`, so the
   * trays share one array rather than each re-reading and re-sorting the cache.
   */
  generateTrays(actor) {
    let abilities = this.getActorAbilities(actor.uuid)
    this.staticTrays = StaticTray.generateStaticTrays(actor, {
      application: this,
      cachedAbilities: abilities,
    })
    // Keep the skip-check in rebuildStaticTrays in step with what was just built, so the next
    // updateActor does not rebuild trays that are already current.
    this._staticTrayFp = {
      actorId: actor.id,
      fingerprint: this.staticTrayFingerprint(actor, abilities),
    }
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

  /** Point the long-lived helpers at a new actor. */
  setActor(actor) {
    this.actorHealthPercent = this.updateActorHealthPercent(actor)
    this.effectsTray.setActor(actor, this)
    this.combatHandler.setActor(actor)
    this.conditionTray.setActor(actor)
    this.stackedTray.setActor(actor)
  }

  /**
   * Reconcile every tray against the actor's current items, dropping slots whose item is gone and
   * refreshing those whose wrapper was rebuilt.
   */
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

  /**
   * Refresh the tray when one of the actor's items changes.
   *
   * Rebuilds the static trays unconditionally: an edited item changes what a tray contains without
   * moving any of the actor-level state the fingerprint covers.
   */
  _onUpdateItem(item, change, options, userId) {
    if (item.actor != this.actor) return

    const abilities = this.getActorAbilities(this.actor.uuid)
    const index = abilities.findIndex((e) => e.id === item.id)

    if (index !== -1) {
      // safeCreate, as in ActorAbilityCache: a malformed item would otherwise put a half-built
      // wrapper into the shared cache. No multigroup carry-over needed - multiattack highlighting
      // lives on the tray (CustomNpcTray.multiattackTags) and survives an item rebuild.
      const newItem = AATItem.safeCreate(item, this.actor)
      if (newItem) {
        abilities[index] = newItem
      }
    }

    // force: an edited item changes what a tray contains without changing any of the actor-level
    // state the fingerprint covers, so this path must never be skipped.
    this.rebuildStaticTrays(this.actor, abilities, { force: true })
    this.effectsTray.setEffects()
    this.stackedTray.setActor(this.actor)
    this.checkTrayDiff()
    this.requestRender('centerTray')
  }

  /**
   * Signature over exactly the actor state generateStaticTrays reads: spell slot
   * levels/values/maxes, the legendary action resource, and the identity of the ability list.
   */
  staticTrayFingerprint(actor, abilities) {
    const spells = actor.system?.spells ?? {}
    const slots = Object.keys(spells)
      .map((k) => `${k}:${spells[k]?.level}:${spells[k]?.value}:${spells[k]?.max}`)
      .join('|')
    return [
      slots,
      actor.system?.resources?.legact?.max ?? 0,
      abilities.length,
      abilities[abilities.length - 1]?.id ?? '',
    ].join('~')
  }

  /**
   * Rebuild the static trays, skipping the work when nothing they depend on moved. `updateActor`
   * fires on every point of damage, and rebuilding ~10 trays per HP tick dominated that handler.
   */
  rebuildStaticTrays(actor, abilities, { force = false } = {}) {
    const fingerprint = this.staticTrayFingerprint(actor, abilities)
    const unchanged =
      !force &&
      this._staticTrayFp?.actorId === actor.id &&
      this._staticTrayFp?.fingerprint === fingerprint &&
      !game.settings.get('auto-action-tray', 'strictTrayRebuild')

    if (unchanged) return false

    this.staticTrays = StaticTray.generateStaticTrays(actor, {
      application: this,
      cachedAbilities: abilities,
    })
    // Keyed with the actor id so switching tokens can never read another actor's signature.
    this._staticTrayFp = { actorId: actor.id, fingerprint }
    this.currentTray = this.getTray(this.currentTray.id)
    this.currentTray.setActive()
    return true
  }

  //#region Hooks Handlers
  async _onUpdateActor(actor, change, options, userId) {
    if (actor != this.actor || Object.keys(change).includes('flags')) return
    this.rebuildStaticTrays(actor, this.getActorAbilities(actor.uuid))
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

  /** Forward combat changes to the combat handler, but only while the actor is in combat. */
  _onUpdateCombat = (event) => {
    if (this.combatHandler == null || this.combatHandler.inCombat == false) return
    this.combatHandler.updateCombat(this.actor, event)
  }
  /** Tear down combat state when the encounter itself is deleted. */
  _onCombatDelete = (event) => {
    if (this.combatHandler == null) return
    this.combatHandler.updateCombat(this.actor, event)
  }
  /** Invalidate the quick-action reachability cache when anything moves on the grid. */
  _onGridOccupancyChanged = () => {
    if (!this.quickActionHelperEnabled) return
    this.quickActionHelper.invalidateAvailablePositions()
  }

  /** Start tracking combat when this actor is the one added to the encounter. */
  _onCreateCombatant = (event) => {
    if (this.actor != event.actor) return
    this.combatHandler.setCombat(this.actor, event)
  }

  /**
   * Shared by the create/delete/update activeEffect hooks, which differ only in what they redraw.
   *
   * `parts` must be an array: requestRender's signature is (partID, force), so a second string
   * argument reads as a truthy force flag. Null means "redraw only if the condition tray is open".
   */
  #onActiveEffectChanged(effect, parts) {
    if (effect.parent != this.actor) return
    this.effectsTray.setEffects()
    const onConditionTray = this.currentTray.id == 'condition'
    if (onConditionTray) this.conditionTray.setConditions()

    if (parts) this.requestRender(parts)
    else if (onConditionTray) this.requestRender('centerTray')
  }

  // The three activeEffect hooks, differing only in what each redraws.
  _onCreateActiveEffect = (effect) => {
    this.#onActiveEffectChanged(effect, ['centerTray', 'characterImage'])
  }
  _onDeleteActiveEffect = (effect) => {
    this.#onActiveEffectChanged(effect, ['centerTray', 'characterImage'])
  }
  _onUpdateActiveEffect = (effect) => {
    this.#onActiveEffectChanged(effect, null)
  }

  /**
   * The not-targeting tail shared by _onTokenSelect and _canControl. Clicking the token already
   * shown rebinds the tray to it - one actor can sit behind several unlinked tokens - keeping the
   * open tray. Core's handler always runs afterwards.
   */
  static #resumeTraySetup(hotbar, event, wrapped, args) {
    if (event.target.actor == hotbar.actor && hotbar.currentTray) {
      hotbar.initialTraySetup(hotbar.actor, event.target, hotbar.currentTray.id)
    }
    return wrapped(...args)
  }

  /**
   * Wraps Token.prototype._onClickLeft. While targeting, a click picks a target instead of
   * selecting; otherwise it falls through to core selection.
   */
  static _onTokenSelect(hotbar, wrapped, ...args) {
    const [, event] = args

    if (!event) {
      return wrapped(...args)
    }

    if (hotbar.targetHelper.getState() >= hotbar.targetHelper.STATES.TARGETING) {
      // Clicking your own token while targeting falls through to normal selection rather than
      // targeting yourself.
      if (event.target.actor == hotbar.actor) {
        return wrapped(...args)
      }
      hotbar.targetHelper.selectTarget(event.currentTarget)
      return event.stopPropagation()
    }
    return AutoActionTray.#resumeTraySetup(hotbar, event, wrapped, args)
  }

  /**
   * Wraps Token.prototype._canControl, which fires for clicks that never reach _onClickLeft.
   * Same targeting interception, minus the click-your-own-token exemption.
   */
  static _canControl(hotbar, wrapped, ...args) {
    // Set only while the quick-action helper is taking control of a token to move it, so the
    // targeting interception below does not swallow that call.
    if (hotbar.quickActionHelper?.controllable) {
      return wrapped(...args)
    }
    const [, event] = args

    if (!event) {
      return wrapped(...args)
    }

    if (hotbar.targetHelper.getState() >= hotbar.targetHelper.STATES.TARGETING) {
      hotbar.targetHelper.selectTarget(event.currentTarget)
      return event.stopPropagation()
    }
    return AutoActionTray.#resumeTraySetup(hotbar, event, wrapped, args)
  }

  /** Hook entry point for token hover. Throttled, because hover fires at pointer rate. */
  _onHoverToken(token, hovered) {
    this.throttledHover(token, hovered)
  }

  /** Trays whose contents are not quick-actionable, so hovering a token must not arm one. */
  static QUICK_ACTION_INVALID_TRAYS = new Set(['target-helper', 'activity', 'spellLevel'])

  /** Update targeting state, the quick-action ring and the in-range pips for a hovered token. */
  handleHoverToken(token, hovered) {
    if (!this.actor) return
    if (this.targetHelper.getState() >= this.targetHelper.STATES.TARGETING && hovered) {
      this.targetHelper.setState('HOVERING')
    } else if (this.targetHelper.getState() >= this.targetHelper.STATES.TARGETING && !hovered) {
      this.targetHelper.setState('TARGETING')
    }

    this.#updateQuickActionOnHover(token, hovered)
    this.#updateRangeHighlightOnHover(token, hovered)
  }

  /** Arm or disarm the quick-action ring for the hovered token. */
  #updateQuickActionOnHover(token, hovered) {
    if (!this.quickActionHelperEnabled) return

    const { quickActionHelper, combatHandler, currentTray } = this
    if (quickActionHelper.getState() === quickActionHelper.STATES.ATTACKING) return

    const dis1 = this.actor?.token?.disposition ?? this.actor?.prototypeToken?.disposition
    const dis2 = token?.document?.disposition

    const quickState = quickActionHelper.getState()
    const isValidQuickState =
      quickState === quickActionHelper.STATES.ACTIVE ||
      quickState === quickActionHelper.STATES.TARGETTING

    const canQuickAct =
      !AutoActionTray.QUICK_ACTION_INVALID_TRAYS.has(currentTray?.id) &&
      quickActionHelper.hasActiveSlot() &&
      dis1 !== dis2 &&
      isValidQuickState &&
      combatHandler.inCombat &&
      combatHandler.isTurn

    if (!canQuickAct) return

    if (hovered) {
      quickActionHelper.startQuickAction()
      quickActionHelper.displayTokenGhost(token)
    } else {
      quickActionHelper.cancelQuickAction()
      quickActionHelper.removeTokenGhost()
    }
  }

  /** Fade the "in range" pips in or out for the hovered token. */
  #updateRangeHighlightOnHover(token, hovered) {
    // Read live rather than cached: enableRangeHover is registered with requiresReload: false,
    // so it can be toggled mid-session.
    const hoverEnabled = game.settings.get('auto-action-tray', 'enableRangeHover')
    if (!hoverEnabled || !token || token == this.token || !this.token) return

    const root = this.element
    if (!root) return

    if (!hovered) {
      const allItems = root.querySelectorAll('.in-range')
      if (allItems.length > 0) {
        gsap.to(allItems, {
          opacity: 0,
          duration: 0.2,
          overwrite: true,
        })
      }
      return
    }

    const xDist = Math.abs(this.token.x - token.x) / canvas.grid.size
    const yDist = Math.abs(this.token.y - token.y) / canvas.grid.size
    const distance = Math.ceil(Math.abs(Math.max(xDist, yDist))) * 5

    const targetElements = []
    for (const el of root.querySelectorAll('[data-action-range]')) {
      const range = parseFloat(el.getAttribute('data-action-range'))
      if (range == 0 || isNaN(range) || range < distance) continue
      const pip = el.querySelector('.in-range')
      if (pip) targetElements.push(pip)
    }
    if (targetElements.length != 0) {
      gsap.to(targetElements, { opacity: 0.9, overwrite: true })
    }
  }

  /** Wraps Token.prototype._onClickLeft2 (double-click). */
  static _onTokenDoubleClick(hotbar, wrapped, ...args) {
    const [event] = args

    if (!event) {
      return wrapped(...args)
    }

    if (hotbar.targetHelper.getState() >= hotbar.targetHelper.STATES.TARGETING) {
      let token = event.currentTarget

      hotbar.targetHelper.selectTarget(token)
      return event.stopPropagation()
    } else return wrapped(...args)
  }
  // Runs at pointer-move rate for the whole targeting session; only the #board lookup is cached.
  // The style write must stay unconditional: PIXI's setCursor early-returns on an unchanged mode,
  // and something else resets board.style.cursor between moves, so caching loses the crosshair.
  static #CROSSHAIR = "url('modules/auto-action-tray/icons/cursors/Crosshair.cur') 16 16, auto"
  static #boardEl = null

  /** Wraps PIXI.EventSystem.prototype.setCursor to force a crosshair while targeting. */
  static _onCursorChange(hotbar, wrapped, ...args) {
    if (hotbar.targetHelper.getState() >= hotbar.targetHelper.STATES.TARGETING) {
      if (!AutoActionTray.#boardEl?.isConnected) {
        AutoActionTray.#boardEl = document.getElementById('board')
      }
      if (AutoActionTray.#boardEl) {
        AutoActionTray.#boardEl.style.cursor = AutoActionTray.#CROSSHAIR
      }
      return wrapped(AutoActionTray.#CROSSHAIR)
    } else {
      return wrapped(...args)
    }
  }
  /** Right-click removes a target while targeting, rather than opening the usual menu. */
  static _onTokenCancel(hotbar, wrapped, ...args) {
    const event = args[0]
    if (hotbar.targetHelper.getState() >= hotbar.targetHelper.STATES.TARGETING) {
      let token = event.interactionData.object
      hotbar.targetHelper.removeTarget(token)
      return event.stopPropagation()
    } else return wrapped(...args)
  }

  /** Submit handler for the inline HP field on the character portrait. */
  static async onHpSubmit(event, form, formData) {
    let data = foundry.utils.expandObject(formData.object)
    this.updateHp(data.hpinputText)
    this.hpTextActive = false
  }

  //#region Rendering
  /**
   * Built once per render. ApplicationV2 calls _preparePartContext once per entry in `parts`, so
   * assembling this there rebuilt all 35 fields for every part.
   */
  async _prepareContext(options) {
    return {
      actor: this.actor,
      animating: this.animating,
      totalAbilities: this.totalAbilities,
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
      reactionPromptTray: this.reactionPromptTray,
    }
  }

  /** Give each part its own partId over a shallow copy of the shared context. */
  async _preparePartContext(partId, context, options) {
    // Shallow copy: parts must not see each other's partId, but every value below it is shared
    // state the templates only read.
    return { ...context, partId: `${this.id}-${partId}` }
  }

  /**
   * Take the animation lock and open `completeAnimation` for callers that need to wait it out.
   *
   * A safety timer force-releases the lock after 4s: a tween that never resolves would otherwise
   * leave the tray permanently frozen, since renders defer while `animating` is set.
   */
  startAnimation() {
    this.animating = true
    this.completeAnimation = new Promise((resolve) => {
      this._resolveAnimation = resolve
    })
    clearTimeout(this._animationSafetyTimer)
    this._animationSafetyTimer = setTimeout(() => {
      if (this.animating) {
        console.warn(
          'AAT | Animation lock exceeded safety timeout — force-unlocking to avoid a frozen tray. This indicates an animation promise failed to resolve.',
        )
        this.endAnimation()
      }
    }, 4000)
  }

  /** Release the animation lock and resolve `completeAnimation`. */
  endAnimation() {
    this.animating = false
    clearTimeout(this._animationSafetyTimer)
    this._animationSafetyTimer = null
    if (this._resolveAnimation) {
      this._resolveAnimation()
      this._resolveAnimation = null
    }
  }

  /**
   * Queue parts for rendering. The returned promise settles when the render covering this call
   * finishes: the throttled one (up to 500ms out, possibly another caller's) unless `force`.
   */
  async requestRender(partID, force = false) {
    const arr = Array.isArray(partID) ? partID : [partID]
    for (const part of arr) this.renderQueue.add(part)

    // initialTraySetup is mid-flight and will flush this queue itself. Rendering now would draw
    // a half-built tray and then immediately be superseded.
    if (this.suspendRenders) return

    if (this.pendingRender && !force) return this.#nextRenderPromise()

    if (this.animating && !force) {
      this.pendingRender = true
      await this.completeAnimation
    }

    if (force) {
      await this.completeRender()
      return
    }
    // Captured before scheduling: foundry.utils.throttle defers the callback behind a setTimeout
    // and returns undefined, so there is nothing to await at this point. The deferred below is
    // what lets a caller wait for the render this request will be folded into.
    const settled = this.#nextRenderPromise()
    this.throttledRender()
    return settled
  }

  /**
   * Promise for the next completed render, shared by every waiter. completeRender resolves and
   * clears it after draining the queue, so the next request starts a fresh one.
   */
  #nextRenderPromise() {
    this._nextRender ??= new Promise((resolve) => {
      this._resolveNextRender = resolve
    })
    return this._nextRender
  }

  /** Drain the render queue and render exactly those parts. */
  async completeRender() {
    const tmp = [...this.renderQueue]
    this.renderQueue.clear()
    const resolveWaiters = this._resolveNextRender
    this._nextRender = null
    this._resolveNextRender = null
    const endRender = time(`render [${tmp.join(', ')}]`)
    try {
      await this.render({ parts: tmp })
    } finally {
      // Settled even if the render throws: a waiter blocked here would otherwise hang forever.
      resolveWaiters?.()
    }
    endRender(drainCounts())
    this.pendingRender = false
  }

  /**
   * Rebind everything that a re-rendered part throws away: drag/drop, range-boundary hovers and
   * action-type highlights, plus the stacked tray's GSAP positions.
   *
   * Listeners are marked with data-aat-*-bound so nodes that survived the render are not bound a
   * second time.
   */
  _onRender(context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element))
    pruneTooltipSources()

    if (options.parts.includes('characterImage')) {
      if (this.hpTextActive) {
        // Optional: another render landing inside this 100ms window replaces the part, and the
        // resulting TypeError would be thrown from a timer where nothing can catch it.
        setTimeout(() => this.element?.querySelector('.hpinput')?.focus(), 100)
      }
    }

    // Outside the centerTray gate: [data-action-range] nodes render under both centerTray
    // (item.hbs) and equipmentMiscTray (equip-tray.hbs). The marker stops nodes that survived a
    // render from being bound twice.
    if (this.trayOptions['rangeBoundaryEnabled']) {
      this.element.querySelectorAll('[data-action-range]').forEach((node) => {
        if (node.dataset.aatRangeBound || !(parseInt(node.dataset.actionRange) > 0)) return
        node.dataset.aatRangeBound = '1'
        node.addEventListener('mouseenter', () => {
          this.targetHelper.createRangeBoundary(node.dataset.actionRange / 5, this.actor)
        })
        node.addEventListener('mouseleave', () => {
          this.targetHelper.destroyRangeBoundary()
        })
      })
    }

    if (options.parts.includes('centerTray')) {
      // A node removed mid-hover never fires its mouseleave, so clear any pip left lit.
      this.element.querySelectorAll('.highlight').forEach((el) => el.classList.remove('highlight'))

      // Same marker, same reason: .action-hover is in both item.hbs and equip-tray.hbs, and this
      // query spans the whole tray, so equip-tray nodes would gain a listener pair every render.
      this.element.querySelectorAll('.action-hover').forEach((source) => {
        if (source.dataset.aatActionBound) return

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
        // Not marked when there is no selector: data-action-type can be empty on this render
        // and populated on a later one, and the node has to be bindable when that happens.
        if (!targetSelector) return
        source.dataset.aatActionBound = '1'

        // Resolved per hover rather than captured here. These listeners now outlive many
        // renders, and the pip node they point at is replaced by every centerTray render - a
        // captured reference would go stale and silently stop highlighting.
        source.addEventListener('mouseenter', () => {
          this.element?.querySelector(targetSelector)?.classList.add('highlight')
        })

        source.addEventListener('mouseleave', () => {
          this.element?.querySelector(targetSelector)?.classList.remove('highlight')
        })
      })
    }

    if (options.parts.includes('effectsTray')) {
      Hooks.call('AAT-EffectsTrayRendered')
    }

    if (this.animating || !this.stackedTray.active || !options.parts.includes('centerTray')) return

    mark('  draggables', () => this.draggableTrays.createAllDraggables())
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

    Hooks.call('AAT-RenderComplete', options)
    return
  }

  //#region Frame Listeners
  _attachFrameListeners() {
    super._attachFrameListeners()
    attachContextMenus(this)
  }

  /** Context-menu actions that need the clicked element rather than the tray's own state. */
  _onAction(li, action) {
    switch (action) {
      case 'view':
        this.actor.items.get(li.dataset.itemId).sheet.render(true)
        break
      case 'remove':
        this.currentTray.deleteItem(li.dataset.itemId)
        this.render(true)
        break
    }
  }
  //#region Actions
  // Mostly thin delegations. The generated pass-throughs to Actions are declared in
  // DELEGATED_ACTIONS at the top of this file; only the ones that target something other than
  // Actions, or need their own guard, are written out here.

  setTrayConfig(config) {
    this.actor.setFlag('auto-action-tray', 'config', config)
  }

  static removeConcentration(event, element) {
    EffectTray.removeConcentration.bind(this)(event, element)
  }

  static async trayConfig() {
    TrayConfig.trayConfig.bind(this)()
  }

  static async toggleCondition(event, target) {
    this.conditionTray.toggleCondition(event, target)
  }

  static reactionPromptSelect(event, target) {
    this.reactionPromptTray.selectButton(target.dataset.buttonKey)
  }

  static reactionPromptDecline(event, target) {
    this.reactionPromptTray.decline()
  }

  /**
   * Slide the condition tray in or out. Ignored mid-animation, mid-activity-selection or while
   * targeting, any of which would leave the tray stack inconsistent.
   */
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

  //#region DragDrop
  // The handlers themselves live in DragDropHandler; these are the ApplicationV2 hook points.

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

  /** ApplicationV2 reads this to bind the drag handlers on each render. */
  get dragDrop() {
    return this.#dragDrop
  }

  /** Dragging out of a slot is blocked while the tray is locked. */
  _canDragStart(selector) {
    return this.isEditable && !this.trayOptions['locked']
  }

  /** Dropping into a slot only needs the tray to be editable. */
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
