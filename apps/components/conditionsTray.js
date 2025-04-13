export class ConditionTray {
  constructor(options) {
    this.dndConditions = {
      coreConditions: [
        { id: 'dead', icon: 'modules/auto-action-tray/icons/base/Dead.png' },
        { id: 'blinded', icon: 'modules/auto-action-tray/icons/condition/Blinded.png' },
        { id: 'charmed', icon: 'modules/auto-action-tray/icons/condition/Charmed.png' },
        { id: 'concentrating', icon: 'modules/auto-action-tray/icons/base/Concentrating.png' },
        { id: 'deafened', icon: 'modules/auto-action-tray/icons/condition/Deafened.png' },
        { id: 'exhaustion', icon: 'modules/auto-action-tray/icons/condition/Exhaustion.png' },
        { id: 'frightened', icon: 'modules/auto-action-tray/icons/condition/Frightened.png' },
        { id: 'grappled', icon: 'modules/auto-action-tray/icons/condition/Grappled.png' },
        { id: 'incapacitated', icon: 'modules/auto-action-tray/icons/condition/Incapacitated.png' },
        { id: 'invisible', icon: 'modules/auto-action-tray/icons/condition/Invisible.png' },
        { id: 'paralyzed', icon: 'modules/auto-action-tray/icons/condition/Paralyzed.png' },
        { id: 'petrified', icon: 'modules/auto-action-tray/icons/condition/Petrified.png' },
        { id: 'poisoned', icon: 'modules/auto-action-tray/icons/condition/Poisoned.png' },
        { id: 'prone', icon: 'modules/auto-action-tray/icons/condition/Prone.png' },
        { id: 'restrained', icon: 'modules/auto-action-tray/icons/condition/Restrained.png' },
        { id: 'stunned', icon: 'modules/auto-action-tray/icons/condition/Stunned.png' },
        { id: 'unconscious', icon: 'modules/auto-action-tray/icons/condition/Unconscious.png' },
      ],
      extendedConditions: [
        { id: 'coverHalf' },
        { id: 'coverThreeQuarters' },
        { id: 'coverTotal' },
        { id: 'bleeding' },
        { id: 'burning' },
        { id: 'burrowing' },
        { id: 'cursed' },
        { id: 'dehydration' },
        { id: 'diseased' },
        { id: 'dodging' },
        { id: 'encumbered' },
        { id: 'ethereal' },
        { id: 'exceedingCarryingCapacity' },
        { id: 'falling' },
        { id: 'flying' },
        { id: 'heavilyEncumbered' },
        { id: 'hiding' },
        { id: 'hovering' },
        { id: 'malnutrition' },
        { id: 'marked' },
        { id: 'silenced' },
        { id: 'sleeping' },
        { id: 'stable' },
        { id: 'suffocation' },
        { id: 'surprised' },
        { id: 'transformed' },
        { id: 'bonusaction' },
        { id: 'reaction' },
        { id: 'flanking' },
        { id: 'flanked' },
      ],
    }

    this.id = 'condition'
    this.application = options?.application || null
    this.conditions = []
    this.actorUuid = options?.actorUuid || null
    this.actor = options?.actor || null
    this.active = false
    this.label = ''
    this.generateTray()
  }
  async generateTray() {
    this.conditions = await Promise.all(
      this.dndConditions.coreConditions.map(async (condition) => {
        const effect = CONFIG.statusEffects.find((e) => e.id === condition.id)

        return {
          ...condition,
          name: effect?.name || game.i18n.localize(`DND5E.Conditions.${condition.id}`),
          icon: effect?.icon || condition.icon,
          reference: effect?.reference,
          description: await this.getEnrichedText(condition.id),
          duration: 'Condition',
        }
      }),
    )
  }
  // new ActiveEffect({
  //   id: 'paralyzed',
  //   _id: 'paralyzed0000000',
  //   name: 'A5E.ConditionParalyzed',
  //   img: 'icons/svg/paralysis.svg',
  //   statuses: ['incapacitated']
  // })

  setActive() {
    this.active = true
  }
  setInactive() {
    this.active = false
  }
  setActor(actor) {
    this.actor = actor
  }

  toggleCondition(event, target) {
    let conditionId = target.dataset.id
    const condition = this.conditions.find((c) => c.id === conditionId)
    // this.actor.toggleStatusEffect(conditionId)
    let effect = new ActiveEffect({
     id: condition.id,
      name: condition.name,
      img: condition.icon,
      statuses: [condition.id],
  })
    this.actor.createEmbeddedDocuments('ActiveEffect', [effect])
  }

  async getEnrichedText(conditionId) {
    const effect = CONFIG.statusEffects.find((e) => e.id === conditionId)
    if (!effect?.reference) return 'Condition not found or missing reference.'

    const document = await fromUuid(effect.reference)
    return TextEditor.enrichHTML(document?.text?.content || 'No content available.')
  }
}
