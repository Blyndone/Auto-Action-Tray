import { AATItemTooltip } from './itemTooltip.js'
import { AATItem } from './item.js'
export class AATActivity {
  #tooltips = null
  #tooltip = null

  constructor(item, activity) {
    if (!activity) {
      return null
    }
    this.item = item

    this.img = activity.type == 'attack' ? item.img : activity.img
    this.activityId = activity.id
    this.id = item.id
    this.activity = activity
    this.maxSpellLevel = item.maxSpellLevel
    this.isScaledSpell = item.isScaledSpell
    this.useSlot = activity?.consumption?.spellSlot
    // A scaled spell gets one tooltip per castable level, so a high-level caster pays for up to
    // nine per spell. Building them is deferred until something actually reads them.
    this.hasScaledTooltips =
      item.type == 'spell' && this.isScaledSpell && item.item.system.level !== 0
    Object.defineProperties(this, {
      tooltips: {
        get: () => (this.hasScaledTooltips ? this.#ensureTooltips() : undefined),
        set: (value) => {
          this.#tooltips = value
        },
        enumerable: true,
        configurable: true,
      },
      tooltip: {
        get: () => (this.hasScaledTooltips ? this.#ensureTooltips()[0] : this.#ensureTooltip()),
        set: (value) => {
          this.#tooltip = value
        },
        enumerable: true,
        configurable: true,
      },
    })
    this.name = activity.name ? activity.name : activity.item.name
  }

  #ensureTooltips() {
    if (!this.#tooltips) this.#tooltips = this.generateSpellTooltips(this.item, this)
    return this.#tooltips
  }

  #ensureTooltip() {
    if (!this.#tooltip) this.#tooltip = new AATItemTooltip(this.item, this)
    return this.#tooltip
  }

  // Whether generateSpellTooltips would produce a tooltip for this spell level, answered from the
  // level range alone so callers can ask without forcing the tooltips to be built.
  hasTooltipForLevel(level) {
    if (!this.hasScaledTooltips || level == null) return false
    return level >= this.item.item.system.level && level <= this.maxSpellLevel
  }
  static async create(item, activity) {
    if (!activity) return null

    if (activity.type === 'cast') {
      const spell = await fromUuid(activity.spell.uuid)
      spell.actor = item.actor
      item = new AATItem(spell)
    }

    return new AATActivity(item, activity)
  }

  generateSpellTooltips(item, activity) {
    let tooltips = []
    for (let i = item.item.system.level; i <= this.maxSpellLevel; i++) {
      tooltips.push(
        new AATItemTooltip(item, activity, {
          spellLevel: i,
        }),
      )
    }
    if (tooltips.length > 0) {
      return tooltips
    } else {
      return [new AATItemTooltip(item, activity)]
    }
  }
  setAllDescriptions() {
    // Only refreshes tooltips that already exist. Any built after this reads the (by then
    // enriched) item description at construction, so forcing them here would undo the laziness.
    this.#tooltip?.setDescription()
    this.#tooltips?.forEach((tooltip) => tooltip.setDescription())
  }
}
