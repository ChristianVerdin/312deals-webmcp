import type { MetadataRoute } from "next"
import { DEAL_TYPE_PAGES, DEAL_TYPE_SLUGS, CUISINE_PAGES, STUDENT_GUIDE_PAGES, LANDMARK_PAGES } from "@/lib/seo-utils"
import { getAllPosts } from "@/lib/blog"

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

// Venue pages are batched into groups of this size for separate sitemaps.
// Only venues with active deals are included (~1,970 vs ~6,800 total).
// Hub pages (ID 0) are separate from venue pages (ID 1+).
const VENUE_BATCH_SIZE = 1000

// --- Helpers ---

/** Parse a date string from the API, returning undefined if invalid. */
function parseDate(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? undefined : d
}

/** Fetch JSON from the API with caching. Returns null on failure. */
async function apiFetch<T>(path: string, revalidate = 3600): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Same as apiFetch, but retries and then THROWS instead of returning null.
 *
 * Use this wherever a null would be indistinguishable from "no more data".
 * The venue paging loop below breaks on an empty page, so a single transient
 * failure used to silently truncate a shard — or empty it entirely, which
 * Next.js then serves as a 404. On 2026-09-01 that had six of eleven shards
 * degraded at once (three 404, three empty, three truncated mid-fill) and cut
 * the live sitemap from ~10,600 URLs to 3,706, with the bad output cached at
 * build time. Failing the build is strictly better than publishing a sitemap
 * that quietly drops two thirds of the site.
 */
async function apiFetchRequired<T>(path: string, revalidate = 3600): Promise<T> {
  // Backoff is deliberately generous (~31s total). Vercel and Railway deploy in
  // parallel off the same push, and Railway needs ~2.5min to pull and gunzip the
  // ~167MB DB from R2, so a build routinely calls a backend that is still
  // booting. If it still fails after this, the build fails: redeploy Vercel once
  // Railway is green rather than shipping a partial sitemap.
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
    }
    try {
      const res = await fetch(`${API_URL}${path}`, { next: { revalidate } })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`)
        continue
      }
      return (await res.json()) as T
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error(
    `sitemap: ${path} failed after 6 attempts (${String(lastErr)}). ` +
      `Refusing to emit a truncated sitemap.`
  )
}

// Hoods with a hand-authored /dietary/gluten-free/[slug] page (mirrors the
// HOOD_INDEX in that route). Only those WITH live GF inventory are emitted to
// the sitemap, see gfHoodHasInventory.
const GF_HOOD_SLUGS = [
  "river-north", "west-loop", "lincoln-park", "lakeview", "the-loop", "logan-square",
  "wicker-park", "west-town", "andersonville", "south-loop", "streeterville", "wrigleyville",
  "hyde-park", "gold-coast", "old-town", "rogers-park", "edgewater", "pilsen",
  "humboldt-park", "ukrainian-village", "bucktown", "evanston", "oak-park", "naperville", "lincoln-square",
]

/**
 * True when a hood has gluten-free inventory, mirrors the dietary GF route's
 * own noindex decision (confirmed `gluten_free=true` deals OR `likely_gf`
 * dietary-tagged deals). Keeps the sitemap in lockstep with which hood pages
 * are actually indexable, fixing the GSC "noindex validation fail".
 */
async function gfHoodHasInventory(slug: string): Promise<boolean> {
  const [confirmed, likely] = await Promise.all([
    apiFetch<{ deals?: unknown[] }>(`/api/v1/deals/search?neighborhood=${slug}&gluten_free=true&limit=5`),
    apiFetch<{ deals?: Array<{ dietary_tags?: string[] }> }>(`/api/v1/deals/search?neighborhood=${slug}&limit=5`),
  ])
  const hasConfirmed = (confirmed?.deals?.length ?? 0) > 0
  const hasLikely = (likely?.deals ?? []).some((d) => d.dietary_tags?.includes("likely_gf"))
  return hasConfirmed || hasLikely
}

// --- Sitemap Index ---
// Next.js 14: exporting generateSitemaps() causes Next.js to create a
// sitemap index at /sitemap.xml pointing to /sitemap/0.xml, /sitemap/1.xml, etc.

export async function generateSitemaps() {
  // Only include venues with active deals in the sitemap (~1,970 vs ~6,800 total).
  // This avoids thin venue pages that Google won't index anyway.
  // Required: a swallowed failure here silently collapses the shard count to
  // the fallback (2 venue shards for a corpus that needs 10), which drops
  // thousands of venue URLs from the sitemap with no error anywhere.
  let totalVenues: number
  const data = await apiFetchRequired<{
    venues: { slug: string }[]
    total_count?: number
    count: number
  }>("/api/v1/venues/search?fields=slug&has_deals=true&limit=1&offset=0")

  if (data?.total_count) {
    totalVenues = data.total_count + 100 // small buffer for growth
  } else {
    // Probe to estimate count (fallback for older API without total_count)
    const probe = await apiFetchRequired<{ venues: { slug: string }[] }>(
      "/api/v1/venues/search?fields=slug&has_deals=true&limit=1&offset=1500"
    )
    totalVenues = probe?.venues && probe.venues.length > 0 ? 2000 : 1500
  }

  const venueBatches = Math.ceil(totalVenues / VENUE_BATCH_SIZE)

  // ID 0 = hub pages, ID 1..N = venue batches
  return Array.from({ length: 1 + venueBatches }, (_, i) => ({ id: i }))
}

// --- Individual Sitemaps ---

export default async function sitemap({
  id,
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  if (id === 0) {
    return buildHubSitemap()
  }
  return buildVenueSitemap(id)
}

// --- Hub Sitemap (ID 0) ---
// Contains all high-value pages: static pages, neighborhoods, happy-hours,
// deal types, cuisines, student guides, and neighborhood × deal-type combos.

async function buildHubSitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []

  // Static pages, no lastModified (we don't have real change dates for these;
  // omitting is better than faking per Google's guidance)
  const staticPages = [
    { path: "/", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/search", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/map", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/neighborhoods", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/deals", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/today", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/happy-hours", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/cuisine", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/student-guides", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/near", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/crawl", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/advertise", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/partner", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/featured", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/guides", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/guides/chicago-happy-hours", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/guides/cheap-drinks-chicago", priority: 0.9, changeFrequency: "daily" as const },
    // NB: /guides/march-madness-chicago and /guides/cubs-opening-day-chicago
    // are 301-redirected per next.config.mjs (to college-bars + cubs-game-day).
    // Excluded from sitemap, emit the destination URLs instead.
    { path: "/guides/bears-game-day-chicago", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/guides/college-football-chicago", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/guides/white-sox-game-day-chicago", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/guides/cubs-game-day-chicago", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/guides/college-bars-chicago", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/guides/st-patricks-day-chicago", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/guides/chicago-food-deals", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/guides/patio-season-chicago", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/guides/dog-friendly-patios-chicago", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/guides/mexican-independence-day-chicago", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/guides/chicago-marathon-bars-restaurants", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/guides/halloween-bars-chicago", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/guides/oktoberfest-chicago", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/guides/cinco-de-mayo-chicago", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/guides/graduation-dinner-chicago", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/guides/memorial-day-weekend-chicago", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/guides/fathers-day-chicago", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/guides/pride-chicago", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/guides/world-cup-chicago", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/guides/4th-of-july-chicago", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/guides/lollapalooza-chicago", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/guides/best-brunch-chicago", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/guides/deep-dish-pizza-chicago", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/guides/late-night-eats-chicago", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/guides/where-to-stay-chicago", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/dietary", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/dietary/gluten-free", priority: 0.8, changeFrequency: "weekly" as const },
    // Per-neighborhood gluten-free pages are added AFTER this array, gated by
    // live GF inventory (see GF_HOOD_SLUGS + the presence check in
    // buildHubSitemap) so empty hood pages stay out of the sitemap, they emit
    // robots:noindex when both the confirmed-GF and likely-GF pools are empty,
    // and a sitemap entry for a noindex page is the GSC "noindex validation
    // fail" this fixes.
    { path: "/reports/chicago-deals-2026", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/reports/chicago-value-dining-2026", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/chat", priority: 0.7, changeFrequency: "daily" as const },
    { path: "/submit", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "monthly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "monthly" as const },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/blog", priority: 0.8, changeFrequency: "weekly" as const },
    // Agent-readiness assets, surfaced to AI crawlers and the Mintlify Agent
    // Score "freshness" check. /mcp is the discovery stub for our MCP server.
    { path: "/llms.txt", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/llms-full.txt", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/llms-index.txt", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/llms-venues.txt", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/llms-deals.txt", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/llms-neighborhoods.txt", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/llms-cuisines.txt", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/llms-guides.txt", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/skill.md", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/.well-known/mcp.json", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/.well-known/webmcp.json", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/mcp", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/openapi-gpt.json", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/api/v1/openapi.json", priority: 0.7, changeFrequency: "monthly" as const },
  ]

  for (const page of staticPages) {
    entries.push({
      url: `${SITE_URL}${page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })
  }

  // Gluten-free hood pages, emit only those with live GF inventory so we don't
  // sitemap pages that render robots:noindex (the GSC validation fail). Parallel,
  // cached presence checks.
  const gfPresence = await Promise.all(GF_HOOD_SLUGS.map(gfHoodHasInventory))
  GF_HOOD_SLUGS.forEach((slug, i) => {
    if (gfPresence[i]) {
      entries.push({
        url: `${SITE_URL}/dietary/gluten-free/${slug}`,
        changeFrequency: "weekly",
        priority: 0.7,
      })
    }
  })

  // Blog posts
  const blogPosts = getAllPosts()
  for (const post of blogPosts) {
    entries.push({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly",
      priority: 0.7,
    })
  }

  // Deal type pages
  for (const slug of Object.keys(DEAL_TYPE_PAGES)) {
    entries.push({
      url: `${SITE_URL}/deals/${slug}`,
      changeFrequency: "daily",
      priority: 0.8,
    })
  }

  // Cuisine pages
  for (const slug of Object.keys(CUISINE_PAGES)) {
    entries.push({
      url: `${SITE_URL}/cuisine/${slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    })
  }

  // Student guide pages
  for (const slug of Object.keys(STUDENT_GUIDE_PAGES)) {
    entries.push({
      url: `${SITE_URL}/student-guides/${slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    })
  }

  // "Near a landmark" pages
  for (const slug of Object.keys(LANDMARK_PAGES)) {
    entries.push({
      url: `${SITE_URL}/near/${slug}`,
      changeFrequency: "weekly",
      priority: 0.8,
    })
  }

  // Neighborhood pages + happy hour pages, use real updated_at from API
  const nData = await apiFetch<{
    neighborhoods: Array<{
      slug: string
      active_deal_count: number
      updated_at?: string
    }>
  }>("/api/v1/neighborhoods")

  for (const n of nData?.neighborhoods ?? []) {
    if (n.active_deal_count === 0) continue
    const lastMod = parseDate(n.updated_at)
    entries.push({
      url: `${SITE_URL}/neighborhoods/${n.slug}`,
      ...(lastMod && { lastModified: lastMod }),
      changeFrequency: "daily",
      priority: 0.8,
    })
    entries.push({
      url: `${SITE_URL}/happy-hours/${n.slug}`,
      ...(lastMod && { lastModified: lastMod }),
      changeFrequency: "daily",
      priority: 0.8,
    })
  }

  // Programmatic SEO: neighborhood × deal-type combo pages
  const dtData = await apiFetch<{
    combos: Array<{
      neighborhood_slug: string
      deal_type: string
    }>
  }>("/api/v1/neighborhoods/deal-types", 86400)

  if (dtData?.combos) {
    const dealTypeToSlug: Record<string, string> = {}
    for (const [slug, config] of Object.entries(DEAL_TYPE_SLUGS)) {
      dealTypeToSlug[(config as { apiValue: string }).apiValue] = slug
    }
    for (const combo of dtData.combos) {
      const dtSlug = dealTypeToSlug[combo.deal_type]
      // Skip happy-hour: /neighborhoods/<hood>/happy-hour now canonicalises to
      // /happy-hours/<hood>, which this sitemap already emits above. Listing a
      // URL that points its canonical somewhere else is a mixed signal.
      if (dtSlug && combo.deal_type !== "happy_hour") {
        entries.push({
          url: `${SITE_URL}/neighborhoods/${combo.neighborhood_slug}/${dtSlug}`,
          changeFrequency: "daily",
          priority: 0.6,
        })
      }
    }
  }

  return entries
}

// --- Venue Sitemaps (ID 1+) ---
// Each sitemap contains up to VENUE_BATCH_SIZE venues WITH active deals.
// Venues with 0 deals are excluded (thin content Google won't index).

async function buildVenueSitemap(id: number): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []
  const batchIndex = id - 1 // ID 1 = batch 0, ID 2 = batch 1, etc.
  const startOffset = batchIndex * VENUE_BATCH_SIZE

  // Fetch venues in sub-batches of 200 (API max) to fill this sitemap batch
  let fetched = 0
  let offset = startOffset

  while (fetched < VENUE_BATCH_SIZE) {
    const fetchSize = Math.min(200, VENUE_BATCH_SIZE - fetched)
    // Required: a null here would read as "no more venues" and truncate the shard.
    const data = await apiFetchRequired<{
      venues: Array<{ slug: string; updated_at?: string }>
    }>(`/api/v1/venues/search?fields=slug&has_deals=true&limit=${fetchSize}&offset=${offset}`)

    const venues = data?.venues ?? []
    if (venues.length === 0) break

    for (const v of venues) {
      const lastMod = parseDate(v.updated_at)
      entries.push({
        url: `${SITE_URL}/venues/${v.slug}`,
        ...(lastMod && { lastModified: lastMod }),
        changeFrequency: "weekly",
        priority: 0.5,
      })
    }

    fetched += venues.length
    offset += fetchSize
    if (venues.length < fetchSize) break // no more results
  }

  return entries
}
