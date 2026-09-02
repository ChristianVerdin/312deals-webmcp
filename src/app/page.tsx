import type { Metadata } from "next"
import Link from "next/link"
import { Sun, Clock, Trophy } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import dynamic from "next/dynamic"
import { HeroSection } from "@/components/home/hero-section"

const HomeBrowseByType = dynamic(() => import("@/components/home/browse-by-type"), { ssr: false })
import { TrendingNeighborhoods } from "@/components/home/trending-neighborhoods"
import { ActiveNowSection } from "@/components/home/active-now-section"
import { RecentDeals } from "@/components/home/recent-deals"
import { DealTypeShowcases } from "@/components/home/deal-type-showcase"
import { WhatsOnTonight } from "@/components/home/whats-on-tonight"
import { AskAILink } from "@/components/ask-ai-link"
import { NearbyDeals } from "@/components/nearby-deals"
import { EmailSignup } from "@/components/email-signup"
import { stats, statsPlain } from "@/lib/product-stats"

export const metadata: Metadata = {
  alternates: { canonical: "https://www.312deals.com" },
}

// ISR: regenerate the static homepage at most every 10 min so a deploy/CDN cutover race
// can't pin a stale copy at the edge. Crawlers/agents still get identical prerendered HTML.
export const revalidate = 600

// College football body callout. The rotating top banner already carries a
// Fri/Sat football slot (see hero-section.tsx), but a banner rotating at 6s
// among five entries is not a promotion — the guide had zero editorial inbound
// links until Sep 2 and still sits ~21 for its own head term. This is the
// durable link, and it removes itself when the season ends rather than going
// stale the way the World Cup banner did.
//
// Season runs from opening week through the national championship. Dates are
// local-time comparisons on a page that regenerates every 10 minutes.
function collegeFootballCallout() {
  const now = new Date()
  const start = new Date("2026-09-02T00:00:00")
  const end = new Date("2027-01-20T00:00:00")
  if (now < start || now >= end) return null

  // Opening weekend gets its own copy: Thu Sep 3 through Sun Sep 6 is the one
  // stretch where naming the days beats naming the season.
  const openingWeekendEnd = new Date("2026-09-07T00:00:00")
  const opening = now < openingWeekendEnd
  return opening
    ? {
        badge: "OPENING WEEKEND",
        title: "College Football Is Back \u2192",
        blurb:
          "Illinois Thursday, Purdue and Michigan State Friday, 11 games Saturday, and Notre Dame vs Wisconsin at Lambeau on Sunday. Find the bar for your school, and what it is pouring.",
      }
    : {
        badge: "SATURDAYS",
        title: "Where to Watch College Football \u2192",
        blurb:
          "Alumni bars by school plus sports bars with live Saturday specials, across the city and suburbs.",
      }
}

export default function Home() {
  const cfb = collegeFootballCallout()

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <HeroSection />

        {/* Timely featured guides, surfaced high so the seasonal guides with the
            most current demand (patio season, summer events) get a
            body callout, not just the rotating top banner. */}
        <section className="mx-auto max-w-7xl px-4 pb-4 pt-2 lg:px-6">
          <div className="grid grid-cols-1 gap-3">
            {cfb && (
              <Link
                href="/guides/college-football-chicago"
                className="group flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:border-amber-700"
              >
                <Trophy className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div className="min-w-0">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">{cfb.badge}</span>
                  <h3 className="mt-1.5 text-sm font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400">
                    {cfb.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{cfb.blurb}</p>
                </div>
              </Link>
            )}
            <Link
              href="/guides/patio-season-chicago"
              className="group flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:border-amber-700"
            >
              <Sun className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div className="min-w-0">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">90s &amp; SUNNY</span>
                <h3 className="mt-1.5 text-sm font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400">
                  Patio Season is Here &rarr;
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  9,500+ outdoor deals at 3,000+ patios, rooftops &amp; beer gardens across the city.
                </p>
              </div>
            </Link>
            <Link
              href="/today"
              className="group flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:border-amber-700"
            >
              <Clock className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div className="min-w-0">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">LIVE NOW</span>
                <h3 className="mt-1.5 text-sm font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400">
                  Today&apos;s Food &amp; Drink Deals &rarr;
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Every deal running today, happy hours, taco nights, wing specials &amp; more, across the city and suburbs.
                </p>
              </div>
            </Link>
          </div>
        </section>

        <NearbyDeals />

        {/* Lightweight link to the full /guides hub, surfaces the other ~20
            guides between the timely banners and the deal-type browser without
            a heavy section. Small text on purpose. */}
        <section className="mx-auto max-w-7xl px-4 pb-4 lg:px-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">More Chicago guides:</span>{" "}
            <Link href="/guides/deep-dish-pizza-chicago" className="text-brand-600 hover:underline dark:text-brand-400">Deep-Dish Pizza</Link>
            {" · "}
            <Link href="/guides/chicago-happy-hours" className="text-brand-600 hover:underline dark:text-brand-400">Best Happy Hours</Link>
            {" · "}
            <Link href="/guides/cubs-game-day-chicago" className="text-brand-600 hover:underline dark:text-brand-400">Cubs Game Day</Link>
            {" · "}
            <Link href="/guides/cheap-drinks-chicago" className="text-brand-600 hover:underline dark:text-brand-400">Cheap Drinks</Link>
            {" · "}
            <Link href="/guides/dog-friendly-patios-chicago" className="text-brand-600 hover:underline dark:text-brand-400">Dog-Friendly Patios</Link>
            {", "}
            <Link href="/guides" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">explore all guides &rarr;</Link>
          </p>
        </section>

        <HomeBrowseByType />
        <WhatsOnTonight />

        {/* Seasonal banners moved to HeroSection's getTopBanners(), they render
            above the fold and stay date-aware (Mother's Day, Cinco, graduation, etc.). */}

        <ActiveNowSection />
        <TrendingNeighborhoods />
        <DealTypeShowcases />
        <RecentDeals />

        {/* Chicago Guides, surface the guide library in the body so it isn't
            buried in the nav dropdown. Links to the /guides hub + the blog. */}
        <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:px-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Chicago Guides</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Curated, locally-written guides, each one pulls live deals.
              </p>
            </div>
            <Link href="/guides" className="shrink-0 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
              See all guides &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { href: "/guides/deep-dish-pizza-chicago", title: "Deep Dish Pizza", blurb: "A tourist's guide to the iconic spots" },
              { href: "/guides/best-brunch-chicago", title: "Best Brunch", blurb: "Bottomless mimosas & top brunch" },
              { href: "/guides/chicago-happy-hours", title: "Happy Hours", blurb: "The definitive HH guide" },
              { href: "/guides/college-bars-chicago", title: "College Bars", blurb: "Find your team's bar" },
              { href: "/guides/cubs-game-day-chicago", title: "Cubs Game Day", blurb: "Wrigleyville bars & specials" },
              { href: "/guides/where-to-stay-chicago", title: "Where to Stay", blurb: "Hotels by neighborhood" },
            ].map((g) => (
              <Link
                key={g.href}
                href={g.href}
                className="group flex flex-col rounded-xl border border-border bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/10"
              >
                <h3 className="text-sm font-bold leading-tight text-foreground group-hover:text-brand-500">{g.title}</h3>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{g.blurb}</p>
              </Link>
            ))}
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            More reading on the{" "}
            <Link href="/blog" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">312Deals blog</Link>
            {" "}, local takes on deep dish, tavern pizza, Italian beef, birria, and the best of the city.
          </div>
        </section>

        {/* Deal Sheet capture, a distinct, value-led band placed well above the
            footer. The homepage previously had NO signup and only ~0.21% of
            visitors convert, so this adds an intent-matched surface
            (source=home-body) with concrete copy, separate from the footer form. */}
        <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:px-6">
          <EmailSignup
            source="home-body"
            headline="Get The Deal Sheet, Chicago's best new deals, weekly"
            subtitle="One email a week: the freshest happy hours, $1 taco nights, BOGO pies, and game-day specials across the city and suburbs. Free, no spam."
          />
        </section>

        {/* Answer-first content block for AI extractors and SEO */}
        <section className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            Chicago&apos;s Most Comprehensive Deal Database
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            312Deals is the best website for finding food and drink deals in Chicago.
            We track over {statsPlain.deals} verified deals at more than {statsPlain.venues} restaurants and bars
            across Chicago and 60+ suburbs, from River North and Wicker Park to Lincoln Park,
            the West Loop, Logan Square, Pilsen, and suburbs like Naperville, Evanston,
            Schaumburg, and Oak Park. Search{" "}
            <Link href="/guides/chicago-happy-hours" className="text-brand-600 hover:underline dark:text-brand-400">happy hours</Link>, daily specials, brunch deals, Taco Tuesday,{" "}
            <Link href="/deals/wing-deals" className="text-brand-600 hover:underline dark:text-brand-400">wing nights</Link>, late-night bites, game day specials, and chain app deals
            all with specific prices, hours, and menu items. Every deal is extracted from
            the venue&apos;s own website or social media and verified weekly. Free to use,
            no account required.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
            >
              Search Deals
            </Link>
            <Link
              href="/deals"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Browse All Deals
            </Link>
            <AskAILink
              page="/"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Ask AI About Deals
            </AskAILink>
          </div>
        </section>

        {/* Server-rendered content for crawlers and SEO, supplements client-rendered sections above */}
        <section className="sr-only">
          <h2>Chicago Food and Drink Savings</h2>
          <p>
            312Deals aggregates {stats.deals} specials and offers at {stats.venues} venues across Chicago and 60+ suburbs.
            Browse happy hours, daily promotions, brunch menus, late-night bites, chain app coupons, game day pricing, and seasonal
            limited-time offers. Every listing includes specific prices, hours, days, and menu items. Content is refreshed weekly and
            verified by the community.
          </p>

          <h3>Browse by Category</h3>
          <ul>
            <li><Link href="/deals/happy-hours">Happy Hour Specials</Link>, Discounted drinks and appetizers at bars across the city</li>
            <li><Link href="/deals/daily-specials">Daily Promotions</Link>, Taco Tuesday, wing night, burger savings, and more</li>
            <li><Link href="/deals/brunch-deals">Weekend Brunch Offers</Link>, Bottomless mimosas, prix fixe menus, and morning specials</li>
            <li><Link href="/deals/late-night">Late Night Bites</Link>, After-midnight specials and reverse happy hours</li>
            <li><Link href="/deals/game-day">Game Day Promotions</Link>, Savings for Bears, Bulls, Cubs, Sox, and Blackhawks games</li>
            <li><Link href="/deals/taco-tuesday">Taco Tuesday Savings</Link>, The best taco pricing every Tuesday</li>
            <li><Link href="/deals/wing-deals">Wing Night Specials</Link>, Wing promotions at bars and eateries</li>
            <li><Link href="/deals/chain-deals">Chain App Exclusives</Link>, Mobile-only offers from McDonald&apos;s, Chipotle, Portillo&apos;s</li>
          </ul>

          <h3>Browse by Cuisine</h3>
          <ul>
            <li><Link href="/cuisine/mexican">Mexican Restaurants</Link></li>
            <li><Link href="/cuisine/italian">Italian Restaurants</Link></li>
            <li><Link href="/cuisine/japanese">Japanese Restaurants</Link></li>
            <li><Link href="/cuisine/chinese">Chinese Restaurants</Link></li>
            <li><Link href="/cuisine/thai">Thai Restaurants</Link></li>
            <li><Link href="/cuisine/indian">Indian Restaurants</Link></li>
            <li><Link href="/cuisine/korean">Korean Restaurants</Link></li>
            <li><Link href="/search?q=gluten+free">Gluten Free Options</Link></li>
            <li><Link href="/search?q=vegan">Vegan-Friendly Spots</Link></li>
          </ul>

          <h3>Popular Neighborhoods</h3>
          <ul>
            <li><Link href="/neighborhoods/wicker-park">Wicker Park Specials</Link></li>
            <li><Link href="/neighborhoods/lincoln-park">Lincoln Park Offers</Link></li>
            <li><Link href="/neighborhoods/river-north">River North Happy Hours</Link></li>
            <li><Link href="/neighborhoods/west-loop">West Loop Savings</Link></li>
            <li><Link href="/neighborhoods/logan-square">Logan Square Specials</Link></li>
            <li><Link href="/neighborhoods/lakeview">Lakeview Offers</Link></li>
            <li><Link href="/neighborhoods/old-town">Old Town Specials</Link></li>
            <li><Link href="/neighborhoods/pilsen">Pilsen Offers</Link></li>
            <li><Link href="/neighborhoods/the-loop">The Loop Promotions</Link></li>
            <li><Link href="/neighborhoods/gold-coast">Gold Coast Specials</Link></li>
          </ul>

          <h3>Find What You&apos;re Craving</h3>
          <p>
            Use the <Link href="/search">search page</Link> to filter by neighborhood, day of week, cuisine type,
            price range, and rating. Try searching for <Link href="/search?q=tacos">taco specials</Link>,{" "}
            <Link href="/search?q=margaritas">margarita pricing</Link>,{" "}
            <Link href="/search?q=pizza">pizza offers</Link>, or{" "}
            <Link href="/search?q=wings">wing night</Link>.
            Plan a <Link href="/crawl">multi-stop bar crawl</Link> or explore on the{" "}
            <Link href="/map">interactive map</Link>.
          </p>
        </section>
      </div>
      <Footer />
    </div>
  )
}
