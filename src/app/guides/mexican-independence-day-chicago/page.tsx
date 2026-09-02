import Link from "next/link"
import type { Metadata } from "next"
import { PartyPopper, MapPin, Calendar, Martini, Utensils } from "lucide-react"
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
const PAGE_URL = `${SITE_URL}/guides/mexican-independence-day-chicago`

// Pilsen and Little Village are the cultural anchors and already our two
// strongest neighborhood pages for this intent — lead with them, then the rest.
// (Verified slugs; Back of the Yards has no neighborhood page, prose only.)
const ANCHOR_HOODS = ["pilsen", "little-village", "gage-park"]

async function getFiestaDeals(): Promise<Deal[]> {
  const calls = [
    `cuisine=mexican&sort=popular&limit=200`,
    `q=${encodeURIComponent("taco")}&limit=200`,
    `q=${encodeURIComponent("margarita")}&limit=200`,
    `q=${encodeURIComponent("tequila")}&limit=200`,
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

const EVENTS = [
  {
    name: "El Grito Chicago",
    when: "Sat Sep 12 – Sun Sep 13",
    where: "Grant Park (Petrillo Bandshell)",
    what: "The city's flagship Mexican Independence celebration: mariachi and ballet folclórico at the bandshell, national and local headliners, and a full food and beverage midway.",
  },
  {
    name: "26th Street Mexican Independence Day Parade",
    when: "Sun Sep 13, 12:00 – 3:00 PM",
    where: "Little Village, from the Arch at 26th & Albany to Kostner",
    what: "The 55th edition of one of the Midwest's largest parades, running two and a half miles down the 26th Street business corridor and drawing hundreds of thousands.",
  },
  {
    name: "El Grito (the cry) itself",
    when: "Night of Tue Sep 15",
    where: "Citywide",
    what: "The traditional reenactment of Hidalgo's 1810 call to arms happens the night before Mexican Independence Day, so bars and restaurants run their biggest specials Sep 12 through Sep 16.",
  },
]

export const metadata: Metadata = {
  title: "Mexican Independence Day Chicago 2026, El Grito, Parade & Where to Eat",
  description:
    "El Grito Chicago Sep 12-13 at Grant Park + the 26th St Parade Sun Sep 13. Taco, margarita & tequila deals in Pilsen, Little Village & citywide.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Mexican Independence Day Chicago 2026, El Grito, Parade & Where to Eat",
    description:
      "Everything happening for Mexican Independence Day in Chicago, plus live taco, margarita and tequila deals by neighborhood.",
    url: PAGE_URL,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Mexican+Independence+Day+2026&subtitle=El+Grito%2C+the+26th+St+Parade+%2B+where+to+eat&emoji=%F0%9F%87%B2%F0%9F%87%BD&badges=Sep+12-16%2CPilsen+%26+Little+Village%2CTacos+%2B+margaritas`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mexican Independence Day Chicago 2026 | 312Deals",
    description: "El Grito, the 26th Street Parade, and where to eat and drink around them.",
  },
}

export default async function Page() {
  const all = (await getFiestaDeals()).filter(isLocalVenue)
  const venues = uniqueByVenue(all)
  const groups = groupByNeighborhood(venues)
  const anchors = groups.filter((g) => ANCHOR_HOODS.includes(g.slug))
  const others = groups.filter((g) => !ANCHOR_HOODS.includes(g.slug) && g.slug).slice(0, 8)
  const totalVenues = venues.length

  const faqItems = [
    {
      q: "When is Mexican Independence Day in Chicago in 2026?",
      a: "Mexican Independence Day is September 16, and the traditional El Grito reenactment happens the night before, on September 15. Chicago's big public celebrations land the weekend prior: El Grito Chicago runs Saturday September 12 and Sunday September 13 in Grant Park, and the 26th Street Parade in Little Village steps off Sunday September 13 at noon.",
    },
    {
      q: "Where is the Mexican Independence Day parade in Chicago?",
      a: "The 26th Street Mexican Independence Day Parade runs through Little Village, starting at the Little Village Arch at 26th and Albany and heading west down 26th Street to Kostner. It covers about two and a half miles of the business corridor and is one of the largest parades in the Midwest.",
    },
    {
      q: "What are the best neighborhoods for Mexican food in Chicago?",
      a: "Pilsen and Little Village are the cultural heart, with taquerias, panaderias and cantinas lining 18th Street and 26th Street. Back of the Yards, Gage Park and Archer Heights are strong too, and there are excellent Mexican kitchens all over the city and suburbs, from Logan Square to Cicero to Aurora.",
    },
    {
      q: "Where can I find taco and margarita deals during El Grito weekend?",
      a: "312Deals tracks live taco, margarita and tequila specials across Chicago and the suburbs, with exact prices, days and hours on each listing. Deals cluster on Tuesdays citywide, but El Grito weekend brings extra specials in Pilsen, Little Village and River North. Check this guide or the Taco Tuesday page for what is running right now.",
    },
    {
      q: "Is El Grito Chicago free?",
      a: "El Grito Chicago in Grant Park has historically been a ticketed festival, while the 26th Street Parade in Little Village is free and open to the public. Check the official El Grito Chicago site for 2026 ticketing before you go.",
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
              { name: "Mexican Independence Day Chicago", url: PAGE_URL },
            ])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
      />
      {/* Event markup is scoped as a companion, matching the convention in
          lollapalooza-chicago: 312Deals is not the organizer of El Grito or the
          parade, so the entity we describe is our deal coverage around them. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            name: "Mexican Independence Day Chicago 2026 (Restaurant & Deal Companion)",
            description: `El Grito Chicago in Grant Park Sat Sep 12 to Sun Sep 13 and the 26th Street Parade in Little Village Sun Sep 13, plus taco, margarita and tequila specials at ${totalVenues} Chicago and suburban venues.`,
            startDate: "2026-09-12",
            endDate: "2026-09-16",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            eventStatus: "https://schema.org/EventScheduled",
            location: {
              "@type": "Place",
              name: "Grant Park, Chicago",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Chicago",
                addressRegion: "IL",
                addressCountry: "US",
              },
            },
            organizer: { "@type": "Organization", name: "312Deals", url: SITE_URL },
            url: PAGE_URL,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Mexican Independence Day in Chicago 2026: El Grito, the Parade & Where to Eat",
            description: `El Grito Sep 12-13 at Grant Park and the 26th Street Parade, plus taco, margarita and tequila deals at ${totalVenues} venues across Pilsen, Little Village and the rest of Chicagoland.`,
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
        <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-4 text-xs text-muted-foreground lg:px-6">
          <Link href="/" className="hover:text-brand-500">Home</Link>
          {" / "}
          <Link href="/guides" className="hover:text-brand-500">Guides</Link>
          {" / "}
          <span className="text-foreground">Mexican Independence Day Chicago</span>
        </nav>

        <header className="mx-auto max-w-7xl px-4 pt-6 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-950 dark:text-green-300">Sep 12 &ndash; 16, 2026</span>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">El Grito &middot; 26th St Parade</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Mexican Independence Day in Chicago: El Grito, the Parade &amp; Where to Eat
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Chicago throws one of the largest Mexican Independence celebrations outside Mexico. El Grito
            takes over Grant Park September 12 and 13, the 26th Street Parade fills Little Village that
            Sunday, and the neighborhoods that carry the culture year-round, Pilsen, La Villita, Back of
            the Yards, run specials all week. Here is what is happening, plus the taco, margarita and
            tequila deals running right now across the city and suburbs.
          </p>
        </header>

        {/* What's happening */}
        <section className="mx-auto max-w-7xl px-4 pt-8 lg:px-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">What&apos;s happening</h2>
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

        {/* Anchor neighborhoods */}
        {anchors.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">Pilsen, Little Village &amp; the Southwest Side</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              The heart of it. Taquerias, cantinas and panaderias with deals running now.
            </p>
            <div className="mt-4 grid gap-6 md:grid-cols-3">
              {anchors.map((g) => (
                <div key={g.slug} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      <Link href={`/neighborhoods/${g.slug}`} className="hover:text-brand-500">{g.name}</Link>
                    </h3>
                    <span className="text-xs text-muted-foreground">{g.venues.length} spots</span>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {g.venues.slice(0, 8).map((v) => (
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
                    href={`/neighborhoods/${g.slug}`}
                    className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    All {g.name} deals &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Citywide */}
        {others.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <div className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground">Around the rest of the city and suburbs</h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((g) => (
                <div key={g.slug} className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-bold text-foreground">
                    <Link href={`/neighborhoods/${g.slug}`} className="hover:text-brand-500">{g.name}</Link>
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{g.venues.length} spots with deals</p>
                  <ul className="mt-2 space-y-1.5">
                    {g.venues.slice(0, 3).map((v) => (
                      <li key={v.id} className="text-xs leading-snug text-muted-foreground line-clamp-1">
                        <Link href={v.venue_slug ? `/venues/${v.venue_slug}` : "#"} className="font-medium text-foreground hover:text-brand-500">
                          {v.venue_name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fallback when the deal pool is thin */}
        {totalVenues === 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Fiesta specials post closer to the weekend. In the meantime, browse{" "}
              <Link href="/deals/taco-tuesday" className="text-brand-600 hover:underline dark:text-brand-400">Taco Tuesday deals</Link>,{" "}
              <Link href="/deals/margarita-deals" className="text-brand-600 hover:underline dark:text-brand-400">margarita specials</Link>, or the{" "}
              <Link href="/neighborhoods/pilsen" className="text-brand-600 hover:underline dark:text-brand-400">Pilsen</Link> and{" "}
              <Link href="/neighborhoods/little-village" className="text-brand-600 hover:underline dark:text-brand-400">Little Village</Link>{" "}
              neighborhood pages.
            </p>
          </section>
        )}

        {/* Drink specials CTA */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <Martini className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Margaritas, micheladas &amp; tequila</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Fiesta week is the best margarita hunting of the year outside Cinco de Mayo. Tuesdays stay the
            single biggest day for taco and marg pricing citywide, so if you are planning around the
            parade weekend, a Tuesday run before or after it usually beats the crowds.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/deals/taco-tuesday" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Taco Tuesday</Link>
            <Link href="/deals/margarita-deals" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Margarita Deals</Link>
            <Link href="/cuisine/mexican" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">All Mexican Restaurants</Link>
            <Link href="/neighborhoods/pilsen" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Pilsen</Link>
            <Link href="/neighborhoods/little-village" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Little Village</Link>
            <Link href="/guides/cinco-de-mayo-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Cinco de Mayo Guide</Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-7xl px-4 pt-10 lg:px-6">
          <div className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Mexican Independence Day FAQ</h2>
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
            headline="Find tacos and margaritas near you"
            subtitle="Search live Mexican food and drink deals by neighborhood or suburb."
            cta={{ label: "Search taco deals", href: "/search?q=taco" }}
            links={[
              { label: "Margaritas", href: "/search?q=margarita" },
              { label: "Pilsen", href: "/neighborhoods/pilsen" },
              { label: "Little Village", href: "/neighborhoods/little-village" },
              { label: "Deals today", href: "/today" },
            ]}
          />
          <div className="mt-8">
            <EmailSignup
              source="mexican-independence-guide"
              headline="Get Chicago's best taco and margarita deals weekly"
              subtitle="One email every Thursday with the best food and drink deals for the weekend, city and suburbs. Free, unsubscribe anytime."
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
