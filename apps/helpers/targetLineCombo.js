import { gsap } from '/scripts/greensock/esm/all.js'

export class TargetLineCombo {
  constructor(options) {
    this.useName = options.sendName ?? game.settings.get('auto-action-tray', 'enableUseItemName')
    this.useIcon = options.sendIcon ?? game.settings.get('auto-action-tray', 'enableUseItemIcon')
    // `??`, not `||` — `useLines: false` callers (use notifications, range boundaries) want no
    // line/text objects at all, and `false || true` silently built them anyway.
    this.useLines = options.useLines ?? true
    this.yOffset = options.yOffset || 0
    this.phantom = options.phantom || false
    this.id = options.id || foundry.utils.randomID()
    this.actorId = options.actorId
    this.line = null
    this.glowLine = null
    this.text = null
    if (this.useLines) {
      this.line = new TargetLine({
        ...options,
        yOffset: this.yOffset,
      })
      this.glowLine = new GlowLine({
        ...options,
        yOffset: this.yOffset,
      })
      this.text = !this.phantom ? new TargetText(options) : null
    }
    this.firstLine = options.firstLine !== undefined ? options.firstLine : true
    // Identifies what the icon/label depict, so a later combo for the same item can take them
    // over instead of rebuilding them. See detachDecorations below.
    this.decorationKey = options.decorationKey ?? null

    // Adopted as a pair, never mixed: ItemImage wires its hover fades to the TargettingText it
    // was constructed with, so a new icon paired with an inherited label (or vice versa) would
    // fade one and not the other.
    const adopt = options.adopt ?? null
    if (adopt) {
      this.targettingText = adopt.targettingText ?? null
      this.itemImg = adopt.itemImg ?? null
    } else {
      if (this.useName) {
        this.targettingText = this.firstLine ? new TargettingText(options) : null
      }
      if (this.useIcon) {
        this.itemImg = this.firstLine ? new ItemImage(options, this.targettingText) : null
      }
    }
    this.rangeBoundary = this.firstLine ? new TargetBoundary(options) : null
    this.startPos = options.startPos
    this.startLinePos = options.startLinePos
    this.lastPos = options.startPos
    this.color = options.color || game.user.color.css || 0xffff00
    this.activityRange = options.activityRange || 0
    this.inRange = true
  }

  /**
   * Hand the live icon and label to a successor combo. They stay on the stage with their tweens
   * running; this combo simply stops owning them, so its own teardown leaves them alone.
   *
   * Used when a targeting flow turns into a use notification for the same item. Both phases build
   * the icon and label from identical inputs, so destroying and immediately reconstructing them
   * only produced a visible blink - the old sprite's half-second fade-out overlapping the new one
   * at full alpha, with the infinite bob tween restarting from the top.
   */
  detachDecorations() {
    const decorations = { targettingText: this.targettingText, itemImg: this.itemImg }
    this.targettingText = null
    this.itemImg = null
    return decorations
  }

  hasDecorations() {
    return !!(this.targettingText || this.itemImg)
  }

  clearLines() {
    this.line?.clear()
    this.glowLine?.clear()
    this.#clearDecorations()
  }
  clearRangeBoundary() {
    this.rangeBoundary?.clear()
  }
  destroyLines() {
    this.line?.destroy()
    this.glowLine?.destroy()
    this.#clearDecorations()
  }
  forceDestroyLines() {
    this.line?.forceDestroy()
    this.glowLine?.forceDestroy()
    this.#clearDecorations()
  }

  // The name/icon/boundary trio only ever belongs to the first line of a combo chain, and is
  // handed off by transferBoundaryAndText() when that line is removed.
  #clearDecorations() {
    if (this.firstLine) {
      this.targettingText?.clear()
      this.rangeBoundary?.clear()
      this.itemImg?.clear()
    }
    this.clearText()
  }

  drawLines(endPos) {
    this.line?.drawLine(endPos)
    this.glowLine?.drawLine(endPos)
    this.text?.moveText(endPos)
    this.lastPos = endPos
  }
  setText(newText) {
    this.text?.setText(newText)
  }
  setTargetingText(pos, itemType, itemName) {
    this.targettingText?.setTargetingText(pos, itemType, itemName)
  }
  setFirstLine(firstLine) {
    this.firstLine = firstLine
  }
  transferBoundaryAndText(targettingText, rangeBoundary, itemImg) {
    this.targettingText = targettingText
    this.rangeBoundary = rangeBoundary
    this.itemImg = itemImg
  }
  moveText(endPos) {
    this.text?.moveText(endPos)
  }
  clearText() {
    this.text?.clear()
    this.text = null
  }
  setInRange(inRange) {
    this.inRange = inRange
    if (this.line) this.line.inRange = inRange
    if (this.glowLine) this.glowLine.inRange = inRange
  }
  setYOffset(yOffset) {
    this.yOffset = yOffset
    if (this.line) this.line.yOffset = yOffset
    if (this.glowLine) this.glowLine.yOffset = yOffset
  }
}
class protoLine {
  constructor(options) {
    this.inRange = true
    this.yOffset = options.yOffset || 0
    this.startPos = options.startPos
    this.startLinePos = options.startLinePos
    this.line = new PIXI.Graphics()
    this.line.eventMode = 'none'
  }

  // Called at the end of each subclass constructor, once color/width/blur/alpha are known.
  //
  // Two things happen here that used to happen on every single redraw. The Graphics is parented
  // once instead of per-frame: canvas.stage has sortableChildren enabled, so each addChild set
  // sortDirty and forced a re-sort of the whole stage. And the glow is precomputed as a stack of
  // strokes rather than left to a BlurFilter + ColorMatrixFilter — PIXI re-renders a filtered
  // object into its own render texture every frame whether or not it changed, and a target line's
  // bounds span from the token to the cursor, so each filtered line cost a near-fullscreen pass
  // at 60fps for its entire lifetime. Baked strokes cost tessellation only when the line moves.
  attach() {
    this.strokes = this.#buildStrokes()
    this.line.alpha = this.alpha
    canvas.app.stage.addChild(this.line)
  }

  // Widest/faintest first so the crisp core paints last, approximating a gaussian falloff of
  // radius `blur`. A blur under 2px is imperceptible once baked, so those lines stay single-pass.
  #buildStrokes() {
    const core = { width: this.width, alpha: this.alpha }
    if (!(this.blur >= 2)) return [core]
    const spread = this.blur * 2
    const halo = [0.06, 0.12, 0.22].map((alpha, i, arr) => ({
      width: this.width + spread * (1 - i / arr.length),
      alpha: alpha * this.alpha,
    }))
    return [...halo, core]
  }

  destroy() {
    const line = this.line
    if (!line) return
    this.line = null
    gsap.to(line, {
      alpha: 0,
      duration: 0.5,
      onComplete: () => line.destroy(),
    })
  }
  forceDestroy() {
    // destroy() detaches from the parent for us; skipping it left the geometry's GPU buffers
    // allocated for the life of the WebGL context.
    this.line?.destroy()
    this.line = null
  }
  clear() {
    this.line?.clear()
  }
  drawLine(endPos) {
    if (!this.line) return
    this.line.clear()

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

    const color = this.inRange ? this.color : this.outOfRangeColor
    for (const stroke of this.strokes) {
      this.line.lineStyle(stroke.width, color, stroke.alpha)
      this.line.moveTo(this.startLinePos.x, this.startLinePos.y)
      this.line.bezierCurveTo(
        midpoint1.x,
        midpoint1.y,
        midpoint2.x,
        midpoint2.y,
        endPos.x,
        endPos.y,
      )
    }
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
  }
  // Deliberately not called from the constructor: subclasses that bail out on incomplete options
  // must be able to do so without ever having parented a PIXI.Text to the stage.
  attach() {
    if (this.text && !this.text.parent) canvas.app.stage.addChild(this.text)
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
    this.size = options.size || game.settings.get('auto-action-tray', 'useItemIconSize') || 30
    this.animation
    const actor = game.actors.get(this.actorId)
    this.anchor = (actor.prototypeToken.height * canvas.grid.size) / 2 + this.size / 2 + 5
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

    // Baked halo instead of a BlurFilter, which cost a render-texture pass every frame for as
    // long as the icon was on screen. A stroke extends half its width past the circle, so
    // `spread` is how far the halo reaches beyond the icon's edge — tuned to sit tighter than the
    // old BlurFilter(8), which bled about 16px and read as more glow than icon.
    this.shadow = new PIXI.Graphics()
    const spread = 12
    for (const [width, alpha] of [
      [4 + spread * 2, 0.05],
      [4 + spread * 1.4, 0.09],
      [4 + spread * 0.75, 0.16],
      [4 + spread * 0.25, 0.28],
    ]) {
      this.shadow.lineStyle(width, this.color, alpha)
      this.shadow.drawCircle(this.pos.x, this.pos.y - this.anchor, this.size / 2)
    }
    this.shadow.endFill()
    this.shadow.zIndex = 0

    canvas.app.stage.addChild(this.img)
    canvas.app.stage.addChild(this.mask)
    canvas.app.stage.addChild(this.border)
    canvas.app.stage.addChild(this.shadow)

    this.composite = [this.img, this.mask, this.border, this.shadow]

    this.composite.forEach((item) => {
      item.eventMode = 'static'
    })
    // `targettingText` is absent whenever the item-name setting is off, and its `.text` is nulled
    // once cleared, so every fade has to tolerate both.
    const fade = (alpha) => {
      this.composite.forEach((i) => gsap.to(i, { alpha, duration: 0.3 }))
      if (this.targettingText?.text) {
        gsap.to(this.targettingText.text, { alpha, duration: 0.3 })
      }
    }

    this.composite.forEach((item) => {
      item.on('pointerover', () => {
        if (!this.active) return
        fade(0)
      })
      item.on('pointerout', () => {
        if (!this.active) return
        fade(1)
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

    if (this.targettingText?.text) {
      const label = this.targettingText.text
      label.eventMode = 'static'
      this.targettingText.text.on('pointerover', () => {
        if (!this.active) return
        fade(0)
      })
      this.targettingText.text.on('pointerout', () => {
        if (!this.active) return
        fade(1)
      })
      this.targettingText.text.on('pointerdown', (event) => {
        if (!this.active) return
        label.eventMode = 'none'
        let overevent = new MouseEvent('pointerover', event)
        event = new MouseEvent('pointerdown', event)
        game.canvas.app.view.dispatchEvent(overevent)
        game.canvas.app.view.dispatchEvent(event)
        // Captured, not re-read: the label can be cleared before this fires.
        setTimeout(() => (label.destroyed ? null : (label.eventMode = 'static')), 0)
      })
    }

    this.animation = gsap.to(this.composite, {
      y: '-=10',
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
    if (!this.active) return
    this.active = false
    const composite = this.composite
    this.composite = []
    gsap.killTweensOf(composite)

    gsap.to(composite, {
      alpha: 0,
      duration: 0.3,
      onComplete: () => {
        this.animation?.kill()
        // destroy() unparents as well, so the sprites leave canvas.stage with their textures.
        composite.forEach((part) => part.destroy())
        this.img = this.mask = this.border = this.shadow = null
      },
    })
  }
}

// The saturation boost the ColorMatrixFilter used to apply every frame, resolved once into the
// stroke color instead.
export function saturateColor(color, amount) {
  if (!(amount > 1)) return color
  try {
    const [h, s, l] = Color.fromString(color).hsl
    return Color.fromHSL([h, Math.clamp(s * amount, 0, 1), l]).css
  } catch (error) {
    return color
  }
}

// Drains the colour for an out-of-range line.
//
// Returns a CSS string, which matters more than it looks: this used to be
// `Color.fromString(color).multiply(0.5)`, and a Foundry Color is a boxed Number, so `typeof` is
// 'object'. PIXI's colour normalisation tests `typeof value === 'number'`, misses, and falls
// through to its generic {r, g, b} branch — where it reads Foundry's 0-1 channels as 0-255 and
// lands on near-black. Out-of-range lines were drawn black rather than dimmed; the old BlurFilter
// smeared that enough to pass for an effect.
export function drainColor(color, saturation = 0.25, luminance = 0.7) {
  try {
    const [h, s, l] = Color.fromString(color).hsl
    return Color.fromHSL([h, s * saturation, l * luminance]).css
  } catch (error) {
    return color
  }
}

class TargetLine extends protoLine {
  constructor(options) {
    super(options)
    this.color = options.color
      ? Color.fromString(options.color).add(Color.fromString('#333333')).css
      : game.user.color.add(Color.fromString('#333333')).css || 0xffff00
    this.blur = options.blur || 1
    this.saturation = options.saturation || 1
    this.color = saturateColor(this.color, this.saturation)
    this.outOfRangeColor = drainColor(this.color)
    this.width = options.width || 2
    this.alpha = options.alpha || 1
    this.attach()
  }
}

class GlowLine extends protoLine {
  constructor(options) {
    super(options)
    this.blur = options.blur || 10
    this.saturation = options.saturation || 3
    this.color = saturateColor(options.color || game.user.color.css || 0xff0000, this.saturation)
    this.outOfRangeColor = drainColor(this.color)
    this.width = options.width || 3
    this.alpha = options.alpha || 0.8
    this.attach()
  }
}
class TargettingText extends protoText {
  constructor(options) {
    super(options)
    this.useIcon = options.sendIcon ?? game.settings.get('auto-action-tray', 'enableUseItemIcon')
    if (!options.itemName || !options.itemType) {
      // Nothing to label. Drop the text rather than leaving an orphan on the stage — every
      // range-boundary hover took this path, and none of them were ever cleaned up.
      this.clear()
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
      fontSize: game.settings.get('auto-action-tray', 'useItemTextSize') || 19,
      fontStyle: 'italic',
      strokeThickness: 3,
      resolution: 3,
    })
    this.text.style = this.style
    this.text.resolution = 3
    this.attach()
    this.setTargetingText(options.startPos, this.itemType, this.itemName, options.itemSpellLevel)
  }

  clear() {
    // No `if (this.animation)` gate — a text that never got as far as its float tween still has
    // to be destroyed. Fades on alpha alone; `pixi: {blur}` attached a BlurFilter for the fade.
    if (!this.text) return
    const text = this.text
    this.text = null
    gsap.killTweensOf(text)
    gsap.to(text, {
      alpha: 0,
      duration: 0.5,
      onComplete: () => {
        this.animation?.kill()
        text.destroy()
      },
    })
  }
  setTargetingText(pos, itemType, itemName, spellLevel) {
    let offset = !this.useIcon ? 0 : game.settings.get('auto-action-tray', 'useItemIconSize') || 30
    let anchor =
      (game.actors.get(this.actorId).prototypeToken.height * canvas.grid.size) / 2 + 20 + offset
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
        y: this.text.y - 10,
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
    this.fontSize = game.settings.get('auto-action-tray', 'useItemTextSize') || 25
    this.style = new PIXI.TextStyle({
      dropShadow: true,
      dropShadowAlpha: 0.6,
      dropShadowAngle: 0,
      dropShadowBlur: 5,
      dropShadowDistance: 0,
      dropShadowColor: '#000000',
      fill: '#ffffff',
      fontFamily: 'Georgia',
      fontSize: this.fontSize,
      strokeThickness: 3,
      resolution: 3,
    })
    this.text.style = this.style
    this.text.resolution = 3
    this.attach()
  }
  moveText(endPos) {
    if (this.text) {
      this.text.position.set(endPos.x + 5, endPos.y - this.fontSize - 5)
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
    const x = this.startPos.x - this.tokenSize.x / 2 - this.activityRange
    const y = this.startPos.y - this.tokenSize.y / 2 - this.activityRange
    const width = this.activityRange * 2 + this.tokenSize.x
    const height = this.activityRange * 2 + this.tokenSize.y

    // Baked glow + an alpha-only pulse. The pulse used to animate `pixi: {blur, saturation}`,
    // which meant a BlurFilter and a ColorMatrixFilter re-rendering this box every frame for as
    // long as it was on screen — including on every ranged tray item hover.
    this.box.clear()
    const color = saturateColor(this.color, this.saturation)
    for (const [width_, alpha] of [
      [3 + this.blur * 2, 0.08],
      [3 + this.blur, 0.16],
      [3, this.alpha],
    ]) {
      this.box.lineStyle(width_, color, alpha)
      this.box.drawRect(x, y, width, height)
    }
    this.box.endFill()

    // The old pulse animated blur 4->5 alongside alpha, and the blur breathing carried most of
    // what read as movement. With the filter gone, alpha has to carry the pulse on its own, so it
    // needs real amplitude — the ±0.05 swing this replaced was imperceptible.
    this.box.alpha = this.alpha
    this.animation = gsap.fromTo(
      this.box,
      { alpha: this.alpha * 0.5 },
      {
        alpha: this.alpha,
        duration: 1.2,
        repeat: -1,
        ease: 'sine.inOut',
        yoyo: true,
      },
    )
  }

  clear() {
    if (!this.box) return
    const box = this.box
    this.box = null
    gsap.killTweensOf(box)
    gsap.to(box, {
      alpha: 0,
      duration: 0.5,
      onComplete: () => {
        this.animation?.kill()
        box.destroy()
      },
    })
  }
}
