import { createSliderInput, createFieldset } from './formHelpers.js'

const { ApplicationV2 } = foundry.applications.api
const { api } = foundry.applications
const fields = foundry.applications.fields

const MODULE_NAME = 'auto-action-tray'

const SETTING_GROUPS = {
  general: [
    { legend: 'Hotbar', keys: ['enable', 'scale', 'bgOpacity', 'quickElevation'] },
    { legend: 'Grid', keys: ['rowCount', 'columnCount'] },
  ],
  appearance: [
    { legend: 'Theme', keys: ['autoTheme', 'autoThemeTargetingColor', 'theme'] },
    { legend: 'Icons & Cursors', keys: ['customConditionIcons', 'customTargetingCursors'] },
  ],
  targeting: [
    { legend: 'Range', keys: ['enableRangeHover', 'defaultRangeBoundary', 'enableRangeBoundary'] },
    {
      legend: 'Target Lines',
      keys: [
        'receiveTargetLines',
        'sendTargetLines',
        'enableTargetingChatMessage',
        'targetLinePollRate',
      ],
    },
  ],
  itemUse: [
    {
      legend: 'Use Feedback',
      keys: ['enableUseItemName', 'enableUseItemIcon', 'useItemIconSize', 'useItemTextSize'],
    },
    {
      legend: 'Behavior',
      keys: ['multiItemUseDelay', 'promptConcentrationOverwrite', 'saveNpcData'],
    },
  ],
  experimental: [
    {
      legend: 'Automation',
      keys: [
        'quickActionHelper',
        'unboundPathfindingDepth',
        'quickActionDepth',
        'interceptMidiReactions',
      ],
    },
    {
      legend: 'Diagnostics',
      keys: ['strictTrayRebuild', 'debugPerf'],
    },
  ],
}

function buildSettingField(key) {
  const config = game.settings.settings.get(`${MODULE_NAME}.${key}`)
  const value = game.settings.get(MODULE_NAME, key)
  const disabled = config.scope === 'world' && !game.user.isGM

  let input
  if (config.type === Boolean) {
    input = fields.createCheckboxInput({ name: key, value, disabled })
  } else if (config.type instanceof foundry.data.fields.StringField && config.type.choices) {
    input = fields.createSelectInput({
      name: key,
      value,
      disabled,
      options: Object.entries(config.type.choices).map(([optionValue, label]) => ({
        value: optionValue,
        label,
      })),
    })
  } else if (config.range) {
    input = createSliderInput({
      name: key,
      value,
      disabled,
      min: config.range.min,
      max: config.range.max,
      step: config.range.step,
    })
  } else {
    input = fields.createNumberInput({ name: key, value, disabled })
  }

  return fields.createFormGroup({ input, label: config.name, hint: config.hint })
}

function buildTabFields(tabId) {
  return SETTING_GROUPS[tabId]
    .map(({ legend, keys }) => createFieldset(legend, keys.map(buildSettingField)))
    .map((fieldset) => fieldset.outerHTML)
    .join('')
}

export class SettingsConfigApp extends api.HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['aat-settings-config'],
    window: {
      title: 'Auto Action Tray Settings',
      icon: 'fa-solid fa-sliders',
      contentClasses: ['standard-form'],
    },
    position: { width: 640 },
    form: {
      closeOnSubmit: false,
    },
    actions: {
      accept: SettingsConfigApp.onAccept,
      cancel: SettingsConfigApp.onCancel,
    },
  }

  static PARTS = {
    tabs: {
      template: 'templates/generic/tab-navigation.hbs',
    },
    general: {
      template: 'modules/auto-action-tray/templates/dialogs/settings-config-general.hbs',
    },
    appearance: {
      template: 'modules/auto-action-tray/templates/dialogs/settings-config-appearance.hbs',
    },
    targeting: {
      template: 'modules/auto-action-tray/templates/dialogs/settings-config-targeting.hbs',
    },
    itemUse: {
      template: 'modules/auto-action-tray/templates/dialogs/settings-config-item-use.hbs',
    },
    experimental: {
      template: 'modules/auto-action-tray/templates/dialogs/settings-config-experimental.hbs',
    },
    footer: {
      template: 'templates/generic/form-footer.hbs',
    },
  }

  static TABS = {
    sheet: {
      tabs: [
        { id: 'general', icon: 'fa-solid fa-house', label: 'General' },
        { id: 'appearance', icon: 'fa-solid fa-palette', label: 'Appearance' },
        { id: 'targeting', icon: 'fa-solid fa-crosshairs', label: 'Targeting & Range' },
        { id: 'itemUse', icon: 'fa-solid fa-hand-fist', label: 'Item Use' },
        { id: 'experimental', icon: 'fa-solid fa-flask', label: 'Experimental' },
      ],
      initial: 'general',
    },
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options)

    for (const tabId of Object.keys(SETTING_GROUPS)) {
      context[`${tabId}Fields`] = buildTabFields(tabId)
    }

    context.buttons = [
      { type: 'button', action: 'cancel', icon: 'fa-solid fa-xmark', label: 'Cancel' },
      { type: 'button', action: 'accept', icon: 'fa-solid fa-check', label: 'Accept' },
    ]

    return context
  }

  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context)
    if (partId in partContext.tabs) partContext.tab = partContext.tabs[partId]
    return partContext
  }

  _onRender(context, options) {
    super._onRender(context, options)

    for (const input of this.element.querySelectorAll('.aat-slider-field input[type="range"]')) {
      input.addEventListener('input', (e) => {
        e.target.nextElementSibling.textContent = e.target.value
      })
    }
  }

  static async onAccept(event, target) {
    const formData = new FormDataExtended(this.element)
    const result = formData.object

    for (const [key, value] of Object.entries(result)) {
      if (game.settings.get(MODULE_NAME, key) !== value) {
        await game.settings.set(MODULE_NAME, key, value)
      }
    }

    this.close()
  }

  static onCancel(event, target) {
    this.close()
  }
}
