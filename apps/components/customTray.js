import { AbilityTray } from './abilityTray.js';
import { CustomNpcTray } from './customNpcTray.js';

export class CustomTray extends AbilityTray {
  constructor(options = {}) {
    super(options);
    this.savedData = false;
    this.category = options.category;
    this.id = options.id;
    this.type = 'custom';
    this.xPos = 0;

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
            (e) => e.system?.activities?.size < 1 && e.type !== 'equipment'
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



  static generateCustomTrays(actor) {
    if (actor.type === 'npc') { 
      return CustomNpcTray.generateCustomTrays(actor);
    }
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


}
// fromUuid(this.actorUuid).then((actor) => {
//     tmpActor = actor
