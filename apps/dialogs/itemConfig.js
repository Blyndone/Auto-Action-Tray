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

    const fastForward = fields.createSelectInput({
      options: [
        {
          label: "Tray Default",
          value: "default"
        },
        {
          label: "Always",
          value: "always"
        },
        {
          label: "Never",
          value: "never"
        }
      ],
      name: "fastForward",
      value: flags ? flags["fastForward"] : "default"
    });

    const fastForwardGroup = fields.createFormGroup({
      input: fastForward,
      label: "Always Fast Forward",
      hint: "Always Fast Forward this item Roll."
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

    const createEl = (tag, props = {}, styles = {}) => {
      const el = document.createElement(tag);
      Object.assign(el, props);
      Object.assign(el.style, styles);
      return el;
    };

    const header = createEl(
      "h3",
      { innerText: `Configure: ${item.name}` },
      { textAlign: "center", marginBottom: "10px" }
    );

    const img = createEl(
      "img",
      { src: item.img },
      { width: "100px", height: "100px" }
    );

    const description = createEl(
      "div",
      {
        innerHTML: `<div>${item.name}<br><div class='hint'>${item.system
          .description.value}</div></div>`
      },
      {
        fontSize: "14px",
        textAlign: "left",
        padding: "5px",
        overflowY: "auto",
        maxHeight: "200px",
        flex: "1"
      }
    );

    const itemblock = createEl(
      "div",
      {},
      {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        border: "1px solid black",
        padding: "10px",
        borderRadius: "10px",
        boxShadow: "0px 0px 10px black",
        width: "100%",
        boxSizing: "border-box",
        position: "relative",
        zIndex: "9999",
        overflow: "hidden",
        maxHeight: "250px",
        overflowY: "auto",
        overflowX: "hidden"
      }
    );

    itemblock.append(img, description);

    const content = `${header.outerHTML} ${itemblock.outerHTML} ${useTargetHelperGroup.outerHTML} ${useDefaultTargetCountGroup.outerHTML} ${rollIndividualGroup.outerHTML} ${fastForwardGroup.outerHTML} ${numTargetsOptions.outerHTML} `;

    await foundry.applications.api.DialogV2
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
        this.itemConfigItem = null;
        if (result === "cancel" || result == null) {
          this.requestRender("equipmentMiscTray");
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
        this.requestRender("equipmentMiscTray");
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
