import { TargetHelper } from './targetHelper.js'
export class QuickActionHelper {
  constructor(options) {
    this.app = options.app
    this.targetHelper = options.targetHelper
    this.combatHandler = options.combatHandler
    this.equipmentTray = null
    this.active = true
    this.activeSlot = null
    this.activeItem = null
    this.activeActivity = null
    this.activeSpellLevel = null
    this.actor = null
  }
  //Move Token
  //await game.actors.getName("Balon").getActiveTokens()[0].document.update({x: 2500, y: 0})

  setData(actor) {
    this.clearData()
    this.actor = actor
    //temp active slot
    this.activeSlot = 1
    switch (this.activeSlot) {
      case 0:
        return
      case 1:
        this.activeItem = this.equipmentTray.getMeleeWeapon()
        this.activeActivity = this.activeItem?.defaultActivity
        this.activeSpellLevel = this.activeItem?.spellLevel || null
        break
      case 2:
        this.activeItem = this.equipmentTray.getRangedWeapon()
        this.activeActivity = this.activeItem?.defaultActivity
        this.activeSpellLevel = this.activeItem?.spellLevel || null
        break
      default:
        this.activeItem = null
    }
  }

  clearData() {
    this.actor = null
    this.activeSlot = null
    this.activeItem = null
    this.activeActivity = null
    this.activeSpellLevel = null
  }

  startQuickAction() {
    this.targetHelper
      .requestTargets(
        this.activeItem,
        this.activeActivity,
        this.actor,
        1,
        true,
        this.activeSpellLevel,
        false
      )
      .then((targets) => {
        // Handle the selected targets
        console.log('Selected targets:', targets)
      })
  }

  cancelQuickAction() {
    TargetHelper.cancelSelection.bind(this.app)(null, null, false)
  }

  setEquipmentTray(tray) {
    this.equipmentTray = tray
  }
}
