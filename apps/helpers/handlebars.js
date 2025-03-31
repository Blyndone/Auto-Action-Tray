import { DamageCalc } from './damageCalc.js'

export function registerHandlebarsHelpers() {
  Handlebars.registerHelper('indexRange', function (v1, v2, v3, options) {
    if (parseInt(v1) <= v2 && v2 < parseInt(v3)) {
      return options.fn(this)
    }
    return options.inverse(this)
  })

  Handlebars.registerHelper('eq', function (a, b) {
    return a === b
  })

    Handlebars.registerHelper('neq', function (a, b) {
    return a != b  })

  Handlebars.registerHelper('capitalize', function (str) {
    if (!str) return ''
    return str.charAt(0).toUpperCase() + str.slice(1)
  })

  Handlebars.registerHelper('concentration', function (actor) {
    return actor?.system?.parent?.statuses.filter((e) => e == 'concentrating').size > 0
  })

  Handlebars.registerHelper('damageCal', function (item, options) {
    return DamageCalc.damageCalc(item, options)
  })

  Handlebars.registerHelper('getDuration', function (duration) {
    let txt = ''
    let seconds = duration.seconds
    let rounds = duration.rounds
    let turns = duration.turns
    if (!(seconds || rounds || turns)) return 'Ongoing'
    txt = ` ${(rounds) ? rounds + ' Rounds' : ''} ${(turns) ? turns + ' Turns' : ''} ${(seconds) ? seconds + ' Seconds' : ''}`
    return txt
  })

  Handlebars.registerHelper('getRomanNumeral', function (spellLvl) {
    let romanNumeral = ['','I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
    return romanNumeral[spellLvl]
  })

  Handlebars.registerHelper('multiGroup', function (tray, index) {
    if (!tray.multiattackIndexGroups) return false

    let trayIndex = null // Stores the index of the tray that contains the group

    tray.multiattackIndexGroups.forEach((group, groupIndex) => {
      if (group.includes(index)) {
        trayIndex = groupIndex // Store the tray index where the group is found
      }
    })

    return trayIndex !== null ? `multi-group${trayIndex}` : ''
  })

  Handlebars.registerHelper('getIcon', function (tray, options) {
    let spellLvl = tray.spellLevel == 0 ? '' : tray.spellLevel
    if (spellLvl != '') {
      let romanNumeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
      options.data.root['spellLevel'] = romanNumeral[spellLvl - 1]
    }

    let icons = {
      slot: `<i class="fa-solid  fa-square icon-slot"></i>`,
      slotSpent: `<i class="fa-solid fa-square icon-slot-spent"></i>`,
      action: `<i class="fa-solid fa-circle  icon-action"></i>`,
      bonus: `<i class="fa-solid fa-triangle icon-bonus"></i>`,
      cantrip: `<i class="fa-solid fa-square-dashed icon-slot-cantrip"></i>`,
      pact: `<i class="fa-solid fa-square icon-pact"></i>`,
      pactSpent: `<i class="fa-solid fa-square icon-pact-spent"></i>`,
      ritual: `<i class="fa-solid fa-square icon-ritual"></i>`,
      customStaticTray: `<i class="fa-solid fa-swords icon-custom"></i>`,
    }
    let trayIcon =
      tray.id == 'spell-0'
        ? 'cantrip'
        : tray.id.startsWith('spell-')
        ? 'slot'
        : tray.id.startsWith('customStaticTray')
        ? 'customStaticTray'
        : tray.id

    switch (trayIcon) {
      case 'slot':
        return (
          icons.slot.repeat(tray.availableSlots) +
          icons.slotSpent.repeat(tray.totalSlots - tray.availableSlots)
        )
      case 'action':
        return icons.action
      case 'bonus':
        return icons.bonus
      case 'cantrip':
        return icons.cantrip
      case 'customStaticTray':
        return icons.customStaticTray
      case 'pact':
        return (
          icons.pact.repeat(tray.availableSlots) +
          icons.pactSpent.repeat(tray.totalSlots - tray.availableSlots)
        )
      case 'ritual':
        return icons.ritual

      default:
        return ''
    }
  })

  Handlebars.registerHelper('diceIcon', function (currentDice) {
    let diceIcons = [
      '<i class="fa-solid fa-dice-d20"></i>',
      '<i class="fa-solid fa-dice-d12"></i>',
      '<i class="fa-solid fa-dice-d10"></i>',
      '<i class="fa-solid fa-dice-d8"></i>',
      '<i class="fa-solid fa-dice-d6"></i>',
      '<i class="fa-solid fa-dice-d4"></i>',
    ]
    return diceIcons[currentDice]
  })

  Handlebars.registerHelper('setConcentrationColor', function (color) {
    document.documentElement.style.setProperty('--concentration-color', color)
    })
   
  

  //  Handlebars.registerHelper('getCircleColor', function (tillNextTurn) {
  //   if (tillNextTurn === 0) return '#9600d1'; // Brighter purple
  //   if (tillNextTurn === 1) return '#a000c9'; // Slightly different purple
  //   return '#8500a0'; // Default stroke color
  // });
}
