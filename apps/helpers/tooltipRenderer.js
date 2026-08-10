/**
 * Lazy item tooltips.
 *
 * Every item slot used to render the whole AAT.item-tooltip partial into its own data-tooltip
 * attribute, which meant building an AATItemTooltip for every slot on every render even though
 * at most one tooltip is ever visible. That is also what defeated the deferred tooltip accessors
 * on AATItem / AATActivity.
 *
 * Instead the template registers a thunk and emits a key. The tooltip is rendered the first time
 * the slot is actually hovered, cached on the node as data-tooltip-html, and Foundry's own
 * TooltipManager takes it from there.
 */

/** Keys registered during the current render: key -> () => tooltipObject */
const sources = new Map()
let nextKey = 0

/**
 * Drop thunks whose node is gone, keeping the map from growing for the life of the session.
 *
 * Deliberately not a plain clear() on every render: this application renders individual parts,
 * so a characterImage-only render leaves every centerTray node in place, and clearing would
 * strip the thunks out from under slots that are still on screen and not yet hovered.
 * Called from _onRender, once the DOM reflects the render that just happened.
 */
export function pruneTooltipSources() {
  if (sources.size === 0) return
  const live = new Set()
  document.querySelectorAll('[data-tooltip-key]').forEach((el) => live.add(el.dataset.tooltipKey))
  for (const key of sources.keys()) {
    if (!live.has(key)) sources.delete(key)
  }
}

/**
 * Register a tooltip thunk and return the key that identifies it. The thunk is NOT invoked here -
 * that is the entire point, since invoking it is what builds the tooltip.
 */
export function registerTooltipSource(resolve, options = {}) {
  const key = `t${nextKey++}`
  sources.set(key, { resolve, options })
  return key
}

/**
 * Reproduces the escaping round-trip the old data-tooltip path depended on.
 *
 * item-tooltip.hbs interpolates HTML-bearing fields with {{field}} (name carries <br> and a
 * span, damageLabel/diceLabel/rangeLabel/saveLabel/concentrationLabel carry <i> icons, and
 * description is enriched HTML), so Handlebars escapes them. That used to be undone by the
 * browser's *attribute parser* when the partial's output landed inside data-tooltip="...".
 * Rendering the partial straight to a string skips that parse, so without this the tooltip
 * shows literal `<i class="fa-solid fa-dice-d6">` text instead of icons.
 */
const decoderEl = document.createElement('textarea')
function decodeEntities(html) {
  decoderEl.innerHTML = html
  return decoderEl.value
}

/**
 * Render the tooltip partial for a resolved tooltip object.
 * @param {object} tooltip   An AATItemTooltip, or the plain object AATMacro uses.
 * @param {object} options   Captured at registration. `ritualTray` selects the ritual timing.
 */
export function renderItemTooltip(tooltip, options = {}) {
  const partial = Handlebars.partials['AAT.item-tooltip']
  if (typeof partial !== 'function' || !tooltip) return null

  // Spread so the lazy damageLabel / diceLabel accessors resolve now - at hover time that is
  // exactly what we want, unlike at render time.
  //
  // useRitualTime replaces the partial's old `@root.currentTray.category == 'ritual'` test. That
  // read the globally-current tray at hover time rather than the tray the item is in, so an
  // equip-tray weapon (no tray at all) could take the ritual branch and render an empty action
  // tag, since ritualActivationTimeLabel is only populated for actual rituals. Decided at
  // registration instead, from the item's own tray, and guarded on the label being non-empty.
  const context = {
    ...tooltip,
    useRitualTime: !!options.ritualTray && !!tooltip.ritualActivationTimeLabel,
  }

  return decodeEntities(
    partial(context, {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true,
    }),
  )
}

/**
 * Bind the single delegated hover listener. Registered on `document` in the capture phase
 * deliberately: TooltipManager listens on `document.body` (also capture), and capture runs
 * document before body, so the html is in place before Foundry ever reads the dataset - which
 * covers the sweep case where it activates a tooltip synchronously instead of after a delay.
 */
export function activateTooltipListener() {
  document.addEventListener(
    'pointerenter',
    (event) => {
      const el = event.target
      // Fires for every element entered anywhere in the app, so bail on the cheapest check.
      const key = el?.dataset?.tooltipKey
      if (!key || el.dataset.tooltipHtml) return

      const source = sources.get(key)
      // Missing thunk: the node outlived its render. Degrades to the name-only placeholder in
      // data-tooltip rather than showing nothing.
      if (!source) return

      let html
      try {
        html = renderItemTooltip(source.resolve(), source.options)
      } catch (err) {
        console.error('AAT | Failed to build tooltip - falling back to the item name.', err)
        return
      }
      if (!html) return

      // Cached on the node, so repeat hovers cost nothing and it dies with the next render.
      el.dataset.tooltipHtml = html

      // Safety net for the case where something activated the tooltip before this ran.
      if (game.tooltip?.element === el) game.tooltip.activate(el, { html })
    },
    true,
  )
}
