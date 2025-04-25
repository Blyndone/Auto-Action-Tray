import { ItemConfig } from '../helpers/itemConfig.js'
import { AATActivity } from './activity.js'
import { AATItemTooltip } from './itemTooltip.js'

export class AATItem {
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
    this.preparationMode = this.item.system?.preparation?.mode

    this.description = item.system.description.value
    this.name = this.item.name
    this.type = this.item.type

    this.setValues()

    this.activities =
      item.system?.activities?.contents.map((e) => {
        return new AATActivity(this, e)
      }) ?? []
    this.defaultActivity = this.activities[0] ?? null

    if (this.item.system?.activities?.contents.length > 0) {
      this.fastForward = null
      this.useTargetHelper = null
      this.targetCount = null
      this.tooltip = this.defaultActivity.tooltip
      this.uses =
        this.item.type == 'consumable'
          ? this.item.system.quantity
          : this.item.system?.uses?.max
          ? `${this.item.system.uses.value} / ${this.item.system.uses.max}`
          : ''
    } else {
      this.tooltip = new AATItemTooltip(this, null)
    }
    if (this.preparationMode == 'pact') {
      this.pactLevel = this.actor.system?.spells?.pact?.level
      this.defaultActivity = this.activities.find((a) => a.tooltips.find(e=> e.spellLevel == this.pactLevel))
      this.tooltip = this.defaultActivity.tooltips.find(e=> e.spellLevel == this.pactLevel)
    }

    this.checkActivities()
    this.setDescription()
  }
  getActorMaxSpellLevel(actor) {
    let slots = actor.system.spells
    let pactLevel = actor.system.spells.pact?.level ?? 0
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
    this.isPrepared = this.item.system?.preparation?.prepared

    this.fastForward = this.itemConfig?.fastForward ?? null
    this.useTargetHelper = this.itemConfig?.useTargetHelper ?? null
  }

  async setDescription() {
    this.description = await TextEditor.enrichHTML(this.item.system.description.value)
    this.activities.forEach(async (activity) => {
      activity.setAllDescriptions()
    })
    this.defaultActivity = this.activities[0]
  }
  async checkActivities() {
    this.activities.forEach(async (activity) => {
      if (activity.activity.type == 'cast') {
        let spell = await fromUuid(activity?.activity?.spell?.uuid)
        spell = { ...spell, actor: this.actor }
        if (spell) {
          activity = new AATActivity(spell, activity.activity)
          activity.setAllDescriptions()
        } else {
          console.warn('AAT | Activity not found')
        }
      }
    })
  }
}
