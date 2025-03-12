export class CombatHandler {
  constructor(actor, hotbar) {
    this.actor;
    this.token;
    this.combatantId;
    this.inCombat;
    this.combat;
    this.isTurn = false;
    this.isNext = false;
    this.tillNextTurn = 0;
    this.hotbar = hotbar;
    this.setCombat(actor);
  }

  setCombat(actor) {
    this.actor = actor;
    this.token = actor.getActiveTokens()[0] || null;
    this.inCombat = actor.inCombat;
    this.combat = null;

    if (this.inCombat && this.token && this.token.combatant) {
      this.combat = this.token.combatant.combat;
      this.combatantId = this.token.combatant.id;
      this.getInitPlacement();
    }
  }

  updateCombat(actor, event) {
    if (this.actor !== actor) {
      this.setCombat(actor);
    }

    this.getInitPlacement();
    this.hotbar.refresh();
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

  //
}
