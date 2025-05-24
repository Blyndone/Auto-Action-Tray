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
    this.application = options.application

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

  cleanDesc(desc, allItems) {
    desc = desc.replace(
      /data-roll-item-uuid="[^"]*?\.mmSpellcasting00\.(Activity\.[A-Za-z0-9]+)".*?<\/span>/g,
      (_, activityId) => {
        return `>[[/item .mmSpellcasting00.${activityId}]]`
      },
    )

    desc = desc.replace(/<\/?[^>]+>/g, '')

    let itemPattern = /\[\[\/item \.mm([^\]])[^\]]*\]\]/g

    desc = desc.replace(itemPattern, (match, idFragment) => {
      match = match.replace(/(\[\[\/item \.mm|\]|Spellcasting00\.)/g, '')
      match = match.replace(/0+$/, '')

      if (match.startsWith('Activity')) {
        let spellcasting = allItems.find((i) => i.name === 'Spellcasting')
        if (spellcasting) {
          match = spellcasting.item.system?.activities
            .find((i) => i.id === match.replace('Activity.', ''))
            ?.cachedSpell?.name.replace(' ', '')
        }
      }

      let item = allItems.find((i) =>
        i.name
          .replace(/\s+/g, '')
          .toLowerCase()
          .replaceAll(' ', '')
          .startsWith(match.toLowerCase()),
      )

      if (item) {
        return item.name
      }
    })
    itemPattern = /\[\[\/item \.([^\]]+)\]\]/g

    desc = desc.replace(itemPattern, (match, idFragment) => {
      let item = allItems.find((i) => i.id === idFragment)
      return item.name
    })

    return desc
  }

  generateNpcTray() {
    let actor = fromUuidSync(this.actorUuid)

    this.abilities = []
    let allItems = this.application.getActorAbilities(this.actorUuid)
    allItems.forEach((e) => {
      e.name = e.name.replace(/\s*\([^)]*\)/g, '')
    })

    let multiattack = allItems.find(
      (e) => e.name === 'Multiattack' || e.name.startsWith('Multiattack'),
    )
    if (multiattack && this.category === 'common') {
      // let foundItem = await fromUuid(".mmRend0000000000", { relative: multiattack.item })
      // console.log(foundItem)

      let multigroupIndex = 0
      let desc = multiattack.description
      let options = {
        documents: false,
        links: false,
        rolls: false,
        embeds: false,
        secrets: false,
      }

      desc = this.cleanDesc(desc, allItems)
      console.log(desc)

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
          this.padNewRow()
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
          this.padNewRow()
        }
      })

      let nonMatchedItems = this.getMatch(`(${itemNames.join('|')})`, desc).map((e) => e.match)
      if (nonMatchedItems.length > 0) {
        let newItems = nonMatchedItems.filter(
          (a) => !this.abilities.some((ability) => ability?.name.toLowerCase() === a),
        )
        newItems = [...new Set(newItems)].filter((e) => e != 'spellcasting')
        newItems.forEach((item) => {
          let attack = allItems.find((e) => e.name.toLowerCase() === item)
          if (attack) {
            this.abilities.push(attack)
            attack['multigroup'] = 'multi-additional'
            this.padNewRow()
          }
        })
      }
      if (this.abilities.length > 0) {
        this.abilities.push(multiattack)
        this.padNewRow()
      }
    }

    switch (this.category) {
      case 'common':
        const typeOrder = { weapon: 0, feat: 1, spell: 2 }
        this.abilities = [
          ...this.abilities,
          ...allItems
            .filter(
              (e) =>
                e.isActive &&
                e.type !== 'spell' &&
                e.type !== 'consumable' &&
                !this.abilities.some((a) => a?.name === e.name),
            )
            .sort((a, b) => {
              const orderA = typeOrder[a.type] ?? Infinity
              const orderB = typeOrder[b.type] ?? Infinity
              return orderA - orderB
            }),
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

    this.abilities = this.padArray(this.abilities)

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
    this.rowCount =
      trays[0].application.rowCount || game.settings.get('auto-action-tray', 'rowCount')
    trays[0].abilities = trays[0].abilities.slice(0, highestIndex + 1)
    trays.slice(1).forEach((tray) => {
      tray.abilities.forEach((ability) => {
        if (ability != null && !trays[0].abilities.includes(ability)) {
          trays[0].abilities.push(ability)
        }

        tray.padNewRow()
      })
    })

    trays[0].abilities = trays[0].padArray(trays[0].abilities)
  
      AbilityTray.onCompleteGeneration.bind(options.application)()
  
    return trays
  }
}
