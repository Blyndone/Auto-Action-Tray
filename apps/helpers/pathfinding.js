import { count, note, time } from './perfTrace.js'
import { gridDistance } from './distance.js'
import { markRulerPreview, clearRulerPreview } from './tokenRuler.js'

/**
 * A* pathfinding for the quick-action helper.
 *
 * Works in grid *offsets* (`{i, j}`) rather than pixel coordinates. Everything the search touches
 * goes through `canvas.grid`, so square, hex-row and hex-column scenes all work; gridless scenes
 * have no discrete cells to search and fall back to a direct path.
 *
 * Core's `Token#findMovementPath` is not a router - it constrains a direct path and resolves
 * synchronously - so the actual obstacle avoidance has to live here. What core *is* used for is
 * turning the resulting cell list into movement waypoints, which is why `MOVEMENT_OPTIONS` is
 * shared between the preview ruler and the real move: if the two disagree, the ruler shows one
 * route and the token walks another.
 */

const { GRID_DIAGONALS, GRID_TYPES } = CONST

/**
 * Options used both to preview the path on the ruler and to execute the move. These must stay
 * identical or the preview lies. Walls are deliberately *not* ignored - the search already routes
 * around them, so letting core constrain against them as well is a consistency check rather than
 * a second opinion.
 */
export const MOVEMENT_OPTIONS = Object.freeze({
  ignoreWalls: false,
  ignoreCost: true,
  history: false,
  // `preview: true` would make core discard collisions the user has not seen through fog. The
  // search has no fog model - every wall blocks it - so previewing that way would let the ruler
  // draw through a wall the search already refused to cross.
  preview: false,
})

/**
 * Offset keys are packed into a single integer so the open/closed sets and score maps can use
 * numeric keys instead of strings. Grid offsets comfortably fit the +/-16k range this allows.
 */
const KEY_ORIGIN = 1 << 14
const KEY_STRIDE = 1 << 15

function offsetKey(i, j) {
  return (i + KEY_ORIGIN) * KEY_STRIDE + (j + KEY_ORIGIN)
}

/**
 * Binary min-heap keyed on fScore.
 *
 * Replaces the previous `openSet.sort()`-on-every-pop, which made the search O(n^2 log n) and
 * turned a depth-50 search into a multi-second freeze.
 */
class MinHeap {
  constructor() {
    this.items = []
    this.scores = []
  }

  get size() {
    return this.items.length
  }

  push(item, score) {
    const { items, scores } = this
    let n = items.length
    items.push(item)
    scores.push(score)
    while (n > 0) {
      const parent = (n - 1) >> 1
      if (scores[parent] <= scores[n]) break
      ;[items[parent], items[n]] = [items[n], items[parent]]
      ;[scores[parent], scores[n]] = [scores[n], scores[parent]]
      n = parent
    }
  }

  pop() {
    const { items, scores } = this
    const top = items[0]
    const lastItem = items.pop()
    const lastScore = scores.pop()
    if (items.length > 0) {
      items[0] = lastItem
      scores[0] = lastScore
      let n = 0
      for (;;) {
        const left = 2 * n + 1
        const right = left + 1
        let smallest = n
        if (left < scores.length && scores[left] < scores[smallest]) smallest = left
        if (right < scores.length && scores[right] < scores[smallest]) smallest = right
        if (smallest === n) break
        ;[items[smallest], items[n]] = [items[n], items[smallest]]
        ;[scores[smallest], scores[n]] = [scores[n], scores[smallest]]
        n = smallest
      }
    }
    return top
  }
}

export class Pathfinding {
  constructor() {
    this.active = true

    // Session state - set once when the source token changes.
    this.sourceToken = null
    this.ruler = null

    // Volatile state - rebuilt on every search, because tokens move between searches and the
    // previous implementation froze this after the first call of a hover session.
    this.occupied = new Set()
    this.bounds = null
    this.sourceFootprint = [{ di: 0, dj: 0 }]
    this.targetFootprint = []
    this.gridSize = 100
    this.gridUnit = 5
    this.maxDepth = 6
    this.rangeSquares = 1
    this.wallCache = new Map()

    this.targetToken = null
    this.path = null
    this.endPos = null

    this.diagonalRule = GRID_DIAGONALS.EQUIDISTANT
    this.alternatingDiagonals = false
    this.initialDiagonalParity = 0

    this._pathfindingResolve = null

    this._debouncedSearch = foundry.utils.debounce(() => {
      const resolve = this._pathfindingResolve
      this._pathfindingResolve = null
      if (!resolve) return
      resolve(this._runSearch())
    }, 50)
  }

  setActive() {
    this.active = true
  }

  setInactive() {
    this.active = false
    this.clearRuler()
  }

  getPath() {
    return this.path
  }

  /* -------------------------------------------- */
  /*  Entry points                                */
  /* -------------------------------------------- */

  /**
   * Run a search for the given source/target pair. Always resolves to a `{path, endPos}` pair -
   * never null - so callers can destructure it without a guard.
   */
  async newPathfinding(options) {
    this._pendingOptions = options
    return await this._schedule()
  }

  /**
   * Kept for API compatibility with the previous two-entry-point shape. Both paths now refresh
   * volatile state, so there is no longer a "cheap" variant that reuses a stale occupancy grid.
   */
  async updatePathfinding(options) {
    return await this.newPathfinding(options)
  }

  _schedule() {
    return new Promise((resolve) => {
      // Settle any superseded promise instead of dropping it. Previously the resolver was simply
      // overwritten, so every search abandoned mid-debounce left an `await` that never returned.
      if (this._pathfindingResolve) this._pathfindingResolve({ path: [], endPos: null })
      this._pathfindingResolve = resolve
      this._debouncedSearch()
    })
  }

  /* -------------------------------------------- */
  /*  Search setup                                */
  /* -------------------------------------------- */

  _runSearch() {
    const options = this._pendingOptions
    if (!options?.sourceToken || !options?.targetToken) return { path: [], endPos: null }

    const endTimer = time('pathfinding search')

    this._beginSession(options.sourceToken)
    if (!this._refreshVolatile(options)) {
      endTimer('unsupported grid')
      return this._directPath(options)
    }

    const start = canvas.grid.getOffset({ x: this.sourceToken.x, y: this.sourceToken.y })
    const goal = canvas.grid.getOffset({ x: this.targetToken.x, y: this.targetToken.y })

    // Reset per-search results so a failed search cannot hand back the previous run's endpoint.
    this.endPos = null
    this.path = []

    const result = this._search(start, goal)
    this.path = result.path
    this.endPos = result.endPos

    endTimer(`${result.expanded} expanded, ${result.path.length} steps`)

    this.setRuler(this.path)
    return { path: this.path, endPos: this.endPos }
  }

  _beginSession(sourceToken) {
    if (this.sourceToken !== sourceToken) {
      this.clearRuler()
      this.sourceToken = sourceToken
    }
    this.ruler = sourceToken?.ruler ?? null
  }

  /**
   * Rebuild everything that can change between two searches: grid metrics, token occupancy,
   * footprints, movement budget and weapon range. Returns false when the grid cannot be searched
   * (gridless), in which case the caller falls back to a direct path.
   */
  _refreshVolatile(options) {
    const grid = canvas.grid
    this.gridSize = grid.size
    this.gridUnit = gridDistance()
    this.wallCache.clear()
    this.targetToken = options.targetToken

    if (grid.type === GRID_TYPES.GRIDLESS) return false

    this.diagonalRule = grid.diagonals ?? GRID_DIAGONALS.EQUIDISTANT
    this.alternatingDiagonals =
      this.diagonalRule === GRID_DIAGONALS.ALTERNATING_1 ||
      this.diagonalRule === GRID_DIAGONALS.ALTERNATING_2
    this.initialDiagonalParity = this.diagonalRule === GRID_DIAGONALS.ALTERNATING_2 ? 1 : 0

    this.sourceFootprint = this._footprintDeltas(this.sourceToken)
    this.targetFootprint = this._footprintDeltas(this.targetToken)

    // Range 0 used to mean "stand on top of the target", which is unreachable because the target
    // occupies those cells - so the search drained the entire frontier and silently gave up.
    // Anything without a usable range is treated as melee reach instead.
    const range = Number.isFinite(options.range) ? options.range : 0
    this.rangeSquares = Math.max(1, Math.ceil(range / this.gridUnit))

    this.maxDepth = this._movementBudgetSquares(options)
    this.occupied = this._buildOccupancy()
    this.bounds = this._canvasBounds()

    return true
  }

  /**
   * Offset range the token may occupy, taken from the padded canvas rect rather than the scene
   * rect, since tokens can legitimately sit in the padding.
   *
   * Without this the grid is infinite, and the search happily routes around a wall by leaving the
   * map entirely.
   */
  _canvasBounds() {
    const rect = canvas.dimensions?.rect
    if (!rect) return null
    const [i0, j0, i1, j1] = canvas.grid.getOffsetRange({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })
    return { i0, j0, i1, j1 }
  }

  /** Cell offsets a token covers, relative to its own anchor offset. */
  _footprintDeltas(token) {
    if (!token) return [{ di: 0, dj: 0 }]
    const grid = canvas.grid
    const anchor = grid.getOffset({ x: token.x, y: token.y })
    const [i0, j0, i1, j1] = grid.getOffsetRange({
      x: token.x,
      y: token.y,
      width: token.w,
      height: token.h,
    })

    const deltas = []
    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        deltas.push({ di: i - anchor.i, dj: j - anchor.j })
      }
    }
    return deltas.length ? deltas : [{ di: 0, dj: 0 }]
  }

  /**
   * Cells that block movement.
   *
   * Excludes the source token itself (a Large token was previously blocked by its own footprint),
   * tokens the user cannot see (their positions used to leak through path deflection), and tokens
   * on a clearly different elevation band.
   */
  _buildOccupancy() {
    const grid = canvas.grid
    const occupied = new Set()
    const sourceElevation = this.sourceToken?.document?.elevation ?? 0
    const band = this.gridUnit

    for (const token of canvas.tokens.placeables) {
      if (token === this.sourceToken) continue
      if (!token.visible) continue

      const elevation = token.document?.elevation ?? 0
      if (Math.abs(elevation - sourceElevation) >= band) continue

      const [i0, j0, i1, j1] = grid.getOffsetRange({
        x: token.x,
        y: token.y,
        width: token.w,
        height: token.h,
      })
      for (let i = i0; i < i1; i++) {
        for (let j = j0; j < j1; j++) occupied.add(offsetKey(i, j))
      }
    }

    return occupied
  }

  /**
   * Search depth in squares.
   *
   * `unboundPathfindingDepth` selects between a fixed configured cap and one derived from the
   * actor's remaining movement - it has never meant "no limit".
   */
  _movementBudgetSquares(options) {
    const configured = game.settings.get('auto-action-tray', 'quickActionDepth') || 6
    if (game.settings.get('auto-action-tray', 'unboundPathfindingDepth')) return configured

    const speed = Number.isFinite(options.speed) ? options.speed : 30
    const remaining = Math.max(0, speed - this._movementUsed())
    return Math.max(0, Math.min(configured, Math.floor(remaining / this.gridUnit)))
  }

  /**
   * Distance already spent this turn, read from the token's movement history.
   *
   * This only works because the module no longer calls `clearMovementHistory()` on every hover -
   * that used to destroy the very record core and dnd5e use to track movement.
   */
  _movementUsed() {
    const document = this.sourceToken?.document
    const history = document?.movementHistory
    if (!history?.length) return 0
    try {
      const measured = this.sourceToken.measureMovementPath(history)
      const used = measured?.cost ?? measured?.distance ?? 0
      return Number.isFinite(used) ? used : 0
    } catch {
      return 0
    }
  }

  /* -------------------------------------------- */
  /*  Grid geometry                               */
  /* -------------------------------------------- */

  /** Cost in squares of a single step, given whether it is diagonal and the alternation parity. */
  _stepCost(isDiagonal, parity) {
    if (!isDiagonal) return 1
    switch (this.diagonalRule) {
      case GRID_DIAGONALS.EXACT:
        return Math.SQRT2
      case GRID_DIAGONALS.APPROXIMATE:
        return 1.5
      case GRID_DIAGONALS.RECTILINEAR:
        return 2
      case GRID_DIAGONALS.ALTERNATING_1:
      case GRID_DIAGONALS.ALTERNATING_2:
        return parity === 0 ? 1 : 2
      default:
        return 1
    }
  }

  /**
   * Grid distance in squares between two offsets, matching core's single-segment measurement.
   * Used for range checks and for the heuristic on square grids.
   */
  _distanceSquares(iA, jA, iB, jB) {
    let di = Math.abs(iA - iB)
    let dj = Math.abs(jA - jB)
    if (di < dj) [di, dj] = [dj, di]

    switch (this.diagonalRule) {
      case GRID_DIAGONALS.EXACT:
        return di + (Math.SQRT2 - 1) * dj
      case GRID_DIAGONALS.APPROXIMATE:
        return di + 0.5 * dj
      case GRID_DIAGONALS.RECTILINEAR:
      case GRID_DIAGONALS.ILLEGAL:
        return di + dj
      case GRID_DIAGONALS.ALTERNATING_1:
      case GRID_DIAGONALS.ALTERNATING_2:
        return di + Math.floor(dj / 2)
      default:
        return di
    }
  }

  /**
   * Admissible, consistent heuristic.
   *
   * On square grids every step costs at least 1 square and reduces Chebyshev distance by at most
   * 1, so plain Chebyshev is admissible under *every* diagonal rule. Hex grids have no diagonals
   * and uniform step cost, so the grid's own measurement is exact.
   */
  _heuristic(i, j, goalI, goalJ) {
    if (canvas.grid.isSquare) {
      return Math.max(Math.abs(i - goalI), Math.abs(j - goalJ))
    }
    const measured = canvas.grid.measurePath([
      canvas.grid.getCenterPoint({ i, j }),
      canvas.grid.getCenterPoint({ i: goalI, j: goalJ }),
    ])
    return (measured?.distance ?? 0) / this.gridUnit
  }

  /**
   * True when placing the source token's footprint at this anchor overlaps a blocked cell or
   * leaves the canvas.
   */
  _footprintBlocked(i, j) {
    const bounds = this.bounds
    for (const { di, dj } of this.sourceFootprint) {
      const ci = i + di
      const cj = j + dj
      if (bounds && (ci < bounds.i0 || ci >= bounds.i1 || cj < bounds.j0 || cj >= bounds.j1)) {
        return true
      }
      if (this.occupied.has(offsetKey(ci, cj))) return true
    }
    return false
  }

  /**
   * Wall check between two anchors, testing every cell of the source footprint so a Large token
   * cannot squeeze part of itself through a wall. Results are cached because diagonal
   * corner-checks re-test the same edges repeatedly.
   */
  _blockedByWall(fromI, fromJ, toI, toJ) {
    // `to` is always adjacent to `from`, so the edge can be keyed as origin + direction index
    // (0-8). Packing two full offset keys instead would overflow the safe-integer range.
    const direction = (toI - fromI + 1) * 3 + (toJ - fromJ + 1)
    const cacheKey = offsetKey(fromI, fromJ) * 9 + direction
    const cached = this.wallCache.get(cacheKey)
    if (cached !== undefined) return cached

    const backend = CONFIG.Canvas.polygonBackends.move
    let blocked = false

    for (const { di, dj } of this.sourceFootprint) {
      const from = canvas.grid.getCenterPoint({ i: fromI + di, j: fromJ + dj })
      const to = canvas.grid.getCenterPoint({ i: toI + di, j: toJ + dj })
      count('wall tests')
      if (backend.testCollision(from, to, { type: 'move', mode: 'any' })) {
        blocked = true
        break
      }
    }

    this.wallCache.set(cacheKey, blocked)
    return blocked
  }

  /** Legal neighbours of an anchor, honouring occupancy, walls and corner-cutting. */
  _neighbors(i, j) {
    const results = []
    for (const adjacent of canvas.grid.getAdjacentOffsets({ i, j })) {
      const ni = adjacent.i
      const nj = adjacent.j

      if (this._footprintBlocked(ni, nj)) continue

      const di = ni - i
      const dj = nj - j
      const isDiagonal = canvas.grid.isSquare && di !== 0 && dj !== 0

      // Do not cut corners around blocked cells.
      if (isDiagonal) {
        if (this._footprintBlocked(i + di, j)) continue
        if (this._footprintBlocked(i, j + dj)) continue
        if (this._blockedByWall(i, j, i + di, j)) continue
        if (this._blockedByWall(i, j, i, j + dj)) continue
      }

      if (this._blockedByWall(i, j, ni, nj)) continue

      results.push({ i: ni, j: nj, isDiagonal })
    }
    return results
  }

  /* -------------------------------------------- */
  /*  Goal test                                   */
  /* -------------------------------------------- */

  /**
   * Is the target attackable with the source token's footprint anchored here?
   *
   * Measures footprint-to-footprint rather than to the target's top-left corner, which is what
   * previously made reach weapons and any non-1x1 token measure from the wrong cell.
   */
  _inRange(i, j) {
    const target = this.targetToken
    if (!target) return false
    const targetAnchor = canvas.grid.getOffset({ x: target.x, y: target.y })

    // Fast path: both tokens are a single cell.
    if (this.sourceFootprint.length === 1 && this.targetFootprint.length === 1) {
      return this._distanceSquares(i, j, targetAnchor.i, targetAnchor.j) <= this.rangeSquares
    }

    for (const source of this.sourceFootprint) {
      for (const cell of this.targetFootprint) {
        const distance = this._distanceSquares(
          i + source.di,
          j + source.dj,
          targetAnchor.i + cell.di,
          targetAnchor.j + cell.dj,
        )
        if (distance <= this.rangeSquares) return true
      }
    }
    return false
  }

  /* -------------------------------------------- */
  /*  A*                                          */
  /* -------------------------------------------- */

  _search(start, goal) {
    const empty = { path: [], endPos: null, expanded: 0 }

    // Already in range - no movement required.
    if (this._inRange(start.i, start.j)) {
      const point = canvas.grid.getTopLeftPoint({ i: start.i, j: start.j })
      return { path: [point], endPos: point, expanded: 0 }
    }
    if (this.maxDepth <= 0) return empty

    const open = new MinHeap()
    const gScore = new Map()
    const cameFrom = new Map()
    const closed = new Set()

    // Alternating diagonal rules make step cost depend on how many diagonals have been taken, so
    // the parity becomes part of the node identity. Other rules keep a single parity.
    const stateKey = (i, j, parity) =>
      this.alternatingDiagonals ? offsetKey(i, j) * 2 + parity : offsetKey(i, j)

    const startParity = this.initialDiagonalParity
    const startKey = stateKey(start.i, start.j, startParity)
    gScore.set(startKey, 0)
    open.push({ i: start.i, j: start.j, parity: startParity, key: startKey }, 0)

    let expanded = 0

    while (open.size > 0) {
      const current = open.pop()
      if (closed.has(current.key)) continue
      closed.add(current.key)
      expanded++
      count('nodes expanded')

      if (this._inRange(current.i, current.j)) {
        return {
          path: this._reconstruct(cameFrom, current),
          endPos: canvas.grid.getTopLeftPoint({ i: current.i, j: current.j }),
          expanded,
        }
      }

      const currentG = gScore.get(current.key)

      for (const neighbor of this._neighbors(current.i, current.j)) {
        const stepParity = this.alternatingDiagonals && neighbor.isDiagonal ? current.parity : 0
        const step = this._stepCost(neighbor.isDiagonal, stepParity)
        const tentativeG = currentG + step

        // Reject over-budget nodes before they enter the heap. Previously they were pushed and
        // only discarded on pop, inflating every heap operation.
        if (tentativeG > this.maxDepth) continue

        const nextParity =
          this.alternatingDiagonals && neighbor.isDiagonal ? 1 - current.parity : current.parity
        const neighborKey = stateKey(neighbor.i, neighbor.j, nextParity)
        if (closed.has(neighborKey)) continue

        const known = gScore.get(neighborKey)
        if (known !== undefined && tentativeG >= known) continue

        gScore.set(neighborKey, tentativeG)
        cameFrom.set(neighborKey, current)
        const f = tentativeG + this._heuristic(neighbor.i, neighbor.j, goal.i, goal.j)
        open.push({ i: neighbor.i, j: neighbor.j, parity: nextParity, key: neighborKey }, f)
      }
    }

    note('pathfinding: no route within budget', { maxDepth: this.maxDepth, expanded })
    return { ...empty, expanded }
  }

  _reconstruct(cameFrom, current) {
    const cells = [current]
    let node = current
    while (cameFrom.has(node.key)) {
      node = cameFrom.get(node.key)
      cells.unshift(node)
    }
    return this._simplify(
      cells.map((cell) => canvas.grid.getTopLeftPoint({ i: cell.i, j: cell.j })),
    )
  }

  /**
   * Collapse straight runs into single waypoints.
   *
   * This used to be dead code - the function returned on its first line. Enabling it removes the
   * per-cell waypoint markers from the ruler; `Token#move` handles multi-cell segments fine.
   */
  _simplify(path) {
    if (!path || path.length <= 2) return path

    const simplified = [path[0]]
    for (let n = 1; n < path.length - 1; n++) {
      const prev = path[n - 1]
      const curr = path[n]
      const next = path[n + 1]
      const inX = Math.sign(curr.x - prev.x)
      const inY = Math.sign(curr.y - prev.y)
      const outX = Math.sign(next.x - curr.x)
      const outY = Math.sign(next.y - curr.y)
      if (inX !== outX || inY !== outY) simplified.push(curr)
    }
    simplified.push(path[path.length - 1])
    return simplified
  }

  /** Gridless scenes have no cells to search; move in a straight line instead. */
  _directPath(options) {
    const source = options.sourceToken
    const target = options.targetPosition
    if (!source || !target) return { path: [], endPos: null }
    const path = [
      { x: source.x, y: source.y },
      { x: target.x, y: target.y },
    ]
    this.path = path
    this.endPos = path[1]
    this.setRuler(path)
    return { path, endPos: this.endPos }
  }

  /* -------------------------------------------- */
  /*  Ruler                                       */
  /* -------------------------------------------- */

  setRuler(path) {
    const token = this.sourceToken
    // A single-cell path means the token is already in range and does not move - nothing to draw.
    if (!token?.ruler || !path || path.length < 2) return

    const movement = token.findMovementPath(path, MOVEMENT_OPTIONS)

    markRulerPreview(token)
    token.ruler.refresh({
      passedWaypoints: [],
      pendingWaypoints: [],
      plannedMovement: {
        [game.user.id]: {
          foundPath: movement.result ?? [],
          unreachableWaypoints: [],
          // Empty history here keeps stale segments off the preview without destroying the
          // token's real movement record, which is what `clearMovementHistory()` used to do.
          history: [],
          hidden: false,
          searching: false,
        },
      },
    })
    token.ruler.visible = true
  }

  clearRuler() {
    const token = this.sourceToken
    if (!token) return
    clearRulerPreview(token)

    // Clear the ruler that was actually drawn on. The previous implementation cleared
    // `canvas.controls.getRulerForUser(...)`, a different object entirely, so the drawn path was
    // never removed and callers had to clean up by hand.
    const ruler = token.ruler
    if (!ruler) return
    ruler.refresh({ passedWaypoints: [], pendingWaypoints: [], plannedMovement: {} })
    ruler.clear()
    ruler.visible = false
  }

  clearData() {
    this.clearRuler()
    this.sourceToken = null
    this.targetToken = null
    this.ruler = null
    this.occupied = new Set()
    this.wallCache.clear()
    this.path = null
    this.endPos = null
  }

  /* -------------------------------------------- */
  /*  Debug                                       */
  /* -------------------------------------------- */

  /**
   * Draw a transient value on the canvas. Gated behind the `debugPerf` setting via `note()` so it
   * cannot be left on accidentally, and the text is destroyed rather than merely detached.
   */
  debugDisplayValue(value, position) {
    if (!game.settings.get('auto-action-tray', 'debugPerf')) return
    const text = new PIXI.Text(String(value), {
      fontFamily: 'Arial',
      fontSize: 12,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 4,
    })
    text.anchor.set(0.5)
    text.position.set(position.x, position.y)
    canvas.stage.addChild(text)

    setTimeout(() => {
      if (text.destroyed) return
      canvas.stage.removeChild(text)
      text.destroy()
    }, 1000)
  }
}
