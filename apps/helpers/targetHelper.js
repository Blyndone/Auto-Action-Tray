import { DamageCalc } from './damageCalc.js'
import { TargetLineCombo } from './targetLineCombo.js'

export class TargetHelper {
  constructor(options) {
    this.socket = options.socket
    this.hotbar = options.hotbar
    this.socket.register('newPhantomLine', this.newPhantomLine.bind(this))
    this.socket.register('drawPhantomLine', this.drawPhantomLine.bind(this))
    this.socket.register('clearPhantomLine', this.clearPhantomLine.bind(this))
    this.socket.register('clearAllPhantomLines', this.clearAllPhantomLines.bind(this))
    this.socket.register('setPhantomInRange', this.setPhantomInRange.bind(this))
    this.socket.register('destroyPhantomLine', this.destroyPhantomLine.bind(this))
    this.socket.register('setPhantomYOffset', this.setPhantomYOffset.bind(this))

    this.stage = canvas.stage
    this.activity = null
    this.activityRange = 0
    this.activityTargetCount = 3
    this.actor = null
    this.targets = []
    this.targetLines = []
    this.phantomLines = []
    this.currentLine = null
    this.startPos
    this.selectingTargets = false
    this.mouseMoveHandler = null
    this.selectedTargets = null
    this.rejectTargets = null
    this.throttleSpeed = 50
    this.gridSize = game.canvas.scene.grid.size
  }

  setActor(actor) {
    this.actor = actor
    this.startPos = TargetHelper.getPositionFromActor(actor)
  }
  setActivity(activity) {
    this.activity = activity
  }
  setData(actor, activity) {
    this.setActor(actor)
    this.setActivity(activity)
  }

  newPhantomLine(id, actorId, startPos, color) {
    let line = new TargetLineCombo({
      startPos: startPos,
      actorId: actorId,
      phantom: true,
      id: id,
      color: color,
    })
    this.phantomLines.push(line)
    return line
  }
  drawPhantomLine(id, endPos) {
    let line = this.phantomLines.find((line) => line.id == id)
    line.drawLines(endPos)
  }
  setPhantomInRange(id, inRange) {
    let line = this.phantomLines.find((line) => line.id == id)
    line.setInRange(inRange)
  }

  setPhantomYOffset(id, yOffset) {
    let line = this.phantomLines.find((line) => line.id == id)
    line.setYOffset(yOffset)
  }

  clearPhantomLine(id) {
    let line = this.phantomLines.find((line) => line.id == id)
    line.clearLines()
  }
  destroyPhantomLine(id) {
    let line = this.phantomLines.find((line) => line.id == id)
    line.destroyLines()
  }
  clearAllPhantomLines(actorId) {
    this.phantomLines = this.phantomLines.filter((line) => {
      if (line.actorId === actorId) {
        line.destroyLines()
        return false
      }
      return true
    })
  }

  clearData() {
    this.actor = null
    this.item = null
    this.targets = []
    this.clearTargetLines()

    this.socket.executeForOthers('clearAllPhantomLines', this.actorId)
    this.targetLines = []
    this.itemRange = 0
    this.itemTargetCount = 0
    try {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
    } catch (error) {}
  }

  async requestTargets(item, activity, actor, targetCount) {
    this.clearData()
    this.socket.executeForOthers('clearAllPhantomLines', this.actorId)
    this.setData(actor, activity)
    this.activityRange = this.getActivityRange(item, activity)
    this.activityTargetCount = targetCount
    this.gridSize = game.canvas.scene.grid.size
    this.selectingTargets = true
    game.user.updateTokenTargets([])
    this.currentLine = new TargetLineCombo({ startPos: this.startPos, actorId: actor.id })
    this.socket.executeForOthers(
      'newPhantomLine',
      this.currentLine.id,
      this.actorId,
      this.startPos,
      this.currentLine.color,
    )
    this.currentLine.setText(`${this.targets.length}/${this.activityTargetCount}`)
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
      console.log('AAT - Target selection canceled')
      targets = null
    }
  }

  selectTarget(token) {
    if (this.targets.length == 0) {
      token.setTarget(true, { releaseOthers: false })
    }
    this.targets.push(token)
    token.setTarget(true, { releaseOthers: false })
    this.setTargetLine(token)

    if (this.targets.length < this.activityTargetCount) {
      this.newTargetLine()
      this.socket.executeForOthers(
        'newPhantomLine',
        this.currentLine.id,
        this.actorId,
        this.startPos,
        this.currentLine.color,
      )
      this.currentLine.setText(`${this.targets.length}/${this.activityTargetCount}`)
    } else {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      // this.currentLine.setText(`${this.targets.length}/${this.activityTargetCount}`)
      this.selectingTargets = false
      this.selectedTargets({ targets: this.targets, individual: true })
      this.currentLine.clearText()

      setTimeout(() => {
        if (this.selectingTargets) return
        this.currentLine.destroyLines()
        this.socket.executeForOthers('destroyPhantomLine', this.currentLine.id)
        this.clearTargetLines()
        this.socket.executeForOthers('clearAllPhantomLines', this.actorId)
      }, 3000)
    }
  }

  removeTarget() {
    if (this.targets.length == 0) {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      this.rejectTargets(new Error('No targets to remove'))
      this.currentLine.clearLines()
      this.clearData()
      this.selectingTargets = false
      return
    }
    let token = this.targets.pop()
    token.setTarget(false, { releaseOthers: false })
    if (this.targetLines.length > 0) {
      this.socket.executeForOthers('destroyPhantomLine', this.targetLines.at(-1)?.id)
      this.targetLines.at(-1)?.destroyLines()
      this.targetLines.pop()
    }
    this.currentLine.setText(`${this.targets.length}/${this.activityTargetCount}`)
  }

  static cancelSelection(event, target) {
    this.rejectTargets(new Error('User canceled Target selection'))
    this.activityTray.rejectActivity = null
  }

  clearTargetLines() {
    try {
      this.targetLines.forEach((lineCombo) => lineCombo.destroyLines())
      this.targetLines = []
      this.currentLine.destroyLines()
    } catch (error) {}
  }
  newTargetLine() {
    let endPos = this.startPos
    if (this.currentLine) {
      endPos = this.currentLine.lastPos
    }
    this.currentLine = new TargetLineCombo({ startPos: this.startPos, actorId: this.actor.id })
    this.socket.executeForOthers(
      'newPhantomLine',
      this.currentLine.id,
      this.actorId,
      this.startPos,
      this.currentLine.color,
    )

    this.currentLine.setText(`${this.targets.length}/${this.activityTargetCount}`)
    this.currentLine.drawLines(endPos)
    this.socket.executeForOthers('drawPhantomLine', this.currentLine.id, endPos)
  }
  setTargetLine(token) {
    let lastPos = this.currentLine.lastPos
    let endPos = TargetHelper.getPositionFromActor(token.actor)
    this.targetLines.push(this.currentLine)
    let offset = this.targets.filter((t) => t.id == token.id).length - 1
    this.currentLine.setYOffset(offset)
    this.currentLine.drawLines(endPos)
    this.socket.executeForOthers('setPhantomYOffset', this.currentLine.id, offset)
    this.socket.executeForOthers('drawPhantomLine', this.currentLine.id, endPos)
    this.currentLine.lastPos = lastPos
    this.currentLine.clearText()
  }

  moveText(endPos) {
    this.currentLine.moveText(endPos)
  }

  static getPositionFromActor(actor) {
    let token = actor.getActiveTokens()[0]
    const pos = token.getCenterPoint()

    pos.y -= token.shape.height / 4
    return pos
  }

  async _onMouseMove(event) {
    if (!this.selectingTargets) return
    let endPos = await TargetHelper.getCursorCoordinates(event)
    this.currentLine.setInRange(this.checkInRange(this.actor, endPos, this.activityRange))
    this.currentLine.drawLines(endPos)
    this.socket.executeForOthers('setPhantomInRange', this.currentLine.id, this.currentLine.inRange)
    this.socket.executeForOthers('drawPhantomLine', this.currentLine.id, endPos)

    // this.socket.executeForOthers('phantom', this.startPos, endPos)
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
      activity = item.system.activities.contents[0]
    }
    let range =
      activity.range?.value ??
      activity.range?.reach ??
      (activity.range?.units === 'touch' ? 5 : activity.range?.units === 'self' ? -1 : 0)
    return range > 0 ? range / 5 : range
  }

  getTargetCount(item, activity, selectedSpellLevel) {
    if (!activity) {
      activity = item.system.activities.contents[0]
    }
    let slotLevel
    if (activity.itemId) {
      slotLevel = parseInt(activity.selectedSpellLevel)
      activity = item.system.activities.get(activity.itemId)
    }

    if (DamageCalc.checkOverride(item)) {
      let targetCount = DamageCalc.getOverrideScaling(
        item,
        slotLevel ||selectedSpellLevel,
        DamageCalc.getOverrideDamageParts(item),
      )
      return targetCount + 1
    }

    switch (true) {
      case item.type == 'weapon' && activity.type == 'attack':
        return 1

      case item.type == 'spell' && item.hasIndividualTarget == 'creature':
        return activity.target?.affects?.count || 1

      case activity?.target.template?.count > 0:
        return 0
      case activity?.target?.affects?.type == 'self':
        return 0
      default:
        return activity?.target?.affect?.count || 1
    }
  }
}
