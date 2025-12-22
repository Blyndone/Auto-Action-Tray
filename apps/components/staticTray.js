import { AbilityTray } from './abilityTray.js'
import { CustomStaticTray } from './customStaticTray.js'
import { ActivityTray } from './activityTray.js'

export class StaticTray extends AbilityTray {
  constructor(options = {}) {
    super(options)
    this.category = options.category
    this.spellLevel = options.spellLevel
    this.totalSlots = options.totalSlots
    this.availableSlots = options.availableSlots
    this.type = 'static'

    this.setInactive()
    this.generateTray(options.cachedAbilities)
  }

  padAbilityBoundaries() {
    const tmp = []
    let previousType = null

    for (const ability of this.abilities) {
      if (previousType !== null && ability.type !== previousType) {
        while (tmp.length % this.rowCount !== 0) {
          tmp.push(null)
        }
      }

      tmp.push(ability)
      previousType = ability.type
    }

    this.abilities = tmp
  }

  generateTray(cachedAbilities) {
    let actor = fromUuidSync(this.actorUuid)

    let allItems = cachedAbilities || this.application.getActorAbilities(this.actorUuid)
    switch (this.category) {
      case 'action':
        this.abilities = allItems
          .filter(
            (e) =>
              e.isActive &&
              e.activities.some((activity) => activity.activity?.activation?.type === 'action') &&
              (e.type !== 'spell' || e.isScaledSpell === false),
          )
          .sort((a, b) => {
            const priority = {
              weapon: 0,
              default: 1,
              feat: 2,
              spell: 3,
              consumable: 4,
              tool: 5,
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
        this.id = 'action'
        this.padAbilityBoundaries()
        break

      case 'bonus':
        this.abilities = allItems
          .filter(
            (e) =>
              e.isActive &&
              e.activities.some((activity) => activity.activity?.activation?.type === 'bonus') &&
              (e.type !== 'spell' || e.isScaledSpell === false),
          )
          .sort((a, b) => {
            const priority = {
              weapon: 0,
              default: 1,
              feat: 2,
              spell: 3,
              consumable: 4,
              tool: 5,
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
        this.id = 'bonus'
        this.padAbilityBoundaries()
        break

      case 'customStaticTray':
        if (this.keyItemId) {
          this.abilities = allItems.filter((e) =>
            e.activities?.some((activity) =>
              activity.activity.consumption?.targets?.some(
                (target) => target.target === this.keyItemId,
              ),
            ),
          )

          this.id = 'customStaticTray' + '-' + this.keyItemId
        }

        break
      case 'bonusSpell':
        this.abilities = allItems.filter((e) => e.type === 'spell' && !e.isScaledSpell)

        this.id = 'bonusSpell'
        break

      case 'spell':
        if (this.spellLevel == 0) {
          this.abilities = allItems.filter((e) => e.spellLevel == this.spellLevel && e.isPrepared)
          this.id = 'spell-' + this.spellLevel
          break
        }

        this.abilities = allItems.filter(
          (e) =>
            (e.spellLevel <= this.spellLevel &&
              e.spellLevel != 0 &&
              e.isScaledSpell &&
              e.preparationMode != 'pact' &&
              (e.item.system.uses?.max == '' ||
                (ActivityTray.checkSpellConfigurable(e.item) &&
                  e.item.system.level == this.spellLevel)) &&
              e.isPrepared == true) ||
            actor?.system?.spells['spell' + this.spellLevel]?.max == 0,
        )

        this.id = 'spell-' + this.spellLevel
        this.category = 'leveledSpell'
        break

      case 'pact':
        this.abilities = allItems.filter((e) => e.item.system?.method == 'pact')

        this.id = 'pact'
        break

      case 'ritual':
        this.abilities = allItems.filter((e) => e.type === 'spell' && e.isRitual)
        this.id = 'ritual'
        break
    }
    this.abilities
      .sort((a, b) => (a?.item?.sort ?? -Infinity) - (b?.item?.sort ?? -Infinity))
      .sort((a, b) => b?.spellLevel - a?.spellLevel)
    this.abilities = this.abilities.filter((e) => e != null)
  }

  static generateStaticTrays(actor, options = {}) {
    let actionTray = new StaticTray({
      category: 'action',
      label: 'Action',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })
    let bonusTray = new StaticTray({
      category: 'bonus',
      label: 'Bonus Action',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })

    let customStaticTraysUuids = new Set([
      ...CustomStaticTray.getCustomStaticTrays(actor),
      ...actor.items.filter(CustomStaticTray.checkOverride).map((e) => e.id),
    ])

    let customStaticTrays = Array.from(
      customStaticTraysUuids,
      (e) =>
        new CustomStaticTray({
          category: 'customStaticTray',
          actorUuid: actor.uuid,
          label: actor.items.get(e).name,
          keyItemId: e,
          application: options.application,
          cachedAbilities: options.cachedAbilities,
        }),
    )

    if (actor.system?.resources?.legact?.max > 0) {
      customStaticTrays.push(
        new CustomStaticTray({
          category: 'customStaticTray',
          actorUuid: actor.uuid,
          label: 'Legendary Actions',
          keyItemId: null,
          application: options.application,
          cachedAbilities: options.cachedAbilities,
        }),
      )
    }

    let spellTray = []

    let slots = actor.system.spells

    let levels = Object.keys(slots)
      .filter((key) => slots[key].value > 0 && key !== 'pact')
      .map((key) => slots[key].level)

    let allItems = options.cachedAbilities || options.application.getActorAbilities(actor.uuid)
    let spells = allItems.filter((e) => e.type === 'spell' && e.isPrepared && e.isScaledSpell)

    if (spells.length > 0) {
      levels = [...new Set([...levels, ...spells.map((x) => x.spellLevel)])].sort((a, b) => a - b)
    }

    levels.forEach((level) => {
      spellTray.push(
        new StaticTray({
          category: 'spell',
          label: level == 0 ? 'Cantrips' : `Level ${level} Spells`,
          actorUuid: actor.uuid,
          spellLevel: level,
          totalSlots: actor.system?.spells['spell' + level]?.max,
          availableSlots: level == 0 ? 1 : actor.system?.spells['spell' + level]?.value,
          application: options.application,
          cachedAbilities: options.cachedAbilities,
        }),
      )
    })

    let bonusSpells = new StaticTray({
      category: 'bonusSpell',
      label: 'Bonus Spells',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })

    let pactTray = new StaticTray({
      category: 'pact',
      label: 'Pact Magic',
      actorUuid: actor.uuid,
      spellLevel: actor.system.spells.pact.level,
      totalSlots: actor.system.spells.pact.max,
      availableSlots: actor.system.spells.pact.value,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })

    let ritualTray = new StaticTray({
      category: 'ritual',
      label: 'Rituals',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })

    let staticTrays = [
      actionTray,
      bonusTray,
      ...customStaticTrays,
      bonusSpells,
      ...spellTray,
      pactTray,
      ritualTray,
    ]

    staticTrays = staticTrays.filter((e) => e.abilities && e.abilities.length > 0)
    staticTrays.forEach((e) => {
      e.abilities = e.padArray(e.abilities)
    })
    AbilityTray.onCompleteGeneration.bind(options.application)()
    return staticTrays
  }

  getAbilities() {
    return this.abilities
  }
}
