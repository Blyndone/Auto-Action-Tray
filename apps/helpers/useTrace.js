// Records what the use workflow actually decided, so "it targeted/damaged wrong" can be answered
// from the branch that was taken rather than from the item's data. Read by the Item Doctor
// dialog (apps/dialogs/itemDoctor.js).
//
// Recording is always on but deliberately cheap: steps hold primitives and short strings that are
// already computed by the workflow, never clones of documents. The buffer is per-client and lives
// only for the session.

export const SEVERITY = {
  OK: 'ok',
  INFO: 'info',
  WARN: 'warn',
  FAIL: 'fail',
}

const SEVERITY_RANK = { ok: 0, info: 1, warn: 2, fail: 3 }

export function severityRank(severity) {
  return SEVERITY_RANK[severity] ?? 0
}

// The single record shape shared by the static linter and the workflow tracer, so both render
// through one template and roll up into one summary.
// `remedy` is the one thing the user can go and do about the finding. Kept separate from
// `explanation` so the dialog can collect every remedy into one list at the top without having to
// parse prose out of the explanations.
export function finding({
  id,
  severity = SEVERITY.INFO,
  title,
  explanation = '',
  remedy = '',
  evidence = null,
  source = '',
}) {
  return { id, severity, title, explanation, remedy, evidence, source }
}

export class UseTrace {
  static #buffer = []
  static #max = 10
  static #active = null
  static #armedItemId = null

  // Arms a dry run for one item: the next use of it runs the whole workflow for real (including
  // target selection) but stops short of Activity#use, capturing the arguments instead. Consumed
  // by the next press so it can never leave the tray permanently inert.
  static arm(itemId) {
    this.#armedItemId = itemId
  }

  static disarm() {
    this.#armedItemId = null
  }

  static get armedItemId() {
    return this.#armedItemId
  }

  static isArmed(itemId) {
    return this.#armedItemId != null && this.#armedItemId === itemId
  }

  // Takes the item id rather than the item so opening a trace costs nothing beyond one object
  // allocation — resolving the item is the workflow's job, and it reports back via identify().
  static begin(itemId, actor) {
    const dryRun = this.isArmed(itemId)
    if (dryRun) this.disarm()

    this.#active = {
      id: foundry.utils.randomID(),
      itemId: itemId ?? null,
      itemName: null,
      itemType: null,
      actorName: actor?.name ?? null,
      timestamp: Date.now(),
      dryRun,
      steps: [],
      payloads: [],
      aborted: null,
    }
    return this.#active
  }

  // Only strings are kept, so a trace can never hold a document alive past its scene.
  static identify(name, type) {
    const trace = this.#active
    if (!trace) return
    trace.itemName = name ?? trace.itemName
    trace.itemType = type ?? trace.itemType
  }

  // A no-op when nothing is being traced, so the instrumentation is safe to call from anywhere in
  // the workflow including paths reached outside a traced use.
  static step(key, label, values = {}, options = {}) {
    const trace = this.#active
    if (!trace) return
    trace.steps.push({
      key,
      label,
      severity: options.severity ?? SEVERITY.OK,
      note: options.note ?? '',
      // Reduced rather than stored by reference. Call sites pass primitives today, but the buffer
      // outlives the scene, so one stray document reference would keep an actor or token in
      // memory until reload. Cost is a walk over a handful of keys per step.
      values: this.#plain(values),
    })
  }

  static warn(key, label, values, note) {
    this.step(key, label, values, { severity: SEVERITY.WARN, note })
  }

  static fail(key, label, values, note) {
    this.step(key, label, values, { severity: SEVERITY.FAIL, note })
  }

  // The captured Activity#use arguments — the handoff point to dnd5e, and the thing worth
  // reading first when damage or consumption comes out wrong.
  static payload({
    activityId,
    activityName,
    usageConfig,
    dialogConfig,
    messageConfig,
    targetName,
  }) {
    const trace = this.#active
    if (!trace) return
    trace.payloads.push({
      activityId,
      activityName,
      targetName: targetName ?? null,
      usageConfig: this.#plain(usageConfig),
      dialogConfig: this.#plain(dialogConfig),
      messageConfig: this.#plain(messageConfig),
    })
  }

  static abort(reason, values = {}) {
    const trace = this.#active
    if (!trace) return
    trace.aborted = reason
    this.step('abort', reason, values, { severity: SEVERITY.WARN })
  }

  static end() {
    const trace = this.#active
    if (!trace) return null
    trace.durationMs = Date.now() - trace.timestamp
    this.#active = null
    this.#buffer.unshift(trace)
    if (this.#buffer.length > this.#max) this.#buffer.length = this.#max
    return trace
  }

  static get active() {
    return this.#active
  }

  static isDryRun() {
    return this.#active?.dryRun === true
  }

  static latestFor(itemId) {
    return this.#buffer.find((t) => t.itemId === itemId) ?? null
  }

  static all() {
    return [...this.#buffer]
  }

  static clear() {
    this.#buffer = []
    this.#active = null
  }

  // Config objects handed to dnd5e hold live documents and Sets; only their displayable shape is
  // kept so the buffer can't pin documents in memory or blow up when serialised for the report.
  static #plain(value, depth = 0) {
    if (value == null) return value
    if (depth > 4) return '…'
    const type = typeof value
    if (type === 'string' || type === 'number' || type === 'boolean') return value
    if (value instanceof Set) return [...value].map((v) => this.#plain(v, depth + 1))
    if (Array.isArray(value)) return value.map((v) => this.#plain(v, depth + 1))
    if (type === 'object') {
      // Documents and placeables get reduced to a label rather than walked.
      if (value.documentName || value.uuid) return value.name ?? value.uuid ?? value.documentName
      const out = {}
      for (const [k, v] of Object.entries(value)) out[k] = this.#plain(v, depth + 1)
      return out
    }
    return String(value)
  }
}
