import { AbilityTray } from './abilityTray.js'

export class ActivityTray extends AbilityTray {
  constructor(options = {}) {
    super(options)
    this.id = 'activity'
    this.abilities = []
    this.actorUuid = options.actorUuid || null
    this.setInactive()
    this.type = 'activity'
    this.generateTray()
    this.selectedActivity = null
    this.rejectActivity = null
    this.useSlot = true
    this.label = ''
  }

  generateTray() {}

  static generateActivityTray(actor, options = {}) {
    return new ActivityTray({
      category: 'activity',
      id: 'activity',
      actorUuid: actor.uuid,
      application: options.application,
    })
  }

  static checkSpellConfigurable(item) {
    if (item.type != 'spell') {
      return true
    } else {
      return item.isScaledSpell
    }
  }

  setSpellLevelActivites(item, actor) {
    this.abilities = []
    if (item.spellLevel > 0 && ActivityTray.checkSpellConfigurable(item)) {
      Object.keys(actor.system.spells).forEach((spell) => {
        if (
          item.spellLevel <= actor.system.spells[spell].level &&
          actor.system.spells[spell].max > 0
        ) {
          let spellData = { actorSpellData: actor.system.spells[spell] }
          let tempitem = { ...item }
          tempitem.itemId = item.id
          tempitem.tooltip = tempitem.defaultActivity.tooltips.find(
            (e) => e.spellLevel == spellData.actorSpellData.level,
          )
          foundry.utils.mergeObject(tempitem, spellData)
          this.abilities.push(tempitem)
        }
      })
    }
  }

  setActivities(item, actor) {
    this.abilities = item.activities.map((e) => e)
  }

  async getActivities(item, actor) {
    this.setActivities(item, actor)
    return this.abilities
  }

  static checkActivity(item) {
    return item.system.activities.size > 1
  }

  async selectAbility(item, actor, hotbar) {
    this.label = item.name
    if (item.preparationMode == 'pact') {
      return item.defaultActivity
    }
    hotbar.selectingActivity = true
    hotbar.animationHandler.pushTray(this.id)

    let act
    try {
      act = await new Promise((resolve, reject) => {
        this.selectedActivity = resolve
        this.rejectActivity = reject
      })
    } catch (error) {
      // console.log('AAT - Activity selection canceled')
      act = null
    }
    hotbar.selectingActivity = false
    return act
  }

  static useActivity(event, target) {

    let selectedSpellLevel = target.dataset.selectedspelllevel
    let useSlot = this.useSlot
    if (useSlot && !ActivityTray.checkSlotAvailable.bind(this)(selectedSpellLevel)) {
      return
    }
    let options = {}

    let itemId
    if (target.dataset.type == 'spell') {
      itemId = this.actor.items.get(target.dataset.itemId).system.activities.contents[0].id
    } else {
      itemId = target.dataset.itemId
    }

    if (useSlot) {
      options = { slot: useSlot, selectedSpellLevel: selectedSpellLevel }
    }

    if (this.activityTray.selectedActivity) {
      this.activityTray.selectedActivity({
        itemId: itemId,
        selectedSpellLevel: selectedSpellLevel,
        useSlot: useSlot,
      })
      this.activityTray.selectedActivity = null
      this.activityTray.useSlot = true
    }
  }
  static checkSlotAvailable(selectedSpellLevel) {
    let spellLevel = selectedSpellLevel || this.activityTray.slot

    let slot = spellLevel == 'pact' ? pact : `spell${spellLevel}`
    if (this.actor.system?.spells[slot]?.value == 0) {
      ui.notifications.warn(`You don't have a slot of level ${spellLevel} available`)
      return false
    }
    return true
  }


  static cancelSelection(event, target) {
    if (this.currentTray.id == 'activity') {
      this.activityTray?.rejectAct(new Error('User canceled activity selection'))
    } 
    this.rejectActivity = null
  }
  rejectAct() {
    if (this.rejectActivity) {
      this.rejectActivity(new Error('User canceled activity selection'))
      this.rejectActivity = null
    }
  }
}
