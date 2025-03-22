export class AnimationHandler {
  constructor(options = {}) {
    this.hotbar = options.hotbar
    this.animationDuration = .5
  }
  findTray(trayId, hotbar) {
    return this.hotbar.getTray(trayId)
  }

  async animateTrays(trayInId, trayOutId, hotbar) {
    if (trayInId == trayOutId) return
    // let duration = hotbar.animationDuration;
    // if (tray1ID == "activity" || tray2ID == "activity") {
    //   duration = 0.5;
    // }

    let trayIn = this.findTray(trayInId, hotbar)
    let trayOut = this.findTray(trayOutId, hotbar)
    hotbar.animating = true
    trayIn.active = true
    trayOut.active = true
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
        if (trayIn.id == 'stacked') {
          trayIn.active = true
          trayOut.active = false
          trayIn.setActive()
        } else if (trayOut.id == 'stacked') {
          trayOut.active = false
          trayOut.setDeactive()
          trayIn.active = true
        } else {
          trayIn.active = true
          trayOut.active = false
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
      hotbar.animating = true
      hotbar.targetTray = tray
      tray.active = true
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
        duration: this.animationDuration,
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
      hotbar.animating = true
      hotbar.currentTray = tray

      tray.active = true
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
      }

      gsap.to(`.${tray.id}`, {
        opacity: 1,
        y: yOffset,
        x: xOffset,
        inherit: true,
        duration: this.animationDuration,
        onComplete: () => {
          resolve()
          return
        },
      })
    })
  }

  async animateSpacer(width) { 
      gsap.to('.stacked-tray-spacer-container', {
        marginRight: width,
        duration: this.animationDuration,
       onComplete: () => {
        document.documentElement.style.setProperty('--stacked-spacer-width', width + 'px')
       }
      })
    

  }

  async animateStackedTrayOut(trayOut, trayIn) {
    
    return new Promise(async (resolve) => {
      let animationComplete = trayOut.trays.length
      this.animateSpacer(0)
      trayOut.trays.forEach((tray) => {
        let xOffset = 0
        if (tray == trayIn) {
          if(tray.id != 'common') xOffset =-22
          this.setStackedTrayPos(tray)
          gsap.to(`.container-${tray.id}`, {
            opacity: 1,
            x: xOffset,
            duration: this.animationDuration,
            onComplete: () => {
              animationComplete > 0 ? resolve() : animationComplete--
              return
            },
          })
        } else {
          gsap.to(`.container-${tray.id}`, {
            opacity: 1,
            x: 1000,
            duration: this.animationDuration,
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
          duration: this.animationDuration,
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
    let baseColor = value == 100 ? '#007f8c' : '#9600d1'
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
    let baseColor = end == 100 ? '#007f8c' : '#9600d1'
    let glowpx = end == 100 ? 8 : 4
    let filter = `drop-shadow(0 0 ${glowpx}px ${this.getAdjustedColor(
      baseColor,
      end,
    )}) drop-shadow(0 0 ${glowpx}px ${this.getAdjustedColor(baseColor, end)}) `

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
    // Convert HEX to HSL for easier brightness manipulation
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
        h = s = 0 // Grayscale
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

    // Limit the range of lightness modification (between 0.2 and 0.8) for more subtle changes
    let minLightness = 0.4
    let maxLightness = 0.9

    // Adjust lightness based on percentage, without going to extremes (black or white)
    let lightnessFactor = percentage / 100 // Scale percentage to a factor
    let newLightness = hsl.l + (lightnessFactor - 0.5) * 0.6 // Adjust between -0.3 and +0.3

    // Keep lightness in the range of 0.2 to 0.8 (avoiding too dark or too bright)
    newLightness = Math.max(minLightness, Math.min(maxLightness, newLightness))

    return hslToHex(hsl.h, hsl.s, newLightness)
  }
}

