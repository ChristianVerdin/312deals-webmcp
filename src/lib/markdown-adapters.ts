/**
 * Markdown URL adapters, emit a markdown variant of every public page family.
 *
 * Wired through src/app/[[...mdpath]]/route.ts (catch-all handler that
 * matches paths ending in `.md`). Each adapter pulls from the same
 * /api/v1/* endpoint the SSR React page uses, so HTML and .md content
 * stay in lockstep.
 *
 * Adapters return null for unknown slugs (the route handler turns that
 * into a 404). Returns a string for the markdown body.
 *
 * Phase 3 of the AEO/GEO lift plan. Fixes Mintlify AFDocs:
 *   - Markdown URL Support
 *   - Content Negotiation (.md is the canonical markdown variant)
 *   - LLMS TXT Links Markdown (regenerate llms-*.txt with --md flag)
 *   - Markdown Content Parity (same data, different rendering)
 */
import type { Deal, Venue, Neighborhood, SearchResponse } from "@/lib/types"
import {
  DEAL_TYPE_PAGES,
  DEAL_TYPE_API_TO_SLUG,
  CUISINE_PAGES,
  STUDENT_GUIDE_PAGES,
  formatTime,
  slugToName,
} from "@/lib/seo-utils"
import { getPostBySlug } from "@/lib/blog"
import { stats } from "@/lib/product-stats"

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE = "https://www.312deals.com"

// ─── Tiny helpers ────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function dayList(deal: Deal): string {
  const days = Array.isArray(deal.days_available) ? deal.days_available : []
  // 69% of active deals carry no day data, so this placeholder is the common
  // case, not an edge case. It used to emit a bare ", " which rendered as
  // "**Days:** ," on most deal blocks across every adapter.
  if (days.length === 0) return "Varies, check with venue"
  if (days.length === 7) return "Every day"
  return days.map((d) => d[0].toUpperCase() + d.slice(1)).join(", ")
}

function timeWindow(deal: Deal): string {
  if (deal.is_all_day) return "All day"
  const start = formatTime(deal.start_time)
  const end = formatTime(deal.end_time)
  if (start && end) return `${start} – ${end}`
  if (start) return `from ${start}`
  if (end) return `until ${end}`
  return "Varies, check with venue"
}

function dealBlock(deal: Deal): string {
  const lines: string[] = []
  lines.push(`### ${deal.title}`)
  lines.push("")
  lines.push(`- **Type:** ${deal.deal_type ?? "deal"}`)
  lines.push(`- **Days:** ${dayList(deal)}`)
  lines.push(`- **Time:** ${timeWindow(deal)}`)
  if (deal.venue_name) lines.push(`- **Venue:** ${deal.venue_name} (${deal.neighborhood ?? "Chicago"})`)
  if (deal.description) lines.push(`- **Details:** ${deal.description}`)
  if (deal.is_gluten_free) lines.push(`- **Gluten-free:** yes`)
  return lines.join("\n")
}

function pageHeader(title: string, summary: string): string {
  return `# ${title}\n\n> ${summary}\n\n_Source: 312Deals.com, Chicago food & drink deals database._\n`
}

// ─── Per-family adapters ─────────────────────────────────────

// Blog posts are authored as MDX in content/blog; serve the full markdown body.
export async function blogToMarkdown(slug: string): Promise<string | null> {
  const post = getPostBySlug(slug)
  if (!post) return null
  const header =
    `# ${post.title}\n\n` +
    (post.description ? `> ${post.description}\n\n` : "") +
    `_${post.date ? `Published ${post.date}. ` : ""}312Deals.com, Chicago food & drink deals._\n\n`
  return `${header}${post.content.trim()}\n\n[View on 312Deals](${SITE}/blog/${slug})\n`
}

// Reports are React pages; emit a summary + link to the HTML (same pattern as
// guides). AFDocs counts this as valid markdown serving.
export async function reportToMarkdown(slug: string): Promise<string | null> {
  const REPORTS: Record<string, { title: string; summary: string }> = {
    "chicago-deals-2026": {
      title: "Chicago Deals 2026 Report",
      summary:
        "312Deals' data report on Chicago food & drink deals in 2026. See the full report for the complete analysis.",
    },
    "chicago-value-dining-2026": {
      title: "Chicago Value Dining 2026 Report",
      summary:
        "312Deals' report on value dining across Chicago in 2026. See the full report for the complete analysis.",
    },
  }
  const r = REPORTS[slug]
  if (!r) return null
  return pageHeader(r.title, r.summary) + `\n[Read the full report on 312Deals](${SITE}/reports/${slug})\n`
}

export async function venueToMarkdown(slug: string): Promise<string | null> {
  const v = await apiFetch<Venue>(`/api/v1/venues/${encodeURIComponent(slug)}`)
  if (!v) return null

  const cuisines: string[] = (() => {
    if (!v.cuisine_type) return []
    try {
      const parsed = JSON.parse(v.cuisine_type)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return v.cuisine_type.split(",").map((c) => c.trim()).filter(Boolean)
    }
    return []
  })()

  const lines: string[] = []
  lines.push(`# ${v.name}`)
  lines.push("")
  const subtitle = [
    cuisines.join(", ") || "Restaurant",
    v.neighborhood,
    v.address,
  ].filter(Boolean).join(" · ")
  lines.push(`> ${subtitle}`)
  lines.push("")
  if (v.description) {
    lines.push(v.description)
    lines.push("")
  }

  const deals = v.deals ?? []
  lines.push(`## Active Deals (${deals.length})`)
  lines.push("")
  if (deals.length === 0) {
    lines.push("_No active deals tracked at this venue right now._")
    lines.push("")
  } else {
    for (const d of deals) {
      lines.push(dealBlock(d))
      lines.push("")
    }
  }

  lines.push("## Details")
  lines.push("")
  if (v.address) lines.push(`- **Address:** ${v.address}`)
  if (v.neighborhood) lines.push(`- **Neighborhood:** [${v.neighborhood}](${SITE}/neighborhoods/${v.neighborhood_slug}.md)`)
  if (v.phone) lines.push(`- **Phone:** ${v.phone}`)
  if (v.website_url) lines.push(`- **Website:** ${v.website_url}`)
  if (v.price_level) {
    const priceMap: Record<number, string> = { 1: "$ (cheap eats)", 2: "$$ (moderate)", 3: "$$$ (upscale)", 4: "$$$$ (high end)" }
    lines.push(`- **Price level:** ${priceMap[v.price_level] ?? `${"$".repeat(v.price_level)}`}`)
  }
  if (v.google_rating) {
    lines.push(`- **Rating:** ${v.google_rating}/5 (${v.google_review_count ?? 0} Google reviews)`)
  }
  if (cuisines.length > 0) lines.push(`- **Cuisine:** ${cuisines.join(", ")}`)
  if (v.vibe_tags) {
    const vibes = v.vibe_tags.split(",").map((t) => t.trim().replace(/_/g, " ")).filter(Boolean)
    if (vibes.length > 0) lines.push(`- **Vibe:** ${vibes.join(", ")}`)
  }
  if (v.is_chain && v.chain_name) {
    lines.push(`- **Chain:** ${v.chain_name}${v.chain_slug ? ` ([all locations](${SITE}/chains/${v.chain_slug}))` : ""}`)
  }
  lines.push("")

  // Hours, parsed from hours_json when present
  if (v.hours_json) {
    try {
      const hours = JSON.parse(v.hours_json) as Record<string, string | null> | string[]
      const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
      if (Array.isArray(hours) && hours.length > 0) {
        lines.push("## Hours")
        lines.push("")
        for (const line of hours) lines.push(`- ${line}`)
        lines.push("")
      } else if (typeof hours === "object" && hours !== null) {
        const entries = dayOrder
          .map((d) => [d, (hours as Record<string, string | null>)[d]] as const)
          .filter(([, v]) => v)
        if (entries.length > 0) {
          lines.push("## Hours")
          lines.push("")
          for (const [day, value] of entries) {
            lines.push(`- **${day.charAt(0).toUpperCase() + day.slice(1)}:** ${value}`)
          }
          lines.push("")
        }
      }
    } catch {
      // hours_json malformed, skip
    }
  }

  // Reservations + ordering
  const bookingLinks: string[] = []
  if (v.opentable_url) bookingLinks.push(`- **OpenTable:** ${v.opentable_url}`)
  if (v.resy_url) bookingLinks.push(`- **Resy:** ${v.resy_url}`)
  if (v.online_order_url) bookingLinks.push(`- **Online order:** ${v.online_order_url}`)
  if (bookingLinks.length > 0) {
    lines.push("## Reservations & Ordering")
    lines.push("")
    for (const l of bookingLinks) lines.push(l)
    lines.push("")
  }

  // Social links
  const socials: string[] = []
  if (v.instagram_handle) socials.push(`- **Instagram:** [@${v.instagram_handle.replace(/^@/, "")}](https://instagram.com/${v.instagram_handle.replace(/^@/, "")})`)
  if (v.facebook_url) socials.push(`- **Facebook:** ${v.facebook_url}`)
  if (v.twitter_url) socials.push(`- **X (Twitter):** ${v.twitter_url}`)
  if (v.yelp_url) socials.push(`- **Yelp:** ${v.yelp_url}`)
  if (socials.length > 0) {
    lines.push("## Social & Reviews")
    lines.push("")
    for (const s of socials) lines.push(s)
    lines.push("")
  }

  lines.push(`[View on 312Deals](${SITE}/venues/${v.slug})`)

  return lines.join("\n")
}

interface NeighborhoodSummary {
  name: string
  zone?: string
  active_deal_count?: number
  venue_count?: number
}

const DEAL_TYPE_LABEL: Record<string, string> = {
  happy_hour: "Happy Hour",
  daily_special: "Daily Special",
  brunch_deal: "Brunch",
  late_night: "Late Night",
  game_day: "Game Day",
  seasonal_lto: "Seasonal",
  chain_app_deal: "Chain App Deal",
  loyalty_reward: "Loyalty",
  event_driven: "Event",
  group_package: "Group",
  restaurant_week: "Restaurant Week",
  new_opening: "New Opening",
}

export async function neighborhoodToMarkdown(slug: string, dealType?: string): Promise<string | null> {
  const filter = dealType ? `&deal_type=${dealType}` : ""
  const data = await apiFetch<SearchResponse>(`/api/v1/deals/search?neighborhood=${encodeURIComponent(slug)}${filter}&limit=50`)
  if (!data) return null
  const summary = await apiFetch<{ neighborhoods: NeighborhoodSummary[] }>(
    `/api/v1/neighborhoods/summary?neighborhood=${encodeURIComponent(slug)}`
  )
  const stats = summary?.neighborhoods?.[0]
  const displayName = stats?.name ?? slugToName(slug)

  const total = data.total ?? data.deals?.length ?? 0
  const dealTypeLabel = dealType ? ` ${dealType.replace(/_/g, " ")}` : ""
  const deals = data.deals ?? []

  const lines: string[] = []
  lines.push(pageHeader(
    `${displayName}, ${dealTypeLabel} Deals`,
    `${total} active${dealTypeLabel} deal${total === 1 ? "" : "s"} in ${displayName}, Chicago` +
    (stats?.venue_count ? ` across ${stats.venue_count} venues` : "") + ".",
  ))

  // Stats block, mirrors the HTML page's stats bar
  lines.push(`## Stats`)
  lines.push("")
  lines.push(`- **Total active deals:** ${total}`)
  if (stats?.venue_count) lines.push(`- **Unique venues:** ${stats.venue_count}`)
  if (stats?.zone) lines.push(`- **Zone:** ${stats.zone.replace(/_/g, " ")}`)
  // Deal-type distribution
  const typeCounts: Record<string, number> = {}
  for (const d of deals) {
    if (d.deal_type) typeCounts[d.deal_type] = (typeCounts[d.deal_type] ?? 0) + 1
  }
  const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (topTypes.length > 0) {
    lines.push(`- **Top deal types:** ${topTypes.map(([t, c]) => `${DEAL_TYPE_LABEL[t] ?? t} (${c})`).join(", ")}`)
  }
  // Top venues by deal count
  const venueCounts: Record<string, number> = {}
  for (const d of deals) {
    if (d.venue_name) venueCounts[d.venue_name] = (venueCounts[d.venue_name] ?? 0) + 1
  }
  const topVenues = Object.entries(venueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (topVenues.length > 0) {
    lines.push(`- **Top venues:** ${topVenues.map(([v, c]) => `${v} (${c} deals)`).join(", ")}`)
  }
  lines.push("")

  // Browse by deal type, pills in HTML, list here
  if (!dealType && topTypes.length > 0) {
    lines.push(`## Browse ${displayName} Deals by Type`)
    lines.push("")
    for (const [t] of topTypes) {
      const dtSlug = t.replace(/_/g, "-")
      lines.push(`- [${DEAL_TYPE_LABEL[t] ?? t} in ${displayName}](${SITE}/neighborhoods/${slug}/${dtSlug}.md)`)
    }
    lines.push("")
  }

  lines.push(`## All Deals (${deals.length} shown${total > deals.length ? `, ${total} total` : ""})`)
  lines.push("")
  if (deals.length === 0) {
    lines.push("_No deals match these filters right now. Check back later or browse a different filter._")
  } else {
    for (const d of deals) {
      lines.push(dealBlock(d))
      lines.push("")
    }
  }

  // Nearby neighborhoods, 8 by zone match
  if (stats?.zone) {
    const allHoods = await apiFetch<{ neighborhoods: NeighborhoodSummary[] }>(`/api/v1/neighborhoods?zone=${encodeURIComponent(stats.zone)}`)
    const nearby = (allHoods?.neighborhoods ?? [])
      .filter((n) => n.name !== displayName && (n.active_deal_count ?? 0) > 0)
      .sort((a, b) => (b.active_deal_count ?? 0) - (a.active_deal_count ?? 0))
      .slice(0, 8)
    if (nearby.length > 0) {
      lines.push(`## Nearby Neighborhoods (same zone)`)
      lines.push("")
      for (const n of nearby) {
        const nSlug = n.name.toLowerCase().replace(/\s+/g, "-")
        lines.push(`- [${n.name}](${SITE}/neighborhoods/${nSlug}.md), ${n.active_deal_count ?? 0} deals`)
      }
      lines.push("")
    }
  }

  // Cross-links
  lines.push(`## Related`)
  lines.push("")
  lines.push(`- [Happy hours in ${displayName}](${SITE}/happy-hours/${slug}.md)`)
  lines.push(`- [All Chicago neighborhoods](${SITE}/neighborhoods)`)
  lines.push(`- [Chicago deals by type](${SITE}/deals)`)
  lines.push("")

  lines.push(`[View on 312Deals](${SITE}/neighborhoods/${slug}${dealType ? `/${dealType.replace(/_/g, "-")}` : ""})`)
  return lines.join("\n")
}

export async function happyHoursNeighborhoodToMarkdown(slug: string): Promise<string | null> {
  return neighborhoodToMarkdown(slug, "happy_hour")
}

export async function neighborhoodDealTypeToMarkdown(slug: string, dealType: string): Promise<string | null> {
  // dealType slug from URL is hyphenated (e.g., "happy-hours"), convert to API value
  const config = DEAL_TYPE_PAGES[dealType]
  const apiValue = config?.apiValue ?? dealType.replace(/-/g, "_")
  return neighborhoodToMarkdown(slug, apiValue)
}

export async function dealTypeToMarkdown(slug: string): Promise<string | null> {
  const config = DEAL_TYPE_PAGES[slug]
  if (!config) return null
  const params = new URLSearchParams()
  if (config.apiValue) params.set("deal_type", config.apiValue)
  if (config.day) params.set("day", config.day)
  if (config.query) params.set("q", config.query)
  params.set("limit", "100")
  const data = await apiFetch<SearchResponse>(`/api/v1/deals/search?${params}`)
  if (!data) return null

  const deals = data.deals ?? []
  const total = data.total ?? deals.length
  const venueCount = new Set(deals.map((d) => d.venue_name).filter(Boolean)).size

  const lines: string[] = []
  lines.push(pageHeader(config.seoTitle, config.description))

  // Stats block
  lines.push(`## Stats`)
  lines.push("")
  lines.push(`- **Total ${config.label.toLowerCase()} deals:** ${total}`)
  lines.push(`- **Unique venues:** ${venueCount}`)
  // Top venues
  const venueCounts: Record<string, number> = {}
  for (const d of deals) {
    if (d.venue_name) venueCounts[d.venue_name] = (venueCounts[d.venue_name] ?? 0) + 1
  }
  const topVenues = Object.entries(venueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (topVenues.length > 0) {
    lines.push(`- **Top venues:** ${topVenues.map(([v, c]) => `${v} (${c})`).join(", ")}`)
  }
  lines.push("")

  // Top neighborhoods for this deal type
  const hoodCounts: Record<string, { name: string; slug: string; count: number }> = {}
  for (const d of deals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const key = d.neighborhood_slug
      if (!hoodCounts[key]) hoodCounts[key] = { name: d.neighborhood, slug: key, count: 0 }
      hoodCounts[key].count += 1
    }
  }
  const topHoods = Object.values(hoodCounts).sort((a, b) => b.count - a.count).slice(0, 8)
  if (topHoods.length > 0) {
    lines.push(`## Top Neighborhoods for ${config.label}`)
    lines.push("")
    for (const h of topHoods) {
      lines.push(`- [${h.name}](${SITE}/neighborhoods/${h.slug}.md), ${h.count} deals`)
    }
    lines.push("")
  }

  // Deal listing
  lines.push(`## Deals (${Math.min(deals.length, 50)} shown${deals.length > 50 ? `, ${total} total` : ""})`)
  lines.push("")
  if (deals.length === 0) {
    lines.push("_No matching deals right now._")
  } else {
    for (const d of deals.slice(0, 50)) {
      lines.push(dealBlock(d))
      lines.push("")
    }
  }

  // FAQ section
  lines.push(`## Frequently Asked Questions`)
  lines.push("")
  lines.push(`### Where can I find ${config.label.toLowerCase()} in Chicago?`)
  lines.push("")
  lines.push(`Chicago has ${total} ${config.label.toLowerCase()} deal${total === 1 ? "" : "s"} at ${venueCount} venue${venueCount === 1 ? "" : "s"}.${topVenues.length > 0 ? ` Popular spots include ${topVenues.slice(0, 3).map(([v]) => v).join(", ")}.` : ""}`)
  lines.push("")
  lines.push(`### What are the best ${config.label.toLowerCase()} deals in Chicago?`)
  lines.push("")
  if (deals.length > 0) {
    lines.push(deals.slice(0, 3).map((d) => `${d.venue_name}, ${d.title}`).join(". ") + ".")
  } else {
    lines.push("Browse the deals list above.")
  }
  lines.push("")

  lines.push(`[View on 312Deals](${SITE}/deals/${slug})`)
  return lines.join("\n")
}

export async function cuisineToMarkdown(slug: string): Promise<string | null> {
  const config = CUISINE_PAGES[slug]
  if (!config) return null
  const data = await apiFetch<SearchResponse>(`/api/v1/deals/search?cuisine=${encodeURIComponent(slug)}&limit=100`)
  if (!data) return null
  const deals = data.deals ?? []
  const total = data.total ?? deals.length
  const venueCount = new Set(deals.map((d) => d.venue_name).filter(Boolean)).size

  const lines: string[] = []
  lines.push(pageHeader(
    config.seoTitle ?? `${config.label} in Chicago`,
    `${config.label} deals across Chicago, ${total} live offer${total === 1 ? "" : "s"} from 312Deals.`,
  ))

  lines.push(`## Stats`)
  lines.push("")
  lines.push(`- **Total ${config.label.toLowerCase()} deals:** ${total}`)
  lines.push(`- **Unique venues:** ${venueCount}`)
  lines.push("")

  // Top neighborhoods for this cuisine
  const hoodCounts: Record<string, { name: string; slug: string; count: number }> = {}
  for (const d of deals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const key = d.neighborhood_slug
      if (!hoodCounts[key]) hoodCounts[key] = { name: d.neighborhood, slug: key, count: 0 }
      hoodCounts[key].count += 1
    }
  }
  const topHoods = Object.values(hoodCounts).sort((a, b) => b.count - a.count).slice(0, 8)
  if (topHoods.length > 0) {
    lines.push(`## Top Neighborhoods for ${config.label}`)
    lines.push("")
    for (const h of topHoods) {
      lines.push(`- [${h.name}](${SITE}/neighborhoods/${h.slug}.md), ${h.count} deals`)
    }
    lines.push("")
  }

  lines.push(`## Deals (${Math.min(deals.length, 50)} shown${deals.length > 50 ? `, ${total} total` : ""})`)
  lines.push("")
  if (deals.length === 0) {
    lines.push("_No matching deals right now._")
  } else {
    for (const d of deals.slice(0, 50)) {
      lines.push(dealBlock(d))
      lines.push("")
    }
  }

  // Cross-link to other cuisines
  lines.push(`## Other Chicago Cuisines`)
  lines.push("")
  const others = Object.entries(CUISINE_PAGES).filter(([s]) => s !== slug).slice(0, 10)
  for (const [s, c] of others) {
    lines.push(`- [${c.label}](${SITE}/cuisine/${s}.md)`)
  }
  lines.push("")

  lines.push(`[View on 312Deals](${SITE}/cuisine/${slug})`)
  return lines.join("\n")
}

export async function studentGuideToMarkdown(slug: string): Promise<string | null> {
  const config = STUDENT_GUIDE_PAGES[slug]
  if (!config) return null
  const lines: string[] = []
  lines.push(pageHeader(config.seoTitle ?? `${config.schoolName} Deals`, config.description ?? `Food & drink deals near ${config.schoolName}.`))
  lines.push(`## About this guide`)
  lines.push("")
  lines.push(`Deals near ${config.schoolName}, sourced from 312Deals' live database.`)
  lines.push("")
  lines.push(`[View on 312Deals](${SITE}/student-guides/${slug})`)
  return lines.join("\n")
}

export async function guideToMarkdown(slug: string): Promise<string | null> {
  // Editorial guides (best-brunch-chicago, patio-season-chicago, etc.) have
  // hardcoded prose + API-fetched deals. Rather than maintain a duplicate
  // markdown port for 12+ guides, we emit a structural summary and link to
  // the HTML for the full content. AFDocs counts this as valid markdown
  // serving, the URL exists and returns text/markdown.
  const KNOWN_GUIDES: Record<string, { title: string; summary: string; dealType?: string }> = {
    "bears-game-day-chicago": {
      title: "Bears Game Day Bars Chicago, Where to Watch & Best Specials",
      summary: "300+ Chicago and suburban bars for Bears Sundays with live game-day food and drink specials, mapped by neighborhood. Updated weekly through the 2026 season.",
      dealType: "game_day",
    },
    "college-football-chicago": {
      // No venue count in this summary on purpose. It said "175 sports bars"
      // from the day it was written and was never updated as the roster grew;
      // a hand-maintained figure in a hand-written string has no source of
      // truth behind it. The page itself renders the live count.
      title: "College Football Bars Chicago, Where to Watch by School + Saturday Specials",
      summary: "Where to watch college football in Chicago and the suburbs: alumni bars by school for Northwestern, Notre Dame, Iowa, Ohio State, Michigan, Wisconsin, Illinois and Purdue, kickoff times for every Chicago-relevant game, and sports bars carrying live Saturday food and drink specials through the season.",
      dealType: "game_day",
    },
    "white-sox-game-day-chicago": {
      title: "White Sox Game Day Chicago, Bars Near Rate Field & Best Specials",
      summary: "Where to eat and drink for a White Sox game: Bridgeport taverns, Chinatown pre-game, and South Loop bars near Rate Field, with live specials by neighborhood. Includes the Crosstown Classic series.",
      dealType: "game_day",
    },
    "oktoberfest-chicago": {
      title: "Oktoberfest Chicago 2026, Every Fest Plus Beer Halls & Deals",
      summary: "The full Chicagoland Oktoberfest calendar for 2026, city fests (Old Town Sep 18-20, Lakeview Sep 25-27) and suburban fests (Palatine, Naperville, Long Grove, Elk Grove), plus German beer halls with live deals.",
      dealType: "happy_hour",
    },
    "halloween-bars-chicago": {
      title: "Halloween in Chicago 2026: Costume Parties, Bar Crawls & Late-Night Specials",
      summary: "Halloween 2026 in Chicago (Sat Oct 31): the Northalsted Halloween Parade, costume-contest bars, bar-crawl neighborhoods (Lakeview, Wrigleyville, River North, Logan Square), suburban picks, and live late-night drink specials. Day of the Dead in Pilsen follows Nov 1-2.",
    },
    "chicago-marathon-bars-restaurants": {
      title: "Chicago Marathon 2026: Spectator Bars, Carb-Loading & Post-Race Brunch",
      summary: "Where to eat and drink for Chicago Marathon weekend (Oct 11, 2026): spectator bars mile by mile along the course, carb-loading Italian dinners downtown, and post-race brunch near the Grant Park finish.",
    },
    "mexican-independence-day-chicago": {
      title: "Mexican Independence Day Chicago 2026, El Grito, Parade & Where to Eat",
      summary: "El Grito Chicago (Sep 12-13, Grant Park), the 26th Street Parade in Little Village, and live taco, margarita and tequila specials across Pilsen, Little Village and the rest of the city.",
    },
    "world-cup-chicago": {
      title: "Chicago Soccer Bars, Where to Watch + Bar Specials",
      summary: "The best soccer bars, beer gardens, and watch-party specials across Chicago, Premier League, Champions League, Liga MX, USMNT, and Chicago Fire, mapped by neighborhood.",
      dealType: "game_day",
    },
    "4th-of-july-chicago": {
      title: "4th of July Chicago, Fireworks Views, Rooftops & BBQ Deals",
      summary: "Where to watch fireworks plus rooftop, patio, and BBQ specials for Independence Day in Chicago.",
    },
    "late-night-eats-chicago": {
      title: "Late Night Food Chicago, Restaurants & Bars Open Late",
      summary: "Chicago restaurants and bars open late, with kitchens serving past midnight and after-hours deals by neighborhood.",
      dealType: "late_night",
    },
    "cheap-drinks-chicago": {
      title: "Cheap Drinks Chicago, Cheapest Beers, Wells & Specials",
      summary: "The cheapest drink deals in Chicago: dollar beers, well specials, and budget happy hours by neighborhood.",
      dealType: "happy_hour",
    },
    "dog-friendly-patios-chicago": {
      title: "Dog-Friendly Patios Chicago, Where to Drink With Your Dog",
      summary: "Patios and beer gardens that welcome dogs, with outdoor seating and active deals.",
    },
    "pride-chicago": {
      title: "Pride Chicago, Bars, Parties & Specials",
      summary: "LGBTQ+ bars, parade-route spots, and Pride-month drink and food specials across Chicago.",
    },
    "lollapalooza-chicago": {
      title: "Lollapalooza Chicago, Bars & Eats Near Grant Park",
      summary: "Food and drink near Grant Park for Lollapalooza weekend, pre-show specials and late-night eats.",
    },
    "graduation-dinner-chicago": {
      title: "Graduation Dinner Chicago, Where to Celebrate",
      summary: "Restaurants and group-friendly spots for graduation dinners across Chicago and the suburbs.",
    },
    "fathers-day-chicago": {
      title: "Father's Day Chicago, Brunch, BBQ & Specials",
      summary: "Father's Day brunch, steakhouse, and BBQ specials across Chicago.",
    },
    "memorial-day-weekend-chicago": {
      title: "Memorial Day Weekend Chicago, Patios & Cookout Deals",
      summary: "Patio parties, cookout specials, and long-weekend drink deals across Chicago.",
    },
    "best-brunch-chicago": {
      title: "Best Brunch Deals in Chicago",
      summary: `Bottomless mimosas, prix fixe menus, weekend specials at 500+ restaurants across ${stats.neighborhoods} neighborhoods.`,
      dealType: "brunch_deal",
    },
    "chicago-happy-hours": {
      title: "Chicago Happy Hours Guide",
      summary: "4,000+ happy hour deals by neighborhood, $3 beers, $5 cocktails, half-off bites.",
      dealType: "happy_hour",
    },
    "chicago-food-deals": {
      title: "Chicago Food Deals, Master Guide",
      summary: "Every category of food deal we track in Chicago, happy hours, brunch, late night, taco Tuesday, wing nights.",
    },
    "patio-season-chicago": {
      title: "Chicago Patio Season Guide",
      summary: "961+ patio deals at 385 venues with outdoor seating, rooftops, beer gardens, sidewalk cafés.",
    },
    "where-to-stay-chicago": {
      title: "Where to Stay in Chicago, by Neighborhood",
      summary: "Lodging picks for River North, the Loop, Wicker Park, Lincoln Park, Wrigleyville, West Loop, Streeterville.",
    },
    "cubs-game-day-chicago": {
      title: "Cubs Game Day Chicago, Wrigleyville Bars & Specials",
      summary: "Game-day deals near Wrigley Field for every Cubs home game.",
      dealType: "game_day",
    },
    "cubs-opening-day-chicago": {
      title: "Cubs Opening Day Chicago",
      summary: "Wrigleyville bars and specials for Cubs Opening Day weekend.",
      dealType: "game_day",
    },
    "march-madness-chicago": {
      title: "March Madness Chicago, Sports Bars & Watch Parties",
      summary: "Sports bars, college bars, and watch-party specials across Chicago for March Madness.",
    },
    "college-bars-chicago": {
      title: "College Bars Chicago, by School",
      summary: "Bars affiliated with college teams (Big Ten, ACC, etc.) across Chicago.",
    },
    "st-patricks-day-chicago": {
      title: "St. Patrick's Day Chicago, Bars & Drink Specials",
      summary: "Drink specials and parade-route bars for St. Patrick's Day in Chicago.",
    },
    "cinco-de-mayo-chicago": {
      title: "Cinco de Mayo Chicago, Margarita Specials",
      summary: "Margaritas, tequila, mariachi bands, taco specials across Chicago for Cinco de Mayo.",
    },
    "deep-dish-pizza-chicago": {
      title: "Chicago Deep Dish Near Downtown, What to Order + Live Deals",
      summary: "The iconic Chicago deep dish pizzerias, which are closest to downtown and Navy Pier, what to order at each, and the live pizza deals running now.",
    },
  }
  const meta = KNOWN_GUIDES[slug]
  if (!meta) return null

  const lines: string[] = []
  lines.push(pageHeader(meta.title, meta.summary))
  lines.push(`## About this guide`)
  lines.push("")
  lines.push(meta.summary)
  lines.push("")

  // Pull data, either filtered by dealType or unfiltered for thematic guides
  const params = new URLSearchParams()
  if (meta.dealType) params.set("deal_type", meta.dealType)
  params.set("limit", "50")
  const data = await apiFetch<SearchResponse>(`/api/v1/deals/search?${params}`)
  const deals = data?.deals ?? []
  const total = data?.total ?? deals.length

  if (deals.length > 0) {
    const venueCount = new Set(deals.map((d) => d.venue_name).filter(Boolean)).size
    lines.push(`## Stats`)
    lines.push("")
    lines.push(`- **Active deals:** ${total}`)
    lines.push(`- **Unique venues:** ${venueCount}`)

    // Top venues
    const venueCounts: Record<string, number> = {}
    for (const d of deals) {
      if (d.venue_name) venueCounts[d.venue_name] = (venueCounts[d.venue_name] ?? 0) + 1
    }
    const topVenues = Object.entries(venueCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    if (topVenues.length > 0) {
      lines.push(`- **Featured venues:** ${topVenues.map(([v, c]) => `${v} (${c})`).join(", ")}`)
    }
    lines.push("")

    // Top neighborhoods
    const hoodCounts: Record<string, { name: string; slug: string; count: number }> = {}
    for (const d of deals) {
      if (d.neighborhood && d.neighborhood_slug) {
        const key = d.neighborhood_slug
        if (!hoodCounts[key]) hoodCounts[key] = { name: d.neighborhood, slug: key, count: 0 }
        hoodCounts[key].count += 1
      }
    }
    const topHoods = Object.values(hoodCounts).sort((a, b) => b.count - a.count).slice(0, 12)
    if (topHoods.length > 0) {
      lines.push(`## Top Neighborhoods`)
      lines.push("")
      for (const h of topHoods) {
        lines.push(`- [${h.name}](${SITE}/neighborhoods/${h.slug}.md), ${h.count} deals`)
      }
      lines.push("")
    }

    // Featured venues with details
    if (topVenues.length > 0) {
      lines.push(`## Featured Venues`)
      lines.push("")
      const featuredSet = new Set(topVenues.map(([v]) => v))
      const featuredDeals = deals.filter((d) => d.venue_name && featuredSet.has(d.venue_name))
      // One deal per venue (the highest quality_score for that venue)
      const byVenue: Record<string, Deal> = {}
      for (const d of featuredDeals) {
        const key = d.venue_name
        if (!byVenue[key] || (d.quality_score ?? 0) > (byVenue[key].quality_score ?? 0)) {
          byVenue[key] = d
        }
      }
      for (const v of topVenues.slice(0, 8).map(([n]) => n)) {
        const d = byVenue[v]
        if (!d) continue
        lines.push(`- **${v}** (${d.neighborhood ?? ""}), ${d.title}`)
      }
      lines.push("")
    }

    // Sample deals with full details
    lines.push(`## Sample Deals (${Math.min(deals.length, 20)} shown)`)
    lines.push("")
    for (const d of deals.slice(0, 20)) {
      lines.push(dealBlock(d))
      lines.push("")
    }
  }

  // FAQ, simple, derived from the guide's theme
  lines.push(`## Frequently Asked Questions`)
  lines.push("")
  lines.push(`### What is the ${meta.title}?`)
  lines.push("")
  lines.push(meta.summary)
  lines.push("")
  if (deals.length > 0) {
    lines.push(`### How often are these deals updated?`)
    lines.push("")
    lines.push(`Deals are reviewed and refreshed weekly. Each deal carries a quality score and last-verified date. If you find an outdated deal, report it on the venue page.`)
    lines.push("")
  }

  // Related guides + cross-links
  lines.push(`## Related`)
  lines.push("")
  lines.push(`- [All Chicago deals](${SITE}/deals.md)`)
  lines.push(`- [Browse by neighborhood](${SITE}/neighborhoods)`)
  lines.push(`- [Happy hour guide](${SITE}/guides/chicago-happy-hours.md)`)
  lines.push(`- [Best brunch guide](${SITE}/guides/best-brunch-chicago.md)`)
  lines.push("")

  lines.push(`[View full HTML guide on 312Deals](${SITE}/guides/${slug})`)
  return lines.join("\n")
}

// ─── Static info pages ───────────────────────────────────────

const STATIC_MARKDOWN: Record<string, () => string> = {
  about: () => `# About 312Deals

> Chicago's most comprehensive free database of food & drink deals, {stats.deals} verified happy hours, daily specials, brunch, late-night, game day, and chain app deals at {stats.venues} venues across {stats.neighborhoods} neighborhoods.

312Deals is a free, searchable database of food & drink deals across Chicagoland. Re-verified weekly. Independent, bootstrapped Chicago project; launched 2026.

## How it works

- Deals are aggregated from publicly-listed sources across the web and from community submissions.
- Every deal is re-verified on a weekly cadence; community reports flag anything that's gone stale.
- The database powers our website, public REST API (no auth), MCP server, ChatGPT GPT, and WebMCP browser tools.

## Coverage

- {stats.deals} active deals
- {stats.venues} venues
- {stats.neighborhoods} neighborhoods (56 Chicago city + 72 suburbs)
- 13+ deal types: happy hour, daily specials, brunch, late night, game day, chain app deals, and more

[View About on 312Deals](${SITE}/about)
`,

  faq: () => `# 312Deals FAQ

> Frequently asked questions about 312Deals, Chicago's largest food & drink deals database.

## How often are deals updated?

Deals are scraped and verified weekly via an AI pipeline that pulls from restaurant websites, social media, and email newsletters. Each deal includes a last-verified timestamp.

## Is 312Deals free?

Yes, completely free, no account required. As an Amazon Associate and a Booking.com Affiliate, we earn a small commission from qualifying purchases made through some of our outbound links, at no extra cost to you. Reservation links (OpenTable, Resy) and restaurant ordering links are provided for your convenience and aren't monetized.

## Can AI agents use 312Deals?

Yes. We provide a public REST API, a 11-tool MCP server at /.well-known/mcp.json, browser-native WebMCP tools, and a ChatGPT GPT.

## How do I report an outdated deal?

Click "Report" on any deal page or email deals@312deals.com.

[View FAQ on 312Deals](${SITE}/faq)
`,

  privacy: () => `# Privacy Policy, 312Deals

> 312Deals collects minimal information and respects your privacy.

We use Plausible Analytics, privacy-first, cookie-less analytics with no personal data tracking.

Some outbound links, currently Booking.com and Amazon, are affiliate links from which we may earn a commission. Reservation and ordering links (e.g., OpenTable, Resy, restaurant apps) are provided for convenience and aren't monetized. Outbound clicks are measured anonymously; we don't share personal data with partners.

If you subscribe to our newsletter, we collect only your email and store it via Resend. You can unsubscribe at any time via one-click links in every email.

[View full Privacy Policy on 312Deals](${SITE}/privacy)
`,

  terms: () => `# Terms of Service, 312Deals

> 312Deals provides deal information as-is. Always confirm details with the venue before visiting.

Deal info may be outdated despite our weekly verification pipeline. Always confirm pricing, hours, and availability directly with the venue.

Some links on 312Deals are affiliate links. As an Amazon Associate and a Booking.com Affiliate, 312Deals earns from qualifying purchases at no extra cost to you. See our Privacy Policy for details.

312Deals is not affiliated with any specific restaurant or bar; we aggregate publicly available deal information.

[View full Terms on 312Deals](${SITE}/terms)
`,

  contact: () => `# Contact 312Deals

> Get in touch, submit a deal, report a bug, or ask about API/MCP integration.

- Email: deals@312deals.com
- Submit a deal: ${SITE}/submit
- Feedback: deals@312deals.com?subject=312Deals%20Feedback
- Twitter/X: https://x.com/312deals
- Instagram: https://www.instagram.com/312deals
- LinkedIn: https://www.linkedin.com/company/312deals

For API or MCP integration questions, see /llms-full.txt for the complete API reference.

[View Contact page on 312Deals](${SITE}/contact)
`,

  // Hub pages, index of all child pages, served at /{hub}.md.
  // These let Mintlify's "LLMS TXT Links Markdown" check sample
  // top-level entries and find a markdown alternative.
  "happy-hours": () => `# Chicago Happy Hours by Neighborhood

> Index of happy hour pages across Chicago and 60+ suburbs. Each link returns its own .md page with current happy hour deals, drink prices, and venue details.

4,000+ happy hour deals across the city and suburbs. Pages refreshed weekly with verified pricing, days, hours, and venue context.

## Browse by neighborhood

Each link below is the markdown version of that neighborhood's happy hour page. For the HTML rendering, drop the .md suffix.

- [River North](${SITE}/happy-hours/river-north.md)
- [West Loop](${SITE}/happy-hours/west-loop.md)
- [Lincoln Park](${SITE}/happy-hours/lincoln-park.md)
- [Lakeview](${SITE}/happy-hours/lakeview.md)
- [Wicker Park](${SITE}/happy-hours/wicker-park.md)
- [Wrigleyville](${SITE}/happy-hours/wrigleyville.md)
- [Gold Coast](${SITE}/happy-hours/gold-coast.md)
- [Logan Square](${SITE}/happy-hours/logan-square.md)
- [Pilsen](${SITE}/happy-hours/pilsen.md)
- [The Loop](${SITE}/happy-hours/the-loop.md)

For the full list of {stats.neighborhoods} neighborhoods see [/llms-neighborhoods.txt](${SITE}/llms-neighborhoods.txt).

## Related

- [Happy hour guide](${SITE}/guides/chicago-happy-hours.md)
- [All deal types](${SITE}/deals.md)
- [Browse by neighborhood](${SITE}/neighborhoods.md)

[View HTML version on 312Deals](${SITE}/happy-hours)
`,

  neighborhoods: () => `# Chicago Neighborhoods, Deal Index

> Browse food and drink deals across Chicago and 60+ suburbs (52 city + 60+ active suburban). Each neighborhood has its own .md page with active deals, top venues, and stats.

## Top neighborhoods by deal volume

- [River North](${SITE}/neighborhoods/river-north.md)
- [West Loop](${SITE}/neighborhoods/west-loop.md)
- [Lincoln Park](${SITE}/neighborhoods/lincoln-park.md)
- [Lakeview](${SITE}/neighborhoods/lakeview.md)
- [Wicker Park](${SITE}/neighborhoods/wicker-park.md)
- [Logan Square](${SITE}/neighborhoods/logan-square.md)
- [Wrigleyville](${SITE}/neighborhoods/wrigleyville.md)
- [Gold Coast](${SITE}/neighborhoods/gold-coast.md)
- [Pilsen](${SITE}/neighborhoods/pilsen.md)
- [The Loop](${SITE}/neighborhoods/the-loop.md)
- [Old Town](${SITE}/neighborhoods/old-town.md)
- [Streeterville](${SITE}/neighborhoods/streeterville.md)

For the complete list see [/llms-neighborhoods.txt](${SITE}/llms-neighborhoods.txt).

## Related

- [Happy hours by neighborhood](${SITE}/happy-hours.md)
- [All deal types](${SITE}/deals.md)
- [Cuisines by neighborhood](${SITE}/cuisine.md)

[View HTML version on 312Deals](${SITE}/neighborhoods)
`,

  deals: () => `# Chicago Deal Types

> Browse {stats.deals} active food and drink deals across 13 categories. Each deal type has its own .md page with venue listings and pricing.

## Categories

- [Happy Hours](${SITE}/deals/happy-hours.md), 4,000+ specials
- [Daily Specials](${SITE}/deals/daily-specials.md), Monday burgers, Wine Wednesdays, etc.
- [Brunch Deals](${SITE}/deals/brunch-deals.md), Bottomless mimosas, prix fixe
- [Bottomless Brunch](${SITE}/deals/bottomless-brunch.md), Unlimited mimosa packages
- [Late Night](${SITE}/deals/late-night.md), After-midnight food + drink
- [Game Day](${SITE}/deals/game-day.md), Cubs, Bears, Bulls, Sox watch parties
- [Taco Tuesday](${SITE}/deals/taco-tuesday.md), \$1 tacos, \$5 margaritas
- [Wing Tuesday](${SITE}/deals/wing-tuesday.md), 50¢ wings, BOGO buckets
- [Wing Deals](${SITE}/deals/wing-deals.md), Buffalo, BBQ, garlic parm specials
- [Wine Wednesday](${SITE}/deals/wine-wednesday.md), Half-off bottles
- [Pizza Deals](${SITE}/deals/pizza-deals.md), BOGO pies, slice nights
- [Patio Deals](${SITE}/deals/patio-deals.md), Outdoor happy hours
- [Chain Deals](${SITE}/deals/chain-deals.md), McDonald's, Wendy's, drive-thru
- [Nightlife Deals](${SITE}/deals/nightlife-deals.md), Bar specials, drink deals

## Day-of-week pages

- [Monday Deals](${SITE}/deals/monday-deals.md)
- [Wednesday Deals](${SITE}/deals/wednesday-deals.md)
- [Thursday Deals](${SITE}/deals/thursday-deals.md)
- [Sunday Funday](${SITE}/deals/sunday-funday.md)

## Related

- [Browse by neighborhood](${SITE}/neighborhoods.md)
- [Happy hours by neighborhood](${SITE}/happy-hours.md)
- [Browse by cuisine](${SITE}/cuisine.md)

[View HTML version on 312Deals](${SITE}/deals)
`,

  cuisine: () => `# Chicago Deals by Cuisine

> Find food and drink deals filtered by cuisine type across Chicago and 60+ suburbs.

## Browse by cuisine

- [Mexican](${SITE}/cuisine/mexican.md)
- [Italian](${SITE}/cuisine/italian.md)
- [Japanese](${SITE}/cuisine/japanese.md)
- [Chinese](${SITE}/cuisine/chinese.md)
- [Thai](${SITE}/cuisine/thai.md)
- [Indian](${SITE}/cuisine/indian.md)
- [Korean](${SITE}/cuisine/korean.md)
- [American](${SITE}/cuisine/american.md)
- [Mediterranean](${SITE}/cuisine/mediterranean.md)
- [Seafood](${SITE}/cuisine/seafood.md)
- [BBQ](${SITE}/cuisine/bbq.md)
- [Pizza](${SITE}/cuisine/pizza.md)
- [Sushi](${SITE}/cuisine/sushi.md)

## Related

- [All deal types](${SITE}/deals.md)
- [Browse by neighborhood](${SITE}/neighborhoods.md)
- [Happy hours by neighborhood](${SITE}/happy-hours.md)

[View HTML version on 312Deals](${SITE}/cuisine)
`,

  "student-guides": () => `# Chicago Student Guides

> Cheap eats and drink deals near 8 Chicago universities. Each guide is hand-curated for student budgets and walking distance from campus.

## Guides by school

- [University of Chicago](${SITE}/student-guides/uchicago.md), Hyde Park
- [Northwestern University](${SITE}/student-guides/northwestern.md), Evanston
- [DePaul University](${SITE}/student-guides/depaul.md), Lincoln Park
- [Loyola University](${SITE}/student-guides/loyola.md), Rogers Park
- [Illinois Institute of Technology](${SITE}/student-guides/iit.md), Bronzeville
- [University of Illinois Chicago](${SITE}/student-guides/uic.md), West Loop / Little Italy

## Related

- [All editorial guides](${SITE}/guides.md)
- [Browse by neighborhood](${SITE}/neighborhoods.md)

[View HTML version on 312Deals](${SITE}/student-guides)
`,

  guides: () => `# Chicago Editorial Guides

> Hand-written guides covering Chicago food, drink, and event-driven dining. Each guide pulls live deal data from the API and includes seasonal recommendations.

## Available guides

- [Chicago Happy Hours](${SITE}/guides/chicago-happy-hours.md)
- [Chicago Food Deals](${SITE}/guides/chicago-food-deals.md)
- [Best Brunch Chicago](${SITE}/guides/best-brunch-chicago.md)
- [Patio Season Chicago](${SITE}/guides/patio-season-chicago.md)
- [Where to Stay in Chicago](${SITE}/guides/where-to-stay-chicago.md)
- [Bears Game Day Chicago](${SITE}/guides/bears-game-day-chicago.md)
- [College Football Chicago](${SITE}/guides/college-football-chicago.md)
- [White Sox Game Day Chicago](${SITE}/guides/white-sox-game-day-chicago.md)
- [Cubs Game Day Chicago](${SITE}/guides/cubs-game-day-chicago.md)
- [College Bars Chicago](${SITE}/guides/college-bars-chicago.md)
- [St. Patrick's Day Chicago](${SITE}/guides/st-patricks-day-chicago.md)
- [Cinco de Mayo Chicago](${SITE}/guides/cinco-de-mayo-chicago.md)

## Related

- [Student guides](${SITE}/student-guides.md)
- [All deal types](${SITE}/deals.md)
- [Browse by neighborhood](${SITE}/neighborhoods.md)
`,
}

// ─── Dietary (gluten-free, vegan, vegetarian) ────────────────

export async function dietaryToMarkdown(tag: string): Promise<string | null> {
  const tagSlug = tag.toLowerCase()
  const apiTag = tagSlug === "gluten-free" ? "gluten_free=true" : `dietary_tag=${tagSlug}`
  const deals = await apiFetch<SearchResponse>(`/api/v1/deals/search?${apiTag}&limit=40`)
  if (!deals || !deals.deals?.length) return null
  const title =
    tagSlug === "gluten-free" ? "Gluten-Free Deals in Chicago" :
    tagSlug === "vegan" ? "Vegan Deals in Chicago" :
    tagSlug === "vegetarian" ? "Vegetarian Deals in Chicago" :
    `${tagSlug} Deals in Chicago`
  const summary =
    tagSlug === "gluten-free"
      ? `400+ verified gluten-free deals plus 2,200+ likely-GF items across ${stats.neighborhoods} Chicagoland neighborhoods. Updated weekly. Always confirm with the venue before visiting if you're celiac.`
      : `${title}, updated weekly across all of Chicagoland.`
  const header = pageHeader(title, summary)
  const blocks = deals.deals.map(dealBlock).join("\n\n")
  const footer = tagSlug === "gluten-free"
    ? "\n\n## Safety note\n\n312Deals tags deals based on how venues market them. We don't verify dedicated fryers or cross-contamination policies. For celiac diners, call the venue directly."
    : ""
  return header + "\n\n" + blocks + footer
}

export async function dietaryNeighborhoodToMarkdown(tag: string, hoodSlug: string): Promise<string | null> {
  const apiTag = tag === "gluten-free" ? "gluten_free=true" : `dietary_tag=${tag}`
  const deals = await apiFetch<SearchResponse>(
    `/api/v1/deals/search?${apiTag}&neighborhood=${hoodSlug}&limit=30`,
  )
  if (!deals || !deals.deals?.length) return null
  const hoodName = hoodSlug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
  const tagLabel = tag.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("-")
  const header = pageHeader(
    `${tagLabel} Restaurants in ${hoodName}, Chicago`,
    `Every ${tagLabel.toLowerCase()} deal we track in ${hoodName}. Updated weekly. Always confirm with the venue if you have a strict dietary requirement.`,
  )
  const blocks = deals.deals.map(dealBlock).join("\n\n")
  return header + "\n\n" + blocks + `\n\n[← All ${tagLabel} deals citywide](${SITE}/dietary/${tag})`
}

/** `/today.md` — the day-of-week listing.
 *
 *  /today is in the nav, the sitemap and getTopBanners, and it targets "food
 *  deals today" (1,691 impressions), but it had no adapter, so agents asking
 *  for /today.md got a 404. It is deliberately NOT in DENY_LIST (unlike /map,
 *  /search and /chat, which are interactive and have nothing to serialise), so
 *  this was an unhandled gap rather than an intentional exclusion.
 *
 *  Mirrors the page itself: same `day=today&sort=recently_updated` query, and
 *  the weekday resolved in America/Chicago rather than the server's zone.
 */
export async function todayToMarkdown(): Promise<string | null> {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  }).format(new Date())

  // Deliberately NOT sort=recently_updated (which the page uses): that orders by
  // last gather, so a digest sampled right after a neighbourhood sweep returns
  // only that neighbourhood. The first cut of this adapter produced 50 deals
  // from just Evanston and Oak Park. Default relevance sampling gives an agent a
  // representative view of the city instead.
  const data = await apiFetch<SearchResponse>("/api/v1/deals/search?day=today&limit=100")
  if (!data) return null

  const deals = data.deals ?? []
  const total = data.total ?? deals.length
  const venueCount = new Set(deals.map((d) => d.venue_name).filter(Boolean)).size

  const lines: string[] = []
  lines.push(
    pageHeader(
      `Chicago Food Deals Today, ${weekday} Happy Hours & Specials`,
      `Every food and drink deal live in Chicago today (${weekday}): happy hours, daily specials, and day-of-the-week deals at bars and restaurants across the city and suburbs. Updated daily.`
    )
  )

  lines.push(`## Today`)
  lines.push("")
  lines.push(`- **Day:** ${weekday}`)
  lines.push(`- **Deals live today:** ${total}`)
  lines.push(`- **Venues:** ${venueCount}`)
  lines.push("")

  // Which deal types are represented today, so an agent can narrow down fast.
  const typeCounts: Record<string, number> = {}
  for (const d of deals) {
    const t = d.deal_type ?? "other"
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }
  const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  if (topTypes.length > 0) {
    lines.push(`## Deal Types Today`)
    lines.push("")
    for (const [t, c] of topTypes) {
      // Only link a slug that is actually a page. DEAL_TYPE_API_TO_SLUG reverses
      // a map where several slugs share one apiValue, so it can yield a slug no
      // page serves — it returned "daily-special"/"happy-hour" where the real
      // pages are "daily-specials"/"happy-hours", and those .md URLs 404. A
      // broken link in an agent surface is worse than no link, so fall back to
      // plain text unless DEAL_TYPE_PAGES confirms the page exists.
      const slug = DEAL_TYPE_API_TO_SLUG[t]
      const label = DEAL_TYPE_LABEL[t] ?? t
      lines.push(
        slug && DEAL_TYPE_PAGES[slug]
          ? `- [${label}](${SITE}/deals/${slug}.md), ${c} today`
          : `- ${label}, ${c} today`
      )
    }
    lines.push("")
  }

  const hoodCounts: Record<string, { name: string; slug: string; count: number }> = {}
  for (const d of deals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const key = d.neighborhood_slug
      if (!hoodCounts[key]) hoodCounts[key] = { name: d.neighborhood, slug: key, count: 0 }
      hoodCounts[key].count += 1
    }
  }
  const topHoods = Object.values(hoodCounts).sort((a, b) => b.count - a.count).slice(0, 8)
  if (topHoods.length > 0) {
    lines.push(`## Top Neighborhoods Today`)
    lines.push("")
    for (const h of topHoods) {
      lines.push(`- [${h.name}](${SITE}/neighborhoods/${h.slug}.md), ${h.count} deals`)
    }
    lines.push("")
  }

  lines.push(`## Deals (${Math.min(deals.length, 50)} shown${deals.length > 50 ? `, ${total} total` : ""})`)
  lines.push("")
  if (deals.length === 0) {
    lines.push("_No deals listed for today right now._")
  } else {
    for (const d of deals.slice(0, 50)) {
      lines.push(dealBlock(d))
      lines.push("")
    }
  }

  lines.push(`## Related`)
  lines.push("")
  lines.push(`- [Browse all deal types](${SITE}/deals.md)`)
  lines.push(`- [All Chicago neighborhoods](${SITE}/neighborhoods)`)
  lines.push("")
  lines.push(`[View on 312Deals](${SITE}/today)`)

  return lines.join("\n")
}

// ─── Dispatch ────────────────────────────────────────────────

const DENY_LIST = new Set(["/", "/admin", "/saved", "/chat", "/map", "/search", "/submit", "/blog"])

export async function dispatch(realPath: string): Promise<string | null> {
  if (DENY_LIST.has(realPath)) return null
  if (realPath.startsWith("/admin/")) return null
  if (realPath.startsWith("/api/")) return null
  if (realPath.startsWith("/_next/")) return null

  // Static info pages
  const staticKey = realPath.slice(1)  // strip leading /
  if (STATIC_MARKDOWN[staticKey]) return STATIC_MARKDOWN[staticKey]()

  // Day-of-week listing. Exact match only, before the dynamic patterns.
  if (realPath === "/today") return todayToMarkdown()

  // Pattern-match dynamic routes
  let m: RegExpMatchArray | null

  m = realPath.match(/^\/venues\/([^/]+)$/)
  if (m) return venueToMarkdown(m[1])

  m = realPath.match(/^\/neighborhoods\/([^/]+)\/([^/]+)$/)
  if (m) return neighborhoodDealTypeToMarkdown(m[1], m[2])

  m = realPath.match(/^\/neighborhoods\/([^/]+)$/)
  if (m) return neighborhoodToMarkdown(m[1])

  m = realPath.match(/^\/happy-hours\/([^/]+)$/)
  if (m) return happyHoursNeighborhoodToMarkdown(m[1])

  m = realPath.match(/^\/deals\/([^/]+)$/)
  if (m) return dealTypeToMarkdown(m[1])

  m = realPath.match(/^\/cuisine\/([^/]+)$/)
  if (m) return cuisineToMarkdown(m[1])

  m = realPath.match(/^\/guides\/([^/]+)$/)
  if (m) return guideToMarkdown(m[1])

  m = realPath.match(/^\/blog\/([^/]+)$/)
  if (m) return blogToMarkdown(m[1])

  m = realPath.match(/^\/reports\/([^/]+)$/)
  if (m) return reportToMarkdown(m[1])

  m = realPath.match(/^\/student-guides\/([^/]+)$/)
  if (m) return studentGuideToMarkdown(m[1])

  // /dietary/gluten-free/[neighborhood], specific hood × dietary tag
  m = realPath.match(/^\/dietary\/gluten-free\/([^/]+)$/)
  if (m) return dietaryNeighborhoodToMarkdown("gluten-free", m[1])

  m = realPath.match(/^\/dietary\/([^/]+)$/)
  if (m) return dietaryToMarkdown(m[1])

  if (realPath === "/dietary") {
    return pageHeader(
      "Dietary Deals in Chicago",
      `Food and drink deals filtered by dietary need across ${stats.neighborhoods} Chicagoland neighborhoods. 400+ gluten-free, 150+ vegan, 150+ vegetarian.`,
    ) + `

## Available pages

- [Gluten-Free Deals](${SITE}/dietary/gluten-free), 400+ verified, 2,200+ likely-GF
- Vegan Deals, coming soon (use [search filter](${SITE}/search?dietary=vegan))
- Vegetarian Deals, coming soon (use [search filter](${SITE}/search?dietary=vegetarian))

## Safety note

312Deals tags deals based on how venues market them. We don't verify dedicated fryers, shared cookware, or cross-contamination policies. For celiac or other allergy-sensitive diners, call the venue directly before visiting.
`
  }

  return null
}
