export class AnimationHandler {
  constructor(options = {}) {
    this.hotbar = options.hotbar
    this.animationDuration = 0.5
    this.animationStack = []
    this.defaultTray = options.defaultTray || 'stacked'
  }

  async pushTray(trayId) {
    if (this.animationStack.at(-1) == 'activity' && trayId == 'target-helper') { 
      this.setTray('target-helper')
      return
    }
    this.animationStack.push(trayId)
    await this.animateTrays(trayId, this.animationStack.at(-2), this.hotbar)
  }

  async popTray(animate = true) {
    if (this.animationStack.length > 1 && animate) {
      await this.animateTrays(this.animationStack.at(-2), this.animationStack.pop(), this.hotbar)
    }
  }

  async setTray(trayId) {
    if (this.animationStack.length == 1) {
      this.animationStack.push(trayId)
      await this.animateTrays(trayId, this.animationStack.at(-2), this.hotbar)
    } else {
      let trayOut = this.animationStack.pop()
      this.animationStack.push(trayId)
      await this.animateTrays(trayId, trayOut, this.hotbar)
    }
  }


  async clearStack() {
    this.animationStack = [this.defaultTray]
  }

  setDefaultTray(trayId) {
    this.defaultTray = trayId
  }

  findTray(trayId, hotbar) {
    return this.hotbar.getTray(trayId)
  }
  static getAnimationDuration(trayId) {
    switch (trayId) {
      case 'activity':
        return 0.25
      case 'target-helper':
        return 0.25
      default:
        return 0.5
    }
  }

  async animateTrays(trayInId, trayOutId, hotbar) {
    if (trayInId == trayOutId) return
    
    if (trayOutId == 'target-helper' && trayInId == 'activity') {
      trayInId = 'stacked'
    }

    let trayIn = this.findTray(trayInId, hotbar)
    let trayOut = this.findTray(trayOutId, hotbar)
    hotbar.trayInformation = trayIn.label

    hotbar.animating = true
    trayIn.setActive()
    trayOut.setActive()
    if (trayIn.id == 'stacked') {
      trayIn.setActive()
    }
    if (trayOut.id == 'stacked') {
      trayOut.setActive()
    }

    hotbar.currentTray = trayIn
    hotbar.targetTray = trayOut

    await hotbar.render({ parts: ['centerTray'] })

    trayIn?.trays?.forEach((tray) => {
      this.setPreStackedTrayPos(tray, trayOut)
    })
    trayOut?.trays?.forEach((tray) => {
      this.setStackedTrayPos(tray)
    })

    let p1, p2

    switch (true) {
      case trayIn.id != 'stacked' && trayOut.id != 'stacked':
        p1 = this.animateTrayIn(trayIn)
        p2 = this.animateTrayOut(trayOut)
        break
      case trayIn.id == 'stacked' && trayIn?.trays?.includes(trayOut):
        p1 = this.animateStackedTrayIn(trayIn, trayOut)
        p2 = Promise.resolve(p2)
        break
      case trayIn.id == 'stacked' && !trayIn?.trays?.includes(trayOut):
        p2 = this.animateTrayOut(trayOut)
        p1 = this.animateStackedTrayIn(trayIn, trayOut)
        break
      case trayOut.id == 'stacked':
        p1 = this.animateStackedTrayOut(trayOut, trayIn)
        trayOut.trays.includes(trayIn)
          ? (p2 = Promise.resolve(p2))
          : (p2 = this.animateTrayIn(trayIn))

        break
    }

    Promise.all([p1, p2])
      .then(() => {
        hotbar.animating = false
        trayIn = hotbar.getTray(trayInId)
        trayOut = hotbar.getTray(trayOutId)
        if (trayIn.id == 'stacked') {
          trayOut.setInactive()
          trayIn.setActive()
        } else if (trayOut.id == 'stacked') {
          trayOut.setInactive()
          trayIn.setActive()
        } else {
          trayIn.setActive()
          trayOut.setInactive()
        }
        hotbar.currentTray = trayIn
        hotbar.targetTray = trayOut
      })
      .then(async () => {
        await hotbar.render({ parts: ['centerTray'] })
      })
      .then(() => {
        if (trayIn.id == 'stacked') {
          trayIn.trays.forEach((tray) => {
            this.setStackedTrayPos(tray)
          })
        }
      })
  }

  animateTrayIn(tray) {
    return new Promise((resolve) => {
      this.hotbar.animating = true
      this.hotbar.targetTray = tray

      tray.setActive()
      let xOffset = 0
      let yOffset = 0
      switch (tray.type) {
        case 'static':
          yOffset = -100
          break
        case 'activity':
          yOffset = 200
          break
        case 'custom':
          xOffset = 1000
          break
        case 'target':
          yOffset = -200
          break
      }

      gsap.set(`.${tray.id}`, {
        opacity: 1,
        y: yOffset,
        x: xOffset,
      })

      gsap.to(`.${tray.id}`, {
        opacity: 1,
        y: 0,
        x: 0,
        duration: AnimationHandler.getAnimationDuration(tray.id),
        onComplete: () => {
          resolve()
          return
        },
      })
    })
  }

  async animateTrayOut(tray) {
    if (tray?.x) {
      gsap.set(`.${tray.id}`, {
        x: tray.x,
      })
    }
    return new Promise((resolve) => {
      this.hotbar.animating = true
      this.hotbar.currentTray = tray

      tray.setActive()
      let xOffset = 0
      let yOffset = 0
      switch (tray.type) {
        case 'static':
          yOffset = -100
          break
        case 'activity':
          yOffset = 200
          break
        case 'custom':
          xOffset = 1000
          break
        case 'target':
          yOffset = -200
          break
      }

      gsap.to(`.${tray.id}`, {
        opacity: 1,
        y: yOffset,
        x: xOffset,
        inherit: true,
        duration: AnimationHandler.getAnimationDuration(tray.id),
        onComplete: () => {
          resolve()
          return
        },
      })
    })
  }

  async animateSpacer(width) {
    gsap.to('.stacked-tray-spacer-container', {
      clipPath: `inset(-7px ${width}px -5px -5px)`,
      duration: 0.4,
      onComplete: () => {
        document.documentElement.style.setProperty('--stacked-spacer-width', width + 'px')
      },
    })
  }

  async animateStackedTrayOut(trayOut, trayIn) {
    return new Promise(async (resolve) => {
      let animationComplete = trayOut.trays.length
      this.animateSpacer(0)
      trayOut.trays.forEach((tray) => {
        let xOffset = 0
        if (tray == trayIn) {
          if (tray.id != 'common') xOffset = -22
          this.setStackedTrayPos(tray)
          gsap.to(`.container-${tray.id}`, {
            opacity: 1,
            x: xOffset,
            duration: AnimationHandler.getAnimationDuration(tray.id),
            onComplete: () => {
              animationComplete > 0 ? resolve() : animationComplete--
              return
            },
          })
        } else {
          gsap.to(`.container-${tray.id}`, {
            opacity: 1,
            x: 1000,
            duration: AnimationHandler.getAnimationDuration(tray.id),
            onComplete: () => {
              animationComplete > 0 ? resolve() : animationComplete--
              return
            },
          })
        }
      })
    })
  }

  async animateStackedTrayIn(trayIn, trayOut) {
    return new Promise(async (resolve) => {
      let animationComplete = trayIn.trays.length
      this.animateSpacer(17)
      trayIn.trays.forEach((tray) => {
        gsap.to(`.container-${tray.id}`, {
          opacity: 1,
          x: tray.xPos,
          duration: AnimationHandler.getAnimationDuration(tray.id),
          onComplete: () => {
            animationComplete > 0 ? resolve() : animationComplete--
            return
          },
        })
      })
    })
  }

  setAllStackedTrayPos(stackedTray) {
    stackedTray.trays.forEach((tray) => {
      gsap.set(`.container-${tray.id}`, {
        opacity: 1,
        x: tray.xPos,
      })
    })
  }
  setStackedTrayPos(tray) {
    gsap.set(`.container-${tray.id}`, {
      opacity: 1,
      x: tray.xPos,
    })
  }

  setPreStackedTrayPos(tray, trayOut) {
    gsap.set(`.container-${tray.id}`, {
      opacity: 1,
      x: tray == trayOut ? 0 : 1000,
    })
  }

  setCircle(value) {
    let color100 = '#01a3e4'
    let color = '#1D86AF'
    let baseColor = value == 100 ? color100 : color
    let glowpx = value == 100 ? 8 : 4
    let filter = `drop-shadow(0 0 ${glowpx}px ${this.getAdjustedColor(
      baseColor,
      value,
    )}) drop-shadow(0 0 ${glowpx}px ${this.getAdjustedColor(baseColor, value)}) `
    gsap.set('.circle-svg', {
      drawSVG: `0%
          ${value}%`,
      stroke: this.getAdjustedColor(baseColor, value),
      filter: filter,
    })
  }

  async animateCircle(start, end, hotbar) {
    let color100 = '#01a3e4'
    let color = '#1D86AF'
    let baseColor = end == 100 ? color100 : color
    let glowpx = end == 100 ? 8 : 4
    let filter = `drop-shadow(0 0 ${glowpx}px ${this.getAdjustedColor(
      baseColor,
      end,
    )}) drop-shadow(0 0 ${glowpx}px ${this.getAdjustedColor(baseColor, end)}) `

    if (end == 100) {
      gsap.fromTo(
        '.end-turn-btn',
        {
          background: 'radial-gradient( #ff8725, #552502)',
        },
        {
          background: 'radial-gradient( #ff4800, #000000)',
          duration: 1,
        },
      )
    }
    gsap.fromTo(
      '.circle-svg',
      { drawSVG: `0% ${start}%` },
      {
        drawSVG: `0% ${end}%`,
        duration: 3,
        ease: 'power4.out',
        stroke: `${this.getAdjustedColor(baseColor, end)}`,
        filter: filter,
        onComplete: () => {
          gsap.set('.circle-svg', {
            drawSVG: `0%
          ${end}%`,
          })
        },
      },
    )
  }

  getAdjustedColor(baseColor, percentage) {
    function hexToHSL(hex) {
      let r = parseInt(hex.substring(1, 3), 16) / 255
      let g = parseInt(hex.substring(3, 5), 16) / 255
      let b = parseInt(hex.substring(5, 7), 16) / 255

      let max = Math.max(r, g, b),
        min = Math.min(r, g, b)
      let h,
        s,
        l = (max + min) / 2

      if (max === min) {
        h = s = 0
      } else {
        let d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0)
            break
          case g:
            h = (b - r) / d + 2
            break
          case b:
            h = (r - g) / d + 4
            break
        }
        h *= 60
      }
      return { h, s, l }
    }

    function hslToHex(h, s, l) {
      function f(n) {
        let k = (n + h / 30) % 12
        let a = s * Math.min(l, 1 - l)
        let color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
        return Math.round(255 * color)
          .toString(16)
          .padStart(2, '0')
      }
      return `#${f(0)}${f(8)}${f(4)}`
    }

    let hsl = hexToHSL(baseColor)

    let minLightness = 0.4
    let maxLightness = 0.9

    let lightnessFactor = percentage / 100
    let newLightness = hsl.l + (lightnessFactor - 0.5) * 0.6

    newLightness = Math.max(minLightness, Math.min(maxLightness, newLightness))

    return hslToHex(hsl.h, hsl.s, newLightness)
  }
}
