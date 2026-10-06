import { AbilityTray } from './abilityTray.js'

// styles/components/item.scss defines .multi-group0..2. Group indexes cycle through them so a
// monster that names four or more attack groups (every lycanthrope) still gets a highlight ring
// instead of an unstyled class name.
const MULTI_GROUP_STYLES = 3

const NUMBER_WORDS = {
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

export class CustomNpcTray extends AbilityTray {
  constructor(options = {}) {
    super(options)
    this.savedData = false
    this.category = options.category
    this.id = options.id
    this.type = 'custom'
    // itemId -> { group, wildcard }. Keyed by id rather than written onto the AATItem itself:
    // getActorAbilities hands back the shared savedActors cache, so tagging the item leaked the
    // highlight into every other tray showing it and could not survive an item rebuild.
    this.multiattackTags = {}
    // Initialised for every path, not just generateNpcTray: the saved path never calls it, and
    // an undefined array here throws inside the parse's catch, silently disabling grouping.
    this.multiattackIndexGroups = []
    this.trayLabel = options.trayLabel
    this.application = options.application

    if (!this.savedData && !this.checkSavedData()) {
      this.generateNpcTray()
    } else {
      this.getSavedData()
      // The tags are derived from the description and keyed by item id, so they can be rebuilt
      // for a saved tray without touching its layout. Without this, multiattack highlighting
      // disappeared for good the first time a user dragged anything into the tray.
      this.tagMultiattack()
    }
  }

  getMatch(pattern, string) {
    let regex = new RegExp(pattern, 'g')
    let matches = []
    let match

    while ((match = regex.exec(string)) !== null) {
      matches.push({ match: match[0], groups: match.slice(1), index: match.index })
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
      return item ? item.name : match
    })

    return desc
  }

  /** Strip the parenthetical qualifiers dnd5e adds ("Bite (Wolf Form)"); descriptions omit them. */
  stripNameQualifiers(allItems) {
    allItems.forEach((e) => {
      e.name = e.name.replace(/\s*\([^)]*\)/g, '')
    })
  }

  /** The actor's Multiattack item, if it has one. */
  findMultiattack(allItems) {
    return allItems.find((e) => e.name === 'Multiattack' || e.name.startsWith('Multiattack'))
  }

  /**
   * Cycle through the highlight styles item.scss defines (.multi-group0..2), so a monster naming
   * four or more groups still gets a ring rather than an unstyled `multi-group3`.
   */
  static groupClass(index) {
    return 'multi-group' + (index % MULTI_GROUP_STYLES)
  }

  /**
   * Parse a Multiattack description into the attack groups it describes.
   *
   * Must stay side-effect free: it writes nothing onto `this` or onto the items, so both
   * generateNpcTray (layout + tags) and tagMultiattack (tags only) can run it.
   *
   * @returns {{groups: {items: object[], wildcard: boolean}[], additional: object[]}}
   *   `groups` are the "one bite and two claws" clusters in order, so a group's position is its
   *   highlight index. `additional` are named items no group claimed.
   */
  parseMultiattack(allItems, multiattack) {
    const groups = []
    const additional = []

    let desc = this.cleanDesc(multiattack.description, allItems)

    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const itemNames = allItems.map((e) => escapeRegExp(e.name.toLowerCase()))
    const num = NUMBER_WORDS

    desc = desc.replaceAll('with its ', '').toLowerCase()
    desc = desc.replaceAll('its ', '').toLowerCase()

    const orMatches = this.getMatch(`\\b(or)\\b `, desc)
    const split = orMatches ? desc.split(' or ') : [desc]

    const basicAttackPattern = `\\b(${Object.keys(num).join('|')})\\b (${itemNames.join('|')})`
    const combinationAttackPattern = `\\b(${Object.keys(num).join(
      '|',
    )})\\s(attack|attacks)\\b.*?(${itemNames.join('|')}).*?(in any combination)`

    // "makes three attacks with its claws and bite in any combination" - each named attack
    // becomes its own group that may be taken up to `count` times, hence the wildcard marker.
    const combinationMatches = this.getMatch(combinationAttackPattern, desc)
    if (combinationMatches.length > 0) {
      const count =
        num[
          this.getMatch(`\\b(${Object.keys(num).join('|')})\\b`, combinationMatches[0].match)[0]
            .match
        ]
      const items = this.getMatch(`(${itemNames.join('|')})`, combinationMatches[0].match).map(
        (e) => e.match,
      )

      items.forEach((item) => {
        const attack = allItems.find((e) => e.name.toLowerCase() === item)
        if (!attack) return
        groups.push({ items: Array.from({ length: count }, () => attack), wildcard: true })
      })
    }

    // Each "or" branch is one alternative group: "one bite and two claws" / "two slams".
    split.forEach((e) => {
      const combinedMatches = []
      combinedMatches.push(...this.getMatch(basicAttackPattern, e))
      combinedMatches.push(...this.getMatch(`\\b(uses|use)\\b (${itemNames.join('|')})`, e))

      combinedMatches.sort((a, b) => a.index - b.index)

      if (combinedMatches.length === 0) return

      // Pushed even when nothing resolves, which preserves the original index numbering: a
      // branch that matched text but no known item still consumed a group index.
      const items = []
      combinedMatches.forEach((obj) => {
        const parts = obj.match.split(' ')
        const name = parts.slice(1).join(' ')
        const repeat = num[parts[0]] !== undefined ? num[parts[0]] : 1
        for (let i = 0; i < repeat; i++) {
          const attack = allItems.find((e) => e.name.toLowerCase() === name)
          if (!attack) continue
          items.push(attack)
        }
      })
      groups.push({ items, wildcard: false })
    })

    // Anything the description names that no group claimed - "and uses Spellcasting".
    const nonMatchedItems = this.getMatch(`(${itemNames.join('|')})`, desc).map((e) => e.match)
    if (nonMatchedItems.length > 0) {
      const claimed = new Set(groups.flatMap((g) => g.items).map((a) => a?.name.toLowerCase()))
      let newItems = nonMatchedItems.filter((a) => !claimed.has(a))
      newItems = [...new Set(newItems)].filter((e) => e != 'spellcasting')
      newItems.forEach((item) => {
        const attack = allItems.find((e) => e.name.toLowerCase() === item)
        if (attack) additional.push(attack)
      })
    }

    return { groups, additional }
  }

  /**
   * Record one item's highlight, keyed by item id. Never write this onto the AATItem itself -
   * those come from the shared savedActors cache, so the tag would leak into every other tray
   * showing the item. templates/parts/item.hbs reads this map off the tray instead.
   */
  recordMultiattackTag(attack, group, wildcard) {
    if (!attack?.id) return
    this.multiattackTags[attack.id] = { group, wildcard }
  }

  /**
   * Re-derive multiattack highlighting for a tray whose layout came from saved data. The tags are
   * keyed by item id and carry no layout, so rebuilding them leaves the saved arrangement alone.
   */
  tagMultiattack() {
    this.multiattackTags = {}
    if (this.category !== 'common') return

    const allItems = this.application.getActorAbilities(this.actorUuid)
    this.stripNameQualifiers(allItems)
    const multiattack = this.findMultiattack(allItems)
    if (!multiattack) return

    try {
      const { groups, additional } = this.parseMultiattack(allItems, multiattack)
      groups.forEach((group, index) => {
        const groupClass = CustomNpcTray.groupClass(index)
        group.items.forEach((attack) =>
          this.recordMultiattackTag(attack, groupClass, group.wildcard),
        )
      })
      additional.forEach((attack) => this.recordMultiattackTag(attack, 'multi-additional', false))
    } catch (err) {
      console.warn(
        'AAT | Failed to re-tag Multiattack for a saved tray — highlighting will be absent.',
        err,
      )
      this.multiattackTags = {}
    }
  }

  generateNpcTray() {
    let actor = fromUuidSync(this.actorUuid)

    this.abilities = []
    this.multiattackIndexGroups = []
    this.multiattackTags = {}

    let allItems = this.application.getActorAbilities(this.actorUuid)
    this.stripNameQualifiers(allItems)

    let multiattack = this.findMultiattack(allItems)
    if (multiattack && this.category === 'common') {
      try {
        const { groups, additional } = this.parseMultiattack(allItems, multiattack)

        groups.forEach((group, index) => {
          const groupClass = CustomNpcTray.groupClass(index)
          const tmpIndexes = []
          group.items.forEach((attack) => {
            this.recordMultiattackTag(attack, groupClass, group.wildcard)
            this.abilities.push(attack)
            tmpIndexes.push(this.abilities.length - 1)
          })
          this.multiattackIndexGroups.push(tmpIndexes)
          this.padNewRow()
        })

        additional.forEach((attack) => {
          this.recordMultiattackTag(attack, 'multi-additional', false)
          this.abilities.push(attack)
          this.padNewRow()
        })

        if (this.abilities.length > 0) {
          this.abilities.push(multiattack)
          this.padNewRow()
        }
      } catch (err) {
        console.warn(
          `AAT | Failed to parse Multiattack description for "${actor?.name}" — falling back without multiattack grouping.`,
          err,
        )
        this.abilities = []
        this.multiattackIndexGroups = []
        this.multiattackTags = {}
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

    return trays
  }
}
