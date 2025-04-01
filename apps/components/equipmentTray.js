import { CustomTray } from './customTray.js'

export class EquipmentTray extends CustomTray {
  constructor(options = {}) {
    super(options)

    this.meleeWeapon
    this.rangedWeapon

    this.category = options.category
    this.id = 'equipment'
    this.type = 'custom'

    if (!this.savedData && !this.checkSavedData(this.id)) {
      this.generateTray()
    } else {
      this.getSavedData()
    }
  }

  generateTray() {
    // Common, Class, Consumables
    let tmpActor
    let actor = fromUuidSync(this.actorUuid)
    tmpActor = actor
    let allItems = tmpActor.items.filter((e) => e.system?.activities?.size)
    let meleeWeapons
    meleeWeapons = allItems.filter(
      (e) =>
        (e.system.type?.value === 'simpleM' ||
          e.system.type?.value === 'martialM' ||
          (e.system.type?.value === 'natural' && !e.system.range?.long)) &&
        e.system.equipped,
    )
    this.meleeWeapon = meleeWeapons[0]
    this.rangedWeapon = allItems.filter(
      (e) =>
        (e.system.type?.value === 'simpleR' ||
          e.system.type?.value === 'martialR' ||
          (e.system.type?.value === 'natural' && e.system.range?.long)) &&
        e.system.equipped,
    )[0]
    if (!this.rangedWeapon) { 
      this.rangedWeapon = (meleeWeapons[1]) ? meleeWeapons[1] : null
    }

    this.meleeWeapon = this.meleeWeapon ? this.meleeWeapon : null
    this.rangedWeapon = this.rangedWeapon ? this.rangedWeapon : null
    this.setSavedData()
  }

  static generateCustomTrays(actor) {
    return new EquipmentTray({
      category: 'equipment',
      id: 'equipment',
      actorUuid: actor.uuid,
    })
  }

  getSavedData() {
    let actor = fromUuidSync(this.actorUuid)

    let data = actor.getFlag('auto-action-tray', 'data')
    if (data) {
      if (data[this.id] != null) {
        this.meleeWeapon = fromUuidSync(JSON.parse(data[this.id].meleeWeapon))
        this.rangedWeapon = fromUuidSync(JSON.parse(data[this.id].rangedWeapon))

        this.savedData = true
      }
    }
  }

  setSavedData() {
    let actor = fromUuidSync(this.actorUuid)
    if (actor != null) {
      actor.setFlag('auto-action-tray', 'data', {
        [this.id]: {
          meleeWeapon: JSON.stringify(this.meleeWeapon?.uuid ? this.meleeWeapon.uuid : null),
          rangedWeapon: JSON.stringify(this.rangedWeapon?.uuid ? this.rangedWeapon.uuid : null),
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

  setMeleeWeapon(weapon) {
    this.meleeWeapon = weapon
    this.setSavedData()
  }
  setRangedWeapon(weapon) {
    this.rangedWeapon = weapon
    this.setSavedData()
  }
}
