import { AbilityTray } from './abilityTray.js'
import { CustomNpcTray } from './customNpcTray.js'
import { ActivityTray } from './activityTray.js'

export class CustomTray extends AbilityTray {
  constructor(options = {}) {
    super(options)
    this.savedData = false
    this.category = options.category
    this.id = options.id
    this.type = 'custom'
    this.xPos = 0
    this.trayLabel = options.trayLabel

    if (!this.savedData && !this.checkSavedData(this.id)) {
      this.generateTray()
    } else {
      this.getSavedData()
    }
  }

  generateTray() {
    let allItems = this.application.getActorAbilities(this.actorUuid)
    switch (this.category) {
      case 'common':
        this.abilities = allItems.filter(
          (e) => e.isActive && e.type !== 'spell' && e.type !== 'consumable',
        )
        this.id = 'common'
        break
      case 'classFeatures':
        this.abilities = allItems.filter((e) => e.type === 'feat')
        this.id = 'classFeatures'
        break
      case 'items':
        this.abilities = allItems.filter((e) => e.type === 'consumable')
        this.id = 'items'
        break
      case 'passive':
        this.abilities = allItems.filter((e) => !e.isActive && e.type !== 'equipment')
        this.id = 'passive'
        break
      case 'reaction':
        this.abilities = allItems.filter((e) =>
          e.activities?.some((activity) => activity.activity?.activation?.type === 'reaction'),
        )
        this.id = 'reaction'
        break
      case 'custom':
        this.id = 'custom'
        break
    }

    this.abilities = AbilityTray.padArray(this.abilities)
  }

  static generateCustomTrays(actor, options = {}) {
    if (actor.type === 'npc') {
      return CustomNpcTray.generateCustomTrays(actor, { application: options.application })
    }
    let commonTray = new CustomTray({
      category: 'common',
      id: 'common',
      trayLabel: 'Common',
      actorUuid: actor.uuid,
      application: options.application,
    })
    let classTray = new CustomTray({
      category: 'classFeatures',
      id: 'classFeatures',
      trayLabel: 'Features',
      actorUuid: actor.uuid,
      application: options.application,
    })
    let consumablesTray = new CustomTray({
      category: 'items',
      id: 'items',
      trayLabel: 'Consumables',
      actorUuid: actor.uuid,
      application: options.application,
    })
    let passiveTray = new CustomTray({
      category: 'passive',
      id: 'passive',
      trayLabel: 'Passive',
      actorUuid: actor.uuid,
      application: options.application,
    })

    let reactionTray = new CustomTray({
      category: 'reaction',
      id: 'reaction',
      trayLabel: 'Reactions',
      actorUuid: actor.uuid,
      application: options.application,
    })

    let customTray = new CustomTray({
      category: 'custom',
      id: 'custom',
      trayLabel: 'Custom',
      actorUuid: actor.uuid,
      application: options.application,
    })

    let exclusions = new Set([
      ...classTray.abilities,
      ...consumablesTray.abilities,
      ...reactionTray.abilities,
    ])

    if (!commonTray.savedData) {
      commonTray.abilities = commonTray.abilities
        .map((e) => (exclusions.has(e) ? null : e))
        .sort((a, b) => {
          if (a === null && b !== null) return 1
          if (a !== null && b === null) return -1
          return 0 
        })
    }

    let trays = [commonTray, classTray, consumablesTray, reactionTray, passiveTray, customTray]

    trays = trays.filter(
      (e) =>
        e.abilities.some((e) => e != null) ||
        e.category == 'common' ||
        e.category == 'classFeatures' ||
        e.category == 'items' ||
        e.cataegory === 'custom',
    )
    trays.forEach((e) => {
      e.onCompleteGeneration()
    })

    return trays
  }
}
