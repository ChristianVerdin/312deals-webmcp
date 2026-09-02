import Link from "next/link"
import type { Metadata } from "next"
import { Trophy, MapPin, Tv, Star, Beer, Users, CalendarDays } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo-utils"
import { DEAL_TYPE_LABEL } from "@/lib/guide-utils"
import type { CollegeBarsResponse, CollegeBarVenue } from "@/lib/types"

export const revalidate = 1800

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"
const PAGE_URL = `${SITE_URL}/guides/college-football-chicago`

// ── Season calendar ──────────────────────────────────────────────────────────
//
// HAND-VERIFIED, not fetched. There is no college-football schedule source in
// this repo, and inventing a kickoff on a page people plan a Saturday around is
// worse than having no schedule at all. Every row was checked against the
// source named beside it on 2026-09-02:
//   Thu/Fri/Sat slate ......... ESPN Week 1 2026 schedule
//   Northwestern 7pm CT ....... nusports.com (official; ESPN's list truncates
//                               above 7pm ET, which hid five night games)
//   Notre Dame v Wisconsin .... ESPN team schedule + ndinsider, agreeing on
//                               Sun Sep 6, Lambeau Field, Shamrock Series
//   Big Ten Championship ...... bigten.org / NCAA.com
//
// Times are CENTRAL, converted from the ET the sources publish. When this
// weekend passes, replace OPENING_WEEKEND with the next slate or delete the
// section — a stale schedule is the one thing here that ages badly.
const SCHEDULE_VERIFIED = "September 2, 2026"

type Kick = { time: string; matchup: string; tv: string; teams: string[] }
type GameDay = { date: string; label: string; note?: string; games: Kick[] }

const OPENING_WEEKEND: GameDay[] = [
  {
    date: "Thursday, September 3",
    label: "Thu 9/3",
    note: "The season opens on a school night — Illinois is first of the local programs out.",
    games: [
      { time: "8:00 PM", matchup: "UAB at Illinois", tv: "BTN", teams: ["Illinois Fighting Illini"] },
    ],
  },
  {
    date: "Friday, September 4",
    label: "Fri 9/4",
    note: "Three more before Saturday even starts. A Friday crowd is a different room than a Saturday one.",
    games: [
      { time: "6:00 PM", matchup: "Indiana State at Purdue", tv: "BTN", teams: ["Purdue Boilermakers"] },
      { time: "7:00 PM", matchup: "Toledo at Michigan State", tv: "FS1", teams: ["Michigan State Spartans"] },
      { time: "8:00 PM", matchup: "Miami at Stanford", tv: "ESPN", teams: ["Miami Hurricanes"] },
    ],
  },
  {
    date: "Saturday, September 5",
    label: "Sat 9/5",
    note: "Opening Saturday. Eleven games involving programs with a Chicago bar on this page, from an 11 AM kickoff straight through to a 7 PM one.",
    games: [
      { time: "11:00 AM", matchup: "Ohio at Nebraska", tv: "FS1", teams: ["Nebraska Cornhuskers"] },
      { time: "11:00 AM", matchup: "East Carolina at Alabama", tv: "ABC", teams: ["Alabama Crimson Tide"] },
      { time: "11:30 AM", matchup: "Ball State at Ohio State", tv: "BTN", teams: ["Ohio State Buckeyes"] },
      { time: "12:00 PM", matchup: "Southeast Missouri State at Iowa State", tv: "ESPN+", teams: ["Iowa State Cyclones"] },
      { time: "2:30 PM", matchup: "Texas State at Texas", tv: "ESPN", teams: ["Texas Longhorns"] },
      { time: "2:30 PM", matchup: "Furman at Tennessee", tv: "SECN+", teams: ["Tennessee Volunteers"] },
      { time: "3:15 PM", matchup: "Northern Illinois at Iowa", tv: "BTN", teams: ["Iowa Hawkeyes"] },
      { time: "6:00 PM", matchup: "Missouri State at Texas A&M", tv: "ESPN", teams: ["Texas A&M Aggies"] },
      { time: "6:30 PM", matchup: "Western Michigan at Michigan", tv: "NBC", teams: ["Michigan Wolverines"] },
      { time: "6:45 PM", matchup: "FAU at Florida", tv: "SEC Network", teams: ["Florida Gators"] },
      { time: "7:00 PM", matchup: "South Dakota State at Northwestern", tv: "BTN", teams: ["Northwestern Wildcats"] },
    ],
  },
  {
    date: "Sunday, September 6",
    label: "Sun 9/6",
    note: "The one Chicago actually cares most about is not on Saturday at all: Notre Dame and Wisconsin at Lambeau Field, a Shamrock Series game two and a half hours north. Two of the largest alumni bases in this city, on a Sunday night, before the NFL season starts.",
    games: [
      { time: "6:30 PM", matchup: "Notre Dame vs Wisconsin — Lambeau Field", tv: "NBC", teams: ["Notre Dame Fighting Irish", "Wisconsin Badgers"] },
    ],
  },
]

const SEASON_DATES: { date: string; what: string }[] = [
  { date: "Sat, Sep 12", what: "Notre Dame home vs Rice, 2:30 PM CT on NBC" },
  { date: "Sat, Sep 19", what: "Notre Dame vs Michigan State, 6:30 PM CT on NBC — two rosters on this page, one game" },
  { date: "Sat, Sep 26", what: "Notre Dame at Purdue — the closest road game to Chicago all season" },
  { date: "Sat, Nov 28", what: "Rivalry Saturday. The biggest bar day of the regular season." },
  { date: "Sat, Dec 5", what: "Big Ten Championship, Lucas Oil Stadium, 7:00 PM CT on FOX" },
]

// ── Roster (ncaaf_2026 via the generic tagged endpoint) ──────────────────────

type RosterTopDeal = {
  title: string
  deal_type?: string | null
  days_available?: string[] | null
  start_time?: string | null
  end_time?: string | null
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
  has_deal?: number
  deal_count?: number
  top_deal?: RosterTopDeal | null
}
type RosterGroup = { name: string; slug: string | null; venues: RosterVenue[] }
type RosterResponse = {
  venues: RosterVenue[]
  count: number
  neighborhoods: RosterGroup[]
  neighborhood_count: number
  deal_count: number
}

async function getRoster(): Promise<RosterResponse | null> {
  try {
    // day=saturday is STRICT: the venue must name Saturday. Without it this
    // page printed "Saturday specials" over Mon-Fri happy hours.
    const res = await fetch(`${API_URL}/api/v1/venues/tagged/ncaaf_2026?day=saturday`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return (await res.json()) as RosterResponse
  } catch {
    return null
  }
}

async function getCollegeBars(): Promise<CollegeBarVenue[]> {
  try {
    // sport=football ranks each bar's football deal first. The default order is
    // alphabetical, which is why every card here used to read "(Daily Special)".
    const res = await fetch(`${API_URL}/api/v1/venues/college-bars?include_deals=true&sport=football`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const body = (await res.json()) as CollegeBarsResponse
    return body.venues ?? []
  } catch {
    return []
  }
}

// ── Team grouping ────────────────────────────────────────────────────────────
//
// Only affiliations whose `sport` mentions football. The same venue can carry a
// basketball-only affiliation (a Kansas or Duke bar), and a hoops bar is not a
// football bar — that distinction is the whole point of the sport field.

function isFootball(sport: string): boolean {
  return sport.toLowerCase().includes("football")
}

type TeamGroup = { team: string; venues: CollegeBarVenue[] }

function groupByTeam(venues: CollegeBarVenue[]): TeamGroup[] {
  const byTeam = new Map<string, CollegeBarVenue[]>()
  for (const v of venues) {
    for (const aff of v.sports_affiliations ?? []) {
      if (!isFootball(aff.sport ?? "")) continue
      // Soccer rosters were stored in this column too, with the watch-party
      // description as the "team" name. Those are long sentences, not schools.
      if (aff.team.length > 40) continue
      const list = byTeam.get(aff.team) ?? []
      if (!list.some((x) => x.id === v.id)) list.push(v)
      byTeam.set(aff.team, list)
    }
  }
  return [...byTeam.entries()]
    .map(([team, vs]) => ({ team, venues: vs }))
    .sort((a, b) => b.venues.length - a.venues.length || a.team.localeCompare(b.team))
}

function teamAnchor(team: string): string {
  return `school-${team.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
}

function teamShort(team: string): string {
  return team.replace(/ (Fighting |Golden )?[A-Z][a-z]+$/, "").trim() || team
}

// Two schools Chicago cares about most are barely in the data: Notre Dame has a
// single affiliated venue and Northwestern has none. Rather than quietly omit
// them, the page names the gap and asks — community reports are how the rest of
// this column got filled in.
const UNDER_COVERED = ["Notre Dame Fighting Irish", "Northwestern Wildcats"]

const HOTEL_CHAIN =
  /hotel|marriott|hyatt|dave & buster|dave and buster|miller's ale house|twin peaks|buffalo wild|city works/i

function topPicks(roster: RosterResponse | null): RosterVenue[] {
  if (!roster) return []
  return roster.venues
    .filter(
      (v) =>
        !HOTEL_CHAIN.test(v.name) &&
        (v.google_review_count ?? 0) >= 150 &&
        // Review volume alone promotes popular restaurants that are not game
        // rooms. Require a real signal: a flagged sports bar or a football deal.
        (v.is_sports_bar === 1 || v.has_deal === 1)
    )
    // A venue with an actual football deal outranks a higher-review venue whose
    // only signal is the sports-bar flag. Without this the section fills with
    // generic happy hours and never mentions football, which is the whole point.
    .sort(
      (a, b) =>
        (b.has_deal ?? 0) - (a.has_deal ?? 0) ||
        (b.google_rating ?? 0) * (b.google_review_count ?? 0) -
          (a.google_rating ?? 0) * (a.google_review_count ?? 0)
    )
    .slice(0, 8)
}

// Extractor commentary that reached deal titles ("(specific deals not found)")
// is public copy and must never render. Pre-existing corpus issue; this guide
// refuses to display it rather than waiting on the cleanup.
const COMMENTARY = /not found|not specified|no specific|unable to|see website/i

// A deal whose title names a month that has already passed. The API deranks
// these, but a venue whose deals are ALL stale still leads with one — the
// Tinley Park Cheesie's has three deals and every one is a May LTO. Ranking
// cannot fix that; only refusing to print it can. The venue still renders,
// just without a line claiming September diners can order May's sandwich.
const MONTHS = ["january", "february", "march", "april", "may", "june",
                "july", "august", "september", "october", "november", "december"]

function namesAStaleMonth(t: string): boolean {
  const now = new Date()
  const keep = new Set([MONTHS[now.getMonth()], MONTHS[(now.getMonth() + 1) % 12]])
  const lower = t.toLowerCase()
  return MONTHS.some((m) => !keep.has(m) && new RegExp(`\\b${m}\\b`).test(lower))
}

function dealTitle(t: string | null | undefined): string | null {
  if (!t || COMMENTARY.test(t)) return null
  if (namesAStaleMonth(t)) return null
  return t
}

function dealLine(d: RosterTopDeal | null | undefined): string {
  if (!d) return ""
  const days = Array.isArray(d.days_available) ? d.days_available.join(", ") : ""
  const time = d.start_time && d.end_time ? `${d.start_time}–${d.end_time}` : ""
  return [days, time].filter(Boolean).join(" · ")
}

// Built from the data at render time, not hardcoded. The previous version
// named "Ohio State, Iowa, Michigan, Wisconsin, Illinois and Purdue" as the
// best-covered programs; after the Sep 2 alumni backfill that was simply
// false, and a wrong answer inside FAQPage schema is worse than no schema.
function buildFaq(teams: TeamGroup[], satVenues: number, satHoods: number) {
  const top = teams.slice(0, 3).map((t) => teamShort(t.team))
  const topSentence =
    top.length === 3
      ? `${top[0]}, ${top[1]} and ${top[2]} have the most affiliated bars in our data right now.`
      : "Affiliations are listed by school below."
  return [
    {
      q: "Where can I watch college football in Chicago?",
      a: `Chicago has alumni bars for most Big Ten and SEC programs, plus ${satVenues} sports bars across ${satHoods} neighborhoods carrying a food or drink special on Saturdays. This guide lists both: bars tied to a specific school, and the Saturday specials running while the games are on, city and suburbs.`,
    },
    {
      q: "What games are on opening weekend 2026?",
      a: "Opening weekend runs Thursday September 3 through Sunday September 6, 2026. Illinois plays UAB on Thursday, Purdue and Michigan State play Friday, eleven games involving Chicago-relevant programs run through Saturday September 5 from an 11 AM kickoff to a 7 PM one, and Notre Dame plays Wisconsin at Lambeau Field on Sunday September 6 at 6:30 PM Central.",
    },
    {
      q: "Which Chicago bars are alumni bars for a specific school?",
      a: `${teams.length} programs have at least one Chicago bar on this page. ${topSentence} Affiliations come from alumni chapters, venue websites and community reports, so the list grows during the season.`,
    },
    {
      q: "Do these bars have food and drink specials during games?",
      a: "Many do. Some run explicit college football specials on Saturdays; many more run a standard Saturday happy hour or daily special that applies while the games are on. Every venue listed here has a deal that names Saturday, and each links to its full live deal list.",
    },
    {
      q: "Is this guide only for the city, or the suburbs too?",
      a: "Both. The roster spans Chicago neighborhoods and suburban Cook, DuPage, Lake and Will County towns, which is where a lot of Big Ten alumni actually live.",
    },
  ]
}

export const metadata: Metadata = {
  title: "College Football Bars Chicago, Where to Watch by School + Saturday Specials",
  description:
    "Where to watch college football in Chicago and the suburbs: alumni bars by school for Northwestern, Notre Dame, Iowa, Ohio State, Michigan, Wisconsin, Illinois and Purdue, plus every kickoff time and sports bars with live Saturday food and drink specials. Updated through the season.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "College Football Bars Chicago, Where to Watch by School",
    description:
      "Alumni bars by school plus sports bars with live Saturday specials, across Chicago and the suburbs.",
    url: PAGE_URL,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=College+Football+in+Chicago&subtitle=Alumni+bars+by+school+%2B+Saturday+specials&emoji=%F0%9F%8F%88&badges=Big+Ten+bars%2CSaturday+specials%2CCity+%2B+suburbs`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "College Football Bars Chicago | 312Deals",
    description: "Alumni bars by school plus Saturday specials, city and suburbs.",
  },
}

export default async function Page() {
  const [roster, collegeBars] = await Promise.all([getRoster(), getCollegeBars()])

  const teams = groupByTeam(collegeBars)
  const picks = topPicks(roster)
  const hoods = (roster?.neighborhoods ?? []).filter((h) => h.venues.length > 0).slice(0, 24)
  const venueCount = roster?.count ?? 0
  const hoodCount = roster?.neighborhood_count ?? 0
  const barCount = new Map(teams.map((t) => [t.team, t.venues.length]))
  const coveredTeams = new Set(teams.map((t) => t.team))
  const missing = UNDER_COVERED.filter((t) => !coveredTeams.has(t) || (teams.find((x) => x.team === t)?.venues.length ?? 0) < 2)

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Guides", url: `${SITE_URL}/guides` },
    { name: "College Football Bars", url: PAGE_URL },
  ])
  const FAQ = buildFaq(teams, venueCount, hoodCount)
  const faqLd = buildFaqJsonLd(FAQ)

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        {/* Hero */}
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-500">
            <Trophy className="h-4 w-4" />
            Chicago Guide
          </div>
          <h1 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
            Where to Watch College Football in Chicago
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Saturdays in Chicago belong to whichever school you left behind. This guide covers
            both halves of that: the bars tied to a specific program, and the{" "}
            <strong className="text-foreground">{venueCount} sports bars across {hoodCount} neighborhoods</strong>{" "}
            carrying live Saturday food and drink specials while the games are on. City and
            suburbs, weighted the same.
          </p>
        </header>

        {/* Opening weekend — the reason someone opens this page on a Wednesday */}
        <section className="mb-10">
          <div className="mb-2 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            <h2 className="text-2xl font-bold text-foreground">Opening weekend, kickoff by kickoff</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            All times Central. Tap a school to jump to the bars where that crowd watches.
          </p>
          <div className="space-y-4">
            {OPENING_WEEKEND.map((d) => (
              <div key={d.date} className="rounded-xl border border-border bg-card p-4">
                <h3 className="font-bold text-foreground">{d.date}</h3>
                {d.note && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.note}</p>
                )}
                <ul className="mt-3 space-y-2">
                  {d.games.map((g) => (
                    <li
                      key={`${d.label}-${g.matchup}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-sm"
                    >
                      <span className="w-20 shrink-0 font-mono text-xs text-amber-600 dark:text-amber-500">
                        {g.time}
                      </span>
                      <span className="font-medium text-foreground">{g.matchup}</span>
                      <span className="text-xs text-muted-foreground">{g.tv}</span>
                      <span className="ml-auto flex flex-wrap gap-1">
                        {g.teams.map((t) => {
                          const n = barCount.get(t) ?? 0
                          if (n === 0) return null
                          return (
                            <a
                              key={t}
                              href={`#${teamAnchor(t)}`}
                              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-500"
                            >
                              {teamShort(t)} bars ({n})
                            </a>
                          )
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Schedule verified {SCHEDULE_VERIFIED} against ESPN, Northwestern Athletics, Notre Dame
            Athletics and the Big Ten. Kickoff times move; confirm with the bar before you go.
          </p>
        </section>

        {/* Top picks */}
        {picks.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-bold text-foreground">Top rooms for a Saturday</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Highest-rated by review volume, filtered to actual sports bars and venues with a live
              football deal — not just popular restaurants.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {picks.map((v) => (
                <Link
                  key={v.id}
                  href={`/venues/${v.slug}`}
                  className="rounded-xl border border-border bg-card p-4 transition hover:border-amber-400"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-foreground">{v.name}</div>
                    {v.google_rating != null && (
                      <div className="flex shrink-0 items-center gap-1 text-sm text-amber-600 dark:text-amber-500">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {v.google_rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                  {v.neighborhood && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {v.neighborhood}
                    </div>
                  )}
                  {dealTitle(v.top_deal?.title) && (
                    <div className="mt-2 border-t border-border pt-2 text-sm text-foreground">
                      {dealTitle(v.top_deal?.title)}
                      {dealLine(v.top_deal) && (
                        <span className="block text-xs text-muted-foreground">{dealLine(v.top_deal)}</span>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* By school */}
        {teams.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-2xl font-bold text-foreground">Alumni bars by school</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Affiliations come from alumni chapters, venue websites and reports from people who
              drink there. {teams.length} programs have a Chicago home below.
            </p>
            <div className="space-y-5">
              {teams.map((t) => (
                <div key={t.team} id={teamAnchor(t.team)} className="scroll-mt-20 rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    <h3 className="font-bold text-foreground">{t.team}</h3>
                    <span className="text-xs text-muted-foreground">
                      {t.venues.length} {t.venues.length === 1 ? "bar" : "bars"}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {t.venues.map((v) => (
                      <Link
                        key={v.id}
                        href={`/venues/${v.slug}`}
                        className="rounded-lg border border-border/60 p-3 text-sm transition hover:border-amber-400"
                      >
                        <div className="font-semibold text-foreground">{v.name}</div>
                        <div className="text-xs text-muted-foreground">{v.neighborhood}</div>
                        {dealTitle(v.deals?.[0]?.title) && (
                          <div className="mt-1 text-xs text-foreground">
                            {dealTitle(v.deals[0].title)}
                            {v.deals[0].deal_type && (
                              <span className="ml-1 text-muted-foreground">
                                ({DEAL_TYPE_LABEL[v.deals[0].deal_type] ?? v.deals[0].deal_type})
                              </span>
                            )}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* The honest gap — invites the community reports that fill this column */}
        {missing.length > 0 && (
          <section className="mb-10 rounded-xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
            <h2 className="mb-2 text-lg font-bold text-foreground">Help us fill these in</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Two of the biggest programs in this city are the thinnest in our data:{" "}
              <strong className="text-foreground">{missing.map(teamShort).join(" and ")}</strong>.
              We would rather say that than pretend otherwise. If you know the bar where that
              alumni crowd actually watches, tell us and we will add it.
            </p>
            <Link
              href="/submit"
              className="mt-3 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
              Submit a bar
            </Link>
          </section>
        )}

        <div className="mb-10">
          <EmailSignup source="college-football-guide" variant="banner" />
        </div>

        {/* Saturday specials, by neighborhood */}
        {hoods.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-2xl font-bold text-foreground">Saturday specials by neighborhood</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Sports bars with a live Saturday deal, so you can pick by where you already are.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {hoods.map((h) => (
                <div key={h.name} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    <h3 className="font-bold text-foreground">{h.name}</h3>
                    <span className="text-xs text-muted-foreground">{h.venues.length}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {h.venues.slice(0, 5).map((v) => (
                      <li key={v.id} className="text-sm">
                        <Link href={`/venues/${v.slug}`} className="font-medium text-foreground hover:text-amber-600">
                          {v.name}
                        </Link>
                        {dealTitle(v.top_deal?.title) && (
                          <span className="block text-xs text-muted-foreground">{dealTitle(v.top_deal?.title)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {h.slug && (
                    <Link
                      href={`/neighborhoods/${h.slug}`}
                      className="mt-2 inline-block text-xs font-semibold text-amber-600 hover:underline dark:text-amber-500"
                    >
                      All {h.name} deals →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mb-10">
          <GuideSearchHandoff
            headline="Looking for a specific school or neighborhood?"
            subtitle="Search every live deal in Chicagoland by neighborhood, day and deal type."
            cta={{ label: "Search all deals", href: "/search?q=sports+bar" }}
            links={[
              { label: "Sports bars", href: "/search?q=sports+bar" },
              { label: "Saturday deals", href: "/deals/saturday-deals" },
              { label: "Bears game day", href: "/guides/bears-game-day-chicago" },
            ]}
          />
        </div>

        {/* The rest of the season */}
        <section className="mb-10 rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <h2 className="font-bold text-foreground">Dates worth planning around</h2>
          </div>
          <ul className="space-y-2">
            {SEASON_DATES.map((d) => (
              <li key={d.date} className="flex flex-wrap gap-x-3 border-t border-border/60 pt-2 text-sm first:border-0 first:pt-0">
                <span className="w-24 shrink-0 font-semibold text-amber-600 dark:text-amber-500">{d.date}</span>
                <span className="text-muted-foreground">{d.what}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-bold text-foreground">FAQ</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer font-semibold text-foreground">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Tv className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <h2 className="font-bold text-foreground">How this list is built</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            School affiliations come from alumni chapters, venue websites and community reports.
            Saturday specials are pulled live from our deal database and re-verified continuously,
            so a special that ends stops showing. A venue only appears below if one of its deals
            names Saturday explicitly — an undated deal or a Monday-to-Friday happy hour does not
            count, even though including them would make these lists longer. Kickoff times are
            checked by hand against each school and conference, because we would rather publish no
            schedule than a wrong one. Spot something wrong?{" "}
            <Link href="/submit" className="font-semibold text-amber-600 hover:underline dark:text-amber-500">
              Tell us
            </Link>{" "}
            — that is how most of the school list got here.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Beer className="h-3.5 w-3.5" />
            {venueCount} venues with a Saturday deal · {hoodCount} neighborhoods ·{" "}
            {teams.length} programs · schedule verified {SCHEDULE_VERIFIED}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
