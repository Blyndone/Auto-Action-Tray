export class SkillTray {
  constructor(options = {}) {
    this.id = "skill";
    this.actor;
    this.actorUuid = options.actorUuid;
    this.characterClass = null;
    this.inCombat = true;
    this.currentSkills = [];
    this.secondarySkills = [];
    this.skillAbbr = {
      acrobatics: {
        abbreviation: "acr",
        icon: '<i class="fa-solid fa-wreath-laurel"></i>'
      },
      animalHandling: {
        abbreviation: "ani",
        icon: '<i class="fa-solid fa-squirrel"></i>'
      },
      arcana: {
        abbreviation: "arc",
        icon: '<i class="fa-solid fa-book-sparkles"></i>'
      },
      athletics: {
        abbreviation: "ath",
        icon: '<i class="fa-solid fa-person-running-fast"></i>'
      },
      deception: {
        abbreviation: "dec",
        icon: '<i class="fa-solid fa-eye-evil"></i>'
      },
      history: {
        abbreviation: "his",
        icon: '<i class="fa-solid fa-book-atlas"></i>'
      },
      insight: {
        abbreviation: "ins",
        icon: '<i class="fa-solid fa-thought-bubble"></i>'
      },
      intimidation: {
        abbreviation: "itm",
        icon: '<i class="fa-solid fa-scarecrow"></i>'
      },
      investigation: {
        abbreviation: "inv",
        icon: '<i class="fa-solid fa-magnifying-glass"></i>'
      },
      medicine: {
        abbreviation: "med",
        icon: '<i class="fa-solid fa-book-atlas"></i>'
      },
      nature: { abbreviation: "nat", icon: '<i class="fa-solid fa-leaf"></i>' },
      perception: {
        abbreviation: "prc",
        icon: '<i class="fa-solid fa-eye"></i>'
      },
      performance: {
        abbreviation: "prf",
        icon: '<i class="fa-solid fa-music"></i>'
      },
      persuasion: {
        abbreviation: "per",
        icon: '<i class="fa-solid fa-handshake"></i>'
      },
      religion: {
        abbreviation: "rel",
        icon: '<i class="fa-solid fa-book-journal-whills"></i>'
      },
      sleightOfHand: {
        abbreviation: "slt",
        icon: '<i class="fa-solid fa-bag-seedling"></i>'
      },
      stealth: {
        abbreviation: "ste",
        icon: '<i class="fa-solid fa-hood-cloak"></i>'
      },
      survival: {
        abbreviation: "sur",
        icon: '<i class="fa-solid fa-campfire"></i>'
      }
    };

    this.savesNames = {
      str: "Strength",
      dex: "Dexterity",
      con: "Constitution",
      int: "Intelligence",
      wis: "Wisdom",
      cha: "Charisma"
    };
    this.saveIcons = {
      str: '<i class="fa-solid fa-dumbbell"></i>',
      dex: '<i class="fa-solid fa-bullseye"></i>',
      con: '<i class="fa-solid fa-heart"></i>',
      int: '<i class="fa-solid fa-brain"></i>',
      wis: '<i class="fa-solid fa-eye"></i>',
      cha: '<i class="fa-solid fa-handshake"></i>'
    };

    this.generateTray();
  }

  //PC
  //out of combat
  //in combat
  //NPC

  // {
  // name: "Name",
  // abbreviation: "abr",
  // type: "skill||save",
  // ability: "str||dex||con||int||wis||cha",
  // modifier: "int",
  // proficient: "0,1,2",
  //  }

  generateTray() {
    let actor = fromUuidSync(this.actorUuid);

    let { skills, secondarySkills } = this.getSkillSets(
      actor,
      this.inCombat,
      this.characterClass
    );
    this.currentSkills = skills;
    this.secondarySkills = secondarySkills;
  }

  static generateCustomTrays(actor) {
    return new SkillTray({ actorUuid: actor.uuid });
  }

  generateSkillData(name = null, abbreviation = null, actor = null) {
    let skillAbbr = this.skillAbbr;
    if (!abbreviation) abbreviation = skillAbbr[name].abbrrviation;
    if (!name)
      name = Object.keys(skillAbbr).find(
        key => skillAbbr[key].abbreviation === abbreviation
      );
    if (!actor) {
      actor = fromUuidSync(this.actorUuid);
    }
    let skills = actor.system.skills[abbreviation];

    let skill = {
      name: name,
      abbreviation: abbreviation,
      type: "skill",
      ability: skills.ability,
      modifier: skills.total,
      proficient: skills.proficient,
      icon: skillAbbr[name].icon
    };
    return skill;
  }

  generateSavingThrowData(abbreviation, actor = null) {
    if (!actor) {
      actor = fromUuidSync(this.actorUuid);
    }
    let saves = actor.system.abilities[`${abbreviation}`];
    let save = {
      name: this.savesNames[abbreviation],
      abbreviation: abbreviation,
      type: "save",
      ability: abbreviation,
      modifier: saves.value,
      proficient: saves.proficient,
      icon: this.saveIcons[abbreviation]
    };
    return save;
  }

  getSkillSets(actor, incombat = false, characterClass = null) {
    if (!actor) return;
    if (!characterClass) {
      //get class
      //set class skills
    }
    let defaultSkills = ["ath", "dec", "inv", "prc", "per", "ste"];
    let defaultClassSkills = ["acr", "his", "med", "nat", "slt", "sur"];
    const saves = ["str", "dex", "con", "int", "wis", "cha"];

    let classSkills = defaultClassSkills;

    let skills = [];
    let secondarySkills = [];

    switch (true) {
      case !incombat && !characterClass:
        //default skills default class skills

        defaultSkills.forEach(skill =>
          skills.push(this.generateSkillData(null, skill, actor))
        );

        defaultClassSkills.forEach(skill =>
          skills.push(this.generateSkillData(null, skill, actor))
        );
        break;

      case !incombat && characterClass:
        //default skills specific class skills

        defaultSkills.forEach(skill =>
          skills.push(this.generateSkillData(null, skill, actor))
        );

        classSkills.forEach(skill =>
          skills.push(this.generateSkillData(null, skill, actor))
        );
        break;

      case incombat && !characterClass:
        defaultSkills.forEach(skill =>
          skills.push(this.generateSkillData(null, skill, actor))
        );

        saves.forEach(save =>
          skills.push(this.generateSavingThrowData(save, actor))
        );
        break;

      case incombat && characterClass:
        //default Skills Saves

        classSkills.forEach(skill =>
          skills.push(this.generateSkillData(null, skill, actor))
        );

        saves.forEach(save =>
          skills.push(this.generateSavingThrowData(save, actor))
        );
        break;
    }

    let availableSkills = this.getSecondarySkills(skills);

    availableSkills.forEach(skill =>
      secondarySkills.push(this.generateSkillData(null, skill, actor))
    );

    return { skills, secondarySkills };
  }

  getSecondarySkills(skills) {
    return Object.keys(this.skillAbbr)
      .filter(
        skill =>
          !skills
            .map(e => e.abbreviation)
            .includes(this.skillAbbr[skill].abbreviation)
      )
      .map(skill => this.skillAbbr[skill].abbreviation);
  }

  toggleSkillTrayPage() {
    let tmp = this.currentSkills;
    this.currentSkills = this.secondarySkills;
    this.secondarySkills = tmp;
  }
}
