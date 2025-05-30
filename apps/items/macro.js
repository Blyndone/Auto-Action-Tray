import { ItemConfig } from "../dialogs/itemConfig.js";
import { AATActivity } from "./activity.js";
import { AATItemTooltip } from "./itemTooltip.js";

export class AATMacro {
  constructor(macro) {
    this.macro = macro;
    this.id = macro.id;
    this.img = macro.img;
    this.name = macro.name;
    this.type = macro.type;
    this.description = macro.command;
    this.tooltip = {
      name: macro.name,
      type: "macro",
      description: macro.command,
      concentrationLabel: "",
      activationTimeLabel: "Macro"
    };
  }
}
