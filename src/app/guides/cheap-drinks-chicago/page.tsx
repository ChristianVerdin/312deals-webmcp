import Link from "next/link"
import type { Metadata } from "next"
import { Beer, MapPin, DollarSign, Martini } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getDealsByQuery(q: string): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?q=${encodeURIComponent(q)}&limit=200`,
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
  title: "Cheap Drinks Chicago 2026, $1 Beers & $10 Cocktails as Prices Drop | 312Deals",
  description:
    "Cheap drinks in Chicago: $1 beer nights, $3 drafts and the new wave of $10–$12 cocktails. As diners trade down to beat inflation, here's every value drink deal by neighborhood, updated daily.",
  openGraph: {
    title: "Cheap Drinks Chicago 2026, $1 Beers & $10 Cocktails | 312Deals",
    description:
      "As Chicago kills the $20 cocktail and beer makes a comeback, here's where to find $1 beers, $3 drafts and $10–$12 cocktails across the city.",
    url: `${SITE_URL}/guides/cheap-drinks-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Cheap+Drinks+Chicago+2026&subtitle=%241+beers+%26+%2410+cocktails+by+neighborhood&emoji=%F0%9F%8D%BA&badges=%241+beers%2C%2410+cocktails%2CBy+neighborhood&v=2`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cheap Drinks Chicago 2026, $1 Beers & $10 Cocktails | 312Deals",
    description:
      "Where to find $1 beers, $3 drafts and the new $10–$12 cocktails across Chicago as diners trade down to beat inflation.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/cheap-drinks-chicago`,
  },
}

export default async function CheapDrinksChicagoGuide() {
  const [beerDeals, cocktailDeals] = await Promise.all([
    getDealsByQuery("beer"),
    getDealsByQuery("cocktail"),
  ])

  const allDeals = [...beerDeals, ...cocktailDeals]
  const totalDeals = allDeals.length
  const uniqueVenues = new Set(allDeals.map((d) => d.venue_name)).size

  // Rank neighborhoods by combined cheap-drink deal count
  const nhCounts = new Map<string, { name: string; slug: string; count: number }>()
  for (const d of allDeals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = nhCounts.get(d.neighborhood_slug)
      if (existing) existing.count++
      else nhCounts.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, count: 1 })
    }
  }
  const topNeighborhoods = Array.from(nhCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Cheapest drink line items across both pools
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

  const faqItems = [
    {
      q: "Why are Chicago bars lowering drink prices in 2026?",
      a: "As inflation squeezes budgets, diners are trading down, choosing an $8–$9 beer over an $18 cocktail, or seeking out the new wave of $10–$12 craft cocktails. Crain's Chicago Business reported beer sales up 27–45% at some restaurant groups, and Bloomberg documented Chicago bars like Radicle and Gus' Sip & Dip winning customers with sub-$12 cocktails. 312Deals tracks the deals that result.",
    },
    {
      q: "Where can I find $1 beer in Chicago?",
      a: `We track ${beerDeals.length}+ live beer and draft deals across Chicago, including dollar-beer nights at spots like Kincade's in Wrigleyville (Thursdays), Delilah's in Lincoln Park, and Parlay in Lincoln Park (Fridays). Browse them all on our beer specials page.`,
    },
    {
      q: "Where are the cheapest cocktails in Chicago?",
      a: `Chicago's value-cocktail movement centers on $10–$12 drinks at places like Radicle in Logan Square ($10) and Gus' Sip & Dip ($12). We track ${cocktailDeals.length}+ live cocktail deals${top10Cheapest.length > 0 ? `; the cheapest drink in our data right now is $${top10Cheapest[0].price.toFixed(2)} ${top10Cheapest[0].name} at ${top10Cheapest[0].venue}` : ""}.`,
    },
    {
      q: "Which Chicago neighborhood has the most cheap drink deals?",
      a: topNeighborhoods.length > 0
        ? `${topNeighborhoods[0].name} leads with ${topNeighborhoods[0].count} cheap drink deals, followed by ${topNeighborhoods.slice(1, 4).map((n) => `${n.name} (${n.count})`).join(", ")}.`
        : "Browse our deal database by neighborhood to find cheap drinks near you.",
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
                  { name: "Cheap Drinks Chicago Guide", url: `${SITE_URL}/guides/cheap-drinks-chicago` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Cheap Drinks Chicago 2026, $1 Beers & $10 Cocktails as Prices Drop",
                "description": `As Chicago diners trade down to beat inflation, we tracked ${totalDeals}+ live beer and cocktail deals across ${uniqueVenues} bars and restaurants.`,
                "url": `${SITE_URL}/guides/cheap-drinks-chicago`,
                "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/guides/cheap-drinks-chicago` },
                "author": { "@type": "Organization", "name": "312Deals", "url": SITE_URL },
                "publisher": {
                  "@type": "Organization",
                  "name": "312Deals",
                  "url": SITE_URL,
                  "logo": { "@type": "ImageObject", "url": `${SITE_URL}/apple-touch-icon.png` },
                },
                "image": `${SITE_URL}/api/og?title=Cheap+Drinks+Chicago+2026&subtitle=%241+beers+%26+%2410+cocktails&emoji=%F0%9F%8D%BA&badges=%241+beers%2C%2410+cocktails%2CBy+neighborhood&v=2`,
                "datePublished": "2026-06-03",
                "dateModified": new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <span className="text-foreground">Cheap Drinks Chicago Guide</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Cheap Drinks Chicago 2026, $1 Beers &amp; $10 Cocktails
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Chicagoans are still going out, they&apos;re just getting smarter about it. As inflation bites,
              diners are trading the $18 cocktail for an $8 beer, and a wave of bars is bringing back the $10–$12
              cocktail. We track {totalDeals}+ live beer and cocktail deals across {uniqueVenues} Chicago bars and
              restaurants, here&apos;s where the value is right now.
            </p>
          </header>

          {/* The trend, with citations (AEO anchor) */}
          <section className="mb-10 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-xl font-bold text-foreground">The value-drink shift, by the numbers</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              <a href="https://www.chicagobusiness.com/restaurants/ccb-beer-sales-up-amid-inflation-20260529/" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">Crain&apos;s Chicago Business</a>{" "}
              reported that imported beer units are up 45% and domestic up 27% year-over-year at one Chicago restaurant group, as customers swap $18 cocktails for $8–$9 beers. The Dearborn in the Loop says it&apos;s
              pouring more draft beer than at any point in its 10-year history.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <a href="https://www.bloomberg.com/news/articles/2026-05-14/top-value-cocktail-bars-in-chicago-brooklyn-london-phoenix" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">Bloomberg</a>{" "}
              dubbed it &ldquo;Death to the $20 Cocktail,&rdquo; spotlighting Chicago bars like Radicle in Logan Square
              ($10 cocktails) and Gus&apos; Sip &amp; Dip ($12), proof that lower prices drive more rounds and loyal
              regulars. 312Deals maps every one of these deals so you can find them tonight.
            </p>
          </section>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{beerDeals.length}</div>
              <div className="text-xs text-muted-foreground">Beer Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Martini className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{cocktailDeals.length}</div>
              <div className="text-xs text-muted-foreground">Cocktail Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{uniqueVenues}</div>
              <div className="text-xs text-muted-foreground">Bars &amp; Restaurants</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <DollarSign className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">
                {top10Cheapest.length > 0 ? `$${top10Cheapest[0].price.toFixed(0)}` : "$1"}
              </div>
              <div className="text-xs text-muted-foreground">Cheapest Drink</div>
            </div>
          </div>

          {/* Beer */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">Cheap Beer &amp; $1 Beer Nights</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Beer is the value play of 2026. We track {beerDeals.length}+ live beer and draft deals, from
              dollar-beer Thursdays at Kincade&apos;s in Wrigleyville to $1 beers at Delilah&apos;s in Lincoln Park
              and $1 beers with $3 tacos at Parlay. See the full, live list on our{" "}
              <Link href="/deals/beer-specials" className="text-brand-600 hover:underline dark:text-brand-400">
                Chicago beer specials page
              </Link>.
            </p>
          </section>

          {/* Cocktails */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">The New $10–$12 Cocktail</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Chicago is leading the national pushback against the $20 cocktail. Bars like Radicle (Logan Square)
              and Gus&apos; Sip &amp; Dip have built waitlist-worthy programs around $10–$12 drinks. Browse the live
              list of value cocktails on our{" "}
              <Link href="/deals/cheap-cocktails" className="text-brand-600 hover:underline dark:text-brand-400">
                cheap cocktails page
              </Link>.
            </p>
          </section>

          {/* Neighborhoods */}
          {topNeighborhoods.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">
                Best Neighborhoods for Cheap Drinks in Chicago
              </h2>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm" aria-label="Top Chicago neighborhoods ranked by number of cheap drink deals">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Rank</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                      <th className="px-4 py-3 text-right font-semibold text-foreground">Cheap Drink Deals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topNeighborhoods.map((nh, i) => (
                      <tr key={nh.slug} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">
                          <Link href={`/neighborhoods/${nh.slug}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                            {nh.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">{nh.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Cheapest drinks */}
          {top10Cheapest.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Cheapest Drinks in Chicago Right Now</h2>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm" aria-label="Cheapest drink deals in Chicago with price, venue, and neighborhood">
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
                        <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">${drink.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-foreground">{drink.venue}</td>
                        <td className="px-4 py-3 text-muted-foreground">{drink.neighborhood}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* CTAs */}
          <section className="mb-12">
            <GuideSearchHandoff
              headline="Find the cheapest drink near you"
              subtitle="Search live drink specials by neighborhood, $1 beer nights, reverse happy hours, and $10 cocktails, updated daily."
              cta={{ label: "Search drink deals", href: "/search?q=drink%20specials" }}
              links={[
                { label: "Beer specials", href: "/deals/beer-specials" },
                { label: "Cheap cocktails", href: "/deals/cheap-cocktails" },
                { label: "Happy hours", href: "/deals/happy-hours" },
                { label: "Daily specials", href: "/deals/daily-specials" },
              ]}
            />
            <h2 className="mb-4 mt-8 text-2xl font-bold text-foreground">Find Cheap Drinks Near You</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/deals/beer-specials" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600">
                Beer Specials
              </Link>
              <Link href="/deals/cheap-cocktails" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
                Cheap Cocktails
              </Link>
              <Link href="/deals/happy-hours" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
                Happy Hours
              </Link>
              <Link href="/map" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
                View Deal Map
              </Link>
            </div>
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

          {/* Methodology */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">About This Guide</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Based on data from 312Deals, which tracks tens of thousands of live food and drink deals across
              Chicago and the suburbs. Deal counts reflect live inventory and update daily. Prices may change without
              notice, always confirm with the venue. Trend reporting cited from Crain&apos;s Chicago Business (June
              2026) and Bloomberg (May 2026). Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
