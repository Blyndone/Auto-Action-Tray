import { TargetLineCombo } from './targetLineCombo.js'
import { AATActivity } from '../items/activity.js'
import { TemplateBoundary } from './templateBoundary.js'

export class TargetHelper {
  #state
  constructor(options) {
    this.id = 'target-helper'
    this.label = ''
    this.type = 'target'

    this.socket = options.socket
    this.hotbar = options.hotbar
    this.socket.register('newPhantomLine', this.newPhantomLine.bind(this))
    this.socket.register('drawPhantomLine', this.drawPhantomLine.bind(this))
    this.socket.register('clearPhantomLine', this.clearPhantomLine.bind(this))
    this.socket.register('clearAllPhantomLines', this.clearAllPhantomLines.bind(this))
    this.socket.register('setPhantomInRange', this.setPhantomInRange.bind(this))
    this.socket.register('destroyPhantomLine', this.destroyPhantomLine.bind(this))
    this.socket.register('setPhantomYOffset', this.setPhantomYOffset.bind(this))

    this.socket.register('createTemplateBoundary', this.createTemplateBoundary.bind(this))
    this.socket.register('updateTemplateBoundary', this.updateTemplateBoundary.bind(this))
    this.socket.register('destroyTemplateBoundary', this.destroyTemplateBoundary.bind(this))

    this.stage = canvas.stage
    this.activity = null
    this.activityRange = 0
    this.activityTargetCount = 3
    this.actor = null
    this.color = game.user.color.css
    this.singleRoll = false
    this.targets = []
    this.targetLines = []
    this.phantomLines = []
    this.currentLine = null
    this.rangeBoundary = null
    this.templateBoundary = new TemplateBoundary(options)
    this.templateBoundaryUuid = null
    this.startPos
    this.startLinePos
    this.item = null
    this.useSlot = false
    this.mouseMoveHandler = null
    this.selectedTargets = null
    this.rejectTargets = null

    this.throttleSpeed = game.settings.get('auto-action-tray', 'targetLinePollRate')
    this.sendTargetLines = game.settings.get('auto-action-tray', 'sendTargetLines')
    this.recieveTargetLines = game.settings.get('auto-action-tray', 'recieveTargetLines')
    this.gridSize = game.canvas.scene.grid.size

    Hooks.on('dnd5e.createActivityTemplate', (activity, created) => {
      if (!(activity.actor.id == this.actor.id)) return
      this._HookCreateMeasuredTemplate(activity, created)
    })
    this.refreshHook = null
    this.destroyHook = null
    this.active = false
    this.STATES = {
      IDLE: 0,
      TARGETING: 1,
      HOVERING: 2,
    }
    this.#state = this.STATES.IDLE
  }

  setActor(actor) {
    this.actor = actor
    let themeColor = null
    if (game.settings.get('auto-action-tray', 'autoThemeTargetingColor')) {
      themeColor = getComputedStyle(
        document.querySelector('.' + game.settings.get('auto-action-tray', 'tempTheme')),
      )
        .getPropertyValue('--aat-hover-color')
        .trim()
    }

    this.color = this.hotbar.trayOptions.targetColor || themeColor || game.user.color.css
    this.actorId = actor.id
    this.startPos = TargetHelper.getPositionFromActor(actor)
    this.startLinePos = TargetHelper.getLinePositionFromActor(actor)
  }
  setActivity(activity) {
    this.item = activity.item
    this.activity = activity
  }
  setData(actor, activity) {
    this.setActor(actor)
    this.setActivity(activity)
  }

  setActive() {
    this.active = true
  }
  setInactive() {
    this.active = false
  }
  setState(state) {
    if (typeof state == 'string') {
      state = this.STATES[state.toUpperCase()]
    }
    this.#state = state
  }
  getState() {
    return this.#state
  }

  setSingleRoll(singleRoll) {
    this.singleRoll = singleRoll
  }

  newPhantomLine(options) {
    if (!this.recieveTargetLines) return
    let line = new TargetLineCombo(options)
    this.phantomLines.push(line)
    return line
  }
  drawPhantomLine(id, endPos) {
    if (!this.recieveTargetLines) return
    let line = this.phantomLines.find((line) => line.id == id)
    line.drawLines(endPos)
  }
  setPhantomInRange(id, inRange) {
    if (!this.recieveTargetLines) return
    let line = this.phantomLines.find((line) => line.id == id)
    line.setInRange(inRange)
  }

  setPhantomYOffset(id, yOffset) {
    if (!this.recieveTargetLines) return
    let line = this.phantomLines.find((line) => line.id == id)
    line.setYOffset(yOffset)
  }

  clearPhantomLine(id) {
    if (!this.recieveTargetLines) return
    let line = this.phantomLines.find((line) => line.id == id)
    line.clearLines()
  }
  destroyPhantomLine(id) {
    if (!this.recieveTargetLines) return
    let line = this.phantomLines.find((line) => line.id == id)
    line.destroyLines()
  }
  clearAllPhantomLines(actorId) {
    if (!this.recieveTargetLines) return
    this.phantomLines = this.phantomLines.filter((line) => {
      if (line.actorId === actorId) {
        line.destroyLines()
        return false
      }
      return true
    })
  }

  createUseNotification(item, activity, actor, selectedSpellLevel, useRangeBoundary = true) {

    this.state = this.setState('TARGETTING')
    this.clearData()
    if (this.sendTargetLines) {
      this.socket.executeForOthers('clearAllPhantomLines', this.actorId)
    }
    this.setData(actor, activity)
    this.activityRange = useRangeBoundary ? this.getActivityRange(item, activity) : 0


    this.currentLine = new TargetLineCombo({
      useLines: false,
      startPos: this.startPos,
      startLinePos: this.startLinePos,
      actorId: actor.id,
      itemName: item.name,
      itemType: item.type,
      itemImg: item.img,
      itemRarity: item.rarity,
      itemSpellLevel: selectedSpellLevel,
      activityRange: this.activityRange,
      color: this.color,
    })
    if (this.sendTargetLines) {
      this.socket.executeForOthers('newPhantomLine', {
        useLines: false,
        sendName: game.settings.get('auto-action-tray', 'enableUseItemName'),
        sendIcon: game.settings.get('auto-action-tray', 'enableUseItemIcon'),
        id: this.currentLine.id,
        actorId: this.actorId,
        startPos: this.startPos,
        startLinePos: this.startLinePos,
        color: this.currentLine.color,
        itemName: item.name,
        itemType: item.type,
        itemImg: item.img,
        itemRarity: item.rarity,
        itemSpellLevel: selectedSpellLevel,
      })
    }
  }
  clearUseNotification() {
    this.setState('IDLE')
    this.clearData()
  }
  createRangeBoundary(range, actor) {
    this.setActor(actor)
    this.rangeBoundary?.clearRangeBoundary()
    this.rangeBoundary = new TargetLineCombo({
      useLines: false,
      sendIcon: false,
      startPos: this.startPos,
      startLinePos: this.startLinePos,
      actorId: actor.id,
      itemName: '',
      itemType: '',
      itemImg: '',
      itemRarity: '',
      itemSpellLevel: '',
      activityRange: range,
      color: this.color,
    })
  }
  destroyRangeBoundary() {
    this.rangeBoundary?.clearRangeBoundary()
    this.rangeBoundary = null
  }

  clearData() {
    this.setState('IDLE')
    this.actor = null
    this.item = null
    this.singleRoll = false
    this.targets = []
    this.clearTargetLines()
    this.destroyRangeBoundary()
    if (this.sendTargetLines) {
      this.socket.executeForOthers('clearAllPhantomLines', this.actorId)
    }
    this.targetLines = []
    this.itemRange = 0
    this.itemTargetCount = 0
    try {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
    } catch (error) {}
  }

  async requestTargets(
    item,
    activity,
    actor,
    targetCount,
    singleRoll,
    selectedSpellLevel,
    animate = true,
  ) {
    this.useSlot = false
    this.clearData()
    this.state = this.setState('TARGETING')
    this.setSingleRoll(singleRoll)
    if (this.sendTargetLines) {
      this.socket.executeForOthers('clearAllPhantomLines', this.actorId)
    }
    this.setData(actor, activity)
    this.activityRange = this.getActivityRange(item, activity)
    this.activityTargetCount = targetCount
    this.gridSize = game.canvas.scene.grid.size

    let prefix = item.type === 'spell' ? 'Casting ' : 'Using '
    this.label = `${prefix} ${item.name}...   `
    if (animate) {
      this.hotbar.animationHandler.pushTray('target-helper')
    }

    canvas.tokens.setTargets([])

    this.currentLine = new TargetLineCombo({
      startPos: this.startPos,
      startLinePos: this.startLinePos,
      actorId: actor.id,
      itemName: item.name,
      itemType: item.type,
      itemImg: item.img,
      itemRarity: item.rarity,
      itemSpellLevel: selectedSpellLevel,
      activityRange: this.activityRange,
      color: this.color,
    })
    if (this.sendTargetLines) {
      this.socket.executeForOthers('newPhantomLine', {
        id: this.currentLine.id,
        actorId: this.actorId,
        startPos: this.startPos,
        startLinePos: this.startLinePos,
        color: this.currentLine.color,
        itemName: item.name,
        itemType: item.type,
        itemImg: item.img,
        itemRarity: item.rarity,
        itemSpellLevel: selectedSpellLevel,
        sendName: game.settings.get('auto-action-tray', 'enableUseItemName'),
        sendIcon: game.settings.get('auto-action-tray', 'enableUseItemIcon'),
      })
    }
    this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
    this.mouseMoveHandler = foundry.utils.throttle(
      (event) => this._onMouseMove(event),
      this.throttleSpeed,
    )

    document.addEventListener('mousemove', this.mouseMoveHandler)

    let targets
    try {
      return await new Promise((resolve, reject) => {
        this.selectedTargets = resolve
        this.rejectTargets = reject
      })
    } catch (error) {
      this.setState('IDLE')
      targets = null
    }
  }

  selectTarget(token) {
    if (this.singleRoll && this.targets.includes(token)) {
      return
    }
    if (this.targets.length == 0) {
      token.setTarget(true, { releaseOthers: false })
    }
    this.targets.push(token)
    token.setTarget(true, { releaseOthers: false })
    this.setTargetLine(token)

    if (this.targets.length < this.activityTargetCount) {
      this.newTargetLine()
      if (this.sendTargetLines) {
        this.socket.executeForOthers('newPhantomLine', {
          id: this.currentLine.id,
          actorId: this.actorId,
          startPos: this.startPos,
          startLinePos: this.startLinePos,
          color: this.currentLine.color,
        })
      }
      this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
    } else {
      this.confirmTargets()
    }
  }

  confirmTargets() {
    this.setState('IDLE')
    document.removeEventListener('mousemove', this.mouseMoveHandler)
    this.currentLine.clearText()
    this.clearRangeBoundary()
    const canvas = document.getElementById('board')

    canvas.style.cursor = ''

    if (this.hotbar.animating) {
      setTimeout(() => {
        this.confirmTargets()
        return
      }, 250)
      return
    }
    this.selectedTargets({ targets: this.targets, individual: true })
    this.hotbar.animationHandler.popTray()

    if (event?.target.dataset.action == 'confirmTargets') {
      this.currentLine.clearLines()
      this.currentLine.forceDestroyLines()
    }

    setTimeout(() => {
      if (this.state >= this.STATES.TARGETING) return
      this.currentLine.destroyLines()
      if (this.sendTargetLines) {
        this.socket.executeForOthers('destroyPhantomLine', this.currentLine.id)
      }
      this.clearTargetLines()
      if (this.sendTargetLines) {
        this.socket.executeForOthers('clearAllPhantomLines', this.actorId)
      }
    }, 3000)
  }

  increaseTargetCount() {
    if (this.targets.length >= this.activityTargetCount) return
    this.activityTargetCount++
    this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
  }
  decreaseTargetCount() {
    if (this.activityTargetCount <= 1) return
    this.activityTargetCount--
    this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
    if (this.targets.length == this.activityTargetCount) {
      this.confirmTargets()
    }
  }

  removeTarget() {
    if (this.targets.length == 0) {
      const canvas = document.getElementById('board')
      canvas.style.cursor = ''
      this.setState('IDLE')
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      this.rejectTargets(new Error('No targets to remove'))
      this.clearData()
      this.hotbar.animationHandler.popTray()

      return
    }

    let token = this.targets.pop()
    token.setTarget(false, { releaseOthers: false })
    if (this.targetLines.length > 0) {
      if (this.sendTargetLines) {
        this.socket.executeForOthers('destroyPhantomLine', this.targetLines.at(-1)?.id)
      }
      if (this.targetLines.length == 1) {
        this.targetLines.at(-1)?.setFirstLine(false)
        this.currentLine.setFirstLine(true)
        this.currentLine.transferBoundaryAndText(
          this.targetLines.at(-1)?.targettingText,
          this.targetLines.at(-1)?.rangeBoundary,
        )
      }
      this.targetLines.at(-1)?.destroyLines()
      this.targetLines.pop()
    }
    this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
  }

  static cancelSelection(event, target, animate = true) {
    const helper = this?.targetHelper
    const animation = this?.animationHandler
    helper?.setState('IDLE')
    document.removeEventListener('mousemove', this.mouseMoveHandler)
    try {
      helper?.rejectTargets?.(new Error('User canceled Target selection'))
    } catch {}
    if (helper) {
      helper.rejectTargets = null
      try {
        helper.currentLine?.clearLines?.()
      } catch {}
      try {
        helper.clearData?.()
      } catch {}
    }

    if (animate) {
      try {
        animation?.popTray?.()
      } catch {}
    }
  }

  clearTargetLines() {
    try {
      this.targetLines.forEach((lineCombo) => lineCombo.destroyLines())
      this.targetLines = []
      this.currentLine.destroyLines()
    } catch (error) {}
  }
  clearRangeBoundary() {
    try {
      this.targetLines.forEach((lineCombo) => lineCombo.clearRangeBoundary())
    } catch (error) {}
  }
  newTargetLine() {
    let endPos = this.startPos
    if (this.currentLine) {
      endPos = this.currentLine.lastPos
    }
    this.currentLine = new TargetLineCombo({
      startPos: this.startPos,
      startLinePos: this.startLinePos,
      actorId: this.actor.id,
      firstLine: this.targetLines.length == 0,
      color: this.color,
    })
    if (this.sendTargetLines) {
      this.socket.executeForOthers('newPhantomLine', {
        id: this.currentLine.id,
        actorId: this.actorId,
        startLinePos: this.startLinePos,
        color: this.currentLine.color,
        firstLine: this.targetLines.length == 0,
      })
    }
    this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
    this.currentLine.drawLines(endPos)
    if (this.sendTargetLines) {
      this.socket.executeForOthers('drawPhantomLine', this.currentLine.id, endPos)
    }
  }
  setTargetLine(token) {
    let lastPos = this.currentLine.lastPos
    let endPos = TargetHelper.getLinePositionFromActor(token.actor)
    this.targetLines.push(this.currentLine)
    let offset = this.targets.filter((t) => t.id == token.id).length - 1
    this.currentLine.setYOffset(offset)
    this.currentLine.drawLines(endPos)
    if (this.sendTargetLines) {
      this.socket.executeForOthers('setPhantomYOffset', this.currentLine.id, offset)
      this.socket.executeForOthers('drawPhantomLine', this.currentLine.id, endPos)
    }
    this.currentLine.lastPos = lastPos
    this.currentLine.clearText()
  }

  moveText(endPos) {
    this.currentLine.moveText(endPos)
  }

  static getPositionFromActor(actor) {
    let token = actor.getActiveTokens()[0]
    const pos = token.getCenterPoint()
    return pos
  }

  static getLinePositionFromActor(actor) {
    let token = actor.getActiveTokens()[0]
    const pos = token.getCenterPoint()
    return {
      x: pos.x,
      y: pos.y - token.h / 4,
    }
  }

  async _onMouseMove(event) {
    if (
      event.target.closest('#auto-action-tray') &&
      !event.target.closest('.effect-tray-container') &&
      event.target.checkVisibility()
    )
      if (this.getState() <= this.STATES.IDLE) {
        document.removeEventListener('mousemove', this.mouseMoveHandler)
        return
      }
    let endPos = await TargetHelper.getCursorCoordinates(event)
    this.currentLine.setInRange(this.checkInRange(this.actor, endPos, this.activityRange))
    this.currentLine.drawLines(endPos)
    if (this.sendTargetLines) {
      this.socket.executeForOthers(
        'setPhantomInRange',
        this.currentLine.id,
        this.currentLine.inRange,
      )
      this.socket.executeForOthers('drawPhantomLine', this.currentLine.id, endPos)
    }
  }

  static async getCursorCoordinates(onClickEvent) {
    const [x, y] = [onClickEvent.clientX, onClickEvent.clientY]
    const t = canvas.app.stage.worldTransform

    return {
      x: (x - t.tx) / canvas.app.stage.scale.x,
      y: (y - t.ty) / canvas.app.stage.scale.y,
    }
  }

  checkInRange(actor, endPos, range) {
    if (!actor) return false
    let token = actor.getActiveTokens()[0]
    if (range <= 0) return true
    let dx =
      Math.min(Math.abs(token.x - endPos.x), Math.abs(token.x + token.shape.width - endPos.x)) /
      this.gridSize
    let dy =
      Math.min(Math.abs(token.y - endPos.y), Math.abs(token.y + token.shape.height - endPos.y)) /
      this.gridSize
    if (dx > range || dy > range) return false
    return true
  }

  getActivityRange(item, activity) {
    if (!activity) {
      activity = item.defaultActivity
    }
    item = item.item
    activity = activity
    let range =
      activity.range?.value ??
      item.system.range?.value ??
      activity.range?.reach ??
      item.system.range?.reach ??
      (activity.range?.units === 'touch' ? 5 : activity.range?.units === 'self' ? -1 : null) ??
      (item.system.range?.units === 'touch' ? 5 : item.system.range?.units === 'self' ? -1 : 0)

    return range > 0 ? range / 5 : range
  }

  getTargetCount(item, activity, selectedSpellLevel) {
    let spellLevel = selectedSpellLevel.slot
    if (activity?.itemId && !(activity instanceof AATActivity)) {
      activity = item.activities.find((e) => e.id == activity.itemId)
    }
    let targetCount = 1
    if (!activity) {
      activity = item.defaultActivity
    }
    if (!selectedSpellLevel.slot) {
      return activity.tooltip?.targetCount
    }
    if (selectedSpellLevel.slot && selectedSpellLevel.slot != 'spell0') {
      if (selectedSpellLevel.slot != 'pact') {
        spellLevel = parseInt(selectedSpellLevel.slot.replaceAll(/[a-zA-Z]/g, ''))
      } else {
        spellLevel = item.pactLevel
      }

      let act = item.activities.find((e) => e.id == activity.id)

      targetCount =
        act.tooltips?.find((e) => e.spellLevel == spellLevel).targetCount ||
        act.tooltip?.targetCount
    }
    return targetCount
  }

  _HookCreateMeasuredTemplate(activity, created) {
    this.templateBoundaryUuid = activity.uuid

    const options = {
      color: this.color || themeColor || game.user.color.css,
      activityUuid: activity.uuid,
      document: created[0].document,
    }
    if (!this.createTemplateBoundary.bind(this)(options)) {
      return
    }

    if (this.sendTargetLines) {
      this.socket.executeForOthers('createTemplateBoundary', { ...options, phantom: true })
    }

    this.refreshHook = Hooks.on('refreshMeasuredTemplate', (template, state) => {
      this._HookRefreshMeasuredTemplate(template, state)
    })
    this.destroyHook = Hooks.on('destroyMeasuredTemplate', (template) => {
      this._HookDestroyMeasuredTemplate(template)
    })
  }
  _HookRefreshMeasuredTemplate(template, state) {
    if (
      !template?.activity ||
      !template?.activity.uuid ||
      this.templateBoundaryUuid != template.activity.uuid
    )
      return

    let options = {
      activityUuid: template.activity.uuid,
      document: template.document,
    }
    this.updateTemplateBoundary.bind(this)(options)
    if (this.sendTargetLines) {
      this.socket.executeForOthers('updateTemplateBoundary', { ...options, phantom: true })
    }
  }
  _HookDestroyMeasuredTemplate(template) {
    if (
      !template?.activity ||
      !template?.activity.uuid ||
      this.templateBoundaryUuid != template.activity.uuid
    )
      return
    let options = {
      activityUuid: template.activity.uuid,
      document: template.document,
    }
    this.destroyTemplateBoundary.bind(this)(options)
    this.templateBoundaryUuid = null
    if (this.sendTargetLines) {
      this.socket.executeForOthers('destroyTemplateBoundary', { ...options, phantom: true })
    }
    Hooks.off('refreshMeasuredTemplate', this.refreshHook)
    Hooks.off('destroyMeasuredTemplate', this.destroyHook)
  }

  createTemplateBoundary(options) {
    if (!this.recieveTargetLines && options.phantom) return
    return this.templateBoundary?.createBoundary(options)
  }

  updateTemplateBoundary(template) {
    this.templateBoundary?.updateBoundary(template)
  }

  destroyTemplateBoundary(template) {
    this.templateBoundary?.destroyBoundary(template)
  }
}
