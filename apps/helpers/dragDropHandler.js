import { StaticTray } from '../components/staticTray.js'
import { CustomStaticTray } from '../components/customStaticTray.js'
import { ItemConfig } from './itemConfig.js'
export class DragDropHandler {
  static _onDragStart(event, hotbar) {
    game.tooltip.deactivate()
    const li = event.currentTarget

    if (event.target.classList.contains('content-link')) return

    if (li.dataset.itemId === undefined) return
    const effect = hotbar.actor.items.get(li.dataset.itemId)
    let data = effect.toDragData()
    data.section = li.dataset.section
    data.index = li.dataset.index
    data.src = 'AAT'
    data.trayId = event.target.dataset.trayid
    if (effect) event.dataTransfer.setData('text/plain', JSON.stringify(data))

    return
  }

  static _onDragOver(event, hotbar) {}

  static async _onDrop(event, hotbar) {

    const dragData =
      event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain')
    if (!dragData) return
    let data
    try {
      data = JSON.parse(dragData)
    } catch (e) {
      console.error(e)
      return
    }

    let target =
      hotbar.actor.items.get(event.target.dataset.itemId) ||
      hotbar.actor.items.get(event.target.parentElement.dataset.itemId)

    let index = event.target.dataset.index
    if (hotbar.currentTray instanceof StaticTray && index != 'itemConfig')  {
      return
    }
    if (event.target.parentElement.dataset.index === 'meleeWeapon') {
      hotbar.equipmentTray.setMeleeWeapon(fromUuidSync(data.uuid))
      hotbar.render({ parts: ['equipmentMiscTray'] })
      return
    } else if (event.target.parentElement.dataset.index === 'rangedWeapon') {
      hotbar.equipmentTray.setRangedWeapon(fromUuidSync(data.uuid))
      hotbar.render({ parts: ['equipmentMiscTray'] })
      return
    }

    if (!index) return
    if (index == 'meleeWeapon') {
      let item = fromUuidSync(data.uuid)
      hotbar.equipmentTray.setMeleeWeapon(item)
      hotbar.render({ parts: ['equipmentMiscTray'] })
      return
    }
    if (index == 'rangedWeapon') {
      let item = fromUuidSync(data.uuid)
      hotbar.equipmentTray.setRangedWeapon(item)
      hotbar.render({ parts: ['equipmentMiscTray'] })
      return
    }
    if (index == 'itemConfig') {
      let item = fromUuidSync(data.uuid)
      hotbar.itemConfigItem = item
      hotbar.render({ parts: ['equipmentMiscTray'] })
      ItemConfig.itemConfig.bind(hotbar)(item)
      return
    }

    if (index == data.index) return

    // Handle different data types
    switch (data.type) {
      case 'Item':
        let item = fromUuidSync(data.uuid)
        let sourceTray = hotbar.getTray(data.trayId)
        let targetTray = hotbar.getTray(event.target.dataset.trayid)
        targetTray?.setAbility(index, item)
        sourceTray?.setAbility(data.index, null)
        hotbar.render({ parts: ['centerTray'] })
        break

      default:
        return
    }
  }
  static _onDropCanvas(data, hotbar) {
    if (data.src != 'AAT') return
    if (hotbar.currentTray instanceof StaticTray) {
      return
    }
    if (data.index == 'meleeWeapon') {
      hotbar.equipmentTray.setMeleeWeapon(null)
      hotbar.render({ parts: ['equipmentMiscTray'] })
      return
    }
    if (data.index == 'rangedWeapon') {
      hotbar.equipmentTray.setRangedWeapon(null)
      hotbar.render({ parts: ['equipmentMiscTray'] })
      return
    }
    hotbar.getTray(data.trayId).setAbility(data.index, null)
    hotbar.render({ parts: ['centerTray'] })
  }
}
