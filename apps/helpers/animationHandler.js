export class AnimationHandler {
  constructor() {
    this.animations = [];
  }
  static findTray(trayId, hotbar) {
    return hotbar.getTray(trayId);
  }

  static async animateTrays(tray1ID, tray2ID, hotbar) {
    if (tray1ID == tray2ID) return;
    let duration = hotbar.animationDuration;
    if (tray1ID == "activity" || tray2ID == "activity") {
      duration = 0.5;
    }

    let tray1 = this.findTray(tray1ID, hotbar);
    let tray2 = this.findTray(tray2ID, hotbar);
    tray1.active = true;
    tray2.active = true;
    hotbar.currentTray = tray1;
    hotbar.targetTray = tray2;
    await hotbar.render(true);
    hotbar.animating = true;

    var tl = gsap.timeline();
    tl
      .add("start")
      .fromTo(
        "." + tray1.id,
        {
          opacity: 0,
          y: tray1.type == "static" ? -200 : tray1.type == "activity" ? 200 : 0,
          x: tray1.type == "custom" ? 1000 : 0
        },
        { opacity: 1, y: 0, x: 0, duration: duration, onStart: () => {} },
        "start"
      )
      .to(
        "." + tray2.id,
        {
          opacity: 0,
          y: tray2.type == "static" ? -200 : tray2.type == "activity" ? 200 : 0,
          x: tray2.type == "custom" ? 1000 : 0,
          duration: duration,
          onStart: () => {},
          onComplete: () => {
            hotbar.animating = false;
            hotbar.currentTray.active = true;
            hotbar.targetTray.active = false;
            hotbar.refresh();
          }
        },
        "start"
      );
  }

  static async animateCircle(start, end, hotbar) {
    await hotbar.render(true);
    hotbar.animating = true;

    gsap.set(".hp-circle", { rotation: 90, transformOrigin: "50% 50%" });

    gsap.fromTo(
      ".hp-circle",
      { drawSVG: `0% ${start}%` },
      {
        drawSVG: `0% ${end}%`,
        duration: 10,
        ease: "power4.out",
        onComplete: () => {
          hotbar.animating = false;
          hotbar.refresh();
        }
      }
    );
  }

  // static animateTray(tray, active) {
  //   tray.active = true;
  //   switch (true) {
  //     case tray == ".static-tray" || tray.type == "static":
  //       gsap.set(`.${tray.id}`, {
  //         opacity: active ? 0 : 1,
  //         y: active ? -200 : 0
  //       });

  //       gsap.to(`.${tray.id}`, {
  //         opacity: active ? 1 : 0,
  //         y: active ? 0 : -200,
  //         duration: 1,
  //         onStart: () => {
  //           this.animating = true;
  //         },
  //         onComplete: () => {
  //           this.animating = false;
  //           tray.active = active;
  //           this.refresh();
  //         }
  //       });
  //       break;

  //     case tray == ".custom-tray" || tray.type == "custom":
  //       gsap.to(".custom-tray", {
  //         opacity: active ? 1 : 0,
  //         x: active ? 0 : 1000,
  //         duration: 1,
  //         onStart: () => {
  //           this.animating = true;
  //         },
  //         onComplete: () => {
  //           this.animating = false;
  //           tray.active = false;
  //           this.refresh();
  //         }
  //       });
  //       break;
  //   }
  // }
}
