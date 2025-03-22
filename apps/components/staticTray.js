import { AbilityTray } from './abilityTray.js'
import { CustomStaticTray } from './customStaticTray.js'

export class StaticTray extends AbilityTray {
  constructor(options = {}) {
    super(options)
    this.category = options.category
    this.spellLevel = options.spellLevel
    this.totalSlots = options.totalSlots
    this.availableSlots = options.availableSlots
    this.type = 'static'
    this.active = false
    this.generateTray()
 
  }

  generateTray() {
    let actor = fromUuidSync(this.actorUuid)

    let allItems = actor.items.filter((e) => e.system?.activities?.size)
    switch (this.category) {
      case 'action':
        this.abilities = allItems.filter(
          (e) =>
            e.system?.activities?.some((activity) => activity?.activation?.type === 'action') &&
            e.type != 'spell',
        )
        this.id = 'action'
        break

      case 'bonus':
        this.abilities = allItems.filter(
          (e) =>
            e.system?.activities?.some((activity) => activity?.activation?.type === 'bonus') &&
            e.type != 'spell',
        )
        this.id = 'bonus'
        break

      case 'customStaticTray':
        if (this.keyItemUuid) {
          this.abilities = allItems.filter((e) =>
            e.system.activities?.some((activity) =>
              activity.consumption?.targets?.some((target) => target.target === this.keyItemUuid),
            ),
          )

          this.id = 'customStaticTray' + '-' + this.keyItemUuid
        }

        break

      case 'spell':
        if (this.spellLevel == 0) {
          this.abilities = allItems.filter(
            (e) => e.system.level == this.spellLevel && e.system.preparation?.prepared == true,
          )
          this.id = 'spell-' + this.spellLevel
          break
        }

        this.abilities = allItems
          .filter(
            (e) =>
              (e.system.level <= this.spellLevel && e.system.level != 0) &&
              (e.system.preparation?.prepared == true ||
              e.system.preparation?.mode == 'innate' ||
              e.system.preparation?.mode == 'always' ||
              e.system.preparation?.mode == 'atwill'),
          )
          .sort((a, b) => b.system.level - a.system.level)

        this.id = 'spell-' + this.spellLevel
        break

      case 'pact':
        this.abilities = allItems
          .filter((e) => e.system.preparation?.mode == 'pact')
          .sort((a, b) => b.system.level - a.system.level)

        this.id = 'pact'
        break

      case 'ritual':
        this.abilities = allItems.filter(
          (e) => e.type === 'spell' && e.system.properties.has('ritual'),
        )
        this.id = 'ritual'
        break
    }
  }

  static generateStaticTrays(actor) {
    let actionTray = new StaticTray({
      category: 'action',
      label: 'Action',
      actorUuid: actor.uuid,
    })
    let bonusTray = new StaticTray({
      category: 'bonus',
      label: 'Bonus Action',
      actorUuid: actor.uuid,
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
          keyItemUuid: e,
        }),
    )

    let spellTray = []

    let slots = actor.system.spells

    let levels = Object.keys(slots)
      .filter((key) => slots[key].value > 0)
      .map((key) => slots[key].level)

    let allItems = actor.items.filter((e) => e.system?.activities?.size)
    let spells = allItems.filter((e) => e.type === 'spell' && e.system.preparation.prepared == true)

    if (spells.length > 0) {
      levels = [...new Set([...levels, ...spells.map((x) => x.system.level)])].sort((a, b) => a - b)
    }

    levels.forEach((level) => {
      spellTray.push(
        new StaticTray({
          category: 'spell',
          label: level == 0 ? 'Cantrips' : `Level ${level} Spells`,
          actorUuid: actor.uuid,
          spellLevel: level,
          totalSlots: actor.system?.spells['spell' + level]?.max,
          availableSlots: (level ==0)? 1: actor.system?.spells['spell' + level]?.value,
        }),
      )
    })

    let pactTray = new StaticTray({
      category: 'pact',
      label: 'Pact Magic',
      actorUuid: actor.uuid,
      spellLevel: actor.system.spells.pact.level,
      totalSlots: actor.system.spells.pact.max,
      availableSlots: actor.system.spells.pact.value,
    })

    let ritualTray = new StaticTray({
      category: 'ritual',
      label: 'Rituals',
      actorUuid: actor.uuid,
    })

    let staticTrays = [
      actionTray,
      bonusTray,
      ...customStaticTrays,
      ...spellTray,
      pactTray,
      ritualTray,
    ]

    staticTrays = staticTrays.filter((e) => e.abilities && e.abilities.length > 0)
    staticTrays.forEach((e) => {
      e.abilities = AbilityTray.padArray(e.abilities, 20)
    })

    return staticTrays
  }

  getAbilities() {
    return this.abilities
  }
}
