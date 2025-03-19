export class EffectTray {
  constructor(options = {}) {
    this.actor = options.actor;
    this.effects = options.effects || [];
  }

  async setActor(actor) {
    this.actor = actor;
    await this.setEffects();
  }
  setEffects() {
    let tmpArr = [];

    this.actor.appliedEffects.forEach(effect => {
      this.getDescription(effect).then(desc => {
        tmpArr.push({
          id: effect._id,
          name: effect.name,
          description: desc,
          img: effect.img,
          duration: effect.duration,
          type: effect.type,
          isTemporary: effect.isTemporary
        });
      });
    });
    this.effects = tmpArr;
  }

  async getDescription(effect) {
    let desc = effect.description;
    let regex = /\[(\S+)/;
    let match = desc.match(regex);
    if (!match) return desc;
    return await fromUuid(match[1]).then(item => {
      return item.text.content;
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
          // this.actor.deleteEmbeddedEntity("ActiveEffect", id);
        }
      });
  }

  parseUuid(string) {
    return "uuid";
  }
}
