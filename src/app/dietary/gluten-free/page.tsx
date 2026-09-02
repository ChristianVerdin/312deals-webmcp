import Link from "next/link"
import type { Metadata } from "next"
import { Wheat, MapPin, Info, Search, ShieldCheck, Clock } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd, getLowestDealPrice } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"
import { stats } from "@/lib/product-stats"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

/** Confirmed-GF coverage clusters, ordered by venue density (May 2026 corpus). */
const HOOD_PICKS = [
  { name: "River North",   slug: "river-north",   count: 106, blurb: "Highest GF density in the city. Steakhouses, sushi rooms, and modern American kitchens with dedicated menus." },
  { name: "Lakeview",      slug: "lakeview",      count: 62,  blurb: "Wrigleyville-adjacent. Strong celiac-aware coverage in casual gastropubs and brunch spots." },
  { name: "Lincoln Park",  slug: "lincoln-park",  count: 59,  blurb: "DePaul corridor + Halsted restaurant row. GF variety from pizza to fine dining." },
  { name: "West Loop",     slug: "west-loop",     count: 54,  blurb: "Randolph Restaurant Row. Higher-end menus increasingly flag GF items by default." },
  { name: "The Loop",      slug: "the-loop",      count: 48,  blurb: "Downtown lunch + theater dinner. Hotel restaurants take GF seriously." },
  { name: "Logan Square",  slug: "logan-square",  count: 32,  blurb: "Newer indie kitchens that built GF into the menu, not as an afterthought." },
]

/** Dedicated gluten-free facilities, entire kitchen is GF, no shared fryers or cross-contamination.
    These are the celiac gold standard. Cross-validated from community reports + our own audit. */
const DEDICATED_GF = [
  { name: "SeoulSpice", slug: "seoulspice", hood: "Wicker Park", note: "Korean fast-casual, every menu item is gluten-free. Build-a-bowl, rice noodles, fried chicken. 100% dedicated kitchen." },
  { name: "Defloured: A Gluten Free Bakery", slug: "defloured-a-gluten-free-bakery", hood: "Andersonville", note: "Dedicated GF bakery, bread, cookies, cakes, baguettes, pastries. The name says it all." },
  { name: "Pizza Friendly Pizza", slug: "pizza-friendly-pizza", hood: "West Town", note: "Dedicated GF pizzeria, Neapolitan-style pies in a 100% gluten-free kitchen." },
  { name: "Wheat's End Cafe & Bakery", slug: "wheats-end-cafe-and-bakery", hood: "Lincoln Park", note: "Dedicated GF cafe and bakery, breakfast, sandwiches, pastries. Diversey Parkway." },
]

/** Strong GF menus, extensive options + allergen-aware kitchens, but NOT dedicated GF facilities.
    Safer than typical, but celiac diners with severe sensitivity should still call ahead. */
const STRONG_GF_MENUS = [
  { name: "Beatrix - River North", slug: "beatrix-river-north", hood: "River North", note: "LEYE's allergy-aware concept, 12 GF deals tracked, dedicated allergen guide." },
  { name: "Aba", slug: "aba", hood: "West Loop", note: "14 GF deals, 8.6K Google reviews. Mediterranean menu marks GF by default." },
  { name: "RPM Italian", slug: "rpm-italian", hood: "River North", note: "16 GF deals. Pasta available GF on request; allergen-trained staff." },
  { name: "Lil Ba-Ba-Reeba!", slug: "lil-ba-ba-reeba", hood: "River North", note: "19 GF deals, tapas-style menu makes naturally GF dishes easy." },
]

const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
}

function dayChips(deal: Deal): string {
  const days = deal.days_available ?? []
  if (!days.length || days.length === 7) return "Daily"
  if (days.length >= 5 && days.every((d) => ["monday","tuesday","wednesday","thursday","friday"].includes(d))) return "Mon–Fri"
  return days.map((d) => DAY_LABELS[d] ?? d).join(", ")
}

function timeRange(deal: Deal): string | null {
  if (!deal.start_time && !deal.end_time) return null
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    const hh = h % 12 || 12
    const ap = h < 12 ? "a" : "p"
    return m ? `${hh}:${String(m).padStart(2,"0")}${ap}` : `${hh}${ap}`
  }
  if (deal.start_time && deal.end_time) return `${fmt(deal.start_time)}–${fmt(deal.end_time)}`
  return null
}

async function fetchHoodGFDeals(hoodSlug: string, limit = 4): Promise<Deal[]> {
  try {
    const params = new URLSearchParams({
      neighborhood: hoodSlug, gluten_free: "true", limit: String(limit),
    })
    const res = await fetch(`${API_URL}/api/v1/deals/search?${params}`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch { return [] }
}

async function fetchTopGFDeals(limit = 12): Promise<Deal[]> {
  try {
    const params = new URLSearchParams({ gluten_free: "true", limit: String(limit) })
    const res = await fetch(`${API_URL}/api/v1/deals/search?${params}`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch { return [] }
}

function uniqueByVenue(deals: Deal[]): Deal[] {
  const seen = new Set<number>()
  const out: Deal[] = []
  for (const d of deals) {
    const id = d.venue_id
    if (id == null || seen.has(id)) continue
    seen.add(id); out.push(d)
  }
  return out
}

export const metadata: Metadata = {
  title: "Gluten-Free Deals in Chicago 2026, 400+ Verified Spots",
  description: `Every gluten-free deal in Chicagoland, 400+ verified, 2,200+ likely-GF items across ${stats.venues} venues. Filter by neighborhood, day, or price. Updated weekly.`,
  alternates: { canonical: `${SITE_URL}/dietary/gluten-free` },
  openGraph: {
    title: "Gluten-Free Deals in Chicago 2026",
    description: "400+ verified gluten-free deals across Chicago neighborhoods.",
    url: `${SITE_URL}/dietary/gluten-free`,
    type: "article",
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630 }],
  },
}

export default async function Page() {
  const [topDeals, ...hoodResults] = await Promise.all([
    fetchTopGFDeals(18),
    ...HOOD_PICKS.map((h) => fetchHoodGFDeals(h.slug, 4)),
  ])

  const featured = uniqueByVenue(topDeals).slice(0, 12)
  const hoodMap = new Map<string, Deal[]>(
    HOOD_PICKS.map((h, i) => [h.slug, uniqueByVenue(hoodResults[i] ?? []).slice(0, 3)])
  )

  const faqItems = [
    {
      q: "How many gluten-free deals does 312Deals track in Chicago?",
      a: `We track 400+ deals explicitly tagged gluten-free and another 2,200+ items flagged 'likely gluten-free' based on underlying ingredients (steaks, grilled fish, salads, naturally GF Mexican dishes). Total: 2,600+ deals across ${stats.venues} venues. Updated weekly.`,
    },
    {
      q: "Which Chicago neighborhoods have the most gluten-free options?",
      a: "River North leads with 106 venues, followed by Lakeview (62), Lincoln Park (59), West Loop (54), and The Loop (48). Outside the city, look in Lake Forest, Highland Park, and Naperville, affluent suburbs over-index on dietary-aware kitchens.",
    },
    {
      q: "Are the gluten-free deals safe for celiac diners?",
      a: "Not automatically. 312Deals tags deals as 'gluten-free' when a venue explicitly markets the item that way. We don't certify shared-fryer or cross-contamination practices, call the venue directly if you're celiac. The most thorough GF protocols in our corpus belong to Steak 48 (West Loop), Wildberry Cafe (The Loop), True Food Kitchen (River North), and Beatrix.",
    },
    {
      q: "What's the difference between 'gluten-free' and 'likely gluten-free' tags?",
      a: "'Gluten-free' (~400 deals) means the venue explicitly markets the item that way. 'Likely gluten-free' (~2,200 deals) is our inferred tag for naturally GF foods, steaks, sashimi, grilled fish, salads without croutons, corn-tortilla tacos. Always confirm with the venue before ordering if you're celiac.",
    },
    {
      q: "Do happy hour deals at Chicago bars include gluten-free food?",
      a: "Yes, happy hour menus increasingly include GF-friendly options. Common safe bets across our corpus: oysters, shrimp cocktail, charcuterie (skip the bread), grilled meats, and rice bowls. Filter our happy hours by gluten-free in search to see the current list.",
    },
  ]

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Dietary", url: `${SITE_URL}/dietary` },
    { name: "Gluten-Free Deals", url: `${SITE_URL}/dietary/gluten-free` },
  ])
  const faqJsonLd = buildFaqJsonLd(faqItems)
  const itemListJsonLd = buildItemListJsonLd(
    "Gluten-Free Deals in Chicago",
    `${SITE_URL}/dietary/gluten-free`,
    featured,
  )

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pb-24 md:pb-0">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-4 text-xs text-muted-foreground lg:px-6">
          <Link href="/" className="hover:underline">Home</Link>
          {" / "}
          <Link href="/dietary" className="hover:underline">Dietary</Link>
          {" / "}
          <span className="text-foreground">Gluten-Free</span>
        </nav>

        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
          <div className="flex items-center gap-3">
            <Wheat className="h-7 w-7 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Updated weekly</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
            Gluten-Free Deals in Chicago, 400+ Verified Spots
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every deal across Chicagoland tagged gluten-free, plus 2,200+ naturally GF items (steaks, sashimi, grilled fish, corn-tortilla tacos) tagged "likely gluten-free." Built for celiac diners, gluten-sensitive eaters, and anyone managing dietary restrictions across {stats.neighborhoods} neighborhoods.
          </p>

          {/* Stats, 2 cols mobile, 4 cols desktop */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">400+</div>
              <div className="text-xs text-muted-foreground">Verified GF deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">2,200+</div>
              <div className="text-xs text-muted-foreground">Likely GF items</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.neighborhoods}</div>
              <div className="text-xs text-muted-foreground">Neighborhoods</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">12,636</div>
              <div className="text-xs text-muted-foreground">Total venues searched</div>
            </div>
          </div>
        </section>

        {/* Sticky filter chip row, desktop only; mobile gets the floating CTA at bottom */}
        <div className="sticky top-0 z-30 hidden border-y border-border bg-background/95 backdrop-blur md:block">
          <div className="mx-auto max-w-7xl px-4 py-2 lg:px-6">
            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              <span className="shrink-0 font-semibold text-muted-foreground">Filter:</span>
              <Link href="/search?gluten_free=true" className="shrink-0 rounded-full bg-amber-700 px-3 py-1.5 font-medium text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500">All confirmed GF</Link>
              <Link href="/search?gluten_free=true&day=saturday" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Saturday</Link>
              <Link href="/search?gluten_free=true&day=sunday" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Sunday brunch</Link>
              <Link href="/search?gluten_free=true&deal_type=happy_hour" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Happy hours</Link>
              <Link href="/cuisine/mexican" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Mexican (naturally GF)</Link>
              <Link href="/cuisine/japanese" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Japanese (sushi/sashimi)</Link>
            </div>
          </div>
        </div>

        {/* Dedicated gluten-free facilities, celiac gold standard */}
        <section className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <h2 className="text-lg font-bold text-foreground sm:text-xl">Dedicated Gluten-Free Facilities</h2>
            <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-emerald-600">100% GF KITCHENS</span>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Entire kitchen is gluten-free, no shared fryers, no cross-contamination. The celiac gold standard.
            All four below are 100% dedicated GF facilities. Still confirm with the venue if you have severe celiac.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DEDICATED_GF.map((v) => (
              <Link
                key={v.slug}
                href={`/venues/${v.slug}`}
                className="group min-h-[88px] rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 transition-colors hover:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:hover:border-emerald-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{v.name}</h3>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                </div>
                <div className="mt-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">{v.hood}</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{v.note}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Strong GF menus, extensive options, NOT dedicated */}
        <section className="mx-auto max-w-7xl px-4 pb-6 lg:px-6 lg:pb-8">
          <div className="flex items-center gap-2">
            <Wheat className="h-5 w-5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <h2 className="text-lg font-bold text-foreground sm:text-xl">Strong GF Menus</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">EXTENSIVE GF OPTIONS</span>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            These have extensive gluten-free menus + allergen-aware kitchens but are <strong>not dedicated GF facilities</strong>.
            Safer than typical restaurants, but celiac diners with severe sensitivity should call ahead.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STRONG_GF_MENUS.map((v) => (
              <Link
                key={v.slug}
                href={`/venues/${v.slug}`}
                className="group min-h-[88px] rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:border-amber-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400">{v.name}</h3>
                  <Wheat className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                </div>
                <div className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">{v.hood}</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{v.note}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Top hoods grid, 2 cols mobile, 3 cols desktop */}
        <section className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
          <h2 className="mb-4 text-lg font-bold text-foreground sm:text-xl">Top GF Neighborhoods</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOOD_PICKS.map((h) => {
              const hoodDeals = hoodMap.get(h.slug) ?? []
              return (
                <article key={h.slug} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-foreground">{h.name}</h3>
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{h.count} venues</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{h.blurb}</p>
                  {hoodDeals.length > 0 && (
                    <ul className="mt-3 space-y-1.5 text-xs">
                      {hoodDeals.map((d) => (
                        <li key={d.id}>
                          <Link
                            href={`/venues/${d.venue_slug}`}
                            className="block min-h-[44px] py-1 hover:text-amber-700 dark:hover:text-amber-400"
                          >
                            <span className="font-medium text-foreground">{d.venue_name}</span>
                            <span className="text-muted-foreground">, {d.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/search?neighborhood=${h.slug}&gluten_free=true`}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-1 py-2 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
                  >
                    All GF in {h.name} &rarr;
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        {/* Featured deals, with price, day, time */}
        <section className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
          <h2 className="mb-4 text-lg font-bold text-foreground sm:text-xl">Featured GF Deals Citywide</h2>
          {featured.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals loaded, try the search page.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((d) => {
                const price = getLowestDealPrice(d)
                const time = timeRange(d)
                const days = dayChips(d)
                return (
                  <Link
                    key={d.id}
                    href={`/venues/${d.venue_slug}`}
                    className="group min-h-[120px] rounded-lg border border-border bg-card p-4 transition-colors hover:border-amber-400"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400">
                        {d.venue_name}
                      </h3>
                      <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        GF
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.title}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {d.neighborhood ?? "Chicago"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {days}{time ? ` · ${time}` : ""}
                      </span>
                      {price != null && (
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          ${price.toFixed(price % 1 === 0 ? 0 : 2)}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Safety note */}
        <section className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
          <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/40">
            <Info className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-foreground">For celiac diners, call ahead</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                312Deals tags deals based on how a venue markets them. We don&apos;t verify dedicated fryers,
                shared cookware, or cross-contamination policies. If you&apos;re celiac, confirm with the venue
                before visiting. Our hand-picked celiac-trusted spots are in the strip at the top of this page.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-6">
          <h2 className="mb-4 text-lg font-bold text-foreground sm:text-xl">FAQ</h2>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <details key={i} className="rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer min-h-[44px] py-2 text-sm font-semibold text-foreground">{item.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Email signup */}
        <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-6">
          <EmailSignup source="dietary-gluten-free" />
        </section>

        {/* Browse by neighborhood, programmatic per-hood pages */}
        <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-6">
          <h2 className="mb-3 text-lg font-bold text-foreground sm:text-xl">Browse Gluten-Free by Neighborhood</h2>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["river-north","River North"],
              ["west-loop","West Loop"],
              ["lincoln-park","Lincoln Park"],
              ["lakeview","Lakeview"],
              ["the-loop","The Loop"],
              ["logan-square","Logan Square"],
              ["wicker-park","Wicker Park"],
              ["west-town","West Town"],
              ["andersonville","Andersonville"],
              ["south-loop","South Loop"],
              ["streeterville","Streeterville"],
              ["wrigleyville","Wrigleyville"],
              ["hyde-park","Hyde Park"],
              ["gold-coast","Gold Coast"],
              ["old-town","Old Town"],
              ["rogers-park","Rogers Park"],
              ["edgewater","Edgewater"],
              ["pilsen","Pilsen"],
              ["bucktown","Bucktown"],
              ["evanston","Evanston"],
              ["oak-park","Oak Park"],
              ["naperville","Naperville"],
              ["lincoln-square","Lincoln Square"],
              ["humboldt-park","Humboldt Park"],
              ["ukrainian-village","Ukrainian Village"],
            ].map(([slug, name]) => (
              <Link
                key={slug}
                href={`/dietary/gluten-free/${slug}`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-400"
              >
                {name}
              </Link>
            ))}
          </div>
        </section>

        {/* Related, desktop pills */}
        <section className="mx-auto max-w-7xl px-4 pb-12 lg:px-6">
          <h2 className="mb-3 text-lg font-bold text-foreground sm:text-xl">Related</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/search?gluten_free=true" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">
              <Search className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Search all GF deals
            </Link>
            <Link href="/guides/chicago-happy-hours" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">Happy Hours</Link>
            <Link href="/guides/best-brunch-chicago" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">Brunch Guide</Link>
            <Link href="/cuisine/mexican" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">Mexican</Link>
            <Link href="/cuisine/japanese" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">Japanese</Link>
          </div>
        </section>
      </main>

      {/* Mobile floating CTA, sticky bottom on small screens only.
          a11y: 24px viewport gutter (WCAG 2.5.5 target-size spacing),
          no aria-label (visible text IS the accessible name per WCAG 2.5.3). */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-6 pb-6 md:hidden">
        <Link
          href="/search?gluten_free=true"
          className="pointer-events-auto flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-amber-700 px-6 py-4 text-base font-bold text-white shadow-2xl shadow-amber-900/30 transition-colors hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search 400+ GF deals
        </Link>
      </div>

      <Footer />
    </div>
  )
}
