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
    if(!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  //min damage

  Handlebars.registerHelper('damageCal', function (item, options) {
    options.data.root['diceFormula'] = '';
    options.data.root['actionType'] = '';
    options.data.root['saveType'] = '';
    let min = 0,
      dieSize = 0,
      max = 0,
      bonus = 0,
      saveType = '',
      saveDc = 0,
      damageType = '';

    let actionType = item.system?.activities?.contents[0].type;

    switch (true) {
      case item.type == 'weapon': {
        const baseDamage = item.system.damage.base;
        if (baseDamage.number && baseDamage.denomination) {
          min = baseDamage.number; // Minimum damage (1 * number of dice)
          max = baseDamage.number * baseDamage.denomination; // Maximum damage
          dieSize = baseDamage.denomination; // Die size

          let ability = item.system.activities.contents[0].attack.ability;
          if (ability == '') {
            ability =
              item.system.activities.contents[0].attack.type.value == 'melee'
                ? 'str'
                : 'dex';
          }

          bonus = item.parent.system.abilities[ability].mod; // Bonus damage

          damageType =
            baseDamage.types.size > 0
              ? capitalize(baseDamage.types.first())
              : 'Damage';
        }
        break;
      }
      case item.type == 'spell' && actionType == 'heal': {
        const baseDamage = item.system.activities.contents[0].healing;
        if (baseDamage?.number && baseDamage?.denomination) {
          min = baseDamage.number; // Minimum healing (1 * number of dice)
          max = baseDamage.number * baseDamage.denomination; // Maximum healing
          dieSize = baseDamage.denomination; // Die size
          bonus = baseDamage.bonus; // Bonus healing
          if (bonus == '@mod') {
            bonus =
              item.parent.system.abilities[
                item.parent.system.attributes.spellcasting
              ].mod;
          }
          damageType =
            baseDamage.types.size > 0
              ? capitalize(baseDamage.types.first())
              : 'Healing';
          damageType = 'Healing';
        }
        break;
      }
      case item.type == 'spell' &&
        (actionType == 'attack' ||
          actionType == 'save' ||
          actionType == 'damage'): {
        const baseDamage = item.system.activities.contents[0].damage.parts[0];
        if (baseDamage?.number && baseDamage?.denomination) {
          min = baseDamage.number; // Minimum healing (1 * number of dice)
          max = baseDamage.number * baseDamage.denomination; // Maximum healing
          dieSize = baseDamage.denomination; // Die size
          bonus = baseDamage.bonus; // Bonus healing

          if (actionType == 'save') {
            saveType = item.system.activities.contents[0].save.ability.first();
            saveDc = item.system.activities.contents[0].save.dc.value;
          }

          damageType =
            baseDamage.types.size > 0
              ? capitalize(baseDamage.types.first())
              : 'Damage';
        }

        break;
      }

      case item.type == 'consumable': {
        break;
      }
      default:
        // console.log('default-' + item.name);
        break;
    }

    bonus = bonus != '' ? parseInt(bonus) : 0;

    options.data.root['actionType'] = capitalize(
      item.system?.activities?.contents[0].activation.type
    );

    if (min == 0) return;
    if (min === max) return `${min} ${damageType}`;

    if (saveType != '') {
      options.data.root[
        'saveType'
      ] = `    ${saveType.toUpperCase()} - DC ${saveDc}`;
    }
    options.data.root['diceFormula'] = `🎲${min}d${dieSize}${
      bonus > 0 ? ' + ' + bonus : ''
    } ${damageType}`;

    min += bonus;
    max += bonus;
    return `${min} ~ ${max}  Damage`;
  });
  
  Handlebars.registerHelper('getRomanNumeral', function (spellLvl) {
  let romanNumeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];     
    return romanNumeral[spellLvl - 1];
  })
    
  Handlebars.registerHelper('getIcon', function (tray, options) {

     let spellLvl = (tray.spellLevel == 0) ? '' : tray.spellLevel;
    if (spellLvl != '') { 
      let romanNumeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];     
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
    };
    let trayIcon =
      tray.id == 'spell-0'
        ? 'cantrip'
        : tray.id.startsWith('spell-')
        ? 'slot'
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
      case 'pact':
        return icons.pact;
      case 'ritual':
        return icons.ritual;

      default:
        return '';
    }
  });

  //max damage

  //damage formula

  //range

  //action
}

function capitalize(val) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}
