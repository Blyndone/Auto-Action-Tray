export class Pathfinding {
  constructor(options) {
    //constants
    this.active = true;
    this.maxDepth = 6;

    this.tokens = null;
    this.gridSize = canvas.grid.size;
    this.sourceToken = null;
    this.targetPosition = null;
    // this.targetToken = { x: 2500, y: 2500 }; // Temporary hardcoded target for testing

    this.occupiedSquares = null;

    // const t0 = performance.now();

    this.path = null;

    // const t1 = performance.now();
    // const duration = (t1 - t0).toFixed(2);
  }

  setActive() {
    this.active = true;
  }
  setInactive() {
    this.active = false;
    this.clearRuler();
  }

  setMaxDepth(depth) {
    this.maxDepth = depth;
  }

  getPath() {
    return this.path;
  }

  setData(options) {
    //options = {sourceToken: token, targetPosition: {x:1000, y:1000}}
    this.ruler = canvas.controls.getRulerForUser(game.user.id);
    this.tokens = canvas.tokens.placeables;
    this.gridSize = canvas.grid.size;
    this.sourceToken = options.sourceToken;
    this.targetPosition = options.targetPosition;
    this.setMaxDepth(options.speed / 5);
    this.occupiedSquares = this.generateOccupiedSquares();
  }

  updateTargetPosition(newTarget) {
    this.targetPosition = newTarget;
  }

  clearData() {
    this.tokens = null;
    this.sourceToken = null;
    this.targetPosition = null;
    this.occupiedSquares = null;
    this.path = null;
    this.clearRuler();
  }

  newPathfinding(options) {
    if (options.sourceToken == this.sourceToken) {
      return this.updatePathfinding(options.targetPosition);
    }
    this.setData(options);
    this.path = this.findPath(
      { x: this.sourceToken.x, y: this.sourceToken.y },
      { x: this.targetPosition.x, y: this.targetPosition.y }
    );
    this.setRuler(this.path);

    return this.path ? this.path : null;
  }

  updatePathfinding(targetPosition) {
    this.clearRuler();
    this.updateTargetPosition(targetPosition);
    this.path = this.findPath(
      { x: this.sourceToken.x, y: this.sourceToken.y },
      { x: this.targetPosition.x, y: this.targetPosition.y }
    );
    this.setRuler(this.path);
    return this.path ? this.path : null;
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

    while (openSet.length > 0) {
      openSet.sort((a, b) => fScore.get(this.key(a)) - fScore.get(this.key(b)));
      const current = openSet.shift();
      const currentDepth = gScore.get(this.key(current)) / this.gridSize;

      // Limit search by number of squares added (depth)
      if (currentDepth > this.maxDepth) continue;

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

    return []; // no path found
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
      // console.log("Added waypoint:", path[i]);
    }
    ruler.color = Color.fromString("#FF00FF");
    // console.log(ruler.totalDistance);
    ruler.measure(path[path.length - 1]);
  }

  clearRuler() {
    const ruler = canvas.controls.getRulerForUser(game.user.id);
    ruler.clear();
  }
}
