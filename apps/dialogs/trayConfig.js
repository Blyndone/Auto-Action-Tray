export class TrayConfig {
  static async trayConfig() {
    let actor = this.actor
    const fields = foundry.applications.fields
    const createSliderInput = (options) => {
      const wrapper = document.createElement('div')
      wrapper.classList.add('form-fields')

      const input = document.createElement('input')
      input.type = 'range'
      input.name = options.name
      input.style.flex = 'auto'

      if (typeof options.min === 'number') input.setAttribute('min', String(options.min))
      if (typeof options.max === 'number') input.setAttribute('max', String(options.max))
      if (typeof options.step === 'number') input.setAttribute('step', String(options.step))
      if (typeof options.value === 'number') input.setAttribute('value', String(options.value))



      const display = document.createElement('div')
      display.id = options.name + '-label'
      display.classList.add('value-display')
      display.textContent = options.value

      wrapper.appendChild(input)
      wrapper.appendChild(display)

      return wrapper
    }

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
      value: this.trayOptions?.theme || 'Default',
      name: 'theme',
    })

    const themeGroup = fields.createFormGroup({
      input: themeInput,
      label: 'Tray Theme',
      hint: 'Select Character Specific Tray Theme',
    })

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



    const selectInput = fields.createSelectInput({
      options: [
        {
          label: '',
          value: '',
        },
        {
          label: 'Portrait',
          value: 'portrait',
        },
        {
          label: 'Token',
          value: 'token',
        },
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
      value: this.trayOptions['imageScale'],
    })

    const imageScaleOptions = fields.createFormGroup({
      input: imageScale,
      label: 'Image Scale',
      hint: 'Change Character Image Scale.',
    })
    const imageX = createSliderInput({
      name: 'imageX',
      min: -500,
      max: 500,
      step: 5,
      value: this.trayOptions['imageX'],
    })
    const imageXOptions = fields.createFormGroup({
      input: imageX,
      label: 'Image X Offset',
      hint: 'Change Character Image X Location.',
    })
    const imageY = createSliderInput({
      name: 'imageY',
      min: -1000,
      max: 1000,
      step: 5,
      value: this.trayOptions['imageY'],
    })
    const imageYOptions = fields.createFormGroup({
      input: imageY,
      label: 'Image Y Offset',
      hint: 'Change Character Image Y Location.',
    })

    const checkboxInput = fields.createCheckboxInput({
      name: 'healthIndicator',
      value: this.trayOptions['healthIndicator'],
    })
    const checkboxGroup = fields.createFormGroup({
      input: checkboxInput,
      label: 'Health Indicator',
      hint: 'Enable the red health indicator based on missing health percentage.',
    })

    const autoAddItems = fields.createCheckboxInput({
      name: 'autoAddItems',
      value: this.trayOptions['autoAddItems'],
    })
    const autoAddItemsGroup = fields.createFormGroup({
      input: autoAddItems,
      label: 'Auto Add Items ',
      hint: 'Automatically add items to the tray when they are created.',
    })

    const content = ` ${themeGroup.outerHTML} ${customStaticTrayGroup.outerHTML} ${clearCustomStaticTraysGroup.outerHTML} ${selectGroup.outerHTML} ${imageScaleOptions.outerHTML} ${imageXOptions.outerHTML} ${imageYOptions.outerHTML} ${checkboxGroup.outerHTML} ${autoAddItemsGroup.outerHTML}`
    let dialogElement 
    let handlers = {}
    let initialValues = {
      imageScale: this.trayOptions['imageScale'],
      imageType: this.trayOptions['imageType'],
      imageX: this.trayOptions['imageX'],
      imageY: this.trayOptions['imageY'],
    }
    const method = await foundry.applications.api.DialogV2.wait({
      position: { width: 600 },
      window: { title: 'Tray Quick Config' },
      content: content,
      modal: false,
      rejectClose: false,

      render: (event, dialogEl) => {
        dialogElement = dialogEl 

        const form = dialogEl.querySelector('form')
        const elements = form.elements

        handlers.imageScale = (e) => {
          this.trayOptions['imageScale'] = e.target.value
          e.target.nextElementSibling.textContent = e.target.value
          this.render({ parts: ['characterImage'] })
        }

        handlers.imageType = (e) => {
          this.trayOptions['imageType'] = e.target.value
          this.trayOptions['imageScale'] = 1
          this.trayOptions['imageX'] = 0
          this.trayOptions['imageY'] = 0
          this.render({ parts: ['characterImage'] })
        }

        handlers.imageX = (e) => {
          this.trayOptions['imageX'] = e.target.value
          e.target.nextElementSibling.textContent = e.target.value
          this.render({ parts: ['characterImage'] })
        }

        handlers.imageY = (e) => {
          this.trayOptions['imageY'] = e.target.value
          e.target.nextElementSibling.textContent = e.target.value
          this.render({ parts: ['characterImage'] })
        }

        elements.imageScale.addEventListener('input', handlers.imageScale)
        elements.imageType.addEventListener('change', handlers.imageType)
        elements.imageX.addEventListener('input', handlers.imageX)
        elements.imageY.addEventListener('input', handlers.imageY)
      },

      buttons: [
        {
          label: 'Accept',
          action: 'accept',
          callback: (event, button, dialog) => new FormDataExtended(button.form).object,
        },
        {
          label: 'Cancel',
          action: 'cancel',
          callback: (event, button, dialog) => new FormDataExtended(button.form).object,
        },
      ],
    }).then((result) => {

      const form = dialogElement?.querySelector('form')
      if (form) {
        const elements = form.elements
        elements.imageScale?.removeEventListener('input', handlers.imageScale)
        elements.imageType?.removeEventListener('change', handlers.imageType)
        elements.imageX?.removeEventListener('input', handlers.imageX)
        elements.imageY?.removeEventListener('input', handlers.imageY)
      }

  
      if (event.target.dataset.action === 'cancel' || !result) {
        this.trayOptions = { ...this.trayOptions, ...initialValues }
        this.render({ parts: ['characterImage'] })
        return
      }
      if (actor !== this.actor) return
      if (result['imageType'] === '') {
        result['imageType'] = this.trayOptions['imageType']
      }

      if (result['theme']) {
        game.settings.set('auto-action-tray', 'tempTheme', result.theme)
      }

      if (result['clearCustomStaticTrays']) {
        this.trayOptions['customStaticTrays'] = []
        result['customStaticTrays'] = []
      }

      if (result['customStaticTrays'] !== '') {
        let itemId = this.actor.items.find(
          (e) => e.name.toLowerCase() === result['customStaticTrays'].toLowerCase(),
        )?.id
        if (itemId) {
          result['customStaticTrays'] = [...this.trayOptions['customStaticTrays'], itemId]
        } else {
          result['customStaticTrays'] = this.trayOptions['customStaticTrays']
        }
      }

      this.trayOptions = { ...this.trayOptions, ...result }
      this.setTrayConfig(this.trayOptions)
      this.render(true)
    })
  }
}
