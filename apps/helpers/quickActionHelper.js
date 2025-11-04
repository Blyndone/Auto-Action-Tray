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

    this.throttleSpeed = 100 //ms
    this.deadZonePercent = 0.25
  }
  //Move Token
  //await game.actors.getName("Balon").getActiveTokens()[0].document.update({x: 2500, y: 0})

  incHover() {
    this.hovered += 1
  }
  decHover() {
    this.hovered -= 1
  }
  checkHover() {
    return this.hovered > 0
  }

  setData(actor) {
    this.clearData()
    this.actor = actor
    this.token = actor.getActiveTokens()[0]

    this.tokenSize = { w: this.token.w, h: this.token.h }
    this.activeSlot = this.equipmentTray.getActiveSlot()
    this.active = true
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
        break
      case 2:
        this.activeItem = this.equipmentTray.getRangedWeapon()
        this.activeActivity = this.activeItem?.defaultActivity
        this.activeSpellLevel = this.activeItem?.spellLevel || null
        break
      default:
        this.activeItem = null
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
    if (this.activeSlot == null || !this.active) return
    this.active = false
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
    let pos = this.getCursorCoordinates(event)

    let tarToken = canvas.tokens.placeables.filter((t) => {
      return pos.x >= t.x && pos.x <= t.x + t.w && pos.y >= t.y && pos.y <= t.y + t.h
    })[0]
    if (!tarToken) {
      return
    }

    //pos - {x: number, y: number}
    //tarTokenCenter - {x: number, y: number}

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
    console.log('Cursor Position:', pos)
    console.log('Transformed Position:', transformedPos)
    // console.log('Hovered Token:', tarToken)

    console.log(this.availablePositions)
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

    // Define “dead zone” where movement doesn’t expand outward
    const deadZoneW = targetSize.w * (gridW / (gridW + 2))
    const deadZoneH = targetSize.h * (gridH / (gridH + 2))

    // Adjust position relative to the target center
    const dx = pos.x - targetCenter.x
    const dy = pos.y - targetCenter.y

    const newX = Math.abs(dx) < deadZoneW / 2 ? pos.x : pos.x + (targetSize.w / 2) * Math.sign(dx)

    const newY = Math.abs(dy) < deadZoneH / 2 ? pos.y : pos.y + (targetSize.h / 2) * Math.sign(dy)

    console.debug('Expanded Position:', { x: newX, y: newY })
    console.debug('Original Position:', pos)

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
    this.removeTokenGhost()
    if (this.activeSlot == null) return
    TargetHelper.cancelSelection.bind(this.app)(null, null, false)
    this.active = true
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
    // console.log(
    //   `Finding adjacent square from (${source.x}, ${source.y}) to (${target.x}, ${target.y})`,
    // )
    // console.log(`Source size: [${source.w}, ${source.h}] | Target size: [${target.w}, ${target.h}]`)
    // console.log(`Δx: ${target.x - source.x}, Δy: ${target.y - source.y}`)

    // Calculate the bounding box around the target based on the source size
    const targetBounds = {
      minX: target.x - source.w,
      maxX: target.x + target.w,
      minY: target.y - source.h,
      maxY: target.y + target.h,
    }

    // Determine the new position for the source
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
      this.targetHelper.createUseNotification(item, activity, this.actor, selectedSpellLevel)
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

    if (useNotification) {
      this.targetHelper.clearUseNotification()
    }
  }

  async displayTokenGhost(token) {
    if (!this.actor) return
    if (this.ghostToken) {
      this.removeTokenGhost()
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

    const texture = await PIXI.Assets.load(actorTok.document.texture.src)

    // 3. Create a sprite using the texture
    const sprite = new PIXI.Sprite(texture)

    // 4. Position the sprite
    sprite.x = pos.x
    sprite.y = pos.y
    sprite.height = actorTok.h
    sprite.width = actorTok.w
    // sprite.anchor.set(0.5)
    // console.log('Target Position', token.x, token.y)
    // console.log('Displaying ghost at', pos)
    // console.log('Actor position', actorTok.x, actorTok.y)
    // console.log('Token size', actorTok.w, actorTok.h)

    // Set transparency
    sprite.alpha = 0.7

    const colorMatrix = new PIXI.filters.ColorMatrixFilter()

    colorMatrix.sepia(true)

    colorMatrix.saturate(-0.3, true)

    sprite.filters = [colorMatrix]

    this.ghostToken = sprite
    // 5. Add it to the stage
    canvas.app.stage.addChild(sprite)

    let p = new Pathfinding({
      sourceToken: actorTok,
      targetToken: { x: pos.x, y: pos.y },
    })
  }

  removeTokenGhost() {
    if (this.ghostToken) {
      canvas.app.stage.removeChild(this.ghostToken)
      this.ghostToken.destroy()
      this.ghostToken = null
      // this.pathfinding.clearRuler()
    }
  }

  async moveActor(source, newX, newY) {
    this.attacking = true
    // Apply the position update
    this.targetHelper.clearTargetLines()
    this.targetHelper.clearRangeBoundary()

    await source.document.update({ x: newX, y: newY })
    await CanvasAnimation.getAnimation(source.document.object.animationName)?.promise
    await new Promise((resolve) => setTimeout(resolve, this.useItemDelay))
    await this.quickItemUse()
    this.active = true
    this.attacking = false
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
