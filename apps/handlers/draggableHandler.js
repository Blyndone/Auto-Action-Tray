import { Draggable } from '/scripts/greensock/esm/all.js'

export class DraggableTrayContainer {
  constructor(options = {}) {
    this.application = options.application || null
    this.trays = options.trays || []

    this.handleSize = this.application.iconSize / 3 + 2
    this.spacerSize = this.application.iconSize / 3
    this.padding = 7
    this.iconSize = this.application.iconSize
    this.columnCount = this.application.columnCount
    this.trayMax = this.columnCount * (this.iconSize + 2) - this.handleSize - this.spacerSize
    this.trayCount = 3
    this.draggableTrays = null
  }

  setTrays(trays) {
    this.trays = trays
    this.draggableTrays = trays.map((tray) => {
      const draggableTray = new DraggableTray({
        id: tray.id,
        xMin: tray.xMin,
        tray: tray.tray,
      })
      return draggableTray
    })
    this.draggableTrays.forEach((tray, index) => {
      tray.index = index
      tray.setMax(this.trayMax)
    })
    this.createAllDraggables()
    this.trayCount = this.draggableTrays.length
  }

  setTrayPositions(trayPositions) {
    this.draggableTrays.forEach((tray, index) => {
      const position = trayPositions[index] || 0
      tray.setMin(position)
      tray.setPos(position)
    })
    this.application.animationHandler.setAllStackedTrayPos(this.draggableTrays)
  }

  createAllDraggables(duration = null) {
    this.draggableTrays?.forEach((tray, index) => {
      if (index != 0) {
        this.createDraggable.bind(this)(tray)
        tray.setClipPath.bind(this)(tray, tray.position, duration, true)
      }
    })
  }
  setAllClipPaths(duration) {
    this.draggableTrays?.forEach((tray) => {
      tray.setClipPath.bind(this)(tray, tray.position, duration, true)
    })
  }

  createDraggable(tray) {
    const index = tray.index
    const application = this.application
    const container = this

    // ------------------------------
    // Math Helpers
    // ------------------------------

    const getLeftNeighbor = () => container.draggableTrays[index - 1]?.tray
    const getRightNeighbor = () => container.draggableTrays[index + 1]?.tray

    const computeMinX = () => {
      if (index === 1) return 0
      const left = getLeftNeighbor()
      return Math.max((left?.xPos || 0) + container.spacerSize)
    }

    const computeMaxX = () => {
      const right = getRightNeighbor()
      return Math.min((right?.xPos || container.trayMax) - container.spacerSize)
    }

    const computeGridSnapX = (x) => {
      return (
        Math.floor(x / container.iconSize) * container.iconSize +
        container.padding +
        (index - 1) * (container.handleSize + container.padding)
      )
    }

    const applyNeighborBounds = (min) => {
      const left = container.draggableTrays[index - 1]
      const right = container.draggableTrays[index + 1]

      if (left) {
        left.applyBounds({
          maxX: min - container.spacerSize,
        })
      }

      if (right) {
        right.applyBounds({
          minX: min + container.spacerSize,
        })
      }
    }

    // ------------------------------
    // Draggable
    // ------------------------------

    tray.draggable = Draggable.create(`.container-${tray.id}`, {
      type: 'x',
      bounds: { minX: computeMinX(), maxX: computeMaxX() },
      handle: `.handle-${tray.id}`,
      inertia: true,
      force3D: false,
      zIndexBoost: false,
      maxDuration: 0.1,

      onDrag: function () {
        tray.setClipPath.call(container, tray, this.x)
      },

      snap: {
        duration: 0.1,
        x: (value) => {
          const snapped = computeGridSnapX(value)
          tray.setClipPath.call(container, tray, snapped, 0.1)
          return snapped
        },
      },

      onThrowComplete: function () {
        const snapped = computeGridSnapX(this.endX)

        application.stackedTray.setTrayPosition(tray.id, snapped)
        tray.setMin(snapped)
        tray.setPos(snapped)

        applyNeighborBounds(snapped)
      },
    })
  }

  //   createDraggable(tray) {
  //   const index = tray.index
  //   const application = this.application
  //   const container = this

  //   tray.draggable = Draggable.create(`.container-${tray.id}`, {
  //     type: 'x',
  //     bounds: {
  //       minX:
  //         index != 1
  //           ? Math.max(this.draggableTrays[index - 1]?.tray.xPos + container.spacerSize || 0)
  //           : 0,
  //       maxX: Math.min(
  //         this.draggableTrays[index + 1]?.tray.xPos - container.spacerSize || this.trayMax,
  //       ),
  //     },
  //     force3D: false,
  //     handle: `.handle-${tray.id}`,
  //     inertia: true,
  //     zIndexBoost: false,
  //     maxDuration: 0.1,

  //     onDrag: function () {
  //       tray.setClipPath.bind(container)(tray, this.x)
  //     },
  //     snap: {
  //       duration: 0.1,
  //       x: function (value) {
  //         let min =
  //           Math.floor(value / container.iconSize) * container.iconSize +
  //           container.padding +
  //           (index - 1) * (container.handleSize + container.padding)
  //         tray.setClipPath.bind(container)(tray, min, 0.1)
  //         return min
  //       },
  //     },
  //     onThrowComplete: function () {
  //       let min =
  //         Math.floor(this.endX / container.iconSize) * container.iconSize +
  //         container.padding +
  //         (index - 1) * (container.handleSize + container.padding)
  //       application.stackedTray.setTrayPosition(tray.id, min)
  //       tray.setMin(min)
  //       tray.setPos(min)
  //       if (index - 1 != 0) {
  //         container.draggableTrays[index - 1].applyBounds({
  //           maxX: tray.xMin - container.spacerSize,
  //         })
  //       }
  //       if (index + 1 < container.trayCount) {
  //         container.draggableTrays[index + 1].applyBounds({
  //           minX: tray.xMin + container.spacerSize,
  //         })
  //       }
  //     },
  //   })
  // }
}

class DraggableTray {
  constructor(options = {}) {
    this.id = options.id || ''
    this.position = options.tray.xPos || options.position || 0
    this.index = 0
    this.xMax = Infinity
    this.xMin = options?.xMin || 0
    this.draggable = null
    this.tray = options.tray || null
    this.element = null
  }

  getElement() {
    if (!this.element) {
      this.element = document.querySelector(`.container-${this.id}`)
    }
    return this.element
  }

  applyBounds(bounds) {
    let oldMin = this.draggable[0].minX
    let oldMax = this.draggable[0].maxX
    bounds = {
      minX: bounds.minX !== undefined ? bounds.minX : oldMin,
      maxX: bounds.maxX !== undefined ? bounds.maxX : oldMax,
    }
    this.setMin(bounds.minX)
    this.setMax(bounds.maxX)

    if (this.draggable) {
      this.draggable[0].applyBounds(bounds)
    }
  }

  setClipPath(tray, pos, duration = null, selfOnly = false) {
    function setClip(currentTray, pos, duration = 0) {
      // const selector = `.container-${identifier}`
      const element = currentTray.getElement()
      const newClipPath = `inset(0px ${pos}px 0px 0px)`
      if (!element) return

      // const currentClip = getComputedStyle(element).clipPath
      // if (currentClip === newClipPath) return

      gsap.to(`.container-${currentTray.id}`, {
        duration: duration,
        // ease: 'power3.out',
        clipPath: `inset(0px ${pos}px 0px 0px)`,
      })
    }

    duration = duration ? duration : 0
    let clipPos
    //setSelfClippath
    if (this.draggableTrays.length - 1 > tray.index) {
      let nextTray = this.draggableTrays[tray.index + 1]
      clipPos = this.trayMax + pos - nextTray.position + this.padding + this.spacerSize * 2
      setClip(tray, clipPos, duration)
    }

    //setprevious Clippath

    if (tray.index == 1 || (!selfOnly && tray.index > 0)) {
      let previousTray = this.draggableTrays[tray.index - 1]
      clipPos =
        this.trayMax -
        pos +
        previousTray.position +
        this.padding +
        this.spacerSize * (tray.index > 1 ? 2 : 1)
      setClip(this.draggableTrays[tray.index - 1], clipPos, duration)
    }
  }

  setMin(xMin) {
    this.xMin = xMin
  }
  setPos(position) {
    this.position = position
  }
  setMax(xMax) {
    this.xMax = xMax
  }
}
