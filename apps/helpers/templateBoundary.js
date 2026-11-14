import { gsap } from '/scripts/greensock/esm/all.js'
import { saturateColor } from './targetLineCombo.js'

// Owns every template outline drawn on the stage, the caster's own and phantom copies received
// from other clients. Each outline is one entry here: nothing is drawn that is not in this list,
// and nothing leaves the list without its graphics being destroyed.
export class TemplateBoundary {
  constructor(options) {
    this.boundaries = []
  }

  // Returns the new boundary, or null for a template shape with no outline.
  createBoundary(options) {
    const types = {
      circle: CircleBoundary,
      ray: RayBoundary,
      cone: ConeBoundary,
      rect: RectangleBoundary,
    }
    const BoundaryClass = types[options.document?.t]
    if (!BoundaryClass) return null
    const boundary = new BoundaryClass(options)
    this.boundaries.push(boundary)
    return boundary
  }

  // Phantom copies are addressed by the caster's activity and user, the only ids both ends share.
  findPhantoms(activityUuid, senderId) {
    return this.boundaries.filter(
      (b) => b.phantom && b.activityUuid === activityUuid && (!senderId || b.senderId === senderId),
    )
  }
  updatePhantoms(options) {
    for (const b of this.findPhantoms(options.activityUuid, options.senderId)) {
      b.updateBoundary(options.document)
    }
  }
  destroyPhantoms(options) {
    for (const b of this.findPhantoms(options.activityUuid, options.senderId)) this.remove(b)
  }

  own() {
    return this.boundaries.filter((b) => !b.phantom)
  }

  remove(boundary, immediate = false) {
    boundary.destroyBoundary(immediate)
    this.boundaries = this.boundaries.filter((b) => b !== boundary)
  }

  removeWhere(predicate, immediate = false) {
    for (const b of this.boundaries.filter(predicate)) this.remove(b, immediate)
  }

  // Boundaries live on canvas.app.stage, which survives a scene change.
  destroyAll() {
    this.removeWhere(() => true, true)
  }
}

class protoBoundary {
  constructor(options) {
    this.phantom = !!options.phantom
    this.senderId = options.senderId ?? null
    this.activityUuid = options?.activity?.uuid || options.activityUuid
    // Set by TargetHelper on the caster's own outline: the preview object it was drawn for and,
    // once placed, the id of the template document it now follows.
    this.preview = null
    this.templateId = null
    this.boundary = new PIXI.Graphics()
    this.gridSize = game.canvas.scene.grid.size
    this.x = options.document.x || 0
    this.y = options.document.y || 0
    this.distance = options.document.distance || 0
    this.direction = options.document.direction || 0
    this.blur = options.blur || 4
    this.alpha = options.alpha || 0.7
    this.saturation = options.saturation || 1
    this.color = saturateColor(options.color, this.saturation)
    this.animation = null
  }
  createBoundary() {}
  updateBoundary() {}

  // Repeats the caller's path at decreasing width so the glow is geometry rather than a
  // BlurFilter + ColorMatrixFilter pair re-rendering the shape every frame.
  strokePath(draw) {
    const widths = [
      [5 + this.blur * 2, 0.08],
      [5 + this.blur, 0.16],
      [5, 1],
    ]
    for (const [width, alpha] of widths) {
      this.boundary.lineStyle(width, this.color, alpha)
      draw()
    }
  }

  // updateBoundary runs on every refreshMeasuredTemplate — i.e. continuously while a template is
  // being dragged — and each call used to start another infinite tween on the same object without
  // killing the last, leaving dozens of them fighting over the same properties forever.
  pulse() {
    this.animation?.kill()
    this.boundary.alpha = this.alpha
    // Same amplitude as the range boundary's pulse: with the animated blur gone, alpha has to
    // carry the breathing on its own to stay visible.
    this.animation = gsap.fromTo(
      this.boundary,
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

  destroyBoundary(immediate = false) {
    if (!this.boundary) return
    const boundary = this.boundary
    this.boundary = null
    this.animation?.kill()
    this.animation = null
    if (immediate) {
      boundary.destroy()
      return
    }
    gsap.to(boundary, {
      alpha: 0,
      duration: 0.5,
      onComplete: () => boundary.destroy(),
    })
  }
}

class CircleBoundary extends protoBoundary {
  constructor(options) {
    super(options)

    // gridSize, not gridsize: the typo made the radius NaN, so the initial circle drew nothing
    // until the first refresh replaced it.
    this.strokePath(() =>
      this.boundary.drawCircle(this.x, this.y, (this.distance * this.gridSize) / 5),
    )
    canvas.app.stage.addChild(this.boundary)
  }
  updateBoundary(options) {
    if (
      this.x === options.x &&
      this.y === options.y &&
      this.distance === options.distance &&
      this.direction === options.direction
    ) {
      return
    }
    this.x = options.x || 0
    this.y = options.y || 0
    this.distance = options.distance || 0
    this.direction = options.direction || 0
    this.boundary.clear()
    this.strokePath(() =>
      this.boundary.drawCircle(this.x, this.y, (this.distance * this.gridSize) / 5),
    )
    this.pulse()
  }
}
class RayBoundary extends protoBoundary {
  constructor(options) {
    super(options)

    this.width = (options.width * this.gridSize) / 5
    this.strokePath(() =>
      this.boundary.drawRect(
        this.x,
        this.y + this.width / 2,
        (this.distance * this.gridSize) / 5,
        (this.width * this.gridSize) / 5,
      ),
    )
    canvas.app.stage.addChild(this.boundary)
  }
  updateBoundary(options) {
    if (
      this.x === options.x &&
      this.y === options.y &&
      this.distance === options.distance &&
      this.direction === options.direction &&
      this.width === options.width
    ) {
      return
    }
    this.x = options.x || 0
    this.y = options.y || 0
    this.distance = options.distance || 0
    this.direction = options.direction || 0
    this.width = options.width
    let width = (options.width / 5) * this.gridSize
    this.boundary.clear()

    const rectWidth = (this.distance * this.gridSize) / 5
    const rectHeight = width

    this.strokePath(() => this.boundary.drawRect(0, 0, rectWidth, rectHeight))
    this.boundary.pivot.set(0, rectHeight / 2)
    this.boundary.position.set(this.x, this.y)
    this.boundary.rotation = (this.direction * Math.PI) / 180

    this.pulse()
  }
}

class RectangleBoundary extends protoBoundary {
  constructor(options) {
    super(options)

    this.width = (options.width * this.gridSize) / 5
    this.height = options.distance * Math.cos((this.direction * Math.PI) / 180) * this.gridSize
    this.strokePath(() =>
      this.boundary.drawRect(
        this.x,
        this.y + this.width / 2,
        (this.distance * this.gridSize) / 5,
        (this.width * this.gridSize) / 5,
      ),
    )
    canvas.app.stage.addChild(this.boundary)
  }
  updateBoundary(options) {
    if (
      this.x === options.x &&
      this.y === options.y &&
      this.distance === options.distance &&
      this.direction === options.direction &&
      this.width === options.width
    ) {
      return
    }
    this.x = options.x || 0
    this.y = options.y || 0
    this.distance = options.distance || 0
    this.direction = options.direction || 0
    this.width = options.width
    let width = (options.distance * Math.sin((this.direction * Math.PI) / 180) * this.gridSize) / 5
    let height = (options.distance * Math.cos((this.direction * Math.PI) / 180) * this.gridSize) / 5

    this.boundary.clear()

    let rectX = 0
    let rectY = 0
    let rectWidth = height
    let rectHeight = width

    if (rectWidth < 0) {
      rectX += rectWidth
      rectWidth = Math.abs(rectWidth)
    }

    if (rectHeight < 0) {
      rectY += rectHeight
      rectHeight = Math.abs(rectHeight)
    }

    this.strokePath(() => this.boundary.drawRect(rectX, rectY, rectWidth, rectHeight))
    this.boundary.position.set(this.x, this.y)

    this.pulse()
  }
}

class ConeBoundary extends protoBoundary {
  constructor(options) {
    super(options)
    this.angle = options.document.angle || 45
    // The initial draw here used to be a copy of the *rectangle* boundary's, reading a `width`
    // this class never sets — every coordinate came out NaN and nothing was drawn until the
    // first refresh. It draws the cone now, through the same path as updateBoundary.
    this.drawCone()
    canvas.app.stage.addChild(this.boundary)
  }

  drawCone() {
    this.boundary.clear()
    const radius = (this.distance * this.gridSize) / 5
    const halfAngleRad = ((this.angle / 2) * Math.PI) / 180

    let x = Math.cos(halfAngleRad) * radius
    let y = Math.sin(halfAngleRad) * radius

    this.strokePath(() => {
      this.boundary.moveTo(0, 0)
      this.boundary.lineTo(x, y)
      this.boundary.arc(0, 0, radius, halfAngleRad, -halfAngleRad, true)
      this.boundary.lineTo(x, -y)
      this.boundary.lineTo(0, 0)
    })

    this.boundary.position.set(this.x, this.y)
    this.boundary.rotation = (this.direction * Math.PI) / 180
  }

  updateBoundary(options) {
    if (
      this.x === options.x &&
      this.y === options.y &&
      this.distance === options.distance &&
      this.direction === options.direction
    ) {
      return
    }
    this.x = options.x || 0
    this.y = options.y || 0
    this.distance = options.distance || 0
    this.direction = options.direction || 0
    this.width = options.width

    this.drawCone()
    this.pulse()
  }
}
