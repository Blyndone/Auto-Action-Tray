import { AbilityTray } from './abilityTray.js';

export class StaticTray extends AbilityTray {
  constructor(options = {}) {
    super(options);
    this.category = options.category;
    this.classResource = options.classResource;
    this.spellLevel = options.spellLevel;
    this.itemUsesUUID = options.itemUsesUUID || null;
    this.totalSlots = options.totalSlots;
    this.availableSlots = options.availableSlots;
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

      case 'classFeatures':
        if (this.itemUsesUUID) {
          this.abilities = allItems.filter((e) =>
            e.system.activities?.some((activity) =>
              activity.consumption?.targets?.some(
                (target) => target.target === itemUsesUUID
              )
            )
          );
        }
        this.id = 'classFeatures';
        break;

      case 'spell':
        if (this.spellLevel == 0) {
          this.abilities = allItems
            .filter(
              (e) =>
                e.system.level == this.spellLevel &&
                e.system.preparation?.prepared == true 
      
          )
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
    let classTray = new StaticTray({
      category: 'classFeatures',
      actorUuid: actor.uuid,
    });
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

    let ritualTray = new StaticTray({
      category: 'ritual',
      actorUuid: actor.uuid,
    });

    this.staticTrays = [
      actionTray,
      bonusTray,
      classTray,
      ...spellTray,
      ritualTray,
    ];

    this.staticTrays = this.staticTrays.filter((e) => ((e.abilities)  && e.abilities.length > 0))
    this.staticTrays.forEach((e) => {e.abilities = AbilityTray.padArray(e.abilities, 20)})

    return this.staticTrays;
  }

  getAbilities() {
    return this.abilities;
  }
}
