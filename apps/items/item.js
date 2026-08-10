import { ItemConfig } from '../dialogs/itemConfig.js'
import { AATActivity } from './activity.js'
import { AATItemTooltip } from './itemTooltip.js'

export class AATItem {
  #tooltip = null
  #tooltipResolved = false

  static safeCreate(item, actor) {
    try {
      return new AATItem(item)
    } catch (err) {
      console.error(
        `AAT | Failed to build tray item "${item?.name ?? item?.id}" on actor "${actor?.name}" — skipping this item.`,
        err,
      )
      return null
    }
  }

  constructor(item) {
    this.item = item
    this.actor = this.item.actor
    this.maxSpellLevel = this.getActorMaxSpellLevel(this.actor)
    this.id = item.id
    this.img = item.img
    this.rarity = item.system?.rarity ?? ''
    this.equipped = item.system?.equipped ?? false
    this.itemConfig = ItemConfig.getItemConfig(item)
    this.isActive = item.isActive
    this.isRitual = item.system?.properties?.has('ritual') ?? false
    this.concentration = item.requiresConcentration
    this.isScaledSpell = false
    this.preparationMode = this.item.system?.method

    this.description = item.system?.description?.value ?? ''
    this.name = this.item.name
    this.type = this.item.type
    this.subtype = this.item.system?.type?.value ?? null

    this.setValues()

    this.activities =
      item.system?.activities?.contents.map((e) => {
        return new AATActivity(this, e)
      }) ?? []
    this.defaultActivity = this.activities[0] ?? null

    // Reading this used to build the default activity's tooltips during construction, which
    // defeats the deferral in AATActivity. Resolved on first read instead; the setter keeps the
    // pact override below (and any external assignment) working.
    Object.defineProperties(this, {
      tooltip: {
        get: () => {
          if (!this.#tooltipResolved) {
            this.#tooltipResolved = true
            this.#tooltip = this.activities.length
              ? (this.defaultActivity?.tooltip ?? null)
              : new AATItemTooltip(this, null)
          }
          return this.#tooltip
        },
        set: (value) => {
          this.#tooltipResolved = true
          this.#tooltip = value
        },
        enumerable: true,
        configurable: true,
      },
    })

    if (this.item.system?.activities?.contents.length > 0) {
      this.fastForward = null
      this.useTargetHelper = null
      this.targetCount = null
      this.uses =
        this.item.type == 'consumable'
          ? this.item.system.quantity
          : this.item.system?.uses?.max
            ? `${this.item.system.uses.value} / ${this.item.system.uses.max}`
            : ''
    }
    if (this.preparationMode == 'pact') {
      this.pactLevel = this.actor.system?.spells?.pact?.level
      // hasTooltipForLevel answers from the level range, so this no longer builds every
      // activity's tooltips just to find the pact one.
      const pactActivity = this.activities.find((a) => a.hasTooltipForLevel(this.pactLevel))
      if (pactActivity) {
        this.defaultActivity = pactActivity
        this.tooltip = pactActivity.tooltips.find((e) => e.spellLevel == this.pactLevel)
      }
    }

    this.setActionMetrics()
    this.setDescription()
  }

  /**
   * Range and action type, hoisted off AATItemTooltip.
   *
   * item.hbs and equip-tray.hbs need both for their data-action-range / data-action-type
   * attributes on every slot. Reading them through `item.tooltip` forced a tooltip to be built
   * for every item on every render, which defeated the whole point of the lazy tooltip accessor
   * above. Neither value depends on anything a tooltip computes.
   *
   * Mirrors AATItemTooltip.setRangeLabel and .setActivationLabel: range is only meaningful for
   * an active item (a passive with a range would otherwise pick up the range-boundary hover
   * binding), and every activation type other than these three maps to no action type.
   */
  setActionMetrics() {
    const activity = this.defaultActivity?.activity
    this.actionRange =
      this.isActive && activity
        ? Math.max(activity.range?.reach ?? 0, activity.range?.value ?? 0)
        : 0
    this.actionType =
      { action: 'action', bonus: 'bonus', reaction: 'reaction' }[activity?.activation?.type] ?? ''
  }
  getActorMaxSpellLevel(actor) {
    let slots = actor.system?.spells ?? {}
    let pactLevel = slots.pact?.level ?? 0
    let levels = Object.keys(slots)
      .filter((key) => slots[key].max > 0)
      .map((key) => slots[key].level)

    if (levels.length === 0) {
      return 0
    }
    return Math.max(...levels, pactLevel)
  }

  setValues() {
    this.isScaledSpell =
      this.item.type == 'spell' &&
      this.item.system?.uses?.max == '' &&
      this.preparationMode != 'innate' &&
      this.preparationMode != 'atwill'

    this.uses =
      this.item.type == 'consumable'
        ? this.item.system.quantity
        : this.item.system?.uses?.value
          ? `${this.item.system.uses.value} / ${this.item.system.uses.max}`
          : ''

    this.isRitual = this.item.type == 'spell' && this.item.system.properties.has('ritual')
    this.spellLevel = this.item.system?.level ?? null
    this.isPrepared = this.item.system?.prepared > 0

    this.fastForward = this.itemConfig?.fastForward ?? null
    this.useTargetHelper = this.itemConfig?.useTargetHelper ?? null
  }

  setDescription() {
    if (!this.item.system?.description?.value) return
    // enrichHTML is slow and one call fires per item, so the batch is pushed off the setup
    // critical path instead of competing with the first render. It was already un-awaited, so
    // tooltips picked up enriched text on a later render before this change too.
    const enrich = async () => {
      this.description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.item.system.description.value,
        { relativeTo: this.item },
      )
      this.activities.forEach((activity) => activity.setAllDescriptions())
      // No `this.defaultActivity = this.activities[0]` here. It was a no-op in every case but
      // one: a pact-mode item picks a specific activity as its default below, and this callback
      // fires afterwards, so it reset warlocks back to the base-level activity.
    }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => enrich())
    else setTimeout(enrich, 0)
  }
}
