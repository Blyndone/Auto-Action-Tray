export class AnimationHandler {
  constructor() {
    this.animations = [];
  }

  static animateSwapTrays(tray1, tray2, hotbar) {
    hotbar.animating = true;
    var tl = gsap.timeline();
    tl
      .add("start")
      .fromTo(
        "." + tray1.id,
        {
          opacity: 0,
          y: tray1.type == "static" ? -200 : 0,
          x: tray1.type == "custom" ? 1000 : 0
        },
        {
          opacity: 1,
          y: 0,
          x: 0,
          duration: hotbar.animationDuration,
          onStart: () => {}
        },
        "start"
      )
      .to(
        "." + tray2.id,
        {
          opacity: 0,
          y: tray2.type == "static" ? -200 : 0,
          x: tray2.type == "custom" ? 1000 : 0,
          duration: hotbar.animationDuration,
          onStart: () => {},
          onComplete: () => {
            hotbar.trayInformation = "";
            hotbar.animating = false;
            hotbar.currentTray.active = true;
            hotbar.targetTray.active = false;
            // hotbar.currentTray = hotbar.targetTray;
            hotbar.refresh();
          }
        },
        "start"
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
