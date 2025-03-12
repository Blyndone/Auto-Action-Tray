export class DamageCalc {
  static damageCalc(item, options) {
    options.data.root['diceFormula'] = '';
    options.data.root['actionType'] = '';
    options.data.root['saveType'] = '';
    let currentTray = options.data.root.currentTray;
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
              ? this.capitalize(baseDamage.types.first())
              : 'Damage';
        }
        break;
      }
      case item.type == 'spell' && actionType == 'heal': {
        let scaling = {};
        if (item.system.activities.contents[0].canScaleDamage) {
          scaling = this.getScaling(item, currentTray.spellLevel);
        }

        const baseDamage = item.system.activities.contents[0].healing;
        if (baseDamage?.number && baseDamage?.denomination) {
          min = baseDamage.number; // Minimum healing (1 * number of dice)
          max = baseDamage.number * baseDamage.denomination; // Maximum healing
          dieSize = baseDamage.denomination; // Die size
          bonus = baseDamage.bonus; // Bonus healing
          let numberDice;
          if (scaling['scaling']) {
            numberDice = scaling['scaling'] * scaling['number'];

            min += numberDice;
            max += numberDice * baseDamage.denomination;
          }
          if (bonus == '@mod') {
            bonus =
              item.parent.system.abilities[
                item.parent.system.attributes.spellcasting
              ].mod;
          }
          damageType =
            baseDamage.types.size > 0
              ? this.capitalize(baseDamage.types.first())
              : 'Healing';
          damageType = 'Healing';
        }
        break;
      }
      case item.type == 'spell' &&
        (actionType == 'attack' ||
          actionType == 'save' ||
          actionType == 'damage'): {
        let scaling = {};
        if (item.system.activities.contents[0].canScaleDamage) {
          scaling = this.getScaling(item, currentTray.spellLevel);
        }
        const baseDamage = item.system.activities.contents[0].damage.parts[0];
        if (baseDamage?.number && baseDamage?.denomination) {
          min = baseDamage.number; // Minimum healing (1 * number of dice)
          max = baseDamage.number * baseDamage.denomination; // Maximum healing
          dieSize = baseDamage.denomination; // Die size
          bonus = baseDamage.bonus; // Bonus healing
          let numberDice;
          if (scaling['scaling']) {
            numberDice = scaling['scaling'] * scaling['number'];

            min += numberDice;
            max += numberDice * baseDamage.denomination;
          }
          if (actionType == 'save') {
            saveType = item.system.activities.contents[0].save.ability.first();
            saveDc = item.system.activities.contents[0].save.dc.value;
          }

          damageType =
            baseDamage.types.size > 0
              ? this.capitalize(baseDamage.types.first())
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

    options.data.root['actionType'] = this.capitalize(
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
  }

  static getScaling(item, castLevel) {
    if (item.actorSpellData) {
      castLevel = item.actorSpellData.level;
    }
    let mode =
      item.system.activities.contents[0]?.damage?.parts[0]?.scaling.mode ||
      item.system.activities.contents[0]?.healing?.scaling.mode;
    let scaling;
    let number =
      item.system.activities.contents[0]?.damage?.parts[0]?.scaling.number ||
      item.system.activities.contents[0]?.healing?.scaling.number;
    let formula =
      item.system.activities.contents[0]?.damage?.parts[0]?.scaling.formula ||
      item.system.activities.contents[0]?.healing?.scaling.formula;
    let itemLevel = item.system.level;
    let lvl = 0;
    Object.keys(item.actor.classes).forEach(
      (e) => (lvl += item.actor.classes[e].system.levels)
    );
    if (item.system.level == 0) {
      if (lvl >= 17) {
        scaling = 3;
      } else if (lvl >= 11) {
        scaling = 2;
      } else if (lvl >= 5) {
        scaling = 1;
      }
    } else if (mode == 'whole') {
      scaling = castLevel - itemLevel;
    } else if (mode == 'half') {
      scaling = Math.floor((castLevel - itemLevel) / 2);
    }
    return { scaling: scaling, number: number, formula: formula };
  }

  static capitalize(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
    }

    staticCheckMultiHit() { 
        let items = [
    "Eldritch Blast",
    "Magic Missile",
    "Scorching Ray",
    "Mass Healing Word",
    "Mass Cure Wounds",
    "Steel Wind Strike",
    "Chain Lightning",
    "Chromatic Orb",
    "Chaos Bolt",
    "Ice Knife"
]
    }
}
