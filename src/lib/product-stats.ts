/**
 * Single source of truth for the public corpus figures, TypeScript side.
 *
 * Reads `public/product-stats.json`, which `scripts/generate_product_stats.py`
 * writes from the live SQLite DB. Never hard-code a headline figure in a
 * component, a metadata export, an `.md` adapter, or a static asset. Import
 * from here, or (for static assets under `public/`) let the generator render
 * the file.
 *
 * The Python side (`src/product_stats.py`) reads the SAME JSON at startup, so
 * the REST API, the MCP server, and the newsletter cannot drift from the
 * frontend. There is exactly one computation, in the generator.
 *
 * Rounding is always DOWN. An overstated figure fails the moment a reviewer
 * checks the open API — that is exactly how hoynelabs' "14,000+ venues" broke
 * against a real 13,279 on 2026-08-10.
 */
import raw from "../../public/product-stats.json"

export type ProductStats = {
  deals: number
  venues: number
  neighborhoods: number
  sources: number
  generated_at: string
}

/** Raw counts, exactly as measured. Use for arithmetic, never for display. */
export const rawStats: ProductStats = raw

/**
 * Floor `n` to the nearest thousand and suffix "+": 78,118 -> "78,000+".
 *
 * The one rounding helper. Only meaningful for figures of 1,000 or more; a
 * smaller number would floor to "0+", so it throws instead of quietly
 * publishing a zero. Exact small counts (neighborhoods) use `exact()`.
 */
export function floorToThousand(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError(`floorToThousand: not a number: ${n}`)
  if (n < 1000) {
    throw new RangeError(
      `floorToThousand(${n}): below 1,000 would render "0+". Use exact() for small counts.`,
    )
  }
  return `${(Math.floor(n / 1000) * 1000).toLocaleString("en-US")}+`
}

/**
 * Floor `n` to the nearest thousand WITHOUT the "+" suffix: 78,118 -> "78,000".
 *
 * For prose that already carries the approximation ("over 78,000 deals"),
 * where a "+" would read as "over 78,000+".
 */
export function floorToThousandPlain(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError(`floorToThousandPlain: not a number: ${n}`)
  if (n < 1000) {
    throw new RangeError(
      `floorToThousandPlain(${n}): below 1,000 would render "0". Use exact() for small counts.`,
    )
  }
  return (Math.floor(n / 1000) * 1000).toLocaleString("en-US")
}

/** Render an exact count with thousands separators and no "+" suffix. */
export function exact(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError(`exact: not a number: ${n}`)
  return n.toLocaleString("en-US")
}

/**
 * Display-ready figures. These are the strings that appear on every surface.
 *
 * `neighborhoods` is exact, not floored: it is a small, stable, individually
 * enumerable set (the API returns all 149), so a "+" would be both wrong and
 * unverifiable.
 */
export const stats = {
  deals: floorToThousand(rawStats.deals),
  venues: floorToThousand(rawStats.venues),
  neighborhoods: exact(rawStats.neighborhoods),
  sources: floorToThousand(rawStats.sources),
} as const

/**
 * Floored figures without the "+" suffix, for prose that already says "over"
 * or "more than".
 */
export const statsPlain = {
  deals: floorToThousandPlain(rawStats.deals),
  venues: floorToThousandPlain(rawStats.venues),
  neighborhoods: exact(rawStats.neighborhoods),
  sources: floorToThousandPlain(rawStats.sources),
} as const

/** URL-encoded copies, for the `/api/og` share-card query strings. */
export const statsEncoded = {
  deals: encodeURIComponent(stats.deals),
  venues: encodeURIComponent(stats.venues),
  neighborhoods: encodeURIComponent(stats.neighborhoods),
  sources: encodeURIComponent(stats.sources),
} as const
