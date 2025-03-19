export class EffectTray {
  constructor(options = {}) {
    this.actor = options.actor;
    this.effects = options.effects;
  }

  setActor(actor) {
    this.actor = actor;
    this.setEffects();
  }
  setEffects() {
    this.effects = this.actor.appliedEffects;
  }
}
