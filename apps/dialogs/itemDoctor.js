import { ItemLinter } from '../helpers/itemLinter.js'
import { UseTrace, SEVERITY, severityRank } from '../helpers/useTrace.js'

const { ApplicationV2 } = foundry.applications.api
const { api } = foundry.applications

const SEVERITY_META = {
  ok: { icon: 'fa-solid fa-circle-check', label: 'OK' },
  info: { icon: 'fa-solid fa-circle-info', label: 'Info' },
  warn: { icon: 'fa-solid fa-triangle-exclamation', label: 'Warning' },
  fail: { icon: 'fa-solid fa-circle-xmark', label: 'Problem' },
}

// Strips the markup the tooltip layer bakes into its labels so values read cleanly in a table and
// in the copied report.
function plain(value) {
  if (value == null) return ''
  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .trim()
}

function decorate(record) {
  return { ...record, meta: SEVERITY_META[record.severity] ?? SEVERITY_META.info }
}

// Renders a step's captured values as label/value pairs. Nulls are dropped rather than shown as
// "null", which would read as a finding rather than as "not applicable".
function valueRows(values) {
  return Object.entries(values ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([key, v]) => ({
      key: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      value: Array.isArray(v)
        ? v.join(', ')
        : typeof v === 'boolean'
          ? v
            ? 'yes'
            : 'no'
          : String(v),
    }))
}

class ItemDoctorApp extends api.HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options)
    this.hotbar = options.hotbar
    this.aatItem = options.item
  }

  static DEFAULT_OPTIONS = {
    classes: ['aat-item-doctor'],
    window: {
      icon: 'fa-solid fa-stethoscope',
      contentClasses: ['standard-form'],
      resizable: true,
    },
    position: { width: 680, height: 720 },
    actions: {
      armDryRun: ItemDoctorApp.onArmDryRun,
      refresh: ItemDoctorApp.onRefresh,
      copyReport: ItemDoctorApp.onCopyReport,
    },
  }

  static PARTS = {
    tabs: { template: 'templates/generic/tab-navigation.hbs' },
    findings: { template: 'modules/auto-action-tray/templates/dialogs/item-doctor-findings.hbs' },
    timeline: { template: 'modules/auto-action-tray/templates/dialogs/item-doctor-timeline.hbs' },
    payload: { template: 'modules/auto-action-tray/templates/dialogs/item-doctor-payload.hbs' },
    environment: {
      template: 'modules/auto-action-tray/templates/dialogs/item-doctor-environment.hbs',
    },
  }

  static TABS = {
    sheet: {
      tabs: [
        { id: 'findings', icon: 'fa-solid fa-clipboard-check', label: 'Findings' },
        { id: 'timeline', icon: 'fa-solid fa-list-ol', label: 'Timeline' },
        { id: 'payload', icon: 'fa-solid fa-right-from-bracket', label: 'Payload' },
        { id: 'environment', icon: 'fa-solid fa-globe', label: 'Environment' },
      ],
      initial: 'findings',
    },
  }

  get title() {
    return `Troubleshoot - ${this.aatItem?.name ?? 'Item'}`
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    const item = this.aatItem

    const findings = ItemLinter.run(item, this.hotbar)
    const trace = UseTrace.latestFor(item?.id)

    // Trace steps that flagged themselves become findings too, so the summary covers both halves.
    const traceFindings = (trace?.steps ?? [])
      .filter((s) => s.severity === SEVERITY.WARN || s.severity === SEVERITY.FAIL)
      .map((s) => ({
        id: `trace-${s.key}`,
        severity: s.severity,
        title: s.label,
        explanation: s.note,
        remedy: '',
        evidence: valueRows(s.values)
          .map((r) => `${r.key}: ${r.value}`)
          .join('\n'),
        source: 'last use',
      }))

    const all = [...traceFindings, ...findings].sort(
      (a, b) => severityRank(b.severity) - severityRank(a.severity),
    )

    context.item = {
      name: item?.name,
      img: item?.img,
      type: item?.type,
      id: item?.id,
    }
    context.findings = all.map(decorate)
    // The actionable half of the findings, most severe first, pulled to the top of the tab so the
    // fix is visible without reading every finding. Findings with nothing to do carry no remedy.
    context.recommendations = context.findings.filter((f) => f.remedy)
    context.summary = {
      fail: all.filter((f) => f.severity === SEVERITY.FAIL).length,
      warn: all.filter((f) => f.severity === SEVERITY.WARN).length,
      info: all.filter((f) => f.severity === SEVERITY.INFO).length,
    }
    context.hasProblems = context.summary.fail + context.summary.warn > 0

    context.armed = UseTrace.isArmed(item?.id)
    context.trace = trace
      ? {
          when: new Date(trace.timestamp).toLocaleTimeString(),
          dryRun: trace.dryRun,
          aborted: trace.aborted,
          durationMs: trace.durationMs,
          steps: trace.steps.map((s, i) => ({
            ...decorate(s),
            index: i + 1,
            rows: valueRows(s.values),
          })),
        }
      : null

    context.payloads = (trace?.payloads ?? []).map((p, i) => ({
      index: i + 1,
      activityName: p.activityName,
      activityId: p.activityId,
      targetName: p.targetName,
      json: JSON.stringify(
        {
          usageConfig: p.usageConfig,
          dialogConfig: p.dialogConfig,
          messageConfig: p.messageConfig,
        },
        null,
        2,
      ),
      notes: this.#payloadNotes(p),
    }))

    context.environment = this.#environment(item)
    context.tabs = context.tabs ?? {}

    return context
  }

  // Calls out the fields in the handoff that most often explain wrong output, so the JSON does not
  // have to be read cold.
  #payloadNotes(payload) {
    const notes = []
    const usage = payload.usageConfig ?? {}
    const dialog = payload.dialogConfig ?? {}

    if (dialog.configure === false) {
      notes.push(
        "dnd5e's own use dialog is suppressed, so anything normally chosen there — scaling, ammunition, consumption overrides — is skipped.",
      )
    }
    if (usage.spell?.slot == null) {
      notes.push('No spell slot was passed, so dnd5e applies no upcast scaling.')
    } else {
      notes.push(`Cast using ${usage.spell.slot}.`)
    }
    if (usage.consume?.spellSlot === false) {
      notes.push('No slot is spent for this roll.')
    }
    if (usage.advantage) notes.push('Rolled with advantage.')
    if (usage.disadvantage) notes.push('Rolled with disadvantage.')
    return notes
  }

  #environment(item) {
    const rows = []
    const push = (label, value) => rows.push({ label, value: value ?? '—' })

    push('Scene grid', `${canvas?.grid?.distance ?? '—'} ${canvas?.grid?.units ?? ''} per square`)
    push('Grid type', canvas?.grid?.isGridless ? 'Gridless' : (canvas?.grid?.type ?? '—'))

    const activity = item?.defaultActivity?.activity
    push('Item range units', activity?.range?.units ?? item?.item?.system?.range?.units)
    push(
      'Item range',
      activity?.range?.value ?? activity?.range?.reach ?? item?.item?.system?.range?.value,
    )
    push(
      'Resolved range (squares)',
      this.hotbar?.targetHelper?.getActivityRange(item, item?.defaultActivity),
    )

    push('Target helper enabled', this.hotbar?.trayOptions?.['enableTargetHelper'] ? 'yes' : 'no')
    push('Fast forward', this.hotbar?.trayOptions?.['fastForward'] ? 'yes' : 'no')
    push('Multi-use delay', `${game.settings.get('auto-action-tray', 'multiItemUseDelay')} ms`)

    const integrations = ['midi-qol', 'autoanimations', 'sequencer', 'times-up', 'dae']
      .filter((id) => game.modules.get(id)?.active)
      .join(', ')
    push('Active integrations', integrations || 'none')

    push('dnd5e version', game.system.version)
    push('Actor type', item?.actor?.type)

    return rows
  }

  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context)
    if (partId in (partContext.tabs ?? {})) partContext.tab = partContext.tabs[partId]
    return partContext
  }

  static onArmDryRun(event, target) {
    if (UseTrace.isArmed(this.aatItem?.id)) {
      UseTrace.disarm()
      ui.notifications.info('Dry run cancelled.')
    } else {
      UseTrace.arm(this.aatItem.id)
      ui.notifications.info(
        `Dry run armed. Use "${this.aatItem.name}" once — targeting will run normally but nothing will be rolled.`,
      )
    }
    this.render()
  }

  static onRefresh(event, target) {
    this.render()
  }

  static async onCopyReport(event, target) {
    const context = await this._prepareContext({})
    const lines = []

    lines.push(`# Auto Action Tray — ${context.item.name}`)
    lines.push('')
    lines.push(`- Item type: ${context.item.type}`)
    lines.push(`- Actor: ${this.aatItem?.actor?.name} (${this.aatItem?.actor?.type})`)
    lines.push(`- Foundry ${game.version} / dnd5e ${game.system.version}`)
    lines.push('')

    if (context.recommendations.length) {
      lines.push('## Recommended actions')
      for (const r of context.recommendations) {
        lines.push(`- ${plain(r.remedy)} _(${plain(r.title)})_`)
      }
      lines.push('')
    }

    lines.push('## Findings')
    if (!context.findings.length) lines.push('None.')
    for (const f of context.findings) {
      lines.push(`- **[${f.meta.label}] ${plain(f.title)}**`)
      if (f.explanation) lines.push(`  ${plain(f.explanation)}`)
      if (f.evidence)
        lines.push('  ```\n  ' + plain(f.evidence).split('\n').join('\n  ') + '\n  ```')
    }
    lines.push('')

    lines.push('## Last use')
    if (!context.trace) {
      lines.push('No recorded use.')
    } else {
      lines.push(`Recorded ${context.trace.when}${context.trace.dryRun ? ' (dry run)' : ''}`)
      if (context.trace.aborted) lines.push(`Aborted: ${context.trace.aborted}`)
      for (const step of context.trace.steps) {
        lines.push(`${step.index}. [${step.meta.label}] ${step.label}`)
        for (const row of step.rows) lines.push(`   - ${row.key}: ${row.value}`)
        if (step.note) lines.push(`   > ${step.note}`)
      }
    }
    lines.push('')

    lines.push('## Payload')
    if (!context.payloads.length) lines.push('No recorded payload.')
    for (const p of context.payloads) {
      lines.push(`### ${p.activityName ?? p.activityId}${p.targetName ? ` → ${p.targetName}` : ''}`)
      lines.push('```json')
      lines.push(p.json)
      lines.push('```')
    }
    lines.push('')

    lines.push('## Environment')
    for (const row of context.environment) lines.push(`- ${row.label}: ${row.value}`)

    const report = lines.join('\n')
    try {
      await game.clipboard.copyPlainText(report)
      ui.notifications.info('Report copied to clipboard.')
    } catch (e) {
      console.error('AAT | Could not copy the troubleshooting report.', e)
      ui.notifications.warn(
        'Could not copy automatically — the report has been logged to the console.',
      )
      console.log(report)
    }
  }

  _onClose(options) {
    super._onClose(options)
    UseTrace.disarm()
  }
}

export class ItemDoctor {
  // `this` is the AutoActionTray instance when called from the tray context menu.
  static open(item) {
    if (!item) return
    new ItemDoctorApp({ hotbar: this, item }).render(true)
  }
}
