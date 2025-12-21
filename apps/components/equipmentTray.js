import { CustomTray } from './customTray.js'

export class EquipmentTray extends CustomTray {
  constructor(options = {}) {
    super(options)
    this.meleeWeapon
    this.rangedWeapon
    this.category = options.category
    this.id = 'equipment'
    this.type = 'custom'
    this.activeSlot = 1
    this.application = options.application
    if (!this.savedData && !this.checkSavedData(this.id)) {
      this.generateTray(cachedAbilities)
    } else {
      this.getSavedData(options.cachedAbilities)
    }

    if (!this.application.quickActionHelperEnabled) {
      this.activeSlot = null
    } 
  }

  generateTray(cachedAbilities) {
    let tmpActor
    let actor = fromUuidSync(this.actorUuid)
    tmpActor = actor
    let allItems = cachedAbilities || this.application.getActorAbilities(this.actorUuid)
    allItems.sort((a, b) => (a?.item?.sort ?? -Infinity) - (b?.item?.sort ?? -Infinity))
    let meleeWeapons
    meleeWeapons = allItems.filter(
      (e) =>
        ((e.item.system.type?.value === 'simpleM' || e.item.system.type?.value === 'martialM') &&
          e.item.system.equipped) ||
        e.item.system.type?.value === 'natural',
    )
    this.meleeWeapon = meleeWeapons[0]
    this.rangedWeapon = allItems.filter(
      (e) =>
        ((e.item.system.type?.value === 'simpleR' || e.item.system.type?.value === 'martialR') &&
          e.item.system.equipped) ||
        (e.item.system.type?.value === 'natural' && e.item.system.range?.long),
    )[0]
    if (!this.rangedWeapon) {
      this.rangedWeapon = meleeWeapons[1] ? meleeWeapons[1] : null
    }

    this.meleeWeapon = this.meleeWeapon ? this.meleeWeapon : null
    this.rangedWeapon = this.rangedWeapon ? this.rangedWeapon : null
    this.setSavedData()
  }

  static generateCustomTrays(actor, options = {}) {
    return new EquipmentTray({
      category: 'equipment',
      id: 'equipment',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: options.cachedAbilities,
    })
  }

  getSavedData(cachedAbilities) {
    let actor = fromUuidSync(this.actorUuid)
    let allItems = cachedAbilities || this.application.getActorAbilities(this.actorUuid)
    let data = actor.getFlag('auto-action-tray', 'data')
    if (data) {
      if (data[this.id] != null) {
        this.meleeWeapon = allItems.find((e) => e.id == JSON.parse(data[this.id].meleeWeapon))
        this.rangedWeapon = allItems.find((e) => e.id == JSON.parse(data[this.id].rangedWeapon))
        if (data[this.id]?.activeSlot) { 
 this.activeSlot = JSON.parse(data[this.id].activeSlot)
        }

        this.savedData = true
      }
    }
  }

  setSavedData() {
    let actor = fromUuidSync(this.actorUuid)
    if (actor != null) {
      actor.setFlag('auto-action-tray', 'data', {
        [this.id]: {
          meleeWeapon: JSON.stringify(this.meleeWeapon?.id ? this.meleeWeapon.id : null),
          rangedWeapon: JSON.stringify(this.rangedWeapon?.id ? this.rangedWeapon.id : null),
          activeSlot: JSON.stringify(this.activeSlot),
        },
      })
      this.savedData = true
    }
  }

  getMeleeWeapon() {
    return this.meleeWeapon
  }
  getRangedWeapon() {
    return this.rangedWeapon
  }
  getActiveSlot() {
    return this.activeSlot
  }

  setMeleeWeapon(weapon) {
    this.meleeWeapon = weapon
    this.setSavedData()
  }
  setRangedWeapon(weapon) {
    this.rangedWeapon = weapon
    this.setSavedData()
  }
  setActiveSlot(slot) {
    this.activeSlot = slot
    this.setSavedData()
  }
}
