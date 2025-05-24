import { AbilityTray } from "./abilityTray.js";
import { ActivityTray } from "./activityTray.js";

export class SpellLevelTray extends ActivityTray {
  constructor(options = {}) {
    super(options);
    this.id = "spellLevel";
    this.abilities = [];
    this.actorUuid = options.actorUuid || null;
    this.setInactive();
    this.type = "spellLevel";
    this.generateTray();
    this.selectedActivity = null;
    this.rejectActivity = null;
    this.useSlot = true;
    this.label = "";
  }

  generateTray() {}

  static generateActivityTray(actor, options = {}) {
    return new SpellLevelTray({
      category: "spellLevel",
      id: "spellLevel",
      actorUuid: actor.uuid,
      application: options.application
    });
  }

  static checkSpellConfigurable(item) {
    if (item.type != "spell") {
      return true;
    } else {
      return item.isScaledSpell;
    }
  }

  setActivities(item, actor) {
    this.abilities = [];
    if (item.spellLevel > 0 && ActivityTray.checkSpellConfigurable(item)) {
      Object.keys(actor.system.spells).forEach(spell => {
        if (
          item.spellLevel <= actor.system.spells[spell].level &&
          actor.system.spells[spell].max > 0
        ) {
          let spellData = { actorSpellData: actor.system.spells[spell] };
          let tempitem = { ...item };
          tempitem.itemId = item.id;
          tempitem.tooltip = tempitem.defaultActivity.tooltips.find(
            e => e.spellLevel == spellData.actorSpellData.level
          );
          foundry.utils.mergeObject(tempitem, spellData);
          this.abilities.push(tempitem);
        }
      });
    }
  }

  static useActivity(event, target) {
    //This can be an Activity or a Spell Level Selection
    let selectedSpellLevel = target.dataset.selectedspelllevel;
    let useSlot = this.useSlot;
    if (
      useSlot &&
      !ActivityTray.checkSlotAvailable.bind(this)(selectedSpellLevel)
    ) {
      return;
    }
    let options = {};

    let itemId;
    if (target.dataset.type == "spell") {
      itemId = this.actor.items.get(target.dataset.itemId).system.activities
        .contents[0].id;
    } else {
      itemId = target.dataset.itemId;
    }

    if (useSlot) {
      options = { slot: useSlot, selectedSpellLevel: selectedSpellLevel };
    }

    if (this.spellLevelTray.selectedActivity) {
      this.spellLevelTray.selectedActivity({
        itemId: itemId,
        selectedSpellLevel: selectedSpellLevel,
        useSlot: useSlot
      });
      this.spellLevelTray.selectedActivity = null;
      this.spellLevelTray.useSlot = true;
    }
  }

  static cancelSelection(event, target) {
    if (this.currentTray.id == "spellLevel") {
      this.spellLevelTray.rejectActivity(
        new Error("User canceled activity selection")
      );
    }
    this.rejectActivity = null;
  }
}
