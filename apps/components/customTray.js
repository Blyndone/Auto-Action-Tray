import { AbilityTray } from './abilityTray.js';

export class CustomTray extends AbilityTray {
  constructor(options = {}) {
    super(options);
    this.savedData = false;
    this.category = options.category;
    this.id = options.id;
    this.type = 'custom';

    if (!this.savedData && !this.checkSavedData(this.id)) {
      // console.log('Generating Custom Trays');

      this.generateTray();
    } else {
      //   console.log('Getting Saved Data');
      this.getSavedData();
    }
  }

  generateTray() {
    // Common, Class, Consumables

    let actor = fromUuidSync(this.actorUuid);
    if (actor.type === 'npc') {
      this.generateNpcTray(actor);
      return;
    }
    let allItems = actor.items.filter((e) => e.system?.activities?.size);
    switch (this.category) {
      case 'common':
        this.abilities = allItems.filter(
          (e) =>
            (e.system?.activities?.some(
              (activity) => activity?.activation?.type === 'action'
            ) ||
              e.system?.activities?.some(
                (activity) => activity?.activation?.type === 'bonus'
              )) &&
            e.type != 'spell'
        );
        this.id = 'common';
        break;
      case 'classFeatures':
        this.abilities = allItems.filter((e) => e.type === 'feat');
        this.id = 'classFeatures';
        break;
      case 'items':
        this.abilities = allItems.filter((e) => e.type === 'consumable');
        this.id = 'items';
        break;
      case 'passive':
        this.abilities = actor.items.filter(
          (e) => e.system?.activities?.size < 1
        );
        this.id = 'passive';
        break;
      case 'reaction':
        this.abilities = allItems.filter((e) =>
          e.system?.activities?.some(
            (activity) => activity?.activation?.type === 'reaction'
          )
        );
        this.id = 'reaction';
        break;
      case 'custom':
        this.id = 'custom';
        break;
    }

    this.abilities = AbilityTray.padArray(this.abilities, 20);
  }

  generateNpcTray(actor) {
    this.abilities = [];
    let allItems = actor.items.filter((e) => e.system?.activities?.size);
    let multiattack = actor.items.find((e) => e.name === 'Multiattack');
    if (multiattack && this.category === 'common') {
      let desc = multiattack.system.description.value;
      let itemNames = allItems.map((e) => e.name.toLowerCase());
      itemNames.push('melee');
      itemNames.push('ranged');
      itemNames.push('spell');

      let regex;
      let regexPattern;
      let matches;
      let split;
      let multi;

      let num = {
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
      };

      desc = desc.replaceAll('with its ', '');
      regexPattern = `\\b(or)\\b `;
      regex = new RegExp(regexPattern, 'g');
      let orMatches = desc.match(regex);
      if (orMatches) {
        split = desc.split(' or ');
      } else {
        split = [desc];
      }
      split.forEach((e) => {
        regexPattern = `\\b(one|two|three|four|five|six|seven|eight|nine|ten)\\b (${itemNames.join(
          '|'
        )})`;
        regex = new RegExp(regexPattern, 'g');
        matches = e.match(regex);
        if (matches) {
          matches.forEach((match) => {
            match = match.split(' ');
            for (let i = 0; i < num[match[0]]; i++) {
              let attack = allItems.find(
                (e) => e.name.toLowerCase() === match.slice(1).join(' ')
              );
              this.abilities.push(attack);
            }
          });
          this.abilities.push(null);
        }
      });
      // console.log(multiattack.system.description.value)
      // console.log(this.abilities.map(e => e ? e.name : 'null'));
    }

    switch (this.category) {
      case 'common':
        this.abilities = [
          ...this.abilities,
          ...allItems.filter(
            (e) =>
              (!this.abilities.some((a) => a?.name === e.name) &&
                e.system?.activities?.some(
                  (activity) => activity?.activation?.type === 'action'
                )) ||
              e.system?.activities?.some(
                (activity) => activity?.activation?.type === 'bonus'
              )
          ),
        ];

        this.id = 'common';
        break;
      case 'classFeatures':
        this.abilities = allItems.filter((e) => e.type === 'feat');
        this.id = 'classFeatures';
        break;
      case 'items':
        this.abilities = allItems.filter((e) => e.type === 'consumable');
        this.id = 'items';
        break;
      case 'custom':
        this.id = 'custom';
        break;
    }
    this.abilities = AbilityTray.padArray(this.abilities, 20);

    return;
  }

  static generateCustomTrays(actor) {
    let commonTray = new CustomTray({
      category: 'common',
      id: 'common',
      actorUuid: actor.uuid,
    });
    let classTray = new CustomTray({
      category: 'classFeatures',
      id: 'classFeatures',
      actorUuid: actor.uuid,
    });
    let consumablesTray = new CustomTray({
      category: 'items',
      id: 'items',
      actorUuid: actor.uuid,
    });
    let passiveTray = new CustomTray({
      category: 'passive',
      id: 'passive',
      actorUuid: actor.uuid,
    });

    let reactionTray = new CustomTray({
      category: 'reaction',
      id: 'reaction',
      actorUuid: actor.uuid,
    });

    let customTray = new CustomTray({
      category: 'custom',
      id: 'custom',
      actorUuid: actor.uuid,
    });
    let trays = [
      commonTray,
      classTray,
      consumablesTray,
      reactionTray,
      passiveTray,
      customTray,
    ];
    trays = trays.filter(
      (e) => e.abilities.some((e) => e != null) || e.cataegory === 'custom'
    );

    return trays;
  }

  static _onCreateItem(item) {
    console.log(item);

    console.log(this);
    if (item.parent.type != 'character') {
      return;
    }
    if (item.parent == this.actor) {
      let tray;
      switch (true) {
        case item.system.activities.length == 0:
           tray = this.customTrays.find((e) => e.id == 'passive');
          if (tray) {
            CustomTray.addToTray(item, tray);
          } else {
            let passiveTray = new CustomTray({
              category: 'passive',
              id: 'passive',
              actorUuid: this.actor.uuid,
            });
            this.customTrays.push(passiveTray);
          }
          break;

        case item.system?.activities.some((e) => e?.activation?.type == 'reaction'):
          tray = this.customTrays.find((e) => e.id == 'reaction');
          if (tray) {
            CustomTray.addToTray(item, tray);
          } else {
            let reactionTray = new CustomTray({
              category: 'reaction',
              id: 'reaction',
              actorUuid: this.actor.uuid,
            });
            this.customTrays.push(reactionTray);
          }
          break;

        case item.type == 'consumable':
          tray = this.customTrays.find((e) => e.id == 'items');
          if (tray) {
            CustomTray.addToTray(item, tray);
          } else {
            let consumableTray = new CustomTray({
              category: 'items',
              id: 'items',
              actorUuid: this.actor.uuid,
            });
            this.customTrays.push(consumableTray);
          }
          break;

        case item.type == 'feat':
          tray = this.customTrays.find((e) => e.id == 'classFeatures');
          if (tray) {
            CustomTray.addToTray(item, tray);
          } else {
            let classFeatureTray = new CustomTray({
              category: 'classFeatures',
              id: 'classFeatures',
              actorUuid: this.actor.uuid,
            });
            this.customTrays.push(classFeatureTray);
          }

          break;

        default:
           tray = this.customTrays.find((e) => e.id == 'common');
          if (tray) {
            CustomTray.addToTray(item, tray);
          } else {
            let commonTray = new CustomTray({
              category: 'common',
              id: 'common',
              actorUuid: actor.uuid,
            });
            this.customTrays.push(commonTray);
          }
          break;
        }
        
        this.render(['centerTray']);
      return;
      //ADD TO CUSTOM TRAY
    }
    //flag for addition to custom tray

    debugger;
  }
  static addToTray(item, tray) {
    tray.abilities[tray.abilities.findIndex(e => e == null)] = item;
    tray.setSavedData();
    
    // this.abilities = AbilityTray.padArray(this.abilities, 20);
  }
  checkSavedData() {
    let actor = fromUuidSync(this.actorUuid);
    if (actor != null) {
      return actor.getFlag('auto-action-tray', 'data.' + this.id) != null;
    }
  }

  getSavedData() {
    let actor = fromUuidSync(this.actorUuid);

    let data = actor.getFlag('auto-action-tray', 'data');
    if (data) {
      if (data[this.id]?.abilities != null) {
        this.abilities = JSON.parse(data[this.id].abilities).map((e) =>
          e ? actor.items.get(e) : null
        );
        this.savedData = true;
      }
    }
  }

  setSavedData() {
    let actor = fromUuidSync(this.actorUuid);
    if (actor != null) {
      let temparr = this.abilities.map((e) => (e ? e.id : null));
      actor.setFlag('auto-action-tray', 'data', {
        [this.id]: { abilities: JSON.stringify(temparr) },
      });
    }
    this.savedData = true;
  }

  setAbility(index, ability) {
    this.abilities[index] = ability;
    this.setSavedData();
  }

  getAbilities() {
    return this.abilities;
  }
}
// fromUuid(this.actorUuid).then((actor) => {
//     tmpActor = actor
