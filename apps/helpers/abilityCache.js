/**
 * The per-actor AATItem cache every tray is built from. One LRU entry per selected actor; the
 * `abilities` array inside an entry is shared by reference with every tray built from it, so
 * callers must treat it as shared state.
 *
 * Keyed by actor id when linked, by actor id + token id when not: two tokens of the same NPC are
 * different creatures with different item states and must not share a tray.
 */
import { AATItem } from '../items/item.js'
import { warnUnexpected } from './perfTrace.js'

/** Warm the browser cache for an item icon. Rejects on a broken image, so collect with allSettled. */
function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src
    img.onload = () => resolve(src)
    img.onerror = reject
  })
}

export class ActorAbilityCache {
  /** How many actors' ability lists to keep. */
  static MAX_ENTRIES = 10

  constructor({ max = ActorAbilityCache.MAX_ENTRIES } = {}) {
    this.max = max
    this.entries = []
  }

  /** Sorted once here: the list is shared by reference with every tray built from it. */
  static sortAbilities(abilities) {
    return abilities.sort((a, b) => (a?.item?.sort ?? -Infinity) - (b?.item?.sort ?? -Infinity))
  }

  /**
   * The token document an entry is keyed against; only `actorLink` and `id` are read off it.
   *
   * `actor.token` is the real TokenDocument for an unlinked actor and null for a linked one,
   * whose prototypeToken carries the same actorLink flag. Do not use `actor.getTokenDocument()`
   * here - it is async and rebuilds a throwaway document on every call.
   */
  getCacheToken(actor) {
    return actor?.token ?? actor?.prototypeToken ?? null
  }

  /** The cache entry for this actor/token pair, or undefined. */
  find(actor, token) {
    if (!token) return undefined
    if (token.actorLink) {
      return this.entries.find((a) => a.id == actor.id)
    }
    if (!token.id) {
      // Without an id, two copies of the same NPC are indistinguishable and would share a tray.
      warnUnexpected('getSavedActor: unlinked token has no id', actor?.name)
    }
    return this.entries.find((a) => a.id == actor.id && a.tokenId == token.id)
  }

  /** Drop the entry for this actor/token pair. */
  delete(actor, token) {
    if (!token) return
    if (token.actorLink) {
      this.entries = this.entries.filter((a) => a.id !== actor.id)
    } else {
      this.entries = this.entries.filter((a) => !(a.id === actor.id && a.tokenId === token.id))
    }
  }

  /**
   * Reconcile cached wrappers against the actor's current items. Surviving wrappers are reused, so
   * only new items pay construction cost and trays keep their existing object references.
   */
  sync(entry, actor) {
    const existing = new Map(entry.abilities.map((a) => [a?.id, a]))
    const abilities = []
    for (const item of actor.items) {
      const cached = existing.get(item.id)
      if (cached) {
        abilities.push(cached)
        continue
      }
      const created = AATItem.safeCreate(item, actor)
      if (created) abilities.push(created)
    }
    entry.abilities = ActorAbilityCache.sortAbilities(abilities)
  }

  /** Build and store a new entry, evicting the oldest if full. Artwork is warmed in background. */
  populate(actor, cacheToken) {
    if (this.entries.length >= this.max) {
      this.entries.shift()
    }

    let items
    if (cacheToken?.actorLink || actor.token == null) {
      items = actor.items
    } else {
      items = actor.token.delta.items
    }

    // allSettled, not forEach: a missing icon rejects, and would otherwise surface as an
    // unhandled rejection per broken image. Deliberately not awaited.
    Promise.allSettled(items.map((e) => preloadImage(e.img)))

    const entry = {
      name: actor.name,
      id: actor.id,
      tokenId: actor?.token?.id,
      type: actor.type,
      abilities: ActorAbilityCache.sortAbilities(
        items.map((i) => AATItem.safeCreate(i, actor)).filter(Boolean),
      ),
    }
    this.entries.push(entry)
    return entry
  }

  /** Cached abilities for an actor uuid. Returns [] rather than throwing, so a stale uuid
   *  cannot take out an in-flight render. */
  abilitiesForUuid(actorUuid) {
    const actor = fromUuidSync(actorUuid)
    if (!actor) {
      warnUnexpected('getActorAbilities: no actor for uuid', actorUuid)
      return []
    }
    const token = this.getCacheToken(actor)
    if (!token) return []
    return this.find(actor, token)?.abilities ?? []
  }

  /** Remove one ability from the entry belonging to `actor`. */
  deleteAbility(actor, itemId) {
    const entry = this.find(actor, this.getCacheToken(actor))
    if (!entry) return
    entry.abilities = entry.abilities.filter((e) => e.id !== itemId)
  }
}
