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
      },
      scaling: {
        scalingType: ["cantrip, whole, half"],
        scaleTargets: true,
        scaleDamage: true,
        scaleDamageType: "Dice, Attacks"
      },
      spell: {
        spellLevel: 0,
        castLevel: 0
      }
    };
  }
}
