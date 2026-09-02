import Link from "next/link"
import type { Metadata } from "next"
import { Clock, MapPin, DollarSign, TrendingUp, Beer } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, formatTime } from "@/lib/seo-utils"
import type { Deal, SearchResponse, NeighborhoodSummaryResponse } from "@/lib/types"
import { statsEncoded } from "@/lib/product-stats"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getHappyHourDeals(): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?deal_type=happy_hour&limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

async function getNeighborhoodSummary() {
  try {
    const res = await fetch(`${API_URL}/api/v1/neighborhoods/summary?deal_type=happy_hour`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data: NeighborhoodSummaryResponse = await res.json()
    return data.neighborhoods ?? []
  } catch {
    return []
  }
}

// Targeted happy-hour sub-category fetch (patio / late-night / reverse), the
// whole-pool sample is too small to catch these by client-side filtering.
async function getHHCategory(extra: string): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?deal_type=happy_hour&${extra}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

function HHCategory({ title, subtitle, deals }: { title: string; subtitle: string; deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section className="mb-12">
      <h2 className="mb-1 text-2xl font-bold text-foreground">{title}</h2>
      <p className="mb-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {deals.slice(0, 9).map((d) => (
          <li key={d.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/venues/${d.venue_slug}`} className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400">
                {d.venue_name}
              </Link>
              {d.neighborhood && <span className="shrink-0 text-xs text-muted-foreground">{d.neighborhood}</span>}
            </div>
            <p className="mt-1 text-sm text-foreground">{d.title}</p>
            {d.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{d.description}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

export const metadata: Metadata = {
  title: "Chicago Happy Hours, 4,000+ Cheap Drink Specials Tonight",
  description:
    "Chicago happy hour tonight: 4,000+ cheap drink specials near you, $2 drafts, $5 cocktails, half-off apps & reverse happy hours by neighborhood.",
  openGraph: {
    title: "Chicago Happy Hours, 4,000+ Cheap Drink Specials Tonight",
    description:
      "Happy hour Chicago: 4,000+ specials tonight. Cheapest drinks by neighborhood, best times to go, and top bars across Chicago and 60+ suburbs.",
    url: `${SITE_URL}/guides/chicago-happy-hours`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Happy+Hour+Chicago+2026&subtitle=4,000%2B+specials+across+${statsEncoded.neighborhoods}+neighborhoods&emoji=%F0%9F%8D%B8&badges=Daily+by+neighborhood%2CDrink+%2B+food%2CCity+%26+suburbs&v=2`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chicago Happy Hours, 4,000+ Cheap Drink Specials Tonight",
    description:
      "Happy hour Chicago: 4,000+ specials tonight. Cheapest drinks by neighborhood, best times, and top bars across Chicagoland.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/chicago-happy-hours`,
  },
}

export default async function ChicagoHappyHourGuide() {
  const [deals, neighborhoods, patioHH, lateNightHH, reverseHH] = await Promise.all([
    getHappyHourDeals(),
    getNeighborhoodSummary(),
    getHHCategory("has_patio=true&limit=12"),
    getHHCategory("q=late&limit=12"),
    getHHCategory("q=reverse&limit=10"),
  ])

  // True per-neighborhood happy-hour counts come from the aggregate endpoint
  // (neighborhoods/summary?deal_type=happy_hour), NOT the rendered deal sample,
  // which would undercount wildly (River North shows ~479 here vs ~10 from a
  // 50-row sample). Falls back to the sample if the summary is unavailable.
  const hhHoods = (neighborhoods as Array<{ name: string; slug: string; deal_count?: number; venues_with_deal?: number }>)
    .filter((n) => (n.deal_count ?? 0) > 0)
  const summaryDeals = hhHoods.reduce((s, n) => s + (n.deal_count ?? 0), 0)
  const summaryVenues = hhHoods.reduce((s, n) => s + (n.venues_with_deal ?? 0), 0)

  const totalDeals = (summaryDeals > 0 ? summaryDeals : deals.length).toLocaleString()
  const uniqueVenues = (summaryVenues > 0 ? summaryVenues : new Set(deals.map((d) => d.venue_name)).size).toLocaleString()

  const topNeighborhoods =
    hhHoods.length > 0
      ? hhHoods.slice(0, 10).map((n) => ({ name: n.name, slug: n.slug, count: n.deal_count ?? 0 }))
      : Array.from(
          deals
            .reduce((m, d) => {
              if (d.neighborhood && d.neighborhood_slug) {
                const e = m.get(d.neighborhood_slug)
                if (e) e.count++
                else m.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, count: 1 })
              }
              return m
            }, new Map<string, { name: string; slug: string; count: number }>())
            .values()
        )
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)

  // Compute cheapest drinks. Filter out fountain-drink / chain noise that was
  // polluting the showcase: require a real neighborhood (also kills a dangling
  // "in ." in the copy) and drop generic non-special items like "Any Small or
  // Medium Beverage" (Corner Bakery) or "Unlimited Sip Club" (Panera).
  const NON_SPECIAL = /beverage|sip club|fountain|soft drink|refill/i
  const cheapDrinks: { name: string; price: number; venue: string; neighborhood: string }[] = []
  for (const d of deals) {
    if (!d.neighborhood) continue
    for (const item of Array.isArray(d.drink_items) ? d.drink_items : []) {
      if (item.deal_price && item.deal_price > 0 && item.name && !NON_SPECIAL.test(item.name)) {
        cheapDrinks.push({
          name: item.name,
          price: item.deal_price,
          venue: d.venue_name,
          neighborhood: d.neighborhood,
        })
      }
    }
  }
  cheapDrinks.sort((a, b) => a.price - b.price)
  const top10Cheapest = cheapDrinks.slice(0, 10)
  const cheapest = top10Cheapest[0]
    ? `${top10Cheapest[0].name} for $${top10Cheapest[0].price.toFixed(2)}`
    : null

  // Compute timing stats
  const startTimes = deals
    .map((d) => d.start_time)
    .filter(Boolean) as string[]
  const startCounts = new Map<string, number>()
  for (const t of startTimes) {
    startCounts.set(t, (startCounts.get(t) ?? 0) + 1)
  }
  const mostCommonStart = startCounts.size > 0
    ? Array.from(startCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null

  const endTimes = deals
    .map((d) => d.end_time)
    .filter(Boolean) as string[]
  const endCounts = new Map<string, number>()
  for (const t of endTimes) {
    endCounts.set(t, (endCounts.get(t) ?? 0) + 1)
  }
  const mostCommonEnd = endCounts.size > 0
    ? Array.from(endCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null

  // FAQ items
  const faqItems = [
    {
      q: "What are the best happy hours in Chicago?",
      a: `Chicago has ${totalDeals} active happy hour deals across ${uniqueVenues} bars and restaurants. ${topNeighborhoods.slice(0, 3).map((n) => `${n.name} has ${n.count} deals`).join(", ")}.`,
    },
    {
      q: "When do happy hours start in Chicago?",
      a: mostCommonStart
        ? `Most Chicago happy hours start at ${formatTime(mostCommonStart)}${mostCommonEnd ? ` and end at ${formatTime(mostCommonEnd)}` : ""}. Times vary by venue and neighborhood.`
        : "Happy hour times vary by venue. Most start between 3-5 PM on weekdays.",
    },
    {
      q: "What is the cheapest happy hour drink in Chicago?",
      a: top10Cheapest.length > 0
        ? `The cheapest happy hour drink we found is $${top10Cheapest[0].price.toFixed(2)} ${top10Cheapest[0].name} at ${top10Cheapest[0].venue}. We track ${cheapDrinks.length}+ drink deals across Chicago.`
        : "Browse our deal database to find the cheapest drinks near you.",
    },
    {
      q: "Which Chicago neighborhood has the most happy hours?",
      a: topNeighborhoods.length > 0
        ? `${topNeighborhoods[0].name} leads with ${topNeighborhoods[0].count} happy hour deals, followed by ${topNeighborhoods.slice(1, 4).map((n) => `${n.name} (${n.count})`).join(", ")}.`
        : "Search our deal database by neighborhood to find happy hours near you.",
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
                  { name: "Chicago Happy Hour Guide", url: `${SITE_URL}/guides/chicago-happy-hours` },
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
                "headline": "Chicago Happy Hour Guide 2026, Best Deals by Neighborhood",
                "description": `We analyzed ${totalDeals}+ happy hour deals across ${uniqueVenues} Chicago bars and restaurants to find the cheapest drinks, best times, and top neighborhoods.`,
                "url": `${SITE_URL}/guides/chicago-happy-hours`,
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/chicago-happy-hours`,
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
                "image": `${SITE_URL}/api/og?title=Chicago+Happy+Hour+Guide+2026&subtitle=Best+deals+across+${statsEncoded.neighborhoods}+neighborhoods&emoji=%F0%9F%8D%B8&badges=Daily+by+neighborhood%2CDrink+%2B+food%2CCity+%26+suburbs&v=2`,
                "datePublished": "2026-02-18",
                "dateModified": new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <span className="text-foreground">Chicago Happy Hour Guide</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Happy Hour Chicago 2026, Best Specials by Neighborhood
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Looking for happy hour in Chicago? We track {totalDeals}+ active happy hour deals across {uniqueVenues} Chicago bars, restaurants, and patios, ranked by neighborhood and updated daily.
              {cheapest && ` The cheapest drink right now: ${cheapest}.`}
              {mostCommonStart && ` Most Chicago happy hours start at ${formatTime(mostCommonStart)}.`}
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{totalDeals}</div>
              <div className="text-xs text-muted-foreground">Happy Hour Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{uniqueVenues}</div>
              <div className="text-xs text-muted-foreground">Bars & Restaurants</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Clock className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">
                {mostCommonStart ? formatTime(mostCommonStart) : "3PM"}
              </div>
              <div className="text-xs text-muted-foreground">Most Common Start</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <DollarSign className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">
                {top10Cheapest.length > 0 ? `$${top10Cheapest[0].price.toFixed(0)}` : "$3"}
              </div>
              <div className="text-xs text-muted-foreground">Cheapest Drink</div>
            </div>
          </div>

          {/* Section: Best Neighborhoods */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Best Happy Hours in Chicago by Neighborhood
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Not all neighborhoods are created equal when it comes to happy hours.
              {topNeighborhoods.length > 0 && ` ${topNeighborhoods[0].name} dominates with ${topNeighborhoods[0].count} happy hour deals, making it the go-to neighborhood for after-work drinks.`}
              {" "}Here are the top 10 neighborhoods ranked by number of happy hour deals:
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Top 10 Chicago neighborhoods ranked by number of happy hour deals">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Rank</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Happy Hour Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {topNeighborhoods.map((nh, i) => (
                    <tr key={nh.slug} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/happy-hours/${nh.slug}`}
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

          {/* Section: Cheapest Drinks */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Cheapest Happy Hour Drinks in Chicago
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Looking for the absolute cheapest drinks during happy hour?
              We track pricing data on {cheapDrinks.length}+ drink specials across Chicago.
              {top10Cheapest.length > 0 && ` The best deal we found: $${top10Cheapest[0].price.toFixed(2)} ${top10Cheapest[0].name} at ${top10Cheapest[0].venue} in ${top10Cheapest[0].neighborhood}.`}
            </p>
            {top10Cheapest.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm" aria-label="10 cheapest happy hour drinks in Chicago with price, venue, and neighborhood">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Drink</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Price</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Venue</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10Cheapest.map((drink, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-foreground">{drink.name}</td>
                        <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">
                          ${drink.price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-foreground">{drink.venue}</td>
                        <td className="px-4 py-3 text-muted-foreground">{drink.neighborhood}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section: When Do Happy Hours Start */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              When Do Chicago Happy Hours Start?
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              {mostCommonStart
                ? `The most common happy hour start time in Chicago is ${formatTime(mostCommonStart)}.`
                : "Most Chicago happy hours start between 3-5 PM."
              }
              {mostCommonEnd && ` Most end by ${formatTime(mostCommonEnd)}.`}
              {" "}However, times vary widely. Some bars start as early as 11 AM (all-day happy hours), while others
              offer late-night reverse happy hours starting at 9 PM or later.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pro tip: Many Chicago bars offer the best deals during off-peak hours. If you can make it for a
              3 PM start, you&apos;ll often find the deepest discounts and plenty of seating.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              For more on Chicago&apos;s dining scene, see the{" "}
              <a
                href="https://www.choosechicago.com/restaurants/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline dark:text-brand-400"
              >
                Choose Chicago restaurant guide
              </a>{" "}
              and the{" "}
              <a
                href="https://www.chicago.gov/city/en/depts/bacp/provdrs/liquor.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline dark:text-brand-400"
              >
                City of Chicago liquor license information
              </a>.
            </p>
          </section>

          {/* Category breakdowns, targeted fetches (patio / late-night / reverse) */}
          <HHCategory
            title="Happy Hours on the Patio"
            subtitle="Outdoor seating plus a happy hour, the best of a Chicago summer. These spots run their drink and app specials on the patio."
            deals={patioHH}
          />
          <HHCategory
            title="Late-Night Happy Hours"
            subtitle="The kitchen's open and the deals are still running. After-9 PM and late-night happy hours for the second-shift crowd and night owls."
            deals={lateNightHH}
          />
          <HHCategory
            title="Reverse Happy Hours"
            subtitle="The discounts that kick in when the dinner rush leaves, late-evening drink and appetizer specials at these bars and restaurants."
            deals={reverseHH}
          />

          {/* Section: Find Near You */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Find Happy Hours Near You
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Use our{" "}
              <Link href="/map" className="text-brand-600 hover:underline dark:text-brand-400">
                interactive deal map
              </Link>{" "}
              to find happy hours closest to your location, or browse deals by{" "}
              <Link href="/neighborhoods" className="text-brand-600 hover:underline dark:text-brand-400">
                neighborhood
              </Link>
              . You can also{" "}
              <Link href="/search" className="text-brand-600 hover:underline dark:text-brand-400">
                search all deals
              </Link>{" "}
              by day, cuisine, or price range. For more ways to save, browse the full{" "}
              <Link href="/deals" className="text-brand-600 hover:underline dark:text-brand-400">
                Chicago food &amp; drink deals
              </Link>{" "}
              hub or our{" "}
              <Link href="/guides/cheap-drinks-chicago" className="text-brand-600 hover:underline dark:text-brand-400">
                cheap drinks in Chicago
              </Link>{" "}
              guide.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/happy-hours"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                Browse by Neighborhood
              </Link>
              <Link
                href="/map"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                View Deal Map
              </Link>
              <Link
                href="/search?deal_type=happy_hour"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Search Happy Hours
              </Link>
            </div>
          </section>

          {/* Browse neighborhoods */}
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-foreground">
              All Chicago Neighborhoods with Happy Hours
            </h2>
            <div className="flex flex-wrap gap-2">
              {topNeighborhoods.map((nh) => (
                <Link
                  key={nh.slug}
                  href={`/happy-hours/${nh.slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                >
                  {nh.name} ({nh.count})
                </Link>
              ))}
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

          {/* Methodology */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              About This Guide
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This guide is based on data from 312Deals, which tracks {totalDeals}+ happy hour deals
              across Chicago. Deals are scraped from restaurant websites and verified by our community.
              Data is updated weekly. Prices and times may change without notice, always confirm with
              the venue directly. Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
