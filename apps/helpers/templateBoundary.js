export class TemplateBoundary {
  //options: { activity, template, color, phantom  }
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
    this.color = options.color
    this.blur = options.blur || 4
    this.alpha = options.alpha || 0.7
    this.saturation = options.saturation || 1
  }
  createBoundary() {}
  updateBoundary() {}
  destroyBoundary() {
    if (this.boundary) {
      gsap.to(this.boundary, {
        pixi: {
          blur: 0,
          alpha: 0,
          saturation: 1,
        },
        duration: 0.5,
        onComplete: () => {
          this.boundary.destroy()
          this.boundary = null
        },
      })
    } else {
      console.warn('Boundary already destroyed or not initialized.')
    }
  }
}

class CircleBoundary extends protoBoundary {
  constructor(options) {
    super(options)

    this.boundary
    this.boundary.lineStyle(5, this.color, 1)
    this.boundary.drawCircle(this.x, this.y, (this.distance * this.gridsize) / 5) // x, y, radius
    canvas.app.stage.addChild(this.boundary)
  }
  updateBoundary(options) {
    if (
      this.x === options.x &&
      this.y === options.y &&
      this.distance === options.distance &&
      this.direction === options.direction
    ) {
      return // No changes, no need to update
    }
    this.x = options.x || 0
    this.y = options.y || 0
    this.distance = options.distance || 0
    this.direction = options.direction || 0
    this.boundary.clear()
    this.boundary.lineStyle(5, this.color, 1)
    this.boundary.drawCircle(this.x, this.y, (this.distance * this.gridSize) / 5) // x, y, radius

    gsap.set(this.boundary, {
      pixi: {
        blur: this.blur,
        alpha: this.alpha,
        saturation: this.saturation,
      },
    })
    this.animation = gsap.to(this.boundary, {
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

    // console.log("Circle boundary updated:", this);
  }
}
class RayBoundary extends protoBoundary {
  constructor(options) {
    super(options)

    this.width = (options.width * this.gridSize) / 5
    this.boundary.lineStyle(5, this.color, 1)
    this.boundary.drawRect(
      this.x,
      this.y + this.width / 2,
      (this.distance * this.gridSize) / 5,
      (this.width * this.gridSize) / 5,
    ) // x, y, width, height
    canvas.app.stage.addChild(this.boundary)
  }
  updateBoundary(options) {
    //check if different
    if (
      this.x === options.x &&
      this.y === options.y &&
      this.distance === options.distance &&
      this.direction === options.direction &&
      this.width === options.width
    ) {
      return // No changes, no need to update
    }
    this.x = options.x || 0
    this.y = options.y || 0
    this.distance = options.distance || 0
    this.direction = options.direction || 0
    this.width = options.width
    let width = (options.width / 5) * this.gridSize
    this.boundary.clear()
    this.boundary.lineStyle(5, this.color, 1)

    const rectWidth = (this.distance * this.gridSize) / 5
    const rectHeight = width

    this.boundary.drawRect(0, 0, rectWidth, rectHeight)
    this.boundary.pivot.set(0, rectHeight / 2)
    this.boundary.position.set(this.x, this.y)
    this.boundary.rotation = (this.direction * Math.PI) / 180

    gsap.set(this.boundary, {
      pixi: {
        blur: this.blur,
        alpha: this.alpha,
        saturation: this.saturation,
      },
    })
    this.animation = gsap.to(this.boundary, {
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
}

class RectangleBoundary extends protoBoundary {
  constructor(options) {
    super(options)

    this.width = (options.width * this.gridSize) / 5
    this.height = options.distance * Math.cos((this.direction * Math.PI) / 180) * this.gridSize
    this.boundary.lineStyle(5, this.color, 1)
    this.boundary.drawRect(
      this.x,
      this.y + this.width / 2,
      (this.distance * this.gridSize) / 5,
      (this.width * this.gridSize) / 5,
    ) // x, y, width, height
    canvas.app.stage.addChild(this.boundary)
  }
  updateBoundary(options) {
    //check if different
    if (
      this.x === options.x &&
      this.y === options.y &&
      this.distance === options.distance &&
      this.direction === options.direction &&
      this.width === options.width
    ) {
      return // No changes, no need to update
    }
    this.x = options.x || 0
    this.y = options.y || 0
    this.distance = options.distance || 0
    this.direction = options.direction || 0
    this.width = options.width
    let width = (options.distance * Math.sin((this.direction * Math.PI) / 180) * this.gridSize) / 5
    let height = (options.distance * Math.cos((this.direction * Math.PI) / 180) * this.gridSize) / 5
    this.boundary.clear()
    this.boundary.lineStyle(5, this.color, 1)

    const rectWidth = height
    const rectHeight = width

    this.boundary.drawRect(0, 0, rectWidth, rectHeight)

    this.boundary.position.set(this.x, this.y)

    gsap.set(this.boundary, {
      pixi: {
        blur: this.blur,
        alpha: this.alpha,
        saturation: this.saturation,
      },
    })
    this.animation = gsap.to(this.boundary, {
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
}

class ConeBoundary extends protoBoundary {
  constructor(options) {
    super(options)
    this.angle = options.document.angle || 45 // Default angle
    this.boundary.lineStyle(5, this.color, 1)
    this.boundary.drawRect(
      this.x,
      this.y + this.width / 2,
      (this.distance * this.gridSize) / 5,
      (this.width * this.gridSize) / 5,
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
    this.width = options.width

    this.boundary.clear()
    this.boundary.lineStyle(5, this.color, 1)
    const radius = (this.distance * this.gridSize) / 5
    const halfAngleRad = ((this.angle / 2) * Math.PI) / 180

    let x = Math.cos(halfAngleRad) * radius
    let y = Math.sin(halfAngleRad) * radius

    this.boundary.moveTo(0, 0)
    this.boundary.lineTo(x, y)

    this.boundary.arc(0, 0, radius, halfAngleRad, -halfAngleRad, true)

    this.boundary.lineTo(x, -y)
    this.boundary.lineTo(0, 0)

    this.boundary.position.set(this.x, this.y)
    this.boundary.rotation = (this.direction * Math.PI) / 180

    gsap.set(this.boundary, {
      pixi: {
        blur: this.blur,
        alpha: this.alpha,
        saturation: this.saturation,
      },
    })
    this.animation = gsap.to(this.boundary, {
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
}
