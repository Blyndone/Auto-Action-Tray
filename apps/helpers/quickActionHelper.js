import { Pathfinding } from './pathfinding.js'
import { TargetHelper } from './targetHelper.js'
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
    this.gridSize = game.canvas.scene.grid.size

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
  //Move Token
  //await game.actors.getName("Balon").getActiveTokens()[0].document.update({x: 2500, y: 0})

  checkHover() {
    return this.hovered > 0
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

    // this.Pathfinding = new Pathfinding({
    //   sourceToken: this.token,
    //   targetToken: this.targetToken
    // })
  }

  setItem() {
    // console.log('Range', this.activeItem?.tooltip?.range)
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
    this.availablePositions = []

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
        // Handle the selected targets
        if (targets == undefined || targets.length == 0) {
          return Promise.reject('No Targets Selected')
        }
        // console.log('Selected targets:', targets)
        this.submitQuickAction(this.token, targets.targets[0])
      })
      .then(() => {
        // console.log('Movement complete')
      })
      .catch((err) => {
        this.cancelQuickAction()

        // console.log('Chain stopped:', err)
      })
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

    if (this.availablePositions.length == 0) {
      this.availablePositions = this.setAvailablePositions(tarToken)
    }
    let availableCenters = this.availablePositions.map((position) => {
      return {
        x: position.x,
        y: position.y,
        center: position.center,
        distance: Math.hypot(
          transformedPos.x - position.center.x,
          transformedPos.y - position.center.y,
        ),
      }
    })
    availableCenters.sort((a, b) => a.distance - b.distance)
    let closest = availableCenters[0]
    // console.log('Closest Available Position:', closest)
    this.currentAvailablePosition = { x: closest.x, y: closest.y }
    // console.log('Current Available Position:', this.currentAvailablePosition)
    this.displayTokenGhost(tarToken)
  }

  expandPosFromCenter(pos, targetCenter, targetSize, actorSize) {
    const gridW = targetSize.w / this.gridSize
    const gridH = targetSize.h / this.gridSize

    const deadZoneW = targetSize.w * (gridW / (gridW + 2))
    const deadZoneH = targetSize.h * (gridH / (gridH + 2))

    const dx = pos.x - targetCenter.x
    const dy = pos.y - targetCenter.y

    const newX = Math.abs(dx) < deadZoneW / 2 ? pos.x : pos.x + (targetSize.w / 2) * Math.sign(dx)

    const newY = Math.abs(dy) < deadZoneH / 2 ? pos.y : pos.y + (targetSize.h / 2) * Math.sign(dy)

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

  cancelQuickAction() {
    document.removeEventListener('mousemove', this.mouseMoveHandler)
    this.setState(this.STATES.ACTIVE)
    this.removeTokenGhost()
    if (this.activeSlot == null) return
    TargetHelper.cancelSelection.bind(this.app)(null, null, false)
    // this.active = true
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
    // console.log('Quick Action Slot: ', this.activeSlot)
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
    if (this.ghostToken) {
      this.removeTokenGhost()
    }
    if (
      this.token.document.disposition == token.document.disposition ||
      this.token.document.id == token.document.id
    ) {
      this.cancelQuickAction()
      this.removeTokenGhost()
      return
    }

    this.targetToken = token
    this.availablePositions = this.setAvailablePositions(token)
    let actorTok = this.token
    // let pos = this.findAdjacentSquare(actorTok, token)
    // let pos = this.findClosestAvailablePosition()
    let pos = null
    if (this.currentAvailablePosition) {
      pos = this.currentAvailablePosition
    }
    if (pos == null) {
      return
    }
    if (pos.x == actorTok.x && pos.y == actorTok.y) {
      return
    }

    let { path, endPos } = this.pathfinding.newPathfinding({
      sourceToken: actorTok,
      speed: actorTok.actor.system.attributes.movement.walk || 30,
      range: this.activeItemRange,
      targetPosition: { x: pos.x, y: pos.y },
      actualTarget: {x: token.x, y: token.y}
    })
    if (endPos) {
      pos = endPos
    }
    if (path?.length == 0 || !path) {
      return
    }

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
    // Apply the position update
    this.targetHelper.clearTargetLines()
    this.targetHelper.clearRangeBoundary()

    // await source.document.update({ x: newX, y: newY })

    if (this.pathfinding.ruler.token == null) {
      // Ensure we're on the token layer
      if (canvas.activeLayer !== canvas.tokens) {
        console.log('Activating token layer...')
        canvas.tokens.activate()
        await new Promise((r) => setTimeout(r, 50))
      }

      // Check if user can control
      // if (!source.can(game.user, 'control')) {

      //   console.warn(`User ${game.user.name} cannot control token ${source.name}.`)
      //   this.attacking = false
      //   this.active = true
      //   this.pathfinding.setActive()

      //   return
      // }

      // Ensure it's controlled
      if (!source.controlled) {
        this.pathfinding.setInactive()
        canvas.tokens.releaseAll()
        let controlled = source.control({ releaseOthers: true })
        console.log(`Control result for ${source.name}:`, controlled)

        if (!controlled) {
          console.warn('Failed to control token for movement.')
          this.attacking = false
          this.active = true
          this.pathfinding.setActive()

          return
        }
      }
    }

    if (!this.pathfinding.active) {
      this.pathfinding.setActive()
      this.pathfinding.setRuler(this.pathfinding.getPath())
    }

    await this.pathfinding.ruler?.moveToken()
    await CanvasAnimation.getAnimation(source.document.object.animationName)?.promise
    await new Promise((resolve) => setTimeout(resolve, this.useItemDelay))
    await this.quickItemUse()
    this.setState(this.STATES.ACTIVE)
    this.pathfinding.setActive()

    // console.log(`Source moved to new position: (${newX}, ${newY})`)
  }

  setAvailablePositions(target) {
    // console.log('Setting available positions around target', target)
    // console.log('Token position', target.x, target.y)
    let bounds = {
      tarMinX: target.x - this.tokenSize.w,
      tarMaxX: target.x + target.w,
      tarMinY: target.y - this.tokenSize.h,
      tarMaxY: target.y + target.h,
    }
    // console.log('Target Bounds', bounds)

    let positions = []
    for (let x = bounds.tarMinX; x <= bounds.tarMaxX; x += this.gridSize) {
      for (let y = bounds.tarMinY; y <= bounds.tarMaxY; y += this.gridSize) {
        // Exclude positions that would overlap the target
        if (x < target.x || x >= target.x + target.w || y < target.y || y >= target.y + target.h) {
          positions.push({
            x: x,
            y: y,
            center: { x: x + this.token.w / 2, y: y + this.token.h / 2 },
          })
        }
      }
    }

    // console.log('Available Positions (pre-filter):', positions);

    // Filter out occupied positions
    const placeables = canvas.tokens.placeables
    const occupied = placeables.map((t) => ({ x: t.x, y: t.y }))
    let largeTokens = placeables.filter((t) => t.w > this.gridSize || t.h > this.gridSize)
    let tmp = []
    largeTokens.forEach((t) => {
      for (let x = t.w; x > 0; x -= this.gridSize) {
        for (let y = t.h; y > 0; y -= this.gridSize) {
          tmp.push({ x: t.x + (t.w - x), y: t.y + (t.h - y) })
        }
      }
    })
    occupied.push(...tmp)

    positions = positions.filter(
      (pos) =>
        !occupied.some((o) => o.x === pos.x && o.y === pos.y) ||
        (pos.x == this.token.x && pos.y == this.token.y),
    )

    // console.log('Filtered Available Positions:', positions);
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
