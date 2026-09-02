import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Calendar, Ghost, PartyPopper, Moon, Route } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo-utils"
import { uniqueByVenue, groupByNeighborhood, isLocalVenue, DEAL_TYPE_LABEL } from "@/lib/guide-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"
const PAGE_URL = `${SITE_URL}/guides/halloween-bars-chicago`

// The hood-by-hood section's spine. Halloween is a bar night, so the pools are
// late-night, DJ, karaoke and shot specials — the explicit "Halloween" deals are
// thin (a few dozen citywide) and get their own section above this one. Every
// hood gets its own query: the global pools are north-side dominated and a
// 200-row cap never reaches the suburbs.
const PARTY_HOODS: { slug: string; tag: string }[] = [
  { slug: "lakeview", tag: "Northalsted parade route" },
  { slug: "wrigleyville", tag: "Bar-crawl central" },
  { slug: "river-north", tag: "Clubs & late-night" },
  { slug: "west-loop", tag: "Randolph St parties" },
  { slug: "lincoln-park", tag: "Halsted & Lincoln Ave bars" },
  { slug: "logan-square", tag: "Milwaukee Ave, costumes encouraged" },
  { slug: "wicker-park", tag: "Six Corners dive crawl" },
  { slug: "naperville", tag: "Suburbs · downtown Naperville" },
  { slug: "rosemont", tag: "Suburbs · Parkway Bank Park" },
  { slug: "tinley-park", tag: "Suburbs · Oak Park Ave" },
  { slug: "schaumburg", tag: "Suburbs" },
]

// Guide-local drops the shared hotel/chain regex doesn't cover: a Halloween
// party guide has no business leading a suburb card with Buffalo Wild Wings.
const LOCAL_EXCLUDE =
  /pizza hut|domino'?s|little caesars|papa john|chuck e|dave & buster|buffalo wild wings|chili'?s|twin peaks|wing snob|wingstop|buona|five iron|hooters/i
const isGuideVenue = (d: Deal) => isLocalVenue(d) && !LOCAL_EXCLUDE.test(d.venue_name || "")

// The search is full-text, so `q=costume` also returns "Kardashian Trivia
// Night" and "Hawaiian Luau Party" via their descriptions. Gate the explicit
// section on the TITLE, and drop last year's posts that freshness picked up
// verbatim ("Costume Party 2025") — real venues, but a dated title reads stale.
const isHalloweenTitle = (d: Deal) =>
  /halloween|costume|spooky|spook-|haunted|trick[ -]or[ -]treat/i.test(d.title || "") && !/\b2025\b/.test(d.title || "")

async function fetchPool(calls: string[]): Promise<Deal[]> {
  try {
    const pages = await Promise.all(
      calls.map((qs) =>
        fetch(`${API_URL}/api/v1/deals/search?${qs}`, { next: { revalidate: 3600 } })
          .then((r): Promise<SearchResponse> =>
            r.ok ? r.json() : Promise.resolve({ deals: [] } as unknown as SearchResponse))
          .catch(() => ({ deals: [] } as unknown as SearchResponse))
      )
    )
    const seen = new Set<number>()
    const out: Deal[] = []
    for (const p of pages) {
      for (const d of p.deals ?? []) {
        if (seen.has(d.id)) continue
        seen.add(d.id)
        out.push(d)
      }
    }
    return out
  } catch {
    return []
  }
}

// Dates that are not fixed by the calendar are hedged — confirm with the
// organizer before promising anyone a start time.
const EVENTS = [
  {
    name: "Halloween night",
    when: "Sat Oct 31",
    where: "Everywhere, all at once",
    what: "Halloween lands on a Saturday in 2026, so there is no split between the 'real' night and the party night — every bar runs its costume contest, DJ and drink specials on the 31st, with Friday the 30th as the warm-up.",
  },
  {
    name: "Northalsted Halloween Parade",
    when: "Sat Oct 31, evening",
    where: "Halsted St, Belmont to Addison (Lakeview)",
    what: "The city's big one: a costume parade up Halsted with a judged contest, then the bars along the route stay packed until close. Get there before the step-off if you want a seat anywhere on the strip. Confirm the 2026 start time with Northalsted.",
  },
  {
    name: "Arts in the Dark",
    when: "A Saturday in mid/late October",
    where: "State St, the Loop",
    what: "A nighttime arts parade of puppets, lanterns and floats down State Street, usually the weekend before Halloween. Family-friendly and free, and the Loop bars are quiet afterward by Halloween standards. Confirm the 2026 date.",
  },
  {
    name: "Day of the Dead",
    when: "Sun Nov 1 – Mon Nov 2",
    where: "Pilsen & Little Village",
    what: "Día de Muertos follows Halloween straight into Pilsen: ofrendas at the National Museum of Mexican Art, processions on 18th Street and the best post-Halloween meal in the city. Our Mexican Independence Day guide covers the neighborhood's bars and taquerias.",
  },
]

export const metadata: Metadata = {
  title: "Halloween in Chicago 2026: Costume Parties, Bar Crawls & Late-Night Specials",
  description:
    "Halloween 2026 in Chicago (Sat Oct 31): the Northalsted parade, costume-contest bars, bar-crawl neighborhoods and live late-night drink specials across the city and suburbs. Updated weekly.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Halloween in Chicago 2026: Costume Parties, Bar Crawls & Late-Night Specials",
    description:
      "The Northalsted parade, costume-contest bars, crawl neighborhoods and late-night specials for Halloween weekend.",
    url: PAGE_URL,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Halloween+in+Chicago+2026&subtitle=Costume+parties%2C+bar+crawls+%26+late-night+specials&emoji=%F0%9F%8E%83&badges=Sat+Oct+31%2CNorthalsted+parade%2CCostume+contests`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Halloween in Chicago 2026 | 312Deals",
    description: "Costume parties, bar-crawl neighborhoods and late-night specials for Halloween weekend.",
  },
}

export default async function Page() {
  const [halloweenPool, partyPool] = await Promise.all([
    fetchPool([
      `q=halloween&limit=200`,
      `q=costume&limit=200`,
      `q=${encodeURIComponent("costume contest")}&limit=100`,
      `q=spooky&limit=50`,
    ]),
    fetchPool(
      PARTY_HOODS.flatMap((h) => [
        `neighborhood=${h.slug}&deal_type=late_night&limit=50`,
        `neighborhood=${h.slug}&q=dj&limit=50`,
        `neighborhood=${h.slug}&q=karaoke&limit=50`,
        `neighborhood=${h.slug}&q=shots&limit=50`,
      ])
    ),
  ])

  const halloweenVenues = uniqueByVenue(halloweenPool.filter(isGuideVenue).filter(isHalloweenTitle), true)
  const halloweenGroups = groupByNeighborhood(halloweenVenues).filter((g) => g.slug)

  // Don't re-list a costume-party bar in its hood card below.
  const usedIds = new Set(halloweenVenues.map((v) => v.id))
  const usedVenues = new Set(halloweenVenues.map((v) => v.venue_slug || v.venue_name))

  const partyVenues = uniqueByVenue(
    partyPool.filter(isGuideVenue).filter((d) => !usedIds.has(d.id) && !usedVenues.has(d.venue_slug || d.venue_name)),
    true
  )
  const partyGroups = groupByNeighborhood(partyVenues)
  const hoodGroups = PARTY_HOODS
    .map((h) => ({ ...h, group: partyGroups.find((g) => g.slug === h.slug) }))
    .filter((h) => h.group && h.group.venues.length >= 2)

  const faqItems = [
    {
      q: "What day is Halloween in 2026?",
      a: "Halloween is Saturday, October 31, 2026. Because it falls on a Saturday, Chicago's bars run their costume contests, DJ nights and drink specials on the night itself, with Friday the 30th as a second big night. Expect cover charges and lines at the most popular spots after 9pm.",
    },
    {
      q: "Where is the Halloween parade in Chicago?",
      a: "The Northalsted Halloween Parade runs up Halsted Street in Lakeview, roughly from Belmont to Addison, on the evening of October 31 with a judged costume contest. Arts in the Dark, a separate nighttime arts parade, goes down State Street in the Loop on a Saturday in mid-to-late October. Confirm both 2026 start times with the organizers.",
    },
    {
      q: "Which Chicago bars have Halloween costume contests?",
      a: "Costume contests cluster in Lakeview and Northalsted, River North, Wrigleyville, Logan Square and Old Town, and several suburban bars in Lake Zurich, Tinley Park and Lombard run their own. This guide lists every venue with a live Halloween or costume special on the books, with prices and hours on each venue page.",
    },
    {
      q: "What are the best neighborhoods for a Halloween bar crawl?",
      a: "Wrigleyville and Lakeview have the densest run of bars within a few blocks and host most of the organized crawls. Lincoln Park along Halsted and Lincoln Avenue, Logan Square on Milwaukee Avenue and Wicker Park around Six Corners are the walkable alternatives, and River North has the clubs and the latest closes. Our crawl planner maps live deals along any route you pick.",
    },
    {
      q: "Are there Halloween things to do in the Chicago suburbs?",
      a: "Yes. Downtown Naperville, Rosemont's Parkway Bank Park, Tinley Park and Schaumburg all have bars running Halloween weekend specials, and this guide tracks the live deals in each. Suburban downtowns also host trick-or-treat afternoons and family events the weekend before, so check your village calendar.",
    },
    {
      q: "Is there anything family-friendly on this list?",
      a: "Arts in the Dark on State Street is free and built for kids, and a handful of restaurants run kids-eat-free or treat specials on Halloween night. Most of the bars in this guide are 21+ after dark on the 31st, so plan the family stop for the afternoon.",
    },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbJsonLd([
              { name: "Home", url: SITE_URL },
              { name: "Guides", url: `${SITE_URL}/guides` },
              { name: "Halloween in Chicago", url: PAGE_URL },
            ])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
      />
      <Navbar />
      <div className="flex-1">
        <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-4 text-xs text-muted-foreground lg:px-6">
          <Link href="/" className="hover:text-brand-500">Home</Link>
          {" / "}
          <Link href="/guides" className="hover:text-brand-500">Guides</Link>
          {" / "}
          <span className="text-foreground">Halloween in Chicago</span>
        </nav>

        <header className="mx-auto max-w-7xl px-4 pt-6 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">Sat Oct 31, 2026</span>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">Parties Fri Oct 30 &amp; Sat Oct 31 &middot; Day of the Dead Nov 1&ndash;2</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Halloween in Chicago 2026: Costume Parties, Bar Crawls &amp; Late-Night Specials
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Halloween is on a Saturday this year, which means one enormous night instead of two
            medium ones. The Northalsted parade takes over Halsted, Wrigleyville turns into a
            costumed crawl, River North stays open latest, and the suburbs throw better parties than
            they get credit for. Here is where to go, neighborhood by neighborhood, with the live
            costume-contest, late-night and drink specials at each spot.
          </p>
        </header>

        {/* The weekend, the short version */}
        <section className="mx-auto max-w-7xl px-4 pt-8 lg:px-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Halloween weekend, the short version</h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {EVENTS.map((e) => (
              <div key={e.name} className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-base font-bold text-foreground">{e.name}</h3>
                <p className="mt-1 text-xs font-semibold text-brand-600 dark:text-brand-400">{e.when}</p>
                <p className="text-xs text-muted-foreground">{e.where}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.what}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Costume parties & Halloween specials */}
        {halloweenGroups.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <div className="flex items-center gap-2">
              <Ghost className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">Costume parties &amp; Halloween specials</h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Bars and restaurants with a Halloween or costume special already on the books. More
              post every week in October — this list refreshes hourly.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {halloweenGroups.slice(0, 9).map((g) => (
                <div key={g.slug} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      <Link href={`/neighborhoods/${g.slug}`} className="hover:text-brand-500">{g.name}</Link>
                    </h3>
                    <span className="text-xs text-muted-foreground">{g.venues.length} {g.venues.length === 1 ? "spot" : "spots"}</span>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {g.venues.slice(0, 5).map((v) => (
                      <li key={v.id} className="text-sm leading-snug">
                        <Link href={v.venue_slug ? `/venues/${v.venue_slug}` : "#"} className="font-medium text-foreground hover:text-brand-500">
                          {v.venue_name}
                        </Link>
                        <span className="block text-xs text-muted-foreground line-clamp-1">{v.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Hood by hood */}
        {hoodGroups.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <div className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">Where the party is, neighborhood by neighborhood</h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              The bars that run late-night, DJ, karaoke and shot specials year-round are the ones
              that go biggest on Halloween. City first, then the suburbs.
            </p>
            <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {hoodGroups.map(({ tag, group }) => (
                <div key={group!.slug} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      <Link href={`/neighborhoods/${group!.slug}`} className="hover:text-brand-500">{group!.name}</Link>
                    </h3>
                    <span className="whitespace-nowrap rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{tag}</span>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {group!.venues.slice(0, 6).map((v) => (
                      <li key={v.id} className="text-sm leading-snug">
                        <Link href={v.venue_slug ? `/venues/${v.venue_slug}` : "#"} className="font-medium text-foreground hover:text-brand-500">
                          {v.venue_name}
                        </Link>
                        <span className="block text-xs text-muted-foreground line-clamp-1">
                          <span className="font-semibold text-brand-600 dark:text-brand-400">
                            {DEAL_TYPE_LABEL[v.deal_type ?? ""] ?? "Deal"}:
                          </span>{" "}
                          {v.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/neighborhoods/${group!.slug}`}
                    className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    All {group!.name} deals &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fallback when the deal pool is thin */}
        {halloweenGroups.length === 0 && hoodGroups.length === 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Halloween specials post through October. In the meantime, browse{" "}
              <Link href="/deals/late-night" className="text-brand-600 hover:underline dark:text-brand-400">late-night deals</Link>, the{" "}
              <Link href="/neighborhoods/lakeview" className="text-brand-600 hover:underline dark:text-brand-400">Lakeview</Link> and{" "}
              <Link href="/neighborhoods/wrigleyville" className="text-brand-600 hover:underline dark:text-brand-400">Wrigleyville</Link>{" "}
              neighborhood pages, or build a route in the{" "}
              <Link href="/crawl" className="text-brand-600 hover:underline dark:text-brand-400">crawl planner</Link>.
            </p>
          </section>
        )}

        {/* Plan the crawl */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Plan the crawl</h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-900 dark:bg-brand-950/40">
              <h3 className="text-base font-bold text-foreground">Build your own Halloween bar crawl</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Pick a neighborhood, a start time and how many stops you want, and the crawl planner
                strings together the bars with live deals along the way — costume not included.
              </p>
              <Link
                href="/crawl"
                className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Open the crawl planner &rarr;
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-brand-500" aria-hidden="true" />
                <h3 className="text-base font-bold text-foreground">Late-night, the morning after &amp; Día de Muertos</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Kitchens that serve past midnight on Halloween are listed under{" "}
                <Link href="/deals/late-night" className="text-brand-600 hover:underline dark:text-brand-400">late-night deals</Link>.
                Sunday is a brunch day like any other, only slower — the{" "}
                <Link href="/guides/best-brunch-chicago" className="text-brand-600 hover:underline dark:text-brand-400">brunch guide</Link>{" "}
                has the bloody marys. Then head to Pilsen for Day of the Dead on Nov 1&ndash;2; the{" "}
                <Link href="/guides/mexican-independence-day-chicago" className="text-brand-600 hover:underline dark:text-brand-400">Mexican Independence Day guide</Link>{" "}
                covers the neighborhood's bars and taquerias.
              </p>
            </div>
          </div>
        </section>

        {/* Related links */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Keep planning</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/crawl" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Crawl Planner</Link>
            <Link href="/deals/late-night" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Late-Night Deals</Link>
            <Link href="/guides/oktoberfest-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Oktoberfest</Link>
            <Link href="/guides/bears-game-day-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Bears Game Day</Link>
            <Link href="/neighborhoods/lakeview" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Lakeview</Link>
            <Link href="/neighborhoods/wrigleyville" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Wrigleyville</Link>
            <Link href="/neighborhoods/river-north" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">River North</Link>
            <Link href="/today" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Deals Today</Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Halloween in Chicago FAQ</h2>
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

        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
          <GuideSearchHandoff
            headline="Find Halloween deals near you"
            subtitle="Search live late-night, drink and costume-party specials by neighborhood or suburb."
            cta={{ label: "Search late-night deals", href: "/search?deal_type=late_night" }}
            links={[
              { label: "Costume parties", href: "/search?q=costume" },
              { label: "Karaoke", href: "/search?q=karaoke" },
              { label: "Lakeview", href: "/neighborhoods/lakeview" },
              { label: "Deals today", href: "/today" },
            ]}
          />
          <div className="mt-8">
            <EmailSignup
              source="halloween-guide"
              headline="Get Chicago's best food & drink deals weekly"
              subtitle="One email every Thursday with the best deals for the weekend, city and suburbs. Free, unsubscribe anytime."
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
