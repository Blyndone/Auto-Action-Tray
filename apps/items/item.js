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

    this.checkActivities()
    this.setDescription()
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
      this.defaultActivity = this.activities[0]
    }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => enrich())
    else setTimeout(enrich, 0)
  }
  async checkActivities() {
    for (const activity of this.activities) {
      if (activity.activity.type === 'cast') {
        try {
          const spell = await fromUuid(activity?.activity?.spell?.uuid)
          if (spell) {
            const enhancedSpell = { ...spell, actor: this.actor }
            const newActivity = new AATActivity(enhancedSpell, activity.activity)
            newActivity.setAllDescriptions()
          } else {
            // console.warn('AAT | Activity not found')
          }
        } catch (error) {
          // console.error('Error fetching spell:', error)
        }
      }
    }
  }
}
