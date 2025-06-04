export class TargetLineCombo {
  constructor(options) {
    this.yOffset = options.yOffset || 0
    this.phantom = options.phantom || false
    this.id = options.id || foundry.utils.randomID()
    this.actorId = options.actorId
    this.line = new TargetLine({
      ...options,
      yOffset: this.yOffset,
    })
    this.glowLine = new GlowLine({
      ...options,
      yOffset: this.yOffset,
    })
    this.text = !this.phantom ? new TargetText(options) : null
    this.firstLine = options.firstLine !== undefined ? options.firstLine : true
    this.targettingText = this.firstLine ? new TargettingText(options) : null
    this.itemImg = this.firstLine ? new ItemImage(options, this.targettingText) : null
    this.rangeBoundary = this.firstLine ? new TargetBoundary(options) : null
    this.startPos = options.startPos
    this.startLinePos = options.startLinePos
    this.lastPos = options.startPos
    this.color = options.color || game.user.color.css || 0xffff00
    this.activityRange = options.activityRange || 0
    this.inRange = true
  }

  clearLines() {
    this.line.clear()
    this.glowLine.clear()
    this.firstLine ? this.targettingText.clear() : null
    this.firstLine ? this.rangeBoundary.clear() : null
    this.firstLine ? this.itemImg.clear() : null
    if (!this.phantom) {
      this.clearText()
    }
  }
  clearRangeBoundary() {
    this.rangeBoundary.clear()
  }
  destroyLines() {
    this.line.destroy()
    this.glowLine.destroy()
    this.firstLine ? this.targettingText.clear() : null
    this.firstLine ? this.rangeBoundary.clear() : null
    this.firstLine ? this.itemImg.clear() : null
    if (!this.phantom) {
      this.clearText()
    }
  }
  forceDestroyLines() {
    this.line.forceDestroy()
    this.glowLine.forceDestroy()
    this.firstLine ? this.targettingText.clear() : null
    this.firstLine ? this.rangeBoundary.clear() : null
    this.firstLine ? this.itemImg.clear() : null
    if (!this.phantom) {
      this.clearText()
    }
  }

  drawLines(endPos) {
    this.line.drawLine(endPos)
    this.glowLine.drawLine(endPos)
    if (!this.phantom) {
      this.text.moveText(endPos)
    }
    this.lastPos = endPos
  }
  setText(newText) {
    if (this.phantom) return
    this.text.setText(newText)
  }
  setTargetingText(pos, itemType, itemName) {
    this.targettingText.setTargetingText(pos, itemType, itemName)
  }
  setFirstLine(firstLine) {
    this.firstLine = firstLine
  }
  transferBoundaryAndText(targettingText, rangeBoundary) {
    this.targettingText = targettingText
    this.rangeBoundary = rangeBoundary
  }
  moveText(endPos) {
    if (this.phantom) return
    this.text.moveText(endPos)
  }
  clearText() {
    if (this.phantom) return
    this.text.clear()
  }
  setInRange(inRange) {
    this.inRange = inRange
    this.line.inRange = inRange
    this.glowLine.inRange = inRange
  }
  setYOffset(yOffset) {
    this.yOffset = yOffset
    this.line.yOffset = yOffset
    this.glowLine.yOffset = yOffset
  }
}
class protoLine {
  constructor(options) {
    this.inRange = true
    this.yOffset = options.yOffset || 0
    this.startPos = options.startPos
    this.startLinePos = options.startLinePos
  }
  destroy() {
    let tween = gsap.to(this.line, {
      pixi: { blur: 0, alpha: 0 },
      duration: 0.5,
      onComplete: function () {
        canvas.app.stage.removeChild(this.line)
        tween.kill()
      }.bind(this),
    })
  }
  forceDestroy() {
    if (this.line) {
      canvas.app.stage.removeChild(this.line)
    }
  }
  clear() {
    this.line.clear()
  }
  drawLine(endPos) {
    this.clear()

    let dx = endPos.x - this.startLinePos.x
    let dy = endPos.y - this.startLinePos.y
    let distance = Math.sqrt(dx * dx + dy * dy)
    let curveHeight = Math.max(50, distance * 0.1)

    let apexY = Math.min(this.startLinePos.y, endPos.y) - curveHeight - this.yOffset * 50

    let midpoint1 = {
      x: this.startLinePos.x + dx / 3,
      y: apexY,
    }

    let midpoint2 = {
      x: this.startLinePos.x + (2 * dx) / 3,
      y: apexY,
    }

    this.line.lineStyle(this.width, this.inRange ? this.color : this.outOfRangeColor, this.alpha)

    this.line.moveTo(this.startLinePos.x, this.startLinePos.y)
    this.line.bezierCurveTo(midpoint1.x, midpoint1.y, midpoint2.x, midpoint2.y, endPos.x, endPos.y)

    gsap.set(this.line, {
      pixi: { blur: this.blur, alpha: this.alpha, saturation: this.saturation },
    })

    canvas.app.stage.addChild(this.line)
  }
}

class protoText {
  constructor(options) {
    this.actorId = options.actorId
    this.color = options.color || game.user.color.css || 0xffff00
    this.text = new PIXI.Text('')
    this.text.eventMode = 'none'
    this.text.zIndex = 1

    this.alpha = options.alpha || 1
    canvas.app.stage.addChild(this.text)
  }
  clear() {
    if (this.text) {
      this.text.destroy()
      this.text = null
    }
  }
  setText(newText) {
    if (this.text) {
      this.text.text = newText
    }
  }
}

class ItemImage {
  constructor(options, targettingText) {
    this.actorId = options.actorId
    this.targettingText = targettingText
    this.color = this.getRarityColor(options.itemRarity, options.itemSpellLevel)
    this.pos = options.startPos || { x: 0, y: 0 }
    this.alpha = options.alpha || 1
    this.size = options.size || 45
    this.animation
    const actor = game.actors.get(this.actorId)
    this.anchor = (actor.prototypeToken.height * canvas.grid.size) / 2 + 35

    this.img = PIXI.Sprite.from(options.itemImg)
    this.img.anchor.set(0.5)
    this.img.position.set(this.pos.x, this.pos.y - this.anchor)
    this.img.width = this.size
    this.img.height = this.size
    this.img.alpha = this.alpha
    this.img.zIndex = 2
    this.active = true
    this.mask = new PIXI.Graphics()
    this.mask.beginFill(0xffffff)
    this.mask.drawCircle(this.pos.x, this.pos.y - this.anchor, this.size / 2)
    this.mask.endFill()
    this.img.mask = this.mask

    this.border = new PIXI.Graphics()
    this.border.lineStyle(4, this.color)
    this.border.drawCircle(this.pos.x, this.pos.y - this.anchor, this.size / 2)
    this.border.endFill()
    this.border.zIndex = 1

    this.shadow = new PIXI.Graphics()
    this.shadow.lineStyle(4, 0x000000)
    this.shadow.drawCircle(this.pos.x, this.pos.y - this.anchor, this.size / 2)
    this.shadow.endFill()
    this.shadow.filters = [new PIXI.filters.BlurFilter(8)]
    this.shadow.zIndex = 0

    canvas.app.stage.addChild(this.img)
    canvas.app.stage.addChild(this.mask)
    canvas.app.stage.addChild(this.border)
    canvas.app.stage.addChild(this.shadow)

    this.composite = [this.img, this.mask, this.border, this.shadow]

    this.composite.forEach((item) => {
      item.eventMode = 'static'
    })
    this.composite.forEach((item) => {
      item.on('pointerover', () => {
        if (!this.active) return

        this.composite.forEach((i) => gsap.to(i, { alpha: 0.0, duration: 0.3 }))
        gsap.to(this.targettingText.text, { alpha: 0.0, duration: 0.3 })
      })
      item.on('pointerout', () => {
        if (!this.active) return
        this.composite.forEach((i) => gsap.to(i, { alpha: 1, duration: 0.3 }))
        gsap.to(this.targettingText.text, { alpha: 1, duration: 0.3 })
      })
      item.on('pointerdown', (event) => {
        if (!this.active) return
        item.eventMode = 'none'
        let overevent = new MouseEvent('pointerover', event)
        event = new MouseEvent('pointerdown', event)
        game.canvas.app.view.dispatchEvent(overevent)
        game.canvas.app.view.dispatchEvent(event)
        setTimeout(() => (item.eventMode = 'static'), 0)
      })
    })

    if (this.targettingText) {
      this.targettingText.text.eventMode = 'static'
      this.targettingText.text.on('pointerover', () => {
        if (!this.active) return
        this.composite.forEach((i) => gsap.to(i, { alpha: 0.0, duration: 0.3 }))
        gsap.to(this.targettingText.text, { alpha: 0.0, duration: 0.3 })
      })
      this.targettingText.text.on('pointerout', () => {
        if (!this.active) return
        this.composite.forEach((i) => gsap.to(i, { alpha: 1, duration: 0.3 }))
        gsap.to(this.targettingText.text, { alpha: 1, duration: 0.3 })
      })
      this.targettingText.text.on('pointerdown', (event) => {
        if (!this.active) return
        this.targettingText.text.eventMode = 'none'
        let overevent = new MouseEvent('pointerover', event)
        event = new MouseEvent('pointerdown', event)
        game.canvas.app.view.dispatchEvent(overevent)
        game.canvas.app.view.dispatchEvent(event)
        setTimeout(() => (this.targettingText.text.eventMode = 'static'), 0)
      })
    }

    this.animation = gsap.to(this.composite, {
      y: '+=10',
      duration: 2,
      repeat: -1,
      ease: 'sine.inOut',
      yoyo: true,
    })
  }

  getRarityColor(rarity, selectedSpellLevel) {
    function lerpColor(color1, color2, t) {
      const c1 = PIXI.utils.hex2rgb(PIXI.utils.string2hex(color1))
      const c2 = PIXI.utils.hex2rgb(PIXI.utils.string2hex(color2))
      const blended = c1.map((c, i) => c + (c2[i] - c) * t)
      return PIXI.utils.rgb2hex(blended)
    }

    const colorAnchors = [
      { level: 0, color: '#11cf00' }, // uncommon
      { level: 1, color: '#11cf00' }, // uncommon
      { level: 3, color: '#164cfc' }, // rare
      { level: 5, color: '#a665e4' }, // very rare
      { level: 7, color: '#e29404' }, // legendary
      { level: 9, color: '#c00505' }, // artifact
    ]

    if (selectedSpellLevel?.slot) {
      const slotNum = parseInt(selectedSpellLevel.slot.replace('spell', ''), 10)

      let lower = colorAnchors[0]
      let upper = colorAnchors[colorAnchors.length - 1]

      for (let i = 0; i < colorAnchors.length - 1; i++) {
        if (slotNum >= colorAnchors[i].level && slotNum <= colorAnchors[i + 1].level) {
          lower = colorAnchors[i]
          upper = colorAnchors[i + 1]
          break
        }
      }

      if (slotNum === lower.level) {
        return lower.color
      }

      const t = (slotNum - lower.level) / (upper.level - lower.level)
      const interpolated = lerpColor(lower.color, upper.color, t)
      return PIXI.utils.hex2string(interpolated)
    }

    const fallback = {
      common: '#333333',
      uncommon: '#11cf00',
      rare: '#164cfc',
      veryRare: '#a665e4',
      legendary: '#e29404',
      artifact: '#c00505',
    }

    return fallback[rarity] || '#333333'
  }

  clear() {
    this.active = false
    gsap.killTweensOf(this.composite)
    // gsap.set(this.composite, {
    //   pixi: { blur: 0, alpha: 0 },
    // })

    gsap.to(this.composite, {
      pixi: { alpha: 0 },
      duration: 0.3,
      onComplete: function () {
        this.animation.kill()
        if (this.img || this.mask || this.border || this.shadow) {
          this.img.destroy()
          this.img = null
          this.mask.destroy()
          this.mask = null
          this.border.destroy()
          this.border = null
          this.shadow.destroy()
          this.shadow = null
        }
      }.bind(this),
    })
  }
}

class TargetLine extends protoLine {
  constructor(options) {
    super(options)
    this.line = new PIXI.Graphics()
    this.color = options.color
      ? Color.fromString(options.color).add(Color.fromString('#333333')).css
      : game.user.color.add(Color.fromString('#333333')).css || 0xffff00
    this.outOfRangeColor = Color.fromString(this.color).multiply(0.5) || 0xff0000
    this.blur = options.blur || 1
    this.saturation = options.saturation || 1
    this.width = options.width || 2
    this.alpha = options.alpha || 1
  }
}

class GlowLine extends protoLine {
  constructor(options) {
    super(options)
    this.line = new PIXI.Graphics()
    this.color = options.color || game.user.color.css || 0xff0000
    this.outOfRangeColor = Color.fromString(this.color).multiply(0.5) || 0xff0000
    this.blur = options.blur || 10
    this.saturation = options.saturation || 3
    this.width = options.width || 3
    this.alpha = options.alpha || 0.8
  }
}
class TargettingText extends protoText {
  constructor(options) {
    super(options)
    if (!options.itemName || !options.itemType) {
      return
    }
    this.itemName = options.itemName || 'itemName'
    this.itemType = options.itemType || 'itemType'
    this.itemImg = options.itemImg || ''
    this.startPos = options.startPos
    this.animation
    this.style = new PIXI.TextStyle({
      dropShadow: true,
      dropShadowAlpha: 0.6,
      dropShadowAngle: 0,
      dropShadowBlur: 5,
      dropShadowDistance: 0,
      dropShadowColor: this.color,
      fill: '#ffffff',
      fontFamily: 'Georgia',
      fontSize: 19,
      fontStyle: 'italic',
      strokeThickness: 3,
      resolution: 3,
    })
    this.text.style = this.style
    this.text.resolution = 3
    this.setTargetingText(options.startPos, this.itemType, this.itemName, options.itemSpellLevel)
  }

  clear() {
    if (this.animation) {
      if (this.text) {
        gsap.killTweensOf(this.text)
        gsap.to(this.text, {
          pixi: { blur: 0, alpha: 0 },
          duration: 0.5,
          onComplete: function () {
            this.animation.kill()
            if (this.text) {
              this.text.destroy()
              this.text = null
            }
          }.bind(this),
        })
      }
    }
  }
  setTargetingText(pos, itemType, itemName, spellLevel) {
    let anchor = (game.actors.get(this.actorId).prototypeToken.height * canvas.grid.size) / 2 + 73
    let suffix = ''
    if (spellLevel?.slot && spellLevel.slot !== 'spell0') {
      suffix = ` (Level ${spellLevel.slot.replace(/[a-zA-z]/g, '')})`
    }
    if (this.text) {
      let prefix = itemType === 'spell' ? 'Casting ' : 'Using '

      this.text.text = `   ${prefix} ${itemName}${suffix}...   `
      this.text.anchor.set(0.5, 0.5)
      this.text.position.set(pos.x, pos.y - anchor)

      this.animation = gsap.to(this.text, {
        y: this.text.y + 10,
        duration: 2,
        repeat: -1,
        ease: 'sine.inOut',
        yoyo: true,
      })
    }
  }
}

class TargetText extends protoText {
  constructor(options) {
    super(options)
    this.style = new PIXI.TextStyle({
      dropShadow: true,
      dropShadowAlpha: 0.6,
      dropShadowAngle: 0,
      dropShadowBlur: 5,
      dropShadowDistance: 0,
      dropShadowColor: '#000000',
      fill: '#ffffff',
      fontFamily: 'Georgia',
      fontSize: 25,
      strokeThickness: 3,
      resolution: 3,
    })
    this.text.style = this.style
    this.text.resolution = 3
  }
  moveText(endPos) {
    if (this.text) {
      this.text.position.set(endPos.x + 15, endPos.y - 30)
    }
  }
}

class TargetBoundary {
  constructor(options) {
    this.enabled = game.settings.get('auto-action-tray', 'enableRangeBoundary')
    this.activityRange = options.activityRange || 0
    if (this.enabled && this.activityRange > 0) {
      this.actorId = options.actorId
      this.startPos = options.startPos
      this.color = options.color || game.user.color.css || 0xffff00
      this.box = new PIXI.Graphics()
      this.alpha = options.alpha || 1
      canvas.app.stage.addChild(this.box)
      this.gridSize = game.canvas.scene.grid.size
      this.animation
      this.blur = options.blur || 4
      this.alpha = options.alpha || 0.8
      this.saturation = options.saturation || 3
      this.tokenSize = this.getTokenSize()
      this.convertRangeToPixels()
      this.drawBoundary()
    }
  }

  getTokenSize() {
    const token = game.actors.get(this.actorId).prototypeToken
    if (token) {
      return {
        x: token.width * this.gridSize,
        y: token.height * this.gridSize,
      }
    }
  }

  convertRangeToPixels() {
    if (this.activityRange) {
      this.activityRange = this.activityRange * this.gridSize
    }
  }

  drawBoundary() {
    if (this.activityRange <= 0) return
    this.box.clear()
    this.box.lineStyle(3, this.color, this.alpha)
    this.box.drawRect(
      this.startPos.x - this.tokenSize.x / 2 - this.activityRange,
      this.startPos.y - this.tokenSize.y / 2 - this.activityRange,
      this.activityRange * 2 + this.tokenSize.x,
      this.activityRange * 2 + this.tokenSize.y,
    )
    this.box.endFill()
    gsap.set(this.box, {
      pixi: {
        blur: this.blur,
        alpha: this.alpha,
        saturation: this.saturation,
      },
    })
    this.animation = gsap.to(this.box, {
      alpha: 0.7,
      duration: 2,
      pixi: {
        blur: 5,
        alpha: 0.9,
        saturation: 3,
      },
      repeat: -1,
      ease: 'sine.inOut',
      yoyo: true,
    })
  }

  clear() {
    if (this.animation) {
      if (this.box) {
        gsap.killTweensOf(this.box)
        gsap.to(this.box, {
          pixi: { blur: 0, alpha: 0 },
          duration: 0.5,
          onComplete: function () {
            this.animation.kill()
            if (this.box) {
              this.box.destroy()
              this.box = null
            }
          }.bind(this),
        })
      }
    }
  }
}
