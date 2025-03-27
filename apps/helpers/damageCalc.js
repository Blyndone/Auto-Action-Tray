export class DamageCalc {
  static damageCalc(item, options) {
    if (options.data.root['animating']) {
      return
    }
    options.data.root['diceFormula'] = ''
    options.data.root['actionType'] = ''
    options.data.root['saveType'] = ''
    let currentTray = options.data.root.currentTray
    let bonus = 0

    let activities = this.getActivities(item)
    if (activities.length == 0 || (activities.length == 1 && activities[0].type == 'utility')) {
      return ''
    }

    let i = 0
    let activity = activities[i]
    let scaling = this.getScaling(item, currentTray.spellLevel)

    if (scaling['scaling'] == undefined || isNaN(scaling['scaling'])) {
      scaling['scaling'] = 0
      scaling['number'] = 0
    }

    let rollData = this.getRollData(activity, scaling['scaling'])
    let saveDc = activities.map((activity) => this.getSaveDc(activity))

    let dice = '<i class="fa-solid fa-dice-d6"></i> '

    let data = ''
    if (rollData && rollData.rolls.length > 0) {
      data = this.parseData(rollData)
    }

    if (saveDc[i].saveType != '') {
      options.data.root['saveType'] = `    ${saveDc[i].saveType.toUpperCase()} - DC ${
        saveDc[i].saveDc
      }`
    }
    options.data.root['actionType'] = this.capitalize(
      item.system?.activities?.contents[i]?.activation?.type,
    )

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

  static parseData(rollData) {
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
        retArr.push({ min: min, max: max, damageTypes: damageTypes, formula: formulaText })
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

    let mode =
      item.system.activities.contents[0]?.damage?.parts[0]?.scaling.mode ||
      item.system.activities.contents[0]?.healing?.scaling.mode
    let scaling = 0
    let number =
      item.system.activities.contents[0]?.damage?.parts[0]?.scaling.number ||
      item.system.activities.contents[0]?.healing?.scaling.number
    let formula =
      item.system.activities.contents[0]?.damage?.parts[0]?.scaling.formula ||
      item.system.activities.contents[0]?.healing?.scaling.formula
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
        damageParts = [...damageParts, ...Array(scaling).fill({ ...damageParts[0] })]
        break
      case 'Magic Missile':
        damageParts = [...damageParts, ...Array(castLevel - itemLevel).fill({ ...damageParts[0] })]
        break
      case 'Scorching Ray':
        damageParts = [...damageParts, ...Array(scaling).fill({ ...damageParts[0] })]
        break
      default:
        break
    }
    return damageParts
  }

  static getRollData(activity, scalingSteps) {
    if (
      !activity ||
      activity.type == 'summon' ||
      activity.type == 'enchantment' ||
      activity.type == 'utility' ||
      activity.type == 'forward' ||
      activity.type == 'check'
    )
      return
    class Scaling {
      constructor(increase) {
        this.#increase = increase
      }

      #increase

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
    let config = {}

    let rollData = activity.getRollData()
    rollData['scaling'] = new Scaling(scalingSteps - 1)

    if (activity?.damage?.parts) {
      rollConfig.rolls = activity.damage.parts
        .map((d, index) => activity._processDamagePart(d, rollConfig, rollData, index))
        .filter((d) => d.parts.length)
        .concat(config.rolls ?? [])
    } else {
      const rollConfig = foundry.utils.mergeObject(
        { critical: { allow: false }, scaling: 0 },
        config,
      )
      rollConfig.rolls = [
        activity._processDamagePart(activity.healing, rollConfig, rollData),
      ].concat(config.rolls ?? [])

      return rollConfig
    }

    return rollConfig
  }
}
