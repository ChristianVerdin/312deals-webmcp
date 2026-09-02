import Link from "next/link"
import type { Metadata } from "next"
import { Beer, MapPin, DollarSign, TrendingUp, Martini, Newspaper } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo-utils"

const SITE_URL = "https://www.312deals.com"

export const metadata: Metadata = {
  title: "How Chicago Diners Are Beating Inflation in 2026 | 312Deals Value Dining Report",
  description:
    "As inflation bites, Chicago diners are trading down, $8 beers over $18 cocktails, and a new wave of $10–$12 cocktails. We analyzed the deal data behind the trend: 1,900+ beer deals, 240+ cheap-beer specials, and the value-cocktail movement.",
  openGraph: {
    title: "Chicago Value Dining Report 2026 | 312Deals",
    description:
      "The deal data behind Chicago's value-drink shift: 1,900+ beer deals, 240+ cheap-beer specials, and the $10–$12 cocktail movement.",
    url: `${SITE_URL}/reports/chicago-value-dining-2026`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Chicago+Value+Dining+Report+2026&subtitle=The+data+behind+the+%241+beer+%26+%2410+cocktail+shift`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chicago Value Dining Report 2026 | 312Deals",
    description:
      "The deal data behind Chicago's value-drink shift: 1,900+ beer deals and the $10–$12 cocktail movement.",
  },
  alternates: {
    canonical: `${SITE_URL}/reports/chicago-value-dining-2026`,
  },
}

const faqItems = [
  {
    q: "Are Chicago restaurants really seeing more beer sales in 2026?",
    a: "Yes. Crain's Chicago Business (June 2026) reported imported beer units up 45% and domestic up 27% year-over-year at one Chicago restaurant group, as diners trade $18 cocktails for $8–$9 beers. The Dearborn in the Loop says it's pouring more draft beer than at any point in its 10-year history. 312Deals data shows the supply side: 1,900+ active beer and draft deals across 880 Chicago venues.",
  },
  {
    q: "What is the '$10 cocktail' movement in Chicago?",
    a: "Bloomberg (May 2026) dubbed it 'Death to the $20 Cocktail.' Chicago bars including Radicle in Logan Square ($10 cocktails) and Gus' Sip & Dip ($12) are winning customers by pricing craft cocktails well under the $20 norm, driving more rounds per visit and loyal regulars. 312Deals tracks 216 value-cocktail deals ($8–$14) across 162 Chicago venues.",
  },
  {
    q: "Where can I find $1 beer in Chicago?",
    a: "Dollar-beer specials run at Kincade's in Wrigleyville (every Thursday), Delilah's in Lincoln Park, and Parlay in Lincoln Park (Fridays, paired with $3 tacos). 312Deals tracks 240+ cheap-beer deals ($1–$5) across the city.",
  },
  {
    q: "Which Chicago neighborhoods have the most beer deals?",
    a: "River North leads with 184 active beer deals across 84 venues, followed by Lakeview (146), Wrigleyville (130), Lincoln Park (114), and The Loop (96).",
  },
  {
    q: "Why are diners trading down instead of staying home?",
    a: "Chicagoans still want to go out, they're just being smarter about it. Rather than cut the night out entirely, value-seekers swap the indulgence: a beer instead of a cocktail, a $10 drink instead of a $20 one, or hunting for happy hours and daily specials. 312Deals exists to make that easy, mapping every value deal across the city.",
  },
  {
    q: "How is the data collected and verified?",
    a: "Deal data is collected from restaurant websites, social media (Instagram, Facebook, TikTok), and newsletters using automated scanning, then structured with prices, days, times, and menu items where available. The database is re-verified weekly, with community reports supplementing automated checks. Trend reporting cited from Crain's Chicago Business (June 2026) and Bloomberg (May 2026).",
  },
]

export default function ChicagoValueDiningReport2026() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <article className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
          {/* Structured Data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: SITE_URL },
                  { name: "Reports", url: `${SITE_URL}/reports/chicago-value-dining-2026` },
                  { name: "Chicago Value Dining Report 2026", url: `${SITE_URL}/reports/chicago-value-dining-2026` },
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
                "headline": "How Chicago Diners Are Beating Inflation in 2026",
                "description": "The deal data behind Chicago's value-drink shift: 1,900+ beer deals, 240+ cheap-beer specials, and the $10–$12 cocktail movement.",
                "url": `${SITE_URL}/reports/chicago-value-dining-2026`,
                "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/reports/chicago-value-dining-2026` },
                "author": { "@type": "Organization", "name": "312Deals", "url": SITE_URL },
                "publisher": {
                  "@type": "Organization",
                  "name": "312Deals",
                  "url": SITE_URL,
                  "logo": { "@type": "ImageObject", "url": `${SITE_URL}/apple-touch-icon.png` },
                },
                "image": `${SITE_URL}/api/og?title=Chicago+Value+Dining+Report+2026&subtitle=The+data+behind+the+%241+beer+%26+%2410+cocktail+shift`,
                "datePublished": "2026-06-03",
                "dateModified": "2026-06-03",
              }),
            }}
          />

          {/* Header */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <span className="text-foreground">Value Dining Report</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              How Chicago Diners Are Beating Inflation
            </h1>
            <p className="mt-1 text-lg font-medium text-muted-foreground">June 2026</p>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals</span> · Updated June 2026
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Chicagoans aren&apos;t staying home, they&apos;re going out smarter. As inflation squeezes budgets,
              diners are trading the $18 cocktail for an $8 beer, and a wave of bars is winning by bringing back the
              $10–$12 cocktail. Two recent reports, from{" "}
              <a href="https://www.chicagobusiness.com/restaurants/ccb-beer-sales-up-amid-inflation-20260529/" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">Crain&apos;s Chicago Business</a>{" "}
              and{" "}
              <a href="https://www.bloomberg.com/news/articles/2026-05-14/top-value-cocktail-bars-in-chicago-brooklyn-london-phoenix" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">Bloomberg</a>{" "}
              documented the shift. We pulled the deal data behind it.
            </p>
          </header>

          {/* Key Findings */}
          <div className="mb-10 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-bold text-foreground">Key Findings</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Beer className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span><strong className="text-foreground">1,900+ active beer &amp; draft deals</strong> across 880 Chicago venues, beer is the value play of 2026</span>
              </li>
              <li className="flex items-start gap-2">
                <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span><strong className="text-foreground">240+ cheap-beer deals</strong> ($1–$5), including $1-beer nights at Kincade&apos;s, Delilah&apos;s, and Parlay</span>
              </li>
              <li className="flex items-start gap-2">
                <Martini className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span><strong className="text-foreground">216 value-cocktail deals ($8–$14)</strong> across 162 venues, the &ldquo;death to the $20 cocktail&rdquo; movement, mapped</span>
              </li>
              <li className="flex items-start gap-2">
                <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span><strong className="text-foreground">191 deals name the trade-down brands</strong>, Guinness, Modelo, Miller Lite, Michelob Ultra, Sapporo</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span><strong className="text-foreground"><Link href="/neighborhoods/river-north" className="hover:underline">River North</Link> leads on beer deals (184)</strong>, ahead of Lakeview (146) and Wrigleyville (130)</span>
              </li>
            </ul>
          </div>

          {/* Key Stats Grid */}
          <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">1,900+</div>
              <div className="text-xs text-muted-foreground">Beer Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <DollarSign className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">240+</div>
              <div className="text-xs text-muted-foreground">Cheap-Beer Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Martini className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">216</div>
              <div className="text-xs text-muted-foreground">Value Cocktails</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <TrendingUp className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">191</div>
              <div className="text-xs text-muted-foreground">Trade-Down Brands</div>
            </div>
          </div>

          {/* Section 1: Beer by neighborhood */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">Where Chicago&apos;s Beer Deals Are</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Beer deals cluster where the bars are. River North dominates, but the North Side dining corridor
              (Lakeview, Wrigleyville, Lincoln Park) is the true heart of cheap-beer Chicago.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Top Chicago neighborhoods by number of beer deals">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Rank</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Beer Deals</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Venues</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["1", "River North", "184", "84", "river-north"],
                    ["2", "Lakeview", "146", "55", "lakeview"],
                    ["3", "Wrigleyville", "130", "32", "wrigleyville"],
                    ["4", "Lincoln Park", "114", "45", "lincoln-park"],
                    ["5", "The Loop", "96", "54", "the-loop"],
                    ["6", "Logan Square", "80", "32", "logan-square"],
                    ["7", "Portage Park", "70", "26", "portage-park"],
                    ["8", "West Loop", "69", "43", "west-loop"],
                    ["9", "Naperville", "59", "12", "naperville"],
                    ["10", "Oak Park", "50", "14", "oak-park"],
                  ].map(([rank, name, count, venues, slug]) => (
                    <tr key={slug} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{rank}</td>
                      <td className="px-4 py-3">
                        <Link href={`/neighborhoods/${slug}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                          {name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{count}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{venues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 2: cheapest beer */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">The Cheapest Beer in Chicago</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Dollar-beer nights are alive and well. Based on explicit prices in deal data, always confirm with the venue.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Cheapest beer deals in Chicago by venue, neighborhood, and price">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Venue</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Deal</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Kincade's Wrigleyville", "Wrigleyville", "$1 beers every Thursday", "$1"],
                    ["Delilah's", "Lincoln Park", "$1 beer, $2 Jim Beam", "$1"],
                    ["Parlay Lincoln Park", "Lincoln Park", "$1 beers + $3 tacos (Fri)", "$1"],
                    ["Peggy Notebaert (pregame)", "Lincoln Park", "$1 beer tasters, $3 pints", "$1"],
                    ["Magoos Bar", "Gage Park", "$3 drafts all night", "$3"],
                    ["The Dugout / Press Box", "Wrigleyville", "$3 beers (Wed–Thu)", "$3"],
                    ["Taqueria Aurora", "Aurora", "$3 beers on Mondays", "$3"],
                    ["Emil's Sports Bar", "Libertyville", "$3 beer bottles (Tue)", "$3"],
                    ["Claddagh Ring Pub", "Lincoln Square", "$3 beer, $5 well drinks", "$3"],
                    ["City Tap and Grill", "Elmwood Park", "$4 drafts", "$4"],
                  ].map(([venue, hood, deal, price], i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{venue}</td>
                      <td className="px-4 py-3 text-muted-foreground">{hood}</td>
                      <td className="px-4 py-3 text-foreground">{deal}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">{price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: value cocktails */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">The $10–$12 Cocktail Movement</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Chicago is leading the national pushback against the $20 cocktail. Bloomberg spotlighted these
              local operators, all in the 312Deals database with live deals.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Chicago value cocktail bars named by Bloomberg, with neighborhood and price">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Bar</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">The Play</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Cocktail</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Radicle", "Logan Square", "Kitchen-scrap mixers keep pour cost ~22%", "$10"],
                    ["Gus' Sip & Dip", "Near North", "Tight 28-bottle well, bought in bulk (LEYE)", "$12"],
                    ["Daisies", "Logan Square", "Michelin Green-starred sustainability program", "$10–$12"],
                  ].map(([bar, hood, play, price], i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{bar}</td>
                      <td className="px-4 py-3 text-muted-foreground">{hood}</td>
                      <td className="px-4 py-3 text-foreground">{play}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">{price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: the value index */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">The 312Deals Value Index</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              The supply side of the trade-down trend, as captured in live deal data.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="312Deals value-dining metrics">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Metric</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Active beer & draft deals", "1,900+"],
                    ["Venues with a beer deal", "880"],
                    ["Cheap-beer deals ($1–$5)", "240+"],
                    ["Value-cocktail deals ($8–$14)", "216"],
                    ["Venues with a value cocktail", "162"],
                    ["Deals naming trade-down brands", "191"],
                  ].map(([metric, value], i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-foreground">{metric}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* CTA */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">Find the Value Yourself</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Every deal behind this report is live and searchable at 312Deals. Browse by drink, neighborhood, or day.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/deals/beer-specials" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600">
                Beer Specials
              </Link>
              <Link href="/deals/cheap-cocktails" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
                Cheap Cocktails
              </Link>
              <Link href="/guides/cheap-drinks-chicago" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
                Cheap Drinks Guide
              </Link>
              <Link href="/search" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
                Search All Deals
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
            <h2 className="mb-3 text-lg font-semibold text-foreground">Methodology</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Counts reflect active deals in the 312Deals database as of June 2026, matched on deal-description text
              for beer/draft/pint and cocktail/margarita keywords and price patterns. Deal data is collected from
              restaurant websites, social media (Instagram, Facebook, TikTok), and newsletters using automated
              scanning, then structured for pricing, timing, and item detail. Re-verified weekly with community
              reports. Trend reporting cited from Crain&apos;s Chicago Business (June 1, 2026) and Bloomberg
              (May 14, 2026); venue prices from those articles and from live deal data. Journalists and researchers:
              contact deals@312deals.com for the underlying data.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
