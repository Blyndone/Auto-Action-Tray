export class TrayConfig {

 static async trayConfig() {
    const fields = foundry.applications.fields;

    const customStaticTray = fields.createTextInput({
      name: 'customStaticTrays',
      value: '',
    });

    const customStaticTrayGroup = fields.createFormGroup({
      input: customStaticTray,
      label: 'Additional Custom Static Tray',
      hint: "Add an Item Resource here for auto-recognition. Enter the Item Name. The item must have limited uses. Additionally, other items that consume this resource should be configured to use the inputted item's available uses.",
    });
    const clearCustomStaticTrays = fields.createCheckboxInput({
      name: 'clearCustomStaticTrays',
      value: false,
    });
    const clearCustomStaticTraysGroup = fields.createFormGroup({
      input: clearCustomStaticTrays,
      label: 'Clear Custom Static Trays',
      hint: 'Clear previous custom Static Trays',
    });

    const concentrationColor = fields.createTextInput({
      name: 'concentrationColor',
      value: '',
    });

    const concentrationColorGroup = fields.createFormGroup({
      input: concentrationColor,
      label: 'Concentration Color',
      hint: 'Input a color for concentration highlight.  Colors should be in Hex; Ex. #ff0000',
    });

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
    });

    const selectGroup = fields.createFormGroup({
      input: selectInput,
      label: 'Select Character Image Type',
      hint: 'Choose between portrait or token display',
    });

    const imageScale = fields.createNumberInput({
      name: 'imageScale',
      value: this.trayOptions['imageScale'],
    });
    const imageScaleOptions = fields.createFormGroup({
      input: imageScale,
      label: 'Image Scale',
      hint: 'Change Character Image Scale.',
    });
    const imageX = fields.createNumberInput({
      name: 'imageX',
      value: this.trayOptions['imageX'],
    });
    const imageXOptions = fields.createFormGroup({
      input: imageX,
      label: 'Image X Offset',
      hint: 'Change Character Image X Location.',
    });
    const imageY = fields.createNumberInput({
      name: 'imageY',
      value: this.trayOptions['imageY'],
    });
    const imageYOptions = fields.createFormGroup({
      input: imageY,
      label: 'Image Y Offset',
      hint: 'Change Character Image Y Location.',
    });

    const checkboxInput = fields.createCheckboxInput({
      name: 'healthIndicator',
      value: this.trayOptions['healthIndicator'],
    });
    const checkboxGroup = fields.createFormGroup({
      input: checkboxInput,
      label: 'Health Indicator',
      hint: 'Enable the red health indicator based on missing health percentage.',
    });

    const autoAddItems = fields.createCheckboxInput({
      name: 'autoAddItems',
      value: this.trayOptions['autoAddItems'],
    });
    const autoAddItemsGroup = fields.createFormGroup({
      input: autoAddItems,
      label: 'Auto Add Items ',
      hint: 'Automattily add items to the tray when they are created.',
    });

    const content = `${customStaticTrayGroup.outerHTML} ${clearCustomStaticTraysGroup.outerHTML} ${concentrationColorGroup.outerHTML} ${selectGroup.outerHTML} ${imageScaleOptions.outerHTML} ${imageXOptions.outerHTML} ${imageYOptions.outerHTML} ${checkboxGroup.outerHTML} ${autoAddItemsGroup.outerHTML}`;

    const method = await foundry.applications.api.DialogV2.wait({
      position: { width: 600 },
      window: { title: 'Tray Quick Config' },
      content: content,
      modal: false,

      buttons: [
        {
          label: 'Accept',
          action: 'accept',
          callback: (event, button, dialog) =>
            new FormDataExtended(button.form).object,
        },
        {
          label: 'Cancel',
          action: 'cancel',
          callback: (event, button, dialog) =>
            new FormDataExtended(button.form).object,
        },
      ],
    }).then((result) => {
      if (result['imageType'] == '') {
        result['imageType'] = this.trayOptions['imageType'];
      }
      if (result['clearCustomStaticTrays']) {
        this.trayOptions['customStaticTrays'] = [];
        result['customStaticTrays'] = [];
      }
      if (result['customStaticTrays'] != '') {
        let itemId = this.actor.items.find(
          (e) =>
            e.name.toLowerCase() == result['customStaticTrays'].toLowerCase()
        )?.id;
        if (itemId) {
          result['customStaticTrays'] = [
            ...this.trayOptions['customStaticTrays'],
            itemId,
          ];
        } else {
          result['customStaticTrays'] = this.trayOptions['customStaticTrays'];
        }
      }
      this.trayOptions = { ...this.trayOptions, ...result };
      this.setTrayConfig(this.trayOptions);
      this.render(true);
    });


  }




}