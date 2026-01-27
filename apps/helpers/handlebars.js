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
    return a != b
  })

  Handlebars.registerHelper('getDeathActive', function (type, death, index) {
    if (death[type] == 3) {
      return 'active-full'
    }
    return death[type] >= index ? 'active' : 'inactive'
  })

  Handlebars.registerHelper('getItemActive', function (itemName, activeEffects) {
    return activeEffects.includes(itemName) ? 'animated-border' : ''
  })

  Handlebars.registerHelper('capitalize', function (str) {
    if (!str) return ''
    return str.charAt(0).toUpperCase() + str.slice(1)
  })

  Handlebars.registerHelper('concentration', function (actor) {
    return actor?.system?.parent?.statuses.filter((e) => e == 'concentrating').size > 0
  })

  Handlebars.registerHelper('selectItemTooltip', function (item, tray) {
    if (tray.type != 'static' && tray.type != 'activity') {
      return item.tooltip
    }
    if (tray.spellLevel) {
      let tooltip = item.defaultActivity?.tooltips?.find((e) => e.spellLevel == tray.spellLevel)
      if (tooltip) {
        return tooltip
      }
    } else {
      return item.tooltip
    }
  })

  Handlebars.registerHelper('getDuration', function (duration) {
    if (duration == 'Condition') return 'Condition'
    if (!duration) return ''
    let txt = ''
    let seconds = duration.seconds
    let rounds = duration.rounds
    let turns = duration.turns
    if (!(seconds || rounds || turns)) return 'Ongoing'
    txt = ` ${rounds ? rounds + ' Rounds' : ''} ${turns ? turns + ' Turns' : ''} ${
      seconds ? seconds + ' Seconds' : ''
    }`
    return txt
  })

  Handlebars.registerHelper('getRomanNumeral', function (spellLvl) {
    return dnd5e.utils.formatNumber(spellLvl, { numerals: true })
  })

  Handlebars.registerHelper('getTooltipTheme', function () {
    if (game.settings.get('auto-action-tray', 'autoTheme')) {
      return game.settings.get('auto-action-tray', 'tempTheme')
    }
    return game.settings.get('auto-action-tray', 'theme')
  })

  Handlebars.registerHelper('multiGroup', function (tray, index) {
    if (!tray.multiattackIndexGroups) return false

    let trayIndex = null

    tray.multiattackIndexGroups.forEach((group, groupIndex) => {
      if (group.includes(index)) {
        trayIndex = groupIndex
      }
    })

    return trayIndex !== null ? `multi-group${trayIndex}` : ''
  })

  Handlebars.registerHelper('getIcon', function (tray, options) {
    let spellLvl = tray.spellLevel == 0 ? '' : tray.spellLevel
    if (spellLvl != '') {
      options.data.root['spellLevel'] = dnd5e.utils.formatNumber(spellLvl, { numerals: true })
    }

    let icons = {
      slot: `<i class="fa-solid  fa-square icon-slot"></i>`,
      slotSpent: `<i class="fa-solid fa-square icon-slot-spent"></i>`,
      action: `<i class="fa-solid fa-circle  icon-action"></i>`,
      bonus: `<i class="fa-solid fa-triangle icon-bonus"></i>`,
      actionSpent: `<i class="fa-solid fa-circle  icon-action icon-depleted"></i>`,
      bonusSpent: `<i class="fa-solid fa-triangle icon-bonus icon-depleted"></i>`,
      cantrip: `<i class="fa-solid fa-square-dashed icon-slot-cantrip"></i>`,
      pact: `<i class="fa-solid fa-square icon-pact"></i>`,
      pactSpent: `<i class="fa-solid fa-square icon-pact-spent"></i>`,
      ritual: `<i class="fa-solid fa-square icon-ritual"></i>`,
      customStaticTray: `<i class="fa-solid fa-swords icon-custom"></i>`,
      extraSpells: '<i class="fa-solid fa-square-plus icon-default"></i>',
      spellUseSpentSlot: `<i class="fa-solid  fa-square icon-slot icon-depleted "></i>`,
      spellUseSpentSlotSpent: `<i class="fa-solid  fa-square icon-slot-spent icon-depleted "></i>`,
      spellUseSpentPact: `<i class="fa-solid  fa-square icon-pact icon-depleted"></i>`,
      spellUseSpentPactSpent: `<i class="fa-solid  fa-square icon-pact-spent icon-depleted"></i>`,
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
        if (tray.totalSlots == 0) {
          return icons.extraSpells
        }
        if (this.application.combatHandler.actions.spellSlot == 0) {
          return (
            icons.spellUseSpentSlot.repeat(tray.availableSlots) +
            icons.spellUseSpentSlotSpent.repeat(Math.max(0, tray.totalSlots - tray.availableSlots))
          )
        } else return icons.slot.repeat(tray.availableSlots) + icons.slotSpent.repeat(Math.max(0, tray.totalSlots - tray.availableSlots))
      case 'action':
        return this.application.combatHandler.actions.action == 0 ? icons.actionSpent : icons.action
      case 'bonus':
        return this.application.combatHandler.actions.bonus == 0 ? icons.bonusSpent : icons.bonus
      case 'extraSpells':
        return icons.extraSpells
      case 'cantrip':
        return icons.cantrip
      case 'customStaticTray':
        return icons.customStaticTray
      case 'pact':
        if (this.application.combatHandler.actions.spellSlot == 0) {
          return (
            icons.spellUseSpentPact.repeat(tray.availableSlots) +
            icons.spellUseSpentPactSpent.repeat(tray.totalSlots - tray.availableSlots)
          )
        } else return icons.pact.repeat(tray.availableSlots) + icons.pactSpent.repeat(tray.totalSlots - tray.availableSlots)
      case 'ritual':
        return icons.ritual

      default:
        return '<i class="fa-solid fa-flask icon-default"></i>'
    }
  })

Handlebars.registerHelper('diceIcon', function (currentDice) {
  const diceIcons = [
    '<i class="fa-solid fa-dice-d20"></i>',
    '<i class="fa-solid fa-dice-d12"></i>',
    '<i class="fa-solid fa-dice-d10"></i>',
    '<i class="fa-solid fa-dice-d8"></i>',
    '<i class="fa-solid fa-dice-d6"></i>',
    '<i class="fa-solid fa-dice-d4"></i>',
    `
    <span style="
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:1.2em;
      height:1.2em;
    ">
      <span style="
        position:relative;
        width:100%;
        height:100%;
      ">
        <i class="fa-solid fa-dice-d10"
           style="
             position:absolute;
             left:.08em;
             top:.12em;
             font-size:0.85em;
             opacity:0.7;
           "></i>
        <i class="fa-solid fa-dice-d10"
           style="
             position:absolute;
             bottom:0.12em;
             right:.08em;
             font-size:0.85em;
           "></i>
      </span>
    </span>
    `
  ]

  return new Handlebars.SafeString(diceIcons[currentDice])
})





  Handlebars.registerHelper('setConcentrationColor', function (color) {
    document.getElementById('auto-action-tray')?.style.setProperty('--concentration-color', color)
  })

  Handlebars.registerHelper('formatLink', function (link) {
    return link.replace(/ /g, '%20')
  })
  Handlebars.registerHelper('IncDecTooltip', function (plusOrMinus) {
    const useQuickElevation = game.settings.get('auto-action-tray', 'quickElevation')
    if (useQuickElevation) {
      return plusOrMinus == 'plus' ? 'Increase Elevation by 5' : 'Decrease Elevation by 5'
    }
    return plusOrMinus == 'plus' ? 'Increase Skill Tray Row Count' : 'Decrease Skill Tray Row Count'
  })
  Handlebars.registerHelper('removeEnrichment', function (text) {})
  //  Handlebars.registerHelper('enrichText', function (text) {
  //   return TextEditor.enrichHTML(text, {

  //   })
  // })
}
