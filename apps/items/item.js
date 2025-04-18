import { ItemConfig } from "../helpers/itemConfig.js";
import { Activity } from "./activities.js";

export class Item {
  constructor(item) {
    this.item = item;
    this.actor = this.item.actor;
    this.itemConfig = ItemConfig.getItemConfig(item);
    this.isActive = item.isActive;

    this.desc = getDescription();
    this.name = this.item.name;
    this.type = this.item.type;
    this.isNonScaledSpell = false;
    this.fastForward;
    this.useTargetHelper;
    this.targetCount;
    this.concentration = item.requiresConcentration;
    this.damageLabel;
    this.damageDiceLabel;
    this.defaultActivity = new Activity(item.system?.activities?.contents?.[0]);
    setItemValues();
  }
}
