import { AbilityTray } from "./abilityTray.js";
import { AnimationHandler } from "./../helpers/animationHandler.js";
export class ActivityTray extends AbilityTray {
  constructor(options = {}) {
    super(options);
    this.id = "activity";
    this.abilities = [];
    this.actorUuid = options.actorUuid || null;
    this.active = false;
    this.type = "activity";
    this.generateTray();
    this.selectedActivity = null;
    this.rejectActivity = null;
    this.useSlot = true;
  }

  generateTray() {}

  static generateActivityTray(actor) {
    return new ActivityTray({
      category: "activity",
      id: "activity",
      actorUuid: actor.uuid
    });
  }

  async setActivities(item, actor) {
    this.abilities = [];
    if (
      item.type == "spell" &&
      item.system.activities.size == 1 &&
      item.system.level > 0
    ) {
      Object.keys(actor.system.spells).forEach(spell => {
        if (
          item.system.level <= actor.system.spells[spell].level &&
          actor.system.spells[spell].max > 0
        ) {
          let spellData = { actorSpellData: actor.system.spells[spell] };
          let tempitem = item.clone();
          tempitem.itemId = item.id;
          mergeObject(tempitem, spellData);

          this.abilities.push(tempitem);
        }
      });
    } else {
      this.abilities = item.system.activities.map(e => e);
    }
  }

  async getActivities(item, actor) {
    this.setActivities(item, actor);
    return this.abilities;
  }

  static checkActivity(item) {
    return item.system.activities.size > 1;
  }

  async selectAbility(item, actor, hotbar) {
    if (item.type == "spell") {
      hotbar.trayInformation = `${item.name}`;
    } else {
      hotbar.trayInformation = `${item.name}`;
    }
    hotbar.selectingActivity = true;
    AnimationHandler.animateTrays("activity", hotbar.currentTray.id, hotbar);

    let act;
    try {
      act = await new Promise((resolve, reject) => {
        this.selectedActivity = resolve;
        this.rejectActivity = reject;
      });
    } catch (error) {
      console.log("AAT - Activity selection canceled");
      act = null;
    }
    hotbar.selectingActivity = false;
    hotbar.trayInformation = "";
    AnimationHandler.animateTrays(hotbar.targetTray.id, "activity", hotbar);

    return act;
  }

  static useActivity(event, target) {
    let options = {};
    let selectedSpellLevel = target.dataset.selectedspelllevel;

    let itemId;
    if (target.dataset.type == "spell") {
      itemId = this.actor.items.get(target.dataset.itemId).system.activities
        .contents[0].id;
    } else {
      itemId = target.dataset.itemId;
    }

    if (this.activityTray.useSlot) {
      options = {
        slot: this.activityTray.slot,
        selectedSpellLevel: selectedSpellLevel
      };
    }

    if (this.activityTray.selectedActivity) {
      this.activityTray.selectedActivity({
        itemId: itemId,
        selectedSpellLevel: selectedSpellLevel,
        useSlot: this.activityTray.useSlot
      });
      this.activityTray.selectedActivity = null;
      this.activityTray.useSlot = true;
    }
  }

  static useSlot(event) {
    this.activityTray.useSlot = event.target.checked;
  }
  static cancelSelection(event, target) {
    this.activityTray.rejectActivity(
      new Error("User canceled activity selection")
    );
    this.activityTray.rejectActivity = null;
  }
}
