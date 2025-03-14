export class TargetHelper {
  constructor() {}
  static makeTargetLine(target) {
    const graphics = new PIXI.Graphics();
    const arrow = new PIXI.Graphics();
    let angle;
    function drawCurvedDashedLineWithArrow(
      x1,
      y1,
      x2,
      y2,
      dashLength = 10,
      gapLength = 5,
      arrowSize = 10
    ) {
      graphics.clear();
      const localPos = canvas.stage.toLocal(new PIXI.Point(x2, y2));
      let curveHeight = -200;

      const lineLength = Math.sqrt(
        (localPos.x - x1) ** 2 + (localPos.y - y1) ** 2
      );

      const dx = (localPos.x - x1) / lineLength;
      const dy = (localPos.y - y1) / lineLength;

      let currentLength = 0;

      curveHeight = -200;

      graphics.lineStyle(6, "#cf0000", 0);

      while (currentLength < lineLength) {
        curveHeight = lineLength * -0.2;
        dashLength = lineLength * 0.05;
        gapLength = lineLength * 0.02;

        const dashStartX = x1 + dx * currentLength;
        const dashStartY =
          y1 +
          dy * currentLength +
          Math.sin(currentLength / lineLength * Math.PI) * curveHeight;
        let dashEndX =
          x1 + dx * Math.min(currentLength + dashLength, lineLength);
        let dashEndY =
          y1 +
          dy * Math.min(currentLength + dashLength, lineLength) +
          Math.sin((currentLength + dashLength) / lineLength * Math.PI) *
            curveHeight;

        let opacity = Math.min(currentLength / (0.8 * lineLength), 1);

        graphics.lineStyle(
          1 / (currentLength / lineLength) + 4,
          "#cf0000",
          opacity
        );

        graphics.moveTo(dashStartX, dashStartY);
        graphics.lineTo(dashEndX, dashEndY);

        currentLength += dashLength + gapLength;
        angle = Math.atan2(localPos.y - dashEndY, localPos.x - dashEndX);
        if (currentLength >= lineLength * 0.95) {
          break;
        }
      }

      arrow.clear();
      arrow.beginFill("#cf0000");
      arrow.moveTo(0, 0);
      arrow.lineTo(-20, -8);
      arrow.lineTo(-20, 8);
      arrow.lineTo(0, 0);
      arrow.endFill();

      const offset = -20;
      const arrowX = localPos.x - Math.cos(angle) * offset;
      const arrowY = localPos.y - Math.sin(angle) * offset;
      arrow.position.set(arrowX, arrowY);
      arrow.rotation = angle;
      canvas.stage.addChild(graphics);
      canvas.stage.addChild(arrow);
    }

    let actor = game.actors.getName("Zeran").getActiveTokens()[0];
    let startX = actor.position.x + actor.shape.width / 2;
    let startY = actor.position.y + actor.shape.width / 2;

    function onMouseMove(event) {
      const mouseX = event.clientX;
      const mouseY = event.clientY;
      drawCurvedDashedLineWithArrow(startX, startY, mouseX, mouseY);
    }
    window.addEventListener("mousemove", onMouseMove);

    setTimeout(() => {
      window.addEventListener("click", () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("click", () => {});
      });
    }, 1000);

    drawCurvedDashedLineWithArrow(startX, 100, startX, 500);
  }
}
