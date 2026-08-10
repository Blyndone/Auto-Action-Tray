import { TargetLineCombo } from './targetLineCombo.js'
import { AATActivity } from '../items/activity.js'
import { TemplateBoundary } from './templateBoundary.js'
import { UseTrace } from './useTrace.js'

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
    this.chatMessage = null
    this.finalTargetPause = 500

    // Drawing is driven off the canvas ticker from the last known cursor position; only the
    // socket broadcast is throttled. Previously both shared the poll-rate throttle, so the local
    // line stepped at 20Hz against a 60fps canvas and the network rate could not be lowered
    // without making your own line choppier.
    this.token = null
    this.cursorScreen = null
    this.lineTick = null
    this.broadcastLine = null
    this.lastSentInRange = null
    this.colorCache = null

    this.throttleSpeed = game.settings.get('auto-action-tray', 'targetLinePollRate')
    this.sendTargetLines = game.settings.get('auto-action-tray', 'sendTargetLines')
    this.receiveTargetLines = game.settings.get('auto-action-tray', 'receiveTargetLines')
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
    this.color = this.resolveColor()
    this.actorId = actor.id
    // One token lookup for both anchors, and kept for checkInRange — getActiveTokens() walks the
    // actor's dependent tokens and was being called again on every cursor sample.
    this.token = actor.getActiveTokens()[0]
    this.startPos = TargetHelper.getPositionFromToken(this.token)
    this.startLinePos = TargetHelper.getLinePositionFromToken(this.token)
  }

  // Memoized on the inputs it actually depends on: this runs on every ranged tray item hover via
  // createRangeBoundary(), and getComputedStyle() there forces a synchronous style recalc.
  resolveColor() {
    const custom = this.hotbar.trayOptions.targetColor
    const autoTheme = game.settings.get('auto-action-tray', 'autoThemeTargetingColor')
    const theme = autoTheme ? game.settings.get('auto-action-tray', 'tempTheme') : null
    const cache = this.colorCache
    if (cache && cache.custom === custom && cache.theme === theme) return cache.color

    let themeColor = null
    if (theme) {
      const themeElement = document.querySelector('.' + theme)
      if (themeElement) {
        themeColor = getComputedStyle(themeElement).getPropertyValue('--aat-hover-color').trim()
      }
    }
    const color = custom || themeColor || game.user.color.css
    this.colorCache = { custom, theme, color }
    return color
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
    if (!this.receiveTargetLines) return
    // `phantom: true` was never set by the senders, so remote lines were building a TargetText
    // that can never be populated (the counter is not broadcast) and moving it on every sample.
    let line = new TargetLineCombo({ ...options, phantom: true })
    this.phantomLines.push(line)
    return line
  }
  // Every handler below tolerates an unknown id: socket messages can outlive the line they refer
  // to (a clearAll racing an in-flight draw), and an uncaught throw here is a console error per
  // sample, at the sample rate.
  getPhantomLine(id) {
    return this.phantomLines.find((line) => line.id == id)
  }
  drawPhantomLine(id, endPos) {
    if (!this.receiveTargetLines) return
    this.getPhantomLine(id)?.drawLines(endPos)
  }
  setPhantomInRange(id, inRange) {
    if (!this.receiveTargetLines) return
    this.getPhantomLine(id)?.setInRange(inRange)
  }

  setPhantomYOffset(id, yOffset) {
    if (!this.receiveTargetLines) return
    this.getPhantomLine(id)?.setYOffset(yOffset)
  }

  clearPhantomLine(id) {
    if (!this.receiveTargetLines) return
    this.getPhantomLine(id)?.clearLines()
  }
  destroyPhantomLine(id) {
    if (!this.receiveTargetLines) return
    const index = this.phantomLines.findIndex((line) => line.id == id)
    if (index === -1) return
    // Drop the entry as well as its graphics; only clearAllPhantomLines used to prune the array,
    // so ids for actors that never acted again accumulated for the session.
    this.phantomLines[index].destroyLines()
    this.phantomLines.splice(index, 1)
  }
  clearAllPhantomLines(actorId) {
    if (!this.receiveTargetLines) return
    this.phantomLines = this.phantomLines.filter((line) => {
      if (line.actorId === actorId) {
        line.destroyLines()
        return false
      }
      return true
    })
  }

  createUseNotification(item, activity, actor, selectedSpellLevel, useRangeBoundary = true) {
    // Deliberately no setState here: a use notification draws a label, it does not run a target
    // flow, and useItemWorkflow() refuses to start while the helper is above IDLE — so leaving it
    // IDLE is what lets the next item be used. (This previously read setState('TARGETTING'), a
    // key that does not exist in STATES, and clearData() reset it to IDLE on the next line
    // regardless.) clearData() also already broadcasts clearAllPhantomLines for this actorId.
    // Taken over before clearData() tears the old combo down. When this notification follows a
    // targeting flow for the same item, the icon and label it would build are identical to the
    // ones already floating over the token, so they are carried across instead of being
    // destroyed and immediately rebuilt (which read as the icon blinking on target confirmation).
    const decorationKey = TargetHelper.decorationKey(item, selectedSpellLevel)
    const adopt = this.detachMatchingDecorations(decorationKey)

    this.clearData()
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
      decorationKey,
      adopt,
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
  /** What the floating icon and label depict. Two combos sharing this can share decorations. */
  static decorationKey(item, selectedSpellLevel) {
    return [item?.img, item?.name, item?.type, item?.rarity, selectedSpellLevel ?? ''].join('|')
  }

  /**
   * Take the icon and label off whichever live combo owns them, if they depict the same thing
   * the caller is about to draw. Returns null when there is nothing reusable, in which case the
   * new combo builds its own as before.
   */
  detachMatchingDecorations(decorationKey) {
    if (!decorationKey) return null
    const owner = [this.currentLine, ...this.targetLines].find(
      (line) => line?.firstLine && line.decorationKey === decorationKey && line.hasDecorations(),
    )
    return owner ? owner.detachDecorations() : null
  }

  clearUseNotification() {
    this.setState('IDLE')
    this.clearData()
  }
  createRangeBoundary(range, actor) {
    this.setActor(actor)
    this.destroyRangeBoundary()
    this.rangeBoundary = new TargetLineCombo({
      useLines: false,
      sendIcon: false,
      // Nothing to label on a bare range box; without this the combo built a PIXI.Text that
      // immediately bailed out of its own setup and was left parented to the stage.
      sendName: false,
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
    // destroyLines() as well as clearRangeBoundary(): the combo owns a label and (before the
    // useLines fix) line graphics too, and clearing only the box orphaned the rest on the stage
    // once per ranged-item hover.
    this.rangeBoundary?.clearRangeBoundary()
    this.rangeBoundary?.destroyLines()
    this.rangeBoundary = null
  }

  clearData() {
    this.setState('IDLE')
    this.actor = null
    this.token = null
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
    this.deleteTargetingMessage()
    this.stopLineTracking()
  }

  targetingChatMessageEnabled() {
    return game.settings.get('auto-action-tray', 'enableTargetingChatMessage')
  }

  buildTargetingMessageContent() {
    const prefix = this.item?.type === 'spell' ? 'casting' : 'using'
    const progress =
      this.activityTargetCount > 0 ? (this.targets.length / this.activityTargetCount) * 100 : 0
    const targetList = this.targets
      .map((token) => {
        const name = TargetHelper.escapeHtml(token.name ?? token.actor?.name ?? 'Unknown')
        const img = token.document?.texture?.src ?? token.actor?.img ?? ''
        return `<li><img src="${img}" alt="" />${name}</li>`
      })
      .join('')
    return `
      <div class="aat-targeting-message">
        <div class="aat-targeting-message-header">
          <img src="${this.item?.img}" alt="${TargetHelper.escapeHtml(this.item?.name)}" />
          <div class="aat-targeting-message-text">
            <strong>${TargetHelper.escapeHtml(this.actor?.name)}</strong> is ${prefix}
            <strong>${TargetHelper.escapeHtml(this.item?.name)}</strong>
          </div>
        </div>
        <div class="aat-targeting-message-progress">
          <div class="aat-targeting-message-progress-bar" style="width: ${progress}%"></div>
        </div>
        <div class="aat-targeting-message-count">
          ${this.targets.length} / ${this.activityTargetCount} targets selected
        </div>
        ${targetList ? `<ul class="aat-targeting-message-targets">${targetList}</ul>` : ''}
      </div>
    `
  }

  static escapeHtml(value) {
    const chars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return String(value ?? '').replace(/[&<>"']/g, (char) => chars[char])
  }

  async createTargetingMessage() {
    if (!this.targetingChatMessageEnabled()) return
    this.chatMessage = await ChatMessage.create({
      content: this.buildTargetingMessageContent(),
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    })
  }

  async updateTargetingMessage() {
    if (!this.chatMessage || !this.targetingChatMessageEnabled()) return
    await this.chatMessage.update({ content: this.buildTargetingMessageContent() })
  }

  async deleteTargetingMessage() {
    if (!this.chatMessage) return
    const message = this.chatMessage
    this.chatMessage = null
    try {
      await message.delete()
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
    // clearData() broadcasts clearAllPhantomLines for the outgoing actorId; the duplicate that
    // used to follow it here was the same message with the same (still pre-setData) id.
    this.clearData()
    this.setState('TARGETING')
    this.setSingleRoll(singleRoll)
    this.setData(actor, activity)
    this.activityRange = this.getActivityRange(item, activity)
    this.activityTargetCount = targetCount
    this.gridSize = game.canvas.scene.grid.size

    UseTrace.step('range', 'Range resolved', {
      squares: this.activityRange,
      sceneUnits: canvas?.grid?.units ?? null,
      scenePerSquare: canvas?.grid?.distance ?? null,
      itemRangeUnits: activity?.activity?.range?.units ?? item?.item?.system?.range?.units ?? null,
    })

    let prefix = item.type === 'spell' ? 'Casting ' : 'Using '
    this.label = `${prefix} ${item.name}...   `
    if (animate) {
      this.hotbar.animationHandler.pushTray('target-helper')
    }
    this.createTargetingMessage()

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
      // Lets the use notification that follows confirmation adopt this icon and label rather
      // than rebuilding identical ones.
      decorationKey: TargetHelper.decorationKey(item, selectedSpellLevel),
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
    this.startLineTracking()

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
      // newTargetLine() already broadcasts newPhantomLine for the line it creates. The second
      // broadcast that used to sit here re-sent the *same* id, so every remote client built a
      // duplicate combo that find() could never return: never drawn, never destroyed, and —
      // because it omitted `firstLine` — carrying a label and an icon sprite with an infinite
      // tween. One orphan per target selected, for the rest of the session.
      this.newTargetLine()
      this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
      this.updateTargetingMessage()
    } else {
      this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
      this.updateTargetingMessage()
      // Set IDLE and drop the mousemove listener now so the pause below holds the completed
      // state on screen (line anchored on the last target) instead of it tracking the cursor
      // or letting another click sneak in a target before confirmTargets() runs.
      this.setState('IDLE')
      this.stopLineTracking()
      setTimeout(() => this.confirmTargets(), this.finalTargetPause)
    }
  }

  confirmTargets() {
    this.setState('IDLE')
    this.stopLineTracking()
    this.deleteTargetingMessage()
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

    const line = this.currentLine
    const actorId = this.actorId
    setTimeout(() => {
      // getState(), not `this.state`: the public property was only ever assigned the return of
      // setState() (undefined), so this guard never fired and the deferred cleanup would tear
      // down whatever targeting had started in the meantime. The line and actor are captured for
      // the same reason — by now `this.currentLine` may belong to a newer action.
      if (this.getState() >= this.STATES.TARGETING) return
      line?.destroyLines()
      this.clearTargetLines()
      if (this.sendTargetLines) {
        // Covers the line above as well, so no separate destroyPhantomLine is needed.
        this.socket.executeForOthers('clearAllPhantomLines', actorId)
      }
    }, 3000)
  }

  increaseTargetCount() {
    if (this.targets.length >= this.activityTargetCount) return
    this.activityTargetCount++
    this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
    this.updateTargetingMessage()
  }
  decreaseTargetCount() {
    if (this.activityTargetCount <= 1) return
    this.activityTargetCount--
    this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
    if (this.targets.length == this.activityTargetCount) {
      this.confirmTargets()
    } else {
      this.updateTargetingMessage()
    }
  }

  removeTarget() {
    if (this.targets.length == 0) {
      const canvas = document.getElementById('board')
      canvas.style.cursor = ''
      this.setState('IDLE')
      this.stopLineTracking()
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
          this.targetLines.at(-1)?.itemImg,
        )
      }
      this.targetLines.at(-1)?.destroyLines()
      this.targetLines.pop()
    }
    this.currentLine.setText(`   ${this.targets.length}/${this.activityTargetCount}   `)
    this.updateTargetingMessage()
  }

  static cancelSelection(event, target, animate = true) {
    const helper = this?.targetHelper
    const animation = this?.animationHandler
    helper?.setState('IDLE')
    // `this` is the hotbar here, not the helper — this used to pass `undefined` as the listener
    // and remove nothing. clearData() below reaches the real handler either way.
    helper?.stopLineTracking()
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
    this.targetLines.forEach((lineCombo) => lineCombo?.destroyLines())
    this.targetLines = []
    this.currentLine?.destroyLines()
  }
  clearRangeBoundary() {
    this.targetLines.forEach((lineCombo) => lineCombo?.clearRangeBoundary())
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
    // in-range state is tracked per line on the receiving end, so the new line needs its first
    // value sent even if it matches what the previous line last reported.
    this.lastSentInRange = null
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
    return TargetHelper.getPositionFromToken(actor.getActiveTokens()[0])
  }

  static getLinePositionFromActor(actor) {
    return TargetHelper.getLinePositionFromToken(actor.getActiveTokens()[0])
  }

  static getPositionFromToken(token) {
    return token?.getCenterPoint()
  }

  static getLinePositionFromToken(token) {
    if (!token) return undefined
    const pos = token.getCenterPoint()
    return {
      x: pos.x,
      y: pos.y - token.h / 4,
    }
  }

  // Records the cursor only. All drawing happens in _onLineTick, so a fast mouse costs one object
  // write per event instead of a full redraw plus two socket broadcasts.
  _onMouseMove(event) {
    if (
      event.target.closest('#auto-action-tray') &&
      !event.target.closest('.effect-tray-container') &&
      event.target.checkVisibility()
    )
      if (this.getState() <= this.STATES.IDLE) {
        this.stopLineTracking()
        return
      }
    this.cursorScreen = { x: event.clientX, y: event.clientY }
  }

  startLineTracking() {
    this.stopLineTracking()
    this.cursorScreen = null
    this.lastSentInRange = null

    this.mouseMoveHandler = (event) => this._onMouseMove(event)
    document.addEventListener('mousemove', this.mouseMoveHandler)

    this.broadcastLine = foundry.utils.throttle((id, endPos, inRange) => {
      // inRange flips a handful of times per action; it used to be broadcast on every sample,
      // which was half of all target-line traffic.
      if (inRange !== this.lastSentInRange) {
        this.lastSentInRange = inRange
        this.socket.executeForOthers('setPhantomInRange', id, inRange)
      }
      this.socket.executeForOthers('drawPhantomLine', id, endPos)
    }, this.throttleSpeed)

    this.lineTick = () => this._onLineTick()
    canvas.app.ticker.add(this.lineTick)
  }

  stopLineTracking() {
    if (this.lineTick) {
      canvas.app?.ticker.remove(this.lineTick)
      this.lineTick = null
    }
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      this.mouseMoveHandler = null
    }
    this.cursorScreen = null
  }

  _onLineTick() {
    if (!this.cursorScreen || !this.currentLine || !canvas?.ready) return
    if (this.getState() <= this.STATES.IDLE) return

    // Converted per tick rather than per mousemove so the line also follows canvas pan and zoom
    // while the mouse is still.
    const endPos = TargetHelper.getCursorCoordinates(this.cursorScreen)
    const last = this.currentLine.lastPos
    if (last && last.x === endPos.x && last.y === endPos.y) return

    const inRange = this.checkInRange(endPos, this.activityRange)
    this.currentLine.setInRange(inRange)
    this.currentLine.drawLines(endPos)
    if (this.sendTargetLines) {
      this.broadcastLine(this.currentLine.id, endPos, inRange)
    }
  }

  static getCursorCoordinates(point) {
    const stage = canvas.app.stage
    const t = stage.worldTransform
    return {
      x: (point.x - t.tx) / stage.scale.x,
      y: (point.y - t.ty) / stage.scale.y,
    }
  }

  // Chebyshev distance from the token's occupied box to the cursor, in grid squares.
  //
  // `token.w`/`token.h`, not `token.shape.width`/`.height`: on any gridded scene Token#getShape()
  // returns a PIXI.Polygon, which carries only `points` — so those reads were undefined, making
  // `token.x + undefined` NaN. Both `NaN > range` comparisons are false, so the function fell
  // through to `return true` and reported *every* point in range. Out-of-range colouring could
  // only ever have worked on a gridless scene, where getShape() returns a Rectangle.
  //
  // The per-axis distance is also clamped at 0 now. Taking the nearest of the two edges meant a
  // cursor inside the token measured as half its width away instead of zero.
  checkInRange(endPos, range) {
    const token = this.token
    if (!token) return false
    if (range <= 0) return true
    const dx = Math.max(0, token.x - endPos.x, endPos.x - (token.x + token.w)) / this.gridSize
    const dy = Math.max(0, token.y - endPos.y, endPos.y - (token.y + token.h)) / this.gridSize
    if (dx > range || dy > range) return false
    return true
  }

  // Returns the range in grid squares, or the sentinels 0 (none) / -1 (self), which callers
  // treat as "no boundary". Scene units and distance-per-square are both read from the canvas
  // rather than assumed: dnd5e stamps new scenes with metric grids when the metric length
  // setting is on (see its preCreateScene hook), so a 5ft-per-square world is only the default,
  // not a guarantee. The item's own range units are independent of the scene's and are
  // converted first.
  getActivityRange(item, activity) {
    if (!activity) {
      activity = item.defaultActivity
    }
    item = item?.item
    // An item with no activities has no range to draw.
    if (!item || !activity) return 0

    // Callers pass the AATActivity wrapper, which holds the dnd5e activity on `.activity`. The
    // range lives on the activity in current dnd5e, so unwrap before reading it — otherwise every
    // lookup below fell through to the item, which for spells often carries no range at all.
    const act = activity.activity ?? activity

    const gridUnits = canvas?.grid?.units || 'ft'
    const touch = (units) => TargetHelper.convertLength(5, 'ft', units ?? gridUnits)

    let range =
      act.range?.value ??
      item.system.range?.value ??
      act.range?.reach ??
      item.system.range?.reach ??
      (act.range?.units === 'touch'
        ? touch(act.range?.units)
        : act.range?.units === 'self'
          ? -1
          : null) ??
      (item.system.range?.units === 'touch'
        ? touch(item.system.range?.units)
        : item.system.range?.units === 'self'
          ? -1
          : 0)

    if (!(range > 0)) return range

    // Units are taken with the same precedence the value was, so a value read off the item is
    // measured with the item's units.
    const rangeUnits = act.range?.units ?? item.system.range?.units ?? gridUnits
    const inGridUnits = TargetHelper.convertLength(range, rangeUnits, gridUnits)

    // Gridless scenes report a distance of 0; dividing by it would yield Infinity and paint an
    // unbounded range circle, so fall back to leaving the value in scene units.
    const perSquare = canvas?.grid?.distance
    return perSquare > 0 ? inGridUnits / perSquare : inGridUnits
  }

  // dnd5e owns the unit table, so conversion defers to it. Non-linear units ('touch', 'self',
  // 'spec', 'any') aren't lengths and are returned untouched, as is anything dnd5e can't map.
  static convertLength(value, from, to) {
    if (!Number.isFinite(value)) return value
    if (!from || !to || from === to) return value
    try {
      const converted = dnd5e.utils.convertLength(value, from, to, { strict: false })
      return Number.isFinite(converted) ? converted : value
    } catch (e) {
      return value
    }
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

      let act = item.activities.find((e) => e.id == activity.id) ?? activity

      // A spell cast at a level with no matching scaled tooltip used to throw here and take the
      // whole use with it, so the level-specific count falls back to the activity's base count.
      const scaled = act?.tooltips?.find((e) => e.spellLevel == spellLevel)
      if (!scaled) {
        UseTrace.warn(
          'targetCountLevel',
          'No target count for the chosen spell level',
          { spellLevel, activity: act?.name ?? null },
          'The activity has no tooltip for this level, so the base target count is used instead.',
        )
      }
      targetCount = scaled?.targetCount || act?.tooltip?.targetCount
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
    if (!this.receiveTargetLines && options.phantom) return
    return this.templateBoundary?.createBoundary(options)
  }

  updateTemplateBoundary(template) {
    this.templateBoundary?.updateBoundary(template)
  }

  destroyTemplateBoundary(template) {
    this.templateBoundary?.destroyBoundary(template)
  }
}
