import Link from "next/link"
import type { Metadata } from "next"
import { UtensilsCrossed, MapPin, Calendar, DollarSign, TrendingUp, Clock } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildCheapestDrink, formatTime } from "@/lib/seo-utils"
import type { Deal, SearchResponse, NeighborhoodSummaryResponse } from "@/lib/types"
import { stats } from "@/lib/product-stats"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getAllDeals(): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

async function getTotalDealCount(): Promise<number> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?limit=1`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return 8000
    const data: SearchResponse = await res.json()
    return data.total ?? 8000
  } catch {
    return 8000
  }
}

async function getNeighborhoodSummary() {
  try {
    const res = await fetch(`${API_URL}/api/v1/neighborhoods/summary`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data: NeighborhoodSummaryResponse = await res.json()
    return data.neighborhoods ?? []
  } catch {
    return []
  }
}

export const metadata: Metadata = {
  title: "Chicago Food Deals Guide 2026, Best Specials & Cheap Eats | 312Deals",
  description:
    `The definitive guide to food deals in Chicago. Find the cheapest meals, best deal days, top neighborhoods for specials, and ${stats.deals} verified deals across ${stats.neighborhoods} neighborhoods.`,
  openGraph: {
    title: "Chicago Food Deals Guide 2026 | 312Deals",
    description:
      "The definitive guide to food deals in Chicago. Cheapest meals, best days, and top neighborhoods for specials.",
    url: `${SITE_URL}/guides/chicago-food-deals`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Chicago+Food+Deals+Guide+2026&subtitle=Best+specials+across+73+neighborhoods`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chicago Food Deals Guide 2026 | 312Deals",
    description:
      "The definitive guide to food deals in Chicago. Cheapest meals, best days, and top neighborhoods.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/chicago-food-deals`,
  },
}

export default async function ChicagoFoodDealsGuide() {
  const [deals, totalDeals, neighborhoods] = await Promise.all([
    getAllDeals(),
    getTotalDealCount(),
    getNeighborhoodSummary(),
  ])

  const uniqueVenues = new Set(deals.map((d) => d.venue_name)).size

  // Compute cheapest food items
  const cheapFood: { name: string; price: number; venue: string; neighborhood: string }[] = []
  for (const d of deals) {
    for (const item of Array.isArray(d.food_items) ? d.food_items : []) {
      if (item.deal_price && item.deal_price > 0) {
        cheapFood.push({
          name: item.name,
          price: item.deal_price,
          venue: d.venue_name,
          neighborhood: d.neighborhood ?? "",
        })
      }
    }
  }
  cheapFood.sort((a, b) => a.price - b.price)
  const top10CheapestFood = cheapFood.slice(0, 10)

  // Compute cheapest drinks
  const cheapDrinks: { name: string; price: number; venue: string; neighborhood: string }[] = []
  for (const d of deals) {
    for (const item of Array.isArray(d.drink_items) ? d.drink_items : []) {
      if (item.deal_price && item.deal_price > 0) {
        cheapDrinks.push({
          name: item.name,
          price: item.deal_price,
          venue: d.venue_name,
          neighborhood: d.neighborhood ?? "",
        })
      }
    }
  }
  cheapDrinks.sort((a, b) => a.price - b.price)
  const top10CheapestDrinks = cheapDrinks.slice(0, 10)

  // Deal type distribution
  const dealTypeCounts = new Map<string, number>()
  for (const d of deals) {
    dealTypeCounts.set(d.deal_type, (dealTypeCounts.get(d.deal_type) ?? 0) + 1)
  }
  const dealTypeLabels: Record<string, string> = {
    happy_hour: "Happy Hour",
    daily_special: "Daily Specials",
    brunch_deal: "Brunch Deals",
    late_night: "Late Night",
    chain_app_deal: "Chain App Deals",
    game_day: "Game Day",
    seasonal_lto: "Limited Time Offers",
    loyalty_reward: "Loyalty Rewards",
  }
  const topDealTypes = Array.from(dealTypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Neighborhood deal counts
  const nhDealCounts = new Map<string, { name: string; slug: string; count: number }>()
  for (const d of deals) {
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
    .slice(0, 10)

  // Day of week distribution
  const dayCounts = new Map<string, number>()
  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  const dayLabels: Record<string, string> = {
    monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
    thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
  }
  for (const d of deals) {
    for (const day of Array.isArray(d.days_available) ? d.days_available : []) {
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1)
    }
  }
  const bestDay = dayOrder.reduce((best, day) =>
    (dayCounts.get(day) ?? 0) > (dayCounts.get(best) ?? 0) ? day : best
  , dayOrder[0])

  // FAQ items
  const faqItems = [
    {
      q: "What are the best food deals in Chicago?",
      a: `Chicago has ${totalDeals.toLocaleString()}+ active food and drink deals across ${stats.venues} venues. The best deals include happy hours with $3-5 drinks, Taco Tuesday specials, wing nights, and brunch deals with bottomless mimosas. 312Deals tracks every deal with specific prices and menu items.`,
    },
    {
      q: "Which Chicago neighborhood has the most food deals?",
      a: topNeighborhoods.length > 0
        ? `${topNeighborhoods[0].name} leads with ${topNeighborhoods[0].count} deals in our sample, followed by ${topNeighborhoods.slice(1, 4).map((n) => `${n.name} (${n.count})`).join(", ")}. Use 312Deals to browse all deals by neighborhood.`
        : "Browse 312Deals by neighborhood to find the most deals near you.",
    },
    {
      q: "What is the cheapest meal deal in Chicago?",
      a: top10CheapestFood.length > 0
        ? `The cheapest food deal we found is $${top10CheapestFood[0].price.toFixed(2)} ${top10CheapestFood[0].name} at ${top10CheapestFood[0].venue} in ${top10CheapestFood[0].neighborhood}. We track ${cheapFood.length}+ food deals with specific prices.`
        : "Browse 312Deals and filter by price range to find the cheapest meals near you.",
    },
    {
      q: "What day has the most food deals in Chicago?",
      a: `${dayLabels[bestDay]} has the most deals in our database with ${dayCounts.get(bestDay) ?? 0} active specials. Tuesday is big for taco deals, Wednesday for wing nights, and weekends for brunch specials. Every day has hundreds of active deals across Chicago.`,
    },
    {
      q: "Are there brunch deals in Chicago?",
      a: `Yes, Chicago has hundreds of brunch deals every weekend including bottomless mimosas, bloody mary bars, and prix fixe menus. Top neighborhoods for brunch deals include Wicker Park, Lincoln Park, Lakeview, and the West Loop. Search 312Deals for brunch deals by neighborhood.`,
    },
    {
      q: "Where can I find cheap drinks in Chicago?",
      a: top10CheapestDrinks.length > 0
        ? `The cheapest drink deal we found is $${top10CheapestDrinks[0].price.toFixed(2)} ${top10CheapestDrinks[0].name} at ${top10CheapestDrinks[0].venue}. We track ${cheapDrinks.length}+ drink deals across Chicago with specific pricing.`
        : `Use 312Deals to search for drink deals by price range across all ${stats.neighborhoods} neighborhoods.`,
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
                  { name: "Chicago Food Deals Guide", url: `${SITE_URL}/guides/chicago-food-deals` },
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
                "headline": "Chicago Food Deals Guide 2026, Best Specials & Cheap Eats",
                "description": `We analyzed ${totalDeals.toLocaleString()}+ food deals across Chicago to find the cheapest meals, best deal days, and top neighborhoods for specials.`,
                "url": `${SITE_URL}/guides/chicago-food-deals`,
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/chicago-food-deals`,
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
                "image": `${SITE_URL}/api/og?title=Chicago+Food+Deals+Guide+2026&subtitle=Best+specials+across+73+neighborhoods`,
                "datePublished": "2026-03-08",
                "dateModified": new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <span className="text-foreground">Chicago Food Deals Guide</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Chicago Food Deals Guide 2026
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Last updated May 2026
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              We analyzed {totalDeals.toLocaleString()}+ food and drink deals across {stats.venues} Chicago
              restaurants and bars to find the cheapest meals, best deal days, and top neighborhoods
              for specials.
              {top10CheapestFood.length > 0 && ` The cheapest food deal: $${top10CheapestFood[0].price.toFixed(2)} ${top10CheapestFood[0].name} at ${top10CheapestFood[0].venue}.`}
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <UtensilsCrossed className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{totalDeals.toLocaleString()}+</div>
              <div className="text-xs text-muted-foreground">Active Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{stats.venues}</div>
              <div className="text-xs text-muted-foreground">Venues</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <DollarSign className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">
                {top10CheapestFood.length > 0 ? `$${top10CheapestFood[0].price.toFixed(0)}` : "$2"}
              </div>
              <div className="text-xs text-muted-foreground">Cheapest Food Deal</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{dayLabels[bestDay]?.slice(0, 3) ?? "Thu"}</div>
              <div className="text-xs text-muted-foreground">Best Deal Day</div>
            </div>
          </div>

          {/* Deal Types */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Types of Food Deals in Chicago
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Chicago restaurants offer many types of deals. Here&apos;s what&apos;s available and
              how many we track in each category:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {topDealTypes.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                  <span className="text-sm font-medium text-foreground">
                    {dealTypeLabels[type] ?? type.replace(/_/g, " ")}
                  </span>
                  <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
                    {count} deals
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Top Neighborhoods */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Best Neighborhoods for Food Deals
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {topNeighborhoods.length > 0
                ? `${topNeighborhoods[0].name} has the most food deals in our sample with ${topNeighborhoods[0].count} active specials. Here are the top 10 neighborhoods ranked by deal count:`
                : "Browse deals by neighborhood to find specials near you."}
            </p>
            {topNeighborhoods.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm" aria-label="Top 10 Chicago neighborhoods ranked by number of food deals">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Rank</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                      <th className="px-4 py-3 text-right font-semibold text-foreground">Deals</th>
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
            )}
          </section>

          {/* Cheapest Food */}
          {top10CheapestFood.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">
                Cheapest Food Deals in Chicago
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Looking for the absolute cheapest meals? We track pricing data
                on {cheapFood.length}+ food specials across Chicago. Here are the 10 cheapest
                food items we found:
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm" aria-label="10 cheapest food deals in Chicago with price, venue, and neighborhood">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Item</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Price</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Venue</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10CheapestFood.map((item, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-foreground">{item.name}</td>
                        <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">
                          ${item.price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-foreground">{item.venue}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.neighborhood}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Cheapest Drinks */}
          {top10CheapestDrinks.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">
                Cheapest Drink Deals in Chicago
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                We track {cheapDrinks.length}+ drink specials across Chicago.
                {top10CheapestDrinks.length > 0 && ` The cheapest: $${top10CheapestDrinks[0].price.toFixed(2)} ${top10CheapestDrinks[0].name} at ${top10CheapestDrinks[0].venue}.`}
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm" aria-label="10 cheapest drink deals in Chicago with price, venue, and neighborhood">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Drink</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Price</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Venue</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10CheapestDrinks.map((drink, i) => (
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
            </section>
          )}

          {/* Best Days */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Best Days for Food Deals in Chicago
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Every day has deals, but some days have more than others. Here&apos;s how
              deals are distributed across the week:
            </p>
            <div className="space-y-2">
              {dayOrder.map((day) => {
                const count = dayCounts.get(day) ?? 0
                const maxCount = Math.max(...dayOrder.map((d) => dayCounts.get(d) ?? 0), 1)
                const pct = Math.round((count / maxCount) * 100)
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-20 text-sm font-medium text-foreground">{dayLabels[day]}</span>
                    <div className="flex-1">
                      <div className="h-6 rounded-full bg-secondary">
                        <div
                          className="flex h-6 items-center rounded-full bg-brand-500/20 px-3"
                          style={{ width: `${Math.max(pct, 10)}%` }}
                        >
                          <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                            {count}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* CTA */}
          <section className="mb-12 rounded-xl border border-brand-300 bg-brand-500/5 p-6 text-center">
            <h2 className="text-xl font-bold text-foreground">
              Find Your Next Deal
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Search {totalDeals.toLocaleString()}+ food and drink deals across Chicago and 60+ suburbs.
              Filter by day, cuisine, price range, or deal type.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                href="/search"
                className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                Search All Deals
              </Link>
              <Link
                href="/deals/happy-hours"
                className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Happy Hours
              </Link>
              <Link
                href="/deals/brunch-deals"
                className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Brunch Deals
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

          {/* Related guides */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">More Chicago Deal Guides</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/guides/chicago-happy-hours"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Chicago Happy Hour Guide
              </Link>
              <Link
                href="/student-guides"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Student Deal Guides
              </Link>
            </div>
          </section>

          {/* Methodology */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">About This Guide</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This guide is based on data from 312Deals, which tracks {totalDeals.toLocaleString()}+ food and drink
              deals across Chicago. Deals are scraped from restaurant websites, social media, and newsletters,
              then verified weekly. Prices, hours, and availability may change without notice, always confirm
              with the venue directly. Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
