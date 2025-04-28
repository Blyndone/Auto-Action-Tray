import { AbilityTray } from './abilityTray.js'

export class CustomNpcTray extends AbilityTray {
  constructor(options = {}) {
    super(options)
    this.savedData = false
    this.category = options.category
    this.id = options.id
    this.type = 'custom'
    this.multiattackIndexGroups = []
    this.trayLabel = options.trayLabel

    if (!this.savedData && !this.checkSavedData(this.id)) {
      this.generateNpcTray()
    } else {
      this.getSavedData()
    }
  }
  getMatch(pattern, string) {
    let regex = new RegExp(pattern, 'g')
    let matches = []
    let match

    while ((match = regex.exec(string)) !== null) {
      matches.push({ match: match[0], index: match.index })
    }

    return matches
  }

  generateNpcTray() {
    let actor = fromUuidSync(this.actorUuid)

    this.abilities = []
    let allItems = this.application.getActorAbilities(this.actorUuid)
    let multiattack = allItems.find((e) => e.name === 'Multiattack')
    if (multiattack && this.category === 'common') {
      let multigroupIndex = 0
      let desc = multiattack.description
      let itemNames = allItems.map((e) => e.name.toLowerCase())
      // itemNames.push('melee')
      // itemNames.push('ranged')
      // itemNames.push('spell')

      let regex
      let basicAttackPattern
      let numberMatches
      let useMatches
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

      desc = desc.replaceAll('with its ', '').toLowerCase()
      desc = desc.replaceAll('its ', '').toLowerCase()

      let orMatches = this.getMatch(`\\b(or)\\b `, desc)

      if (orMatches) {
        split = desc.split(' or ')
      } else {
        split = [desc]
      }
      basicAttackPattern = `\\b(${Object.keys(num).join('|')})\\b (${itemNames.join('|')})`
      const combinationAttackPattern = `\\b(${Object.keys(num).join(
        '|',
      )})\\s(attack|attacks)\\b.*?(${itemNames.join('|')}).*?(in any combination)`

      let combinationMatches = this.getMatch(combinationAttackPattern, desc)
      if (combinationMatches.length > 0) {
        let count =
          num[
            this.getMatch(`\\b(${Object.keys(num).join('|')})\\b`, combinationMatches[0].match)[0]
              .match
          ]
        let items = this.getMatch(`(${itemNames.join('|')})`, combinationMatches[0].match).map(
          (e) => e.match,
        )

        items.forEach((item) => {
          let tmpIndexes = []
          let attack = allItems.find((e) => e.name.toLowerCase() === item)
          for (let i = 0; i < count; i++) {
            attack['wildcard'] = true
            attack['multigroup'] = 'multi-group' + multigroupIndex
            this.abilities.push(attack)
            tmpIndexes.push(this.abilities.length - 1)
          }
          this.multiattackIndexGroups.push(tmpIndexes)
          multigroupIndex++
          while (this.abilities.length % this.rowCount !== 0) {
            this.abilities.push(null)
          }
        })
      }

      split.forEach((e) => {
        let combinedMatches = []
        combinedMatches.push(...this.getMatch(basicAttackPattern, e))
        combinedMatches.push(...this.getMatch(`\\b(uses|use)\\b (${itemNames.join('|')})`, e))

        combinedMatches.sort((a, b) => a.index - b.index)

        if (combinedMatches.length > 0) {
          let tmpIndexes = []
          combinedMatches.forEach((obj) => {
            let parts = obj.match.split(' ')
            if (num[parts[0]] !== undefined) {
              for (let i = 0; i < num[parts[0]]; i++) {
                let attack = allItems.find((e) => e.name.toLowerCase() === parts.slice(1).join(' '))
                attack['multigroup'] = 'multi-group' + multigroupIndex
                this.abilities.push(attack)
                tmpIndexes.push(this.abilities.length - 1)
              }
            } else {
              let attack = allItems.find((e) => e.name.toLowerCase() === parts.slice(1).join(' '))
              attack['multigroup'] = 'multi-group' + multigroupIndex
              this.abilities.push(attack)
              tmpIndexes.push(this.abilities.length - 1)
            }
          })
          multigroupIndex++
          this.multiattackIndexGroups.push(tmpIndexes)
          while (this.abilities.length % this.rowCount !== 0) {
            this.abilities.push(null)
          }
        }
      })

      let nonMatchedItems = this.getMatch(`(${itemNames.join('|')})`, desc).map((e) => e.match)
      if (nonMatchedItems.length > 0) {
        let newItems = nonMatchedItems.filter(
          (a) => !this.abilities.some((ability) => ability?.name.toLowerCase() === a),
        )
        newItems = [...new Set(newItems)].filter(e=> e!= 'spellcasting')
        newItems.forEach((item) => {
          let attack = allItems.find((e) => e.name.toLowerCase() === item)
          if (attack) {
            this.abilities.push(attack)
            attack['multigroup'] = 'multi-additional'
            while (this.abilities.length % this.rowCount !== 0) {
              this.abilities.push(null)
            }
          }
        })
      }
      this.abilities.push(multiattack)
       while (this.abilities.length % this.rowCount !== 0) {
              this.abilities.push(null)
            }
    }

    switch (this.category) {
      case 'common':
        this.abilities = [
          ...this.abilities,
          ...allItems.filter(
            (e) =>
              e.isActive &&
              e.type !== 'spell' &&
              e.type !== 'consumable' &&
              !this.abilities.some((a) => a?.name === e.name),
          ),
        ]
        this.id = 'common'
        break
      case 'classFeatures':
        this.abilities = allItems.filter((e) => e.isActive && e.type === 'feat')
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

    return
  }

  static generateCustomTrays(actor, options) {
    let commonTray = new CustomNpcTray({
      category: 'common',
      id: 'common',
      trayLabel: 'Common',
      actorUuid: actor.uuid,
      application: options.application,
    })
    let classTray = new CustomNpcTray({
      category: 'classFeatures',
      id: 'classFeatures',
      trayLabel: 'Features',
      actorUuid: actor.uuid,
      application: options.application,
    })
    let consumablesTray = new CustomNpcTray({
      category: 'items',
      id: 'items',
      trayLabel: 'Consumables',
      actorUuid: actor.uuid,
      application: options.application,
    })
    let passiveTray = new CustomNpcTray({
      category: 'passive',
      id: 'passive',
      trayLabel: 'Passive',
      actorUuid: actor.uuid,
      application: options.application,
    })

    let reactionTray = new CustomNpcTray({
      category: 'reaction',
      id: 'reaction',
      trayLabel: 'Reactions',
      actorUuid: actor.uuid,
      application: options.application,
    })

    let customTray = new CustomNpcTray({
      category: 'custom',
      id: 'custom',
      trayLabel: 'Custom',
      actorUuid: actor.uuid,
      application: options.application,
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
    trays[0].abilities = trays[0].abilities.slice(0, highestIndex + 1)
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

    trays[0].abilities = AbilityTray.padArray(trays[0].abilities)
    trays.forEach((e) => {
      e.onCompleteGeneration()
    })
    return trays
  }
}
