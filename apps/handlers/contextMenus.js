/**
 * Context-menu wiring for the tray. ApplicationV2 calls `_attachFrameListeners` only on the first
 * render, so every menu built here is constructed once for the life of the application.
 */
import { Actions } from '../helpers/actions.js'
import { EffectTray } from '../components/effectTray.js'
import { ItemConfig } from '../dialogs/itemConfig.js'
import { ItemDoctor } from '../dialogs/itemDoctor.js'
import { AltContextMenu } from './altContextMenu.js'

/**
 * Resolve the AATItem a context-menu entry was opened on. Returns null for a stale `data-item-id`
 * (an item deleted while its menu was open) so callers can bail instead of throwing.
 */
function abilityFromMenu(app, li) {
  const itemId = li?.dataset?.itemId
  if (!itemId) return null
  return app.getActorAbilities(app.actor.uuid).find((e) => e?.id == itemId) ?? null
}

/** The AATItem's wrapped Item5e document, or null if either link is missing. */
function itemFromMenu(app, li) {
  return abilityFromMenu(app, li)?.item ?? null
}

function buildItemMenu(app) {
  return [
    {
      name: 'DND5E.ItemView',
      icon: '<i class="fas fa-eye"></i>',
      callback: (li) => {
        app._onAction(li[0], 'view')
      },
    },
    {
      name: 'Configure Item',
      icon: "<i class='fas fa-cog fa-fw'></i>",
      callback: (li) => {
        const item = itemFromMenu(app, li[0])
        if (!item) return
        ItemConfig.itemConfig.bind(app)(item)
      },
    },
    {
      name: 'Display in Chat',
      icon: "<i class='fas fa-comment-dots fa-fw'></i>",
      callback: (li) => {
        const item = itemFromMenu(app, li[0])
        if (!item) return
        item.displayCard()
      },
    },
    {
      name: 'Toggle Favorite',
      icon: "<i class='fas fa-star fa-fw'></i>",
      callback: (li) => {
        const item = itemFromMenu(app, li[0])
        if (!item) return
        let itemId = item.getRelativeUUID(app.actor)
        let type = 'item'
        if (li[0].dataset.activityId) {
          itemId += `.Activity.${li[0].dataset.activityId}`
          type = 'activity'
        }
        if (app.actor.system.hasFavorite(itemId)) {
          app.actor.system.removeFavorite(itemId)
        } else {
          app.actor.system.addFavorite({ type: type, id: itemId })
        }
      },
    },
    {
      name: 'Troubleshoot Item',
      icon: "<i class='fas fa-stethoscope fa-fw'></i>",
      callback: (li) => {
        // ItemDoctor takes the AATItem wrapper, not the underlying Item5e.
        const ability = abilityFromMenu(app, li[0])
        if (!ability) return
        ItemDoctor.open.bind(app)(ability)
      },
    },
    {
      name: 'Remove',
      icon: "<i class='fas fa-trash fa-fw'></i>",
      callback: (li) => app._onAction(li[0], 'remove'),
    },
  ]
}

function buildCharacterMenu(app) {
  return [
    {
      name: 'View Sheet',
      icon: '<i class="fas fa-eye"></i>',
      callback: () => {
        app.actor.sheet.render(true)
      },
    },
    {
      name: 'Macro Directory',
      icon: '<i class="fas fa-folder-open"></i>',
      callback: () => {
        game.macros.directory.activate()
      },
    },
    {
      name: 'Reset Data',
      icon: '<i class="fa-solid fa-delete-right"></i>',
      callback: () => {
        app.deleteData(app.actor)
      },
    },
    {
      name: 'Reset Tray Data',
      icon: '<i class="fa-solid fa-delete-right"></i>',
      callback: () => {
        app.deleteTrayData(app.actor)
      },
    },
  ]
}

/**
 * Build every context menu the tray uses. Several carry no menu items and exist purely for their
 * `onOpen` side effect - that is how a right-click is captured without showing a menu.
 */
export function attachContextMenus(app) {
  const { ContextMenu } = foundry.applications.ux

  new ContextMenu(app.element, '.character-image', buildCharacterMenu(app), {
    jQuery: true,
    _expandUp: true,
  })

  new AltContextMenu(
    app.element,
    '.ability-button',
    buildItemMenu(app),
    { jQuery: true },
    'auto-action-tray',
  )

  new ContextMenu(app.element, '.effect-tray-icon', [], {
    onOpen: EffectTray.removeEffect.bind(app),
    jQuery: true,
  })

  new ContextMenu(app.element, '.end-turn-btn-dice', [], {
    onOpen: Actions.changeDice.bind(app),
    jQuery: true,
  })

  if (app.quickActionHelperEnabled) {
    new ContextMenu(app.element, '.quick-slot-1', [], {
      onOpen: () => app.quickActionHelper.toggleSlot(1),
      jQuery: true,
    })
    new ContextMenu(app.element, '.quick-slot-2', [], {
      onOpen: () => app.quickActionHelper.toggleSlot(2),
      jQuery: true,
    })
  }
}
