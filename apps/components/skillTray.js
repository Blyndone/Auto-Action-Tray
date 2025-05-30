export class SkillTray {
  constructor(options = {}) {
    this.id = 'skill'
    this.actor
    this.actorUuid = options.actorUuid
    this.characterClass = null
    this.inCombat = true
    this.currentSkills = []
    this.secondarySkills = []
    this.skillAbbr = {
      acrobatics: {
        abbreviation: 'acr',
        icon: '<i class="fa-solid fa-wreath-laurel"></i>',
      },
      animalHandling: {
        abbreviation: 'ani',
        icon: '<i class="fa-solid fa-squirrel"></i>',
      },
      arcana: {
        abbreviation: 'arc',
        icon: '<i class="fa-solid fa-book-sparkles"></i>',
      },
      athletics: {
        abbreviation: 'ath',
        icon: '<i class="fa-solid fa-person-running-fast"></i>',
      },
      deception: {
        abbreviation: 'dec',
        icon: '<i class="fa-solid fa-eye-evil"></i>',
      },
      history: {
        abbreviation: 'his',
        icon: '<i class="fa-solid fa-book-atlas"></i>',
      },
      insight: {
        abbreviation: 'ins',
        icon: '<i class="fa-solid fa-thought-bubble"></i>',
      },
      intimidation: {
        abbreviation: 'itm',
        icon: '<i class="fa-solid fa-scarecrow"></i>',
      },
      investigation: {
        abbreviation: 'inv',
        icon: '<i class="fa-solid fa-magnifying-glass"></i>',
      },
      medicine: {
        abbreviation: 'med',
        icon: '<i class="fa-solid fa-book-atlas"></i>',
      },
      nature: { abbreviation: 'nat', icon: '<i class="fa-solid fa-leaf"></i>' },
      perception: {
        abbreviation: 'prc',
        icon: '<i class="fa-solid fa-eye"></i>',
      },
      performance: {
        abbreviation: 'prf',
        icon: '<i class="fa-solid fa-music"></i>',
      },
      persuasion: {
        abbreviation: 'per',
        icon: '<i class="fa-solid fa-comments"></i>',
      },
      religion: {
        abbreviation: 'rel',
        icon: '<i class="fa-solid fa-book-journal-whills"></i>',
      },
      sleightOfHand: {
        abbreviation: 'slt',
        icon: '<i class="fa-solid fa-sack-dollar"></i>',
      },
      stealth: {
        abbreviation: 'ste',
        icon: '<i class="fa-solid fa-hood-cloak"></i>',
      },
      survival: {
        abbreviation: 'sur',
        icon: '<i class="fa-solid fa-campfire"></i>',
      },
    }
    this.classSkills = {
      barbarian: ['ani', 'ath', 'ins', 'itm', 'prc', 'sur'],
      bard: ['acr', 'dec', 'ins', 'per', 'prc', 'prf'],
      cleric: ['his', 'ins', 'med', 'per', 'prc', 'rel'],
      druid: ['ani', 'ins', 'med', 'nat', 'prc', 'sur'],
      fighter: ['acr', 'ath', 'inv', 'itm', 'prc', 'sur'],
      monk: ['acr', 'ath', 'ins', 'prc', 'rel', 'ste'],
      paladin: ['ath', 'ins', 'itm', 'med', 'per', 'rel'],
      ranger: ['ani', 'inv', 'nat', 'prc', 'ste', 'sur'],
      rogue: ['acr', 'dec', 'inv', 'prc', 'slt', 'ste'],
      sorcerer: ['arc', 'dec', 'ins', 'per', 'prc', 'rel'],
      warlock: ['arc', 'dec', 'ins', 'itm', 'per', 'rel'],
      wizard: ['arc', 'his', 'inv', 'med', 'prc', 'rel'],
    }
    this.savesNames = {
      str: 'Strength Save',
      dex: 'Dexterity Save',
      con: 'Constitution Save',
      int: 'Intelligence Save',
      wis: 'Wisdom Save',
      cha: 'Charisma Save',
    }
    this.saveIcons = {
      str: '<i class="fa-solid fa-dumbbell"></i>',
      dex: '<i class="fa-solid fa-bullseye"></i>',
      con: '<i class="fa-solid fa-heart"></i>',
      int: '<i class="fa-solid fa-brain"></i>',
      wis: '<i class="fa-solid fa-eye"></i>',
      cha: '<i class="fa-solid fa-handshake"></i>',
    }

    this.generateTray()
  }

  generateTray() {
    let actor = fromUuidSync(this.actorUuid)
    let highestLevelClass
    if (actor.type == 'character') {
      highestLevelClass = Object.keys(actor.classes).reduce(
        (highest, e) => {
          const currentClass = actor.classes[e]
          if (currentClass.system.levels > highest.level) {
            return {
              name: currentClass.name,
              level: currentClass.system.levels,
            }
          }
          return highest
        },
        { level: -Infinity },
      )
      this.characterClass = highestLevelClass?.name?.toLowerCase()
    } else {
      this.characterClass = null
    }
    let { skills, secondarySkills } = this.getSkillSets(actor, this.inCombat, this.characterClass)
    this.currentSkills = skills
    this.secondarySkills = secondarySkills
  }

  static generateCustomTrays(actor) {
    return new SkillTray({ actorUuid: actor.uuid })
  }

  generateSkillData(name = null, abbreviation = null, actor = null) {
    let skillAbbr = this.skillAbbr
    if (!abbreviation) abbreviation = skillAbbr[name].abbrrviation
    if (!name)
      name = Object.keys(skillAbbr).find((key) => skillAbbr[key].abbreviation === abbreviation)
    if (!actor) {
      actor = fromUuidSync(this.actorUuid)
    }
    let skills = actor.system.skills[abbreviation]

    let skill = {
      name: name,
      abbreviation: abbreviation,
      type: 'skill',
      ability: skills.ability,
      modifier: skills.total,
      proficient: skills.proficient,
      icon: skillAbbr[name].icon,
      bonus: skills.total >= 0 ? `+${skills.total}` : skills.total,
    }
    return skill
  }

  generateSavingThrowData(abbreviation, actor = null) {
    if (!actor) {
      actor = fromUuidSync(this.actorUuid)
    }
    let saves = actor.system.abilities[`${abbreviation}`]

    let save = {
      name: this.savesNames[abbreviation],
      abbreviation: abbreviation,
      type: 'save',
      ability: abbreviation,
      modifier: saves.value,
      proficient: saves.proficient,
      icon: this.saveIcons[abbreviation],
      bonus: saves.save.value >= 0 ? `+${saves.save.value}` : saves.save.value,
    }
    return save
  }

  getSkillSets(actor, incombat = false, characterClass = null) {
    if (!actor) return
    let classSkills
    if (characterClass) {
      classSkills = this.classSkills[characterClass]
    }
    let defaultSkills = ['ath', 'dec', 'inv', 'prc', 'per', 'ste']
    let defaultClassSkills = ['acr', 'his', 'med', 'nat', 'slt', 'sur']
    const saves = ['str', 'dex', 'con', 'int', 'wis', 'cha']

    let skills = []
    let secondarySkills = []
    if (
      classSkills?.length > 0 &&
      (actor.getFlag('auto-action-tray', 'config')?.classSkills ?? true)
    ) {
      classSkills.forEach((skill) => skills.push(this.generateSkillData(null, skill, actor)))
    } else {
      defaultSkills.forEach((skill) => skills.push(this.generateSkillData(null, skill, actor)))
    }

    saves.forEach((save) => skills.push(this.generateSavingThrowData(save, actor)))

    let availableSkills = this.getSecondarySkills(skills)

    availableSkills.forEach((skill) =>
      secondarySkills.push(this.generateSkillData(null, skill, actor)),
    )

    return { skills, secondarySkills }
  }

  getSecondarySkills(skills) {
    return Object.keys(this.skillAbbr)
      .filter(
        (skill) => !skills.map((e) => e.abbreviation).includes(this.skillAbbr[skill].abbreviation),
      )
      .map((skill) => this.skillAbbr[skill].abbreviation)
  }

  toggleSkillTrayPage() {
    let tmp = this.currentSkills
    this.currentSkills = this.secondarySkills
    this.secondarySkills = tmp
  }
}
