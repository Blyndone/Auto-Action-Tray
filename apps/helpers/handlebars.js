import { DamageCalc } from './damageCalc.js';

export function registerHandlebarsHelpers() {
  Handlebars.registerHelper('indexRange', function (v1, v2, v3, options) {
    if (parseInt(v1) <= v2 && v2 < parseInt(v3)) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
  });

  Handlebars.registerHelper('capitalize', function (str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  Handlebars.registerHelper('concentration', function (actor) {
    return (
      actor?.system?.parent?.statuses.filter((e) => e == 'concentrating').size >
      0
    );
  });

  Handlebars.registerHelper('damageCal', function (item, options) {
    return DamageCalc.damageCalc(item, options);
  });

  

  Handlebars.registerHelper('getRomanNumeral', function (spellLvl) {
    let romanNumeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
    return romanNumeral[spellLvl - 1];
  });

  Handlebars.registerHelper('getIcon', function (tray, options) {
    let spellLvl = tray.spellLevel == 0 ? '' : tray.spellLevel;
    if (spellLvl != '') {
      let romanNumeral = [
        'I',
        'II',
        'III',
        'IV',
        'V',
        'VI',
        'VII',
        'VIII',
        'IX',
      ];
      options.data.root['spellLevel'] = romanNumeral[spellLvl - 1];
    }

    let icons = {
      slot: `<i class="fa-solid  fa-square icon-slot"></i>`,
      slotSpent: `<i class="fa-solid fa-square icon-slot-spent"></i>`,
      action: `<i class="fa-solid fa-circle  icon-action"></i>`,
      bonus: `<i class="fa-solid fa-triangle icon-bonus"></i>`,
      cantrip: `<i class="fa-solid fa-square-dashed icon-slot"></i>`,
      pact: `<i class="fa-solid fa-square icon-pact"></i>`,
      pactSpent: `<i class="fa-solid fa-square icon-pact-spent"></i>`,
      ritual: `<i class="fa-solid fa-square icon-ritual"></i>`,
      customStaticTray: `<i class="fa-solid fa-swords icon-custom"></i>`,
    };
    let trayIcon =
      tray.id == 'spell-0'
        ? 'cantrip'
        : tray.id.startsWith('spell-')
        ? 'slot'
          : tray.id.startsWith('customStaticTray') ?
          'customStaticTray'
          : tray.id;
    

    switch (trayIcon) {
      case 'slot':
        return (
          icons.slot.repeat(tray.availableSlots) +
          icons.slotSpent.repeat(tray.totalSlots - tray.availableSlots)
        );
      case 'action':
        return icons.action;
      case 'bonus':
        return icons.bonus;
      case 'cantrip':
        return icons.cantrip;
      case 'customStaticTray':
        return icons.customStaticTray;
      case 'pact':
         return (
          icons.pact.repeat(tray.availableSlots) +
          icons.pactSpent.repeat(tray.totalSlots - tray.availableSlots)
        );
      case 'ritual':
        return icons.ritual;

      default:
        return '';
    }
  });

//  Handlebars.registerHelper('getCircleColor', function (tillNextTurn) {
//   if (tillNextTurn === 0) return '#9600d1'; // Brighter purple  
//   if (tillNextTurn === 1) return '#a000c9'; // Slightly different purple  
//   return '#8500a0'; // Default stroke color  
// });


}


