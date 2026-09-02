import Link from "next/link"
import dynamic from "next/dynamic"
import type { Metadata } from "next"
import { MapPin, Beer, Calendar, Compass } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { BookingCTA } from "@/components/booking-cta"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

const PatioDrinkThemes = dynamic(() => import("@/components/patio-drink-themes"), { ssr: false })

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getCincoDeals(): Promise<Deal[]> {
  const queries = ["cinco", "margarita", "tequila", "mezcal", "taco tuesday", "mariachi"]
  const allDeals = new Map<number, Deal>()

  await Promise.all(
    queries.map(async (q) => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/deals/search?q=${encodeURIComponent(q)}&limit=200`,
          { next: { revalidate: 3600 } }
        )
        if (!res.ok) return
        const data: SearchResponse = await res.json()
        for (const deal of data.deals ?? []) {
          if (!allDeals.has(deal.id)) {
            allDeals.set(deal.id, deal)
          }
        }
      } catch {
        // skip failed queries
      }
    })
  )

  return Array.from(allDeals.values())
}

/** Strict filter: only deals that mention Cinco de Mayo specifically */
function isCincoDeal(deal: Deal): boolean {
  const text = `${deal.title} ${deal.description ?? ""}`.toLowerCase()
  return /cinco\s*de\s*mayo|cinco\s*de\s*drink|cinco\s*weekend|cinco\s*kickoff/.test(text)
}

/** Looser filter: margarita / tequila / mariachi specials, useful supporting list */
function isCincoAdjacent(deal: Deal): boolean {
  const text = `${deal.title} ${deal.description ?? ""}`.toLowerCase()
  return /margarita|tequila|mezcal|mariachi|paloma/.test(text)
}

const EXCLUDED_VENUE_PATTERNS = [/^chipotle/i, /^taco\s*bell/i]

function excludeBlockedVenues(deals: Deal[]): Deal[] {
  return deals.filter((d) => {
    const name = d.venue_name ?? ""
    return !EXCLUDED_VENUE_PATTERNS.some((re) => re.test(name))
  })
}

export const metadata: Metadata = {
  title: "Cinco de Mayo Chicago 2026, Margarita & Taco Deals Tonight | 312Deals",
  description:
    "Every Cinco de Mayo food and drink deal in Chicago for 2026. Live margarita prices, $5 boot shots, mariachi bands, and all-day specials across the West Loop, Lakeview, Logan Square, and the suburbs.",
  openGraph: {
    title: "Cinco de Mayo Chicago 2026 | 312Deals",
    description:
      "Live margarita & taco deals across Chicago for Cinco de Mayo. Every special by neighborhood, West Loop, Lakeview, Logan Square, Lincoln Park, and the suburbs.",
    url: `${SITE_URL}/guides/cinco-de-mayo-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Cinco+de+Mayo+Chicago+2026&subtitle=Margarita+%26+taco+deals+across+Chicago`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cinco de Mayo Chicago 2026 | 312Deals",
    description: "Live margarita & taco deals across Chicago for Cinco de Mayo. Every special by neighborhood.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/cinco-de-mayo-chicago`,
  },
}

export default async function CincoDeMayoGuide() {
  const allDealsRaw = await getCincoDeals()
  const allDeals = excludeBlockedVenues(allDealsRaw)
  const cincoDeals = allDeals.filter(isCincoDeal)
  const adjacentDeals = allDeals.filter((d) => !isCincoDeal(d) && isCincoAdjacent(d))

  const totalDeals = cincoDeals.length
  const uniqueVenues = new Set(cincoDeals.map((d) => d.venue_name)).size

  // Group Cinco deals by neighborhood
  const byNeighborhood = new Map<string, { name: string; slug: string; deals: Deal[] }>()
  for (const d of cincoDeals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = byNeighborhood.get(d.neighborhood_slug)
      if (existing) {
        existing.deals.push(d)
      } else {
        byNeighborhood.set(d.neighborhood_slug, {
          name: d.neighborhood,
          slug: d.neighborhood_slug,
          deals: [d],
        })
      }
    }
  }
  const neighborhoods = Array.from(byNeighborhood.values()).sort(
    (a, b) => b.deals.length - a.deals.length
  )

  // Build "Year-round margarita deals", adjacent deals consolidated by venue.
  // Pull cheapest margarita item price from drink_items when available.
  type MargaritaPick = {
    venue_name: string
    venue_slug: string
    neighborhood: string
    neighborhood_slug: string
    deal_title: string
    deal_id: number
    cheapest_marg_price: number | null
    cheapest_marg_name: string | null
  }
  const margaritaPicks: MargaritaPick[] = []
  const seenVenuesForMargs = new Set<string>()
  for (const d of adjacentDeals) {
    if (!d.venue_slug || seenVenuesForMargs.has(d.venue_slug)) continue
    let cheapestPrice: number | null = null
    let cheapestName: string | null = null
    if (Array.isArray(d.drink_items)) {
      for (const item of d.drink_items) {
        if (!item?.name) continue
        const lower = item.name.toLowerCase()
        if (!/marg|paloma/.test(lower)) continue
        if (item.deal_price != null && item.deal_price > 0) {
          if (cheapestPrice == null || item.deal_price < cheapestPrice) {
            cheapestPrice = item.deal_price
            cheapestName = item.name
          }
        } else if (cheapestName == null) {
          cheapestName = item.name
        }
      }
    }
    seenVenuesForMargs.add(d.venue_slug)
    margaritaPicks.push({
      venue_name: d.venue_name,
      venue_slug: d.venue_slug,
      neighborhood: d.neighborhood ?? "",
      neighborhood_slug: d.neighborhood_slug ?? "",
      deal_title: d.title,
      deal_id: d.id,
      cheapest_marg_price: cheapestPrice,
      cheapest_marg_name: cheapestName,
    })
  }
  // Sort: priced cheapest first, then unpriced
  margaritaPicks.sort((a, b) => {
    if (a.cheapest_marg_price != null && b.cheapest_marg_price != null) {
      return a.cheapest_marg_price - b.cheapest_marg_price
    }
    if (a.cheapest_marg_price != null) return -1
    if (b.cheapest_marg_price != null) return 1
    return 0
  })
  // Diversify: max 2 per neighborhood, cap at 24
  const margaritaShortlist: MargaritaPick[] = []
  const margHoodCount = new Map<string, number>()
  for (const p of margaritaPicks) {
    const k = p.neighborhood_slug || "_"
    if ((margHoodCount.get(k) ?? 0) >= 2) continue
    margaritaShortlist.push(p)
    margHoodCount.set(k, (margHoodCount.get(k) ?? 0) + 1)
    if (margaritaShortlist.length >= 24) break
  }

  const faqItems = [
    {
      q: "What are the best Cinco de Mayo deals in Chicago 2026?",
      a: `We're tracking ${totalDeals} Cinco de Mayo specials across ${uniqueVenues} Chicago venues right now. ${neighborhoods.slice(0, 3).map((n) => `${n.name} has ${n.deals.length} deals`).join(", ")}. Top picks include $10 margaritas at Costera Cocina Tulum (West Loop), $6 tequila shots at Ranalli's, and all-day mariachi at Fat Rosie's in Naperville.`,
    },
    {
      q: "When is Cinco de Mayo 2026?",
      a: "Cinco de Mayo 2026 falls on Tuesday, May 5, which makes it Taco Tuesday too. Most Chicago bars and restaurants run their specials on May 5 itself, but several spots extend the celebration across the weekend before (May 2–4).",
    },
    {
      q: "Which Chicago neighborhoods have the most Cinco de Mayo specials?",
      a: neighborhoods.length > 0
        ? `${neighborhoods[0].name} leads with ${neighborhoods[0].deals.length} specials, followed by ${neighborhoods.slice(1, 5).map((n) => `${n.name} (${n.deals.length})`).join(", ")}. Logan Square is the under-covered sleeper this year.`
        : "Lakeview, West Loop, and Logan Square typically have the highest concentration of Cinco de Mayo events.",
    },
    {
      q: "Where can I get the cheapest margaritas tonight?",
      a: "$7 House Lime Margaritas at El Mariachi Tequila Bar (Lakeview, M–F 4–6pm). $8 lime margaritas at Cesar's Killer Margaritas (Lakeview, M–Th 3–6pm). $10 all-day Cinco margs at Costera Cocina Tulum (West Loop). $10 House Margaritas at Ema (River North) during happy hour.",
    },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <article className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
          {/* JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: SITE_URL },
                  { name: "Guides", url: `${SITE_URL}/guides` },
                  { name: "Cinco de Mayo Chicago", url: `${SITE_URL}/guides/cinco-de-mayo-chicago` },
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
              __html: JSON.stringify(
                buildItemListJsonLd(
                  "Cinco de Mayo Chicago Deals 2026",
                  `${SITE_URL}/guides/cinco-de-mayo-chicago`,
                  cincoDeals
                )
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Event",
                name: "Cinco de Mayo Chicago 2026",
                description: `${totalDeals} food and drink specials across ${uniqueVenues} Chicago venues for Cinco de Mayo 2026.`,
                startDate: "2026-05-05",
                endDate: "2026-05-05",
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                eventStatus: "https://schema.org/EventScheduled",
                location: {
                  "@type": "City",
                  name: "Chicago",
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: "Chicago",
                    addressRegion: "IL",
                    addressCountry: "US",
                  },
                },
                organizer: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                },
                url: `${SITE_URL}/guides/cinco-de-mayo-chicago`,
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "Cinco de Mayo Chicago 2026, Where to Get $10 Margaritas, $5 Boot Shots, and Mariachi Tonight",
                description: `${totalDeals} Cinco de Mayo food and drink specials across ${uniqueVenues} Chicago venues. Every deal mapped by neighborhood.`,
                url: `${SITE_URL}/guides/cinco-de-mayo-chicago`,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/cinco-de-mayo-chicago`,
                },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
                },
                image: `${SITE_URL}/api/og?title=Cinco+de+Mayo+Chicago+2026&subtitle=Margarita+%26+taco+deals+across+Chicago`,
                datePublished: "2026-05-05",
                dateModified: new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
              <span>/</span>
              <Link href="/guides" className="transition-colors hover:text-foreground">Guides</Link>
              <span>/</span>
              <span className="text-foreground">Cinco de Mayo Chicago</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Cinco de Mayo in Chicago Tonight, Where the Deals Actually Are
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Cinco de Mayo lands on a Tuesday this year, which means it&apos;s also{" "}
              <Link href="/deals/taco-tuesday" className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400">Taco Tuesday</Link>. We pulled the live deal data
              for every Mexican spot in our index. {totalDeals} explicit Cinco specials across {uniqueVenues} venues, plus {adjacentDeals.length}+ supporting margarita and tequila deals running today.
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{totalDeals}</div>
              <div className="text-xs text-muted-foreground">Cinco Specials</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{uniqueVenues}</div>
              <div className="text-xs text-muted-foreground">Venues</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Compass className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{neighborhoods.length}</div>
              <div className="text-xs text-muted-foreground">Neighborhoods</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">May 5</div>
              <div className="text-xs text-muted-foreground">Tue · Taco Tuesday too</div>
            </div>
          </div>

          {/* Neighborhoods pill grid */}
          {neighborhoods.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Neighborhoods with Cinco de Mayo Deals</h2>
              <div className="flex flex-wrap gap-2">
                {neighborhoods.map((nh) => (
                  <Link
                    key={nh.slug}
                    href={`/neighborhoods/${nh.slug}`}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-foreground"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>{nh.name}</span>
                    <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground group-hover:bg-brand-500/15 group-hover:text-brand-600 dark:group-hover:text-brand-300">
                      {nh.deals.length}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Drink themes, margaritas, tequila, cocktails, buckets.
              Feeds the FULL pool (cinco + adjacent margarita/tequila deals)
              so the Cheap Cocktails tab surfaces the deep margarita inventory,
              not just the ~21 strict Cinco entries. */}
          {(cincoDeals.length + adjacentDeals.length) > 0 && (
            <section className="mb-12">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-foreground">Deals by Drink Category</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Specific themes pulled from live deal items, margaritas, cocktails, buckets, wines, and more.
                  Pulls from {cincoDeals.length} Cinco-specific deals plus {adjacentDeals.length}+ year-round margarita and tequila deals.
                </p>
              </div>
              <PatioDrinkThemes deals={[...cincoDeals, ...adjacentDeals]} />
            </section>
          )}

          {/* Deals by Neighborhood */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">Cinco de Mayo Deals by Neighborhood</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Every Cinco-specific deal we have, grouped by neighborhood. Logan Square is the most under-covered hood
              this year, six venues, fewest crowds.
            </p>
            <div className="space-y-6">
              {neighborhoods.map((nh) => (
                <div key={nh.slug}>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">
                    <Link href={`/neighborhoods/${nh.slug}`} className="hover:text-brand-600 dark:hover:text-brand-400">
                      {nh.name}
                    </Link>
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({nh.deals.length} {nh.deals.length === 1 ? "deal" : "deals"})
                    </span>
                  </h3>
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {nh.deals.map((d) => (
                      <li key={d.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/venues/${d.venue_slug}`}
                              className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                            >
                              {d.venue_name}
                            </Link>
                            <p className="mt-0.5 text-sm text-foreground">{d.title}</p>
                            {d.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{d.description}</p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Year-round margarita deals (no Cinco mention but worth a stop) */}
          {margaritaShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">More Margarita Deals, Year-Round Specials</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Not Cinco-specific, but running every week. {adjacentDeals.length}+ margarita and tequila deals in the
                index, top {margaritaShortlist.length} below, sorted cheapest first, max 2 per neighborhood.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {margaritaShortlist.map((p) => (
                  <li key={p.deal_id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/venues/${p.venue_slug}`}
                          className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          {p.venue_name}
                        </Link>
                        {p.neighborhood && (
                          <span className="ml-2 text-xs text-muted-foreground">{p.neighborhood}</span>
                        )}
                        <p className="mt-0.5 text-sm text-foreground">{p.deal_title}</p>
                        {p.cheapest_marg_name && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{p.cheapest_marg_name}</p>
                        )}
                      </div>
                      {p.cheapest_marg_price != null && (
                        <span className="shrink-0 text-base font-bold text-green-600 dark:text-green-400 tabular-nums">
                          ${p.cheapest_marg_price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <BookingCTA
            campaign="cinco_de_mayo_guide"
            headline="Making a weekend of it?"
            subhead="Find hotels close to Pilsen, Little Village, and Wicker Park celebrations. Free cancellation on most rooms."
          />

          {/* Email Signup */}
          <section className="mb-12">
            <EmailSignup source="guide_cinco_de_mayo" />
          </section>

          {/* FAQ */}
          <section className="mb-12 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold text-foreground">Frequently Asked Questions</h2>
            <dl className="space-y-4">
              {faqItems.map((item, i) => (
                <div key={i}>
                  <dt className="text-sm font-semibold text-foreground">{item.q}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* About */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">About This Guide</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Live data from 312Deals, {totalDeals} Cinco de Mayo deals across {uniqueVenues} Chicago venues, refreshed
              from venue websites and verified within the last week. Prices and availability change without notice;
              call ahead for the high-traffic spots. Last updated:{" "}
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
