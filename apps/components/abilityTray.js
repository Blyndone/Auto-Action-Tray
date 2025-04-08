export class AbilityTray {
  constructor(options = {}) {
    this.id = null
    this.abilities = []
    this.category = options.category || null
    this.actorUuid = options.actorUuid || null
    this.setInactive()
    this.type = ''
    this.application = options.application || null
    this.label = options.label || ''
    this.rowCount = game.settings.get('auto-action-tray', 'rowCount')
  }

  static padArray(arr, filler = null) {
    let rowCount = 2
    let columnCount = 10
    if (game.settings.get('auto-action-tray', 'rowCount')) {
      rowCount = game.settings.get('auto-action-tray', 'rowCount')
      document.documentElement.style.setProperty('--item-tray-item-height-count', rowCount)
    }

    if (game.settings.get('auto-action-tray', 'columnCount')) {
      columnCount = game.settings.get('auto-action-tray', 'columnCount')
      document.documentElement.style.setProperty(' --item-tray-item-width-count', columnCount)
    }

    let totalabilities = rowCount * columnCount

    if (arr == null) return new Array(totalabilities).fill(filler)
    return [...arr, ...Array(Math.max(0, totalabilities - arr.length)).fill(filler)]
  }

  static _onCreateItem(item) {
    if (this.trayOptions['autoAddItems'] == false) {
      return
    }

    if (item.parent.type != 'character' || item.type == 'spell') {
      return
    }
    if (item.parent == this.actor) {
      let tray
      let commonTray = this.customTrays.find((e) => e.id == 'common')
      switch (true) {
        case item.system.activities.size == 0:
          tray = this.customTrays.find((e) => e.id == 'passive')
          if (tray) {
            AbilityTray.addToTray(item, tray)
          } else {
            let passiveTray = new CustomTray({
              category: 'passive',
              id: 'passive',
              actorUuid: this.actor.uuid,
            })
            this.customTrays.push(passiveTray)
          }
          break

        case item.system?.activities.some((e) => e?.activation?.type == 'reaction'):
          tray = this.customTrays.find((e) => e.id == 'reaction')
          if (tray) {
            AbilityTray.addToTray(item, tray)
          } else {
            let reactionTray = new CustomTray({
              category: 'reaction',
              id: 'reaction',
              actorUuid: this.actor.uuid,
            })
            this.customTrays.push(reactionTray)
          }
          break

        case item.type == 'consumable':
          tray = this.customTrays.find((e) => e.id == 'items')
          if (tray) {
            AbilityTray.addToTray(item, tray)
          } else {
            let consumableTray = new CustomTray({
              category: 'items',
              id: 'items',
              actorUuid: this.actor.uuid,
            })
            this.customTrays.push(consumableTray)
          }
          break

        case item.type == 'feat':
          tray = this.customTrays.find((e) => e.id == 'classFeatures')

          if (tray) {
            AbilityTray.addToTray(item, tray)
          } else {
            let classFeatureTray = new CustomTray({
              category: 'classFeatures',
              id: 'classFeatures',
              actorUuid: this.actor.uuid,
            })
            this.customTrays.push(classFeatureTray)
          }

          break

        default:
          if (commonTray) {
            AbilityTray.addToTray(item, commonTray)
          } else {
            let commonTray = new CustomTray({
              category: 'common',
              id: 'common',
              actorUuid: actor.uuid,
            })
            this.customTrays.push(commonTray)
          }
          break
      }

      this.render(['centerTray'])
      return
    } else {
      AbilityTray.setDelayedData(item, item.parent)
    }


  }

  static _onDeleteItem(item) {
    let actor = item.parent
    if (actor != this.actor) {
      return
    }

    let trays = this.customTrays
    trays.forEach((tray) => {
      tray.deleteItem(item.id)
    })
    this.render(['centerTray'])
  }

  deleteItem(itemId) {
    let index = this.abilities.findIndex((e) => e?.id == itemId)
    if (index > -1) {
      this.abilities[index] = null
      this.setSavedData()
    }
  }

  static addToTray(item, tray) {
    let index = tray.abilities.findIndex((e) => e == null)
    if (index == -1) {
      return
    }
    if (tray.abilities.filter((e) => e == item).length > 0) {
      return
    }
    tray.abilities[index] = item
    tray.setSavedData()
  }

  checkSavedData() {
    let actor = fromUuidSync(this.actorUuid)

    if (!this.saveNpcData() && actor.type == 'npc') {
      return
    }
    if (actor != null) {
      return actor.getFlag('auto-action-tray', 'data.' + this.id) != null
    }
  }

  getSavedData() {
    let actor = fromUuidSync(this.actorUuid)

    if (!this.saveNpcData() && actor.type == 'npc') {
      return
    }
    let data = actor.getFlag('auto-action-tray', 'data')
    if (data) {
      if (data[this.id]?.abilities != null) {
        this.abilities = JSON.parse(data[this.id].abilities).map((e) =>
          e ? actor.items.get(e) : null,
        )
        this.abilities = AbilityTray.padArray(this.abilities)
        if (this.abilities.length == 0 || this.abilities.every((item) => item === null)) {
          actor.unsetFlag('auto-action-tray', 'data.' + this.id)
        }
        this.setSavedData()
        this.savedData = true
      }
    }
  }

  static setDelayedData(item, actor) {
    if (!this.saveNpcData() && actor.type == 'npc') {
      return
    }

    if (game.user.isGM) {
      let existingDelayItems = actor.getFlag('auto-action-tray', 'delayedItems')
      let delayItems = []
      if (existingDelayItems != undefined) {
        delayItems = [...JSON.parse(existingDelayItems)]
      }
      delayItems.push(item.id)
      actor.setFlag('auto-action-tray', 'delayedItems', JSON.stringify(delayItems))
    }
  }

  setSavedData() {
    let actor = fromUuidSync(this.actorUuid)
    if (!this.saveNpcData() && actor.type == 'npc') {
      return
    }
    if (actor != null) {
      let temparr = this.abilities.map((e) => (e ? e.id : null))
      if (temparr.length == 0) {
        return
      }
      actor.setFlag('auto-action-tray', 'data', {
        [this.id]: { abilities: JSON.stringify(temparr) },
      })
    }
    this.savedData = true
  }

  setAbility(index, ability) {
    this.abilities[index] = ability
    this.setSavedData()
  }

  getAbilities() {
    return this.abilities
  }

  setActive() {
    this.active = true
  }
  setInactive() {
    this.active = false
  }

  saveNpcData() {
    return game.settings.get('auto-action-tray', 'saveNpcData')
  }
}
