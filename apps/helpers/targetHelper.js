import { DamageCalc } from './damageCalc.js'

export class TargetHelper {
  constructor() {
    this.stage = canvas.stage
    this.color = 0xffff00
    this.glowColor = 0xff0000
    this.activity = null
    this.activityRange = 0
    this.activityTargetCount = 3
    this.actor = null
    this.targets = []
    this.targetLines = []
    this.targetGlowLines = []
    this.currentLine = null
    this.currentGlowLine = null
    this.targetText
    this.startPos
    this.selectingTargets = false
    this.mouseMoveHandler = null
    this.selectedTargets = null
    this.rejectTargets = null
  }

  setActor(actor) {
    this.actor = actor
    this.startPos = TargetHelper.getPositionFromActor(actor)
  }
  setActivity(activity) {
    this.activity = activity
  }
  clearData() {
    this.actor = null
    this.item = null
    this.targets = []
    this.targetLines = []
    this.targetGlowLines = []
    this.targetText = null
    this.itemRange = 0
    this.itemTargetCount = 0
    try {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
    } catch (error) {}
  }
  setData(actor, activity) {
    this.setActor(actor)
    this.setActivity(activity)
  }

  selectTarget(token) {
    if (this.targets.length == 0) {
      token.setTarget(true, { releaseOthers: false })
    }
    this.targets.push(token)
    token.setTarget(true, { releaseOthers: false })
    this.setTargetLine(token)

    if (this.targets.length < this.activityTargetCount) {
      this.targetText.text = `${this.targets.length}/${this.activityTargetCount}`

      this.newTargetLine()
    } else {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      this.targetText.text = `${this.targets.length}/${this.activityTargetCount}`
      this.selectingTargets = false
      this.selectedTargets({ targets: this.targets, individual: true })
      this.targetText.destroy()

      setTimeout(() => {
        if (this.selectingTargets) return
        this.currentLine.clear()
        this.currentGlowLine.clear()
        this.targets = []
        this.clearTargetLines()
      }, 3000)
    }
  }

  removeTarget() {
    if (this.targets.length == 0) {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      this.rejectTargets(new Error('No targets to remove'))
      this.currentLine.clear()
      this.currentGlowLine.clear()
      this.clearTargetLines()
      this.clearData()
      this.selectingTargets = false
      return
    }
    let token = this.targets.pop()
    token.setTarget(false, { releaseOthers: false })
    if (this.targetLines.length > 1) {
      this.targetLines.at(-2)?.clear()
      this.targetLines.splice(-2, 1)
    }

    if (this.targetGlowLines.length > 1) {
      this.targetGlowLines.at(-2)?.clear()
      this.targetGlowLines.splice(-2, 1)
    }

    this.targetText.destroy()
    this.newTargetText()
  }

  newTargetLine() {
    this.currentLine = new PIXI.Graphics()
    this.currentGlowLine = new PIXI.Graphics()
    canvas.app.stage.addChild(this.currentLine)
    canvas.app.stage.addChild(this.currentGlowLine)
    this.targetLines.push(this.currentLine)
    this.targetGlowLines.push(this.currentGlowLine)
  }
  setTargetLine(token) {
    let endPos = TargetHelper.getPositionFromActor(token.actor)
    this.drawCurve(this.currentLine, endPos)
    this.drawCurve(this.currentGlowLine, endPos)
  }
  newTargetText() {
    this.targetText = new PIXI.Text(`${this.targets.length}/${this.activityTargetCount}`, {
      fontFamily: 'Arial',
      fontSize: 20,
      fill: 0xffffff,
    })
  }
  clearTargetLines() {
    try {
      this.targetLines ? this.targetLines.forEach((line) => line.clear()) : null
      this.targetGlowLines ? this.targetGlowLines.forEach((line) => line.clear()) : null
      this.targetText ? this.targetText.destroy() : null
    } catch (error) {}
  }

  drawCurve(line, endPos) {
    line.clear()
    let midpoint1 = {
      x: this.startPos.x + (endPos.x - this.startPos.x) / 3,
      y: this.startPos.y - 200,
    }
    let midpoint2 = {
      x: endPos.x - (endPos.x - this.startPos.x) / 3,
      y: endPos.y - 200,
    }
    if (line == this.currentGlowLine) {
      line.lineStyle(3, this.glowColor, 1)
    } else {
      line.lineStyle(2, this.color, 1)
    }
    line.moveTo(this.startPos.x, this.startPos.y) // Set a starting point
    line.bezierCurveTo(midpoint1.x, midpoint1.y, midpoint2.x, midpoint2.y, endPos.x, endPos.y)
    if (line == this.currentGlowLine) {
      gsap.set(line, {
        pixi: { blur: 10, alpha: 0.8, saturation: 3 },
      })
    } else {
      gsap.set(line, {
        pixi: { blur: 1, alpha: 1 },
      })
    }
  }

  moveText(endPos) {
    this.targetText.position.set(endPos.x + 10, endPos.y + 10)
    canvas.app.stage.addChild(this.targetText)
  }

  async requestTargets(item, activity, actor, targetCount) {
    this.clearTargetLines()
    this.clearData()
    this.setData(actor, activity)
    let activityData = this.getActivityData(item, activity)
    this.activityRange = activityData.range
    this.activityTargetCount = targetCount || 1

    this.selectingTargets = true
    game.user.updateTokenTargets([])
    this.newTargetLine()
    this.newTargetText()

    this.mouseMoveHandler = async (event) => {
      let endPos = await TargetHelper.getCursorCoordinates(event)
      this.drawCurve(this.currentLine, endPos)
      this.drawCurve(this.currentGlowLine, endPos)
      this.moveText(endPos)
    }

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

  static getPositionFromActor(actor) {
    let token = actor.getActiveTokens()[0]
    const pos = token.getCenterPoint()

    pos.y -= token.shape.height / 4
    return pos
  }

  /**
   * @description Executes callback function for a (left-)click event
   * @param {event} onClickEvent
   * @returns {object} returns data object with x and y canvas coordinates, scaled to canvas size
   */
  static async getCursorCoordinates(onClickEvent) {
    const [x, y] = [onClickEvent.clientX, onClickEvent.clientY]
    const t = canvas.app.stage.worldTransform

    return {
      x: (x - t.tx) / canvas.app.stage.scale.x,
      y: (y - t.ty) / canvas.app.stage.scale.y,
    }
  }

  getActivityData(item, activity) {
    if (!activity) {
      activity = item.system.activities.contents[0]
    }
    let range = item.system.activities.get(activity.itemId)?.range?.value || -1
    let targetCount = item.system.activities.get(activity.itemId)?.target?.affect?.count || 1

    return {
      range: range,
      targetCount: targetCount,
    }
  }

  static cancelSelection(event, target) {
    this.rejectTargets(new Error('User canceled Target selection'))
    this.activityTray.rejectActivity = null
  }

  static checkTargetCount(item, activity, spellLevel) {
    let targetCount


    if (DamageCalc.checkOverride(item)) {
      let castLevel = spellLevel.slot == 'pact' ? 0 : parseInt(spellLevel.slot.replace('spell', ''))
      targetCount = DamageCalc.getOverrideScaling(
        item,
        castLevel,
        DamageCalc.getOverrideDamageParts(item),
      ).length
      return targetCount
    }

    switch (true) {
      case item.type == 'weapon' &&
        (item.system.activities.contents[0].type == 'attack' ||
          item.system.activities.get(activity.itemId)?.type == 'attack'):
        return 1

      case item.type == 'spell' && item.hasIndividualTarget == 'creature':
        targetCount = item.system.activities?.get(activity.itemId)?.target?.affect?.count || 1
        return targetCount
    }

    return -1
  }
}
