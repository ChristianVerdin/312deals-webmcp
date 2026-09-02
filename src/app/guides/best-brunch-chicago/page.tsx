import Link from "next/link"
import type { Metadata } from "next"
import { Coffee, MapPin, DollarSign, Wine } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { BookingCTA } from "@/components/booking-cta"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, formatTime } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"
import { stats } from "@/lib/product-stats"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getBrunchDeals(): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?deal_type=brunch_deal&limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

async function getBottomlessDeals(): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?deal_type=brunch_deal&query=bottomless&limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

export const metadata: Metadata = {
  title: "Best Brunch Deals in Chicago 2026, Bottomless & More | 312Deals",
  description:
    `The ultimate guide to Chicago brunch deals. Bottomless mimosas, prix fixe menus, and weekend specials at 500+ restaurants across ${stats.neighborhoods} neighborhoods.`,
  openGraph: {
    title: "Best Brunch Deals in Chicago 2026 | 312Deals",
    description:
      "The ultimate guide to Chicago brunch deals. Bottomless mimosas, weekend specials, and more at 500+ restaurants.",
    url: `${SITE_URL}/guides/best-brunch-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Best+Brunch+Deals+in+Chicago+2026&subtitle=Bottomless+mimosas+and+weekend+specials&emoji=%F0%9F%A5%9E&badges=Bottomless+mimosas%2CWeekend+specials%2CBy+neighborhood&v=2`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Brunch Deals in Chicago 2026 | 312Deals",
    description:
      "The ultimate guide to Chicago brunch deals. Bottomless mimosas, weekend specials, and more.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/best-brunch-chicago`,
  },
}

export default async function BestBrunchGuide() {
  const [allDeals, bottomlessDeals] = await Promise.all([
    getBrunchDeals(),
    getBottomlessDeals(),
  ])

  const totalDeals = allDeals.length
  const uniqueVenues = new Set(allDeals.map((d) => d.venue_name)).size
  const bottomlessCount = bottomlessDeals.length

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

  // Day availability
  const dayCounts = new Map<string, number>()
  for (const d of allDeals) {
    for (const day of d.days_available ?? []) {
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1)
    }
  }
  const saturdayCount = dayCounts.get("saturday") ?? 0
  const sundayCount = dayCounts.get("sunday") ?? 0
  const weekdayBrunchCount = (dayCounts.get("monday") ?? 0) + (dayCounts.get("tuesday") ?? 0) +
    (dayCounts.get("wednesday") ?? 0) + (dayCounts.get("thursday") ?? 0) + (dayCounts.get("friday") ?? 0)

  // Cheapest brunch drinks
  const cheapDrinks: { name: string; price: number; venue: string; neighborhood: string }[] = []
  for (const d of allDeals) {
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
  const top10Cheapest = cheapDrinks.slice(0, 10)

  // Cheapest food items
  const cheapFood: { name: string; price: number; venue: string; neighborhood: string }[] = []
  for (const d of allDeals) {
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

  // Timing stats
  const startTimes = allDeals.map((d) => d.start_time).filter(Boolean) as string[]
  const startCounts = new Map<string, number>()
  for (const t of startTimes) {
    startCounts.set(t, (startCounts.get(t) ?? 0) + 1)
  }
  const mostCommonStart = startCounts.size > 0
    ? Array.from(startCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null

  // FAQ items
  const faqItems = [
    {
      q: "What are the best brunch deals in Chicago?",
      a: `Chicago has ${totalDeals} active brunch deals across ${uniqueVenues} restaurants. ${topNeighborhoods.slice(0, 3).map((n) => `${n.name} has ${n.count} brunch deals`).join(", ")}. Popular specials include bottomless mimosas, prix fixe menus, and weekend-only discounts.`,
    },
    {
      q: "Where can I find bottomless brunch in Chicago?",
      a: `We found ${bottomlessCount} bottomless brunch deals across Chicago, including bottomless mimosas, bloody marys, and bellinis. Most bottomless deals run on Saturday and Sunday from ${mostCommonStart ? formatTime(mostCommonStart) : "10 AM"} to early afternoon.`,
    },
    {
      q: "What is the cheapest brunch in Chicago?",
      a: top10CheapestFood.length > 0
        ? `The cheapest brunch deal we found is $${top10CheapestFood[0].price.toFixed(2)} ${top10CheapestFood[0].name} at ${top10CheapestFood[0].venue} in ${top10CheapestFood[0].neighborhood}. We track ${cheapFood.length}+ brunch food specials across the city.`
        : "Browse our brunch deals page to find affordable brunch options near you.",
    },
    {
      q: "Do Chicago restaurants serve brunch on weekdays?",
      a: weekdayBrunchCount > 0
        ? `Yes, we found ${weekdayBrunchCount} weekday brunch options across Chicago. While most brunch deals focus on Saturday (${saturdayCount} deals) and Sunday (${sundayCount} deals), many spots offer weekday brunch too.`
        : "While weekend brunch is most popular, many Chicago restaurants now offer weekday brunch service.",
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
                  { name: "Best Brunch Guide", url: `${SITE_URL}/guides/best-brunch-chicago` },
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
                "headline": "Best Brunch Deals in Chicago 2026",
                "description": `${totalDeals}+ brunch deals at ${uniqueVenues} restaurants including ${bottomlessCount} bottomless options. The ultimate Chicago brunch guide.`,
                "url": `${SITE_URL}/guides/best-brunch-chicago`,
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/best-brunch-chicago`,
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
                "image": `${SITE_URL}/api/og?title=Best+Brunch+Deals+in+Chicago+2026&subtitle=Bottomless+mimosas+and+weekend+specials&emoji=%F0%9F%A5%9E&badges=Bottomless+mimosas%2CWeekend+specials%2CBy+neighborhood&v=2`,
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
              <span className="text-foreground">Best Brunch Guide</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Best Brunch Deals in Chicago 2026
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              We found {totalDeals}+ brunch deals across {uniqueVenues} Chicago restaurants, including {bottomlessCount} bottomless options.
              Whether you want cheap eats, boozy brunch, or a full prix fixe spread, this guide has you covered.
              {mostCommonStart && ` Most brunch deals start at ${formatTime(mostCommonStart)}.`}
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Coffee className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{totalDeals}</div>
              <div className="text-xs text-muted-foreground">Brunch Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{uniqueVenues}</div>
              <div className="text-xs text-muted-foreground">Restaurants</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Wine className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{bottomlessCount}</div>
              <div className="text-xs text-muted-foreground">Bottomless Options</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <DollarSign className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">
                {top10CheapestFood.length > 0 ? `$${top10CheapestFood[0].price.toFixed(0)}` : "$5"}
              </div>
              <div className="text-xs text-muted-foreground">Cheapest Deal</div>
            </div>
          </div>

          {/* Section: Top Brunch Neighborhoods */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Best Chicago Neighborhoods for Brunch
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {topNeighborhoods.length > 0 && `${topNeighborhoods[0].name} is Chicago's brunch capital with ${topNeighborhoods[0].count} deals. ${topNeighborhoods.slice(1, 3).map((n) => `${n.name} (${n.count} deals)`).join(" and ")} follow closely.`}
              {" "}Here are the top neighborhoods ranked by brunch deals:
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Top Chicago neighborhoods ranked by number of brunch deals">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Rank</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Brunch Deals</th>
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

          {/* Section: Bottomless Brunch */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Bottomless Brunch in Chicago
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              {bottomlessCount > 0
                ? `Chicago has ${bottomlessCount} bottomless brunch deals, unlimited mimosas, bloody marys, bellinis, and more. Most bottomless options run for 90 minutes to 2 hours and range from $20 to $45 per person.`
                : "Many Chicago restaurants offer bottomless brunch with unlimited mimosas and bloody marys. Prices typically range from $20 to $45 for 90 minutes to 2 hours of unlimited drinks."
              }
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pro tip: Book ahead for bottomless brunch on weekends. The most popular spots sell out by Thursday for Saturday/Sunday reservations. Many restaurants also offer weekday bottomless options at lower prices.
            </p>
            <div className="mt-4">
              <Link
                href="/search?deal_type=brunch_deal&query=bottomless"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                Find Bottomless Brunch
              </Link>
            </div>
          </section>

          {/* Section: Cheapest Brunch Drinks */}
          {top10Cheapest.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">
                Cheapest Brunch Drinks in Chicago
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Not every brunch needs to break the bank. We found {cheapDrinks.length}+ brunch drink specials across Chicago.
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm" aria-label="Cheapest brunch drinks in Chicago">
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
            </section>
          )}

          {/* Section: Saturday vs Sunday */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Saturday vs. Sunday Brunch
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              {saturdayCount > 0 || sundayCount > 0
                ? `Saturday brunch has ${saturdayCount} deals while Sunday offers ${sundayCount}. ${sundayCount > saturdayCount ? "Sunday edges out Saturday" : "Saturday has a slight edge"} for brunch options, but both days have plenty to choose from.`
                : "Both Saturday and Sunday offer excellent brunch options across Chicago."}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Many restaurants serve brunch from 9 AM to 3 PM on weekends. For the best selection, plan for a late morning start, 10:30 AM to 11:30 AM hits the sweet spot between crowds and menu availability.
            </p>
          </section>

          <BookingCTA
            campaign="brunch_hub"
            headline="Visiting for a brunch weekend?"
            subhead="Find hotels in the neighborhoods with the best brunch scenes. Free cancellation on most rooms."
          />

          {/* Section: Find Brunch Deals */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Find Brunch Deals Near You
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Use our{" "}
              <Link href="/map" className="text-brand-600 hover:underline dark:text-brand-400">
                interactive deal map
              </Link>{" "}
              to find brunch spots closest to you, or browse by{" "}
              <Link href="/neighborhoods" className="text-brand-600 hover:underline dark:text-brand-400">
                neighborhood
              </Link>.
              Check out our{" "}
              <Link href="/guides/patio-season-chicago" className="text-brand-600 hover:underline dark:text-brand-400">
                patio season guide
              </Link>{" "}
              for outdoor brunch options.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/deals/brunch-deals"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                Browse All Brunch Deals
              </Link>
              <Link
                href="/map"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                View Deal Map
              </Link>
              <Link
                href="/search?deal_type=brunch_deal&query=bottomless"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Bottomless Only
              </Link>
            </div>
          </section>

          {/* Browse neighborhoods */}
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-foreground">
              All Neighborhoods with Brunch Deals
            </h2>
            <div className="flex flex-wrap gap-2">
              {topNeighborhoods.map((nh) => (
                <Link
                  key={nh.slug}
                  href={`/neighborhoods/${nh.slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                >
                  {nh.name} ({nh.count})
                </Link>
              ))}
            </div>
          </section>

          {/* Search handoff */}
          <section className="mb-12">
            <GuideSearchHandoff
              headline="Brunch, sorted"
              subtitle="Search every live brunch and bottomless special near you, by neighborhood, updated daily."
              cta={{ label: "Search brunch deals", href: "/search?q=brunch" }}
              links={[
                { label: "Brunch deals", href: "/deals/brunch-deals" },
                { label: "Bottomless mimosas", href: "/search?q=bottomless" },
                { label: "Daily specials", href: "/deals/daily-specials" },
                { label: "Happy hours", href: "/deals/happy-hours" },
              ]}
            />
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
              This guide is based on data from 312Deals, which tracks {totalDeals}+ brunch deals
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
