export class ConditionTray {
  constructor(options) {
    this.dndConditions = ConditionTray.dndConditions

    this.id = 'condition'
    this.customIcons = game.settings.get('auto-action-tray', 'customConditionIcons')
    this.application = options?.application || null
    this.conditions = []
    this.actorUuid = options?.actorUuid || null
    this.actor = options?.actor || null
    this.active = false
    this.label = 'Conditions'
    this.generateTray()
  }
  static setCustomIcons() {
    ConditionTray.dndConditions.coreConditions.forEach((condition) => {
      if (condition.marker && condition.id != 'concentrating') return
      CONFIG.statusEffects.find((e) => e.id == condition.id).img = condition.icon
      if (CONFIG.DND5E.conditionTypes[condition.id]) {
        CONFIG.DND5E.conditionTypes[condition.id].icon = condition.icon
      }
    })
    CONFIG.DND5E.bloodied.icon = 'modules/auto-action-tray/icons/base/Bloodied.svg'
    CONFIG.DND5E.statusEffects.concentrating.icon =
      'modules/auto-action-tray/icons/base/Concentrating.svg'
  }

  async generateTray() {
    this.conditions = await Promise.all(
      this.dndConditions.coreConditions.map(async (condition) => {
        if (condition.marker)
          return {
            ...condition,
            name: condition.name,
            img: condition.img,
            reference: null,
            description: condition.description,
            duration: condition?.duration || 'Condition',
            active: false,
          }

        const effect = CONFIG.statusEffects.find((e) => e.id === condition.id)
        return {
          ...condition,
          name: effect?.name || game.i18n.localize(`DND5E.Conditions.${condition.id}`),
          img: effect?.img || condition.icon,
          reference: effect?.reference,
          description: await this.getEnrichedText(condition.id),
          duration: 'Condition',
          active: false,
        }
      }),
    )
  }

  setActive() {
    this.active = true
    this.setConditions()
  }
  setInactive() {
    this.active = false
  }
  setActor(actor) {
    this.actor = actor
    this.active = false
    this.setConditions()
    this.application.requestRender('centerTray')
  }
  async setConditions() {
    if (this.conditions.length === 0) return
    let concentration = this.actor.collections.effects.find((e) =>
      e.name.startsWith('Concentrating'),
    )
    if (concentration) {
      this.conditions.find((c) => c.id === 'concentrating').description =
        await TextEditor.enrichHTML(concentration.description)
    } else {
      this.conditions.find((c) => c.id === 'concentrating').description =
        ConditionTray.dndConditions.coreConditions.find((c) => c.id === 'concentrating').description
    }
    this.conditions = this.conditions.map((condition) => {
      const effect = this.actor.collections.effects.find(
        (e) => e.name === condition.name || e.name.startsWith(condition.name),
      )
      return {
        ...condition,
        active: !!effect,
      }
    })
  }

async toggleCondition(event, target) {
  let conditionId = target.dataset.id;

  const condition = this.conditions.find((c) => c.id === conditionId);

  switch (true) {
    case conditionId === 'concentrating':
      await this.toggleConcentration(condition);
      break;
    
    case !condition.marker:
      await this.actor.toggleStatusEffect(conditionId);
      break;
    
    default:
      await this.toggleGeneralCondition(condition, conditionId);
      break;
  }

  await this.setConditions();
  this.application.requestRender('centerTray');
}

async toggleConcentration(condition) {
  const concentration = this.actor.collections.effects.find((e) => e.name.startsWith('Concentrating'));
  
  if (concentration) {
    await concentration.delete();
  } else {
    const effect = new ActiveEffect({
      id: condition.id,
      name: condition.name,
      img: condition.icon,
      description: condition.description,
      statuses: [],
      duration: { seconds: 999 },
    });
    await this.actor.createEmbeddedDocuments('ActiveEffect', [effect]);
  }
}

async toggleGeneralCondition(condition, conditionId) {
  let effect = this.actor.collections.effects.find(
    (e) => e.name === conditionId || 
           e.name === this.dndConditions.coreConditions.find((c) => c.id === conditionId).name,
  );

  if (effect) {
    await effect.delete();
  } else {
    const duration = condition.duration === 'Condition' ? 999 : condition.duration;
    effect = new ActiveEffect({
      id: condition.id,
      name: condition.name,
      img: condition.icon,
      description: condition.description,
      statuses: [],
      duration: { seconds: duration },
    });
    await this.actor.createEmbeddedDocuments('ActiveEffect', [effect]);
  }
}


  async getEnrichedText(conditionId) {
    const effect = CONFIG.statusEffects.find((e) => e.id === conditionId)
    if (!effect?.reference)
      return (
        this.dndConditions.coreConditions.find((e) => e.id == conditionId).description ||
        'Condition not found or missing reference.'
      )

    const document = await fromUuid(effect.reference)
    return TextEditor.enrichHTML(document?.text?.content || 'No content available.')
  }

  checkConcentration() {
    const effect = this.actor.collections.effects.find((e) => e.name.startsWith('Concentrating'))

    if (!effect) return null
    const parts = effect.name.split(': ')
    return parts.length > 1 ? parts[1] : 'Concentration Spell'
  }

  static dndConditions = {
    coreConditions: [
      {
        id: 'concentrating',
        name: 'Concentrating',
        img: 'modules/auto-action-tray/icons/base/Concentrating.png',
        icon: 'modules/auto-action-tray/icons/base/Concentrating.svg',
        description: 'You are maintaining concentration on a spell.',
        marker: true,
      },
      {
        id: 'heldAction',
        name: 'Held Action',
        img: 'modules/auto-action-tray/icons/base/HeldAction.png',
        icon: 'modules/auto-action-tray/icons/base/HeldAction.svg',
        description: 'You are holding an action.',
        marker: true,
        duration: 6,
      },
      {
        id: 'advantage',
        name: 'Advantage',
        img: 'modules/auto-action-tray/icons/base/Advantage.png',
        icon: 'modules/auto-action-tray/icons/base/Advantage.svg',
        description: 'You have advantage on a roll.',
        marker: true,
      },
      {
        id: 'disadvantage',
        name: 'Disadvantage',
        img: 'modules/auto-action-tray/icons/base/Disadvantage.png',
        icon: 'modules/auto-action-tray/icons/base/Disadvantage.svg',
        description: 'You have disadvantage on a roll.',
        marker: true,
      },

      {
        id: 'blinded',
        img: 'modules/auto-action-tray/icons/condition/Blinded.png',
        icon: 'modules/auto-action-tray/icons/condition/Blinded.svg',
      },
      {
        id: 'charmed',
        img: 'modules/auto-action-tray/icons/condition/Charmed.png',
        icon: 'modules/auto-action-tray/icons/condition/Charmed.svg',
      },
      {
        id: 'deafened',
        img: 'modules/auto-action-tray/icons/condition/Deafened.png',
        icon: 'modules/auto-action-tray/icons/condition/Deafened.svg',
      },
      {
        id: 'exhaustion',
        img: 'modules/auto-action-tray/icons/condition/Exhaustion.png',
        icon: 'modules/auto-action-tray/icons/condition/Exhaustion.svg',
      },
      {
        id: 'frightened',
        img: 'modules/auto-action-tray/icons/condition/Frightened.png',
        icon: 'modules/auto-action-tray/icons/condition/Frightened.svg',
      },
      {
        id: 'grappled',
        img: 'modules/auto-action-tray/icons/condition/Grappled.png',
        icon: 'modules/auto-action-tray/icons/condition/Grappled.svg',
      },
      {
        id: 'incapacitated',
        img: 'modules/auto-action-tray/icons/condition/Incapacitated.png',
        icon: 'modules/auto-action-tray/icons/condition/Incapacitated.svg',
      },
      {
        id: 'invisible',
        img: 'modules/auto-action-tray/icons/condition/Invisible.png',
        icon: 'modules/auto-action-tray/icons/condition/Invisible.svg',
      },
      {
        id: 'paralyzed',
        img: 'modules/auto-action-tray/icons/condition/Paralyzed.png',
        icon: 'modules/auto-action-tray/icons/condition/Paralyzed.svg',
      },
      {
        id: 'petrified',
        img: 'modules/auto-action-tray/icons/condition/Petrified.png',
        icon: 'modules/auto-action-tray/icons/condition/Petrified.svg',
      },
      {
        id: 'poisoned',
        img: 'modules/auto-action-tray/icons/condition/Poisoned.png',
        icon: 'modules/auto-action-tray/icons/condition/Poisoned.svg',
      },
      {
        id: 'prone',
        img: 'modules/auto-action-tray/icons/condition/Prone.png',
        icon: 'modules/auto-action-tray/icons/condition/Prone.svg',
      },
      {
        id: 'restrained',
        img: 'modules/auto-action-tray/icons/condition/Restrained.png',
        icon: 'modules/auto-action-tray/icons/condition/Restrained.svg',
      },
      {
        id: 'stunned',
        img: 'modules/auto-action-tray/icons/condition/Stunned.png',
        icon: 'modules/auto-action-tray/icons/condition/Stunned.svg',
      },
      {
        id: 'unconscious',
        img: 'modules/auto-action-tray/icons/condition/Unconscious.png',
        icon: 'modules/auto-action-tray/icons/condition/Unconscious.svg',
      },
      {
        id: 'dead',
        img: 'modules/auto-action-tray/icons/base/Dead.png',
        icon: 'modules/auto-action-tray/icons/base/Dead.svg',
        description: 'Dead',
      },
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
}
