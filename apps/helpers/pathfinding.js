export class Pathfinding {
  constructor(options) {
    //constants
    this.maxDepth = 100;

    this.tokens = canvas.tokens.placeables;
    this.gridSize = canvas.grid.size;
    this.sourceToken = options.sourceToken;
    this.targetToken = options.targetToken;
    // this.targetToken = { x: 2500, y: 2500 }; // Temporary hardcoded target for testing

    this.occupiedSquares = this.generateOccupiedSquares();

    //debug Calls
    // this.occupiedSquares.forEach(sq => {
    //   this.debugDisplayValue(sq.name, {
    //     x: sq.x + this.gridSize / 2,
    //     y: sq.y + this.gridSize / 2
    //   });
    // });
    // this.debugDisplayValue("START", {
    //   x: this.sourceToken.x + this.gridSize / 2,
    //   y: this.sourceToken.y + this.gridSize / 2
    // });
    // this.debugDisplayValue("END", {
    //   x: this.targetToken.x + this.gridSize / 2,
    //   y: this.targetToken.y + this.gridSize / 2
    // });

    // this.adjacentSquares({
    //   x: this.sourceToken.x,
    //   y: this.sourceToken.y
    // }).forEach(sq => {
    //   this.debugDisplayValue("ADJ", {
    //     x: sq.x + this.gridSize / 2,
    //     y: sq.y + this.gridSize / 2
    //   });
    // });

    const t0 = performance.now();

    this.path = this.findPath(
      { x: this.sourceToken.x, y: this.sourceToken.y },
      { x: this.targetToken.x, y: this.targetToken.y }
    );

    const t1 = performance.now();
    const duration = (t1 - t0).toFixed(2);

    // if (this.path?.length) {
    //   console.log(`✅ Path found in ${duration} ms`);
    //   console.log(`🧩 Path length: ${this.path.length}`);
    //   console.log("📍 Path nodes:", this.path);
    // } else {
    //   console.warn(`⚠️ No path found (took ${duration} ms)`);
    // }
    // console.log(this.sourceToken);
    this.setRuler(this.path);

    // this.path.forEach(sq => {
    //   this.debugDisplayValue("PATH", {
    //     x: sq.x + this.gridSize / 2,
    //     y: sq.y + this.gridSize / 2
    //   });
    // });
    // console.log(this.occupiedSquares);
  }

  heuristic(a, b) {
    // return Math.min(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  generateOccupiedSquares() {
    const occupiedSquares = this.tokens.flatMap(token => {
      const squares = [];

      for (let dx = 0; dx < token.w / this.gridSize; dx++) {
        for (let dy = 0; dy < token.h / this.gridSize; dy++) {
          squares.push({
            x: token.x + dx * this.gridSize,
            y: token.y + dy * this.gridSize,
            name: token.name,
            disposition: token.document.disposition
          });
        }
      }

      return squares;
    });

    return occupiedSquares;
  }
  isOccupied(square) {
    return this.occupiedSquares.some(
      sq => sq.x === square.x && sq.y === square.y
    );
  }

  debugDisplayValue(value, position) {
    const text = new PIXI.Text(value, {
      fontFamily: "Arial",
      fontSize: 12,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 4
    });
    text.anchor.set(0.5);
    text.position.set(position.x, position.y);
    canvas.stage.addChild(text);

    setTimeout(() => {
      canvas.stage.removeChild(text);
    }, 1000);
  }

  adjacentSquares(square) {
    const g = this.gridSize;
    const directions = [
      { x: -g, y: 0 },
      { x: g, y: 0 },
      { x: 0, y: -g },
      { x: 0, y: g },
      { x: -g, y: -g },
      { x: g, y: -g },
      { x: -g, y: g },
      { x: g, y: g }
    ];

    const results = [];

    for (const dir of directions) {
      const next = { x: square.x + dir.x, y: square.y + dir.y };

      // Skip if occupied
      if (this.isOccupied(next)) continue;

      // For diagonals, prevent cutting corners
      const isDiagonal = dir.x !== 0 && dir.y !== 0;
      if (isDiagonal) {
        const horiz = { x: square.x + dir.x, y: square.y };
        const vert = { x: square.x, y: square.y + dir.y };

        if (this.isOccupied(horiz) || this.isOccupied(vert)) continue;
      }

      results.push(next);
    }

    return results;
  }

  findPath(start, goal) {
    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map([[this.key(start), 0]]);
    const fScore = new Map([[this.key(start), this.heuristic(start, goal)]]);

    let depth = 0;
    while (openSet.length > 0) {
      depth++;
      if (depth > this.maxDepth) break;
      openSet.sort((a, b) => fScore.get(this.key(a)) - fScore.get(this.key(b)));
      const current = openSet.shift();

      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstructPath(cameFrom, current);
      }

      for (const neighbor of this.adjacentSquares(current)) {
        if (this.isOccupied(neighbor)) continue;

        const tentative_g = gScore.get(this.key(current)) + this.gridSize;
        const keyN = this.key(neighbor);

        if (!gScore.has(keyN) || tentative_g < gScore.get(keyN)) {
          cameFrom.set(keyN, current);
          gScore.set(keyN, tentative_g);
          fScore.set(keyN, tentative_g + this.heuristic(neighbor, goal));
          if (!openSet.find(n => n.x === neighbor.x && n.y === neighbor.y))
            openSet.push(neighbor);
        }
      }
    }

    return []; // no path
  }

  key(sq) {
    return `${sq.x},${sq.y}`;
  }

  reconstructPath(cameFrom, current) {
    const path = [current];
    while (cameFrom.has(this.key(current))) {
      current = cameFrom.get(this.key(current));
      path.unshift(current);
    }

    return this.simplifyPath(path);
  }

  simplifyPath(path) {
    if (!path || path.length <= 2) return path;

    const simplified = [path[0]]; // always keep the start
    let prevDir = null;

    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      const dir = { x: Math.sign(dx), y: Math.sign(dy) };

      // direction changed?
      if (!prevDir || dir.x !== prevDir.x || dir.y !== prevDir.y) {
        simplified.push(path[i - 1]);
        prevDir = dir;
      }
    }

    // always include final node
    simplified.push(path[path.length - 1]);

    return simplified;
  }

  setRuler(path) {
    //canvas.controls.getRulerForUser(game.user.id)._addWaypoint({x:1000, y:1000})
    if (!path || path.length === 0) return;
    const ruler = canvas.controls.getRulerForUser(game.user.id);
    ruler.clear();
    ruler._startMeasurement(path[0]);
    for (let i = 1; i < path.length; i++) {
      ruler._addWaypoint(path[i]);
      console.log("Added waypoint:", path[i]);
    }
    ruler.measure(path[path.length - 1]);
  }

  clearRuler() {
    const ruler = canvas.controls.getRulerForUser(game.user.id);
    ruler.clear();
  }
}
