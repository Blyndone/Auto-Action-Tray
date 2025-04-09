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
  }

  async setActor(actor) {
    this.actor = actor;
    await this.setCombat(actor);
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
    let start = this.previousCircleValue
      ? this.previousCircleValue
      : 100 * (1 - (this.tillNextTurn + 1) / this.combat.turns.length);
    let end = 100 * (1 - this.tillNextTurn / this.combat.turns.length);
    await this.hotbar.render({ parts: ["endTurn"] });
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
