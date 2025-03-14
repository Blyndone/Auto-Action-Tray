export class TargetHelper {
  constructor() {}
  static makeTargetLine(target) {
    // Blue line with a thickness of 2
    let actor = game.actors.getName("Zeran").getActiveTokens()[0];
    let startX = actor.position.x + actor.shape.width / 2;
    let startY = actor.position.y + actor.shape.width / 2;

    line.moveTo(startX, startY);

    // Add the line to the stage
    canvas.stage.addChild(line);
    canvas.stage.addChild(arrow);

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    // Function to update the line
    function updateLine(mouseX, mouseY) {
      const localPos = canvas.stage.worldTransform.applyInverse({
        x: mouseX,
        y: mouseY
      });

      const midX = (startX + localPos.x) / 2;
      const midY = (startY + localPos.y) / 2 - 100;

      line.clear(); // Clear old line
      line.lineStyle(4, "#cf0000"); // Reapply line style
      line.moveTo(
        clamp(
          localPos.x,
          actor.position.x,
          actor.position.x + actor.shape.width
        ),
        clamp(
          localPos.y,
          actor.position.y,
          actor.position.y + actor.shape.height
        )
      );

      line.mask = sprite; //he
      line.quadraticCurveTo(midX, midY, localPos.x, localPos.y);
      const angle = Math.atan2(localPos.y - midY, localPos.x - midX); // Get angle of last segment

      // Draw the arrowhead
      arrow.clear();
      arrow.beginFill("#cf0000"); // Same color as line
      arrow.moveTo(0, 0);
      arrow.lineTo(-20, -8); // Left side of arrow
      arrow.lineTo(-20, 8); // Right side of arrow
      arrow.lineTo(0, 0);
      arrow.endFill();

      const offset = -5; // Adjust this value to move arrow more or less
      const arrowX = localPos.x - Math.cos(angle) * offset;
      const arrowY = localPos.y - Math.sin(angle) * offset;
      arrow.position.set(arrowX, arrowY);
      arrow.rotation = angle;
    }

    // Define the mousemove event listener
    function onMouseMove(event) {
      const mouseX = event.clientX;
      const mouseY = event.clientY;
      updateLine(mouseX, mouseY); // Update line to follow the mouse
    }

    // Add the mousemove event listener
    window.addEventListener("mousemove", onMouseMove);

    // Set a timeout to remove the event listener after 1 second
    setTimeout(() => {
      window.addEventListener("click", () => {
        line.clear(); // Clear the line on click
        arrow.clear(); // Clear the arrowhead on click
        // Remove the mousemove event listener
        window.removeEventListener("mousemove", onMouseMove);
      });
    }, 1000);
  }

  static makeTargetLine2(target) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", window.innerWidth);
    svg.setAttribute("height", window.innerHeight);
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.classList.add("test");

    document.body.appendChild(svg);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "m 0 0 c 400 -200 600 -200 1000 0"); // Example curved path
    path.setAttribute("stroke", "red");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "2");

    svg.appendChild(path);

    gsap.registerPlugin(MotionPathPlugin);

    // Set the initial path using a cubic Bezier curve and absolute endpoint
    gsap.set(path, {
      attr: {
        d: "M 500 500 C 400 -200 600 -200 1000 0" // Initial cubic Bezier path
      }
    });

    let lastMousePos = { x: 0, y: 0 };

    canvas.app.view.addEventListener("mousemove", event => {
      lastMousePos.x = event.clientX;
      lastMousePos.y = event.clientY;

      // Call update function in sync with the frame rate
      window.requestAnimationFrame(updatePath);
    });

    function updatePath() {
      gsap.to(path, {
        duration: 0.1,
        attr: {
          d: `M 500 500 C 800 -200 1000 -200 ${lastMousePos.x} ${lastMousePos.y}`
        }
      });
    }

    setTimeout(() => {
      addEventListener("click", event => {
        svg.remove();
      });
    }, 1000);
    // this.animating = true;
  }
}
