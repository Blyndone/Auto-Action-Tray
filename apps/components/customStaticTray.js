import { AbilityTray } from './abilityTray.js';

export class CustomStaticTray extends AbilityTray {

static overrides = {
      barbarian: ['rage'],
      bard: ['bardic inspiration'],
      cleric: ['channel divinity'],
      druid: ['wild shape', 'wildshape'],
      fighter: ['superiority die', 'superiority dice', 'arcane shot'],
      monk: ['ki', 'ki points'],
      paladin: ['channel divinity'],
      sorcerer: ['sorcery points'],
    };

  constructor(options = {}) {
    super(options);
    this.id = null;
    this.keyItem;
    this.keyItemUuid = options.keyItemUuid;
    this.keyItemUses;
    this.keyItemUsesMax;
    this.type = 'static';
    this.category = 'customStaticTray';
    this.setInactive();
    this.actorUuid = options.actorUuid || null;
 
    this.generateTray();
  }

  generateTray() {
    let actor = fromUuidSync(this.actorUuid);
    let allItems = actor.items.filter((e) => e.system?.activities?.size);

    this.keyItem = actor.items.find((e) => e.id == this.keyItemUuid);
    this.abilities.push(this.keyItem);
    this.keyItemUses = this.keyItem.system?.uses?.value;
    this.keyItemUsesMax = this.keyItem.system?.uses?.max;
    this.abilities.push(
      ...allItems.filter((e) =>
        e.system.activities?.some((activity) =>
          activity.consumption?.targets?.some(
            (target) => target.target === this.keyItemUuid
          )
        )
      )
    );

    this.id = 'customStaticTray' + '-' + this.keyItemUuid;

    this.icon = this.getIcon(this.keyItem, actor);
  }

  static setCustomStaticTray(itemUuid, actor) {
    if (actor != null) {
      let data = actor.getFlag('auto-action-tray', 'data');
      if (data) {
        if (data.customStaticTrays != null) {
          data = JSON.parse(data.customStaticTrays.trays);
        } else {
          data = [];
        }
      }

      let temparr = [...new Set([...data, itemUuid])];
      actor.setFlag('auto-action-tray', 'data', {
        customStaticTrays: { trays: JSON.stringify(temparr) },
      });
    }

  }

  static getCustomStaticTrays(actor) {
    let data = actor.getFlag('auto-action-tray', 'data')?.customStaticTrays?.trays || [];
    if (data.length > 0) {
      data = JSON.parse(data);
    }
      let config = actor.getFlag('auto-action-tray', 'config')?.customStaticTrays || [];
      return [...data, ...config];
      
    
    
  }

  getIcon(keyItem, actor) {
    let classIcons = {
      artificer: '<i class="fa-solid fa-gear icon-custom"></i>',
      barbarian: '<i class="fa-solid fa-axe-battle icon-custom"></i>',
      bard: '<i class="fa-solid fa-music icon-custom"></i>',
      cleric: '<i class="fa-solid fa-sun icon-custom"></i>',
      druid: '<i class="fa-solid fa-leaf icon-custom"></i>',
      fighter: '<i class="fa-solid fa-swords icon-custom"></i>',
      monk: '<i class="fa-solid fa-hand-fist icon-custom"></i>',
      paladin: '<i class="fa-solid fa-shield-quartered icon-custom"></i>',
      ranger: '<i class="fa-solid fa-bow-arrow icon-custom"></i>',
      rogue: '<i class="fa-solid fa-dagger icon-custom"></i>',
      sorcerer: '<i class="fa-solid fa-hand-sparkles icon-custom"></i>',
      warlock: '<i class="fa-solid fa-eye-evil icon-custom"></i>',
      wizard: '<i class="fa-solid fa-wand-magic-sparkles icon-custom"></i>',
    };

    let ret = Object.keys(CustomStaticTray.overrides).find((key) =>
      CustomStaticTray.overrides[key].includes(keyItem.name.toLocaleLowerCase())
    );
    if (ret != undefined) {
      return classIcons[ret];
    }

    let requirements = keyItem.system?.requirements;
    let parse = Object.keys(classIcons).filter((e) =>
      keyItem?.requirements?.toLocaleLowerCase().includes(e)
    )[0];
    let actorClasses = actor._classes;
    let classarr = Object.keys(actor._classes);
    classarr = classarr.sort(
      (a, b) => actorClasses[b].system.levels - actorClasses[a].system.levels
    );
    let primaryclass = classarr[0];
    return classIcons[primaryclass];

    return '<i class="fa-solid fa-flask"></i>';
  }

  static checkOverride(keyItem) {
    if (!keyItem?.name) {
      keyItem = fromUuidSync(keyItem);
    }

    let ret = Object.keys(CustomStaticTray.overrides).find((key) =>
      CustomStaticTray.overrides[key].includes(keyItem.name.toLocaleLowerCase())
    );
    if (ret != undefined) {
      return true;
    }
    return false;
  }
}
