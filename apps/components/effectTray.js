export class EffectTray {
  constructor(options = {}) {
    this.actor = options.actor;
    this.effects = options.effects || [];
    this.hotbar = null;
  }

  async setActor(actor, hotbar) {
    this.actor = actor;
    this.hotbar = hotbar;
    await this.setEffects();
  }
  async setEffects() {
    let effectsPromises = this.actor.appliedEffects.map(async effect => {
      let desc = await this.getDescription(effect);
      return {
        id: effect._id,
        name: effect.name,
        description: desc,
        img: effect.img,
        duration: effect.duration,
        type: effect.type,
        isTemporary: effect.isTemporary
      };
    });

    await Promise.all(effectsPromises).then(effects => {
      this.effects = effects;
      this.hotbar.render({ parts: ["effectsTray"] });
    });
  }

  static async removeEffect(event, element) {
    await foundry.applications.api.DialogV2
      .confirm({
        window: { title: `Delete Active Effect: ${event.dataset.name} ` },
        content: `<p>Remove the Active Effect -  ${event.dataset.name}</p>`,
        modal: true
      })
      .then(result => {
        if (result) {
          let id = event.dataset.effectId;
          this.actor.effects.find(e => e._id == id).delete();
        }
      });
  }

  async getDescription(effect) {
    let desc = effect.description;
    desc = await TextEditor.enrichHTML(desc);

    return "<div>" + desc + "</div>";
  }

  parseUuid(string) {
    return "uuid";
  }
}
