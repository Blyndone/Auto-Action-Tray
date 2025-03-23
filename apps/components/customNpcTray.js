import { AbilityTray } from './abilityTray.js'

export class CustomNpcTray extends AbilityTray {
  constructor(options = {}) {
    super(options)
    this.savedData = false
    this.category = options.category
    this.id = options.id
    this.type = 'custom'
    this.multiattackIndexGroups = []
    this.rowCount = game.settings.get('auto-action-tray', 'rowCount')

    if (!this.savedData && !this.checkSavedData(this.id)) {
      // console.log('Generating Custom Trays');

      this.generateNpcTray()
    } else {
      //   console.log('Getting Saved Data');
      this.getSavedData()
    }
  }

  generateNpcTray() {
    let actor = fromUuidSync(this.actorUuid)

    this.abilities = []
    let allItems = actor.items.filter((e) => e.system?.activities?.size)
    let multiattack = actor.items.find((e) => e.name === 'Multiattack')
    if (multiattack && this.category === 'common') {
      let desc = multiattack.system.description.value
      let itemNames = allItems.map((e) => e.name.toLowerCase())
      itemNames.push('melee')
      itemNames.push('ranged')
      itemNames.push('spell')

      let regex
      let regexPattern
      let matches
      let split

      let num = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
      }

      desc = desc.replaceAll('with its ', '')
      regexPattern = `\\b(or)\\b `
      regex = new RegExp(regexPattern, 'g')
      let orMatches = desc.match(regex)
      if (orMatches) {
        split = desc.split(' or ')
      } else {
        split = [desc]
      }
      split.forEach((e) => {
        regexPattern = `\\b(one|two|three|four|five|six|seven|eight|nine|ten)\\b (${itemNames.join(
          '|',
        )})`
        regex = new RegExp(regexPattern, 'g')
        matches = e.match(regex)
        if (matches) {
          let tmpIndexes = []
          matches.forEach((match) => {
            match = match.split(' ')
            for (let i = 0; i < num[match[0]]; i++) {
              let attack = allItems.find((e) => e.name.toLowerCase() === match.slice(1).join(' '))
              this.abilities.push(attack)
              tmpIndexes.push(this.abilities.length - 1)
            }
          })
          this.multiattackIndexGroups.push(tmpIndexes)
          while (this.abilities.length % this.rowCount !== 0) {
            this.abilities.push(null)
          }
        }
      })
    }

    switch (this.category) {
      case 'common':
        this.abilities = [
          ...this.abilities,
          ...allItems.filter(
            (e) =>
              (e.type != 'spell' &&
                !this.abilities.some((a) => a?.name === e.name) &&
                e.system?.activities?.some(
                  (activity) => activity?.activation?.type === 'action',
                )) ||
              e.system?.activities?.some((activity) => activity?.activation?.type === 'bonus'),
          ),
        ]

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
      case 'items':
        this.abilities = allItems.filter((e) => e.type === 'consumable')
        this.id = 'items'
        break
      case 'passive':
        this.abilities = actor.items.filter(
          (e) => e.system?.activities?.size < 1 && e.type !== 'equipment',
        )
        this.id = 'passive'
        break
      case 'reaction':
        this.abilities = allItems.filter((e) =>
          e.system?.activities?.some((activity) => activity?.activation?.type === 'reaction'),
        )
        this.id = 'reaction'
        break

      case 'custom':
        this.id = 'custom'
        break
    }
    this.abilities = AbilityTray.padArray(this.abilities, 20)

    return
  }

  static generateCustomTrays(actor) {
    let commonTray = new CustomNpcTray({
      category: 'common',
      id: 'common',
      label: 'Common',
      actorUuid: actor.uuid,
    })
    let classTray = new CustomNpcTray({
      category: 'classFeatures',
      id: 'classFeatures',
      label: 'Class Features',
      actorUuid: actor.uuid,
    })
    let consumablesTray = new CustomNpcTray({
      category: 'items',
      id: 'items',
      label: 'Consumables',
      actorUuid: actor.uuid,
    })
    let passiveTray = new CustomNpcTray({
      category: 'passive',
      id: 'passive',
      label: 'Passive',
      actorUuid: actor.uuid,
    })

    let reactionTray = new CustomNpcTray({
      category: 'reaction',
      id: 'reaction',
      label: 'Reactions',
      actorUuid: actor.uuid,
    })

    let customTray = new CustomNpcTray({
      category: 'custom',
      id: 'custom',
      label: 'Custom',
      actorUuid: actor.uuid,
    })
    let trays = [commonTray, classTray, consumablesTray, reactionTray, passiveTray, customTray]

    trays = trays.filter(
      (e) =>
        e.abilities.some((e) => e != null) ||
        e.category == 'common' ||
        e.category == 'classFeatures' ||
        e.category == 'items' ||
        e.cataegory === 'custom',
    )

    const highestIndex = trays[0].abilities
      .map((ability, index) => (ability !== null ? index : -1))
      .reduce((max, current) => Math.max(max, current), -1)
    let rowCount = game.settings.get('auto-action-tray', 'rowCount')
    trays[0].abilities = trays[0].abilities.slice(0, highestIndex+1)
    trays.slice(1).forEach((tray) => {
      tray.abilities.forEach((ability) => {
        if (ability != null && !trays[0].abilities.includes(ability)) {
          trays[0].abilities.push(ability)
        }

        while (trays[0].abilities.length % rowCount != 0) {
          trays[0].abilities.push(null)
        }
      })
    })

    // let additionalAbilities =
    //   trays
    //   .filter((tray) => tray !== commonTray) // Exclude commonTray itself
    //   .flatMap((tray) => tray.abilities.filter((a) => a != null)) // Collect non-null abilities

    // trays[0].abilities = trays[0].abilities.filter((a) => a != null)

    // trays[0].abilities.push(...additionalAbilities)

    trays[0].abilities = AbilityTray.padArray(trays[0].abilities)

    return trays
  }
}
