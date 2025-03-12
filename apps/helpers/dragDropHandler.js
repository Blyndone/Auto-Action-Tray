import { StaticTray } from "../components/staticTray.js";
export class DragDropHandler {
  static _onDragStart(event, hotbar) {
    game.tooltip.deactivate();
    const li = event.currentTarget;

    if (event.target.classList.contains("content-link")) return;

    if (li.dataset.itemId === undefined) return;
    const effect = hotbar.actor.items.get(li.dataset.itemId);
    let data = effect.toDragData();
    data.section = li.dataset.section;
    data.index = li.dataset.index;
    data.src = "AAT";
    if (effect) event.dataTransfer.setData("text/plain", JSON.stringify(data));

    return;
  }

  static _onDragOver(event, hotbar) {}

  //   async _onDropCanvas(event, hotbar) {

  //   }

  static async _onDrop(event, hotbar) {
    // Try to extract the data
    if (hotbar.currentTray instanceof StaticTray) {
      return;
    }
    const dragData =
      event.dataTransfer.getData("application/json") ||
      event.dataTransfer.getData("text/plain");
    if (!dragData) return;
    //super._onDrop(event);
    let data;
    try {
      data = JSON.parse(dragData);
    } catch (e) {
      console.error(e);
      return;
    }

    let target =
      hotbar.actor.items.get(event.target.dataset.itemId) ||
      hotbar.actor.items.get(event.target.parentElement.dataset.itemId);

    let index = event.target.dataset.index;

    if (event.target.parentElement.dataset.index === "meleeWeapon") {
      hotbar.equipmentTray.setMeleeWeapon(fromUuidSync(data.uuid));
      hotbar.render({ parts: ["equipmentMiscTray"] });
      return;
    } else if (event.target.parentElement.dataset.index === "rangedWeapon") {
      hotbar.equipmentTray.setRangedWeapon(fromUuidSync(data.uuid));
      hotbar.render({ parts: ["equipmentMiscTray"] });
      return;
    }

    if (!index) return;
    if (index == "meleeWeapon") {
      let item = fromUuidSync(data.uuid);
      hotbar.equipmentTray.setMeleeWeapon(item);
      hotbar.render({ parts: ["equipmentMiscTray"] });
      return;
    }
    if (index == "rangedWeapon") {
      let item = fromUuidSync(data.uuid);
      hotbar.equipmentTray.setRangedWeapon(item);
      hotbar.render({ parts: ["equipmentMiscTray"] });
      return;
    }
    if (index == "abilitySelection") {
      let itemUuid = fromUuidSync(data.uuid).id;
      StaticTray.setCustomStaticTray(itemUuid, hotbar.actor);
      hotbar.staticTrays = StaticTray.generateStaticTrays(hotbar.actor);
      hotbar.render({ parts: ["centerTray"] });
      return;
    }

    if (index == data.index) return;

    // Handle different data types
    switch (data.type) {
      case "Item":
        let item = fromUuidSync(data.uuid);
        hotbar.currentTray.setAbility(index, item);
        hotbar.currentTray.setAbility(data.index, null);
        hotbar.render({ parts: ["centerTray"] });
        break;

      default:
        return;
    }
  }
  static _onDropCanvas(data, hotbar) {
    if (data.src != "AAT") return;
    if (data.index == "meleeWeapon") {
      hotbar.equipmentTray.setMeleeWeapon(null);
      hotbar.render({ parts: ["equipmentMiscTray"] });
      return;
    }
    if (data.index == "rangedWeapon") {
      hotbar.equipmentTray.setRangedWeapon(null);
      hotbar.render({ parts: ["equipmentMiscTray"] });
      return;
    }
    hotbar.currentTray.setAbility(data.index, null);
    hotbar.render({ parts: ["centerTray"] });
  }
}
