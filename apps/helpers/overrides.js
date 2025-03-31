import { count } from "console";

export class Overrides {
  constructor() {
    let template = {
      name: "Item Name",
      damageLabel: {
        damageMin: 0,
        damageMax: 0,
        damageLabel: "Damage" || "Healing"
      },
      diceLable: {
        diceMin: 0,
        diceMax: 0,
        diceLabel: "Dice"
      },
      target: {
        count: 1
      }
    };
  }
}
