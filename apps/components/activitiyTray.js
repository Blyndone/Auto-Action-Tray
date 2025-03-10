import { AbilityTray } from "./abilityTray.js";

export class ActivityTray extends AbilityTray {
  constructor(options = {}) {
    super(options);
    this.id = "activity";
    this.abilities = game.actors
      .getName("Zeran")
      .items.getName("Longsword").system.activities;
    this.actorUuid = options.actorUuid || null;
    this.active = false;
    this.type = "activity";
    this.generateTray();
    this.selectedActivity = null;
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
    if (item.type == "spell" && item.system.activities.size == 1) {
      Object.keys(actor.system.spells).forEach(spell => {
        if (item.system.level <= actor.system.spells[spell].level) {
          let spellData = { actorSpellData: actor.system.spells[spell] };
          this.abilities.push({ ...item, _id: item._id, ...spellData });
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
    // let activities = item.system.activities;
    // this.activities = activities.map(e => e);
    hotbar.currentTray.active = false;
    this.active = true;
    hotbar.trayInformation = "Select an activity";
    hotbar.render(true);

    let act = await new Promise(resolve => (this.selectedActivity = resolve));

    console.log("activity selected");
    console.log(act);
    hotbar.trayInformation = "";
    this.active = false;
    hotbar.refresh();
    return act;
  }

  static useActivity(event, target) {
    let sepectedSpellLevel = target.dataset.selectedspelllevel;

    let itemId;
    if (target.dataset.type == "spell") {
      itemId = this.actor.items.get(target.dataset.itemId).system.activities
        .contents[0].id;
    } else {
      itemId = target.dataset.itemId;
    }

    if (this.activityTray.selectedActivity) {
      this.activityTray.selectedActivity({
        itemId: itemId,
        selectedSpellLevel: sepectedSpellLevel
      });
      this.activityTray.selectedActivity = null;
    }
  }
}
