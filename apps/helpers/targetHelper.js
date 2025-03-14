export class TargetHelper {
  constructor() {}
  static makeTargetLine(target) {
    const graphics = new PIXI.Graphics();
    const arrow = new PIXI.Graphics();
    graphics.eventMode = false;
    arrow.eventMode = false;
    canvas.layers[3].addChild(graphics);

    function drawCurvedLineWithAlpha(x1, y1, x2, y2) {
      graphics.clear();
      arrow.clear();
      const localPos = canvas.layers[3].toLocal(new PIXI.Point(x2, y2));

      const curveHeight = -200; // Height of the curve
      graphics.lineStyle(5, 0xff0000, 0); // Start with transparent alpha
      graphics.moveTo(x1, y1);
      let points = [0, 0, 0];
      let distance = Math.sqrt((localPos.x - x1) ** 2 + (localPos.y - y1) ** 2);

      // Set the transparency transition manually
      for (let i = 0; i <= 100; i++) {
        const alpha = i / 100; // Gradually increase alpha from 0 to 1
        const t = i / 100;
        const cx = x1 + (localPos.x - x1) * t; // Interpolate x position
        const cy = y1 + (localPos.y - y1) * t + curveHeight * (1 - t) * t; // Interpolate y position for curve

        points.push({
          x: cx,
          y: cy
        });
        if (points.length > 3) {
          points.shift(); // Remove the first (oldest) point to maintain only 3 points
        }

        graphics.lineStyle(5, 0xff0000, alpha); // Change alpha as we draw

        if (i === 0) {
          graphics.moveTo(cx, cy); // Set the initial point
        } else {
          graphics.lineTo(cx, cy); // Draw the curve line
        }
      }
      // Calculate the tangent at the end of the curve (at the last point)
      const p0 = points[points.length - 2]; // Second to last point
      const p1 = points[points.length - 1]; // Last point

      // Tangent direction (simple approximation using the two last points)
      const tangentX = p1.x - p0.x;
      const tangentY = p1.y - p0.y;
      const angle = Math.atan2(tangentY, tangentX); // Get the angle of the tangent

      const arrowSize = 15; // Size of the arrow

      // Create the arrow shape

      arrow.beginFill(0xff0000); // Set the color of the arrow (same as the line)
      arrow.moveTo(0, 0);
      arrow.lineTo(-arrowSize, -arrowSize / 2);
      arrow.lineTo(-arrowSize, arrowSize / 2);
      arrow.closePath();
      arrow.endFill();

      // Position the arrow at the end of the curve
      arrow.x = localPos.x;
      arrow.y = localPos.y;
      arrow.rotation = angle; // Rotate the arrow to match the angle of the line
      // Shift the arrow further along the curve (beyond the last point)
      const shiftAmount = 10; // How much to shift the arrow beyond the endpoint
      const shiftX =
        tangentX *
        shiftAmount /
        Math.sqrt(tangentX * tangentX + tangentY * tangentY);
      const shiftY =
        tangentY *
        shiftAmount /
        Math.sqrt(tangentX * tangentX + tangentY * tangentY);

      // Position the arrow further along the curve
      arrow.x = p1.x + shiftX;
      arrow.y = p1.y + shiftY;
      arrow.rotation = angle; // Rotate the arrow to match the direction of the tangent

      graphics.filters = [new PIXI.BlurFilter(2, 4)];
      arrow.filters = [new PIXI.BlurFilter(1, 4)];
      // // Apply the glow filter to both the line and arrow
      // graphics.filters = [glowFilter]; // Apply to line
      // arrow.filters = [glowFilter]; // Appl
      canvas.layers[3].addChild(arrow);
    }

    let actor = game.actors.getName("Zeran").getActiveTokens()[0];
    let startX = actor.position.x + actor.shape.width / 2;
    let startY = actor.position.y + actor.shape.width / 2;
    canvas.layers[3].addChild(graphics);

    function onMouseMove(event) {
      window.requestAnimationFrame(() => {
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        let startX = actor.position.x + actor.shape.width / 2;
        let startY = actor.position.y + actor.shape.height / 2;
        console.log(startX, startY, mouseX, mouseY);
        drawCurvedLineWithAlpha(startX, startY, mouseX, mouseY);
      });
    }
    window.addEventListener("mousemove", onMouseMove);

    setTimeout(() => {
      window.addEventListener("click", () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("click", () => {});
      });
    }, 1000);
  }
}
