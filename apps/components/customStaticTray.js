import { AbilityTray } from './abilityTray.js';

export class CustomStaticTray extends AbilityTray {
  constructor(options = {}) {
    super(options);
    this.id = null;
    this.keyItem;
    this.keyItemUuid = options.keyItemUuid;
      this.keyItemUses;
      this.keyItemUsesMax
    this.type = 'static';
    this.category = 'customStaticTray';
    this.active = false;

    this.actorUuid = options.actorUuid || null;

    this.generateTray();
  }

  generateTray() {
    let actor = fromUuidSync(this.actorUuid);
    let allItems = actor.items.filter((e) => e.system?.activities?.size);

    if (this.keyItemUuid) {
        this.keyItem = actor.items.find(e=> e.id==this.keyItemUuid)
        this.keyItemUses = this.keyItem.system?.uses?.value;
        this.keyItemUsesMax = this.keyItem.system?.uses?.max;
      this.abilities = allItems.filter((e) =>
        e.system.activities?.some((activity) =>
          activity.consumption?.targets?.some(
            (target) => target.target === this.keyItemUuid
          )
        )
      );

      this.id = 'customStaticTray' + '-' + this.keyItemUuid;
    }
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
    this.savedData = true;
  }

  static getCustomStaticTrays(actor) {
    let data = actor.getFlag('auto-action-tray', 'data');

    if (data != undefined && data.customStaticTrays != undefined) {
      let customStaticTrays = JSON.parse(data.customStaticTrays.trays);
      this.savedData = true;
      return customStaticTrays;
    } else {
      return [];
    }
  }
}
