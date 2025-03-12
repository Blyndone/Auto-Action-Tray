import { AbilityTray } from './abilityTray.js';

export class StaticTray extends AbilityTray {
  constructor(options = {}) {
    super(options);
    this.category = options.category;
    this.classResource = options.classResource;
    this.spellLevel = options.spellLevel;
    this.customStaticTrays = [options.customStaticTrays] ;
    this.totalSlots = options.totalSlots;
    this.availableSlots = options.availableSlots;
    this.keyItemUuid = options.keyItemUuid;
    this.type = 'static';
    this.active = false;
    this.generateTray();
  }

  generateTray() {
    let actor = fromUuidSync(this.actorUuid);

    let allItems = actor.items.filter((e) => e.system?.activities?.size);
    switch (this.category) {
      case 'action':
        this.abilities = allItems.filter(
          (e) =>
            e.system?.activities?.some(
              (activity) => activity?.activation?.type === 'action'
            ) && e.type != 'spell'
        );
        this.id = 'action';
        break;

      case 'bonus':
        this.abilities = allItems.filter(
          (e) =>
            e.system?.activities?.some(
              (activity) => activity?.activation?.type === 'bonus'
            ) && e.type != 'spell'
        );
        this.id = 'bonus';
        break;

      case 'customStaticTray':
        if (this.keyItemUuid) {
          this.abilities = allItems.filter((e) =>
            e.system.activities?.some((activity) =>
              activity.consumption?.targets?.some(
                (target) => target.target === this.keyItemUuid
              )
            )
          );
       
          this.id = 'customStaticTray'+ '-' + this.keyItemUuid;
        }
      
        break;

      case 'spell':
        if (this.spellLevel == 0) {
          this.abilities = allItems.filter(
            (e) =>
              e.system.level == this.spellLevel &&
              e.system.preparation?.prepared == true
          );
          this.id = 'spell-' + this.spellLevel;
          break;
        }

        this.abilities = allItems
          .filter(
            (e) =>
              e.system.level <= this.spellLevel &&
              e.system.preparation?.prepared == true &&
              e.system.level != 0
          )
          .sort((a, b) => b.system.level - a.system.level);

        this.id = 'spell-' + this.spellLevel;
        break;

      case 'pact':
        this.abilities = allItems
          .filter((e) => e.system.preparation?.mode == 'pact')
          .sort((a, b) => b.system.level - a.system.level);

        this.id = 'pact';
        break;

      case 'ritual':
        this.abilities = allItems.filter(
          (e) => e.type === 'spell' && e.system.properties.has('ritual')
        );
        this.id = 'ritual';
        break;
    }
  }

  static generateStaticTrays(actor) {
    let actionTray = new StaticTray({
      category: 'action',
      actorUuid: actor.uuid,
    });
    let bonusTray = new StaticTray({
      category: 'bonus',
      actorUuid: actor.uuid,
    });

    let customStaticTraysUUID = this.getCustomStaticTrays(actor);
    let customStaticTrays = [];
    if (customStaticTraysUUID) {
      customStaticTraysUUID.forEach((e) => {
        customStaticTrays.push(
          new StaticTray({
            category: 'customStaticTray',
            actorUuid: actor.uuid,
            keyItemUuid: e,
          })
        );
      });
    } else {
      customStaticTrays = [];
    }

    // let classTray = new StaticTray({
    //   category: 'classFeatures',
    //   actorUuid: actor.uuid,
    // });

    let spellTray = [];

    let slots = actor.system.spells;

    let levels = Object.keys(slots)
      .filter((key) => slots[key].value > 0)
      .map((key) => slots[key].level);

    let allItems = actor.items.filter((e) => e.system?.activities?.size);
    let spells = allItems.filter(
      (e) => e.type === 'spell' && e.system.preparation.prepared == true
    );

    if (spells.length > 0) {
      levels = [
        ...new Set([...levels, ...spells.map((x) => x.system.level)]),
      ].sort((a, b) => a - b);
    }

    levels.forEach((level) => {
      spellTray.push(
        new StaticTray({
          category: 'spell',
          actorUuid: actor.uuid,
          spellLevel: level,
          totalSlots: actor.system?.spells['spell' + level]?.max,
          availableSlots: actor.system?.spells['spell' + level]?.value,
        })
      );
    });

    let pactTray = new StaticTray({
      category: 'pact',
      actorUuid: actor.uuid,
      spellLevel: actor.system.spells.pact.level,
      totalSlots: actor.system.spells.pact.max,
      availableSlots: actor.system.spells.pact.value,
    });

    let ritualTray = new StaticTray({
      category: 'ritual',
      actorUuid: actor.uuid,
      spellLevel: actor.system.spells.pact.level,
    });

    this.staticTrays = [
      actionTray,
      bonusTray,
      ...customStaticTrays,
      ...spellTray,
      pactTray,
      ritualTray,
    ];

    this.staticTrays = this.staticTrays.filter(
      (e) => e.abilities && e.abilities.length > 0
    );
    this.staticTrays.forEach((e) => {
      e.abilities = AbilityTray.padArray(e.abilities, 20);
    });

    return this.staticTrays;
  }

  static setCustomStaticTray(itemUuid, actor) {
    if (actor != null) {
      let data = actor.getFlag('auto-action-tray', 'data');
    if (data) {
      if (data.customStaticTrays != null) {
        data = JSON.parse(data.customStaticTrays.trays);
      } else { 
        data=[]
      }
    }
     
      let temparr = [...new Set([...data, itemUuid])];
      actor.setFlag('auto-action-tray', 'data', {
        customStaticTrays: { trays: JSON.stringify(temparr) },
      });
    }
    this.savedData = true;
  }


  static getCustomStaticTrays(actor) {
    let data = actor.getFlag('auto-action-tray', 'data');
    
  
    if(data != undefined && data.customStaticTrays != undefined) {
      this.customStaticTrays = JSON.parse(data.customStaticTrays.trays);
      this.savedData = true;
      return this.customStaticTrays;
    } else { 
      return [];
    }
    
  }

  getAbilities() {
    return this.abilities;
  }
}
