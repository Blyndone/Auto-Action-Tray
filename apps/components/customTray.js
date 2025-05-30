import { AbilityTray } from './abilityTray.js'
import { CustomNpcTray } from './customNpcTray.js'

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
      this.generateTray(options.cachedAbilities)
    } else {
      this.getSavedData(options.cachedAbilities)
    }
  }

  generateTray(cachedAbilities) {
    const actor = fromUuidSync(this.actorUuid)
    let allItems = cachedAbilities || this.application.getActorAbilities(this.actorUuid)
    allItems.sort((a, b) => (a?.item?.sort ?? -Infinity) - (b?.item?.sort ?? -Infinity))
    switch (this.category) {
      case 'common':
        this.abilities = allItems
          .filter(
            (e) =>
              e.isActive &&
              ((e.type === 'weapon' && e.equipped) ||
                (e.type !== 'weapon' &&
                  (e.type !== 'spell' || e.isScaledSpell === false) &&
                  e.type !== 'consumable' &&
                  e.type !== 'tool')),
          )
          .sort((a, b) => {
            const priority = {
              weapon: 0,
              default: 1,
              spell: 2,
            }

            const aPriority = priority[a.type] ?? priority.default
            const bPriority = priority[b.type] ?? priority.default

            if (aPriority === bPriority) {
              if (a.equipped && !b.equipped) return -1
              if (!a.equipped && b.equipped) return 1
              return 0
            }

            return aPriority - bPriority
          })
        this.id = 'common'
        break

      case 'classFeatures':
        this.abilities = allItems
          .filter((e) => e.isActive && e.type === 'feat')
          .sort((a, b) => {
            const priority = {
              class: 0,
              race: 1,
            }
            const aPriority = priority[a.item.system.type.value] ?? 10
            const bPriority = priority[b.item.system.type.value] ?? 10
            return aPriority - bPriority
          })
        this.id = 'classFeatures'
        break
      case 'items':
        this.abilities = allItems
          .filter((e) => e.type === 'consumable')
          .sort((a, b) => {
            const priority = {
              potion: 0,
              scroll: 1,
            }
            const aPriority = priority[a.item.system.type.value] ?? 10
            const bPriority = priority[b.item.system.type.value] ?? 10
            return aPriority - bPriority
          })
        let containers = allItems.filter((e) => e.type === 'container')
        this.padNewRow()
        this.abilities.push(...containers)
        this.id = 'items'
        break
      case 'passiveItems':
        const excludedTypes = [
          'equipment',
          'loot',
          'container',
          'class',
          'background',
          'race',
          'subclass',
          'consumable',
        ]

        this.abilities = allItems
          .filter(
            (e) =>
              (!e.isActive &&
                (!excludedTypes.includes(e.type) ||
                  (e.type == 'equipment' && e.item?.transferredEffects?.length > 0))) ||
              (e.type === 'equipment' && e.equipped),
          )
          .sort((a, b) => {
            const priority = {
              equipment: 0,
              tool: 1,
              feat: 2,
            }
            const aPriority = priority[a.type] ?? 10
            const bPriority = priority[b.type] ?? 10
            return aPriority - bPriority
          })

        this.id = 'passiveItems'
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
      case 'favoriteItems':
        let favorites = actor.system.favorites.map((e) => e.id.split('.').pop())
        this.abilities = allItems
          .map((e) => (favorites.includes(e.id) ? e : null))
          .filter((e) => e !== null)
          .sort((a, b) => a?.spellLevel - b?.spellLevel)
          .sort((a, b) => {
            const priority = {
              weapon: 0,
              equipment: 1,
              feat: 2,
              spell: 3,
              consumable: 4,
            }
            const aPriority = priority[a.type] ?? 10
            const bPriority = priority[b.type] ?? 10
            return aPriority - bPriority
          })

        this.id = 'favoriteItems'
        break
    }

    this.abilities = this.padArray(this.abilities)
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
      cachedAbilities: options.cachedAbilities,
    })
    let classTray = new CustomTray({
      category: 'classFeatures',
      id: 'classFeatures',
      trayLabel: 'Features',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })
    let consumablesTray = new CustomTray({
      category: 'items',
      id: 'items',
      trayLabel: 'Consumables',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })
    let passiveTray = new CustomTray({
      category: 'passiveItems',
      id: 'passiveItems',
      trayLabel: 'Passive',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })

    let reactionTray = new CustomTray({
      category: 'reaction',
      id: 'reaction',
      trayLabel: 'Reactions',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })

    let customTray = new CustomTray({
      category: 'custom',
      id: 'custom',
      trayLabel: 'Custom',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })

    let favoritesTray = new CustomTray({
      category: 'favoriteItems',
      id: 'favoriteItems',
      trayLabel: 'Favorites',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })

    let exclusions = new Set([
      ...classTray.abilities,
      ...consumablesTray.abilities,
      ...reactionTray.abilities,
    ])

    if (!commonTray.savedData) {
      const filtered = commonTray.abilities.map((e) => (exclusions.has(e) ? null : e))

      const nonSpells = filtered.filter((e) => e !== null && e.type !== 'spell')
      const spells = filtered.filter((e) => e !== null && e.type === 'spell')

      commonTray.padNewRow()
      commonTray.abilities = commonTray.padArray([...nonSpells, ...spells])
    }

    let trays = [
      commonTray,
      classTray,
      consumablesTray,
      reactionTray,
      passiveTray,
      customTray,
      favoritesTray,
    ]

    trays = trays.filter(
      (e) =>
        e.abilities.some((e) => e != null) ||
        e.category == 'common' ||
        e.category == 'classFeatures' ||
        e.category == 'items' ||
        e.category === 'custom',
    )
    trays.forEach((tray) => {
      tray.addMacrosToTray()
    })
    AbilityTray.onCompleteGeneration.bind(options.application)()
    return trays
  }
}
