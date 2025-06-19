import { TargetHelper } from './targetHelper.js'
import { ItemConfig } from '../dialogs/itemConfig.js'
import { ActivityTray } from '../components/activityTray.js'
import { SpellLevelTray } from '../components/spellLevelTray.js'
import { CustomTray } from '../components/customTray.js'

export class Actions {
  static logToChat(message, alias, actor) {
    ChatMessage.create({ content: message, speaker: { alias: alias, actor: actor } })
  }

  static setDefaultTray() {
    if (this.actor.type === 'npc') {
      this.currentTray = this.customTrays.find((e) => e.id == 'common')
      this.animationHandler.setDefaultTray('common')
      this.animationHandler.clearStack()
      this.currentTray.setActive()
    } else {
      this.currentTray = this.customTrays.find((e) => e.id == 'stacked')
      this.animationHandler.setDefaultTray('stacked')
      this.animationHandler.clearStack()
      this.currentTray.setActive()
    }
    // this.render({ parts: ['centerTray'] });
  }

  static async setTrayConfig(config) {
    await this.actor.setFlag('auto-action-tray', 'config', config)
  }

  static getTrayConfig() {
    let data = this.actor.getFlag('auto-action-tray', 'config')
    if (data) {
      return data
    } else {
      return null
    }
  }

  static getTray(trayId) {
    return (
      this.staticTrays.find((tray) => tray.id == trayId) ||
      this.customTrays.find((tray) => tray.id == trayId) ||
      [this.conditionTray].find((tray) => tray.id == trayId) ||
      [this.activityTray].find((tray) => tray.id == trayId) ||
      [this.spellLevelTray].find((tray) => tray.id == trayId) ||
      (trayId == 'target-helper' ? this.targetHelper : null)
    )
  }

  static async deleteData(actor) {
    await this.actor.unsetFlag('auto-action-tray', 'data')
    await this.actor.unsetFlag('auto-action-tray', 'config')

    this.trayOptions = {
      locked: false,
      enableTargetHelper: true,
      skillTrayPage: 0,
      currentTray: 'common',
      fastForward: true,
      imageType: 'portrait',
      imageScale: 1,
      imageX: 0,
      imageY: 0,
      healthIndicator: true,
      customStaticTrays: [],
      autoAddItems: true,
      enableTargetHelper: true,
      concentrationColor: '#9600d1',
    }

    this.generateActorItems(actor)
    this.initialTraySetup(this.actor)
    this.render(true)
  }
  static async deleteTrayData(actor) {
    await this.actor.unsetFlag('auto-action-tray', 'data')
    let token = await actor.getTokenDocument()
    this.deleteSavedActor(actor, token)
    this.generateActorItems(actor)
    this.initialTraySetup(this.actor)
    this.targetHelper.clearData()
    this.render(true)
  }

  static openSheet(event, target) {
    this.initialTraySetup(this.actor)
    this.actor.sheet.render(true)
  }

  static updateActorHealthPercent(actor) {
    let hp = actor.system.attributes.hp.value
    let maxHp = actor.system.attributes.hp.max

    let percent = (hp / maxHp) * 100
    if (percent > 50) {
      percent = 100
    }
    document
      .getElementById('auto-action-tray')
      ?.style.setProperty('--aat-character-health-percent', percent)
    return percent
  }

  static async endTurn(event, target) {
    if (this.combatHandler == null) return
    if (
      (this.combatHandler.combat.current.combatantId =
        !this.actor.getActiveTokens()[0].combatant._id)
    ) {
      return
    }
    this.combatHandler.combat.nextTurn()
  }

  static async setTray(event, target) {
    if (
      this.animating == true ||
      this.selectingActivity == true ||
      this.targetHelper.selectingTargets == true
    )
      return
    // let trayIn = this.getTray(target.dataset.id)

    this.animationHandler.setTray(target.dataset.id)
  }

  static toggleLock() {
    if (this.selectingActivity) return
    this.trayOptions['locked'] = !this.trayOptions['locked']
    this.setTrayConfig({ locked: this.trayOptions['locked'] })
    this.requestRender(['equipmentMiscTray', 'centerTray'])
  }
  static toggleSkillTrayPage() {
    if (this.selectingActivity) return
    this.trayOptions['skillTrayPage'] = this.trayOptions['skillTrayPage'] == 0 ? 1 : 0
    this.setTrayConfig({ skillTrayPage: this.trayOptions['skillTrayPage'] })

    this.requestRender('skillTray')
  }
  static toggleFastForward() {
    if (this.selectingActivity) return
    this.trayOptions['fastForward'] = !this.trayOptions['fastForward']
    this.setTrayConfig({ fastForward: this.trayOptions['fastForward'] })
    this.requestRender('equipmentMiscTray')
  }
  static toggleTargetHelper() {
    this.trayOptions['enableTargetHelper'] = !this.trayOptions['enableTargetHelper']
    this.setTrayConfig({ enableTargetHelper: this.trayOptions['enableTargetHelper'] })
    this.requestRender('equipmentMiscTray')
  }

  static toggleRangeBoundary(event, force = null) {
    this.trayOptions['rangeBoundaryEnabled'] = !this.trayOptions['rangeBoundaryEnabled']
    this.setTrayConfig({ rangeBoundaryEnabled: this.trayOptions['rangeBoundaryEnabled'] })
    this.requestRender(['equipmentMiscTray', 'centerTray'])
  }
  static minimizeTray() {
    this.close({ animate: false })
    const bottomUi = document.getElementById('hotbar')

    if (!bottomUi) {
      console.error("Element with ID 'hotbar' not found.")
      return
    }

    let wrapper = document.createElement('div')
    wrapper.classList.add('bar-controls', 'minimize-button')
    wrapper.id = 'aat-maximize-button'

    let link = document.createElement('a')
    link.id = 'aat-maximize'
    link.setAttribute('role', 'button')
    link.setAttribute('data-tooltip', 'Restore Auto Action Tray')
    link.setAttribute('data-action', 'openSheet')

    let icon = document.createElement('i')
    icon.classList.add('fa-solid', 'fa-arrows-maximize')

    link.appendChild(icon)
    wrapper.appendChild(link)

    wrapper.onclick = () => {
      this.render(true)
      wrapper.remove()
    }

    bottomUi.prepend(wrapper)
  }

  static toggleHpText() {
    this.hpTextActive = !this.hpTextActive

    this.requestRender('characterImage').then(() => {
      if (this.hpTextActive) {
        const inputField = document.querySelector('.hpinput')
        inputField.focus()
      }
    })
  }

  static async updateHp(data) {
    if (data == '') {
      this.hpTextActive = false
      this.requestRender('characterImage')
      return
    }

    const regex = /^[+-]?\d*/

    if (!regex.test(data)) {
      return
    } else {
      const matches = data.match(regex)
      let currentHp = this.actor.system.attributes.hp.value
      let tempHp = this.actor.system.attributes.hp.temp
      let updates = {}
      switch (true) {
        case matches[0].includes('+'):
          updates = {
            'system.attributes.hp.value': currentHp + parseInt(matches[0]),
          }
          break
        case matches[0].includes('-'):
          let thp = tempHp + parseInt(matches[0])
          updates = {
            'system.attributes.hp.value': thp < 0 ? currentHp + thp : currentHp,
            'system.attributes.hp.temp': thp <= 0 ? null : thp,
          }
          break
        case !matches[0].includes('+') && !matches[0].includes('-'):
          updates = { 'system.attributes.hp.value': parseInt(matches[0]) }
          break
      }
      await this.actor.update(updates)
      this.requestRender('characterImage')
    }
  }

  static async selectActivityWorkflow(item, activityId) {
    let ritualCast = this.currentTray.id == 'ritual'
    this.activityTray.useSlot = true
    let activity = null
    let selectedSpellLevel = ritualCast ? item.spellLevel : this.currentTray.spellLevel
    let itemConfig = ItemConfig.getItemConfig(item)
    let fastForward =
      itemConfig?.fastForward == 'always'
        ? true
        : itemConfig?.fastForward == 'never'
        ? false
        : this.trayOptions['fastForward']

    if (activityId) {
      activity = item.activities.find((e) => e.activityId == activityId)
    } else {
      if (item.activities.length <= 1 || fastForward) {
        activity = item.defaultActivity
      } else {
        activity = await Actions.selectActivity.bind(this)(item)

        if (
          activity == null ||
          (typeof activity === 'object' &&
            !Array.isArray(activity) &&
            Object.keys(activity).length === 0)
        ) {
          return
        }
      }
    }

    if (item.type == 'spell' && !fastForward && item.spellLevel > 0 && !ritualCast && item.isScaledSpell) {
      let spellData = await Actions.selectSpellLevel.bind(this)(item)

      if (
        spellData == null ||
        (typeof spellData === 'object' &&
          !Array.isArray(spellData) &&
          Object.keys(spellData).length === 0)
      ) {
        return
      }
      selectedSpellLevel = spellData?.selectedSpellLevel
      this.activityTray.useSlot = spellData?.useSlot
    }

    selectedSpellLevel =
      item?.preparationMode == 'pact'
        ? { slot: 'pact' }
        : {
            slot: selectedSpellLevel
              ? 'spell' + selectedSpellLevel
              : item.spellLevel == 0
              ? 'spell0'
              : null,
          }

    return {
      activity: activity,
      selectedSpellLevel: selectedSpellLevel,
    }
  }

  static async selectActivity(item) {
    this.activityTray.setActivities(item, this.actor)
    let activity = await this.activityTray.selectAbility(item, this.actor, this)
    activity = item.activities.find((e) => e.id == activity?.itemId)
    if (activity == null) return
    this.useSlot = activity?.useSlot
    return activity
  }

  static async selectSpellLevel(item) {
    this.spellLevelTray.setActivities(item, this.actor)
    let spellData = await this.spellLevelTray.selectAbility(item, this.actor, this)
    return spellData
  }

  static async getTargets(item, activity, selectedSpellLevel) {
    let targetCount = this.targetHelper.getTargetCount(item, activity, selectedSpellLevel)
    let targets = null
    let itemConfig = item.itemConfig
    let singleRoll = ((itemConfig && !itemConfig?.rollIndividual) || item?.concentration) ?? false
    targetCount =
      itemConfig && itemConfig['numTargets'] != undefined && !itemConfig['useDefaultTargetCount']
        ? itemConfig['numTargets']
        : targetCount
    if (
      this.trayOptions['enableTargetHelper'] &&
      targetCount > 0 &&
      (itemConfig ? itemConfig['useTargetHelper'] : this.trayOptions['enableTargetHelper'])
    ) {
      targets = await this.targetHelper.requestTargets(
        item,
        activity,
        this.actor,
        targetCount,
        singleRoll,
        selectedSpellLevel,
      )
      if (targets == null) return { canceled: true }
    }
    return { targets, itemConfig }
  }

  static async concentrationDialog(currentSpellName, name) {
    const result = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: `End Concentration on "${currentSpellName}"?`,
      },
      content: `
      <p>You are about to cast <strong>${name}</strong>.</p>
      <p>This will end concentration on <strong>${currentSpellName}</strong>.</p>
      <p>Do you wish to proceed?</p>
    `,
      modal: true,
    })

    if (!result && this.currentTray instanceof ActivityTray) {
      this.animationHandler.popTray()
    }

    return result
  }

  static async promptEndConcentration(item) {
    let endConcentration = true
    let currentSpellName = this.conditionTray.checkConcentration()
    game.settings.get('auto-action-tray', 'promptConcentrationOverwrite')
    if (
      item?.concentration &&
      currentSpellName != null &&
      game.settings.get('auto-action-tray', 'promptConcentrationOverwrite')
    ) {
      endConcentration = await Actions.concentrationDialog
        .bind(this)(currentSpellName, item.name)
        .catch(() => {
          return true
        })
    }
    return endConcentration
  }

  static async useItem(event, target) {
    this.targetHelper.destroyRangeBoundary()
    this.useSlot = true
    if (this.targetHelper.active) {
      return
    }
    let altDown = this.altDown
    let ctrlDown = this.ctrlDown
    let useSlot = true
    game.tooltip.deactivate()

    let ritualCast = this.currentTray.id == 'ritual'
    let itemId = target.dataset.itemId
    let activityId = target.dataset.activityId != '' ? target.dataset.activityId : null
    let item = this.getActorAbilities(this.actor.uuid).find((e) => e?.id == itemId)
    if (item == undefined) {
      try {
        item = game.macros.get(itemId)

        item.execute()
        return
      } catch (e) {
        console.error(`Item with ID ${itemId} not found in actor's abilities`, e)
        return
      }
    }
    // if (ritualCast) {
    //   let activity = item.defaultActivity.activity
    //   let options = await Actions.selectActivityWorkflow.bind(this)(item)
    //   if (options) {
    //     activity = options.activity.activity
    //   }
    //   if (!activity) return
    //   await activity.use(
    //     {
    //       consume: { spellSlot: false },
    //     },
    //     { configure: false },
    //   )
    //   return
    // }

    let options = await Actions.selectActivityWorkflow.bind(this)(item, activityId)

    if (!options?.activity || Object.keys(options.activity).length === 0) return
    let selectedSpellLevel = options.selectedSpellLevel,
      activity = options.activity

    //Concentration Check / Prompt
    let endConcentration = await Actions.promptEndConcentration.bind(this)(item)
    if (!endConcentration) {
      return
    }

    let { targets, itemConfig } = await Actions.getTargets.bind(this)(
      item,
      activity,
      selectedSpellLevel,
    )

    if (targets?.canceled == true || targets === undefined) return

    useSlot = this.useSlot && activity?.useSlot && !ritualCast

    if (useSlot && this.actor.system.spells[selectedSpellLevel.slot]?.value < 1) {
      ui.notifications.error(`No spell slots available`)
      return
    }

    //Item Use
    if (activity?.tooltip?.actionType) {
      this.combatHandler.consumeAction(activity.tooltip.actionType, activity.isScaledSpell)
    }
    console.log(this)
    if (
      targets &&
      targets.individual == true &&
      (itemConfig?.rollIndividual ?? true) &&
      !item?.concentration
    ) {
      //Repeated Item Use
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      let slotUse
      slotUse = useSlot === true ? 1 : 0

      for (const target of targets.targets) {
        target.setTarget(true, { releaseOthers: true })
        await item.item.system.activities
          .get(
            activity?.activityId ||
            activity?.itemId ||
              activity?._id ||
              item.item.system.activities.contents[0].id,
          )
          .use(
            {
              advantage: altDown,
              disadvantage: ctrlDown,
              midiOptions: {
                advantage: altDown,
                disadvantage: ctrlDown,
              },
              spell: selectedSpellLevel,
              consume: { spellSlot: slotUse == 1 ? true : false },
            },
            { configure: false },
            target,
          )
        slotUse = 0
        await wait(game.settings.get('auto-action-tray', 'muliItemUseDelay'))
      }
    } else {
      let useNotification =
        game.settings.get('auto-action-tray', 'enableUseItemName') ||
        game.settings.get('auto-action-tray', 'enableUseItemIcon')

      if (useNotification) {
        this.targetHelper.createUseNotification(item, activity, this.actor, selectedSpellLevel)
      }

      const minimumTime = 2000
      const delay = new Promise((resolve) => setTimeout(resolve, minimumTime))

      const usePromise = item.item.system.activities
        .get(
          activity?.activityId ||
          activity?.itemId ||
            activity?._id ||
            activity?.id ||
            item.item.system.activities.contents[0].id,
        )
        .use(
          {
            advantage: altDown,
            disadvantage: ctrlDown,
            midiOptions: {
              advantage: altDown,
              disadvantage: ctrlDown,
            },
            spell: selectedSpellLevel,
            consume: { spellSlot: useSlot },
          },
          { configure: false },
        )

      const [result] = await Promise.all([usePromise, delay])

      if (useNotification) {
        this.targetHelper.clearUseNotification()
      }
      if (this.currentTray instanceof ActivityTray) {
        this.animationHandler.popTray()
      }
    }
  }

  

  static useSkillSave(event, target) {
    let advantage = event.altKey
    let disadvantage = event.ctrlKey

    let type = target.dataset.type
    let skillsave = target.dataset.skill

    let skipDialog = this.trayOptions['fastForward'] ? { fastForward: true } : null

    const params = {
      dialog: {
        configure: !skipDialog,
      },
      message: {
        rollMode: 'publicroll',
      },
    }

    if (type == 'skill') {
      params.roll = { skill: skillsave, advantage: advantage, disadvantage: disadvantage }
      this.actor.rollSkill(params.roll, params.dialog, params.message)
    } else {
      params.roll = { ability: skillsave, advantage: advantage, disadvantage: disadvantage }
      this.actor.rollSavingThrow(params.roll, params.dialog, params.message)
    }
  }

  static async rollDice() {
    const roll = new Roll(`1d${this.dice[this.currentDice]}`)
    await roll.evaluate({ allowInteractive: false })
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ token: this.actor.token }),
      flavor: `Rolling a d${this.dice[this.currentDice]}`,
    })
  }

  static async rollDeathSave() {
    let advantage = event.altKey
    let disadvantage = event.ctrlKey

    let skipDialog = this.trayOptions['fastForward'] ? { fastForward: true } : null

    const params = {
      dialog: {
        configure: !skipDialog,
      },
      message: {
        rollMode: 'publicroll',
      },
    }

    params.roll = { advantage: advantage, disadvantage: disadvantage, legacy: false }
    await this.actor.rollDeathSave(params.roll, params.dialog, params.message)
    this.requestRender('characterImage')
  }

  static async increaseRowCount() {
    const root = document.getElementById('auto-action-tray')
    const current = parseInt(
      getComputedStyle(root).getPropertyValue('--aat-item-tray-item-height-count'),
    )
    if (current == 6) return
    const next = Math.min(current + 1, 6)

    this.rowCount = next

    this.totalabilities = this.rowCount * this.columnCount
    this.trayOptions['rowCount'] = this.rowCount
    await Actions.setTrayConfig.bind(this)({ rowCount: this.rowCount })
    this.initialTraySetup(this.actor)
  }

  static async decreaseRowCount() {
    const root = document.getElementById('auto-action-tray')
    const current = parseInt(
      getComputedStyle(root).getPropertyValue('--aat-item-tray-item-height-count'),
    )

    if (current == 3) return
    const next = Math.max(current - 1, 3)

    this.rowCount = next
    root.style.setProperty('--aat-item-tray-item-height-count', this.rowCount)
    this.totalabilities = this.rowCount * this.columnCount
    this.trayOptions['rowCount'] = this.rowCount
    await Actions.setTrayConfig.bind(this)({ rowCount: this.rowCount })
    this.initialTraySetup(this.actor)
  }

  static changeDice() {
    this.currentDice = this.currentDice < 5 ? this.currentDice + 1 : 0
    this.requestRender('endTurn')
  }

  static viewItem(event, target) {
    let itemId = target.dataset.itemId
    let item = this.actor.items.get(itemId)
    item.sheet.render(true)
  }

  static selectWeapon(event, target) {
    if (target.classList.contains('selected')) {
      target.classList.remove('selected')
      return
    }
    target.classList.add('selected')
  }

  static toggleUseSlot(event, target) {
    this.useSlot = target.checked
  }

  static increaseTargetCount() {
    this.targetHelper.increaseTargetCount()
  }
  static decreaseTargetCount() {
    this.targetHelper.decreaseTargetCount()
  }
  static confirmTargets() {
    this.targetHelper.confirmTargets()
  }
  static cancelSelection(event, target) {
    if (this.currentTray instanceof ActivityTray) {
      ActivityTray.cancelSelection.bind(this)(event, target)
    }
    if (this.currentTray instanceof SpellLevelTray) {
      SpellLevelTray.cancelSelection.bind(this)(event, target)
    }
    if (this.currentTray instanceof TargetHelper) {
      TargetHelper.cancelSelection.bind(this)(event, target)
    }
    this.animationHandler.popTray()
  }
  static async refreshFavorites(actor, options) {
    await actor.unsetFlag('auto-action-tray', 'data.favoriteItems')

    let abilities = this.getActorAbilities(actor.uuid)

    let favoritesTray = new CustomTray({
      category: 'favoriteItems',
      id: 'favoriteItems',
      trayLabel: 'Favorites',
      actorUuid: actor.uuid,
      application: options.application,
      cachedAbilities: abilities,
    })

    this.customTrays = this.customTrays.filter((e) => e.id !== 'favoriteItems')
    this.stackedTray.trays = this.stackedTray.trays.filter((e) => e.id !== 'favoriteItems')

    if (favoritesTray.abilities.length > 0) {
      this.customTrays.push(favoritesTray)
      this.stackedTray.trays.push(favoritesTray)
    }

    this.initialTraySetup(actor)
  }
}
