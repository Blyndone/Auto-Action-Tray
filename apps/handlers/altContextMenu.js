/**
 * A ContextMenu that re-parents its menu into the tray root and positions it there by hand.
 *
 * The tray root carries a CSS scale (`--aat-scale`), so a menu left in its default parent is laid
 * out in unscaled page pixels and lands in the wrong place.
 */
export class AltContextMenu extends foundry.applications.ux.ContextMenu {
  constructor(element, selector, menuItems, options, parentSelector) {
    super(element, selector, menuItems, options)
    this.parentSelector = parentSelector
  }

  async _animate(open = true) {
    if (!open) {
      await super._animate(open)
      return
    }
    const menu = this.menu
    const newParent = document.getElementById(this.parentSelector)
    const scale = 1 / game.settings.get('auto-action-tray', 'scale')
    const menuEl = menu[0]

    const triggerRect = menuEl.parentElement.getBoundingClientRect()
    const parentRect = newParent.getBoundingClientRect()
    const menuRect = menuEl.getBoundingClientRect()

    let top = (triggerRect.top - parentRect.top) * scale
    let left = (triggerRect.left - parentRect.left + triggerRect.width + 5) * scale

    newParent.appendChild(menuEl)
    menuEl.style.position = 'absolute'
    menuEl.style.visibility = 'hidden'
    menuEl.style.top = '0px'
    menuEl.style.left = '0px'
    const measuredMenuRect = menuEl.getBoundingClientRect()
    const menuHeight = measuredMenuRect.height * scale
    const menuWidth = measuredMenuRect.width * scale
    menuEl.style.visibility = 'visible'

    const maxTop = parentRect.height * scale - menuHeight
    const maxLeft = parentRect.width * scale - menuWidth

    top = Math.min(top, Math.max(0, maxTop))
    left = Math.min(left, Math.max(0, maxLeft))

    menuEl.style.top = `${top}px`
    menuEl.style.left = `${left}px`
    menuEl.style.transformOrigin = 'top left'
    await super._animate(open)
  }
}
