import Link from "next/link"
import type { Metadata } from "next"
import { Trophy, MapPin, Calendar, Beer } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { BookingCTA } from "@/components/booking-cta"
import { AffiliateEssentials } from "@/components/affiliate-essentials"
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo-utils"
import { GUIDE_PHOTOS } from "@/lib/guide-photos"
import { GuideHeroImage } from "@/components/guide-hero-image"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 1800

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

const WRIGLEY_NEIGHBORHOODS = ["wrigleyville", "lakeview", "lincoln-park"]

// Exclude deals that are clearly for other sports/events (Bears, NCAA, NBA, college teams)
const NON_CUBS_PATTERNS = /bears|packers|vikings|lions|bengals|nfl|football|punts|pints & punts|march madness|ncaa|tournament|bracket|madness|purdue|nebraska|ohio state|osu |duke|michigan|iowa|illini|basketball|nba|playoff|sweet 16|hockey|winter classic|nye|modelo shirt|pop shot/i

function isCubsRelevant(deal: Deal): boolean {
  const text = `${deal.title} ${deal.description ?? ""}`
  // Keep deals that mention cubs/wrigley/opening OR are generic game day deals
  if (/cubs|wrigley|opening day|home game|baseball/i.test(text)) return true
  // Exclude deals clearly about other sports
  if (NON_CUBS_PATTERNS.test(text)) return false
  // Keep generic "game day" deals (they apply to Cubs too)
  return true
}

async function getGameDayDeals(): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?deal_type=game_day&limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return (data.deals ?? []).filter((d) =>
      d.neighborhood_slug && WRIGLEY_NEIGHBORHOODS.includes(d.neighborhood_slug) && isCubsRelevant(d)
    )
  } catch {
    return []
  }
}

async function getHappyHourDeals(): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?deal_type=happy_hour&limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return (data.deals ?? []).filter((d) =>
      d.neighborhood_slug && WRIGLEY_NEIGHBORHOODS.includes(d.neighborhood_slug)
    )
  } catch {
    return []
  }
}

async function getBrunchDeals(): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?deal_type=brunch_deal&limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return (data.deals ?? []).filter((d) =>
      d.neighborhood_slug && WRIGLEY_NEIGHBORHOODS.includes(d.neighborhood_slug)
    )
  } catch {
    return []
  }
}

async function getWrigleyvilleSpecials(): Promise<Deal[]> {
  try {
    const types = ["daily_special", "event_driven"]
    const results = await Promise.all(
      types.map((t) =>
        fetch(`${API_URL}/api/v1/deals/search?deal_type=${t}&limit=200`, {
          next: { revalidate: 3600 },
        })
          .then((r) => (r.ok ? r.json() : { deals: [] }))
          .catch(() => ({ deals: [] }))
      )
    )
    const all: Deal[] = results.flatMap((r) => r.deals ?? [])
    return all.filter(
      (d) => d.neighborhood_slug === "wrigleyville" && isCubsRelevant(d)
    )
  } catch {
    return []
  }
}

export const metadata: Metadata = {
  title: "Cubs Game Day Chicago 2026, Wrigleyville Bars, Deals & Where to Go | 312Deals",
  description:
    "The best bars near Wrigley Field for Cubs games. Pre-game brunch, game day drink specials, post-game happy hours, and Wrigleyville bars with patios. Updated for the 2026 season.",
  openGraph: {
    title: "Cubs Game Day Chicago 2026, Wrigleyville Bars & Deals | 312Deals",
    description:
      "The best bars near Wrigley Field for Cubs games. Game day specials, pre-game brunch, and happy hours in Wrigleyville.",
    url: `${SITE_URL}/guides/cubs-game-day-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Cubs+Game+Day+2026&subtitle=Wrigleyville+bars+deals+and+where+to+go&emoji=%E2%9A%BE&badges=Wrigleyville+%26+beyond%2CGame-day+specials%2CPregame+eats&v=2`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cubs Game Day Chicago 2026, Wrigleyville Bars & Deals | 312Deals",
    description:
      "The best bars near Wrigley Field for Cubs games. Game day specials, brunch, and happy hours in Wrigleyville.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/cubs-game-day-chicago`,
  },
}

export default async function CubsGameDayGuide() {
  const [gameDayDeals, happyHourDeals, brunchDeals, wrigleyvilleSpecials] = await Promise.all([
    getGameDayDeals(),
    getHappyHourDeals(),
    getBrunchDeals(),
    getWrigleyvilleSpecials(),
  ])

  const allDeals = [...gameDayDeals, ...happyHourDeals, ...brunchDeals, ...wrigleyvilleSpecials]
  const totalGameDay = gameDayDeals.length
  const sportsBarVenues = new Set(gameDayDeals.map((d) => d.venue_name)).size
  const brunchCount = brunchDeals.length
  const neighborhoodCount = new Set(allDeals.map((d) => d.neighborhood_slug).filter(Boolean)).size

  // Thursday happy hours
  const thursdayHH = happyHourDeals.filter((d) => {
    const raw: unknown = d.days_available
    if (!raw) return true // include if no day restriction
    const text = Array.isArray(raw) ? raw.join(",").toLowerCase() : String(raw).toLowerCase()
    return text.includes("thursday") || text.includes("daily")
  })

  // FAQ items
  const faqItems = [
    {
      q: "What are the best bars near Wrigley Field?",
      a: `We track ${totalGameDay} game day specials at ${sportsBarVenues} bars and restaurants near Wrigley Field across Wrigleyville, Lakeview, and Lincoln Park. Most offer drink specials and food deals on home game days.`,
    },
    {
      q: "Are there game day specials near Wrigley Field?",
      a: `Yes, ${totalGameDay} game day deals are currently active at bars and restaurants within walking distance of Wrigley. Many venues run drink specials, discounted appetizers, and game-day-only menus when the Cubs play at home.`,
    },
    {
      q: "What time do gates open at Wrigley Field?",
      a: "Gates typically open 2 hours before first pitch. For day games (usually 1:20 PM), gates open at 11:20 AM. Check the Cubs schedule for exact times.",
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
                  { name: "Cubs Game Day Guide", url: `${SITE_URL}/guides/cubs-game-day-chicago` },
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
                "headline": "Cubs Game Day Chicago 2026, Wrigleyville Bars, Deals & Where to Go",
                "description": `${totalGameDay} game day specials, pre-game brunch, and happy hours near Wrigley Field for the 2026 Cubs season.`,
                "url": `${SITE_URL}/guides/cubs-game-day-chicago`,
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/cubs-game-day-chicago`,
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
                "image": `${SITE_URL}/api/og?title=Cubs+Opening+Day+2026&subtitle=Wrigleyville+bars+specials+and+where+to+go&emoji=%E2%9A%BE&badges=Wrigleyville+%26+beyond%2CGame-day+specials%2CPregame+eats&v=2`,
                "datePublished": "2026-03-24",
                "dateModified": new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <span className="text-foreground">Cubs Game Day</span>
            </nav>
            <GuideHeroImage photo={GUIDE_PHOTOS["cubs-game-day-chicago"]} priority />
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Cubs Game Day Chicago 2026, Wrigleyville Bars, Deals &amp; Where to Go
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · April 25, 2026
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              The 2026 Cubs season is underway, and Wrigleyville is ready. Whether it&apos;s a 1:20 PM day game
              or a 7:05 PM night game, the neighborhood delivers. Here&apos;s everything you need:
              game day specials, pre-game brunch, post-game happy hours, and where to be.
            </p>

            {/* Above-fold CTAs, fixes the 82% bounce: give game-day searchers an
                immediate action instead of a wall of text before any deals. */}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/deals/game-day"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                <Trophy className="h-4 w-4" />
                See {totalGameDay} live game-day deals
              </Link>
              <Link
                href="/happy-hours/wrigleyville"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <Beer className="h-4 w-4" />
                Wrigleyville happy hours
              </Link>
            </div>

            {/* How game day works, evergreen. The old hardcoded "Upcoming Home
                Stands" list went stale within weeks (a guide showing past dates
                reads as abandoned and drives bounce); live dates stay at
                cubs.com/schedule. */}
            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                How Game Day Works in Wrigleyville
              </h2>
              <ul className="space-y-2.5">
                <li className="flex items-baseline gap-3 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0 text-brand-500" />
                  <span>Day games start at <span className="font-semibold text-foreground">1:20 PM</span>, night games at <span className="font-semibold text-foreground">7:05 PM</span>, bars open roughly two hours before first pitch.</span>
                </li>
                <li className="flex items-baseline gap-3 text-sm text-muted-foreground">
                  <Beer className="h-4 w-4 shrink-0 text-brand-500" />
                  <span>Pre-game specials run through the early innings; post-game happy hours kick in as the crowd spills onto Clark &amp; Addison.</span>
                </li>
                <li className="flex items-baseline gap-3 text-sm text-muted-foreground">
                  <Trophy className="h-4 w-4 shrink-0 text-brand-500" />
                  <span>Checking whether there&apos;s a game today? See the current home stand at{" "}
                    <a href="https://www.mlb.com/cubs/schedule" target="_blank" rel="noopener noreferrer" className="text-brand-500 underline hover:text-brand-600">cubs.com/schedule</a>.</span>
                </li>
              </ul>
            </div>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Trophy className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{totalGameDay}</div>
              <div className="text-xs text-muted-foreground">Game Day Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{sportsBarVenues}</div>
              <div className="text-xs text-muted-foreground">Sports Bars</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{brunchCount}</div>
              <div className="text-xs text-muted-foreground">Brunch Spots</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{neighborhoodCount}</div>
              <div className="text-xs text-muted-foreground">Neighborhoods</div>
            </div>
          </div>

          {/* Section: Last-Minute Game Day Essentials */}
          <AffiliateEssentials
            title="Last-Minute Game Day Essentials"
            subtitle="Heading to Wrigley? Grab these before you go."
            footnote="Your phone will die by the 5th inning, pack a portable charger too."
            items={[
              { href: "https://amzn.to/4cGEHOc", img: "https://m.media-amazon.com/images/I/5152lZg4r2L._AC_SX679_.jpg", label: "Cooperstown Polo" },
              { href: "https://amzn.to/4udP0QX", img: "https://m.media-amazon.com/images/I/619Idv727GL._AC_SX679_.jpg", label: "Classic Cubs Hat" },
              { href: "https://amzn.to/48nNh3o", img: "https://m.media-amazon.com/images/I/81UofV2eE9L._AC_SX679_.jpg", label: "Waterproof Camera" },
              { href: "https://amzn.to/4t0vNkO", img: "https://m.media-amazon.com/images/I/71tZ3w1Y+3L._AC_SX679_.jpg", label: "Clear Stadium Bag" },
            ]}
          />

          <BookingCTA
            campaign="cubs_guide"
            destination="https://www.booking.com/searchresults.html?ss=Wrigleyville%2C+Chicago"
            headline="Coming in for a Cubs game?"
            subhead="Hotels and rentals near Wrigley Field. Free cancellation on most rooms."
          />

          {/* Section: Game Day Specials Near Wrigley */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Game Day Specials Near Wrigley
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {totalGameDay > 0
                ? `We found ${totalGameDay} game day specials across ${sportsBarVenues} bars and restaurants within walking distance of Wrigley Field. These run on Cubs home game days.`
                : "Check back closer to game day for specials at bars and restaurants near Wrigley Field."}
            </p>
            {gameDayDeals.length > 0 && (() => {
              // Consolidate by venue, one entry per venue with all deals listed under it
              const byVenue = new Map<string, { name: string; slug: string; neighborhood: string; deals: typeof gameDayDeals }>()
              for (const d of gameDayDeals) {
                const key = d.venue_slug || d.venue_name
                if (!byVenue.has(key)) {
                  byVenue.set(key, { name: d.venue_name, slug: d.venue_slug, neighborhood: d.neighborhood, deals: [] })
                }
                byVenue.get(key)!.deals.push(d)
              }
              const venues = Array.from(byVenue.values())
              return (
                <div className="space-y-6">
                  {venues.map((v, idx) => (
                    <div key={v.slug}>
                      {idx > 0 && (
                        <div className="my-6 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
                      )}
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={`/venues/${v.slug}`}
                          className="text-lg font-bold text-brand-500 hover:underline"
                        >
                          {v.name}
                        </Link>
                        <span className="shrink-0 text-xs text-muted-foreground">{v.neighborhood}</span>
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {v.deals.map((deal) => (
                          <li key={deal.id} className="text-sm leading-relaxed text-foreground">
                            <span className="font-medium">{deal.title}</span>
                            {deal.description && (
                              <span className="text-muted-foreground">, {deal.description}</span>
                            )}
                            {(deal.start_time || deal.end_time) && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({deal.start_time && deal.end_time
                                  ? `${deal.start_time}–${deal.end_time}`
                                  : deal.start_time || deal.end_time})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )
            })()}
          </section>

          {/* Section: More Specials at Wrigleyville Bars */}
          {wrigleyvilleSpecials.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-2 text-2xl font-bold text-foreground">
                More Specials at Wrigleyville Bars
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Daily specials, weekly trivia, and recurring events at the same Wrigleyville bars
                you&apos;d hit on game day, useful before, after, or on off-days.
              </p>
              {(() => {
                const byVenue = new Map<string, { name: string; slug: string; deals: typeof wrigleyvilleSpecials }>()
                for (const d of wrigleyvilleSpecials) {
                  const key = d.venue_slug || d.venue_name
                  if (!byVenue.has(key)) {
                    byVenue.set(key, { name: d.venue_name, slug: d.venue_slug, deals: [] })
                  }
                  byVenue.get(key)!.deals.push(d)
                }
                const venues = Array.from(byVenue.values())
                return (
                  <div className="space-y-6">
                    {venues.map((v, idx) => (
                      <div key={v.slug}>
                        {idx > 0 && (
                          <div className="my-6 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
                        )}
                        <Link
                          href={`/venues/${v.slug}`}
                          className="text-lg font-bold text-brand-500 hover:underline"
                        >
                          {v.name}
                        </Link>
                        <ul className="mt-2 space-y-1.5">
                          {v.deals.map((deal) => (
                            <li key={deal.id} className="text-sm leading-relaxed text-foreground">
                              <span className="font-medium">{deal.title}</span>
                              {deal.description && (
                                <span className="text-muted-foreground">, {deal.description}</span>
                              )}
                              {(deal.start_time || deal.end_time) && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({deal.start_time && deal.end_time
                                    ? `${deal.start_time}–${deal.end_time}`
                                    : deal.start_time || deal.end_time})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </section>
          )}

          {/* Section: Pre-Game Brunch */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Pre-Game Brunch
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Gates open at 11:20 AM, so a 9 or 10 AM brunch gives you time to eat, grab a drink,
              and stroll to Wrigley.{" "}
              {brunchCount > 0
                ? `We found ${brunchCount} brunch deals in the Wrigleyville area.`
                : "Check our brunch guide for spots near Wrigley."}
              {" "}See our{" "}
              <Link href="/guides/best-brunch-chicago" className="text-brand-600 hover:underline dark:text-brand-400">
                full brunch guide
              </Link>{" "}
              for the complete list.
            </p>
            {brunchDeals.length > 0 && (
              <div className="space-y-4">
                {brunchDeals.slice(0, 8).map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/venues/${deal.venue_slug}`}
                          className="text-base font-semibold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {deal.venue_name}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {deal.neighborhood}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {deal.title}
                    </div>
                    {deal.description && (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {deal.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section: Happy Hour After the Game */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Happy Hour After the Game
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              A 1:20 PM first pitch means the game ends around 4-4:30 PM, right in time for happy hour.
              {thursdayHH.length > 0
                ? ` We found ${thursdayHH.length} Thursday happy hour deals near Wrigley.`
                : " Many Wrigleyville bars offer daily happy hours."}
              {" "}Post-game crowds are part of the fun, but arrive early for the best seats.
            </p>
            {thursdayHH.length > 0 && (
              <div className="space-y-4">
                {thursdayHH.slice(0, 8).map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/venues/${deal.venue_slug}`}
                          className="text-base font-semibold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {deal.venue_name}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {deal.neighborhood}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {deal.title}
                    </div>
                    {deal.description && (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {deal.description}
                      </p>
                    )}
                    {(deal.start_time || deal.end_time) && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {deal.start_time && deal.end_time
                          ? `${deal.start_time} - ${deal.end_time}`
                          : deal.start_time || deal.end_time}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section: Getting to Wrigley */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              Getting to Wrigley
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">CTA Red Line:</strong> Take the Red Line to Addison.
                The station is one block from the main gate. By far the easiest way to get there on game day.
              </p>
              <p>
                <strong className="text-foreground">Don&apos;t drive:</strong> Street parking disappears
                fast on game days. Permit zones and tow trucks are aggressive, and garage rates near
                Wrigley can hit $50+. Take the L, a rideshare, or bike.
              </p>
              <p>
                <strong className="text-foreground">Spring &amp; summer dressing:</strong> Wrigley is an
                open-air park and the wind off the lake makes upper-deck and bleacher seats colder than
                it feels on Clark Street. April–May games run cool, bring a light layer. June–August
                day games can hit 90°F+ in the bleachers with no shade, sunscreen, water, and a hat.
              </p>
              <p>
                <strong className="text-foreground">Get there early:</strong> Gates open 2 hours before
                first pitch (11:20 AM for day games, 5:05 PM for nights). Show up early to catch batting
                practice, grab the best bleacher spot, or tour the team store.
              </p>
            </div>
          </section>

          {/* Search handoff */}
          <section className="mb-12">
            <GuideSearchHandoff
              headline="Heading to Wrigleyville?"
              subtitle="Search every live game-day special near the ballpark, pregame happy hours, and post-game late-night eats."
              cta={{ label: "Search Wrigleyville deals", href: "/search?q=wrigleyville" }}
              links={[
                { label: "Game-day specials", href: "/deals/game-day" },
                { label: "Happy hours", href: "/deals/happy-hours" },
                { label: "Late-night eats", href: "/deals/late-night" },
                { label: "Beer specials", href: "/deals/beer-specials" },
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
              This guide is based on data from 312Deals, which tracks food and drink deals
              across Chicagoland. Game day specials, happy hours, and brunch deals are scraped
              from restaurant websites and verified by our community. Prices and availability
              may change, always confirm with the venue directly. Last updated:{" "}
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              As an Amazon Associate, 312Deals earns from qualifying purchases.
            </p>
          </section>

          {/* CTAs */}
          <div className="mb-10 flex flex-wrap gap-3">
            <Link
              href="/neighborhoods/wrigleyville"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
            >
              Search Wrigleyville Deals
            </Link>
            <Link
              href="/map"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              View Deal Map
            </Link>
            <Link
              href="/guides/college-bars-chicago"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              College Bars Guide
            </Link>
          </div>

          {/* Email Signup */}
          <EmailSignup source="cubs-opening-day-guide" />
        </article>
      </div>
      <Footer />
    </div>
  )
}
