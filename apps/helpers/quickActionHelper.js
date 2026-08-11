import { gsap } from '/scripts/greensock/esm/all.js'
import { Pathfinding, MOVEMENT_OPTIONS } from './pathfinding.js'
import { TargetHelper } from './targetHelper.js'
import { note } from './perfTrace.js'
import { toSceneDistance } from './distance.js'
export class QuickActionHelper {
  constructor(options) {
    this.app = options.app
    this.targetHelper = options.targetHelper
    this.combatHandler = options.combatHandler
    this.hovered = 0
    this.equipmentTray = null
    this.active = true
    this.attacking = false
    this.activeSlot = null
    this.activeItem = null
    this.activeActivity = null
    this.activeSpellLevel = null
    this.activeItemRange = 0
    this.activeItemType = null
    this.actor = null
    this.token = null
    this.useItemDelay = 200 //ms
    this.ghostToken = null
    this.tokenSize = { w: null, h: null }
    this.targetToken = null
    this.availablePositions = []
    this.currentAvailablePosition = null

    // True only while `moveActor` is driving the token, so the `_canControl` override knows to
    // step out of the way. Previously read but never assigned, leaving that branch permanently
    // dead.
    this.controllable = false

    this.mouseMoveHandler = null

    this.throttleSpeed = game.settings.get('auto-action-tray', 'targetLinePollRate') || 50
    this.pathfinding = new Pathfinding()

    this.STATES = {
      INACTIVE: 0,
      ACTIVE: 1,
      TARGETTING: 2,
      MOVING: 3,
      ATTACKING: 4,
    }

    this.state = this.STATES.INACTIVE
  }

  checkHover() {
    return this.hovered > 0
  }

  /**
   * Read live rather than cached at construction. The old cached value was captured at `ready`
   * and went stale the moment the user switched to a scene with a different grid size.
   */
  get gridSize() {
    return canvas?.grid?.size ?? 100
  }

  getState() {
    return this.state
  }

  hasActiveSlot() {
    return this.activeSlot != null
  }

  // Set the current state
  // 0,1,2,3,4 or 'INACTIVE','ACTIVE','TARGETTING','MOVING','ATTACKING'
  setState(newState) {
    if (typeof newState === 'string') {
      newState = this.STATES[newState.toUpperCase()]
    }
    this.state = newState
  }

  setData(actor) {
    this.clearData()
    this.actor = actor
    this.token = actor.getActiveTokens()[0]

    this.tokenSize = { w: this.token.w, h: this.token.h }
    this.activeSlot = this.equipmentTray.getActiveSlot()
    this.active = this.setState('ACTIVE')
    this.hovered = 0
    this.setItem()
  }

  setItem() {
    switch (this.activeSlot) {
      case 0:
        return
      case 1:
        this.activeItem = this.equipmentTray.getMeleeWeapon()
        this.activeActivity = this.activeItem?.defaultActivity
        this.activeSpellLevel = this.activeItem?.spellLevel || null
        this.activeItemRange = this.activeItem?.tooltip?.range || 0
        break
      case 2:
        this.activeItem = this.equipmentTray.getRangedWeapon()
        this.activeActivity = this.activeItem?.defaultActivity
        this.activeSpellLevel = this.activeItem?.spellLevel || null
        this.activeItemRange = this.activeItem?.tooltip?.range || 0
        break
      default:
        this.activeItem = null
    }
    if (this.activeItem == null) {
      this.setState(this.STATES.INACTIVE)
    }
  }

  clearData() {
    this.actor = null
    this.activeSlot = null
    this.activeItem = null
    this.activeActivity = null
    this.activeSpellLevel = null
    this.targetToken = null
    this.invalidateAvailablePositions()
    this._lastUnreachable = null

    this.tokenSize = { w: null, h: null }
    this.removeTokenGhost()
  }

  async startQuickAction() {
    if (
      this.hasActiveSlot() == false ||
      this.getState() !== this.STATES.ACTIVE ||
      !canvas.tokens.controlled.some((t) => t.id === this.token.id)
    )
      return
    this.setState(this.STATES.TARGETTING)
    this.setItem()

    this.mouseMoveHandler = foundry.utils.throttle(
      (event) => this._onMouseMove(event),
      this.throttleSpeed,
    )

    document.addEventListener('mousemove', this.mouseMoveHandler)

    await this.targetHelper
      .requestTargets(
        this.activeItem,
        this.activeActivity,
        this.actor,
        1,
        true,
        this.activeSpellLevel,
        false,
      )
      .then((targets) => {
        if (targets == undefined || targets.length == 0) {
          return Promise.reject('No Targets Selected')
        }

        this.submitQuickAction(this.token, targets.targets[0])
      })
      .then(() => {
        // console.log('Movement complete')
      })
      .catch((err) => {
        this.cancelQuickAction()
      })
  }

  cancelQuickAction() {
    document.removeEventListener('mousemove', this.mouseMoveHandler)
    // Ruler teardown lives in Pathfinding now that it clears the ruler it actually drew on.
    // This used to hand-clear the token ruler *and* wipe the token's movement history, which is
    // the record core and dnd5e use to track distance spent this turn.
    this.pathfinding.clearRuler()
    this.setState(this.STATES.ACTIVE)
    this.removeTokenGhost()
    if (this.activeSlot == null) return
    TargetHelper.cancelSelection.bind(this.app)(null, null, false)
  }

  /**
   * Tell the user why a quick action did not start. Throttled per target, because this is
   * reached from a mousemove handler and would otherwise stack notifications.
   */
  reportUnreachable(token) {
    if (this._lastUnreachable === token?.id) return
    this._lastUnreachable = token?.id
    note('quick action: no route to target', token?.name)
    ui.notifications.info(
      `No route to ${token?.name ?? 'target'} within your remaining movement.`,
      { console: false },
    )
  }

  /**
   * Best applicable speed for the actor, in scene distance units.
   *
   * Previously hardcoded to `movement.walk`, so a flying or swimming creature was budgeted with
   * a walk speed it might not even have.
   */
  getMovementSpeed() {
    const movement = this.actor?.system?.attributes?.movement ?? {}
    const candidates = [movement.walk, movement.fly, movement.swim, movement.climb, movement.burrow]
      .map((value) => (Number.isFinite(value) ? value : 0))
      .filter((value) => value > 0)
    if (!candidates.length) return 30

    const speed = Math.max(...candidates)
    // `movement.units` is the actor's own unit key; the pathfinder works in scene units.
    return toSceneDistance(speed, movement.units ?? 'ft')
  }

  async _onMouseMove(event) {
    if (this.getState() != this.STATES.TARGETTING) {
      document.removeEventListener('mousemove', this.mouseMoveHandler)
      return
    }
    let pos = this.getCursorCoordinates(event)

    let tarToken = canvas.tokens.placeables.filter((t) => {
      return pos.x >= t.x && pos.x <= t.x + t.w && pos.y >= t.y && pos.y <= t.y + t.h
    })[0]
    if (!tarToken || tarToken == this.token) {
      this.cancelQuickAction()
      return
    }

    let transformedPos = pos
    let tarTokenCenter = tarToken.center
    let tarTokenSize = { w: tarToken.w, h: tarToken.h }
    let actorSize = { w: this.token.w, h: this.token.h }
    transformedPos = this.expandPosFromCenter(
      transformedPos,
      tarTokenCenter,
      tarTokenSize,
      actorSize,
    )

    // Cached per target: the old `length == 0` check meant the ring computed for the first token
    // hovered was reused for every subsequent one.
    const positions = this.getAvailablePositions(tarToken)

    // A target boxed in on every side has no legal standing position.
    if (positions.length == 0) {
      this.currentAvailablePosition = null
      this.reportUnreachable(tarToken)
      this.cancelQuickAction()
      return
    }

    let closest = positions[0]
    let closestDistance = Infinity
    for (const position of positions) {
      const distance = Math.hypot(
        transformedPos.x - position.center.x,
        transformedPos.y - position.center.y,
      )
      if (distance < closestDistance) {
        closestDistance = distance
        closest = position
      }
    }
    this.currentAvailablePosition = { x: closest.x, y: closest.y }
    if (this.getState() === this.STATES.TARGETTING) {
      this.displayTokenGhost(tarToken)
      return
    } else {
      this.cancelQuickAction()
    }
  }

  /**
   * Cells the source token can stand in to attack `target`, cached per target.
   *
   * Recomputed whenever the target changes or a token moves, since the ring depends on what is
   * currently occupying the grid.
   */
  getAvailablePositions(target) {
    if (this._positionsFor !== target?.id) {
      this.availablePositions = this.setAvailablePositions(target)
      this._positionsFor = target?.id
    }
    return this.availablePositions
  }

  /** Drop the cached ring so the next hover recomputes it. */
  invalidateAvailablePositions() {
    this._positionsFor = null
    this.availablePositions = []
  }

  /**
   * Push the cursor outward from the target so it maps onto the ring of standing positions
   * rather than onto the target itself. Inside a central dead zone the cursor is left alone, so
   * small movements near the middle do not flip the chosen side.
   *
   * The push is half the target plus half the source, which lands the transformed point exactly
   * where the source token's *center* would sit when standing adjacent - that is what the
   * nearest-center comparison in `_onMouseMove` measures against. `actorSize` was previously
   * accepted and then ignored, so the mapping was off by half the source token on anything
   * larger than 1x1.
   */
  expandPosFromCenter(pos, targetCenter, targetSize, actorSize) {
    const gridW = targetSize.w / this.gridSize
    const gridH = targetSize.h / this.gridSize

    const deadZoneW = targetSize.w * (gridW / (gridW + 2))
    const deadZoneH = targetSize.h * (gridH / (gridH + 2))

    const dx = pos.x - targetCenter.x
    const dy = pos.y - targetCenter.y

    const pushX = targetSize.w / 2 + actorSize.w / 2
    const pushY = targetSize.h / 2 + actorSize.h / 2

    const newX = Math.abs(dx) < deadZoneW / 2 ? pos.x : pos.x + pushX * Math.sign(dx)
    const newY = Math.abs(dy) < deadZoneH / 2 ? pos.y : pos.y + pushY * Math.sign(dy)

    return { x: newX, y: newY }
  }

  getCursorCoordinates(event) {
    const [x, y] = [event.x, event.y]
    const t = canvas.app.stage.worldTransform

    return {
      x: (x - t.tx) / canvas.app.stage.scale.x,
      y: (y - t.ty) / canvas.app.stage.scale.y,
    }
  }

  setEquipmentTray(tray) {
    this.equipmentTray = tray
  }
  toggleSlot(slot) {
    this.activeSlot == null
      ? (this.activeSlot = slot)
      : this.activeSlot == slot
        ? (this.activeSlot = null)
        : (this.activeSlot = slot)
    this.equipmentTray.setActiveSlot(this.activeSlot)
    this.setData(this.actor)
    this.app.requestRender('equipmentMiscTray')
  }

  async submitQuickAction(source, target) {
    if (this.currentAvailablePosition == null) {
      return
    }
    if (this.ghostToken) {
      gsap.to(this.ghostToken, {
        duration: 0.5,
        alpha: 0,
      })
    }
    return await this.moveActor(
      source,
      this.currentAvailablePosition.x,
      this.currentAvailablePosition.y,
    )
  }

  findAdjacentSquare(source, target) {
    const targetBounds = {
      minX: target.x - source.w,
      maxX: target.x + target.w,
      minY: target.y - source.h,
      maxY: target.y + target.h,
    }

    const newX =
      source.x < targetBounds.minX
        ? targetBounds.minX
        : source.x > targetBounds.maxX
          ? targetBounds.maxX
          : source.x

    const newY =
      source.y < targetBounds.minY
        ? targetBounds.minY
        : source.y > targetBounds.maxY
          ? targetBounds.maxY
          : source.y
    let pos = { x: newX, y: newY }

    return pos
  }

  async quickItemUse() {
    this.removeTokenGhost()
    this.setState(this.STATES.ATTACKING)
    let item = this.activeItem
    let activity = this.activeActivity
    let selectedSpellLevel = this.activeSpellLevel
    let altDown = this.app.altDown
    let ctrlDown = this.app.ctrlDown
    let useSlot = false

    let useNotification =
      game.settings.get('auto-action-tray', 'enableUseItemName') ||
      game.settings.get('auto-action-tray', 'enableUseItemIcon')

    if (useNotification) {
      this.targetHelper.createUseNotification(item, activity, this.actor, selectedSpellLevel, false)
    }

    const minimumTime = 2000
    const delay = new Promise((resolve) => setTimeout(resolve, minimumTime))

    const usePromise = item.item.system.activities
      .get(
        activity?.activityId ||
          activity?.itemId ||
          activity?._id ||
          activity?.id ||
          item.item.system.activities.contents[0].id,
      )
      .use(
        {
          advantage: altDown,
          disadvantage: ctrlDown,
          midiOptions: {
            advantage: altDown,
            disadvantage: ctrlDown,
          },
          spell: selectedSpellLevel,
          consume: { spellSlot: useSlot },
        },
        { configure: false },
      )

    const [result] = await Promise.all([usePromise, delay])
    this.setState(this.STATES.ACTIVE)
    if (useNotification) {
      this.targetHelper.clearUseNotification()
    }
  }

  async displayTokenGhost(token) {
    if (!this.actor || this.state != this.STATES.TARGETTING) return

    if (
      this.token.document.disposition == token.document.disposition ||
      this.token.document.id == token.document.id
    ) {
      this.cancelQuickAction()
      this.removeTokenGhost()
      return
    }

    this.targetToken = token
    this.getAvailablePositions(token)
    let actorTok = this.token

    let pos = null
    if (this.currentAvailablePosition) {
      pos = this.currentAvailablePosition
    }
    if (pos == null) {
      return
    }

    // The pathfinder now always resolves to a `{path, endPos}` pair - empty path, null endPos on
    // failure - so this no longer needs a null guard around the destructuring.
    const { path, endPos } = await this.pathfinding.newPathfinding({
      sourceToken: actorTok,
      targetToken: token,
      speed: this.getMovementSpeed(),
      range: this.activeItemRange,
      targetPosition: { x: pos.x, y: pos.y },
    })

    if (endPos) {
      pos = endPos
    }
    if (!path?.length || this.getState() != this.STATES.TARGETTING) {
      // Distinguish "the search failed" from "the user moved on" so an unreachable target says so
      // instead of cancelling silently.
      if (!path?.length && this.getState() == this.STATES.TARGETTING) {
        this.reportUnreachable(token)
      }
      this.cancelQuickAction()
      return
    }

    // A route exists again, so a future failure on this same target is worth reporting.
    this._lastUnreachable = null

    if (this.ghostToken) {
      this.ghostToken.x = pos.x
      this.ghostToken.y = pos.y
    } else {
      const texture = await PIXI.Assets.load(actorTok.document.texture.src)
      const sprite = new PIXI.Sprite(texture)

      sprite.eventMode = 'none'
      sprite.interactiveChildren = false

      sprite.x = pos.x
      sprite.y = pos.y
      sprite.height = actorTok.h
      sprite.width = actorTok.w

      sprite.alpha = 0.7

      const colorMatrix = new PIXI.filters.ColorMatrixFilter()

      colorMatrix.sepia(true)

      colorMatrix.saturate(-0.3, true)

      sprite.filters = [colorMatrix]

      this.ghostToken = sprite
      canvas.app.stage.addChild(sprite)
    }
  }

  removeTokenGhost() {
    if (this.ghostToken) {
      canvas.app.stage.removeChild(this.ghostToken)
      this.ghostToken.destroy()
      this.ghostToken = null
      this.pathfinding.setInactive()
    }
  }

  async moveActor(source) {
    this.setState(this.STATES.MOVING)
    this.targetHelper.clearTargetLines()
    this.targetHelper.clearRangeBoundary()

    const path = this.pathfinding.getPath()
    const token = this.pathfinding.sourceToken ?? source

    // A one-cell path means the token is already in range - skip straight to the attack rather
    // than issuing a degenerate move.
    if (path?.length > 1) {
      if (!(await this.acquireControl(source))) return

      const op = {
        autoRotate: false,
        // Shared with the preview ruler so the drawn route and the executed route cannot
        // disagree. Walls are honoured in both, because the search already routes around them.
        constrainOptions: { ...MOVEMENT_OPTIONS },
        method: 'api',
        showRuler: true,
      }
      await token.document.move(token.findMovementPath(path, MOVEMENT_OPTIONS).result, op)
    }

    async function waitForFullAnimation(animationName) {
      let animation
      do {
        animation = foundry.canvas.animation.CanvasAnimation.getAnimation(animationName)
        if (animation) await animation.promise
      } while (animation)
    }

    await waitForFullAnimation(source.document.object.movementAnimationName)

    await new Promise((resolve) => setTimeout(resolve, this.useItemDelay))
    await this.quickItemUse()
    this.setState(this.STATES.ACTIVE)
    this.pathfinding.setActive()
  }

  /**
   * Make sure the token layer is active and the token is controlled before moving it.
   *
   * This replaces a guard on `pathfinding.ruler.token`, which was always true - neither
   * `BaseRuler` nor `Ruler` has a `token` property - so the whole block ran on every move whether
   * it was needed or not.
   */
  async acquireControl(source) {
    if (canvas.activeLayer !== canvas.tokens) {
      canvas.tokens.activate()
      await new Promise((r) => setTimeout(r, 50))
    }

    if (source.controlled) return true

    // Let the `_canControl` override fall through to core while we take control ourselves.
    this.controllable = true
    try {
      canvas.tokens.releaseAll()
      if (source.control({ releaseOthers: true })) return true
    } finally {
      this.controllable = false
    }

    note('quick action: failed to control token for movement', source?.name)
    ui.notifications.warn(`Could not take control of ${source?.name ?? 'the token'} to move it.`)
    this.attacking = false
    this.active = true
    this.setState(this.STATES.ACTIVE)
    this.pathfinding.setActive()
    return false
  }

  /**
   * Cells the source token could stand in to attack `target`: the ring around the target's
   * footprint, minus anything occupied.
   *
   * Footprints are derived from `canvas.grid.getOffsetRange` for both the ring and the occupancy
   * pass. Previously those were two different hand-rolled loops that disagreed about how a
   * multi-cell token covers the grid.
   */
  setAvailablePositions(target) {
    const grid = canvas.grid
    const size = this.gridSize

    const footprintKeys = (token) => {
      const [i0, j0, i1, j1] = grid.getOffsetRange({
        x: token.x,
        y: token.y,
        width: token.w,
        height: token.h,
      })
      const keys = new Set()
      for (let i = i0; i < i1; i++) {
        for (let j = j0; j < j1; j++) keys.add(`${i},${j}`)
      }
      return keys
    }

    const occupied = new Set()
    for (const placeable of canvas.tokens.placeables) {
      if (placeable === this.token) continue
      if (!placeable.visible) continue
      for (const key of footprintKeys(placeable)) occupied.add(key)
    }

    const targetCells = footprintKeys(target)
    const [ti0, tj0, ti1, tj1] = grid.getOffsetRange({
      x: target.x,
      y: target.y,
      width: target.w,
      height: target.h,
    })

    // Ring width is the source token's own footprint, so a Large attacker gets anchors far
    // enough out that its whole body clears the target.
    const spanI = Math.max(1, Math.round(this.token.h / size))
    const spanJ = Math.max(1, Math.round(this.token.w / size))

    const positions = []
    for (let i = ti0 - spanI; i < ti1 + spanI; i++) {
      for (let j = tj0 - spanJ; j < tj1 + spanJ; j++) {
        // Every cell the source would cover from this anchor must be clear of the target and of
        // any other token - unless it is where the source already stands.
        let legal = true
        for (let di = 0; di < spanI && legal; di++) {
          for (let dj = 0; dj < spanJ && legal; dj++) {
            const key = `${i + di},${j + dj}`
            if (targetCells.has(key) || occupied.has(key)) legal = false
          }
        }
        if (!legal) continue

        const point = grid.getTopLeftPoint({ i, j })
        positions.push({
          x: point.x,
          y: point.y,
          center: { x: point.x + this.token.w / 2, y: point.y + this.token.h / 2 },
        })
      }
    }

    return positions
  }

  findClosestAvailablePosition() {
    if (this.availablePositions.length != 0) {
      if (this.availablePositions.some((pos) => pos.x === this.token.x && pos.y === this.token.y)) {
        this.currentAvailablePosition = { x: this.token.x, y: this.token.y }
        return { x: this.token.x, y: this.token.y }
      }

      let differences = this.availablePositions.map((pos) => {
        return {
          position: pos,
          sum: Math.abs(pos.x - this.token.x) + Math.abs(pos.y - this.token.y),
        }
      })

      differences.sort((a, b) => a.sum - b.sum)

      this.currentAvailablePosition = differences[0].position
      return differences[0].position.length == 0 ? null : differences[0].position
    } else {
      this.currentAvailablePosition = null
      return null
    }
  }
}
