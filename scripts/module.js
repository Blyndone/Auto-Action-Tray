import { AutoActionTray } from '../apps/autoActionTray.js'
// import { registerHooks } from "./hooks.js";
const AUTOACTIONTRAY_MODULE_NAME = 'auto-action-tray'
let hotbar
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
      AutoActionTray._onTokenSelect(hotbar, wrapped, ...args)
    },
    'MIXED',
  )
    libWrapper.register(
    AUTOACTIONTRAY_MODULE_NAME,
    'Token.prototype._canControl',
    function (wrapped, ...args) {
      return AutoActionTray._onTokenSelect(hotbar, wrapped, ...args)
    },
    'MIXED',
  )
  libWrapper.register(
    AUTOACTIONTRAY_MODULE_NAME,
    'Token.prototype._onClickRight',
    function (wrapped, ...args) {
      AutoActionTray._onTokenCancel(hotbar, wrapped, ...args)
    },
    'MIXED',
  )
  libWrapper.register(
    AUTOACTIONTRAY_MODULE_NAME,
    'TokenLayer.prototype._onClickRight',
    function (wrapped, ...args) {
      AutoActionTray._onTokenCancel(hotbar, wrapped, ...args)
    },
    'MIXED',
  )

  preloadHandlebarsTemplates()
})

Hooks.once('ready', async function () {
  console.log('-------Ready-----------')

  if (!game.modules.get('lib-wrapper')?.active && game.user.isGM)
    ui.notifications.error(
      "Auto Action Tray requires the 'libWrapper' module. Please install and activate it.",
    )

  game.settings.register('auto-action-tray', 'enable', {
    name: 'Enabled',
    hint: 'Enable or Disable the Hotbar',
    scope: 'client', // "world" = sync to db, "client" = local storage
    config: true, // false if you dont want it to show in module config

    type: Boolean,
    default: false,

    requiresReload: true, // true if you want to prompt the user to reload
    /** Creates a select dropdown */
  })

  game.settings.register('auto-action-tray', 'rowCount', {
    name: 'Number of Rows',
    hint: 'Select Number of Rows',
    scope: 'client', // "world" = sync to db, "client" = local storage
    config: true, // false if you dont want it to show in module config

    type: Number,
    default: 2,

    choices: {
      2: '2 Rows',
      3: '3 Rows',
      4: '4 Rows',
    },

    requiresReload: true, // true if you want to prompt the user to reload
    /** Creates a select dropdown */
  })

  game.settings.register('auto-action-tray', 'columnCount', {
    name: 'Number of Columns',
    hint: 'Select Number of Columns',
    scope: 'client', // "world" = sync to db, "client" = local storage
    config: true, // false if you dont want it to show in module config

    type: Number,
    default: 10,

    choices: {
      10: '10 Columns',
      15: '15 Columns',
      20: '20 Columns',
    },

    requiresReload: true, // true if you want to prompt the user to reload
    /** Creates a select dropdown */
  })

  game.settings.register('auto-action-tray', 'iconSize', {
    name: 'Icon Size',
    hint: 'Select Icon Size',
    scope: 'client', // "world" = sync to db, "client" = local storage
    config: true, // false if you dont want it to show in module config

    type: Number,
    default: 75,

    choices: {
      75: '75 px',
      60: '60 px',
      50: '50 px',
    },

    requiresReload: true, // true if you want to prompt the user to reload
    /** Creates a select dropdown */
  })

  if (game.settings.get('auto-action-tray', 'enable')) {
    hotbar = new AutoActionTray({
      id: 'auto-action-tray',
    })
    hotbar.render(true)
  }
})
