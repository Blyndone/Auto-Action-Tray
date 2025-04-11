export class ItemConfig {
  static async itemConfig(item) {
    const fields = foundry.applications.fields;
    let flags = null;
    try {
      flags = JSON.parse(item.getFlag("auto-action-tray", "itemConfig"));
    } catch (e) {}

    const useTargetHelper = fields.createCheckboxInput({
      name: "useTargetHelper",
      value: flags ? flags["useTargetHelper"] : true
    });
    const useTargetHelperGroup = fields.createFormGroup({
      input: useTargetHelper,
      label: "Enable Target Helper",
      hint: "Use the Target Helper for this item."
    });

    const useDefaultTargetCount = fields.createCheckboxInput({
      name: "useDefaultTargetCount",
      value: flags ? flags["useDefaultTargetCount"] : true
    });
    const useDefaultTargetCountGroup = fields.createFormGroup({
      input: useDefaultTargetCount,
      label: "Use Default Target Count",
      hint: "Use the Default Target Count of the item"
    });

    const rollIndividual = fields.createCheckboxInput({
      name: "rollIndividual",
      value: flags ? flags["rollIndividual"] : true
    });
    const rollIndividualGroup = fields.createFormGroup({
      input: rollIndividual,
      label: "Roll Individual Attacks",
      hint: "Roll Individual Attacks for this item."
    });

    const numTargets = fields.createNumberInput({
      name: "numTargets",
      value: flags ? flags["numTargets"] : null
    });
    const numTargetsOptions = fields.createFormGroup({
      input: numTargets,
      label: "Number of Targets",
      hint: "Override the Number of Targets for this item."
    });

    const content = `${useTargetHelperGroup.outerHTML} ${useDefaultTargetCountGroup.outerHTML} ${rollIndividualGroup.outerHTML} ${numTargetsOptions.outerHTML} `;

    const method = await foundry.applications.api.DialogV2
      .wait({
        position: { width: 600 },
        window: { title: `Item Config  - ${item.name}` },
        content: content,
        modal: false,
        rejectClose: false,

        buttons: [
          {
            label: "Accept",
            action: "accept",
            callback: (event, button, dialog) =>
              new FormDataExtended(button.form).object
          },
          {
            label: "Cancel",
            action: "cancel",
            callback: (event, button, dialog) =>
              new FormDataExtended(button.form).object
          },
          {
            label: "Reset",
            action: "reset",
            callback: (event, button, dialog) => {}
          }
        ]
      })
      .then(result => {
        this.toggleItemSelector();
        this.itemConfigItem = null;
        if (result === "cancel" || result == null) {
          this.render({ parts: ["equipmentMiscTray"] });
          return;
        }
        if (result === "reset") {
          item.unsetFlag("auto-action-tray", "itemConfig");
        } else {
          if (result.numTargets != null) {
            result.useDefaultTargetCount = false;
          }
          item.setFlag(
            "auto-action-tray",
            "itemConfig",
            JSON.stringify(result)
          );
        }
        this.render({ parts: ["equipmentMiscTray"] });
      });
  }

  static getItemConfig(item) {
    let flags = null;
    try {
      flags = JSON.parse(item.getFlag("auto-action-tray", "itemConfig"));
    } catch (e) {}
    return flags;
  }
}
