export class EffectTray {
  constructor(options = {}) {
    this.actor = options.actor
    this.effects = options.effects || []
    this.hotbar = null
  }

  async setActor(actor, hotbar) {
    this.actor = actor
    this.hotbar = hotbar
    await this.setEffects()
  }
  async setEffects() {
    const effects = await Promise.all(
      this.actor.appliedEffects.map(async (effect) => {
        const description = await this.getDescription(effect)
        return {
          id: effect._id,
          name: effect.name,
          description: description,
          img: effect.img,
          duration: effect.duration,
          type: effect.type,
          isTemporary: effect.isTemporary,
          source: effect.parent.name,
        }
      }),
    )

    this.effects = effects

    let effectNames = effects.map((e) => {
      const parts = e.name.split(':')
      return parts.length > 1 ? parts[1].trim() : e.name
    })
    let effectSources = effects.map((e) => e.source)
    this.hotbar.activeEffects = [...new Set([...effectNames, ...effectSources])]
    let itemName = effects
      .filter((e) => e.name.startsWith('Concentrating'))[0]
      ?.name.split(':')[1]
      ?.trim()

    if (itemName) {
      this.hotbar.concentrationItem = this.hotbar
        .getActorAbilities(this.actor.uuid)
        .find((e) => e.name == itemName)
    } else {
      this.hotbar.concentrationItem = null
    }

    this.hotbar.requestRender(['effectsTray', 'centerTray', 'characterImage'])

  }
  static async removeEffect(event, element) {
    if (event?.dataset?.concentration == 'true') {
      EffectTray.removeConcentration.bind(this)()
      return
    }
    await foundry.applications.api.DialogV2.confirm({
      window: {
        title: `Delete Active Effect: ${event.dataset.name} `,
      },
      content: `<p>Remove the Active Effect -  ${event.dataset.name}</p>`,
      modal: true,
    }).then((result) => {
      if (result) {
        let id = event.dataset.effectId
        this.actor.effects.find((e) => e._id == id).delete()
      }
    })
  }

  static async removeConcentration() {
    let item = this.concentrationItem
    await foundry.applications.api.DialogV2.confirm({
      window: {
        title: `Remove Concentration for: ${item.name} `,
      },
      content: `<p>Remove Concentration -  ${item.name}</p>`,
      modal: true,
    }).then((result) => {
      if (result) {
        this.actor.effects.find((e) => e.name.startsWith('Concentrating')).delete()
      }
    })
  }

  async getDescription(effect) {
    let desc = effect.description
    desc = await foundry.applications.ux.TextEditor.implementation.enrichHTML(desc)

    return '<div>' + desc + '</div>'
  }

  parseUuid(string) {
    return 'uuid'
  }
}
