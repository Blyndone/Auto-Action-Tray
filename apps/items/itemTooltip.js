export class AATItemTooltip {
  constructor(item, activity, options = {}) {
    this.name = item.name
    this.type = item.type
    this.item = item
    this.activity = activity ? activity : item.defaultActivity
    this.damageLabel = ''
    this.damageFormulaLabel = ''
    this.description = ''
    this.activationTimeLabel = ''
    this.actionType = ''
    this.ritualActivationTimeLabel = ''
    this.rangeLabel = ''
    this.spellLevel = options.spellLevel ?? null
    this.targetCount = options.targetCount ?? null

    this.saveLabel = ''
    this.concentrationLabel = ''
    this.setValues()
  }

  setValues() {
    this.setDescription()
    this.setActivationLabel()
    if (this.item.isActive) {
      this.setSaveLabel()
      this.setConcentrationLabel()
      this.setRangeLabel()
      this.setDamageLabel(this.item, this.activity)
      this.setTargetCount(this.item, this.activity, this.spellLevel)
    }
  }
  setDamageLabel(item, activity) {
    if (activity.type == 'cast') return
    let scaling = this.getScaling(item.item, activity.activity, this.spellLevel)
    if (scaling['scaling'] == undefined || isNaN(scaling['scaling'])) {
      scaling['scaling'] = 0
      scaling['number'] = 0
    }
    let rollData = this.getRollData(activity.activity, scaling['scaling'])

    let dice = '<i class="fa-solid fa-dice-d6"></i> '

    let data = ''
    let overrideScale = 0
    if (this.checkOverride(item)) {
      overrideScale = this.getOverrideScaling(
        item.item,
        this.spellLevel,
        this.getOverrideDamageParts(item.item),
      )
    }

    if (rollData && rollData.rolls.length > 0) {
      data = this.parseData(rollData, overrideScale)
    }
    if (data == '') return

    this.diceLabel =
      dice + data.map((x) => x.formula).join(' <br><i class="fa-solid fa-dice-d6"></i> ')
    this.damageLabel =
      `${data.reduce((sum, x) => sum + Number(x.min), 0)} ~ ${data.reduce(
        (sum, x) => sum + Number(x.max),
        0,
      )}` + (data[0].damageTypes !== ' Healing' ? ' Damage' : ' Healing')
  }

  setDescription() {
    this.description = this.item.description
  }

  setSaveLabel() {
    if (this.activity?.type == 'save') {
      let saveType = this.activity.save.ability.first()
      let saveDc = this.activity.save.dc.value
      this.saveLabel = `<i class='fa-solid fa-shield-halved'></i>  ${saveType?.toUpperCase()} - DC ${saveDc}  `
    }
  }
  setConcentrationLabel() {
    if (this.item.concentration) {
      this.concentrationLabel = `<i class='fa-solid fa-moon'></i> Concentration`
    } else {
      this.concentrationLabel = ``
    }
  }

  setRangeLabel() {
    const activity = this.activity.activity
    if (!activity) return

    const icon = (type) => (type === 'spell' ? 'fa-wand-sparkles' : 'fa-bow-arrow')

    let label = ''

    if (activity.range.reach) {
      label += `<span class='range-icon'><i class='fa-solid fa-swords'></i></span> ${activity.range.reach} ft. Melee`
    }

    if (activity.range.value) {
      label += `<span class='range-icon'><i class='fa-solid ${icon(this.item.type)}'></i></span> ${
        activity.range.value
      } ${activity.range.long ? ` / ${activity.range.long}` : ''} ft.
    `
    }

    this.rangeLabel = label
  }

  setActivationLabel() {
    const activation = this.activity?.activity.activation
    const type = activation?.type
    const value = activation?.value
    let label = ''

    const unitLabel = (val, singular, plural) =>
      val > 1 ? `${val} ${plural}` : `${val} ${singular}`

    const ACTIVATION_TYPE = {
      MINUTE: 'minute',
      HOUR: 'hour',
      LEGENDARY: 'legendary',
      NONE: '',
      PASSIVE: undefined,
    }

    switch (type) {
      case ACTIVATION_TYPE.PASSIVE:
        label = 'Passive'
        break
      case ACTIVATION_TYPE.NONE:
        label = 'None'
        break
      case ACTIVATION_TYPE.MINUTE:
        label = unitLabel(value, 'Minute', 'Minutes')
        break
      case ACTIVATION_TYPE.HOUR:
        label = unitLabel(value, 'Hour', 'Hours')
        break
      case ACTIVATION_TYPE.LEGENDARY:
        label = unitLabel(value, 'Legendary Action', 'Legendary Actions')
        break
      default:
        label = String(type).capitalize()
        break
    }

    if (this.item?.isRitual) {
      this.ritualActivationTimeLabel = `10 Minutes + ${label}`
    }
    this.activationTimeLabel = label

    switch (label) {
      case 'Action':
        this.actionType = 'action'
        break
      case 'Bonus':
        this.actionType = 'bonus'
        break
      case 'Reaction':
        this.actionType = 'reaction'
        break
      default:
        ''
        break
    }
  }

  getScaling(item, activity, castLevel) {
    if (item.actorSpellData) {
      castLevel = item.actorSpellData.level
    }

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

  checkOverride(item) {
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
  getOverrideDamageParts(item) {
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

  parseData(rollData, overrideScale) {
    if (rollData.rolls.length == 0) {
      return
    }

    let retArr = []
    rollData.rolls.forEach((roll) => {
      let rollTerms = []
      let part = roll.parts.join(' + ')
      part = Roll.replaceFormulaData(part, roll.data)
      rollTerms.push(Roll.parse(part))

      let damageTypes = ' ' + roll.options.types.map((type) => type.capitalize()).join(' ')

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
  getRollData(activity, scalingSteps, config = {}) {
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

  getOverrideScaling(item, castLevel, damageParts) {
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

  setTargetCount(item, activity, spellLevel) {
    let targetCount = 0
    if (!activity) {
      activity = item.defaultActivity
    }

    activity = activity.activity
    item = item.item
    let slotLevel

    if (this.checkOverride(item)) {
      targetCount = this.getOverrideScaling(
        item,
        slotLevel || spellLevel,
        this.getOverrideDamageParts(item),
      )
      targetCount = targetCount + 1
      this.targetCount = targetCount
      return
    }

    switch (true) {
      case activity.target.affects?.type == 'self' || activity.range.units == 'self':
        targetCount = 0
        break
      case item?.type == 'weapon' && activity?.type == 'attack':
        targetCount = 1
        break
      case activity?.target?.affects?.type == 'self' || activity?.target?.affects?.type == 'space':
        targetCount = 0
        break
      case item.type == 'spell' && activity?.target?.affects?.count:
        targetCount = activity?.target?.affects?.count || 1
        break
      case activity?.target?.template?.count > 0:
        targetCount = 0
        break
      default:
        targetCount = activity?.target?.affects?.count || 1
        break
    }
    this.targetCount = targetCount
  }
}
