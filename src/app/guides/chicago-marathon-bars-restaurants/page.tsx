import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Calendar, Utensils, Coffee, Footprints } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { BookingCTA } from "@/components/booking-cta"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo-utils"
import { uniqueByVenue, groupByNeighborhood, isLocalVenue, DEAL_TYPE_LABEL } from "@/lib/guide-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"
const PAGE_URL = `${SITE_URL}/guides/chicago-marathon-bars-restaurants`

// The course order is the spine of the spectator section. Mile ranges are the
// classic Grant Park loop and shift by a block or two year to year — keep them
// approximate ("miles 4-7"), never exact addresses.
const COURSE_HOODS: { slug: string; mile: string }[] = [
  { slug: "river-north", mile: "Miles 1–2 & 12" },
  { slug: "old-town", mile: "Miles 3 & 11" },
  { slug: "lincoln-park", mile: "Miles 4–7" },
  { slug: "lakeview", mile: "Miles 7–9" },
  { slug: "the-loop", mile: "Miles 12–13" },
  { slug: "west-loop", mile: "Miles 13–17" },
  { slug: "university-village", mile: "Mile 18 · Taylor St" },
  { slug: "pilsen", mile: "Mile 19 · 18th St" },
  { slug: "chinatown", mile: "Mile 21" },
  { slug: "bronzeville", mile: "Miles 22–24" },
  { slug: "south-loop", mile: "Miles 25–26 · the finish" },
]

// Where out-of-town runners actually sleep: downtown. Carb-loading leads with
// these, then the rest of the Italian corpus by deal count.
const CARB_ANCHOR_HOODS = ["river-north", "the-loop", "west-loop", "streeterville", "gold-coast", "south-loop"]

// Walkable (or one short ride) from the Grant Park finish.
const FINISH_HOODS = ["south-loop", "the-loop", "streeterville", "gold-coast", "river-north", "west-loop"]

// Guide-local drops the shared hotel/chain regex doesn't cover: delivery-chain
// pizza has no place in a carb-loading list, and a gym cafe isn't a spectator bar.
const LOCAL_EXCLUDE = /pizza hut|domino'?s|little caesars|papa john|lakeshore sport/i
const isGuideVenue = (d: Deal) => isLocalVenue(d) && !LOCAL_EXCLUDE.test(d.venue_name || "")

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

const EVENTS = [
  {
    name: "Race day",
    when: "Sun Oct 11, first waves early morning",
    where: "Starts and finishes in Grant Park",
    what: "About 50,000 runners loop through 29 neighborhoods — north to Lakeview, west through the West Loop and Little Italy, south through Pilsen, Chinatown and Bronzeville, then up Michigan Ave to the finish.",
  },
  {
    name: "The expo (bib pick-up)",
    when: "Thu Oct 8 – Sat Oct 10",
    where: "McCormick Place",
    what: "Every runner passes through the health & fitness expo to collect their bib, which makes the South Loop and Chinatown unusually good people-watching (and lunch-crowd) territory all weekend.",
  },
  {
    name: "Getting around",
    when: "All day Sunday",
    where: "Along the whole course",
    what: "Streets on and around the course close from early morning into mid-afternoon. Take the CTA: the Brown, Red and Pink lines each cross the course, so you can leapfrog your runner between two or three cheer spots.",
  },
]

export const metadata: Metadata = {
  title: "Chicago Marathon 2026: Spectator Bars, Carb-Loading & Post-Race Brunch",
  description:
    "Where to eat and drink for Chicago Marathon weekend (Oct 11, 2026): spectator bars mile by mile along the course, carb-loading Italian dinners, and post-race brunch near the Grant Park finish. Updated weekly.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Chicago Marathon 2026: Spectator Bars, Carb-Loading & Post-Race Brunch",
    description:
      "Mile-by-mile spectator bars, carb-loading dinners and post-race brunch deals for Chicago Marathon weekend.",
    url: PAGE_URL,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Chicago+Marathon+2026&subtitle=Spectator+bars%2C+carb-loading+%26+post-race+brunch&emoji=%F0%9F%8F%83&badges=Sun+Oct+11%2CMile-by-mile+bars%2CPost-race+brunch`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chicago Marathon 2026 Bars & Restaurants | 312Deals",
    description: "Spectator bars mile by mile, carb-loading dinners, and post-race brunch near the finish.",
  },
}

export default async function Page() {
  const [spectatorPool, carbPool] = await Promise.all([
    // Race day is a Sunday morning: the spectator crowd runs on brunch,
    // bloody marys and mimosas, so that is the pool worth surfacing. Dim sum
    // is Chinatown's brunch — without it the mile-21 card stays empty. The
    // global brunch pool is all north side (Lincoln Park, Lakeview, River
    // North fill the 200 rows), so every course hood also gets its own query
    // or the South Loop finish, Bronzeville and Taylor St cards stay empty.
    fetchPool([
      `deal_type=brunch_deal&limit=200`,
      `q=${encodeURIComponent("bloody mary")}&limit=200`,
      `q=${encodeURIComponent("mimosa")}&limit=200`,
      `q=${encodeURIComponent("dim sum")}&limit=100`,
      ...COURSE_HOODS.map((h) => `neighborhood=${h.slug}&deal_type=brunch_deal&limit=50`),
    ]),
    fetchPool([
      `cuisine=italian&sort=popular&limit=200`,
      `q=${encodeURIComponent("pasta")}&limit=200`,
    ]),
  ])

  const spectatorVenues = uniqueByVenue(spectatorPool.filter(isGuideVenue))
  const spectatorGroups = groupByNeighborhood(spectatorVenues)
  const courseGroups = COURSE_HOODS
    .map((h) => ({ ...h, group: spectatorGroups.find((g) => g.slug === h.slug) }))
    .filter((h) => h.group && h.group.venues.length > 0)

  // Don't re-list a bar that already appears course-side.
  const usedIds = new Set(courseGroups.flatMap((h) => h.group!.venues.slice(0, 6).map((v) => v.id)))

  const carbVenues = uniqueByVenue(carbPool.filter(isGuideVenue))
  const carbGroups = groupByNeighborhood(carbVenues)
  const carbAnchors = carbGroups.filter((g) => CARB_ANCHOR_HOODS.includes(g.slug) && g.venues.length >= 2)
  const carbOthers = carbGroups.filter((g) => !CARB_ANCHOR_HOODS.includes(g.slug) && g.slug && g.venues.length >= 2).slice(0, 4)

  const brunchGroups = spectatorGroups
    .filter((g) => FINISH_HOODS.includes(g.slug))
    .map((g) => ({ ...g, venues: g.venues.filter((v) => !usedIds.has(v.id)) }))
    .filter((g) => g.venues.length > 0)

  const faqItems = [
    {
      q: "When is the Chicago Marathon in 2026?",
      a: "The Bank of America Chicago Marathon runs Sunday, October 11, 2026, starting and finishing in Grant Park. Runners pick up bibs at the McCormick Place expo Thursday through Saturday, so the whole weekend has a race-week feel downtown.",
    },
    {
      q: "Where are the best places to watch the Chicago Marathon?",
      a: "The course crosses 29 neighborhoods, so pick a bar-friendly stretch: Lincoln Park and Lakeview catch runners around miles 4 through 9, Old Town sees them twice, the West Loop covers the middle miles, and Pilsen's 18th Street around mile 19 and Chinatown at mile 21 are two of the loudest, most fun cheer zones on the course.",
    },
    {
      q: "Where should I carb-load the night before the marathon?",
      a: "Most runners stay downtown, so Italian spots in River North, the Loop, the West Loop and Streeterville book out fastest for Saturday night. Reserve early in the week, eat on the early side, and check the live pasta and Italian deals in this guide for who is running specials.",
    },
    {
      q: "Where can I eat or drink near the marathon finish line?",
      a: "The finish is in Grant Park, so the South Loop, the Loop, Streeterville and River North are all walkable for a post-race meal. Brunch service runs all day Sunday at most spots, and this guide tracks live brunch, bloody mary and mimosa deals near the finish with exact prices and hours.",
    },
    {
      q: "How do I get around Chicago on marathon Sunday?",
      a: "Skip driving. Streets on and near the course close from early morning to mid-afternoon, and the CTA is the reliable way to hop between cheer spots — the Brown, Red and Pink lines all cross the course at different points. Build in extra time; trains run crowded from the first wave on.",
    },
    {
      q: "Do bars along the marathon course open early on race day?",
      a: "Many course-side spots open early with coffee and brunch service for spectators, and the bloody marys and mimosas are flowing by mid-morning in Lakeview, Lincoln Park, Pilsen and the West Loop. Deals on this page list each venue's exact days and hours, so you can check who is pouring before the leaders come through.",
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
              { name: "Chicago Marathon Bars & Restaurants", url: PAGE_URL },
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
          <span className="text-foreground">Chicago Marathon Bars &amp; Restaurants</span>
        </nav>

        <header className="mx-auto max-w-7xl px-4 pt-6 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">Sun Oct 11, 2026</span>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">Grant Park start &amp; finish &middot; 29 neighborhoods</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Chicago Marathon 2026: Spectator Bars, Carb-Loading &amp; Post-Race Brunch
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Marathon Sunday is the best bar crawl in Chicago that nobody calls a bar crawl. Fifty
            thousand runners loop from Grant Park through Lincoln Park, Lakeview, the West Loop,
            Pilsen, Chinatown and Bronzeville, and the neighborhoods come out with signs, speakers
            and bloody marys. Here is where to plant yourself mile by mile, where to carb-load the
            night before, and where to celebrate near the finish — with the live deals at each spot.
          </p>
        </header>

        {/* Race weekend basics */}
        <section className="mx-auto max-w-7xl px-4 pt-8 lg:px-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Race weekend, the short version</h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
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

        {/* Spectator bars, mile by mile */}
        {courseGroups.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <div className="flex items-center gap-2">
              <Footprints className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">Where to watch: bars along the course, mile by mile</h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Ordered the way the runners see it. Every spot below has a live brunch, bloody mary or
              mimosa deal on the books — tap through for exact prices, days and hours.
            </p>
            <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courseGroups.map(({ mile, group }) => (
                <div key={group!.slug} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      <Link href={`/neighborhoods/${group!.slug}`} className="hover:text-brand-500">{group!.name}</Link>
                    </h3>
                    <span className="whitespace-nowrap rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{mile}</span>
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

        {/* Carb-loading */}
        {(carbAnchors.length > 0 || carbOthers.length > 0) && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <div className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">Carb-loading: pasta the night before</h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Saturday night Italian near the downtown hotels books out first — reserve early in the
              week. These neighborhoods have the deepest pasta benches, with live deals at each spot.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...carbAnchors, ...carbOthers].slice(0, 6).map((g) => (
                <div key={g.slug} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      <Link href={`/neighborhoods/${g.slug}`} className="hover:text-brand-500">{g.name}</Link>
                    </h3>
                    <span className="text-xs text-muted-foreground">{g.venues.length} spots</span>
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

        {/* Post-race brunch near the finish */}
        {brunchGroups.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <div className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">Post-race: brunch &amp; recovery near the finish</h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              All walkable (slowly, in a foil blanket) from Grant Park, or one short ride away.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {brunchGroups.slice(0, 6).map((g) => (
                <div key={g.slug} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      <Link href={`/neighborhoods/${g.slug}`} className="hover:text-brand-500">{g.name}</Link>
                    </h3>
                    <span className="text-xs text-muted-foreground">{g.venues.length} spots</span>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {g.venues.slice(0, 5).map((v) => (
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
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fallback when the deal pool is thin */}
        {courseGroups.length === 0 && carbAnchors.length === 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Race-week specials post closer to the weekend. In the meantime, browse{" "}
              <Link href="/guides/best-brunch-chicago" className="text-brand-600 hover:underline dark:text-brand-400">the brunch guide</Link>,{" "}
              <Link href="/cuisine/italian" className="text-brand-600 hover:underline dark:text-brand-400">Italian restaurants</Link>, or the{" "}
              <Link href="/neighborhoods/pilsen" className="text-brand-600 hover:underline dark:text-brand-400">Pilsen</Link> and{" "}
              <Link href="/neighborhoods/lakeview" className="text-brand-600 hover:underline dark:text-brand-400">Lakeview</Link>{" "}
              neighborhood pages.
            </p>
          </section>
        )}

        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <BookingCTA
            campaign="marathon_guide"
            headline="In town for the marathon?"
            subhead="Stay near the Grant Park start or along the course. Race weekend rooms go early — free cancellation on most."
          />
        </div>

        {/* Related links */}
        <section className="mx-auto max-w-7xl px-4 pt-2 lg:px-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Keep planning</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/guides/best-brunch-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Brunch Guide</Link>
            <Link href="/cuisine/italian" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Italian Restaurants</Link>
            <Link href="/guides/where-to-stay-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Where to Stay</Link>
            <Link href="/neighborhoods/pilsen" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Pilsen</Link>
            <Link href="/neighborhoods/lakeview" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Lakeview</Link>
            <Link href="/neighborhoods/west-loop" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">West Loop</Link>
            <Link href="/today" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Deals Today</Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Footprints className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Chicago Marathon FAQ</h2>
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
            headline="Find race-weekend deals near you"
            subtitle="Search live brunch, pasta and drink deals by neighborhood or suburb."
            cta={{ label: "Search brunch deals", href: "/search?deal_type=brunch_deal" }}
            links={[
              { label: "Bloody marys", href: "/search?q=bloody+mary" },
              { label: "Pasta", href: "/search?q=pasta" },
              { label: "Lakeview", href: "/neighborhoods/lakeview" },
              { label: "Deals today", href: "/today" },
            ]}
          />
          <div className="mt-8">
            <EmailSignup
              source="marathon-guide"
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
