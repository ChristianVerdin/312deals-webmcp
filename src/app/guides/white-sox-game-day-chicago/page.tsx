import Link from "next/link"
import type { Metadata } from "next"
import { Trophy, MapPin, Calendar, Beer, Train, Star } from "lucide-react"
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
const PAGE_URL = `${SITE_URL}/guides/white-sox-game-day-chicago`

// The ballpark ring. Rate Field sits in Armour Square; Bridgeport is the walk-up
// neighborhood, Chinatown is one Red Line stop north, and South Loop / Pilsen are
// the realistic pre- and post-game options. Ordered by proximity to the park.
const SOX_NEIGHBORHOODS = [
  "armour-square",
  "bridgeport",
  "chinatown",
  "south-loop",
  "pilsen",
  "mckinley-park",
]

// Admit Sox/baseball/generic game-day text, exclude the other Chicago teams and
// other sports. Mirrors isBearsRelevant on the Bears guide.
function isSoxRelevant(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`
  if (/white sox|sox game|rate field|comiskey|baseball|first pitch|ballpark/i.test(text)) return true
  // Other Chicago teams and other sports. \bsky\b/\bfire\b are word-bounded so
  // "Skyline" and "fire-roasted" don't trip them.
  if (/bears|nfl|football|blackhawks|bulls|\bsky\b|wnba|red stars|\bfire\b fc|chicago fire|soccer|futbol|world cup|\bcup\b|fifa|premier league|liga mx|ncaa|march madness|basketball|hockey/i.test(text))
    return false
  return /game.?day|watch part|big game/i.test(text)
}

// Food-and-drink types only. event_driven is deliberately excluded: in these
// neighborhoods it is open mics, concert tickets and giveaways, not specials.
const FOOD_DRINK_TYPES = ["game_day", "happy_hour", "daily_special", "brunch_deal", "late_night"]

// Fetch per neighborhood rather than sampling the sitewide top 200 and filtering
// down, which surfaced only a few dozen of the ~3,000 deals in the ballpark ring.
async function fetchHoodDeals(slug: string): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?neighborhood=${slug}&chain_filter=local&limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return (data.deals ?? []).filter((d) => FOOD_DRINK_TYPES.includes(d.deal_type ?? ""))
  } catch {
    return []
  }
}

async function getBallparkDeals(): Promise<{
  gameDay: Deal[]
  happyHour: Deal[]
  specials: Deal[]
}> {
  const byHood = await Promise.all(SOX_NEIGHBORHOODS.map(fetchHoodDeals))
  const all = byHood.flat()
  return {
    gameDay: all.filter((d) => d.deal_type === "game_day" && isSoxRelevant(d)),
    happyHour: all.filter((d) => d.deal_type === "happy_hour"),
    specials: all.filter((d) => !["game_day", "happy_hour"].includes(d.deal_type ?? "")),
  }
}

// ── Crosstown Classic ─────────────────────────────────────────────────────────
// Verified 2026 dates. The section is date-driven so this page stays correct
// after the series ends instead of going stale like a dated event page.
type Series = { start: string; end: string; park: string; host: "White Sox" | "Cubs"; label: string }

const CROSSTOWN_2026: Series[] = [
  {
    start: "2026-05-15",
    end: "2026-05-17",
    park: "Rate Field",
    host: "White Sox",
    label: "May 15–17",
  },
  {
    start: "2026-08-17",
    end: "2026-08-19",
    park: "Wrigley Field",
    host: "Cubs",
    label: "Aug 17–19",
  },
]

function chicagoToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" })
}

/** The series happening now, else the next one this season, else null (season done). */
function crosstownStatus(today: string): { series: Series; live: boolean } | null {
  const live = CROSSTOWN_2026.find((s) => today >= s.start && today <= s.end)
  if (live) return { series: live, live: true }
  const next = CROSSTOWN_2026.find((s) => today < s.start)
  return next ? { series: next, live: false } : null
}

export const metadata: Metadata = {
  title: "White Sox Game Day Chicago, Bars Near Rate Field & Best Specials",
  description:
    "Where to eat and drink for a White Sox game: Bridgeport taverns, Chinatown pre-game, and South Loop bars near Rate Field, with live food and drink specials by neighborhood. Updated all season.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "White Sox Game Day Chicago, Bars Near Rate Field & Best Specials",
    description:
      "Bridgeport, Chinatown and South Loop bars for Sox game day, with live specials pulled from our deals database.",
    url: PAGE_URL,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=White+Sox+Game+Day&subtitle=Bars+near+Rate+Field+%2B+the+best+specials&emoji=%E2%9A%BE&badges=Bridgeport+%26+Chinatown%2CPregame+specials%2CSouth+Side`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "White Sox Game Day Chicago | 312Deals",
    description: "Bars near Rate Field, Bridgeport pre-game, and the best South Side specials.",
  },
}

export default async function Page() {
  const { gameDay, happyHour, specials } = await getBallparkDeals()
  const today = chicagoToday()
  const crosstown = crosstownStatus(today)

  const allDeals = [...gameDay, ...happyHour, ...specials]
  const localDeals = allDeals.filter(isLocalVenue)
  const dealRail = uniqueByVenue([...gameDay, ...happyHour].filter(isLocalVenue)).slice(0, 12)
  const hoodGroups = groupByNeighborhood(uniqueByVenue(localDeals)).slice(0, 6)

  const venueCount = new Set(localDeals.map((d) => d.venue_slug || d.venue_name)).size
  const dealCount = allDeals.length
  const hoodCount = hoodGroups.length

  // Top picks: rating-weighted, one per venue, real rooms only.
  const topPicks = uniqueByVenue(
    [...gameDay, ...happyHour, ...specials].filter(isLocalVenue)
  ).slice(0, 8)

  const faqItems = [
    {
      q: "What bars are near Rate Field?",
      a: `The walk-up scene is Bridgeport, the neighborhood immediately south and west of the park, where 35th Street and Halsted are lined with old-school taverns. Chinatown is one Red Line stop north and the best pre-game food option in the area. We track ${dealCount} active food and drink deals at ${venueCount} venues across the ballpark neighborhoods.`,
    },
    {
      q: "Where should I eat before a White Sox game?",
      a: "Chinatown is the move, it's a five-minute Red Line ride or a 20-minute walk from Rate Field, and you can eat well for a fraction of ballpark prices. Bridgeport is the classic tavern option if you want a beer and a burger within walking distance of the gates, and South Loop works if you're coming from downtown.",
    },
    {
      q: "How do I get to Rate Field?",
      a: "The Red Line's Sox-35th stop puts you at the gates, and the Green Line's 35th-Bronzeville-IIT stop is a short walk east. Driving means paying for the lots off 35th, so most locals take the train and park the car in Bridgeport or Chinatown instead.",
    },
    {
      q: "When is the Crosstown Classic?",
      a: crosstown
        ? `The Cubs and White Sox meet twice a season. In 2026 they played ${CROSSTOWN_2026[0].label} at Rate Field and ${CROSSTOWN_2026[1].label} at Wrigley Field. The series alternates home parks each time, so bar crowds swing between Bridgeport and Wrigleyville.`
        : "The Cubs and White Sox meet twice each season, once at Rate Field on the South Side and once at Wrigley Field on the North Side. The 2026 editions ran May 15-17 and August 17-19. Next season's dates are set when MLB releases the schedule.",
    },
    {
      q: "Do South Side bars run game day specials?",
      a: `Yes. Bridgeport taverns and Chinatown restaurants run drink specials and food deals on home game days, and ${gameDay.length > 0 ? `${gameDay.length} game-day deals are live right now` : "specials post closer to first pitch"}. Every listing here shows exact prices, days, and hours.`,
    },
  ]

  const itemListJsonLd =
    topPicks.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Best bars and restaurants near Rate Field",
          description:
            "Top spots for White Sox game day across Bridgeport, Chinatown, South Loop and Pilsen.",
          url: PAGE_URL,
          numberOfItems: topPicks.length,
          itemListElement: topPicks.map((d, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Restaurant",
              name: d.venue_name,
              url: d.venue_slug ? `${SITE_URL}/venues/${d.venue_slug}` : PAGE_URL,
            },
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
              { name: "White Sox Game Day Chicago", url: PAGE_URL },
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
        <nav
          aria-label="Breadcrumb"
          className="mx-auto max-w-7xl px-4 pt-4 text-xs text-muted-foreground lg:px-6"
        >
          <Link href="/" className="hover:text-brand-500">Home</Link>
          {" / "}
          <Link href="/guides" className="hover:text-brand-500">Guides</Link>
          {" / "}
          <span className="text-foreground">White Sox Game Day Chicago</span>
        </nav>

        {/* Hero */}
        <header className="mx-auto max-w-7xl px-4 pt-6 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-700">
              Rate Field
            </span>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              Bridgeport &amp; Chinatown
            </span>
            {crosstown?.live && (
              <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-primary-foreground">
                Crosstown Classic on now
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            White Sox Game Day: Where to Eat &amp; Drink Near Rate Field
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
            The South Side ballpark scene is the best-value game day in Chicago and almost nobody
            writes about it. Bridgeport&apos;s taverns are a ten-minute walk from the gates, Chinatown
            is one Red Line stop away with better food than anything inside the park, and South Loop
            covers you if you&apos;re coming from downtown. This guide maps all of it, with{" "}
            {dealCount > 0 ? `${dealCount} live food and drink deals` : "live food and drink deals"} at{" "}
            {venueCount > 0 ? `${venueCount} venues` : "venues"} across the ballpark neighborhoods,
            pulled straight from our database and updated all season.
          </p>
        </header>

        {/* Crosstown Classic — date-driven, stays correct after the series ends */}
        {crosstown && (
          <section className="mx-auto max-w-7xl px-4 pt-8 lg:px-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-500" aria-hidden="true" />
                <h2 className="text-xl font-bold text-foreground">
                  {crosstown.live ? "Crosstown Classic, happening now" : "Next up: the Crosstown Classic"}
                </h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {crosstown.live ? (
                  <>
                    The Cubs and White Sox are playing {crosstown.series.label} at{" "}
                    {crosstown.series.park}, so the crowds are on the{" "}
                    {crosstown.series.host === "Cubs" ? "North Side this time" : "South Side this time"}.
                    {crosstown.series.host === "Cubs" ? (
                      <>
                        {" "}Sox fans heading north can use our{" "}
                        <Link href="/guides/cubs-game-day-chicago" className="text-brand-600 hover:underline dark:text-brand-400">
                          Wrigleyville guide
                        </Link>
                        , and the Bridgeport bars below still run specials for the away broadcast.
                      </>
                    ) : (
                      <> Bridgeport and Chinatown fill up early, get there before first pitch.</>
                    )}
                  </>
                ) : (
                  <>
                    The Cubs and White Sox next meet {crosstown.series.label} at {crosstown.series.park}.
                    The series alternates parks, so the bar crowd swings between Bridgeport and
                    Wrigleyville depending on who&apos;s hosting.
                  </>
                )}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">Series</th>
                      <th className="py-2 pr-4">Ballpark</th>
                      <th className="py-2">Neighborhood to be in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CROSSTOWN_2026.map((s) => (
                      <tr key={s.start} className="border-b border-border/60">
                        <td className="py-2.5 pr-4 font-medium text-foreground whitespace-nowrap">
                          {s.label}
                        </td>
                        <td className="py-2.5 pr-4">{s.park}</td>
                        <td className="py-2.5 text-muted-foreground">
                          {s.host === "White Sox" ? "Bridgeport / Chinatown" : "Wrigleyville / Lakeview"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Top picks */}
        {topPicks.length >= 4 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">Top picks near the park</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Spots with a live deal on the board, walking or one train stop from Rate Field.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {topPicks.map((d) => (
                <Link
                  key={d.id}
                  href={d.venue_slug ? `/venues/${d.venue_slug}` : "/deals/game-day"}
                  className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg"
                >
                  <h3 className="text-sm font-bold leading-tight text-foreground group-hover:text-brand-500">
                    {d.venue_name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{d.neighborhood || "Chicago"}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-snug text-muted-foreground">
                    <span className="font-semibold text-brand-600 dark:text-brand-400">
                      {DEAL_TYPE_LABEL[d.deal_type ?? ""] ?? "Deal"}:
                    </span>{" "}
                    {d.title}
                  </p>
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
              <h2 className="text-xl font-bold text-foreground">
                Ballpark neighborhoods, block by block
              </h2>
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {hoodGroups.map((g) => (
                <div key={g.name} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      {g.slug ? (
                        <Link href={`/neighborhoods/${g.slug}`} className="hover:text-brand-500">
                          {g.name}
                        </Link>
                      ) : (
                        g.name
                      )}
                    </h3>
                    <span className="text-xs text-muted-foreground">{g.venues.length} spots</span>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {g.venues.slice(0, 6).map((d) => (
                      <li key={d.id} className="text-sm leading-snug">
                        <Link
                          href={d.venue_slug ? `/venues/${d.venue_slug}` : "/deals"}
                          className="font-medium text-foreground hover:text-brand-500"
                        >
                          {d.venue_name}
                        </Link>
                        <span className="block text-xs text-muted-foreground line-clamp-1">
                          {d.title}
                        </span>
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

        {/* Live deals rail */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Beer className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Specials running now</h2>
          </div>
          {dealRail.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dealRail.map((d) => (
                <Link
                  key={d.id}
                  href={d.venue_slug ? `/venues/${d.venue_slug}` : "/deals/game-day"}
                  className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-500"
                >
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                    {d.venue_name}
                  </p>
                  <h3 className="mt-1 text-sm font-bold leading-tight text-foreground group-hover:text-brand-500">
                    {d.title}
                  </h3>
                  {d.neighborhood && (
                    <p className="mt-1 text-xs text-muted-foreground">{d.neighborhood}</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              No ballpark-area specials are posted this hour. Browse{" "}
              <Link href="/neighborhoods/bridgeport" className="text-brand-600 hover:underline dark:text-brand-400">
                all Bridgeport deals
              </Link>{" "}
              or{" "}
              <Link href="/deals/game-day" className="text-brand-600 hover:underline dark:text-brand-400">
                every game day deal
              </Link>{" "}
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

        {/* Getting there */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Train className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Getting to Rate Field</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            The Red Line stops at Sox-35th, which drops you at the gates, and the Green Line&apos;s
            35th-Bronzeville-IIT stop is a short walk east. That&apos;s why the smart play is eating
            in Chinatown or Bridgeport first and riding one stop in, instead of paying for a lot off
            35th. Coming from downtown, the South Loop bars along State and Wabash are a straight shot
            down the Red Line.
          </p>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">White Sox game day FAQ</h2>
          </div>
          <div className="mt-4 max-w-3xl space-y-5">
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
            <Link href="/guides/cubs-game-day-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Cubs Game Day</Link>
            <Link href="/guides/bears-game-day-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Bears Game Day</Link>
            <Link href="/neighborhoods/bridgeport" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Bridgeport Deals</Link>
            <Link href="/neighborhoods/chinatown" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Chinatown Deals</Link>
            <Link href="/deals/game-day" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">All Game Day Deals</Link>
            <Link href="/today" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Deals Today</Link>
          </div>
        </section>

        {/* Search handoff + signup */}
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
          <GuideSearchHandoff
            headline="Find your pre-game spot"
            subtitle="Search Bridgeport, Chinatown and South Loop deals by day or deal type."
            cta={{ label: "Search South Side deals", href: "/search?q=bridgeport" }}
            links={[
              { label: "Bridgeport", href: "/neighborhoods/bridgeport" },
              { label: "Chinatown", href: "/neighborhoods/chinatown" },
              { label: "South Loop", href: "/neighborhoods/south-loop" },
              { label: "Deals today", href: "/today" },
            ]}
          />
          <div className="mt-8">
            <EmailSignup
              source="white-sox-guide"
              headline="Get the best South Side specials, every week"
              subtitle="One email every Thursday with the best food and drink deals around the ballpark and beyond. Free, unsubscribe anytime."
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
