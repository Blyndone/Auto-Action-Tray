export class EffectTray {
  // enrichHTML is expensive and setEffects() runs on every updateActor - which in combat means
  // every point of damage re-enriched every effect on the actor. Keyed by the raw source string
  // so an edited effect invalidates itself without needing a hook.
  #descCache = new Map()

  // What the last render request was based on, so a repeat call that changes nothing renders
  // nothing. Reset on actor switch below.
  #lastEffectSignature = null
  #lastActiveSignature = null
  #lastConcentrationId = null

  constructor(options = {}) {
    this.actor = options.actor
    this.effects = options.effects || []
    this.hotbar = null
  }

  async setActor(actor, hotbar) {
    this.actor = actor
    this.hotbar = hotbar
    // Bounds the cache: effect ids are only unique within an actor.
    this.#descCache.clear()
    // A new actor must always render, whatever the previous actor's effects looked like.
    this.#lastEffectSignature = null
    this.#lastActiveSignature = null
    this.#lastConcentrationId = null
    await this.setEffects()
  }
  /**
   * Two passes, deliberately.
   *
   * Everything the tray needs to decide *what* to show - the effect list, the active-effect
   * names, and which item is being concentrated on - comes from effect names and is computed
   * synchronously. Descriptions are enriched afterwards, because they are only ever seen in a
   * tooltip on hover.
   *
   * This used to be one pass behind `await Promise.all(...enrichHTML)`, so the concentration
   * icon over the character image could not appear until every applied effect had finished
   * enriching - a visible lag when casting a concentration spell.
   */
  setEffects() {
    const applied = [...this.actor.appliedEffects]

    this.effects = applied.map((effect) => ({
      id: effect._id,
      name: effect.name,
      description: this.#cachedDescription(effect),
      img: effect.img,
      duration: effect.duration,
      type: effect.type,
      isTemporary: effect.isTemporary,
      source: effect.parent.name,
    }))

    const effectNames = this.effects.map((e) => {
      const parts = e.name.split(':')
      return parts.length > 1 ? parts[1].trim() : e.name
    })
    const effectSources = this.effects.map((e) => e.source)
    this.hotbar.activeEffects = [...new Set([...effectNames, ...effectSources])]

    const itemName = this.effects
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

    // Only the parts that actually changed. The concentration icon carries an `animated-border`
    // CSS animation, and a characterImage render replaces that node - so re-rendering it on
    // every effect update restarted the animation mid-cast, which read as the icon flickering
    // when targets were confirmed. A cast fires this several times over (concentration effect,
    // slot spend, item uses), and only the first one changes anything the icon shows.
    const parts = []
    const effectSignature = this.effects.map((e) => `${e.id}:${e.duration?.remaining ?? ''}`).join()
    const concentrationId = this.hotbar.concentrationItem?.id ?? null
    const activeSignature = this.hotbar.activeEffects.join()

    if (effectSignature !== this.#lastEffectSignature) parts.push('effectsTray')
    if (activeSignature !== this.#lastActiveSignature) parts.push('centerTray')
    if (concentrationId !== this.#lastConcentrationId) parts.push('characterImage')

    this.#lastEffectSignature = effectSignature
    this.#lastActiveSignature = activeSignature
    this.#lastConcentrationId = concentrationId

    if (parts.length > 0) this.hotbar.requestRender(parts)

    return this.#enrichDescriptions(applied)
  }

  /** Enriched description for an effect if it is already cached, otherwise empty. */
  #cachedDescription(effect) {
    const cached = this.#descCache.get(effect.id)
    return cached && cached.src === (effect.description ?? '') ? cached.html : ''
  }

  /**
   * Fill in descriptions that were not cached yet, then re-render just the effects tray.
   * Nothing here blocks the icon or the tray contents.
   */
  async #enrichDescriptions(applied) {
    const missing = applied.filter((effect) => !this.#cachedDescription(effect))
    if (missing.length === 0) return

    await Promise.all(missing.map((effect) => this.getDescription(effect)))

    let patched = false
    for (const entry of this.effects) {
      const effect = applied.find((e) => e._id === entry.id)
      if (!effect) continue
      const html = this.#cachedDescription(effect)
      if (html && html !== entry.description) {
        entry.description = html
        patched = true
      }
    }
    if (patched) this.hotbar.requestRender('effectsTray')
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
    const src = effect.description ?? ''
    const cached = this.#descCache.get(effect.id)
    if (cached && cached.src === src) return cached.html

    const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(src)
    const html = '<div>' + enriched + '</div>'
    // Safe to cache: this enrichHTML call passes no relativeTo/rollData, so the output does not
    // depend on any state that could change underneath it.
    this.#descCache.set(effect.id, { src, html })
    return html
  }

  parseUuid(string) {
    return 'uuid'
  }
}
