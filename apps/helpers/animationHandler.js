export class AnimationHandler {
  constructor(options = {}) {
    this.hotbar = options.hotbar;
    this.animationDuration = 2;
  }
  findTray(trayId, hotbar) {
    return hotbar.getTray(trayId);
  }

  async animateTrays(tray1ID, tray2ID, hotbar) {
    if (tray1ID == tray2ID) return;
    // let duration = hotbar.animationDuration;
    // if (tray1ID == "activity" || tray2ID == "activity") {
    //   duration = 0.5;
    // }

    let tray1 = this.findTray(tray1ID, hotbar);
    let tray2 = this.findTray(tray2ID, hotbar);
    hotbar.animating = true;
    tray1.active = true;
    tray2.active = true;
    hotbar.currentTray = tray1;
    hotbar.targetTray = tray2;
    await hotbar.render({ parts: ["centerTray"] });
    let p1 = this.animateTrayIn(tray1);
    let p2 = this.animateTrayOut(tray2);

    Promise.all([p1, p2])
      .then(() => {
        hotbar.animating = false;
        tray1.active = true;
        tray2.active = false;
        hotbar.currentTray = tray1;
        hotbar.targetTray = tray1;
        console.log("Animation complete");
      })
      .then(() => {
        hotbar.render({ parts: ["centerTray"] });
      });
  }

  animateTrayIn(tray) {
    return new Promise(resolve => {
      hotbar.animating = true;
      hotbar.targetTray = tray;
      tray.active = true;
      let xOffset = 0;
      let yOffset = 0;
      switch (tray.type) {
        case "static":
          yOffset = -200;
          break;
        case "activity":
          yOffset = 200;
          break;
        case "custom":
          xOffset = 1000;
          break;
      }

      gsap.set(`.${tray.id}`, {
        opacity: 0,
        y: yOffset,
        x: xOffset
      });

      gsap.to(`.${tray.id}`, {
        opacity: 1,
        y: 0,
        x: 0,
        duration: this.animationDuration,
        onComplete: () => {
          resolve();
          return;
        }
      });
    });
  }

  animateTrayOut(tray) {
    return new Promise(resolve => {
      hotbar.animating = true;
      hotbar.currentTray = tray;

      tray.active = true;
      let xOffset = 0;
      let yOffset = 0;
      switch (tray.type) {
        case "static":
          yOffset = -200;
          break;
        case "activity":
          yOffset = 200;
          break;
        case "custom":
          xOffset = 1000;
          break;
      }

      gsap.to(`.${tray.id}`, {
        opacity: 0,
        y: yOffset,
        x: xOffset,
        duration: this.animationDuration,
        onComplete: () => {
          resolve();
          return;
        }
      });
    });
  }

  setCircle(value) {
    let baseColor = value == 100 ? "#007f8c" : "#9600d1";
    let glowpx = value == 100 ? 8 : 4;
    let filter = `drop-shadow(0 0 ${glowpx}px ${this.getAdjustedColor(
      baseColor,
      value
    )}) drop-shadow(0 0 ${glowpx}px ${this.getAdjustedColor(
      baseColor,
      value
    )}) `;
    gsap.set(".circle-svg", {
      drawSVG: `0%
          ${value}%`,
      stroke: this.getAdjustedColor(baseColor, value),
      filter: filter
    });
  }

  async animateCircle(start, end, hotbar) {
    let baseColor = end == 100 ? "#007f8c" : "#9600d1";
    let glowpx = end == 100 ? 8 : 4;
    let filter = `drop-shadow(0 0 ${glowpx}px ${this.getAdjustedColor(
      baseColor,
      end
    )}) drop-shadow(0 0 ${glowpx}px ${this.getAdjustedColor(baseColor, end)}) `;

    gsap.fromTo(
      ".circle-svg",
      { drawSVG: `0% ${start}%` },
      {
        drawSVG: `0% ${end}%`,
        duration: 3,
        ease: "power4.out",
        stroke: `${this.getAdjustedColor(baseColor, end)}`,
        filter: filter,
        onComplete: () => {
          gsap.set(".circle-svg", {
            drawSVG: `0%
          ${end}%`
          });
        }
      }
    );
  }

  getAdjustedColor(baseColor, percentage) {
    // Convert HEX to HSL for easier brightness manipulation
    function hexToHSL(hex) {
      let r = parseInt(hex.substring(1, 3), 16) / 255;
      let g = parseInt(hex.substring(3, 5), 16) / 255;
      let b = parseInt(hex.substring(5, 7), 16) / 255;

      let max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      let h,
        s,
        l = (max + min) / 2;

      if (max === min) {
        h = s = 0; // Grayscale
      } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h *= 60;
      }
      return { h, s, l };
    }

    function hslToHex(h, s, l) {
      function f(n) {
        let k = (n + h / 30) % 12;
        let a = s * Math.min(l, 1 - l);
        let color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
        return Math.round(255 * color).toString(16).padStart(2, "0");
      }
      return `#${f(0)}${f(8)}${f(4)}`;
    }

    let hsl = hexToHSL(baseColor);

    // Limit the range of lightness modification (between 0.2 and 0.8) for more subtle changes
    let minLightness = 0.4;
    let maxLightness = 0.9;

    // Adjust lightness based on percentage, without going to extremes (black or white)
    let lightnessFactor = percentage / 100; // Scale percentage to a factor
    let newLightness = hsl.l + (lightnessFactor - 0.5) * 0.6; // Adjust between -0.3 and +0.3

    // Keep lightness in the range of 0.2 to 0.8 (avoiding too dark or too bright)
    newLightness = Math.max(minLightness, Math.min(maxLightness, newLightness));

    return hslToHex(hsl.h, hsl.s, newLightness);
  }
}

// var tl = gsap.timeline();
// tl
//   .add("start")
//   .fromTo(
//     "." + tray1.id,
//     {
//       opacity: 0,
//       y: tray1.type == "static" ? -200 : tray1.type == "activity" ? 200 : 0,
//       x: tray1.type == "custom" ? 1000 : 0
//     },
//     { opacity: 1, y: 0, x: 0, duration: duration, onStart: () => {} },
//     "start"
//   )
//   .to(
//     "." + tray2.id,
//     {
//       opacity: 0,
//       y: tray2.type == "static" ? -200 : tray2.type == "activity" ? 200 : 0,
//       x: tray2.type == "custom" ? 1000 : 0,
//       duration: duration,
//       onStart: () => {},
//       onComplete: () => {
//         hotbar.animating = false;
//         hotbar.targetTray.active = false;
//         hotbar.currentTray.active = true;
//         hotbar.render({ parts: ["centerTray"] });
//       }
//     },
//     "start"
//   );
