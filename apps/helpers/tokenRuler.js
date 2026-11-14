/**
 * Token ruler subclass that lets the quick-action pathfinder tint its movement preview.
 *
 * The previous approach assigned `ruler.color = Color.fromString('#FF00FF')` directly on the
 * TokenRuler instance. That silently did nothing: TokenRuler has no `color` property, and both
 * the waypoint and segment colours are produced by `_getWaypointStyle`/`_getSegmentStyle`, which
 * return the owning user's colour. Overriding those two hooks is the supported way in.
 *
 * The class is registered as `CONFIG.Token.rulerClass` at init, so it also renders every ordinary
 * drag-measure. It must therefore behave exactly like core unless the pathfinder has explicitly
 * flagged the token it belongs to.
 */

const MODULE_NAME = 'auto-action-tray'

/** Tokens whose ruler is currently being driven by the quick-action pathfinder. */
const previewTokens = new WeakSet()

/** Mark a token's ruler as a quick-action preview so it renders in the configured colour. */
export function markRulerPreview(token) {
  if (token) previewTokens.add(token)
}

/** Return a token's ruler to normal user-coloured rendering. */
export function clearRulerPreview(token) {
  if (token) previewTokens.delete(token)
}

/**
 * Read the configured preview colour. Falls back to magenta (the previously hardcoded value) if
 * the setting has not been registered yet, which can happen if a ruler draws during init.
 */
function previewColor() {
  try {
    return foundry.utils.Color.from(game.settings.get(MODULE_NAME, 'quickActionPathColor'))
  } catch {
    return foundry.utils.Color.from('#ff00ff')
  }
}

/**
 * Build the subclass lazily. `CONFIG.Token.rulerClass` is not populated until Foundry has set up
 * CONFIG, so this cannot be a top-level `class X extends CONFIG.Token.rulerClass`.
 */
export function createAATTokenRuler() {
  const Base = CONFIG.Token.rulerClass

  return class AATTokenRuler extends Base {
    /** @override */
    _getWaypointStyle(waypoint) {
      const style = super._getWaypointStyle(waypoint)
      // Radius 0 means core decided not to draw a marker here at all - respect that.
      if (!style.radius || !previewTokens.has(this.token)) return style
      return { ...style, color: previewColor() }
    }

    /** @override */
    _getSegmentStyle(waypoint) {
      const style = super._getSegmentStyle(waypoint)
      if (!style.width || !previewTokens.has(this.token)) return style
      return { ...style, color: previewColor() }
    }
  }
}
