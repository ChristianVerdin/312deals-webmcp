import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Trophy, Calendar, Tv, Star, Clock } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { BookingCTA } from "@/components/booking-cta"
import { AskAILink } from "@/components/ask-ai-link"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { CollegeBarsResponse, CollegeBarVenue, Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

// ─── 2026 NCAA Tournament Field ────────────────────────────
// Only show teams actually in the tournament

const TOURNAMENT_TEAMS = new Set([
  // Sweet 16, 16 teams remaining (updated Mar 24)
  // South Regional
  "Houston Cougars", "Illinois Fighting Illini", "Nebraska Cornhuskers", "Iowa Hawkeyes",
  // West Regional
  "Arizona Wildcats", "Purdue Boilermakers", "Arkansas Razorbacks", "Texas Longhorns",
  // Midwest Regional (at United Center, Chicago)
  "Michigan Wolverines", "Iowa State Cyclones", "Alabama Crimson Tide", "Tennessee Volunteers",
  // East Regional
  "Duke Blue Devils", "UConn Huskies", "Michigan State Spartans", "St. John's Red Storm",
])

// Short display names for team pills
const TEAM_SHORT: Record<string, string> = {
  // Sweet 16 teams only (updated Mar 24)
  "Alabama Crimson Tide": "Alabama",
  "Arizona Wildcats": "Arizona",
  "Arkansas Razorbacks": "Arkansas",
  "Duke Blue Devils": "Duke",
  "Houston Cougars": "Houston",
  "Illinois Fighting Illini": "Illinois",
  "Iowa Hawkeyes": "Iowa",
  "Iowa State Cyclones": "Iowa State",
  "Michigan Wolverines": "Michigan",
  "Michigan State Spartans": "Michigan State",
  "Nebraska Cornhuskers": "Nebraska",
  "Purdue Boilermakers": "Purdue",
  "St. John's Red Storm": "St. John's",
  "Tennessee Volunteers": "Tennessee",
  "Texas Longhorns": "Texas",
  "UConn Huskies": "UConn",
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

async function getMarchMadnessDeals(): Promise<Deal[]> {
  const queries = ["march madness", "NCAA", "bracket", "madness", "tournament", "college basketball"]
  const allDeals = new Map<number, Deal>()

  await Promise.all(
    queries.map(async (q) => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/deals/search?q=${encodeURIComponent(q)}&limit=200`,
          { next: { revalidate: 3600 } }
        )
        if (!res.ok) return
        const data: SearchResponse = await res.json()
        for (const deal of data.deals ?? []) {
          if (!allDeals.has(deal.id)) allDeals.set(deal.id, deal)
        }
      } catch { /* skip */ }
    })
  )

  // Also fetch game_day deals, many bars run tournament specials under this type
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?deal_type=game_day&limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (res.ok) {
      const data: SearchResponse = await res.json()
      for (const deal of data.deals ?? []) {
        const text = `${deal.title} ${deal.description ?? ""}`.toLowerCase()
        // Only include game_day deals that reference basketball/tournament/madness
        if (/madness|ncaa|bracket|tournament|basketball|march/.test(text)) {
          if (!allDeals.has(deal.id)) allDeals.set(deal.id, deal)
        }
      }
    }
  } catch { /* skip */ }

  // Filter to actual March Madness deals, catch creative names like
  // "Marg Madness", "Meat Madness", "Bitter Madness", "Madness in March"
  return Array.from(allDeals.values()).filter((d) => {
    const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
    return /march\s*madness|madness\s+in\s+march|ncaa|bracket|munch\s*madness|marg\s*madness|meat\s*madness|bitter\s*madness|\w+\s*madness.*(?:beer|drink|food|wing|special|platter|menu|tournament|basketball)|tournament\s+(?:deal|special|game|viewing)/.test(text)
  })
}

// ─── Helpers ────────────────────────────────────────────────

function filterTournamentOnly(venues: CollegeBarVenue[]): CollegeBarVenue[] {
  return venues
    .map((v) => ({
      ...v,
      sports_affiliations: v.sports_affiliations.filter(
        (a) => TOURNAMENT_TEAMS.has(a.team)
      ),
    }))
    .filter((v) => v.sports_affiliations.length > 0)
}

type TeamGroup = { team: string; sport: string; venues: CollegeBarVenue[] }

function groupByTeam(venues: CollegeBarVenue[]): TeamGroup[] {
  const map = new Map<string, TeamGroup>()
  for (const v of venues) {
    for (const aff of v.sports_affiliations) {
      if (!TOURNAMENT_TEAMS.has(aff.team)) continue
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
  title:
    "March Madness & Sweet 16 Chicago 2026, College Bars by Team | 312Deals",
  description:
    "Sweet 16 watch parties in Chicago 2026. Find your team's alumni bar, Michigan, Illinois, Purdue, Iowa, Duke, UConn & more across 14+ neighborhoods. United Center hosts the Midwest Regional. 100+ game day deals.",
  openGraph: {
    title: "Where to Watch March Madness in Chicago 2026 | 312Deals",
    description:
      "Sweet 16 watch parties in Chicago 2026. Alumni bars for Michigan, Illinois, Purdue, Iowa, Duke & more. United Center hosts the Midwest Regional. 100+ game day deals.",
    url: `${SITE_URL}/guides/march-madness-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=March+Madness+Chicago+2026&subtitle=68+Teams+%7C+50%2B+Bars+%7C+60%2B+Deals`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Where to Watch March Madness in Chicago 2026 | 312Deals",
    description:
      "Sweet 16 watch parties in Chicago. Alumni bars for all 16 remaining teams. United Center hosts the Midwest Regional. 100+ game day deals.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/march-madness-chicago`,
  },
}

// ─── Page ───────────────────────────────────────────────────

export default async function MarchMadnessGuide() {
  const [collegeBars, marchDeals] = await Promise.all([
    getCollegeBars(),
    getMarchMadnessDeals(),
  ])

  // Filter to tournament teams only
  const venues = filterTournamentOnly(collegeBars.venues)
  const teamGroups = groupByTeam(venues)
  const neighborhoodGroups = groupByNeighborhood(venues)
  const uniqueNeighborhoods = neighborhoodGroups.length
  const teamCount = teamGroups.length

  // Separate teams by bar count for layout
  const multiBarTeams = teamGroups.filter((g) => g.venues.length >= 2)
  const singleBarTeams = teamGroups.filter((g) => g.venues.length === 1)

  const faqItems = [
    {
      q: "Where can I watch March Madness in Chicago?",
      a: `Chicago has ${venues.length}+ college alumni bars across ${uniqueNeighborhoods} neighborhoods. ${multiBarTeams.slice(0, 4).map((g) => `${shortName(g.team)} has ${g.venues.length} bars (${g.venues.slice(0, 2).map((v) => v.name).join(", ")}${g.venues.length > 2 ? " + more" : ""})`).join(". ")}. Most open early for noon tip-offs with drink specials all tournament.`,
    },
    {
      q: "What are the best March Madness deals in Chicago 2026?",
      a: `We found ${marchDeals.length}+ March Madness deals including bracket challenges, bucket specials, food combos, and early openings. Fatpour Tap Works runs a full Munch Madness menu. Hawkeye's has bracket contests with prizes. Mac's American Food opens at 11 AM for early tip-offs.`,
    },
    {
      q: "Which tournament teams have alumni bars in Chicago?",
      a: `${teamCount} of the 16 Sweet 16 teams have dedicated Chicago bars: ${teamGroups.slice(0, 10).map((t) => shortName(t.team)).join(", ")}, and more. Lakeview alone has ${neighborhoodGroups.find((n) => n.slug === "lakeview")?.venues.length ?? 15}+ college bars.`,
    },
    {
      q: "When is March Madness 2026?",
      a: "First Four: March 18-19. First Round: March 20-21. Second Round: March 22-23. Sweet 16: March 26-27. Elite 8: March 29-30. Final Four: April 4. Championship: April 6. The Midwest Regional (Sweet 16 and Elite Eight) is at United Center in Chicago on March 27 and 29.",
    },
    {
      q: "Where can I watch the Sweet 16 in Chicago?",
      a: `The Midwest Regional plays at United Center on Friday March 27 (Alabama vs Michigan at 6:35 PM, Tennessee vs Iowa State at 9:10 PM) and the Elite Eight on Sunday March 29. Thursday March 26 features Illinois vs Houston at 9:05 PM on TBS, the biggest local draw. Six Big Ten teams are in the Sweet 16, the most ever by any conference. Thursday is also Cubs Opening Day, so plan for a packed city.`,
    },
    {
      q: "Do I need a reservation for March Madness?",
      a: "Most alumni bars are first-come, first-served. For big-draw teams (Ohio State, Michigan, Wisconsin), arrive 30-60 minutes before tip-off. The first Thursday and Friday of the tournament are the busiest, 16 games each day starting at noon.",
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
                  { name: "March Madness Chicago", url: `${SITE_URL}/guides/march-madness-chicago` },
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
                  "March Madness Chicago, College Bars & Deals 2026",
                  `${SITE_URL}/guides/march-madness-chicago`,
                  marchDeals
                )
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Event",
                name: "NCAA March Madness 2026",
                description: `Watch the NCAA tournament at ${venues.length}+ college alumni bars across Chicago.`,
                startDate: "2026-03-18",
                endDate: "2026-04-06",
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                eventStatus: "https://schema.org/EventScheduled",
                location: { "@type": "City", name: "Chicago", address: { "@type": "PostalAddress", addressLocality: "Chicago", addressRegion: "IL", addressCountry: "US" } },
                organizer: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                url: `${SITE_URL}/guides/march-madness-chicago`,
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "Where to Watch March Madness in Chicago 2026, College Alumni Bars by Team",
                description: `${venues.length}+ college alumni bars and ${marchDeals.length}+ game day deals across ${uniqueNeighborhoods} Chicago neighborhoods.`,
                url: `${SITE_URL}/guides/march-madness-chicago`,
                mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/guides/march-madness-chicago` },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: { "@type": "Organization", name: "312Deals", url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` } },
                image: `${SITE_URL}/api/og?title=March+Madness+Chicago+2026&subtitle=68+Teams+%7C+50%2B+Bars+%7C+60%2B+Deals`,
                datePublished: "2026-03-17",
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
              <span className="text-foreground">March Madness Chicago</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Where to Watch March Madness in Chicago 2026
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              The Sweet 16 is here, and the Midwest Regional is at United Center. {venues.length} alumni bars
              for {teamCount} teams across {uniqueNeighborhoods} neighborhoods. Six Big Ten teams still dancing.
              Grab a seat before tip-off, find the deals, watch with people who care.
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-8 grid grid-cols-4 gap-3">
            {[
              { icon: Trophy, value: teamCount, label: "Teams" },
              { icon: Tv, value: venues.length, label: "Bars" },
              { icon: MapPin, value: uniqueNeighborhoods, label: "Hoods" },
              { icon: Calendar, value: "Sweet 16", label: "This Week" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-3 text-center">
                <Icon className="mx-auto mb-1 h-5 w-5 text-brand-600" />
                <div className="text-xl font-bold text-foreground">{value}</div>
                <div className="text-[11px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {/* Tournament Schedule, compact */}
          <section className="mb-8 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 dark:border-brand-900 dark:bg-brand-950/30">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="font-bold text-foreground">2026 Schedule</span>
              <span><strong>R1:</strong> Mar 20-21</span>
              <span><strong>R2:</strong> Mar 22-23</span>
              <span><strong>Sweet 16:</strong> Mar 26-27</span>
              <span><strong>Elite 8:</strong> Mar 29-30</span>
              <span><strong>Final Four:</strong> Apr 4</span>
              <span><strong>Title:</strong> Apr 6</span>
            </div>
          </section>

          {/* Sweet 16 in Chicago */}
          <section className="mb-10 rounded-xl border-2 border-brand-500 bg-brand-50 p-5 dark:border-brand-400 dark:bg-brand-950/40">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <h2 className="text-xl font-bold text-foreground">Sweet 16 in Chicago</h2>
            </div>
            <p className="mb-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
              The games are IN Chicago this weekend.
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              The Midwest Regional plays at United Center on Friday and Sunday. Six Big Ten teams made the Sweet 16, the most
              ever by any conference. And Thursday is a double event:{" "}
              <Link href="/guides/cubs-opening-day-chicago" className="text-brand-600 hover:underline dark:text-brand-400">
                Cubs Opening Day
              </Link>{" "}
              at 1:20 PM, then Sweet 16 games starting at 6:10 PM.
            </p>

            {/* Thursday */}
            <h3 className="mb-2 text-sm font-bold text-foreground">
              Thursday, March 26, South &amp; West Regionals
            </h3>
            <div className="mb-4 overflow-hidden rounded-lg border border-border text-sm">
              <div className="flex items-baseline gap-2 border-b border-border px-3 py-2">
                <span className="w-16 shrink-0 font-medium text-foreground">6:10 PM</span>
                <span className="flex-1 text-muted-foreground">
                  (11) Texas vs (2) Purdue, CBS, Purdue bars:{" "}
                  <Link href="/venues/avenue-tap-kitchen" className="text-brand-600 hover:underline dark:text-brand-400">Avenue Tap &amp; Kitchen</Link>,{" "}
                  <Link href="/venues/country-club" className="text-brand-600 hover:underline dark:text-brand-400">Country Club</Link>
                </span>
              </div>
              <div className="flex items-baseline gap-2 border-b border-border px-3 py-2">
                <span className="w-16 shrink-0 font-medium text-foreground">6:30 PM</span>
                <span className="flex-1 text-muted-foreground">(4) Nebraska vs (9) Iowa, TBS, Big Ten rivalry</span>
              </div>
              <div className="flex items-baseline gap-2 border-b border-border px-3 py-2">
                <span className="w-16 shrink-0 font-medium text-foreground">8:45 PM</span>
                <span className="flex-1 text-muted-foreground">(1) Arizona vs (4) Arkansas, CBS</span>
              </div>
              <div className="flex items-baseline gap-2 bg-brand-100/50 px-3 py-2 dark:bg-brand-900/30">
                <span className="w-16 shrink-0 font-medium text-foreground">9:05 PM</span>
                <span className="flex-1 font-medium text-foreground">
                  (2) Houston vs (3) Illinois, TBS, Biggest local draw
                </span>
              </div>
            </div>

            {/* Friday */}
            <h3 className="mb-2 text-sm font-bold text-foreground">
              Friday, March 27, East &amp; Midwest Regionals
            </h3>
            <div className="mb-4 overflow-hidden rounded-lg border border-border text-sm">
              <div className="flex items-baseline gap-2 border-b border-border px-3 py-2">
                <span className="w-16 shrink-0 font-medium text-foreground">6:10 PM</span>
                <span className="flex-1 text-muted-foreground">(1) Duke vs (5) St. John&apos;s, CBS, East Regional</span>
              </div>
              <div className="flex items-baseline gap-2 border-b border-border bg-brand-100/50 px-3 py-2 dark:bg-brand-900/30">
                <span className="w-16 shrink-0 font-medium text-foreground">6:35 PM</span>
                <span className="flex-1 font-medium text-foreground">
                  (1) Michigan vs (4) Alabama, TBS, Midwest at United Center, {" "}
                  <Link href="/venues/sullys-house" className="text-brand-600 hover:underline dark:text-brand-400">Sully&apos;s House</Link> = Michigan HQ
                </span>
              </div>
              <div className="flex items-baseline gap-2 border-b border-border px-3 py-2">
                <span className="w-16 shrink-0 font-medium text-foreground">8:45 PM</span>
                <span className="flex-1 text-muted-foreground">(2) UConn vs (3) Michigan State, CBS, East Regional</span>
              </div>
              <div className="flex items-baseline gap-2 bg-brand-100/50 px-3 py-2 dark:bg-brand-900/30">
                <span className="w-16 shrink-0 font-medium text-foreground">9:10 PM</span>
                <span className="flex-1 font-medium text-foreground">(2) Iowa State vs (6) Tennessee, TBS, Midwest at United Center</span>
              </div>
            </div>

            {/* Sunday */}
            <h3 className="mb-2 text-sm font-bold text-foreground">
              Sunday, March 29, Elite Eight at United Center
            </h3>
            <div className="overflow-hidden rounded-lg border border-border text-sm">
              <div className="flex items-baseline gap-2 px-3 py-2">
                <span className="w-16 shrink-0 font-medium text-foreground">~1:15 PM</span>
                <span className="flex-1 text-muted-foreground">Midwest Regional Final, CBS</span>
              </div>
            </div>
          </section>

          {/* March Madness Deals, moved up for immediacy */}
          {marchDeals.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-3 text-xl font-bold text-foreground">
                Tournament Deals
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {marchDeals.length} specials
                </span>
              </h2>
              <div className="overflow-hidden rounded-xl border border-border">
                {marchDeals.slice(0, 25).map((deal, di) => (
                  <div
                    key={deal.id}
                    className={`flex items-baseline gap-2 px-4 py-2 ${
                      di < Math.min(marchDeals.length, 25) - 1 ? "border-b border-border" : ""
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
                {marchDeals.length > 25 && (
                  <Link
                    href="/search?q=march+madness"
                    className="block border-t border-border bg-card px-4 py-2 text-center text-xs text-brand-600 hover:underline dark:text-brand-400"
                  >
                    View all {marchDeals.length} tournament deals
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
              page="/guides/march-madness-chicago"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Ask AI About Deals
            </AskAILink>
          </div>

          <BookingCTA
            campaign="march_madness_guide"
            headline="Driving in for the tournament?"
            subhead="Find hotels close to the bracket-watching action. Free cancellation on most rooms."
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
