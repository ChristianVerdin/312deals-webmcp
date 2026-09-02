import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Trophy, Calendar, Tv, Star, Clock } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { BookingCTA } from "@/components/booking-cta"
import { AskAILink } from "@/components/ask-ai-link"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import { GUIDE_PHOTOS } from "@/lib/guide-photos"
import { GuideHeroImage } from "@/components/guide-hero-image"
import type { CollegeBarsResponse, CollegeBarVenue, Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

// No tournament filter, show ALL college bars year-round

// Short display names for common teams
const TEAM_SHORT: Record<string, string> = {
  "Alabama Crimson Tide": "Alabama",
  "Arizona Wildcats": "Arizona",
  "Arkansas Razorbacks": "Arkansas",
  "Duke Blue Devils": "Duke",
  "Florida Gators": "Florida",
  "Houston Cougars": "Houston",
  "Illinois Fighting Illini": "Illinois",
  "Indiana Hoosiers": "Indiana",
  "Iowa Hawkeyes": "Iowa",
  "Iowa State Cyclones": "Iowa State",
  "Michigan Wolverines": "Michigan",
  "Michigan State Spartans": "Michigan State",
  "Nebraska Cornhuskers": "Nebraska",
  "Notre Dame Fighting Irish": "Notre Dame",
  "Ohio State Buckeyes": "Ohio State",
  "Penn State Nittany Lions": "Penn State",
  "Purdue Boilermakers": "Purdue",
  "St. John's Red Storm": "St. John's",
  "Tennessee Volunteers": "Tennessee",
  "Texas Longhorns": "Texas",
  "UConn Huskies": "UConn",
  "Wisconsin Badgers": "Wisconsin",
}

// ─── Data fetching ─────────────────────────────────────────

async function getCollegeBars(): Promise<CollegeBarsResponse> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/venues/college-bars?include_deals=true`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return { venues: [], count: 0, teams: [], team_count: 0 }
    return res.json()
  } catch {
    return { venues: [], count: 0, teams: [], team_count: 0 }
  }
}

async function getGameDayDeals(): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?deal_type=game_day&limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

// ─── Helpers ────────────────────────────────────────────────

type TeamGroup = { team: string; sport: string; venues: CollegeBarVenue[] }

function groupByTeam(venues: CollegeBarVenue[]): TeamGroup[] {
  const map = new Map<string, TeamGroup>()
  for (const v of venues) {
    for (const aff of v.sports_affiliations) {
      const existing = map.get(aff.team)
      if (existing) {
        if (!existing.venues.some((ev) => ev.slug === v.slug)) {
          existing.venues.push(v)
        }
      } else {
        map.set(aff.team, { team: aff.team, sport: aff.sport, venues: [v] })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    b.venues.length - a.venues.length || a.team.localeCompare(b.team)
  )
}

type NeighborhoodGroup = { name: string; slug: string; venues: CollegeBarVenue[] }

function groupByNeighborhood(venues: CollegeBarVenue[]): NeighborhoodGroup[] {
  const map = new Map<string, NeighborhoodGroup>()
  for (const v of venues) {
    if (!map.has(v.neighborhood_slug)) {
      map.set(v.neighborhood_slug, { name: v.neighborhood, slug: v.neighborhood_slug, venues: [] })
    }
    const g = map.get(v.neighborhood_slug)!
    if (!g.venues.some((ev) => ev.slug === v.slug)) g.venues.push(v)
  }
  return Array.from(map.values()).sort((a, b) =>
    b.venues.length - a.venues.length || a.name.localeCompare(b.name)
  )
}

function teamSlug(team: string): string {
  return team.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function shortName(team: string): string {
  return TEAM_SHORT[team] ?? team.replace(/ (Wolverines|Buckeyes|Hawkeyes|Badgers|Fighting Illini|Boilermakers|Blue Devils|Jayhawks|Spartans|Cyclones|Wildcats|Cornhuskers|Tar Heels|Wolfpack|Crimson Tide|Razorbacks|Gators|Cardinals|Hurricanes|Volunteers|Longhorns|Aggies|Huskies|Cavaliers|Red Raiders|Cougars|Bulldogs|Bruins|Rams|Mustangs|Bulls|Red Storm|Horned Frogs|Tigers|Golden Eagles|Fighting Irish|Zips|Lancers|Paladins|Rainbow Warriors|Panthers|Pride|Bison|Vandals|Owls|Mountain Hawks|Sharks|Cowboys|RedHawks|Quakers|Royals|Billikens|Gaels|Broncos|Saints|Trojans|Knights|Retrievers|Raiders)$/, "")
}

// ─── Metadata ───────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Best College Bars Chicago, Alumni Bars, Cheap Drinks & Game Day Specials | 312Deals",
  description:
    "The best college bars in Chicago with cheap drinks, game day specials, and alumni watch parties. Find bars for Illinois, Michigan, Purdue, Ohio State, Notre Dame, Wisconsin & 40+ teams across 14+ neighborhoods.",
  openGraph: {
    title: "Best College Bars Chicago, Alumni Bars, Cheap Drinks & Game Day Specials | 312Deals",
    description:
      "The best college bars in Chicago with cheap drinks, game day specials, and alumni watch parties. Find bars for Illinois, Michigan, Purdue, Ohio State & more across 14+ neighborhoods.",
    url: `${SITE_URL}/guides/college-bars-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=College+Bars+in+Chicago&subtitle=Find+Your+Team%27s+Alumni+Bar`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Best College Bars Chicago, Alumni Bars, Cheap Drinks & Game Day Specials | 312Deals",
    description:
      "The best college bars in Chicago with cheap drinks, game day specials, and alumni watch parties for 40+ teams across 14+ neighborhoods.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/college-bars-chicago`,
  },
}

// ─── Page ───────────────────────────────────────────────────

export default async function CollegeBarsGuide() {
  const [collegeBars, gameDayDeals] = await Promise.all([
    getCollegeBars(),
    getGameDayDeals(),
  ])

  // Show ALL college bars, no tournament filter
  const venues = collegeBars.venues
  const teamGroups = groupByTeam(venues)
  const neighborhoodGroups = groupByNeighborhood(venues)
  const uniqueNeighborhoods = neighborhoodGroups.length
  const teamCount = teamGroups.length

  // Separate teams by bar count for layout
  const multiBarTeams = teamGroups.filter((g) => g.venues.length >= 2)
  const singleBarTeams = teamGroups.filter((g) => g.venues.length === 1)

  const faqItems = [
    {
      q: "Where can I watch college games in Chicago?",
      a: `Chicago has ${venues.length}+ college alumni bars across ${uniqueNeighborhoods} neighborhoods. ${multiBarTeams.slice(0, 4).map((g) => `${shortName(g.team)} has ${g.venues.length} bars (${g.venues.slice(0, 2).map((v) => v.name).join(", ")}${g.venues.length > 2 ? " + more" : ""})`).join(". ")}. Most have big screens, game day drink specials, and die-hard fan crowds.`,
    },
    {
      q: "What are the best game day deals at college bars in Chicago?",
      a: `We track ${gameDayDeals.length}+ game day deals across Chicago, bucket specials, wing deals, drink discounts, and early openings on game days. Most college bars run specials whenever their team plays.`,
    },
    {
      q: "Which college teams have alumni bars in Chicago?",
      a: `${teamCount} teams have dedicated bars: ${teamGroups.slice(0, 10).map((t) => shortName(t.team)).join(", ")}, and more. Lakeview alone has ${neighborhoodGroups.find((n) => n.slug === "lakeview")?.venues.length ?? 15}+ college bars, it's the alumni bar capital of Chicago.`,
    },
    {
      q: "Do I need a reservation at a college bar?",
      a: "Most alumni bars are first-come, first-served. For big-draw teams (Ohio State, Michigan, Wisconsin, Notre Dame), arrive 30-60 minutes before kick-off or tip-off on rivalry weekends and during March Madness.",
    },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <article className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
          {/* JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: SITE_URL },
                  { name: "Guides", url: `${SITE_URL}/guides` },
                  { name: "College Bars Chicago", url: `${SITE_URL}/guides/college-bars-chicago` },
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
              __html: JSON.stringify(
                buildItemListJsonLd(
                  "College Bars Chicago, College Bars & Deals 2026",
                  `${SITE_URL}/guides/college-bars-chicago`,
                  gameDayDeals
                )
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "College Bars in Chicago, Find Your Team's Alumni Bar",
                description: `${venues.length}+ college alumni bars and ${gameDayDeals.length}+ game day deals across ${uniqueNeighborhoods} Chicago neighborhoods.`,
                url: `${SITE_URL}/guides/college-bars-chicago`,
                mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/guides/college-bars-chicago` },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: { "@type": "Organization", name: "312Deals", url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` } },
                image: `${SITE_URL}/api/og?title=March+Madness+Chicago+2026&subtitle=68+Teams+%7C+50%2B+Bars+%7C+60%2B+Deals`,
                datePublished: "2026-04-07",
                dateModified: new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-8">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
              <span>/</span>
              <Link href="/guides" className="transition-colors hover:text-foreground">Guides</Link>
              <span>/</span>
              <span className="text-foreground">College Bars Chicago</span>
            </nav>
            <GuideHeroImage photo={GUIDE_PHOTOS["college-bars-chicago"]} priority />
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              College Bars in Chicago, Find Your Team&apos;s Alumni Bar
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              {venues.length} college alumni bars for {teamCount} teams across {uniqueNeighborhoods} Chicago neighborhoods.
              Whether it&apos;s football Saturday, March Madness, or a random Tuesday night game, find where your people watch.
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-8 grid grid-cols-4 gap-3">
            {[
              { icon: Trophy, value: teamCount, label: "Teams" },
              { icon: Tv, value: venues.length, label: "Bars" },
              { icon: MapPin, value: uniqueNeighborhoods, label: "Hoods" },
              { icon: Calendar, value: gameDayDeals.length, label: "Deals" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-3 text-center">
                <Icon className="mx-auto mb-1 h-5 w-5 text-brand-600" />
                <div className="text-xl font-bold text-foreground">{value}</div>
                <div className="text-[11px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {/* Game Day Deals */}
          {gameDayDeals.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-3 text-xl font-bold text-foreground">
                Game Day Deals
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {gameDayDeals.length} specials across Chicago
                </span>
              </h2>
              <div className="overflow-hidden rounded-xl border border-border">
                {gameDayDeals.slice(0, 25).map((deal, di) => (
                  <div
                    key={deal.id}
                    className={`flex items-baseline gap-2 px-4 py-2 ${
                      di < Math.min(gameDayDeals.length, 25) - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <Link
                      href={`/venues/${deal.venue_slug}`}
                      className="shrink-0 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {deal.venue_name}
                    </Link>
                    <span className="truncate text-sm text-foreground">{deal.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                      {deal.neighborhood}
                    </span>
                  </div>
                ))}
                {gameDayDeals.length > 25 && (
                  <Link
                    href="/search?q=march+madness"
                    className="block border-t border-border bg-card px-4 py-2 text-center text-xs text-brand-600 hover:underline dark:text-brand-400"
                  >
                    View all {gameDayDeals.length} tournament deals
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* Browse by Team */}
          <section className="mb-10">
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              Find Your Team&apos;s Bar
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Not just bars with TVs, these are where alumni communities gather. Fight songs, team gear, and people who care about the outcome.
            </p>

            {/* Team jump links */}
            <div className="mb-6 flex flex-wrap gap-1.5">
              {teamGroups.map((g) => (
                <a
                  key={g.team}
                  href={`#${teamSlug(g.team)}`}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                >
                  {shortName(g.team)}{" "}
                  <span className="font-semibold text-foreground">{g.venues.length}</span>
                </a>
              ))}
            </div>

            {/* Multi-bar teams, expanded */}
            <div className="space-y-6">
              {multiBarTeams.map((group) => (
                <div key={group.team} id={teamSlug(group.team)}>
                  <h3 className="mb-2 flex items-baseline gap-2 text-lg font-semibold text-foreground">
                    {group.team}
                    <span className="text-sm font-normal text-muted-foreground">
                      {group.venues.length} bars
                    </span>
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.venues.map((venue) => (
                      <Link
                        key={venue.slug}
                        href={`/venues/${venue.slug}`}
                        className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-brand-300"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-brand-600 dark:text-brand-400">
                            {venue.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {venue.neighborhood}
                            {venue.address && ` · ${venue.address.split(",")[0]}`}
                          </div>
                          {venue.deals.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {venue.deals.length} active deal{venue.deals.length !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                        {venue.google_rating && (
                          <div className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                            <Star className="h-3 w-3 fill-brand-500 text-brand-500" />
                            {venue.google_rating}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Single-bar teams, condensed grid */}
            {singleBarTeams.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-3 text-lg font-semibold text-foreground">
                  More Tournament Teams
                </h3>
                <div className="overflow-hidden rounded-xl border border-border">
                  {singleBarTeams.map((group, gi) => {
                    const v = group.venues[0]
                    return (
                      <div
                        key={group.team}
                        id={teamSlug(group.team)}
                        className={`flex items-center justify-between px-4 py-2.5 ${
                          gi < singleBarTeams.length - 1 ? "border-b border-border" : ""
                        }`}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {shortName(group.team)}
                          </span>
                          <Link
                            href={`/venues/${v.slug}`}
                            className="text-sm text-brand-600 hover:underline dark:text-brand-400"
                          >
                            {v.name}
                          </Link>
                        </div>
                        <span className="text-xs text-muted-foreground">{v.neighborhood}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Browse by Neighborhood, condensed */}
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-bold text-foreground">
              By Neighborhood
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {neighborhoodGroups.map((nh) => (
                <div key={nh.slug} className="rounded-lg border border-border p-3">
                  <Link
                    href={`/neighborhoods/${nh.slug}`}
                    className="text-sm font-semibold text-foreground hover:text-brand-600"
                  >
                    {nh.name}
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({nh.venues.length})
                    </span>
                  </Link>
                  <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {nh.venues.map((v) => (
                      <Link
                        key={v.slug}
                        href={`/venues/${v.slug}`}
                        className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {v.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tips, condensed */}
          <section className="mb-10 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-lg font-bold text-foreground">
              Tips for March Madness in Chicago
            </h2>
            <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="flex gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <div><strong className="text-foreground">Arrive early.</strong> Alumni bars pack out for noon tip-offs. Be there by 11 AM on Thursday/Friday.</div>
              </div>
              <div className="flex gap-2">
                <Tv className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <div><strong className="text-foreground">Sound on.</strong> These bars play your team&apos;s game with sound, not a screen in the corner.</div>
              </div>
              <div className="flex gap-2">
                <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <div><strong className="text-foreground">Fill out a bracket.</strong> Hawkeye&apos;s, Fatpour, and Twin Peaks all run bracket pools with prizes.</div>
              </div>
              <div className="flex gap-2">
                <Star className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <div><strong className="text-foreground">Check the deals.</strong> Bucket specials, wing deals, shot wheels, <Link href="/search?q=march+madness" className="text-brand-600 hover:underline dark:text-brand-400">search tournament deals</Link>.</div>
              </div>
            </div>
          </section>

          {/* Search CTA */}
          <div className="mb-10 flex flex-wrap gap-3">
            <Link
              href="/search?q=march+madness"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Search March Madness Deals
            </Link>
            <Link
              href="/search?deal_type=game_day"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              All Game Day Deals
            </Link>
            <AskAILink
              page="/guides/college-bars-chicago"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Ask AI About Deals
            </AskAILink>
          </div>

          <BookingCTA
            campaign="college_bars_guide"
            headline="Visiting for a game day?"
            subhead="Find hotels close to where your team's fans gather. Free cancellation on most rooms."
          />

          {/* FAQ */}
          <section className="mb-10 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-lg font-bold text-foreground">FAQ</h2>
            <dl className="space-y-3">
              {faqItems.map((item, i) => (
                <div key={i}>
                  <dt className="text-sm font-semibold text-foreground">{item.q}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Email Signup */}
          <EmailSignup source="march-madness-guide" />

          {/* About */}
          <section className="mt-6 mb-6">
            <p className="text-xs leading-relaxed text-muted-foreground">
              College team affiliations sourced from alumni chapters, venue websites, and community knowledge.
              Missing a bar?{" "}
              <Link href="/submit" className="text-brand-600 hover:underline dark:text-brand-400">
                Submit it
              </Link>. Updated{" "}
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
