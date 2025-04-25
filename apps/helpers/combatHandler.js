export class CombatHandler {
  constructor(options = {}) {
    this.actor;
    this.token;
    this.combatantId = null;
    this.inCombat;
    this.combat;
    this.isTurn = false;
    this.isNext = false;
    this.tillNextTurn = 0;
    this.hotbar = options.hotbar;
    this.previousCircleValue = null;
    this.actions = {
      action: 1,
      bonus: 1,
      movement: 30,
      reaction: 1,
      spellSlot: 1
    };
  }

  async setActor(actor) {
    this.actor = actor;
    this.setDefaultActions(actor);
    await this.setCombat(actor);
  }
  setDefaultActions(actor) {
    this.actions = {
      action: 1,
      bonus: 1,
      movement: actor.system.attributes.movement.walk,
      reaction: 1,
      spellSlot: 1
    };
  }
  consumeAction(type, value = 1) {
    if (!this.isTurn) return;
    this.actions[type] -= value;
    if (this.actions[type] < 0) {
      this.actions[type] = 0;
    }
  }

  async setCombat(actor) {
    this.actor = actor;
    this.token = actor.getActiveTokens()[0] || null;
    this.inCombat = actor.inCombat;
    this.isTurn = false;
    this.isNext = false;
    this.tillNextTurn = 0;
    this.combat = null;
    let value = 0;
    if (this.inCombat && this.token && this.token.combatant) {
      this.combat = this.token.combatant.combat;
      this.combatantId = this.token.combatant.id;
      this.getInitPlacement();
      value = 100 * (1 - this.tillNextTurn / this.combat.turns.length);
      this.previousCircleValue = value;
    }
    await this.hotbar.render({ parts: ["endTurn"] });
    this.hotbar.animationHandler.setCircle(value);
  }

  async updateCombat(actor, event) {
    if (this.actor !== actor || this.combat == null) {
      this.setCombat(actor);
    }
    if (!this.actor.getActiveTokens()[0].combatant) {
      this.isTurn = false;
      this.isNext = false;
      this.inCombat = false;
      this.tillNextTurn = 0;
      this.previousCircleValue = 0;
      await this.hotbar.render({ parts: ["endTurn"] });
      this.hotbar.animationHandler.setCircle(0);
      return;
    }
    this.getInitPlacement();
    if (!this.isTurn) {
      this.setDefaultActions(this.actor);
    }
    let start = this.previousCircleValue
      ? this.previousCircleValue
      : 100 * (1 - (this.tillNextTurn + 1) / this.combat.turns.length);
    let end = 100 * (1 - this.tillNextTurn / this.combat.turns.length);
    await this.hotbar.render({ parts: ["endTurn"] });
    if (this.previousCircleValue >= 100) {
      await this.hotbar.render({ parts: ["centerTray"] });
    }
    this.hotbar.animationHandler.setCircle(start);
    this.hotbar.animationHandler.animateCircle(start, end, this);
    this.previousCircleValue = end >= 100 ? 0 : end;
  }

  getInitPlacement() {
    let init = this.combat.turns;
    let initIndex = init.findIndex(e => e.id == this.combatantId);
    let turn = this.combat.turn;
    let diff = initIndex - turn;
    if (diff < 0) {
      diff = init.length - turn + initIndex;
    }
    this.isTurn = diff == 0;
    this.isNext = diff == 1;
    this.tillNextTurn = diff;
  }
}
