import Link from "next/link"
import type { Metadata } from "next"
import { Beer, MapPin, Calendar, Trees } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo-utils"
import { uniqueByVenue, isLocalVenue, DEAL_TYPE_LABEL } from "@/lib/guide-utils"
import type { Deal, SearchResponse, NeighborhoodSummary, NeighborhoodSummaryResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"
const PAGE_URL = `${SITE_URL}/guides/oktoberfest-chicago`

async function getBeerHallDeals(): Promise<Deal[]> {
  const calls = [
    `cuisine=german&sort=popular&limit=200`,
    `q=${encodeURIComponent("oktoberfest")}&limit=200`,
    `q=${encodeURIComponent("beer garden")}&limit=200`,
    `q=${encodeURIComponent("stein")}&limit=100`,
  ]
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

/**
 * Live deal counts per neighborhood, used to decide which fest rows get a link.
 * Gating on the live count rather than a hardcoded list means a town whose
 * inventory collapses stops being linked on its own, instead of shipping a
 * click into an empty page.
 */
async function getHoodSummary(): Promise<NeighborhoodSummary[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/neighborhoods/summary`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data: NeighborhoodSummaryResponse = await res.json()
    return data.neighborhoods ?? []
  } catch {
    return []
  }
}

/** Below this many active deals a neighborhood link is not worth the click. */
const MIN_HOOD_DEALS = 25

type Fest = {
  name: string
  when: string
  where: string
  note: string
  /** Neighborhood page for the fest town. Omitted where we have no page at all
   *  (Elk Grove Village, Glendale Heights) — those rows stay unlinked rather
   *  than 404, since /neighborhoods/[slug] calls notFound() with no deals. */
  hood?: string
  /** The fest host, when it is a venue we actually track. Beats the hood link. */
  venue?: { slug: string; label: string }
}

const CITY_FESTS: Fest[] = [
  { hood: "old-town", name: "Old Town Oktoberfest", when: "Sep 18 – 20", where: "Old Town", note: "The city's best-known Oktoberfest street party, steins and brats on the North Ave corridor." },
  { hood: "lakeview", name: "Oktoberfest Chicago (Lakeview)", when: "Sep 25 – 27", where: "Southport / Lakeview", note: "St. Alphonsus grounds, German bands, liter pours and a genuinely Bavarian crowd." },
  { hood: "the-loop", venue: { slug: "the-berghoff", label: "The Berghoff" }, name: "Berghoff Oktoberfest", when: "Mid-September", where: "The Loop, Adams St", note: "The Berghoff shuts down Adams for its annual fest. Confirm 2026 dates with the restaurant." },
]

const SUBURB_FESTS: Fest[] = [
  { hood: "schaumburg", name: "Schaumburg Septemberfest", when: "Sep 5 – 7", where: "Schaumburg", note: "Labor Day weekend kickoff to fest season, carnival, parade and beer tent." },
  { name: "Glendale Heights Oktoberfest", when: "Sep 10 – 20", where: "Glendale Heights", note: "One of the longest runs in the area." },
  { hood: "palatine", name: "Palatine Oktoberfest", when: "Sep 18 – 20", where: "Downtown Palatine", note: "Northwest suburbs' biggest, right by the Metra station." },
  { name: "Elk Grove Oktoberfest", when: "Sep 18 – 19", where: "Elk Grove Village", note: "Village-run, family-friendly." },
  { hood: "mount-prospect", name: "Mount Prospect Oktoberfest & Fall Festival", when: "Sep 18 – 19", where: "Mount Prospect", note: "Fest plus a fall festival on the same grounds." },
  { hood: "long-grove", name: "Long Grove Apple Fest", when: "Sep 25 – 27", where: "Historic Long Grove", note: "Not an Oktoberfest, but the definitive Chicagoland fall festival: cider, apple donuts, cobblestone streets." },
  { hood: "naperville", name: "Naperville Oktoberfest", when: "Sep 30 – Oct 1", where: "Naper Settlement", note: "Heated tent, traditional German food and beer, polka and rock." },
  { hood: "long-grove", venue: { slug: "buffalo-creek-brewing", label: "Buffalo Creek Brewing" }, name: "Buffalo Creek Brewing Oktoberfest", when: "Oct 2 – 4", where: "Long Grove", note: "Brewery-run and the last good one of the season." },
]

export const metadata: Metadata = {
  title: "Oktoberfest Chicago 2026, Every Fest Plus Beer Halls & Deals",
  description:
    "Every Oktoberfest in Chicago and the suburbs in 2026, from Old Town (Sep 18-20) and Lakeview (Sep 25-27) to Palatine, Naperville and Long Grove, plus German beer halls with live food and drink deals.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Oktoberfest Chicago 2026, Every Fest Plus Beer Halls & Deals",
    description:
      "The full city and suburban Oktoberfest calendar, plus Chicago beer halls and German restaurants with current deals.",
    url: PAGE_URL,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Oktoberfest+Chicago+2026&subtitle=Every+fest+in+the+city+and+suburbs+%2B+beer+hall+deals&emoji=%F0%9F%8D%BB&badges=Sep+5+-+Oct+4%2CCity+%2B+suburbs%2CBeer+halls`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Oktoberfest Chicago 2026 | 312Deals",
    description: "Every Oktoberfest in Chicagoland plus beer halls with live deals.",
  },
}

type HoodCount = { name: string; deals: number }

/**
 * These two tables carry the fest dates this page ranks for, and until now every
 * row was inert text — a visitor read "Old Town, Sep 18-20" and had nothing to
 * click, which is the most likely cause of the 80% bounce rate. Each row now
 * offers the nearby-deals link the fest-goer actually wants, but only where we
 * have real inventory to send them to.
 */
function FestTable({ rows, counts }: { rows: Fest[]; counts: Map<string, HoodCount> }) {
  const linkedHood = (f: Fest): HoodCount | null => {
    if (!f.hood) return null
    const c = counts.get(f.hood)
    return c && c.deals >= MIN_HOOD_DEALS ? c : null
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4">Fest</th>
            <th className="py-2 pr-4">Dates</th>
            <th className="py-2 pr-4">Where</th>
            <th className="py-2 pr-4">Notes</th>
            <th className="py-2">Deals nearby</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const hood = linkedHood(f)
            return (
              <tr key={f.name} className="border-b border-border/60 align-top">
                <td className="py-2.5 pr-4 font-medium text-foreground">{f.name}</td>
                <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground">{f.when}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {hood ? (
                    <Link
                      href={`/neighborhoods/${f.hood}`}
                      className="text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {f.where}
                    </Link>
                  ) : (
                    f.where
                  )}
                </td>
                <td className="py-2.5 pr-4 text-xs text-muted-foreground">{f.note}</td>
                <td className="py-2.5 text-xs">
                  {f.venue && (
                    <Link
                      href={`/venues/${f.venue.slug}`}
                      className="block font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {f.venue.label} &rarr;
                    </Link>
                  )}
                  {hood ? (
                    <Link
                      href={`/neighborhoods/${f.hood}`}
                      className="block text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {hood.name} ({hood.deals.toLocaleString()}) &rarr;
                    </Link>
                  ) : (
                    !f.venue && <span className="text-muted-foreground">&mdash;</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default async function Page() {
  const [rawDeals, hoodSummary] = await Promise.all([getBeerHallDeals(), getHoodSummary()])
  const allVenues = uniqueByVenue(rawDeals.filter(isLocalVenue))
  const venues = allVenues.slice(0, 18)

  const counts = new Map<string, HoodCount>(
    hoodSummary.map((n) => [n.slug, { name: n.name, deals: n.deal_count ?? 0 }])
  )
  const festCount = CITY_FESTS.length + SUBURB_FESTS.length
  // Deals across the fest towns themselves — the number a fest-goer cares about,
  // and honest in a way "beer hall deals" is not, since the German pool is thin.
  const festHoods = Array.from(
    new Set([...CITY_FESTS, ...SUBURB_FESTS].map((f) => f.hood).filter(Boolean) as string[])
  )
  const townDeals = festHoods.reduce((sum, h) => sum + (counts.get(h)?.deals ?? 0), 0)

  const faqItems = [
    {
      q: "When is Oktoberfest in Chicago in 2026?",
      a: "Chicagoland's Oktoberfest season runs from early September through the first weekend of October. The two biggest city fests are Old Town Oktoberfest (September 18 to 20) and Oktoberfest Chicago in Lakeview (September 25 to 27). Suburban fests fill in the rest, from Schaumburg Septemberfest over Labor Day weekend to Buffalo Creek Brewing in Long Grove on October 2 to 4.",
    },
    {
      q: "What are the best Oktoberfests in the Chicago suburbs?",
      a: "Palatine Oktoberfest (September 18 to 20) is the biggest in the northwest suburbs and sits right by the Metra station. Naperville's fest at Naper Settlement (September 30 to October 1) has a heated tent with traditional German food. Long Grove Apple Fest (September 25 to 27) is not technically Oktoberfest but is the definitive Chicagoland fall festival, and Buffalo Creek Brewing runs a proper brewery Oktoberfest the following weekend.",
    },
    {
      q: "Where can I drink German beer in Chicago year-round?",
      a: "Chicago has a deep German and beer hall tradition: the Berghoff in the Loop, Radler and Dovetail in Logan Square, Lincoln Square's Huettenbar and Chicago Brauhaus lineage, Resi's Bierstube in North Center, and Kaiser Tiger in the West Loop. Many run happy hours and stein specials outside fest season, and this guide lists what is currently running.",
    },
    {
      q: "Is Oktoberfest free in Chicago?",
      a: "It varies. Most city street fests ask for a suggested donation at the gate (often $10 to $15), and suburban village fests are usually free to enter with food and beer sold by ticket. Brewery-hosted Oktoberfests are typically free entry with drinks priced normally. Check each fest's own site before you go.",
    },
    {
      q: "What should I order at an Oktoberfest?",
      a: "A liter of Märzen or festbier is the classic, alongside bratwurst, pretzels with obatzda, schnitzel, and potato pancakes. Most Chicago fests pour Bavarian imports plus local Oktoberfest-style lagers from Illinois breweries, and the brewery-hosted ones lean heavily local.",
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
              { name: "Oktoberfest Chicago", url: PAGE_URL },
            ])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
      />
      {/* Deliberately NOT Event markup. These are 11 third-party fests we do not
          organise, one of which is dated only "Mid-September", and the page itself
          warns dates shift. A wrong startDate on Event risks a manual action. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Oktoberfest in Chicago 2026: Every Fest, Plus Beer Halls Worth the Trip",
            description: `${festCount} Chicagoland Oktoberfests from September 5 to October 4, plus ${allVenues.length} Chicago and suburban beer halls, German restaurants and beer gardens with live food and drink deals.`,
            url: PAGE_URL,
            mainEntityOfPage: { "@type": "WebPage", "@id": PAGE_URL },
            author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
            publisher: {
              "@type": "Organization",
              name: "312Deals",
              url: SITE_URL,
              logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
            },
            datePublished: "2026-08-15",
            dateModified: new Date().toISOString().split("T")[0],
          }),
        }}
      />
      <Navbar />
      <div className="flex-1">
        <nav aria-label="Breadcrumb" className="mx-auto max-w-4xl px-4 pt-4 text-xs text-muted-foreground lg:px-6">
          <Link href="/" className="hover:text-brand-500">Home</Link>
          {" / "}
          <Link href="/guides" className="hover:text-brand-500">Guides</Link>
          {" / "}
          <span className="text-foreground">Oktoberfest Chicago</span>
        </nav>

        <header className="mx-auto max-w-4xl px-4 pt-6 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">Sep 5 &ndash; Oct 4, 2026</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-700">City + suburbs</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Oktoberfest in Chicago 2026: Every Fest, Plus Beer Halls Worth the Trip
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            By <span className="font-medium text-foreground">312Deals Team</span> &middot; Updated{" "}
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
            We track <strong className="text-foreground">{festCount} Oktoberfests and fall fests</strong> across
            Chicago and the suburbs between September 5 and October 4, plus{" "}
            <strong className="text-foreground">{allVenues.length} beer halls, German restaurants and beer gardens</strong>{" "}
            with live deals, and{" "}
            <strong className="text-foreground">{townDeals.toLocaleString()} active deals</strong> in the fest
            towns themselves. The busiest weekend is September 18 to 20, when Old Town, Palatine, Elk Grove
            and Mount Prospect all run at once. Below: the full calendar for both the city and the suburbs,
            then the German restaurants and beer halls running deals right now.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Calendar, value: String(festCount), label: "Fests tracked" },
              { icon: Beer, value: String(allVenues.length), label: "Beer halls & German spots" },
              { icon: Trees, value: "Sep 18\u201320", label: "Busiest weekend" },
              { icon: MapPin, value: townDeals.toLocaleString(), label: "Deals in fest towns" },
            ].map((t) => (
              <div key={t.label} className="rounded-lg border border-border bg-card p-3">
                <t.icon className="h-4 w-4 text-brand-500" aria-hidden="true" />
                <div className="mt-1.5 text-xl font-bold text-foreground">{t.value}</div>
                <div className="text-xs text-muted-foreground">{t.label}</div>
              </div>
            ))}
          </div>
        </header>

        {/* City fests */}
        <section className="mx-auto max-w-4xl px-4 pt-8 lg:px-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Oktoberfests in the city</h2>
          </div>
          <FestTable rows={CITY_FESTS} counts={counts} />
        </section>

        {/* Suburb fests */}
        <section className="mx-auto max-w-4xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Trees className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Oktoberfests in the suburbs</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            The suburbs out-fest the city in September. These are worth the drive.
          </p>
          <FestTable rows={SUBURB_FESTS} counts={counts} />
          <p className="mt-3 text-xs text-muted-foreground">
            Dates are as published for 2026 and occasionally shift. Confirm with each fest before you go.
          </p>
        </section>

        {/* Beer halls with live deals */}
        <section className="mx-auto max-w-4xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Beer className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Beer halls &amp; German spots with deals now</h2>
          </div>
          {venues.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((v) => (
                <Link
                  key={v.id}
                  href={v.venue_slug ? `/venues/${v.venue_slug}` : "/search?q=beer"}
                  className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-500"
                >
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">{v.venue_name}</p>
                  <h3 className="mt-1 text-sm font-bold leading-tight text-foreground group-hover:text-brand-500">{v.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {v.neighborhood || "Chicago"}
                    {v.deal_type ? ` · ${DEAL_TYPE_LABEL[v.deal_type] ?? "Deal"}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Fest-season specials post through late August and early September. In the meantime, browse{" "}
              <Link href="/deals/beer-specials" className="text-brand-600 hover:underline dark:text-brand-400">beer specials</Link> or{" "}
              <Link href="/guides/patio-season-chicago" className="text-brand-600 hover:underline dark:text-brand-400">beer gardens and patios</Link>{" "}
              across the city and suburbs.
            </p>
          )}
        </section>

        {/* Planning prose */}
        <section className="mx-auto max-w-4xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">How to plan the season</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            September 18 to 20 is the single busiest weekend, with Old Town, Palatine, Elk Grove and
            Mount Prospect all running at once. If you want one city fest and one suburban fest, pair Old
            Town that weekend with Lakeview or Long Grove the weekend after. Metra makes Palatine and
            Long Grove genuinely easy without a car, and the fests near stations are the ones where you
            can actually drink a liter and get home. For the last call of the season, Buffalo Creek
            Brewing on October 2 to 4 runs after most fests have packed up.
          </p>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Beer className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Oktoberfest Chicago FAQ</h2>
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
        <section className="mx-auto max-w-4xl px-4 pt-10 lg:px-6">
          <h2 className="text-sm font-semibold text-foreground">Keep exploring</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/deals/beer-specials" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Beer Specials</Link>
            <Link href="/guides/patio-season-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Patios &amp; Beer Gardens</Link>
            <Link href="/guides/bears-game-day-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Bears Game Day</Link>
            <Link href="/guides/cheap-drinks-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Cheap Drinks</Link>
            <Link href="/today" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Deals Today</Link>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
          <GuideSearchHandoff
            headline="Find beer deals near you"
            subtitle="Search live beer and bar specials by neighborhood or suburb."
            cta={{ label: "Search beer specials", href: "/search?q=beer" }}
            links={[
              { label: "Beer specials", href: "/deals/beer-specials" },
              { label: "Beer gardens", href: "/guides/patio-season-chicago" },
              { label: "Deals today", href: "/today" },
            ]}
          />
          <div className="mt-8">
            <EmailSignup
              source="oktoberfest-guide"
              headline="Get Chicago's best beer and fall deals weekly"
              subtitle="One email every Thursday with the best food and drink deals for the weekend, city and suburbs. Free, unsubscribe anytime."
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
