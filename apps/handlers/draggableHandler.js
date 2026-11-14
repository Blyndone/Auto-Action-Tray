import { gsap, Draggable } from '/scripts/greensock/esm/all.js'

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
    if (!this.draggableTrays) return
    // Two passes on purpose. Draggable.create reads layout (getComputedStyle and
    // getBoundingClientRect), setClipPath writes it - and this runs immediately after the
    // centerTray render has replaced every node, so layout is already dirty. Interleaving the
    // two forced a fresh synchronous layout per tray; batching the reads and then the writes
    // costs one.
    const trays = this.draggableTrays.filter((tray, index) => index != 0)
    trays.forEach((tray) => this.createDraggable(tray))
    trays.forEach((tray) => tray.setClipPath.call(this, tray, tray.position, duration, true))
  }
  setAllClipPaths(duration) {
    this.draggableTrays?.forEach((tray) => {
      tray.setClipPath.call(this, tray, tray.position, duration, true)
    })
  }

  createDraggable(tray) {
    const index = tray.index
    const application = this.application
    const container = this

    // The .container-* node is replaced by every centerTray render, so a Draggable bound to the
    // previous one is dead weight: it keeps the detached node, its listeners and its inertia
    // registration alive for the rest of the session. Reassigning tray.draggable used to just
    // drop the reference without killing it, so they accumulated one per tray per render.
    //
    // Always recreated rather than reused when the node happens to be the same: `bounds` below
    // is captured at creation, so a reused Draggable would hold whatever its neighbours were
    // when it was made.
    tray.draggable?.forEach((instance) => instance?.kill?.())


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
    // Last clip-path written, and the node it was written to. See setClipPath.
    this.clipElement = null
    this.clipValue = null
  }

  getElement() {
    // isConnected, not just a null check: every centerTray render replaces this node, so the
    // cached one goes stale after the first render and this used to hand back a detached
    // element for the rest of the session.
    if (!this.element?.isConnected) {
      this.element = document.querySelector(`.container-${this.id}`)
    }
    return this.element
  }

  applyBounds(bounds) {
    const draggable = this.draggable?.[0]

    const oldMin = draggable?.minX
    const oldMax = draggable?.maxX

    bounds = {
      minX: bounds.minX !== undefined ? bounds.minX : oldMin,
      maxX: bounds.maxX !== undefined ? bounds.maxX : oldMax,
    }

    if (bounds.minX !== undefined) this.setMin(bounds.minX)
    if (bounds.maxX !== undefined) this.setMax(bounds.maxX)

    draggable?.applyBounds(bounds)
  }

  setClipPath(tray, pos, duration = null, selfOnly = false) {
    function setClip(currentTray, pos, duration = 0) {
      const element = currentTray.getElement()
      if (!element) return

      const clipPath = `inset(0px ${pos}px 0px 0px)`
      // onDrag calls through here every frame, and the clip usually lands on the same value for
      // several frames running. Keyed on the element as well as the value because a render swaps
      // in a fresh node that carries no inline style.
      if (currentTray.clipElement === element && currentTray.clipValue === clipPath) return
      currentTray.clipElement = element
      currentTray.clipValue = clipPath

      // The element, not `.container-${id}` - a selector string makes gsap re-run
      // querySelectorAll on every call, twice per tray per frame while dragging. gsap.set rather
      // than a zero-duration gsap.to for the instant case, which is what every caller but the
      // snap handler passes.
      if (duration > 0) {
        gsap.to(element, { duration, clipPath })
      } else {
        gsap.set(element, { clipPath })
      }
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
