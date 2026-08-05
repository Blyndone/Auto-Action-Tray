const { ApplicationV2 } = foundry.applications.api
const { api } = foundry.applications
const fields = foundry.applications.fields

function createFieldset(legend, groups) {
  const fieldset = document.createElement('fieldset')

  const legendEl = document.createElement('legend')
  legendEl.textContent = legend
  fieldset.appendChild(legendEl)

  for (const group of groups) fieldset.appendChild(group)

  return fieldset
}

class ItemConfigApp extends api.HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options)
    this.hotbar = options.hotbar
    this.item = options.item
  }

  static DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['aat-item-config'],
    window: {
      icon: 'fa-solid fa-gear',
      contentClasses: ['standard-form'],
    },
    position: { width: 600 },
    form: {
      closeOnSubmit: false,
    },
    actions: {
      accept: ItemConfigApp.onAccept,
      cancel: ItemConfigApp.onCancel,
      reset: ItemConfigApp.onReset,
    },
  }

  static PARTS = {
    header: {
      template: 'modules/auto-action-tray/templates/dialogs/item-config-header.hbs',
    },
    fields: {
      template: 'modules/auto-action-tray/templates/dialogs/item-config-fields.hbs',
    },
    footer: {
      template: 'templates/generic/form-footer.hbs',
    },
  }

  get title() {
    return `Item Config - ${this.item.name}`
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    const item = this.item

    let flags = null
    try {
      flags = JSON.parse(item.getFlag('auto-action-tray', 'itemConfig'))
    } catch (e) {}

    context.item = item
    context.description = item.system.description.value

    const useTargetHelper = fields.createCheckboxInput({
      name: 'useTargetHelper',
      value: flags ? flags['useTargetHelper'] : true,
    })
    const useTargetHelperGroup = fields.createFormGroup({
      input: useTargetHelper,
      label: 'Enable Target Helper',
      hint: 'Use the Target Helper for this item.',
    })

    const useDefaultTargetCount = fields.createCheckboxInput({
      name: 'useDefaultTargetCount',
      value: flags ? flags['useDefaultTargetCount'] : true,
    })
    const useDefaultTargetCountGroup = fields.createFormGroup({
      input: useDefaultTargetCount,
      label: 'Use Default Target Count',
      hint: 'Use the Default Target Count of the item',
    })

    const rollIndividual = fields.createCheckboxInput({
      name: 'rollIndividual',
      value: flags ? flags['rollIndividual'] : true,
    })
    const rollIndividualGroup = fields.createFormGroup({
      input: rollIndividual,
      label: 'Roll Individual Attacks',
      hint: 'Roll Individual Attacks for this item.',
    })

    const fastForward = fields.createSelectInput({
      options: [
        { label: 'Tray Default', value: 'default' },
        { label: 'Always', value: 'always' },
        { label: 'Never', value: 'never' },
      ],
      name: 'fastForward',
      value: flags ? flags['fastForward'] : 'default',
    })
    const fastForwardGroup = fields.createFormGroup({
      input: fastForward,
      label: 'Always Fast Forward',
      hint: 'Always Fast Forward this item Roll.',
    })

    const numTargets = fields.createNumberInput({
      name: 'numTargets',
      value: flags ? flags['numTargets'] : null,
      step: 1,
    })
    const numTargetsGroup = fields.createFormGroup({
      input: numTargets,
      label: 'Number of Targets',
      hint: 'Override the Number of Targets for this item.',
    })

    const animationWaitTime = fields.createNumberInput({
      name: 'animationWaitTime',
      value: flags ? flags['animationWaitTime'] : true,
    })
    const animationWaitTimeGroup = fields.createFormGroup({
      input: animationWaitTime,
      label: 'Multiple Use Animation Wait Time',
      hint: 'Set a maximum time to wait for animations for this item in milliseconds.',
    })

    context.fieldsHtml = [
      createFieldset('Targeting', [
        useTargetHelperGroup,
        useDefaultTargetCountGroup,
        numTargetsGroup,
      ]),
      createFieldset('Rolling & Animation', [
        rollIndividualGroup,
        fastForwardGroup,
        animationWaitTimeGroup,
      ]),
    ]
      .map((fieldset) => fieldset.outerHTML)
      .join('')

    context.buttons = [
      { type: 'button', action: 'cancel', icon: 'fa-solid fa-xmark', label: 'Cancel' },
      { type: 'button', action: 'reset', icon: 'fa-solid fa-rotate-left', label: 'Reset' },
      { type: 'button', action: 'accept', icon: 'fa-solid fa-check', label: 'Accept' },
    ]

    return context
  }

  _onClose(options) {
    super._onClose(options)
    this.hotbar.itemConfigItem = null
    this.hotbar.requestRender('equipmentMiscTray')
  }

  static async onAccept(event, target) {
    const item = this.item

    const formData = new FormDataExtended(this.element)
    const result = formData.object

    if (result.numTargets != null) {
      result.useDefaultTargetCount = false
    }
    item.setFlag('auto-action-tray', 'itemConfig', JSON.stringify(result))

    this.close()
  }

  static onCancel(event, target) {
    this.close()
  }

  static async onReset(event, target) {
    this.item.unsetFlag('auto-action-tray', 'itemConfig')
    this.close()
  }
}

export class ItemConfig {
  static async itemConfig(item) {
    new ItemConfigApp({ hotbar: this, item }).render(true)
  }

  static getItemConfig(item) {
    // Accepts either a raw Item document or an AATItem wrapper (which holds the document on `.item`).
    const doc = item?.item ?? item
    // Most items have no saved config. Checking the flag first avoids throwing and swallowing a
    // SyntaxError once per item on every tray build.
    const flag = doc.getFlag('auto-action-tray', 'itemConfig')
    if (typeof flag !== 'string') return null
    try {
      return JSON.parse(flag)
    } catch (e) {
      return null
    }
  }
}
