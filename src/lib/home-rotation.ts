// Shared rotation/variety helper for the homepage browse sections.
// Each section fetches the FRESHEST pool (sort:"recently_updated"), then we dedup by
// venue, cap per neighborhood for variety, and daily-shuffle so the lineup
// rotates each day and diverges between sections (distinct seedSalt) instead
// of showing the same handful of popular/stale venues everywhere.

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Seed stable within a calendar day (so SSR/CSR agree and the lineup rotates daily). */
export function dailySeed(salt = ""): number {
  const d = new Date()
  return seedFromString(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}:${salt}`)
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice()
  const rand = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

type HasVenueHood = {
  venue_slug?: string | null
  neighborhood_slug?: string | null
}

/**
 * From a freshness-ordered deal list, build a varied, deduped pool (one deal
 * per venue, capped per neighborhood), then daily-shuffle and take `count`.
 * `seedSalt` makes different sections rotate independently so they don't all
 * surface the same venues.
 */
export function pickVariedVenues<T extends HasVenueHood>(
  deals: T[],
  opts: { count: number; maxPerHood?: number; seedSalt?: string; poolSize?: number }
): T[] {
  const { count, maxPerHood = 2, seedSalt = "", poolSize = count * 4 } = opts
  const seenVenue = new Set<string>()
  const hoodCount = new Map<string, number>()
  const pool: T[] = []
  for (const d of deals) {
    const vs = d.venue_slug
    if (!vs || seenVenue.has(vs)) continue
    const k = d.neighborhood_slug || "_"
    if ((hoodCount.get(k) ?? 0) >= maxPerHood) continue
    seenVenue.add(vs)
    hoodCount.set(k, (hoodCount.get(k) ?? 0) + 1)
    pool.push(d)
    if (pool.length >= poolSize) break
  }
  // If variety capping left us short of `count`, backfill with remaining unique
  // venues (ignoring the hood cap) so the section never looks empty.
  if (pool.length < count) {
    for (const d of deals) {
      const vs = d.venue_slug
      if (!vs || seenVenue.has(vs)) continue
      seenVenue.add(vs)
      pool.push(d)
      if (pool.length >= count) break
    }
  }
  return seededShuffle(pool, dailySeed(seedSalt)).slice(0, count)
}
