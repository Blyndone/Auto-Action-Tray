import { AutoActionTray } from '../apps/autoActionTray.js'
import { ConditionTray } from '../apps/components/conditionsTray.js'
const AUTOACTIONTRAY_MODULE_NAME = 'auto-action-tray'
let hotbar
let socket
export async function preloadHandlebarsTemplates() {
  const partials = [
    'modules/auto-action-tray/templates/parts/equip-tray.hbs',
    'modules/auto-action-tray/templates/parts/static-tray.hbs',
    'modules/auto-action-tray/templates/parts/turn-tray.hbs',
    'modules/auto-action-tray/templates/parts/custom-tray.hbs',
    'modules/auto-action-tray/templates/parts/item.hbs',
    'modules/auto-action-tray/templates/parts/item-spell.hbs',
    'modules/auto-action-tray/templates/parts/item-spell-pact.hbs',
    'modules/auto-action-tray/templates/parts/full-tray.hbs',
    'modules/auto-action-tray/templates/parts/full-tray-dragable.hbs',
    'modules/auto-action-tray/templates/parts/item-tooltip.hbs',
    'modules/auto-action-tray/templates/parts/effect-tooltip.hbs',
    'modules/auto-action-tray/templates/parts/character-hp.hbs',
    'modules/auto-action-tray/templates/parts/skill-tray.hbs',
    'modules/auto-action-tray/templates/parts/utility-tray.hbs',
    'modules/auto-action-tray/templates/parts/tray-controls.hbs',
    'modules/auto-action-tray/templates/parts/character-tray.hbs',
    'modules/auto-action-tray/templates/parts/activity-tray.hbs',
    'modules/auto-action-tray/templates/parts/target-tray.hbs',
    'modules/auto-action-tray/templates/parts/condition-tray.hbs',
    
  ]
  const paths = {}
  for (const path of partials) {
    paths[path.replace('.hbs', '.html')] = path
    paths[`AAT.${path.split('/').pop().replace('.hbs', '')}`] = path
  }

  return loadTemplates(paths)
}

;(() => {})()

Hooks.once('init', async function () {
  libWrapper.register(
    AUTOACTIONTRAY_MODULE_NAME,
    'Token.prototype._onClickLeft',
    function (wrapped, ...args) {
      if (hotbar) {
        AutoActionTray._onTokenSelect(hotbar, wrapped, ...args)
      } else return wrapped(...args)
    },
    'MIXED',
  )

  libWrapper.register(
    AUTOACTIONTRAY_MODULE_NAME,
    'Token.prototype._onClickLeft2',
    function (wrapped, ...args) {
      if (hotbar) {
        AutoActionTray._onTokenSelect2(hotbar, wrapped, ...args)
      } else return wrapped(...args)
    },
    'MIXED',
  )

  libWrapper.register(
    AUTOACTIONTRAY_MODULE_NAME,
    'Token.prototype._canControl',
    function (wrapped, ...args) {
      if (hotbar) {
        return AutoActionTray._onTokenSelect(hotbar, wrapped, ...args)
      } else return wrapped(...args)
    },
    'MIXED',
  )
  libWrapper.register(
    AUTOACTIONTRAY_MODULE_NAME,
    'Token.prototype._onClickRight',
    function (wrapped, ...args) {
      if (hotbar) {
        AutoActionTray._onTokenCancel(hotbar, wrapped, ...args)
      } else return wrapped(...args)
    },
    'MIXED',
  )
  libWrapper.register(
    AUTOACTIONTRAY_MODULE_NAME,
    'TokenLayer.prototype._onClickRight',
    function (wrapped, ...args) {
      if (hotbar) {
        AutoActionTray._onTokenCancel(hotbar, wrapped, ...args)
      } else return wrapped(...args)
    },
    'MIXED',
  )

  preloadHandlebarsTemplates()
})

Hooks.once('socketlib.ready', () => {
  socket = socketlib.registerModule('auto-action-tray')
})

Hooks.once('ready', async function () {
  if (!game.modules.get('lib-wrapper')?.active && game.user.isGM)
    ui.notifications.error(
      "Auto Action Tray requires the 'libWrapper' module. Please install and activate it.",
    )

  if (!game.modules.get('socketlib')?.active && game.user.isGM)
    ui.notifications.error(
      "Auto Action Tray requires the 'socketlib' module. Please install and activate it.",
    )

  game.settings.register('auto-action-tray', 'enable', {
    name: 'Enabled',
    hint: 'Enable or Disable the Hotbar',
    scope: 'client',
    config: true,

    type: Boolean,
    default: false,

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'autoTheme', {
    name: 'Auto Theme',
    hint: 'Will automatically set the theme based on the selected actors class',
    scope: 'client',
    config: true,

    type: Boolean,
    default: true,

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'theme', {
    name: 'Color Theme',
    hint: 'Default Theme if Auto Theme is disabled or not available',
    config: true,
    scope: 'client',
    type: new foundry.data.fields.StringField({
      choices: {
        'theme-classic': 'Mind Flayer',
        'theme-arcane': 'Arcane',
        'theme-sanguine': 'Sanguine',
        'theme-ocean': 'Ocean',
        'theme-ember': 'Ember',
        'theme-frost': 'Frost',
        'theme-subterfuge': 'Subterfuge',
        'theme-titan': 'Titan',
        'theme-vesper': 'Vesper',
        'theme-earth': 'Earth',
        'theme-slate': 'Slate',
        'theme-artificer': 'Artificer',
        'theme-barbarian': 'Barbarian',
        'theme-bard': 'Bard',
        'theme-cleric': 'Cleric',
        'theme-druid': 'Druid',
        'theme-fighter': 'Fighter',
        'theme-monk': 'Monk',
        'theme-paladin': 'Paladin',
        'theme-ranger': 'Ranger',
        'theme-rogue': 'Rogue',
        'theme-sorcerer': 'Sorcerer',
        'theme-warlock': 'Warlock',
        'theme-wizard': 'Wizard',
      },
    }),
    default: 'theme-classic',
  })

    game.settings.register('auto-action-tray', 'tempTheme', {
    name: 'tempTheme',
    scope: 'client',
    default: 'theme-classic',
  })

  game.settings.set("auto-action-tray", "tempTheme", game.settings.get("auto-action-tray", "theme"))

  game.settings.register('auto-action-tray', 'rowCount', {
    name: 'Number of Rows',
    hint: 'Select Number of Rows',
    scope: 'client',
    config: true,
    type: Number,
    default: 3,

    choices: {
      2: '2 Rows',
      3: '3 Rows',
      4: '4 Rows',
    },

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'columnCount', {
    name: 'Number of Columns',
    hint: 'Select Number of Columns',
    scope: 'client',
    config: true,
    type: Number,
    default: 15,

    choices: {
      10: '10 Columns',
      15: '15 Columns',
      20: '20 Columns',
    },

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'scale', {
    name: 'Scale',
    hint: 'Set the Scale of the Hotbar',
    scope: 'client',
    config: true,

    type: Number,
    default: .6,

    range: {
      min: .2,
      step: .05,
      max: 1.5,
    },

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'enableRangeBoundary', {
    name: 'Enable Range Boundary',
    hint: 'Enable Range Boundary',
    scope: 'client',
    config: true,

    type: Boolean,
    default: true,

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'recieveTargetLines', {
    name: 'Recieve Target Lines',
    hint: 'Recieve Target Lines from other players',
    scope: 'client',
    config: true,

    type: Boolean,
    default: true,

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'sendTargetLines', {
    name: 'Send Target Lines',
    hint: 'Send Target Lines from other players',
    scope: 'client',
    config: true,

    type: Boolean,
    default: true,

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'muliItemUseDelay', {
    name: 'Multi Item Use Delay',
    hint: 'Delay in miliseconds between using multiple items.',
    scope: 'client',
    config: true,

    type: Number,
    default: 1000,

    range: {
      min: 0,
      step: 100,
      max: 3000,
    },

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'targetLinePollRate', {
    name: 'Target Line Poll Rate',
    hint: 'Number of Miliseconds between sending Target Lines to other connected users.  Lower values may affect performance.',
    scope: 'world',
    config: true,

    type: Number,
    default: 50,

    range: {
      min: 10,
      step: 10,
      max: 1000,
    },

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'customConditionIcons', {
    name: 'Custom Condition Icons',
    hint: 'Use Custom Condition Icons',
    scope: 'client',
    config: true,

    type: Boolean,
    default: true,

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'promptConcentrationOverwrite', {
    name: 'Prompt Concentration Overwrite',
    hint: 'Prompt to overwrite Concentration when using a new spell',
    scope: 'client',
    config: true,

    type: Boolean,
    default: true,

    requiresReload: true,
  })

  game.settings.register('auto-action-tray', 'saveNpcData', {
    name: 'Save Npc Data',
    hint: 'Save Confioguration for Npc Tokens',
    scope: 'world',
    config: true,

    type: Boolean,
    default: true,

    requiresReload: true,
  })

  if (game.settings.get('auto-action-tray', 'customConditionIcons')) {
    ConditionTray.setCustomIcons()
  }

  if (game.settings.get('auto-action-tray', 'enable')) {
    hotbar = new AutoActionTray({
      id: 'auto-action-tray',
      socket: socket,
    })
    hotbar.render(true)
  }
})
