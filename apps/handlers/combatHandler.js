export class CombatHandler {
  constructor(options = {}) {
    this.actor
    this.token
    this.combatantId = null
    this.visibleCombatSize = 0
    this.inCombat
    this.combat
    this.isTurn = false
    this.isNext = false
    this.tillNextTurn = 0
    this.hotbar = options.hotbar
    this.previousCircleValue = null
    this.actions = {
      action: 1,
      bonus: 1,
      movement: 30,
      reaction: 1,
      spellSlot: 1,
    }
  }

  async setActor(actor) {
    if (this.actor != actor) {
      this.setDefaultActions(actor)
    }
    this.actor = actor
    await this.setCombat(actor)
    this.getActorActions()
  }
  setDefaultActions(actor) {
    this.actions = {
      combatId: this.combat?.id,
      round: this.combat?.round,
      turn: this.combat?.turn,
      combatantId: this.combat?.combatant.id,
      action: 1,
      bonus: 1,
      movement: actor.system.attributes.movement.walk,
      reaction: 1,
      spellSlot: 1,
    }
  }

  setCombatData() {
    let data = {
      combatantId: this.combat?.combatant.id,
      combatId: this.combat?.id,
      round: this.combat?.round,
      turn: this.combat?.turn,
    }
    this.actions = { ...this.actions, ...data }
  }

  consumeAction(type, isSpell, value = 1) {
    if (!this.isTurn) return
    this.actions[type] -= value
    if (this.actions.spellSlot != 0) {
      this.actions.spellSlot = isSpell ? 0 : 1
    }
    if (this.actions[type] < 0) {
      this.actions[type] = 0
    }
    this.setActorActions()
  }

  setActorActions() {
    if (this.actor != null) {
      this.actor.setFlag('auto-action-tray', 'combat', {
        combat: JSON.stringify(this.actions),
      })
    }
  }

  getActorActions() {
    if (this.actor != null) {
      let data = this.actor.getFlag('auto-action-tray', 'combat')?.combat
      if (data) {
        data = JSON.parse(data)
        if (this.checkCurrentTurn(data)) {
          this.actions = data
        } else {
          this.clearActorActions()
        }
      }
    }
  }
  checkCurrentTurn(data) {
    return (
      this.combatantId == data.combatantId &&
      this.combat?.id == data.combatId &&
      this.combat?.round == data.round &&
      this.combat?.turn == data.turn
    )
  }

  clearActorActions() {
    if (this.actor != null) {
      this.actor.unsetFlag('auto-action-tray', 'combat')
    }
  }

  async setCombat(actor) {
    if (this.actor != actor) {
      this.setDefaultActions(actor)
    }
    this.actor = actor
    this.token = actor.getActiveTokens()[0] || null
    this.inCombat = actor.inCombat
    this.isTurn = false
    this.isNext = false
    this.tillNextTurn = 0
    this.combat = null
    let value = 0
    if (this.inCombat && this.token && this.token.combatant) {
      this.combat = this.token.combatant.combat
      this.combatantId = this.token.combatant.id
      this.getInitPlacement()
      value = 100 * (1 - this.tillNextTurn / this.visibleCombatSize)
      this.previousCircleValue = value
    }
    await this.hotbar.requestRender('endTurn', true)
    this.hotbar.animationHandler.setCircle(value)
  }

  async updateCombat(actor, event) {
    if (this.actor !== actor || this.combat == null) {
      this.setCombat(actor)
    }
    if (!this.actor.getActiveTokens()[0].combatant) {
      this.isTurn = false
      this.isNext = false
      this.inCombat = false
      this.tillNextTurn = 0
      this.previousCircleValue = null
      this.setDefaultActions(actor)
      await this.hotbar.requestRender(['centerTray', 'endTurn'], true)

      this.hotbar.animationHandler.setCircle(0)
      return
    }

    this.setCombatData()
    this.getInitPlacement()
    if (!this.isTurn) {
      this.setDefaultActions(this.actor)
    }
    let start = this.previousCircleValue
      ? this.previousCircleValue
      : 100 * (1 - (this.tillNextTurn + 1) / this.visibleCombatSize)
    let end = 100 * (1 - this.tillNextTurn / this.visibleCombatSize)
    await this.hotbar.requestRender('endTurn', true)
    if (this.previousCircleValue >= 100) {
      await this.hotbar.requestRender('centerTray', true)
    }
    // this.hotbar.animationHandler.setCircle(start)
    this.hotbar.animationHandler.animateCircle(start < 100 ? start : 0, end, this)
    this.previousCircleValue = end >= 100 ? 0 : end
  }

  getInitPlacement() {
    if (game.user.isGM) {
      this.getGMInitPlacement()
    } else {
      this.getPlayerInitPlacement()
    }
  }

  getGMInitPlacement() {
    let init = this.combat.turns
    this.visibleCombatSize = init.length
    let initIndex = init.findIndex((e) => e.id == this.combatantId)
    let turn = this.combat.turn
    let diff = initIndex - turn
    if (diff < 0) {
      diff = init.length - turn + initIndex
    }
    this.isTurn = diff == 0
    this.isNext = diff == 1
    this.tillNextTurn = diff
  }
  getPlayerInitPlacement() {
    let init = this.combat.turns.filter((e) => !e.isDefeated && e.visible && !e.hidden)
    this.visibleCombatSize = init.length
    let initIndex = init.findIndex((e) => e.id == this.combatantId)

    let turn = init.findIndex((e) => e.id == this.combat.turns[this.combat.turn].id)
    if (turn == -1) {
      for (let i = this.combat.turn - 1; i > this.combat.turn - this.combat.turns.length; i--) {
        turn = init.findIndex((e) => e.id == this.combat.turns.at(i).id)
        if (turn != -1) {
          if (init[turn].id == this.combatantId) {
            turn++
          }
          break
        }
      }
    }

    let diff = initIndex - turn
    if (diff < 0) {
      diff = init.length - turn + initIndex
    }
    this.isTurn = diff == 0
    this.isNext = diff == 1
    this.tillNextTurn = diff
  }
}
