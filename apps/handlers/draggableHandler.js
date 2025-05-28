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
    })
    this.application.animationHandler.setAllStackedTrayPos(this.draggableTrays)
  }

  createAllDraggables() {
    this.draggableTrays?.forEach((tray, index) => {
      if (index != 0) {
        this.createDraggable.bind(this)(tray)
      }
    })
  }

  createDraggable(tray) {
    const index = tray.index
    const application = this.application
    const container = this
    tray.draggable = Draggable.create(`.container-${tray.id}`, {
      type: 'x',
      bounds: {
        minX: index != 1 ? Math.max(this.draggableTrays[index - 1]?.tray.xPos + container.spacerSize || 0) : 0,
        maxX: Math.min(this.draggableTrays[index + 1]?.tray.xPos - container.spacerSize || this.trayMax),
      },
      force3D: false,
      handle: `.handle-${tray.id}`,
      inertia: true,
      zIndexBoost: false,
      maxDuration: 0.1,
      snap: {
        x: function (value) {
          // console.log('Snapping value:', value)
          // console.log(
          //   'Snap',
          //   Math.floor(value / container.iconSize) * container.iconSize +
          //     container.padding +
          //     (index - 1) * (container.handleSize + container.padding),
          // )
          return (
            Math.floor(value / container.iconSize) * container.iconSize +
            container.padding +
            (index - 1) * (container.handleSize + container.padding)
          )
        },
      },
      onThrowComplete: function () {
        let min =
          Math.floor(this.endX / container.iconSize) * container.iconSize +
          container.padding +
          (index - 1) * (container.handleSize + container.padding)
        application.stackedTray.setTrayPosition(tray.id, min)
        tray.setMin(min)
        // console.log('Tray position updated:', tray.id, min)
        if (index - 1 != 0) {
          container.draggableTrays[index - 1].applyBounds({
            maxX: tray.xMin - container.spacerSize,
          })
        }
        if (index + 1 < container.trayCount) {
          container.draggableTrays[index + 1].applyBounds({
            minX: tray.xMin + container.spacerSize,
          })
        }
        // console.log('Throw complete for tray:', tray.id)
        // console.log('New position:', this.x)
        // console.log('New min:', min)
        // console.log('draggableTrays:', container.draggableTrays)
      },
    })
  }
}

class DraggableTray {
  constructor(options = {}) {
    this.id = options.id || ''
    this.position = options.position || 0
    this.index = 0
    this.xMax = Infinity
    this.xMin = options?.xMin  || 0
    this.draggable = null
    this.tray = options.tray || null
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
  setMin(xMin) {
    this.xMin = xMin
    // this.tray.xPos = xMin
  }
  setMax(xMax) {
    this.xMax = xMax
  }
}
