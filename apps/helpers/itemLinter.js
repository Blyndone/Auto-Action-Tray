import { SEVERITY, finding } from './useTrace.js'
import { ItemConfig } from '../dialogs/itemConfig.js'

// Static checks over a single AATItem. These answer "what will this item do when pressed" without
// pressing it, and deliberately re-run the parts of the pipeline that swallow their own errors so
// a failure shows up in the dialog instead of only in the console.
//
// Read-only: nothing here writes to the item, its flags, or the actor.

export class ItemLinter {
  static run(aatItem, application) {
    if (!aatItem) return []

    const checks = [
      this.#activities,
      this.#activation,
      this.#preparation,
      this.#scaledSpell,
      this.#damage,
      this.#targeting,
      this.#range,
      this.#overrideList,
      this.#castActivities,
      this.#itemConfigFlag,
      this.#cacheDrift,
    ]

    const results = []
    for (const check of checks) {
      try {
        const out = check.call(this, aatItem, application)
        if (Array.isArray(out)) results.push(...out.filter(Boolean))
        else if (out) results.push(out)
      } catch (err) {
        results.push(
          finding({
            id: 'linter-error',
            severity: SEVERITY.INFO,
            title: 'A check could not run',
            explanation: err?.message ?? String(err),
            source: 'apps/helpers/itemLinter.js',
          }),
        )
      }
    }
    return results
  }

  static #activities(item) {
    const count = item.activities?.length ?? 0
    if (count === 0) {
      return finding({
        id: 'no-activities',
        severity: SEVERITY.WARN,
        title: 'Item has no activities',
        explanation:
          'Nothing can be rolled. The item still appears in trays that do not filter on activities, but pressing it has no effect.',
        remedy:
          'Add an activity to the item on its sheet, or remove the item from the tray if it is not meant to be pressed.',
        source: 'apps/items/item.js',
      })
    }
    return finding({
      id: 'activities',
      severity: SEVERITY.OK,
      title: `${count} ${count === 1 ? 'activity' : 'activities'}`,
      explanation:
        count > 1
          ? 'With more than one activity you are asked to pick, unless fast forward is on — in which case the first activity is used.'
          : '',
      evidence: item.activities.map((a) => a.name).join(', '),
      source: 'apps/items/item.js',
    })
  }

  static #activation(item) {
    const types = [
      ...new Set(
        (item.activities ?? [])
          .map((a) => a.activity?.activation?.type ?? '(none)')
          .filter(Boolean),
      ),
    ]
    if (!types.length) return null

    const placed = ['action', 'bonus', 'reaction']
    const unplaced = types.filter((t) => !placed.includes(t))

    const label = item.tooltip?.activationTimeLabel ?? ''
    const actionType = item.tooltip?.actionType ?? ''

    const out = [
      finding({
        id: 'activation-types',
        severity:
          unplaced.length && !types.some((t) => placed.includes(t)) ? SEVERITY.INFO : SEVERITY.OK,
        title: `Activation: ${types.join(', ')}`,
        explanation: unplaced.length
          ? 'Only action, bonus and reaction activations are sorted into the auto-built trays. Anything else has to be placed on a custom tray by hand.'
          : '',
        source: 'apps/components/staticTray.js',
      }),
    ]

    if (label && !actionType) {
      out.push(
        finding({
          id: 'no-action-economy',
          severity: SEVERITY.INFO,
          title: 'Using this will not consume an action',
          explanation: `The activation reads "${label}". The turn tray only decrements for activations labelled Action, Bonus or Reaction.`,
          source: 'apps/items/itemTooltip.js',
        }),
      )
    }
    return out
  }

  static #preparation(item) {
    if (item.type !== 'spell') return null
    if (item.isPrepared) return null
    if (['innate', 'atwill', 'pact'].includes(item.preparationMode)) return null

    return finding({
      id: 'unprepared',
      severity: SEVERITY.INFO,
      title: 'Spell is not prepared',
      explanation: 'Unprepared spells are filtered out of the spell level trays.',
      source: 'apps/items/item.js',
    })
  }

  static #scaledSpell(item) {
    if (item.type !== 'spell') return null
    if (item.spellLevel === 0) return null
    if (item.isScaledSpell) return null
    if (['innate', 'atwill'].includes(item.preparationMode)) return null

    const uses = item.item.system?.uses
    if (uses?.max === '' || uses?.max == null) return null

    return finding({
      id: 'limited-use-spell',
      severity: SEVERITY.WARN,
      title: 'Spell has limited uses, so it is not treated as upcastable',
      explanation:
        'A spell only counts as scalable when it has no uses maximum. Because this one does, it is placed on the action or bonus tray instead of the spell level trays, and pressing it never offers a slot level — so it rolls at its base level.',
      remedy:
        'Clear the uses maximum on the spell if it should be castable at higher levels; otherwise this is working as intended.',
      evidence: `system.uses.max = ${JSON.stringify(uses.max)}`,
      source: 'apps/items/item.js',
    })
  }

  // Re-runs the damage computation that degrades to a blank label with a console-only error.
  static #damage(item) {
    const tooltip = item.tooltip
    if (!tooltip) return null

    // Reading the labels is what triggers the (deferred, self-catching) calculation.
    const dice = tooltip.diceLabel
    const damage = tooltip.damageLabel

    if (tooltip.damageError) {
      return finding({
        id: 'damage-error',
        severity: SEVERITY.FAIL,
        title: 'Damage could not be calculated',
        explanation:
          'The tooltip shows no damage because the calculation threw. This is normally only visible in the browser console.',
        remedy:
          'Check the damage parts on the activity — a formula that does not parse is the usual cause. The stack below points at the failing step.',
        evidence: tooltip.damageError.stack ?? String(tooltip.damageError),
        source: 'apps/items/itemTooltip.js',
      })
    }

    if (!dice && item.isActive && item.activities?.length) {
      return finding({
        id: 'no-damage',
        severity: SEVERITY.INFO,
        title: 'No damage formula',
        explanation:
          'The activity declares no damage or healing parts, so no damage is shown or rolled. Utility, summon, enchantment and check activities are expected to look like this.',
        source: 'apps/items/itemTooltip.js',
      })
    }

    return finding({
      id: 'damage',
      severity: SEVERITY.OK,
      title: 'Damage formula resolved',
      evidence: `${dice.replace(/<[^>]*>/g, '')} — ${damage}`.trim(),
      source: 'apps/items/itemTooltip.js',
    })
  }

  static #targeting(item) {
    const tooltip = item.tooltip
    if (!tooltip) return null
    const count = tooltip.targetCount
    const activity = item.defaultActivity?.activity
    const affects = activity?.target?.affects?.type ?? null
    const template = activity?.target?.template?.type ?? null

    if (count > 0) {
      return finding({
        id: 'target-count',
        severity: SEVERITY.OK,
        title: `Target helper will ask for ${count} target${count === 1 ? '' : 's'}`,
        source: 'apps/items/itemTooltip.js',
      })
    }

    const reason = template
      ? `it places a ${template} template — targets come from the template, not the helper`
      : affects === 'self' || activity?.range?.units === 'self'
        ? 'it targets self'
        : affects === 'space'
          ? 'it targets a space rather than creatures'
          : 'the activity declares no affected creature count'

    // A template or a self-target explains itself, so only the unexplained cases are worth acting on.
    const expected = template || affects === 'self'

    return finding({
      id: 'target-count-zero',
      severity: expected ? SEVERITY.INFO : SEVERITY.WARN,
      title: 'Target helper will be skipped',
      explanation: `The target count is 0 because ${reason}. The activity fires against whatever tokens are already targeted.`,
      remedy: expected
        ? ''
        : 'Set a target count in Item Config for this item, or give the activity an affected creature count on its sheet.',
      source: 'apps/items/itemTooltip.js',
    })
  }

  static #range(item, application) {
    const activity = item.defaultActivity?.activity
    const itemUnits = activity?.range?.units ?? item.item.system?.range?.units ?? null
    const sceneUnits = canvas?.grid?.units ?? null
    const perSquare = canvas?.grid?.distance ?? null

    const out = []

    if (
      itemUnits &&
      sceneUnits &&
      itemUnits !== sceneUnits &&
      !['self', 'touch', 'any', 'spec'].includes(itemUnits)
    ) {
      out.push(
        finding({
          id: 'range-units-differ',
          severity: SEVERITY.INFO,
          title: `Range is in ${itemUnits}, the scene measures in ${sceneUnits}`,
          explanation: 'The range is converted before the boundary is drawn.',
          source: 'apps/helpers/targetHelper.js',
        }),
      )
    }

    if (perSquare != null && perSquare !== 5) {
      out.push(
        finding({
          id: 'non-default-grid',
          severity: SEVERITY.INFO,
          title: `Scene grid is ${perSquare} ${sceneUnits} per square`,
          explanation:
            'Range checks convert into squares using the scene grid rather than assuming 5 ft, so a non-default grid is handled — but it is worth confirming if ranges look wrong.',
          source: 'apps/helpers/targetHelper.js',
        }),
      )
    }

    if (perSquare === 0) {
      out.push(
        finding({
          id: 'gridless-scene',
          severity: SEVERITY.WARN,
          title: 'Scene is gridless',
          explanation:
            'With no grid distance the range cannot be converted to squares, so the range boundary is approximate.',
          remedy:
            'Set a grid distance in Scene Configuration if ranges need to be exact, or treat the drawn boundary as a guide.',
          source: 'apps/helpers/targetHelper.js',
        }),
      )
    }

    if (itemUnits && !['ft', 'm', 'mi', 'km', 'touch', 'self'].includes(itemUnits)) {
      out.push(
        finding({
          id: 'unmeasurable-range',
          severity: SEVERITY.INFO,
          title: `Range units "${itemUnits}" are not a measurable length`,
          explanation: 'No range boundary or range hover is drawn for this item.',
          source: 'apps/items/itemTooltip.js',
        }),
      )
    }

    return out
  }

  // The multi-projectile spells are special-cased by exact English name, so a rename or a
  // translated compendium silently loses the extra beams.
  static #overrideList(item) {
    const OVERRIDES = ['Eldritch Blast', 'Magic Missile', 'Scorching Ray']
    const name = item.item?.name ?? item.name
    if (OVERRIDES.includes(name)) {
      return finding({
        id: 'name-override-active',
        severity: SEVERITY.OK,
        title: 'Multi-projectile handling is active',
        explanation: `"${name}" is special-cased so its extra beams are counted for damage and targeting.`,
        source: 'apps/items/itemTooltip.js',
      })
    }

    const looksRenamed = OVERRIDES.some((o) =>
      name?.toLowerCase().includes(o.toLowerCase().split(' ')[0]),
    )
    if (looksRenamed) {
      return finding({
        id: 'name-override-missed',
        severity: SEVERITY.WARN,
        title: 'Multi-projectile handling is not applied',
        explanation: `Extra beams are recognised by exact name (${OVERRIDES.join(', ')}). "${name}" does not match, so it is treated as a single projectile for damage and target count.`,
        remedy: `Rename the item to match one of ${OVERRIDES.join(', ')} exactly if it should fire multiple projectiles, or set the target count by hand in Item Config.`,
        source: 'apps/items/itemTooltip.js',
      })
    }
    return null
  }

  static #castActivities(item) {
    const casts = (item.activities ?? []).filter((a) => a.activity?.type === 'cast')
    if (!casts.length) return null

    const broken = casts.filter((a) => {
      const uuid = a.activity?.spell?.uuid
      if (!uuid) return true
      try {
        return !fromUuidSync(uuid)
      } catch (e) {
        return true
      }
    })

    if (!broken.length) return null

    return finding({
      id: 'broken-cast-activity',
      severity: SEVERITY.FAIL,
      title: 'A cast activity points at a spell that cannot be found',
      explanation:
        'The linked spell does not resolve, so its damage and targeting are unavailable. This failure is normally silent.',
      remedy:
        'Open the cast activity and repoint it at a spell that exists — the compendium it came from may not be installed.',
      evidence: broken
        .map((a) => `${a.name}: ${a.activity?.spell?.uuid ?? '(no uuid)'}`)
        .join('\n'),
      source: 'apps/items/item.js',
    })
  }

  static #itemConfigFlag(item) {
    const doc = item.item
    const raw = doc.getFlag('auto-action-tray', 'itemConfig')
    if (raw == null) return null

    const parsed = ItemConfig.getItemConfig(doc)
    if (parsed == null) {
      return finding({
        id: 'bad-item-config',
        severity: SEVERITY.FAIL,
        title: 'Item Config data is unreadable',
        explanation:
          'The saved configuration for this item could not be parsed and is being ignored entirely.',
        remedy: 'Open Item Config on this item and press Reset to clear the unreadable data.',
        evidence: String(raw).slice(0, 200),
        source: 'apps/dialogs/itemConfig.js',
      })
    }

    const active = Object.entries(parsed)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${v}`)

    return finding({
      id: 'item-config',
      severity: SEVERITY.INFO,
      title: 'Item Config overrides are set',
      explanation: 'These override the tray defaults for this item.',
      evidence: active.join('\n'),
      source: 'apps/dialogs/itemConfig.js',
    })
  }

  // The trays read a cached snapshot of the actor's items, so an item edited after the snapshot
  // was taken can behave like its older self — including not being found at all.
  static #cacheDrift(item, application) {
    const live = item.actor?.items?.get(item.id)
    if (!live) {
      return finding({
        id: 'item-deleted',
        severity: SEVERITY.FAIL,
        title: 'Item no longer exists on the actor',
        explanation:
          'The tray is showing a cached entry for an item that has been deleted. Pressing it will do nothing.',
        remedy: 'Reselect the token to rebuild the tray from the actor as it is now.',
        source: 'apps/autoActionTray.js',
      })
    }

    const drifted = []
    if (live.name !== item.name) drifted.push(`name: "${item.name}" → "${live.name}"`)
    if (live.img !== item.img) drifted.push('image changed')
    if ((live.system?.equipped ?? false) !== item.equipped) drifted.push('equipped state changed')
    if ((live.system?.level ?? null) !== item.spellLevel && item.type === 'spell') {
      drifted.push(`spell level: ${item.spellLevel} → ${live.system?.level}`)
    }
    if (live.system?.activities?.contents.length !== item.activities.length) {
      drifted.push(
        `activity count: ${item.activities.length} → ${live.system?.activities?.contents.length}`,
      )
    }

    if (!drifted.length) return null

    return finding({
      id: 'cache-drift',
      severity: SEVERITY.WARN,
      title: 'Tray data is out of date',
      explanation:
        'The item has changed since the tray cached it, so the tray may use the old values.',
      remedy:
        'Reselect the token, or reload the client, to rebuild the tray from the current item.',
      evidence: drifted.join('\n'),
      source: 'apps/autoActionTray.js',
    })
  }
}
