import { AATItemTooltip } from './itemTooltip.js'
import { AATItem } from './item.js'
export class AATActivity {
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
    if (item.type == 'spell' && this.isScaledSpell && item.item.system.level !== 0) {
      this.tooltips = this.generateSpellTooltips(item, this)
      this.tooltip = this.tooltips[0]
    } else {
      this.tooltip = new AATItemTooltip(item, this)
    }
    this.name = activity.name ? activity.name : activity.item.name
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
    this.tooltip.setDescription()
    if (this.tooltips) {
      this.tooltips.forEach((tooltip) => {
        tooltip.setDescription()
      })
    }
  }
}
