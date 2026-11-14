/**
 * Distance/unit conversion shared by the tooltip range display and the pathfinder.
 *
 * Two separate unit systems meet here and they are easy to conflate:
 *
 *  - dnd5e activity ranges carry their own `units` key from `CONFIG.DND5E.movementUnits`
 *    (`ft`, `mi`, `m`, `km`) or one of the non-numeric `CONFIG.DND5E.rangeTypes`
 *    (`self`, `touch`, `spec`, `any`).
 *  - The scene grid carries a free-text `grid.units` label and a numeric `grid.distance`
 *    ("how many `grid.units` is one square worth"). Nothing validates that label, so it can be
 *    "ft", "ft.", "feet", "m", "meters", or something a world author invented.
 *
 * Everything the pathfinder does is in *scene* units, so item ranges have to be converted into
 * that system before they can be compared against `grid.distance`. Previously the code just
 * divided by a hardcoded 5, which was wrong on any scene that was not 5ft-per-square.
 */

/** Range units that carry no numeric distance. */
export const NON_NUMERIC_RANGES = new Set(['self', 'touch', 'spec', 'any'])

/**
 * Map the scene's free-text grid unit label onto a dnd5e movement unit key.
 * Returns null when the label is not recognisable, in which case callers should assume item
 * ranges are already expressed in scene units rather than guessing.
 */
export function sceneDistanceUnit() {
  const raw = canvas?.scene?.grid?.units
  if (!raw) return null
  const label = String(raw).trim().toLowerCase().replace(/\.$/, '')

  switch (label) {
    case 'ft':
    case 'foot':
    case 'feet':
      return 'ft'
    case 'm':
    case 'meter':
    case 'meters':
    case 'metre':
    case 'metres':
      return 'm'
    case 'mi':
    case 'mile':
    case 'miles':
      return 'mi'
    case 'km':
    case 'kilometer':
    case 'kilometers':
    case 'kilometre':
    case 'kilometres':
      return 'km'
    default:
      return null
  }
}

/**
 * Convert a dnd5e length into the scene's distance units.
 *
 * Falls back to returning the value untouched when either side of the conversion is unknown -
 * that matches the old behaviour for the common 5ft/square case and avoids inventing numbers
 * for worlds using custom unit labels.
 */
export function toSceneDistance(value, units) {
  if (!Number.isFinite(value)) return 0
  if (!units || NON_NUMERIC_RANGES.has(units)) return value

  const target = sceneDistanceUnit()
  if (!target || target === units) return value

  const convert = game.dnd5e?.utils?.convertLength
  if (!convert) return value

  try {
    return convert(value, units, target, { strict: false })
  } catch {
    return value
  }
}

/**
 * How many scene distance units one grid square is worth. Guards against a zero/absent
 * `grid.distance`, which would otherwise turn every squares-conversion into Infinity/NaN.
 */
export function gridDistance() {
  const distance = canvas?.grid?.distance
  return Number.isFinite(distance) && distance > 0 ? distance : 5
}

/**
 * Convert a distance in scene units into a whole number of grid squares, rounded up so that a
 * weapon is never reported as reaching less far than it does.
 */
export function distanceToSquares(distance) {
  return Math.ceil(distance / gridDistance())
}
