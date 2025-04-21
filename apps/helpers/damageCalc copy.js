export class DamageCalc {
  static damageCalc(item, options) {
    if (options.data.root['animating']) {
      return
    }
    options.data.root['diceFormula'] = ''
    options.data.root['saveType'] = ''
    let currentTray = options.data.root.currentTray
    let i = 0

    let activities = this.getActivities(item)

    if (activities.length == 0 || (activities.length == 1 && activities[0].type == 'utility')) {
      return ''
    }

    let activity = activities[i]
    if (activity.type == 'cast') {
      return
    }

    let scaling = this.getScaling(item, currentTray.spellLevel)

    if (scaling['scaling'] == undefined || isNaN(scaling['scaling'])) {
      scaling['scaling'] = 0
      scaling['number'] = 0
    }

    let rollData = this.getRollData(activity, scaling['scaling'])

    let dice = '<i class="fa-solid fa-dice-d6"></i> '

    let data = ''
    let overrideScale = 0
    if (this.checkOverride(item)) {
      overrideScale = this.getOverrideScaling(
        item,
        currentTray.spellLevel,
        this.getOverrideDamageParts(item),
      )
    }

    if (rollData && rollData.rolls.length > 0) {
      data = this.parseData(rollData, overrideScale)
    }

    if (saveDc[i].saveType != '') {
      options.data.root['saveType'] = `    ${saveDc[i].saveType.toUpperCase()} - DC ${
        saveDc[i].saveDc
      }`
    }

    if (data == '') {
      return
    }

    options.data.root['diceFormula'] =
      dice + data.map((x) => x.formula).join(' <br><i class="fa-solid fa-dice-d6"></i> ')
    return (
      `${data.reduce((sum, x) => sum + Number(x.min), 0)} ~ ${data.reduce(
        (sum, x) => sum + Number(x.max),
        0,
      )}` + (data[0].damageTypes !== ' Healing' ? ' Damage' : ' Healing')
    )
  }

  static parseData(rollData, overrideScale) {
    if (rollData.rolls.length == 0) {
      return
    }

    let retArr = []
    rollData.rolls.forEach((roll) => {
      let rollTerms = []
      let part = roll.parts.join(' + ')
      part = Roll.replaceFormulaData(part, roll.data)
      rollTerms.push(Roll.parse(part))

      let damageTypes = ' ' + roll.options.types.map((type) => this.capitalize(type)).join(' ')

      let max = ''
      let min = ''
      rollTerms.forEach((arr) => {
        arr.forEach((term) => {
          if (term._evaluated == false) {
            term.evaluate({ maximize: true })
          }
          max += term.total
          min += term.number || term.total
        })

        max = dnd5e.dice.simplifyRollFormula(max)
        min = dnd5e.dice.simplifyRollFormula(min)
        let formulaText = dnd5e.dice.simplifyRollFormula(part) + damageTypes
        for (let i = 0; i <= overrideScale; i++) {
          retArr.push({ min: min, max: max, damageTypes: damageTypes, formula: formulaText })
        }
      })
    })

    if (retArr.length == 0) {
      return
    }
    return retArr
  }

  static getActivities(item) {
    return item.system.activities.contents
  }

  static getSaveDc(activity) {
    if (activity.type == 'save') {
      let saveType = activity.save.ability.first()
      let saveDc = activity.save.dc.value
      return { saveType: saveType, saveDc: saveDc }
    }
    return { saveType: '', saveDc: '' }
  }

  static getScaling(item, castLevel) {
    if (item.actorSpellData) {
      castLevel = item.actorSpellData.level
    }
    let activity = item.system.activities.contents[0]
    let mode = activity?.damage?.parts[0]?.scaling.mode || activity?.healing?.scaling.mode
    let scaling = 0
    let number = activity?.damage?.parts[0]?.scaling.number || activity?.healing?.scaling.number
    let formula = activity?.damage?.parts[0]?.scaling.formula || activity?.healing?.scaling.formula
    let itemLevel = item.system.level
    let lvl = 0
    Object.keys(item.actor.classes).forEach((e) => (lvl += item.actor.classes[e].system.levels))
    if (item.system.level == 0) {
      if (lvl >= 17) {
        scaling = 3
      } else if (lvl >= 11) {
        scaling = 2
      } else if (lvl >= 5) {
        scaling = 1
      }
    } else if (mode == 'whole') {
      scaling = castLevel - itemLevel
    } else if (mode == 'half') {
      scaling = Math.floor((castLevel - itemLevel) / 2)
    }
    return { scaling: scaling, number: number, formula: formula }
  }

  static capitalize(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1)
  }

  static checkOverride(item) {
    let items = [
      'Eldritch Blast',
      'Magic Missile',
      'Scorching Ray',
      // 'Mass Healing Word',
      // 'Mass Cure Wounds',
      // 'Steel Wind Strike',
      // 'Chain Lightning',
      // 'Chromatic Orb',
      // 'Chaos Bolt',
      // 'Ice Knife',
    ]
    return items.includes(item.name)
  }

  static getOverrideDamageParts(item) {
    let damageParts = []
    switch (item.name) {
      case 'Eldritch Blast':
        damageParts = [
          {
            min: 1,
            max: 10,
            dieSize: 10,
            bonus: item.system.activities.contents[0]?.damage?.parts[0].bonus,
            damageType: 'force',
          },
        ]
        break
      case 'Magic Missile':
        damageParts = [
          { min: 1, max: 4, dieSize: 4, bonus: 1, damageType: 'force' },
          { min: 1, max: 4, dieSize: 4, bonus: 1, damageType: 'force' },
          { min: 1, max: 4, dieSize: 4, bonus: 1, damageType: 'force' },
        ]
        break
      case 'Scorching Ray':
        damageParts = [
          { min: 2, max: 6, dieSize: 6, bonus: 0, damageType: 'fire' },
          { min: 2, max: 6, dieSize: 6, bonus: 0, damageType: 'fire' },
          { min: 2, max: 6, dieSize: 6, bonus: 0, damageType: 'fire' },
        ]
        break
      default:
        return
    }
    return damageParts
  }
  static getOverrideScaling(item, castLevel, damageParts) {
    let itemLevel = item.system.level
    let mode =
      item.system.activities.contents[0]?.damage?.parts[0]?.scaling.mode ||
      item.system.activities.contents[0]?.healing?.scaling.mode
    if (item.actorSpellData) {
      castLevel = item.actorSpellData.level
    }
    if (castLevel?.slot) {
      if (castLevel?.slot == 'pact') {
        castLevel = item.actor.system.spells.pact.level
      } else {
        castLevel = parseInt(castLevel?.slot.replace('spell', ''))
      }
    }

    let scaling = 0
    let lvl = 0
    Object.keys(item.actor.classes).forEach((e) => (lvl += item.actor.classes[e].system.levels))
    if (item.system.level == 0) {
      if (lvl >= 17) {
        scaling = 3
      } else if (lvl >= 11) {
        scaling = 2
      } else if (lvl >= 5) {
        scaling = 1
      }
    } else if (mode == 'whole') {
      scaling = castLevel - itemLevel
    } else if (mode == 'half') {
      scaling = Math.floor((castLevel - itemLevel) / 2)
    }
    scaling = scaling < 0 ? 0 : scaling

    switch (item.name) {
      case 'Eldritch Blast':
        return scaling

      case 'Magic Missile':
        return 2 + castLevel - itemLevel

      case 'Scorching Ray':
        return 2 + Math.floor((castLevel - itemLevel) / 2)

      default:
    }
    return damageParts
  }

  static getRollData(activity, scalingSteps, config = {}) {
    const excludedTypes = new Set(['summon', 'enchantment', 'utility', 'forward', 'check'])
    if (!activity || excludedTypes.has(activity.type)) {
      return
    }

    class Scaling {
      #increase

      constructor(increase) {
        this.#increase = increase
      }

      get increase() {
        return this.#increase
      }

      get value() {
        return this.#increase + 1
      }

      toString() {
        return this.value
      }
    }

    let rollConfig = {}
    let rollData = activity.getRollData()
    rollData['scaling'] = new Scaling(scalingSteps - 1)

    if (activity?.damage?.parts?.length > 0) {
      rollConfig.rolls = activity.damage.parts
        .map((part, index) => activity._processDamagePart(part, rollConfig, rollData, index))
        .filter((processedPart) => processedPart.parts && processedPart.parts.length > 0)

      if (config.rolls) {
        rollConfig.rolls = rollConfig.rolls.concat(config.rolls)
      }
    } else if (activity?.healing) {
      foundry.utils.mergeObject(rollConfig, { critical: { allow: false }, scaling: 0 }, config)

      const healingRollPart = activity._processDamagePart(activity.healing, rollConfig, rollData)

      rollConfig.rolls =
        healingRollPart.parts && healingRollPart.parts.length > 0 ? [healingRollPart] : []

      if (config.rolls) {
        rollConfig.rolls = rollConfig.rolls.concat(config.rolls)
      }
    } else {
      // console.warn('Activity processed for rolls but has no damage or healing parts:', activity)
      rollConfig.rolls = config.rolls ?? []
    }

    return rollConfig
  }

  static getActionType(item, options) {
    let activation
    activation = item.system?.activities?.contents?.[0]?.activation
    switch (true) {
      case activation?.type == undefined:
        return 'Passive'
      case options.data.root.currentTray.id == 'ritual':
        let time =
          activation.type == 'minute' || activation.type == 'hour'
            ? `+ ${activation.value} ${this.capitalize(activation.type)}`
            : ''
        return `10 Minutes ${time}`
      case activation.type == 'minute':
        return activation.value > 1 ? `${activation.value} Minutes` : `${activation.value} Minute`
      case activation.type == 'hour':
        return activation.value > 1 ? `${activation.value} Hours` : `${activation.value} Hour`
      case activation.type == 'legendary':
        return activation.value > 1
          ? `${activation.value} Legendary Actions`
          : `${activation.value} Legendary Action`
      case activation.type == '':
        return 'None'
      default:
        return this.capitalize(activation.type)
    }
  }
}
