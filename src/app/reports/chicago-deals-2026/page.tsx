import Link from "next/link"
import type { Metadata } from "next"
import { Beer, MapPin, Calendar, DollarSign, BarChart3, TrendingUp, Clock, Star } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo-utils"
import { stats, statsEncoded } from "@/lib/product-stats"

const SITE_URL = "https://www.312deals.com"

export const metadata: Metadata = {
  title: "The State of Chicago Dining Deals (May 2026) | 312Deals",
  description:
    `We analyzed ${stats.deals} food and drink deals across Chicago and 60+ suburbs. Key findings on deal timing, pricing, neighborhoods, and the cheapest drinks in the city.`,
  openGraph: {
    title: "Chicago Dining Deals Report 2026 | 312Deals",
    description:
      `We analyzed ${stats.deals} food and drink deals across Chicago and 60+ suburbs. Here's what the data says.`,
    url: `${SITE_URL}/reports/chicago-deals-2026`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Chicago+Dining+Deals+Report+2026&subtitle=${statsEncoded.deals}+deals+across+${statsEncoded.neighborhoods}+neighborhoods`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chicago Dining Deals Report 2026 | 312Deals",
    description:
      `We analyzed ${stats.deals} food and drink deals across Chicago and 60+ suburbs. Here's what the data says.`,
  },
  alternates: {
    canonical: `${SITE_URL}/reports/chicago-deals-2026`,
  },
}

const faqItems = [
  {
    q: "How many food deals are there in Chicago?",
    a: `As of May 2026, 312Deals tracks ${stats.deals} active food and drink deals across ${stats.venues} venues in ${stats.neighborhoods} Chicago neighborhoods. This includes happy hours, daily specials, brunch deals, late-night specials, seasonal offers, and chain app deals.`,
  },
  {
    q: "What is the best day for food deals in Chicago?",
    a: "Wednesday edges out other weekdays with 10,082 deals available, closely followed by Thursday (10,043) and Friday (9,998). Weekdays dominate because most restaurants run Mon-Fri specials to fill seats during slower periods. Weekends still have strong coverage, Saturday has 9,032 and Sunday 9,398.",
  },
  {
    q: "When do most happy hours start in Chicago?",
    a: "4:00 PM is the most common start time with 903 happy hours beginning then. 3:00 PM is second (660 deals) and offers less crowded options. 5:00 PM rounds out the top three with 374.",
  },
  {
    q: "Where are the cheapest drinks in Chicago?",
    a: "$1 house shots at Cheesie's Pub & Grub (Lakeview), $2 domestic cans at The Sports Corner (Lakeview), and $2 shots at Big Star Wrigleyville. $3 beers still exist at Ceres Cafe (The Loop), Claddagh Ring Pub (Lincoln Square), Replay Lakeview, and Privilege Bar (South Loop).",
  },
  {
    q: "Which Chicago neighborhood has the most deals?",
    a: "River North leads with 2,062 deals, followed by Lakeview (1,813), Lincoln Park (1,347), The Loop (1,331), and Logan Square (1,148). For the highest-rated venues with deals, Evanston tops the list at 4.55 average Google rating.",
  },
  {
    q: "How is the data collected and verified?",
    a: "Deal data is collected from restaurant websites, social media pages (Instagram, Facebook, TikTok), and newsletters using automated scanning, then structured with prices, times, days, and menu items where available. The database is re-verified weekly, with community reports supplementing the automated checks.",
  },
]

export default function ChicagoDealsReport2026() {
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
                  { name: "Reports", url: `${SITE_URL}/reports` },
                  { name: "Chicago Deals Report 2026", url: `${SITE_URL}/reports/chicago-deals-2026` },
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
                "headline": "The State of Chicago Dining Deals (May 2026)",
                "description": `We analyzed ${stats.deals} food and drink deals across Chicago and 60+ suburbs. Key findings on deal timing, pricing, neighborhoods, and the cheapest drinks in the city.`,
                "url": `${SITE_URL}/reports/chicago-deals-2026`,
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/reports/chicago-deals-2026`,
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
                "image": `${SITE_URL}/api/og?title=Chicago+Dining+Deals+Report+2026&subtitle=${statsEncoded.deals}+deals+across+${statsEncoded.neighborhoods}+neighborhoods`,
                "datePublished": "2026-05-27",
                "dateModified": "2026-05-27",
              }),
            }}
          />

          {/* Header */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <Link href="/reports/chicago-deals-2026" className="text-foreground">Reports</Link>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              The State of Chicago Dining Deals
            </h1>
            <p className="mt-1 text-lg font-medium text-muted-foreground">
              May 2026
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals</span> · Updated May 2026
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              We analyzed {stats.deals} food and drink deals across {stats.venues} venues in {stats.neighborhoods} Chicago neighborhoods.
              This report breaks down deal types, pricing, timing, and neighborhood distribution to help
              Chicagoans find the best values, and to give journalists, bloggers, and researchers the
              data they&apos;ve been missing.
            </p>
          </header>

          {/* Key Findings */}
          <div className="mb-10 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-bold text-foreground">Key Findings</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span><strong className="text-foreground">Wednesday is the best day for deals</strong>, 10,082 available, but weekdays are nearly equal (9,400+)</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span><strong className="text-foreground">4:00 PM is the magic hour</strong>, 903 happy hours start at 4 PM, well ahead of the next slot</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span><strong className="text-foreground"><Link href="/neighborhoods/river-north" className="hover:underline">River North</Link> has the most deals (2,062)</strong> but <Link href="/neighborhoods/evanston" className="text-brand-600 hover:underline dark:text-brand-400">Evanston</Link> has the highest-rated venues (4.55 avg)</span>
              </li>
              <li className="flex items-start gap-2">
                <Beer className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span><strong className="text-foreground">Daily specials + happy hours = 70%</strong> of all deals, led by daily specials at 58%</span>
              </li>
              <li className="flex items-start gap-2">
                <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span><strong className="text-foreground">$1 shots and $2 beers still exist</strong>, at Cheesie&apos;s Pub, The Sports Corner, and Big Star Wrigleyville</span>
              </li>
            </ul>
          </div>

          {/* Key Stats Grid */}
          <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">32,597</div>
              <div className="text-xs text-muted-foreground">Active Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">12,718</div>
              <div className="text-xs text-muted-foreground">Venues Tracked</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <BarChart3 className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">137</div>
              <div className="text-xs text-muted-foreground">Neighborhoods</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <TrendingUp className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">47</div>
              <div className="text-xs text-muted-foreground">Chain Brands</div>
            </div>
          </div>

          {/* Section 1: By the Numbers */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              By the Numbers
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Key metrics for Chicago dining deals">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Metric</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Total active deals", "32,597"],
                    ["Total venues tracked", "12,718"],
                    ["Neighborhoods covered", "137"],
                    ["Chain brands tracked", "47"],
                    ["Deals with specific drink prices", "6,671 (20%)"],
                    ["Deals with specific food items", "10,499 (32%)"],
                    ["Deals with full pricing & timing detail", "3,482"],
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

          {/* Section 2: Deal Types */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Deal Types
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Daily specials and happy hours together make up <strong className="text-foreground">70% of all deals</strong>, now led by daily specials at 58%.
              Seasonal and event-driven promotions add another 16% as restaurants push rotating menus and event tie-ins.
              Brunch, loyalty, chain-app, and group deals fill out the middle, while game day, late night, and restaurant week remain niche categories.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Breakdown of Chicago deal types by count and percentage">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Type</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Count</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Daily Special", "18,773", "57.6%"],
                    ["Happy Hour", "4,180", "12.8%"],
                    ["Seasonal / LTO", "2,979", "9.1%"],
                    ["Event-Driven", "2,255", "6.9%"],
                    ["Loyalty Reward", "1,177", "3.6%"],
                    ["Brunch Deal", "750", "2.3%"],
                    ["Other", "680", "2.1%"],
                    ["Chain App Deal", "675", "2.1%"],
                    ["Group Package", "512", "1.6%"],
                    ["Game Day", "285", "0.9%"],
                    ["Late Night", "219", "0.7%"],
                    ["New Opening", "96", "0.3%"],
                    ["Restaurant Week", "16", "0.0%"],
                  ].map(([type, count, share], i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-foreground">{type}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{count}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{share}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Timing */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              When Chicago Gets a Deal
            </h2>

            <h3 className="mb-3 text-lg font-semibold text-foreground">By Day of Week</h3>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Weekday deals outnumber weekends, most restaurants run Mon-Fri specials.
              Wednesday leads, but the gap between weekdays is small. Saturday is the
              lowest day, but still has 9,000+ deals available.
            </p>
            <div className="mb-8 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Number of deals available by day of the week">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Day</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Deals Available</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Wednesday", "10,082"],
                    ["Thursday", "10,043"],
                    ["Friday", "9,998"],
                    ["Tuesday", "9,956"],
                    ["Monday", "9,423"],
                    ["Sunday", "9,398"],
                    ["Saturday", "9,032"],
                  ].map(([day, count], i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-foreground">{day}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mb-3 text-lg font-semibold text-foreground">By Start Time (Happy Hours Only)</h3>
            <div className="mb-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Most common happy hour start times">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Start Time</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["4:00 PM", "903"],
                    ["3:00 PM", "660"],
                    ["5:00 PM", "374"],
                    ["7:00 PM", "97"],
                    ["2:00 PM", "93"],
                  ].map(([time, count], i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-foreground">{time}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Insight:</strong> If you want the widest selection, show up at 4 PM
              on a Wednesday. If you want to beat the crowd, 3 PM happy hours are less packed and nearly as common.
            </p>
          </section>

          {/* Section 4: Neighborhoods */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Neighborhood Rankings
            </h2>

            <h3 className="mb-3 text-lg font-semibold text-foreground">Most Deals</h3>
            <div className="mb-8 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Top 10 Chicago neighborhoods by deal count">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Rank</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["1", "River North", "2,062", "river-north"],
                    ["2", "Lakeview", "1,813", "lakeview"],
                    ["3", "Lincoln Park", "1,347", "lincoln-park"],
                    ["4", "The Loop", "1,331", "the-loop"],
                    ["5", "Logan Square", "1,148", "logan-square"],
                    ["6", "West Loop", "990", "west-loop"],
                    ["7", "Portage Park", "820", "portage-park"],
                    ["8", "West Town", "811", "west-town"],
                    ["9", "Wrigleyville", "805", "wrigleyville"],
                    ["10", "Gage Park", "691", "gage-park"],
                  ].map(([rank, name, count, slug]) => (
                    <tr key={slug} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{rank}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/neighborhoods/${slug}`}
                          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mb-3 text-lg font-semibold text-foreground">Highest-Rated Venues (Neighborhoods with 20+ Deals)</h3>
            <div className="mb-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Highest-rated neighborhoods by average Google rating">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Rank</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Avg Rating</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["1", "Evanston", "4.55", "135", "evanston"],
                    ["2", "Oak Park", "4.53", "282", "oak-park"],
                    ["3", "Portage Park", "4.53", "780", "portage-park"],
                    ["4", "Palatine", "4.52", "163", "palatine"],
                    ["5", "Wilmette", "4.52", "89", "wilmette"],
                  ].map(([rank, name, rating, deals, slug]) => (
                    <tr key={slug} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{rank}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/neighborhoods/${slug}`}
                          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-yellow-500" />
                          {rating}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{deals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">The takeaway:</strong>{" "}
              <Link href="/neighborhoods/river-north" className="text-brand-600 hover:underline dark:text-brand-400">River North</Link> has the most deals by far, but{" "}
              <Link href="/neighborhoods/evanston" className="text-brand-600 hover:underline dark:text-brand-400">Evanston</Link>,{" "}
              <Link href="/neighborhoods/oak-park" className="text-brand-600 hover:underline dark:text-brand-400">Oak Park</Link>, and{" "}
              <Link href="/neighborhoods/portage-park" className="text-brand-600 hover:underline dark:text-brand-400">Portage Park</Link> have the best-rated restaurants running them.
            </p>
          </section>

          {/* Section 5: Cheapest Drinks */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              The Cheapest Drinks in Chicago
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Based on explicit prices listed in deal data. Prices reflect happy hour and special pricing only, always confirm with the venue.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Cheapest happy hour drinks in Chicago by price, venue, and neighborhood">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Venue</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Neighborhood</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">What</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Cheesie's Pub & Grub", "Lakeview", "House shots", "$1"],
                    ["The Sports Corner", "Lakeview", "Domestic cans", "$2"],
                    ["Big Star Wrigleyville", "Lakeview", "Shot of the Day", "$2"],
                    ["Ceres Cafe", "The Loop", "Draft / canned beer", "$3"],
                    ["The Sports Corner", "Lakeview", "Cubby Bear Lager", "$3"],
                    ["Vine's on Clark", "Lakeview", "Cubby Lager Cans", "$3"],
                    ["Replay Lakeview", "Lakeview", "Bud Lights", "$3"],
                    ["Scarlet", "Lakeview", "Well drinks (power hour)", "$3"],
                    ["Claddagh Ring Pub", "Lincoln Square", "Beer", "$3"],
                    ["Privilege Bar", "South Loop", "Beer", "$3"],
                    ["Minyoli", "Andersonville", "Cocktails (w/ entree)", "$3"],
                    ["Little Madrid Tapas", "Andersonville", "Starting beers", "$3"],
                    ["Carnivale", "West Loop", "Honduran Pilsner", "$3.50"],
                    ["Lil Ba-Ba-Reeba!", "River North", "Estrella Damm", "$4"],
                    ["Ella's BBQ", "Lincoln Park", "Well drinks", "$4"],
                  ].map(([venue, neighborhood, what, price], i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{venue}</td>
                      <td className="px-4 py-3 text-muted-foreground">{neighborhood}</td>
                      <td className="px-4 py-3 text-foreground">{what}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">{price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 6: Coverage & Deal Detail */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Coverage &amp; Deal Detail
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              312Deals captures the detail most listings skip. Every deal is structured with prices, times, days,
              and menu items wherever the source provides them, so it&apos;s usable by people and by AI assistants alike.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Depth of deal detail tracked by 312Deals">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">What we capture</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Explicit drink prices", "6,671"],
                    ["Specific food items", "10,499"],
                    ["Full pricing + timing + days", "3,482"],
                  ].map(([label, count], i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-foreground">{label}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* CTA: Explore */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Explore the Data
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              All data behind this report is searchable at 312Deals. Filter by neighborhood, day, cuisine,
              deal type, time, or keyword. Use the map to find deals near you, or plan a multi-stop bar crawl.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/search"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                Search All Deals
              </Link>
              <Link
                href="/map"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                View Deal Map
              </Link>
              <Link
                href="/neighborhoods"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Browse Neighborhoods
              </Link>
              <Link
                href="/crawl"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Plan a Bar Crawl
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

          {/* Methodology */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Methodology
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This report analyzes {stats.deals} active deals across {stats.venues} venues in {stats.neighborhoods} Chicago neighborhoods as of
              May 2026. Deal data is collected from restaurant websites, social media (Instagram, Facebook, TikTok),
              and newsletters using automated scanning, then structured for completeness of pricing, timing, and
              item information. The database is re-verified weekly via automated checks, with community reports
              (report outdated / confirm active) supplementing automated verification. Venue ratings come from the
              Google Places API.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
