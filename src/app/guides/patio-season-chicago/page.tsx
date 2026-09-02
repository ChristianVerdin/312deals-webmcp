import Link from "next/link"
import dynamic from "next/dynamic"
import type { Metadata } from "next"
import { Sun, MapPin, Beer, UtensilsCrossed, Star, Clock, ExternalLink } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildCheapestDrink, formatTime } from "@/lib/seo-utils"
import { withAffiliateId } from "@/lib/affiliate"
import type { Deal, PatioDealLite, SearchResponse } from "@/lib/types"
import { stats } from "@/lib/product-stats"

const SearchMap = dynamic(() => import("@/components/search-map"), { ssr: false })
const PatioFilterTabs = dynamic(() => import("@/components/patio-filter-tabs"), { ssr: false })
const PatioDrinkThemes = dynamic(() => import("@/components/patio-drink-themes"), { ssr: false })

const DEAL_TYPE_LABEL: Record<string, string> = {
  happy_hour: "Happy Hour",
  daily_special: "Daily Special",
  brunch_deal: "Brunch",
  late_night: "Late Night",
  game_day: "Game Day",
  seasonal_lto: "Seasonal",
  event_driven: "Event",
  loyalty_reward: "Loyalty",
  group_package: "Group",
  chain_app_deal: "App Deal",
  restaurant_week: "Restaurant Week",
  new_opening: "New",
  other: "Deal",
}

const DAY_SHORT: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
}

function formatDays(days: string[] | null | undefined): string {
  if (!days || days.length === 0) return "Every day"
  if (days.length === 7) return "Every day"
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"]
  const weekend = ["saturday", "sunday"]
  const lower = days.map((d) => d.toLowerCase())
  if (lower.length === 5 && weekdays.every((d) => lower.includes(d))) return "Weekdays"
  if (lower.length === 2 && weekend.every((d) => lower.includes(d))) return "Weekends"
  return lower.map((d) => DAY_SHORT[d] ?? d.slice(0, 3)).join(", ")
}

function formatTimeRange(start: string | null, end: string | null, allDay: number | boolean): string | null {
  if (allDay) return "All day"
  if (!start && !end) return null
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`
  return start ? `From ${formatTime(start)}` : null
}

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

const ZONES = ["city", "north_shore", "northwest_suburbs", "south_suburbs", "western_suburbs"] as const

async function fetchDealsForZone(zone: string, dealType?: string, limit = 50): Promise<Deal[]> {
  try {
    // Tabs sample stays small (50/zone × 5 = 250) to keep the RSC payload lean
    // shipping 200×5 pushed the page over Mintlify's 100K converted-markdown
    // limit. The drink-category pool (getPatioDrinkPool) fetches a wider net but
    // is filtered to drink-bearing deals before it reaches the client.
    const params = new URLSearchParams({ has_patio: "true", zone, limit: String(limit) })
    if (dealType) params.set("deal_type", dealType)
    const res = await fetch(`${API_URL}/api/v1/deals/search?${params}`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

function dedupeById(lists: Deal[][]): Deal[] {
  const seen = new Set<number>()
  const out: Deal[] = []
  for (const list of lists) {
    for (const d of list) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      out.push(d)
    }
  }
  return out
}

const EXCLUDED_VENUE_PATTERNS = [/^chipotle/i]

function excludeBlockedVenues(deals: Deal[]): Deal[] {
  return deals.filter((d) => {
    const name = d.venue_name ?? ""
    return !EXCLUDED_VENUE_PATTERNS.some((re) => re.test(name))
  })
}

async function getPatioDeals(): Promise<Deal[]> {
  const results = await Promise.all(ZONES.map((z) => fetchDealsForZone(z)))
  return excludeBlockedVenues(dedupeById(results))
}

async function getPatioHappyHours(): Promise<Deal[]> {
  const results = await Promise.all(ZONES.map((z) => fetchDealsForZone(z, "happy_hour")))
  return excludeBlockedVenues(dedupeById(results))
}

async function getPatioDrinkPool(): Promise<Deal[]> {
  // Cast a wide net (200/zone) for the drink-category themes, then keep only
  // deals that carry structured drink items (or are gluten-free) so the counts
  // reflect the real corpus while the client payload stays bounded.
  const results = await Promise.all(ZONES.map((z) => fetchDealsForZone(z, undefined, 200)))
  const all = excludeBlockedVenues(dedupeById(results))
  return all.filter((d) => {
    const items = Array.isArray(d.drink_items) ? d.drink_items : []
    return items.some((it) => it && (it as { name?: string }).name) || d.is_gluten_free
  })
}

async function getZoneMap(): Promise<Map<string, string>> {
  try {
    const res = await fetch(`${API_URL}/api/v1/neighborhoods`, { next: { revalidate: 86400 } })
    if (!res.ok) return new Map()
    const data: { neighborhoods: { slug: string; zone: string }[] } = await res.json()
    return new Map(data.neighborhoods.map((n) => [n.slug, n.zone]))
  } catch {
    return new Map()
  }
}

export const metadata: Metadata = {
  title: "Chicago Patio Season Guide 2026, Best Outdoor Deals | 312Deals",
  description:
    `The best patio deals in Chicago for 2026. Find happy hours, brunch specials, and daily deals at bars and restaurants with outdoor seating across ${stats.neighborhoods} neighborhoods.`,
  openGraph: {
    title: "Chicago Patio Season Guide 2026 | 312Deals",
    description:
      `The best patio deals in Chicago, happy hours, brunch specials, and more at venues with outdoor seating across ${stats.neighborhoods} neighborhoods.`,
    url: `${SITE_URL}/guides/patio-season-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Chicago+Patio+Season+Guide+2026&subtitle=Best+outdoor+deals+across+73+neighborhoods&emoji=%E2%98%80%EF%B8%8F&badges=Patios+%26+rooftops%2CDog-friendly+too%2CBy+neighborhood&v=2`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chicago Patio Season Guide 2026 | 312Deals",
    description:
      "The best patio deals in Chicago, happy hours, brunch specials, and more at venues with outdoor seating.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/patio-season-chicago`,
  },
}

export default async function PatioSeasonGuide() {
  const [allDeals, happyHourDeals, drinkPool, zoneMap] = await Promise.all([
    getPatioDeals(),
    getPatioHappyHours(),
    getPatioDrinkPool(),
    getZoneMap(),
  ])

  const isCity = (slug: string | undefined | null) => !!slug && zoneMap.get(slug) === "city"
  const isSuburb = (slug: string | undefined | null) => !!slug && zoneMap.get(slug) !== undefined && zoneMap.get(slug) !== "city"

  const totalDeals = allDeals.length
  const uniqueVenues = new Set(allDeals.map((d) => d.venue_name)).size
  const hhCount = happyHourDeals.length
  const cheapest = buildCheapestDrink(happyHourDeals)

  // Neighborhood stats
  const nhDealCounts = new Map<string, { name: string; slug: string; count: number }>()
  for (const d of allDeals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = nhDealCounts.get(d.neighborhood_slug)
      if (existing) {
        existing.count++
      } else {
        nhDealCounts.set(d.neighborhood_slug, {
          name: d.neighborhood,
          slug: d.neighborhood_slug,
          count: 1,
        })
      }
    }
  }
  const topNeighborhoods = Array.from(nhDealCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  // Deal type breakdown
  const dealTypeCounts = new Map<string, number>()
  for (const d of allDeals) {
    dealTypeCounts.set(d.deal_type, (dealTypeCounts.get(d.deal_type) ?? 0) + 1)
  }

  // Cheapest patio drinks, consolidated by venue
  type DrinkItem = { name: string; price: number }
  type VenueDrink = {
    venue: string
    venue_slug: string
    neighborhood: string
    neighborhood_slug: string
    cheapest: number
    items: DrinkItem[]
  }
  const venueDrinkMap = new Map<string, VenueDrink>()
  for (const d of happyHourDeals) {
    if (!d.venue_slug) continue
    for (const item of Array.isArray(d.drink_items) ? d.drink_items : []) {
      if (!item.deal_price || item.deal_price <= 0) continue
      const existing = venueDrinkMap.get(d.venue_slug)
      if (existing) {
        // Avoid duplicate item names within a single venue
        if (!existing.items.some((x) => x.name.toLowerCase() === item.name.toLowerCase())) {
          existing.items.push({ name: item.name, price: item.deal_price })
          if (item.deal_price < existing.cheapest) existing.cheapest = item.deal_price
        }
      } else {
        venueDrinkMap.set(d.venue_slug, {
          venue: d.venue_name,
          venue_slug: d.venue_slug,
          neighborhood: d.neighborhood ?? "",
          neighborhood_slug: d.neighborhood_slug ?? "",
          cheapest: item.deal_price,
          items: [{ name: item.name, price: item.deal_price }],
        })
      }
    }
  }
  // Sort each venue's items by price asc
  for (const v of venueDrinkMap.values()) {
    v.items.sort((a, b) => a.price - b.price)
  }
  const allVenueDrinks = Array.from(venueDrinkMap.values()).sort((a, b) => a.cheapest - b.cheapest)
  const cheapDrinksTotalCount = allVenueDrinks.reduce((acc, v) => acc + v.items.length, 0)

  // Diversify: cap at 2 entries per neighborhood to spread coverage
  function diversify(list: VenueDrink[], perHoodCap: number, max: number): VenueDrink[] {
    const counts = new Map<string, number>()
    const out: VenueDrink[] = []
    for (const v of list) {
      const k = v.neighborhood_slug || "_"
      const c = counts.get(k) ?? 0
      if (c >= perHoodCap) continue
      out.push(v)
      counts.set(k, c + 1)
      if (out.length >= max) break
    }
    return out
  }

  const cityCheapest = diversify(allVenueDrinks.filter((d) => isCity(d.neighborhood_slug)), 2, 10)
  const suburbCheapest = diversify(allVenueDrinks.filter((d) => isSuburb(d.neighborhood_slug)), 2, 10)
  const top10Cheapest = diversify(allVenueDrinks, 2, 10)

  // Timing stats for patio happy hours
  const startTimes = happyHourDeals.map((d) => d.start_time).filter(Boolean) as string[]
  const startCounts = new Map<string, number>()
  for (const t of startTimes) {
    startCounts.set(t, (startCounts.get(t) ?? 0) + 1)
  }
  const mostCommonStart = startCounts.size > 0
    ? Array.from(startCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null

  // Brunch deals on patios
  const brunchCount = dealTypeCounts.get("brunch_deal") ?? 0

  // Group deals by venue for rich venue cards
  type VenueGroup = {
    venue_name: string
    venue_slug: string
    neighborhood: string
    neighborhood_slug: string
    google_rating: number | null | undefined
    deals: Deal[]
    bestScore: number
    latestUpdate: string
    latestCreate: string
  }
  const venueMap = new Map<string, VenueGroup>()
  for (const d of allDeals) {
    if (!d.venue_slug) continue
    const existing = venueMap.get(d.venue_slug)
    if (existing) {
      existing.deals.push(d)
      existing.bestScore = Math.max(existing.bestScore, d.quality_score ?? 0)
      if (d.updated_at && d.updated_at > existing.latestUpdate) existing.latestUpdate = d.updated_at
      if (d.created_at && d.created_at > existing.latestCreate) existing.latestCreate = d.created_at
    } else {
      venueMap.set(d.venue_slug, {
        venue_name: d.venue_name,
        venue_slug: d.venue_slug,
        neighborhood: d.neighborhood ?? "",
        neighborhood_slug: d.neighborhood_slug ?? "",
        google_rating: d.google_rating,
        deals: [d],
        bestScore: d.quality_score ?? 0,
        latestUpdate: d.updated_at ?? "",
        latestCreate: d.created_at ?? "",
      })
    }
  }

  // Top featured venues: weight quality score + recency, prefer multi-deal venues
  const featuredVenues = Array.from(venueMap.values())
    .map((v) => ({
      ...v,
      rank: v.bestScore + v.deals.length * 2 + (v.google_rating ? v.google_rating * 5 : 0),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 12)

  // Latest deals, dedupe by venue, take top deal per venue, up to 10 unique venues
  const recentByVenue = new Map<string, { lead: Deal; total: number }>()
  const sortedByCreated = [...allDeals]
    .filter((d) => d.created_at && d.venue_slug)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
  for (const d of sortedByCreated) {
    const slug = d.venue_slug!
    const existing = recentByVenue.get(slug)
    if (existing) {
      existing.total++
    } else {
      recentByVenue.set(slug, { lead: d, total: 1 })
    }
  }
  const recentDeals = Array.from(recentByVenue.values()).slice(0, 10)

  // Map deals: only those with coordinates
  const mapDeals = allDeals.filter(
    (d) => typeof d.latitude === "number" && typeof d.longitude === "number"
  )

  // Trim payload before passing to client components, was shipping 4.1 MB of
  // serialized Deal objects to the browser via RSC. Client components only read
  // ~17 fields; the rest (raw_text, source_url, lat/lng, address, phone,
  // timestamps, etc.) is dead weight. Phase 0.5 follow-up: also cap to top 100
  // deals per type (sorted by quality_score) since the tabs UI never renders
  // more than that. The total deal count stays accurate via allDeals.length;
  // only the client component data is truncated.
  const PATIO_DEAL_CAP_PER_TYPE = 100
  const liteDeals: PatioDealLite[] = allDeals.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    deal_type: d.deal_type,
    days_available: d.days_available,
    start_time: d.start_time,
    end_time: d.end_time,
    is_all_day: d.is_all_day,
    is_gluten_free: d.is_gluten_free,
    neighborhood: d.neighborhood,
    neighborhood_slug: d.neighborhood_slug,
    quality_score: d.quality_score,
    google_rating: d.google_rating,
    drink_items: d.drink_items,
    food_items: d.food_items,
    venue_name: d.venue_name,
    venue_slug: d.venue_slug,
  }))
  const dealsByType = new Map<string, PatioDealLite[]>()
  for (const d of liteDeals) {
    if (!d.deal_type) continue
    const arr = dealsByType.get(d.deal_type) ?? []
    arr.push(d)
    dealsByType.set(d.deal_type, arr)
  }
  const allDealsLite: PatioDealLite[] = []
  for (const arr of dealsByType.values()) {
    arr.sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0))
    allDealsLite.push(...arr.slice(0, PATIO_DEAL_CAP_PER_TYPE))
  }

  // Denser, drink-specific pool for the "Deals by Drink Category" themes. Same
  // lite shape; capped so the payload stays reasonable. This is why the drink
  // counts now reflect the real corpus (hundreds) instead of the ~250-deal tab
  // sample (single digits).
  const DRINK_POOL_CAP = 700
  const drinkSeen = new Set<number>()
  const drinkPoolLite: PatioDealLite[] = []
  for (const d of drinkPool) {
    if (drinkSeen.has(d.id)) continue
    drinkSeen.add(d.id)
    drinkPoolLite.push({
      id: d.id,
      title: d.title,
      description: d.description,
      deal_type: d.deal_type,
      days_available: d.days_available,
      start_time: d.start_time,
      end_time: d.end_time,
      is_all_day: d.is_all_day,
      is_gluten_free: d.is_gluten_free,
      neighborhood: d.neighborhood,
      neighborhood_slug: d.neighborhood_slug,
      quality_score: d.quality_score,
      google_rating: d.google_rating,
      drink_items: d.drink_items,
      food_items: d.food_items,
      venue_name: d.venue_name,
      venue_slug: d.venue_slug,
    })
    if (drinkPoolLite.length >= DRINK_POOL_CAP) break
  }
  const drinkThemeDeals = drinkPoolLite.length > 0 ? drinkPoolLite : allDealsLite

  // FAQ items
  const faqItems = [
    {
      q: "Which Chicago neighborhoods have the best patio deals?",
      a: topNeighborhoods.length > 0
        ? `${topNeighborhoods.slice(0, 4).map((n) => `${n.name} (${n.count} deals)`).join(", ")} lead the way for patio deals. We track ${totalDeals}+ deals at ${uniqueVenues} venues with outdoor seating.`
        : "Search our deal database to find patio deals near you.",
    },
    {
      q: "What are the best patio happy hours in Chicago?",
      a: `We found ${hhCount} happy hour deals at patio venues across Chicago.${cheapest ? ` The cheapest patio drink: ${cheapest}.` : ""} Most patio happy hours${mostCommonStart ? ` start at ${formatTime(mostCommonStart)}` : " run from 3-7 PM"}.`,
    },
    {
      q: "Where can I find patio brunch in Chicago?",
      a: brunchCount > 0
        ? `There are ${brunchCount} brunch deals at venues with patios, including bottomless mimosa spots. Popular patio brunch neighborhoods include ${topNeighborhoods.slice(0, 3).map((n) => n.name).join(", ")}.`
        : "Many Chicago restaurants offer patio brunch. Browse our brunch deals filtered by patio to find spots near you.",
    },
    {
      q: "When does patio season start in Chicago?",
      a: "Patio season in Chicago typically runs from late March through October, though some heated patios stay open year-round. The first warm weekends (60°F+) in March and April are when most patios open.",
    },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <article className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: SITE_URL },
                  { name: "Patio Season Guide", url: `${SITE_URL}/guides/patio-season-chicago` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(buildFaqJsonLd(faqItems)),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Chicago Patio Season Guide 2026, Best Outdoor Deals",
                "description": `${totalDeals}+ deals at ${uniqueVenues} venues with patios across Chicago. Happy hours, brunch specials, and daily deals at the best outdoor spots.`,
                "url": `${SITE_URL}/guides/patio-season-chicago`,
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/patio-season-chicago`,
                },
                "author": {
                  "@type": "Organization",
                  "name": "312Deals",
                  "url": SITE_URL,
                },
                "publisher": {
                  "@type": "Organization",
                  "name": "312Deals",
                  "url": SITE_URL,
                  "logo": {
                    "@type": "ImageObject",
                    "url": `${SITE_URL}/apple-touch-icon.png`,
                  },
                },
                "image": `${SITE_URL}/api/og?title=Chicago+Patio+Season+Guide+2026&subtitle=Best+outdoor+deals+across+73+neighborhoods&emoji=%E2%98%80%EF%B8%8F&badges=Patios+%26+rooftops%2CDog-friendly+too%2CBy+neighborhood&v=2`,
                "datePublished": "2026-03-20",
                "dateModified": new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <span className="text-foreground">Patio Season Guide</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Chicago Patio Season Guide 2026
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
                <span className="font-medium text-foreground">Live</span>
              </span>
              <span>·</span>
              <span>Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              <span>·</span>
              <span>By <span className="font-medium text-foreground">312Deals Team</span></span>
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Patio season is on. {totalDeals}+ live deals across {uniqueVenues} Chicago venues with outdoor seating, rooftops, beer gardens, sidewalk cafés, and dog-friendly patios.
              {cheapest && ` Cheapest drink on a patio right now: ${cheapest}.`}
              {mostCommonStart && ` Most happy hours kick off at ${formatTime(mostCommonStart)}.`}
            </p>
          </header>

          {/* Heat-wave patio callout */}
          <div className="mb-10 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Sun className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" aria-hidden />
              <div className="flex-1">
                <p className="text-lg font-semibold text-foreground">
                  Heat wave, patios are the play
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  80s in the forecast all week, it&apos;s peak patio season across the city and the suburbs.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Bringing the dog? Here are <Link href="/guides/dog-friendly-patios-chicago" className="text-amber-600 hover:underline">Chicago&apos;s dog-friendly patios</Link>.
                </p>
              </div>
            </div>
          </div>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Sun className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{totalDeals}</div>
              <div className="text-xs text-muted-foreground">Patio Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{uniqueVenues}</div>
              <div className="text-xs text-muted-foreground">Venues with Patios</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{hhCount}</div>
              <div className="text-xs text-muted-foreground">Patio Happy Hours</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <UtensilsCrossed className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{brunchCount || "50+"}</div>
              <div className="text-xs text-muted-foreground">Patio Brunches</div>
            </div>
          </div>

          {/* Section: Tabbed patio deals breakdown (moved above map) */}
          {allDeals.length > 0 && (
            <section className="mb-12">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-foreground">Browse Patio Deals by Type</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every tab stays patio-focused. Start with today&apos;s live deals or switch by category.
                </p>
              </div>
              <PatioFilterTabs deals={allDealsLite} />
            </section>
          )}

          {/* Section: Themed drink breakdowns */}
          {allDeals.length > 0 && (
            <section className="mb-12">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-foreground">Deals by Drink Category</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Specific themes pulled from live deal items, cheap domestics, seltzers, buckets, cocktails, and more.
                </p>
              </div>
              <PatioDrinkThemes deals={drinkThemeDeals} />
            </section>
          )}

          {/* Section: Map */}
          {mapDeals.length > 0 && (
            <section className="mb-12">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Patio Deals Map</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mapDeals.length} mapped patio venues. Tap a pin for deal details.
                  </p>
                </div>
                <Link
                  href="/map?has_patio=true"
                  className="hidden shrink-0 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400 sm:inline-flex sm:items-center sm:gap-1"
                >
                  Open full map <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <SearchMap deals={mapDeals} />
              </div>
            </section>
          )}

          {/* Section: Just Added, grouped by venue */}
          {recentDeals.length > 0 && (
            <section className="mb-12">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Just Added</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Fresh patio venues scraped this week. One lead deal shown per venue.
                  </p>
                </div>
              </div>
              <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {recentDeals.map(({ lead: d, total }) => {
                  const timeRange = formatTimeRange(d.start_time, d.end_time, d.is_all_day)
                  return (
                    <li key={d.venue_slug} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                            {DEAL_TYPE_LABEL[d.deal_type] ?? "Deal"}
                          </span>
                          {total > 1 && (
                            <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-semibold text-green-700 dark:text-green-400">
                              +{total - 1} more deals
                            </span>
                          )}
                          <span className="text-muted-foreground">{formatDays(d.days_available)}</span>
                          {timeRange && (
                            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" />
                              {timeRange}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm text-foreground">{d.title}</p>
                      </div>
                      <Link
                        href={`/venues/${d.venue_slug}`}
                        className="shrink-0 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {d.venue_name}
                        {d.neighborhood && <span className="text-muted-foreground"> · {d.neighborhood}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          {/* Section: Top Patio Neighborhoods */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Best Chicago Neighborhoods for Patio Dining
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {topNeighborhoods.length > 0 && `${topNeighborhoods[0].name} leads with ${topNeighborhoods[0].count} patio deals, followed by ${topNeighborhoods.slice(1, 3).map((n) => `${n.name} (${n.count})`).join(" and ")}.`}
              {" "}Here are the top neighborhoods ranked by patio deals:
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Top Chicago neighborhoods ranked by number of patio deals">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Rank</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Patio Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {topNeighborhoods.map((nh, i) => (
                    <tr key={nh.slug} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/neighborhoods/${nh.slug}`}
                          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {nh.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {nh.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: Cheapest Patio Drinks, split by City vs Suburbs */}
          {top10Cheapest.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-2 text-2xl font-bold text-foreground">
                Cheapest Patio Happy Hour Drinks
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                {cheapDrinksTotalCount}+ drink specials tracked across {allVenueDrinks.length} patio venues, consolidated to one row per venue, max 2 per neighborhood for spread.
                {cityCheapest.length > 0 && ` Best in the city: $${cityCheapest[0].cheapest.toFixed(2)} ${cityCheapest[0].items[0].name} at ${cityCheapest[0].venue} (${cityCheapest[0].neighborhood}).`}
                {suburbCheapest.length > 0 && ` Best in the suburbs: $${suburbCheapest[0].cheapest.toFixed(2)} ${suburbCheapest[0].items[0].name} at ${suburbCheapest[0].venue} (${suburbCheapest[0].neighborhood}).`}
              </p>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* City */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-6 items-center rounded-full bg-brand-500/15 px-2.5 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                      Chicago City
                    </span>
                    <span className="text-xs text-muted-foreground">{cityCheapest.length} deals shown</span>
                  </div>
                  {cityCheapest.length > 0 ? (
                    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {cityCheapest.map((v) => {
                        const lead = v.items[0]
                        const more = v.items.slice(1, 3)
                        return (
                          <li key={v.venue_slug} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <Link href={`/venues/${v.venue_slug}`} className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400">
                                  {v.venue}
                                </Link>
                                <div className="text-xs text-muted-foreground">{v.neighborhood}</div>
                              </div>
                              <span className="shrink-0 text-base font-bold text-green-600 dark:text-green-400 tabular-nums">
                                ${v.cheapest.toFixed(2)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs text-foreground">
                                {lead.name}
                              </span>
                              {more.map((it, idx) => (
                                <span key={idx} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {it.name} <span className="text-green-600 dark:text-green-400 tabular-nums">${it.price.toFixed(2)}</span>
                                </span>
                              ))}
                              {v.items.length > 3 && (
                                <span className="text-[11px] text-muted-foreground">+{v.items.length - 3} more</span>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No priced drinks yet for city patios.
                    </div>
                  )}
                </div>

                {/* Suburbs */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-6 items-center rounded-full bg-blue-500/15 px-2.5 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                      Suburbs
                    </span>
                    <span className="text-xs text-muted-foreground">{suburbCheapest.length} deals shown</span>
                  </div>
                  {suburbCheapest.length > 0 ? (
                    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {suburbCheapest.map((v) => {
                        const lead = v.items[0]
                        const more = v.items.slice(1, 3)
                        return (
                          <li key={v.venue_slug} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <Link href={`/venues/${v.venue_slug}`} className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400">
                                  {v.venue}
                                </Link>
                                <div className="text-xs text-muted-foreground">{v.neighborhood}</div>
                              </div>
                              <span className="shrink-0 text-base font-bold text-green-600 dark:text-green-400 tabular-nums">
                                ${v.cheapest.toFixed(2)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-foreground">
                                {lead.name}
                              </span>
                              {more.map((it, idx) => (
                                <span key={idx} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {it.name} <span className="text-green-600 dark:text-green-400 tabular-nums">${it.price.toFixed(2)}</span>
                                </span>
                              ))}
                              {v.items.length > 3 && (
                                <span className="text-[11px] text-muted-foreground">+{v.items.length - 3} more</span>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No priced drinks yet for suburban patios, scraping in progress.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Section: Patio Brunch */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Best Patio Brunch Spots in Chicago
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Nothing beats Saturday or Sunday brunch on a patio.
              {brunchCount > 0 ? ` We found ${brunchCount} brunch deals at venues with outdoor seating, including bottomless mimosa and bloody mary specials.` : " Many Chicago restaurants offer patio brunch with bottomless drinks and prix fixe menus."}
              {" "}Check our{" "}
              <Link href="/guides/best-brunch-chicago" className="text-brand-600 hover:underline dark:text-brand-400">
                full brunch guide
              </Link>{" "}
              for the complete list.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pro tip: For the best patio brunch experience, arrive by 10:30 AM on weekends.
              Most patios fill up fast on warm days, especially in River North, Wicker Park, and Lincoln Park.
            </p>
          </section>

          {/* Section: Tips */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Chicago Patio Season Tips
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">Best months:</strong> May through September for guaranteed warm weather. Late March and April are hit-or-miss but the first 60°F+ days feel magical.
              </p>
              <p>
                <strong className="text-foreground">Rooftops vs. sidewalk cafes:</strong> Rooftop bars tend to have higher prices but better views. Sidewalk patios are more casual and usually keep regular menu pricing.
              </p>
              <p>
                <strong className="text-foreground">Dog-friendly patios:</strong> Many Chicago patios welcome dogs. Check the venue details on 312Deals, we tag dog-friendly spots.
              </p>
              <p>
                <strong className="text-foreground">Reservations:</strong> On the first warm weekends of the season, popular patios book up fast. Use{" "}
                <a href={withAffiliateId("https://resy.com/cities/chi", "resy", { medium: "guide", campaign: "patio_season" })} target="_blank" rel="noopener noreferrer sponsored" className="text-brand-600 hover:underline dark:text-brand-400">Resy</a>{" "}
                or call the venue directly to secure a spot.
              </p>
            </div>
          </section>

          {/* Section: Find Patio Deals */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Keep Exploring
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/search?has_patio=true"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                Search Patio Deals
              </Link>
              <Link
                href="/map"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                View Deal Map
              </Link>
              <Link
                href="/search?has_patio=true&deal_type=happy_hour"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Patio Happy Hours
              </Link>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-12 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold text-foreground">
              Frequently Asked Questions
            </h2>
            <dl className="space-y-4">
              {faqItems.map((item, i) => (
                <div key={i}>
                  <dt className="text-sm font-semibold text-foreground">
                    {item.q}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* About */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              About This Guide
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This guide is based on data from 312Deals, which tracks {totalDeals}+ deals at venues with patios
              across Chicago. Deals are scraped from restaurant websites and verified by our community.
              Data is updated weekly. Prices and availability may change, always confirm with
              the venue directly. Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
