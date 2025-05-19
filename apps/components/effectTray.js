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
    const effects = await Promise.all(
      this.actor.appliedEffects.map(async effect => {
        const description = await this.getDescription(effect);
        return {
          id: effect._id,
          name: effect.name,
          description: description,
          img: effect.img,
          duration: effect.duration,
          type: effect.type,
          isTemporary: effect.isTemporary,
          source: effect.parent.name
        };
      })
    );

    this.effects = effects;

    let effectNames = effects.map(e => {
      const parts = e.name.split(":");
      return parts.length > 1 ? parts[1].trim() : e.name;
    });
    let effectSources = effects.map(e => e.source);
    this.hotbar.activeEffects = [
      ...new Set([...effectNames, ...effectSources])
    ];

    // if (!this.hotbar.animating) {
    this.hotbar.render({ parts: ["effectsTray", "centerTray"] });
    // }
  }
  static async removeEffect(event, element) {
    await foundry.applications.api.DialogV2
      .confirm({
        window: {
          title: `Delete Active Effect: ${event.dataset.name} `
        },
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
