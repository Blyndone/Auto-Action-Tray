import { AnimationHandler } from './animationHandler.js'
import { TargetHelper } from './targetHelper.js'

export class Actions {
  static setDefaultTray() {
    if (this.actor.type === 'npc') {
      this.currentTray = this.customTrays.find((e) => e.id == 'common')
      this.currentTray.setActive()
    } else {
      this.currentTray = this.customTrays.find((e) => e.id == 'stacked')
      this.currentTray.setActive()
    }
    // this.render({ parts: ['centerTray'] });
  }

  static setTrayConfig(config) {
    this.actor.setFlag('auto-action-tray', 'config', config)
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
      [this.activityTray].find((tray) => tray.id == trayId)
    )
  }

  static openSheet(event, target) {
    this.actor.sheet.render(true)
  }

  static updateActorHealthPercent(actor) {
    let hp = actor.system.attributes.hp.value
    let maxHp = actor.system.attributes.hp.max

    let percent = (hp / maxHp) * 100
    if (percent > 50) {
      percent = 100
    }
    document.documentElement.style.setProperty('--character-health-percent', percent)
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
    // this.actor.unsetFlag('auto-action-tray', 'data');
    // this.actor.unsetFlag('auto-action-tray', 'config');
  }

  static async setTray(event, target) {
    if (this.animating == true || this.selectingActivity == true) return
    let trayIn = this.getTray(target.dataset.id)
    // if (target.dataset.id == 'stacked') {
    //   this.animationHandler.animateTrayOut(this.animationHandler.findTray(this.currentTray.id))
    //   this.animationHandler.animateStackedTray(this.animationHandler.findTray(target.dataset.id))
    //   return
    // }
    if (trayIn.type == 'static') {
      this.trayInformation = trayIn.label
    } else {
      this.trayInformation = ''
    }
    this.animationHandler.animateTrays(target.dataset.id, this.currentTray.id, this)
  }

  static toggleLock() {
    if (this.selectingActivity) return
    this.trayOptions['locked'] = !this.trayOptions['locked']
    this.setTrayConfig({ locked: this.trayOptions['locked'] })
    this.render({ parts: ['equipmentMiscTray'] })
  }
  static toggleSkillTrayPage() {
    if (this.selectingActivity) return
    this.trayOptions['skillTrayPage'] = this.trayOptions['skillTrayPage'] == 0 ? 1 : 0
    this.setTrayConfig({ skillTrayPage: this.trayOptions['skillTrayPage'] })

    this.render({ parts: ['skillTray'] })
  }
  static toggleFastForward() {
    if (this.selectingActivity) return
    this.trayOptions['fastForward'] = !this.trayOptions['fastForward']
    this.setTrayConfig({ fastForward: this.trayOptions['fastForward'] })
    this.render({ parts: ['equipmentMiscTray'] })
  }
  static toggleTargetHelper() {
    this.trayOptions['enableTargetHelper'] = !this.trayOptions['enableTargetHelper']
    this.setTrayConfig({ enableTargetHelper: this.trayOptions['enableTargetHelper'] })
    this.render({ parts: ['equipmentMiscTray'] })
  }

  static toggleItemSelector() {
    this.itemSelectorEnabled = !this.itemSelectorEnabled
    this.render({ parts: ['equipmentMiscTray'] })
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

    this.render({ parts: ['characterImage'] }).then(() => {
      if (this.hpTextActive) {
        const inputField = document.querySelector('.hpinput')
        inputField.focus()
      }
    })
  }

  static async updateHp(data) {
    if (data == '') {
      this.hpTextActive = false
      this.render({ parts: ['characterImage'] })
      return
    }

    const regex = /^[+-]?\d*/

    if (!regex.test(data)) {
      // If not valid, sanitize by removing any invalid characters
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
      this.render({ parts: ['characterImage'] })
    }
  }

  static useSlot(event, target) {}

  static async useItem(event, target) {
    game.tooltip.deactivate()
    let itemId = target.dataset.itemId
    let item = this.actor.items.get(itemId)
    this.activityTray.getActivities(item, this.actor)
    let selectedSpellLevel = null,
      activity = null

    if (!this.trayOptions['fastForward']) {
      if (this.activityTray?.abilities?.length > 1) {
        activity = await this.activityTray.selectAbility(item, this.actor, this)
        if (activity == null) return
        selectedSpellLevel = !selectedSpellLevel ? activity['selectedSpellLevel'] : ''
      } else {
        activity = item.system.activities[0]
      }
    } else {
      activity = item.system.activities.contents[0]
      selectedSpellLevel = this.currentTray.spellLevel
    }

    selectedSpellLevel =
      item.system.preparation?.mode == 'pact'
        ? { slot: 'pact' }
        : { slot: 'spell' + selectedSpellLevel }
    let targetCount = TargetHelper.checkTargetCount(item, activity, selectedSpellLevel)
    let targets = null
    if (this.trayOptions['enableTargetHelper'] && targetCount > 0) {
      targets = await this.targetHelper.requestTargets(item, activity, this.actor, targetCount)
      if (targets == null) return
    }
    if (targets && targets.individual == true) {
      let slotUse = activity?.useSlot != undefined && activity?.useSlot == false ? 0 : 1
      for (const target of targets.targets) {
        target.setTarget(true, { releaseOthers: true })
        await item.system.activities
          .get(activity?.itemId || activity?._id || item.system.activities.contents[0].id)
          .use(
            {
              spell: selectedSpellLevel,
              consume: { spellSlot: slotUse == 1 ? true : false },
            },
            { configure: false },
            target,
          )
        slotUse = 0
      }
    } else {
      item.system.activities
        .get(activity?.itemId || activity?._id || item.system.activities.contents[0].id)
        .use(
          {
            spell: selectedSpellLevel,
            consume: { spellSlot: activity?.useSlot },
          },
          { configure: false },
        )
    }
  }

  static useSkillSave(event, target) {
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
      params.roll = { skill: skillsave }
      this.actor.rollSkill(params.roll, params.dialog, params.message)
    } else {
      params.roll = { ability: skillsave }
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

  static changeDice() {
    this.currentDice = this.currentDice < 5 ? this.currentDice + 1 : 0
    this.render({ parts: ['endTurn'] })
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
}
