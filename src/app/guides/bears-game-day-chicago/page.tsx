import Link from "next/link"
import type { Metadata } from "next"
import { Trophy, MapPin, Calendar, Beer, Tv, Star } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo-utils"
import { uniqueByVenue, groupByNeighborhood, isLocalVenue, DEAL_TYPE_LABEL } from "@/lib/guide-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 1800

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"
const PAGE_URL = `${SITE_URL}/guides/bears-game-day-chicago`

// ── Tagged roster (bears_2026 venues via the generic tagged endpoint) ──

type RosterTopDeal = {
  title: string
  deal_type?: string | null
  days_available?: string[] | null
  start_time?: string | null
  end_time?: string | null
  price?: number | null
  is_tagged?: boolean
}
type RosterVenue = {
  id: number
  name: string
  slug: string
  address?: string | null
  is_sports_bar?: number | null
  google_rating?: number | null
  google_review_count?: number | null
  neighborhood?: string | null
  neighborhood_slug?: string | null
  zone?: string | null
  has_deal?: number
  deal_count?: number
  top_deal?: RosterTopDeal | null
}
type RosterGroup = { name: string; slug: string | null; zone?: string | null; venues: RosterVenue[] }
type RosterResponse = {
  venues: RosterVenue[]
  count: number
  neighborhoods: RosterGroup[]
  neighborhood_count: number
  deal_count: number
}

async function getBearsRoster(): Promise<RosterResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/venues/tagged/bears_2026`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return (await res.json()) as RosterResponse
  } catch {
    return null
  }
}

// Bears/NFL relevance for the deals rail: admit Bears/NFL/generic game-day
// text, exclude other sports and other Chicago teams.
function isBearsRelevant(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`
  if (/bears|nfl|monday night football|sunday.*football|tailgate|touchdown/i.test(text)) return true
  if (/cubs|white sox|blackhawks|bulls|soccer|futbol|world cup|fifa|premier league|liga mx|ncaa|college|march madness|basketball|baseball|hockey/i.test(text)) return false
  return /game.?day|watch part|big game|football/i.test(text)
}

async function getGameDayDeals(): Promise<Deal[]> {
  try {
    const types = ["game_day", "daily_special"]
    const results = await Promise.all(
      types.map((t) =>
        fetch(`${API_URL}/api/v1/deals/search?deal_type=${t}&limit=200`, {
          next: { revalidate: 3600 },
        })
          .then((r): Promise<SearchResponse> => (r.ok ? r.json() : Promise.resolve({ deals: [] } as unknown as SearchResponse)))
          .catch(() => ({ deals: [] } as unknown as SearchResponse))
      )
    )
    return results.flatMap((r) => r.deals ?? []).filter(isBearsRelevant)
  } catch {
    return []
  }
}

const HOTEL_CHAIN = /hotel|marriott|hyatt|dave & buster|dave and buster|miller's ale house|twin peaks|buffalo wild|city works|old town pour house \(/i

function topPicksFrom(roster: RosterResponse | null): RosterVenue[] {
  if (!roster) return []
  return roster.venues
    .filter(
      (v) =>
        !HOTEL_CHAIN.test(v.name) &&
        (v.google_review_count ?? 0) >= 200 &&
        // Popularity alone lets in high-review restaurants that are not game-day
        // rooms at all (a brunch spot outranks a real sports bar on raw volume).
        // Require an actual signal: flagged sports bar, or a Bears/NFL deal.
        (v.is_sports_bar === 1 || v.has_deal === 1)
    )
    .sort(
      (a, b) =>
        (b.google_rating ?? 0) * (b.google_review_count ?? 0) -
        (a.google_rating ?? 0) * (a.google_review_count ?? 0)
    )
    .slice(0, 8)
}

// Verified 2026 home slate (early season) — away opener included for week 1.
const SCHEDULE = [
  { date: "Sun, Sep 13", opponent: "at Carolina Panthers", note: "Season opener (away)" },
  { date: "Sun, Sep 20 · 1:00 PM", opponent: "vs Minnesota Vikings", note: "Home opener at Soldier Field" },
  { date: "Mon, Sep 28 · 8:15 PM", opponent: "vs Philadelphia Eagles", note: "Monday Night Football" },
  { date: "Sun, Oct 4 · 1:00 PM", opponent: "vs New York Jets", note: "" },
  { date: "Thu, Oct 22 · 8:15 PM", opponent: "vs New England Patriots", note: "Thursday Night Football" },
]

export const metadata: Metadata = {
  title: "Bears Game Day Bars Chicago 2026, Where to Watch & Best Specials",
  description:
    "The best bars to watch the Bears in Chicago and the suburbs: 300+ sports bars with game day food & drink specials, mapped by neighborhood. Home opener Sep 20 vs the Vikings. Updated weekly all season.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Bears Game Day Bars Chicago 2026, Where to Watch & Best Specials",
    description:
      "300+ Chicago and suburban bars for Bears Sundays, with live game day specials by neighborhood. Updated weekly through the season.",
    url: PAGE_URL,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Bears+Game+Day+2026&subtitle=Where+to+watch+%2B+best+specials%2C+city+and+suburbs&emoji=%F0%9F%8F%88&badges=300%2B+bars%2CGame-day+specials%2CEvery+neighborhood`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bears Game Day Bars Chicago 2026 | 312Deals",
    description: "Where to watch the Bears + the best game day specials, city and suburbs.",
  },
}

export default async function Page() {
  const [roster, gameDayDeals] = await Promise.all([getBearsRoster(), getGameDayDeals()])
  const topPicks = topPicksFrom(roster)
  const hoodGroups = (roster?.neighborhoods ?? []).filter((g) => g.slug).slice(0, 12)
  const dealRail = uniqueByVenue(gameDayDeals.filter(isLocalVenue)).slice(0, 12)
  const venueCount = roster?.count ?? 0
  const hoodCount = roster?.neighborhood_count ?? 0
  const countLabel = venueCount >= 50 ? `${Math.floor(venueCount / 50) * 50}+` : `${venueCount || "300+"}`

  const faqItems = [
    {
      q: "Where do Bears fans watch games in Chicago?",
      a: "The heaviest Bears crowds pack the sports bars of Wrigleyville, Lakeview, Lincoln Park, River North, and the Loop, with strong game-day scenes in Portage Park, Jefferson Park, and the Southwest Side. Nearly every neighborhood tavern with TVs runs some kind of Sunday special during the season, and suburban strongholds like Naperville, Schaumburg, and Orland Park fill up just as fast.",
    },
    {
      q: "What time do bars open for Bears games?",
      a: "For noon kickoffs most sports bars open by 10 or 11 AM, and many run breakfast-and-bloody-mary packages before the game. For prime-time games (Monday and Thursday night), regular evening hours apply but tables go early, arrive at least an hour before kickoff for a big matchup.",
    },
    {
      q: "What game day specials do Chicago bars run on Bears Sundays?",
      a: "Typical Bears Sunday specials include wing and pitcher bundles, $5-8 domestic drafts, bucket deals, half-price appetizers during the game, and bloody mary or mimosa specials for noon kickoffs. 312Deals tracks the current specials at hundreds of bars, each listing shows exact prices, days, and hours.",
    },
    {
      q: "Where can I watch the Bears in the suburbs?",
      a: "Suburban sports bars in Naperville, Schaumburg, Orland Park, Arlington Heights, and along the North Shore all show every Bears game. Chains like Old Town Pour House and Miller's Ale House have multiple locations, and most local taverns run their own game day food and drink deals.",
    },
    {
      q: "When is the Bears home opener in 2026?",
      a: "The Bears open the 2026 season at Carolina on Sunday, September 13, then host the home opener against the Minnesota Vikings at Soldier Field on Sunday, September 20 at noon. A Monday Night Football date against the Eagles follows on September 28.",
    },
  ]

  // Venue ItemList built inline — seo-utils' buildItemListJsonLd takes Deal[],
  // this list is a venue roster.
  const itemListJsonLd =
    topPicks.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Best Bears game day bars in Chicago",
          description: "Top-rated Chicago bars for watching the Bears, ranked by rating and popularity.",
          url: PAGE_URL,
          numberOfItems: topPicks.length,
          itemListElement: topPicks.map((v, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: { "@type": "BarOrPub", name: v.name, url: `${SITE_URL}/venues/${v.slug}` },
          })),
        }
      : null

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbJsonLd([
              { name: "Home", url: SITE_URL },
              { name: "Guides", url: `${SITE_URL}/guides` },
              { name: "Bears Game Day Chicago", url: PAGE_URL },
            ])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <Navbar />
      <div className="flex-1">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-4 text-xs text-muted-foreground lg:px-6">
          <Link href="/" className="hover:text-brand-500">Home</Link>
          {" / "}
          <Link href="/guides" className="hover:text-brand-500">Guides</Link>
          {" / "}
          <span className="text-foreground">Bears Game Day Chicago</span>
        </nav>

        {/* Hero */}
        <header className="mx-auto max-w-7xl px-4 pt-6 lg:px-6">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">2026 Season</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-700">Home opener Sep 20</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Bears Game Day in Chicago: Where to Watch &amp; the Best Bar Specials
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
            {countLabel} bars across {hoodCount || "75+"} Chicago neighborhoods and suburbs show every Bears
            game, and the good ones back it up with wing bundles, pitcher deals, and bloody mary bars for
            noon kickoffs. This guide maps the city&apos;s real Bears bars, the neighborhood taverns and
            sports bars where the game is the point, with the current game day specials pulled live from
            our deals database. Updated weekly through the season.
          </p>
        </header>

        {/* 2026 schedule */}
        <section className="mx-auto max-w-7xl px-4 pt-8 lg:px-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Early 2026 schedule, circle these</h2>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Matchup</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {SCHEDULE.map((g) => (
                  <tr key={g.date} className="border-b border-border/60">
                    <td className="py-2.5 pr-4 font-medium text-foreground whitespace-nowrap">{g.date}</td>
                    <td className="py-2.5 pr-4">{g.opponent}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{g.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Prime-time games (Sep 28, Oct 22) are the big bar nights, book or show up early.
          </p>
        </section>

        {/* Top picks marquee */}
        {topPicks.length >= 4 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">Top picks: the marquee Bears bars</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              High-rated, high-energy rooms that treat Bears Sundays like a holiday.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {topPicks.map((v) => (
                <Link
                  key={v.id}
                  href={`/venues/${v.slug}`}
                  className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg"
                >
                  <h3 className="text-sm font-bold leading-tight text-foreground group-hover:text-brand-500">{v.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {v.neighborhood || "Chicago"}
                    {v.google_rating ? ` · ${v.google_rating.toFixed(1)}★` : ""}
                  </p>
                  {v.top_deal && (
                    <p className="mt-2 line-clamp-2 text-xs leading-snug text-muted-foreground">
                      <span className="font-semibold text-brand-600 dark:text-brand-400">
                        {DEAL_TYPE_LABEL[v.top_deal.deal_type ?? ""] ?? "Deal"}:
                      </span>{" "}
                      {v.top_deal.title}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* By neighborhood */}
        {hoodGroups.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">Bears bars by neighborhood</h2>
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {hoodGroups.map((g) => (
                <div key={g.slug} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      {g.slug ? (
                        <Link href={`/neighborhoods/${g.slug}`} className="hover:text-brand-500">{g.name}</Link>
                      ) : (
                        g.name
                      )}
                    </h3>
                    <span className="text-xs text-muted-foreground">{g.venues.length} spots</span>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {g.venues.slice(0, 6).map((v) => (
                      <li key={v.id} className="text-sm leading-snug">
                        <Link href={`/venues/${v.slug}`} className="font-medium text-foreground hover:text-brand-500">
                          {v.name}
                        </Link>
                        {v.google_rating ? (
                          <span className="text-xs text-muted-foreground"> · {v.google_rating.toFixed(1)}★</span>
                        ) : null}
                        {v.top_deal && (
                          <span className="block text-xs text-muted-foreground line-clamp-1">{v.top_deal.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {g.slug && (
                    <Link
                      href={`/neighborhoods/${g.slug}`}
                      className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      All {g.name} deals &rarr;
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Live game-day deals rail */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Beer className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Game day specials running now</h2>
          </div>
          {dealRail.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dealRail.map((d) => (
                <Link
                  key={d.id}
                  href={d.venue_slug ? `/venues/${d.venue_slug}` : "/deals/game-day"}
                  className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-500"
                >
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">{d.venue_name}</p>
                  <h3 className="mt-1 text-sm font-bold leading-tight text-foreground group-hover:text-brand-500">{d.title}</h3>
                  {d.neighborhood && (
                    <p className="mt-1 text-xs text-muted-foreground">{d.neighborhood}</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Game day specials ramp up as kickoff approaches, bars post their Bears Sunday menus in
              late August and early September. Check back during week 1, or browse{" "}
              <Link href="/deals/game-day" className="text-brand-600 hover:underline dark:text-brand-400">all game day deals</Link>{" "}
              running right now.
            </p>
          )}
          <div className="mt-4">
            <Link
              href="/deals/game-day"
              className="inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
            >
              Browse all game day deals
            </Link>
          </div>
        </section>

        {/* Watching from home / suburbs prose */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Suburbs count too</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Chicagoland&apos;s Bears scene doesn&apos;t stop at the city line. Naperville, Schaumburg,
            Arlington Heights, Orland Park, and the North Shore all have sports bars where Sunday noon
            means every TV on the game and a wing deal on the table. Use the neighborhood links above or{" "}
            <Link href="/search?q=game+day" className="text-brand-600 hover:underline dark:text-brand-400">search game day</Link>{" "}
            with your suburb&apos;s name to see what&apos;s running near you.
          </p>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Bears game day FAQ</h2>
          </div>
          <div className="mt-4 space-y-5 max-w-3xl">
            {faqItems.map((f) => (
              <div key={f.q}>
                <h3 className="text-sm font-bold text-foreground">{f.q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cross-links */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <h2 className="text-sm font-semibold text-foreground">Keep exploring</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/deals/game-day" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">All Game Day Deals</Link>
            <Link href="/guides/college-bars-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">College Bars &amp; Alumni Bars</Link>
            <Link href="/guides/college-football-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">College Football Saturdays</Link>
            <Link href="/guides/cubs-game-day-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Cubs Game Day</Link>
            <Link href="/guides/world-cup-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Chicago Soccer Bars</Link>
            <Link href="/deals/wing-deals" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Wing Deals</Link>
            <Link href="/today" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Deals Today</Link>
          </div>
        </section>

        {/* Search handoff + signup */}
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
          <GuideSearchHandoff
            headline="Find your Bears bar"
            subtitle="Search game day specials by neighborhood, suburb, or day."
            cta={{ label: "Search game day deals", href: "/search?q=game+day" }}
            links={[
              { label: "Wing deals", href: "/deals/wing-deals" },
              { label: "Beer specials", href: "/deals/beer-specials" },
              { label: "Wrigleyville", href: "/neighborhoods/wrigleyville" },
              { label: "Deals today", href: "/today" },
            ]}
          />
          <div className="mt-8">
            <EmailSignup
              source="bears-guide"
              headline="Get the best Bears Sunday specials, every week"
              subtitle="One email every Thursday with the best game day deals for the weekend, city and suburbs. Free, unsubscribe anytime."
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
