/**
 * Opt-in timing instrumentation, gated behind the `debugPerf` client setting.
 *
 * This replaces the ad-hoc `performance.now()` pairs and `console.log` calls that were being
 * added to hot paths during profiling and then left in place. Everything here compiles down to
 * a single boolean read when the setting is off, so calls can stay in the code permanently.
 */

let enabled = null

/**
 * Read the setting once and cache it. Deliberately lazy: helpers get imported at module scope,
 * long before `init` has registered any settings.
 */
function isEnabled() {
  if (enabled === null) {
    try {
      enabled = game.settings.get('auto-action-tray', 'debugPerf') === true
    } catch {
      // Settings not registered yet (or the module is mid-teardown) - stay quiet.
      return false
    }
  }
  return enabled
}

/** Re-read the setting. Called from the setting's own onChange so a toggle takes effect live. */
export function refreshPerfTrace() {
  enabled = null
}

/**
 * Time a synchronous or async function and log the result.
 * Returns whatever `fn` returns, so it can wrap an existing call in place.
 */
export function mark(label, fn) {
  if (!isEnabled()) return fn()
  // Drained first so the counts reported below belong to this span alone, not to whatever ran
  // before it.
  drainCounts()
  const start = performance.now()
  const result = fn()
  const report = () => {
    const counts = drainCounts()
    const ms = (performance.now() - start).toFixed(1)
    console.log(`AAT | ${label}: ${ms}ms${counts ? ` (${counts})` : ''}`)
  }
  if (result instanceof Promise) {
    return result.then((value) => {
      report()
      return value
    })
  }
  report()
  return result
}

/**
 * Open-ended timer for spans that do not fit a single callback. Returns a function that logs
 * the elapsed time when called; it accepts an optional suffix for context gathered mid-span.
 */
export function time(label) {
  if (!isEnabled()) return () => {}
  const start = performance.now()
  return (suffix = '') => {
    const ms = (performance.now() - start).toFixed(1)
    console.log(`AAT | ${label}: ${ms}ms${suffix ? ` (${suffix})` : ''}`)
  }
}

const counters = new Map()

/**
 * Tally an event so a surrounding span can report how many times it happened. Used to count
 * AATItemTooltip constructions per render - the number the lazy-tooltip work turns on.
 */
export function count(bucket) {
  if (!isEnabled()) return
  counters.set(bucket, (counters.get(bucket) ?? 0) + 1)
}

/** Read and reset the tallies, formatted for appending to a span's log line. */
export function drainCounts() {
  if (!isEnabled() || counters.size === 0) return ''
  const parts = [...counters].map(([k, v]) => `${v} ${k}`)
  counters.clear()
  return parts.join(', ')
}

/** Log a diagnostic that is only interesting while profiling. */
export function note(message, ...args) {
  if (!isEnabled()) return
  console.log(`AAT | ${message}`, ...args)
}

/** Warn about a condition that should not happen but is recovered from silently in production. */
export function warnUnexpected(message, ...args) {
  if (!isEnabled()) return
  console.warn(`AAT | ${message}`, ...args)
}
