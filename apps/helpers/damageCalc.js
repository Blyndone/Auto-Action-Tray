export class DamageCalc {
  static damageCalc(item, options) {
    if (options.data.root['animating']) {
      return;
    }
    options.data.root['diceFormula'] = '';
    options.data.root['actionType'] = '';
    options.data.root['saveType'] = '';
    let currentTray = options.data.root.currentTray;
    let bonus = 0,
      saveType = '';

    let activities = this.getActivities(item);
    if (activities.length == 0) {
      return '';
    }

    let damageParts = activities.map((activity) => this.getDamage(activity));
    let flatDamages = activities.map((activity) =>
      this.getFlatDamage(activity, item.actor)
    );
    let saveDc = activities.map((activity) => this.getSaveDc(activity));

    let scaling = this.getScaling(item, currentTray.spellLevel);

    let i = 0;
    let activity = activities[i];
    let actorBonuses = item.actor.system.bonuses;
    let activityBonus = parseInt(actorBonuses[activity.actionType]?.damage) || 0;


    if (this.checkOverride(item)) {
      damageParts[0] = this.getOverrideDamageParts(item);
      let scalingDamageParts = this.getOverrideScaling(
        item,
        currentTray.spellLevel,
        damageParts[0]
      );
      damageParts[0] = scalingDamageParts;
      scaling['scaling'] = 0;
      scaling['number'] = 0;
    }

    options.data.root['actionType'] = this.capitalize(
      item.system?.activities?.contents[i]?.activation?.type
    );
    let dice = ['<i class="fa-solid fa-dice-d6"></i>'];
    let damage = [];
    let totalDamage = { min: 0, max: 0 };

    if (scaling['scaling'] == undefined || isNaN(scaling['scaling'])) {
      scaling['scaling'] = 0;
      scaling['number'] = 0;
    }

    damageParts[i].forEach((part) => {
      bonus = 0;
      if (flatDamages[i].length != 0) {
        bonus = flatDamages[i][0] != '' ? parseInt(flatDamages[i]) : 0;
      }
      bonus += activityBonus;

      
      dice.push(
        `${part.min}d${part.dieSize}${bonus > 0 ? ' + ' + bonus : ''} ${[
          this.capitalize(part.damageType),
        ].join(' ')}`
      );
      totalDamage['min'] =
        totalDamage['min'] +
        part.min +
        scaling['scaling'] * scaling['number'] +
        bonus;
      totalDamage['max'] =
        totalDamage['max'] +
        part.max +
        scaling['scaling'] * scaling['number'] * part.dieSize +
        bonus;
    });

    if (scaling['scaling'] != 0) {
      dice.push(
        `${scaling['scaling'] * scaling['number']}d${
          damageParts[i][0]?.dieSize
        }`
      );
    }

    if (totalDamage['min'] != 0 && totalDamage['max'] != 0) {
      damage.push(`${totalDamage['min']} ~ ${totalDamage['max']} `);
      damage.push(
        `${damageParts[i][0]?.damageType != 'healing' ? 'Damage' : 'Healing'} `
      );
    }

    if (saveDc[i].saveType != '') {
      options.data.root['saveType'] = `    ${saveDc[
        i
      ].saveType.toUpperCase()} - DC ${saveDc[i].saveDc}`;
    }

    if (
      damageParts[i][0]?.formula != '' &&
      damageParts[i][0]?.formula != undefined
    ) {
      damage = [damageParts[i][0]?.formula];
      dice = [damageParts[i][0]?.formula];
    }

    options.data.root['diceFormula'] =
      dice.length > 1
        ? dice.slice(0, 1) +
          ' ' +
          dice.slice(1).join(' <br><i class="fa-solid fa-dice-d6"></i> ')
        : '';
    return damage.join(' ');
  }

  //returns [activies]
  static getActivities(item) {
    return item.system.activities.contents;
  }
  //returns [{min, dieSize, max, mod, damageType}]
  static getDamage(activity) {
    let damage = {
      min: 0,
      max: 0,
      dieSize: 0,
      bonus: 0,
      damageType: '',
    };
    let damageParts = [];
    switch (true) {
      case activity.type == 'attack' ||
        activity.type == 'damage' ||
        activity.type == 'save' ||
        activity.type == 'spell':
        activity.damage.parts.forEach((part) => {
          damageParts.push({
            min: part.number,
            max: part.number * part.denomination,
            dieSize: part.denomination,
            bonus: part.bonus,
            damageType: [...part.types],
            formula: part.custom.enabled ? part.custom.formula : '',
          });
        });
        break;
      case activity.type == 'heal':
        let healing = activity.healing;
        damageParts.push({
          min: healing.number,
          max: healing.number * healing.denomination,
          dieSize: healing.denomination,
          bonus: healing.bonus,
          damageType: 'healing',
          formula: healing.custom.enabled ? healing.custom.formula : '',
        });
        break;
      case 'damage':

      default:
        return [];
    }
    return damageParts;
  }

  //return flat [Mod]
  static getFlatDamage(activity, actor) {
    let flatDamages = [];
    let ability = '';
    let modDamge = 0;
    switch (true) {
      case activity.type == 'utility':
        return [];

      case activity?.attack?.type.classification == 'weapon':
        ability = activity.attack.ability;
        if (ability == '') {
          ability = activity.attack.type.value == 'melee' ? 'str' : 'dex';
        }
        modDamge =
          actor.system.abilities[ability ? ability : activity.item.abilityMod]
            .mod;
        activity.damage.parts.forEach((part) => {
          flatDamages.push(part.bonus + modDamge);
        });
        break;

      case activity.item.type == 'spell' &&
        activity.type != 'heal' &&
        (activity.type == 'save' ||
          activity.type == 'attack' ||
          activity.type == 'damage'):
        ability = activity?.attack?.ability;
        ability =
          activity.parent?.ability != ''
            ? activity.parent.ability
            : actor.system.attributes.spellcasting;

        modDamge =
          actor.system.abilities[ability ? ability : activity.item.abilityMod]
            .mod;
        activity.damage.parts.forEach((part) => {
          flatDamages.push(part.bonus == '@mod' ? modDamge : part.bonus);
        });
        break;

      case activity.type == 'heal':
        ability =
          activity.ability != '' && activity.ability
            ? activity.ability
            : actor.system.attributes.spellcasting;
        modDamge =
          actor.system.abilities[ability ? ability : activity.item.abilityMod]
            ?.mod || 0;
        flatDamages.push(
          activity.healing.bonus == '@mod' ? modDamge : activity.healing.bonus
        );
        break;
      default:
        return [];
    }
    return flatDamages;
  }
  static getSaveDc(activity) {
    if (activity.type == 'save') {
      let saveType = activity.save.ability.first();
      let saveDc = activity.save.dc.value;
      return { saveType: saveType, saveDc: saveDc };
    }
    return { saveType: '', saveDc: '' };
  }

  //return { scaling: scaling, number: number, formula: formula };
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
    ];
    return items.includes(item.name);
  }

  static getOverrideDamageParts(item) {
    let damageParts = [];
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
        ];
        break;
      case 'Magic Missile':
        damageParts = [
          { min: 1, max: 4, dieSize: 4, bonus: 1, damageType: 'force' },
          { min: 1, max: 4, dieSize: 4, bonus: 1, damageType: 'force' },
          { min: 1, max: 4, dieSize: 4, bonus: 1, damageType: 'force' },
        ];
        break;
      case 'Scorching Ray':
        damageParts = [
          { min: 2, max: 6, dieSize: 6, bonus: 0, damageType: 'fire' },
          { min: 2, max: 6, dieSize: 6, bonus: 0, damageType: 'fire' },
          { min: 2, max: 6, dieSize: 6, bonus: 0, damageType: 'fire' },
        ];
        break;
      default:
        return;
    }
    return damageParts;
  }
  static getOverrideScaling(item, castLevel, damageParts) {
    let itemLevel = item.system.level;
    let mode =
      item.system.activities.contents[0]?.damage?.parts[0]?.scaling.mode ||
      item.system.activities.contents[0]?.healing?.scaling.mode;
    if (item.actorSpellData) {
      castLevel = item.actorSpellData.level;
    }
    let scaling = 0;
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
    scaling = scaling < 0 ? 0 : scaling;

    switch (item.name) {
      case 'Eldritch Blast':
        damageParts = [
          ...damageParts,
          ...Array(scaling).fill({ ...damageParts[0] }),
        ];
        break;
      case 'Magic Missile':
        damageParts = [
          ...damageParts,
          ...Array(castLevel - itemLevel).fill({ ...damageParts[0] }),
        ];
        break;
      case 'Scorching Ray':
        damageParts = [
          ...damageParts,
          ...Array(scaling).fill({ ...damageParts[0] }),
        ];
        break;
      default:
        break;
    }
    return damageParts;
  }
}
