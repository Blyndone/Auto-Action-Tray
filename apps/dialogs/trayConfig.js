import { createSliderInput, createFieldset } from './formHelpers.js'

const { ApplicationV2 } = foundry.applications.api
const { api } = foundry.applications
const fields = foundry.applications.fields

class TrayConfigApp extends api.HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options)
    this.hotbar = options.hotbar
    this.actor = options.hotbar.actor
    this.initialValues = {
      imageScale: this.hotbar.trayOptions['imageScale'],
      imageType: this.hotbar.trayOptions['imageType'],
      imageX: this.hotbar.trayOptions['imageX'],
      imageY: this.hotbar.trayOptions['imageY'],
    }
  }

  static DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['aat-tray-config'],
    window: {
      title: 'Tray Quick Config',
      icon: 'fa-solid fa-sliders',
      contentClasses: ['standard-form'],
    },
    position: { width: 560 },
    form: {
      closeOnSubmit: false,
    },
    actions: {
      accept: TrayConfigApp.onAccept,
      cancel: TrayConfigApp.onCancel,
    },
  }

  static PARTS = {
    tabs: {
      template: 'templates/generic/tab-navigation.hbs',
    },
    appearance: {
      template: 'modules/auto-action-tray/templates/dialogs/tray-config-appearance.hbs',
    },
    behavior: {
      template: 'modules/auto-action-tray/templates/dialogs/tray-config-behavior.hbs',
    },
    customTrays: {
      template: 'modules/auto-action-tray/templates/dialogs/tray-config-custom.hbs',
    },
    footer: {
      template: 'templates/generic/form-footer.hbs',
    },
  }

  static TABS = {
    sheet: {
      tabs: [
        { id: 'appearance', icon: 'fa-solid fa-palette', label: 'Appearance' },
        { id: 'behavior', icon: 'fa-solid fa-sliders', label: 'Behavior' },
        { id: 'customTrays', icon: 'fa-solid fa-layer-group', label: 'Custom Trays' },
      ],
      initial: 'appearance',
    },
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    const hotbar = this.hotbar
    const trayOptions = hotbar.trayOptions

    const themeInput = fields.createSelectInput({
      options: [
        { label: 'Default', value: '' },
        { label: 'Mind Flayer', value: 'theme-classic' },
        { label: 'Arcane', value: 'theme-arcane' },
        { label: 'Sanguine', value: 'theme-sanguine' },
        { label: 'Ocean', value: 'theme-ocean' },
        { label: 'Ember', value: 'theme-ember' },
        { label: 'Frost', value: 'theme-frost' },
        { label: 'Subterfuge', value: 'theme-subterfuge' },
        { label: 'Titan', value: 'theme-titan' },
        { label: 'Vesper', value: 'theme-vesper' },
        { label: 'Earth', value: 'theme-earth' },
        { label: 'Slate', value: 'theme-slate' },
        { label: 'Artificer', value: 'theme-artificer' },
        { label: 'Barbarian', value: 'theme-barbarian' },
        { label: 'Bard', value: 'theme-bard' },
        { label: 'Cleric', value: 'theme-cleric' },
        { label: 'Druid', value: 'theme-druid' },
        { label: 'Fighter', value: 'theme-fighter' },
        { label: 'Monk', value: 'theme-monk' },
        { label: 'Paladin', value: 'theme-paladin' },
        { label: 'Ranger', value: 'theme-ranger' },
        { label: 'Rogue', value: 'theme-rogue' },
        { label: 'Sorcerer', value: 'theme-sorcerer' },
        { label: 'Warlock', value: 'theme-warlock' },
        { label: 'Wizard', value: 'theme-wizard' },
      ],
      value: trayOptions?.theme || 'Default',
      name: 'theme',
    })
    const themeGroup = fields.createFormGroup({
      input: themeInput,
      label: 'Tray Theme',
      hint: 'Select Character Specific Tray Theme',
    })

    let themeColor = null
    if (game.settings.get('auto-action-tray', 'autoThemeTargetingColor')) {
      themeColor = getComputedStyle(
        document.querySelector('.' + game.settings.get('auto-action-tray', 'tempTheme')),
      )
        .getPropertyValue('--aat-hover-color')
        .trim()
    }
    const targetColor = foundry.applications.elements.HTMLColorPickerElement.create({
      name: 'targetColor',
      value: trayOptions['targetColor'] || themeColor || game.user.color || '#ff0000',
    })
    const targetColorGroup = fields.createFormGroup({
      input: targetColor,
      label: 'Target Line and Range Boundary Color',
      hint: 'Select the color for the target line and range boundary.',
    })

    const selectInput = fields.createSelectInput({
      options: [
        { label: '', value: '' },
        { label: 'Portrait', value: 'portrait' },
        { label: 'Token', value: 'token' },
      ],
      name: 'imageType',
    })
    const selectGroup = fields.createFormGroup({
      input: selectInput,
      label: 'Select Character Image Type',
      hint: 'Choose between portrait or token display',
    })

    const imageScale = createSliderInput({
      name: 'imageScale',
      min: 0.1,
      max: 5,
      step: 0.1,
      value: trayOptions['imageScale'],
    })
    const imageScaleGroup = fields.createFormGroup({
      input: imageScale,
      label: 'Image Scale',
      hint: 'Change Character Image Scale.',
    })
    const imageX = createSliderInput({
      name: 'imageX',
      min: -500,
      max: 500,
      step: 5,
      value: trayOptions['imageX'],
    })
    const imageXGroup = fields.createFormGroup({
      input: imageX,
      label: 'Image X Offset',
      hint: 'Change Character Image X Location.',
    })
    const imageY = createSliderInput({
      name: 'imageY',
      min: -1000,
      max: 1000,
      step: 5,
      value: trayOptions['imageY'],
    })
    const imageYGroup = fields.createFormGroup({
      input: imageY,
      label: 'Image Y Offset',
      hint: 'Change Character Image Y Location.',
    })

    const checkboxInput = fields.createCheckboxInput({
      name: 'healthIndicator',
      value: trayOptions['healthIndicator'],
    })
    const checkboxGroup = fields.createFormGroup({
      input: checkboxInput,
      label: 'Health Indicator',
      hint: 'Enable the red health indicator based on missing health percentage.',
    })

    context.appearanceFields = [
      createFieldset('Tray Theme', [themeGroup, targetColorGroup]),
      createFieldset('Character Image', [
        selectGroup,
        imageScaleGroup,
        imageXGroup,
        imageYGroup,
        checkboxGroup,
      ]),
    ]
      .map((fieldset) => fieldset.outerHTML)
      .join('')

    const autoAddItems = fields.createCheckboxInput({
      name: 'autoAddItems',
      value: trayOptions['autoAddItems'],
    })
    const autoAddItemsGroup = fields.createFormGroup({
      input: autoAddItems,
      label: 'Auto Add Items',
      hint: 'Automatically add items to the tray when they are created.',
    })

    const classSkills = fields.createCheckboxInput({
      name: 'classSkills',
      value: trayOptions['classSkills'] ?? true,
    })
    const classSkillsGroup = fields.createFormGroup({
      input: classSkills,
      label: 'Class Skills',
      hint: 'Display Class Specific Skills in the Tray.',
    })

    const skills = hotbar.skillTray.getSkills()
    const overrideSkills = fields.createMultiSelectInput({
      options: skills,
      value: trayOptions?.overrideSkills || [],
      name: 'overrideSkills',
    })
    const overrideSkillGroup = fields.createFormGroup({
      input: overrideSkills,
      label: 'Override Skills',
      hint: 'Select skills to override the default set.',
    })

    context.behaviorFields = [
      createFieldset('Tray Behavior', [autoAddItemsGroup, classSkillsGroup]),
      createFieldset('Skills', [overrideSkillGroup]),
    ]
      .map((fieldset) => fieldset.outerHTML)
      .join('')

    const customStaticTray = fields.createTextInput({
      name: 'customStaticTrays',
      value: '',
    })
    const customStaticTrayGroup = fields.createFormGroup({
      input: customStaticTray,
      label: 'Additional Custom Static Tray',
      hint: "Add an Item Resource here for auto-recognition. Enter the Item Name. The item must have limited uses. Additionally, other items that consume this resource should be configured to use the inputted item's available uses.",
    })

    const clearCustomStaticTrays = fields.createCheckboxInput({
      name: 'clearCustomStaticTrays',
      value: false,
    })
    const clearCustomStaticTraysGroup = fields.createFormGroup({
      input: clearCustomStaticTrays,
      label: 'Clear Custom Static Trays',
      hint: 'Clear previous custom Static Trays',
    })

    context.customTrayFields = createFieldset('Custom Static Trays', [
      customStaticTrayGroup,
      clearCustomStaticTraysGroup,
    ]).outerHTML

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

    const hotbar = this.hotbar
    const elements = this.element.elements

    this._imageListeners = {
      imageScale: (e) => {
        hotbar.trayOptions['imageScale'] = e.target.value
        e.target.nextElementSibling.textContent = e.target.value
        hotbar.requestRender('characterImage')
      },
      imageType: (e) => {
        hotbar.trayOptions['imageType'] = e.target.value
        hotbar.trayOptions['imageScale'] = 1
        hotbar.trayOptions['imageX'] = 0
        hotbar.trayOptions['imageY'] = 0
        hotbar.requestRender('characterImage')
      },
      imageX: (e) => {
        hotbar.trayOptions['imageX'] = e.target.value
        e.target.nextElementSibling.textContent = e.target.value
        hotbar.requestRender('characterImage')
      },
      imageY: (e) => {
        hotbar.trayOptions['imageY'] = e.target.value
        e.target.nextElementSibling.textContent = e.target.value
        hotbar.requestRender('characterImage')
      },
    }

    elements.imageScale?.addEventListener('input', this._imageListeners.imageScale)
    elements.imageType?.addEventListener('change', this._imageListeners.imageType)
    elements.imageX?.addEventListener('input', this._imageListeners.imageX)
    elements.imageY?.addEventListener('input', this._imageListeners.imageY)
  }

  static async onAccept(event, target) {
    const hotbar = this.hotbar

    if (hotbar.actor !== this.actor) {
      this.close()
      return
    }

    const formData = new FormDataExtended(this.element)
    const result = formData.object

    if (result['imageType'] === '') {
      result['imageType'] = hotbar.trayOptions['imageType']
    }

    if (result['theme']) {
      if (game.settings.get('auto-action-tray', 'tempTheme') != result.theme) {
        game.settings.set('auto-action-tray', 'tempTheme', result.theme)

        if (game.settings.get('auto-action-tray', 'autoThemeTargetingColor')) {
          result['targetColor'] = ''
        }
      }
    }

    if (result['clearCustomStaticTrays']) {
      hotbar.trayOptions['customStaticTrays'] = []
      result['customStaticTrays'] = []
    }

    if (result['customStaticTrays'] !== '') {
      let itemId = hotbar.actor.items.find(
        (e) => e.name.toLowerCase() === result['customStaticTrays'].toLowerCase(),
      )?.id
      if (itemId) {
        result['customStaticTrays'] = [...hotbar.trayOptions['customStaticTrays'], itemId]
      } else {
        result['customStaticTrays'] = hotbar.trayOptions['customStaticTrays']
      }
    }

    hotbar.trayOptions = { ...hotbar.trayOptions, ...result }
    hotbar.setTrayConfig(hotbar.trayOptions)
    hotbar.render(true)
    this.close()
  }

  static onCancel(event, target) {
    const hotbar = this.hotbar
    hotbar.trayOptions = { ...hotbar.trayOptions, ...this.initialValues }
    hotbar.requestRender('characterImage')
    this.close()
  }
}

export class TrayConfig {
  static async trayConfig() {
    new TrayConfigApp({ hotbar: this }).render(true)
  }
}
