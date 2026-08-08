import { gsap } from '/scripts/greensock/esm/all.js'
import { saturateColor } from './targetLineCombo.js'

export class TemplateBoundary {
  constructor(options) {
    this.boundaries = []
  }
  createBoundary(options) {
    let type = options.document.t
    switch (type) {
      case 'circle':
        this.boundaries.push(new CircleBoundary(options))
        break
      case 'ray':
        this.boundaries.push(new RayBoundary(options))
        break
      case 'cone':
        this.boundaries.push(new ConeBoundary(options))
        break
      case 'rect':
        this.boundaries.push(new RectangleBoundary(options))
        break
      default:
        return false
    }
    return true
  }

  updateBoundary(options) {
    let boundary = this.boundaries.find((b) => b.activityUuid === options.activityUuid)
    if (boundary) {
      boundary.updateBoundary(options.document)
    } else {
      console.error('Boundary not initialized for template:', this.template)
      throw new Error('Boundary not initialized')
    }
  }
  destroyBoundary(options) {
    let boundary = this.boundaries.find((b) => b.activityUuid === options.activityUuid)
    if (boundary) {
      boundary.destroyBoundary()
      this.boundaries = this.boundaries.filter((b) => b.activityUuid !== options.activityUuid)
    } else {
      console.warn('Boundary already destroyed or not initialized.')
    }
  }
}

class protoBoundary {
  constructor(options) {
    this.phantom = false
    this.activityUuid = options?.activity?.uuid || options.activityUuid
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
    this.animation = gsap.to(this.boundary, {
      alpha: 0.9,
      duration: 2,
      repeat: -1,
      ease: 'sine.inOut',
      yoyo: true,
    })
  }

  destroyBoundary() {
    if (!this.boundary) {
      console.warn('Boundary already destroyed or not initialized.')
      return
    }
    const boundary = this.boundary
    this.boundary = null
    this.animation?.kill()
    this.animation = null
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
