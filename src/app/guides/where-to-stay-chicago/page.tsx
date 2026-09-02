import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { Hotel, MapPin, Utensils, Beer } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { BookingCTA } from "@/components/booking-cta"
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo-utils"
import type { SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

type Landmark = { label: string; href: string; external?: boolean }

type Hood = {
  slug: string
  name: string
  /** Booking.com search URL, uses ss + lat/lng so geographic filter survives even when text-search would silently fall back to a nearby neighborhood (Wicker Park → Lincoln Park bug). */
  bookingDest: string
  blurb: string
  whyHere: string
  walkTo: Landmark[]
}

/** Booking ss-only search collapses Wicker Park → Lincoln Park silently because Booking
 *  has fewer Wicker Park listings. Pinning lat/lng forces a true geographic filter. */
function bookingUrl(name: string, lat: number, lng: number): string {
  const ss = encodeURIComponent(`${name}, Chicago, IL, USA`)
  return `https://www.booking.com/searchresults.html?ss=${ss}&latitude=${lat}&longitude=${lng}`
}

// Hand-curated neighborhoods where lodging intent + 312Deals food/drink coverage overlap.
// Order = recommendation strength for an out-of-towner.
const NEIGHBORHOODS: Hood[] = [
  {
    slug: "river-north",
    name: "River North",
    bookingDest: bookingUrl("River North", 41.8923, -87.6309),
    blurb:
      "The hotel district. Steakhouses, rooftops, and a dense restaurant grid bordered by the Chicago River and Mag Mile.",
    whyHere:
      "Closest neighborhood to Navy Pier and the Mag Mile, walkable to the Loop, and packed with lodging at every price tier. Best default if you don't know Chicago well.",
    walkTo: [
      { label: "Magnificent Mile", href: "https://themagnificentmile.com/", external: true },
      { label: "Navy Pier", href: "https://navypier.org/", external: true },
      { label: "Wrigley Building", href: "https://en.wikipedia.org/wiki/Wrigley_Building", external: true },
      { label: "Riverwalk", href: "https://www.chicagoriverwalk.us/", external: true },
    ],
  },
  {
    slug: "the-loop",
    name: "The Loop",
    bookingDest: bookingUrl("The Loop", 41.8786, -87.6251),
    blurb:
      "Downtown core. Theater district, Millennium Park, and the convention-friendly hotel cluster around State Street.",
    whyHere:
      "Best for business travelers, anyone visiting McCormick Place, or theater/sports tourists. Train-accessible to literally everywhere.",
    walkTo: [
      { label: "Millennium Park", href: "https://www.chicago.gov/city/en/depts/dca/supp_info/millennium_park.html", external: true },
      { label: "Cloud Gate (the Bean)", href: "https://en.wikipedia.org/wiki/Cloud_Gate", external: true },
      { label: "Art Institute", href: "https://www.artic.edu/", external: true },
      { label: "Theater District", href: "https://en.wikipedia.org/wiki/Chicago_Loop_Theater_District", external: true },
      { label: "Willis Tower", href: "https://www.willistower.com/", external: true },
    ],
  },
  {
    slug: "streeterville",
    name: "Streeterville",
    bookingDest: bookingUrl("Streeterville", 41.8929, -87.6178),
    blurb:
      "Lakefront wedge between the river and Oak Street Beach. Big-name hotels, Northwestern hospital corridor, Mag Mile shopping at the doorstep.",
    whyHere:
      "Picks up where River North ends. Walking distance to Navy Pier without dealing with the tourist sprawl. Lakefront views from upper floors.",
    walkTo: [
      { label: "Navy Pier", href: "https://navypier.org/", external: true },
      { label: "Magnificent Mile", href: "https://themagnificentmile.com/", external: true },
      { label: "Oak Street Beach", href: "https://www.chicagoparkdistrict.com/parks-facilities/oak-street-beach", external: true },
      { label: "Museum of Contemporary Art", href: "https://mcachicago.org/", external: true },
    ],
  },
  {
    slug: "west-loop",
    name: "West Loop",
    bookingDest: bookingUrl("West Loop", 41.8829, -87.6489),
    blurb:
      "Restaurant Row on Randolph Street. Old meatpacking district turned dining destination, Girl & the Goat, Au Cheval, Avec, Maple & Ash, the rest.",
    whyHere:
      "Best food neighborhood in the city if you're traveling specifically to eat. Walkable to the United Center and a short ride to downtown.",
    walkTo: [
      { label: "Restaurant Row", href: "/neighborhoods/west-loop" },
      { label: "United Center", href: "https://www.unitedcenter.com/", external: true },
      { label: "Fulton Market", href: "https://en.wikipedia.org/wiki/Fulton_Market_District", external: true },
      { label: "Soho House Chicago", href: "https://www.sohohousechicago.com/", external: true },
    ],
  },
  {
    slug: "wicker-park",
    name: "Wicker Park",
    bookingDest: bookingUrl("Wicker Park", 41.9088, -87.6796),
    blurb:
      "Bars, dive bars, divier bars. Music venues, indie shops, and the densest happy-hour grid west of Lake Shore Drive.",
    whyHere:
      "Best base for nightlife travelers and anyone who wants neighborhood character over hotel-district polish. Blue Line gets you downtown in 15 minutes.",
    walkTo: [
      { label: "Six Corners", href: "https://en.wikipedia.org/wiki/Wicker_Park,_Chicago#Six_Corners", external: true },
      { label: "The 606 Trail", href: "https://www.the606.org/", external: true },
      { label: "Empty Bottle", href: "https://www.emptybottle.com/", external: true },
      { label: "Big Star", href: "https://bigstarchicago.com/", external: true },
      { label: "Subterranean", href: "https://subt.net/", external: true },
    ],
  },
  {
    slug: "lincoln-park",
    name: "Lincoln Park",
    bookingDest: bookingUrl("Lincoln Park", 41.9214, -87.6513),
    blurb:
      "Brownstone-lined streets, the zoo, the lakefront. Quieter than downtown, denser with brunch spots than anywhere else in the city.",
    whyHere:
      "Best for couples, families, and anyone who wants a residential feel without giving up walkability. Easy on a stroller. Easy on a hangover.",
    walkTo: [
      { label: "Lincoln Park Zoo", href: "https://www.lpzoo.org/", external: true },
      { label: "North Avenue Beach", href: "https://www.chicagoparkdistrict.com/parks-facilities/north-avenue-beach", external: true },
      { label: "DePaul University", href: "https://www.depaul.edu/", external: true },
      { label: "Halsted bar strip", href: "/happy-hours/lincoln-park" },
    ],
  },
  {
    slug: "wrigleyville",
    name: "Wrigleyville",
    bookingDest: bookingUrl("Wrigleyville", 41.9484, -87.6553),
    blurb:
      "Centered on Wrigley Field. Sports bars on every corner, game-day energy from April through October, hotels purpose-built for Cubs travelers.",
    whyHere:
      "Required if you're here for a Cubs game. Skippable for everything else, you're 30+ minutes from downtown and rooms spike on home-game weekends.",
    walkTo: [
      { label: "Wrigley Field", href: "https://www.mlb.com/cubs/ballpark", external: true },
      { label: "Gallagher Way", href: "https://gallagherway.com/", external: true },
      { label: "Murphy's Bleachers", href: "https://murphysbleachers.com/", external: true },
      { label: "Sluggers", href: "https://sluggersbar.com/", external: true },
    ],
  },
]

async function getDealCountByNeighborhood(slug: string): Promise<number> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?neighborhood=${slug}&limit=1`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return 0
    const data: SearchResponse = await res.json()
    return data.total ?? data.count ?? 0
  } catch {
    return 0
  }
}

export const metadata: Metadata = {
  title: "Where to Stay in Chicago by Neighborhood (2026) | 312Deals",
  description:
    "Honest neighborhood-by-neighborhood guide to where to stay in Chicago. River North, the Loop, Wicker Park, Lincoln Park, and more, picked for food, drink, and walkability.",
  openGraph: {
    title: "Where to Stay in Chicago by Neighborhood | 312Deals",
    description:
      "Honest neighborhood-by-neighborhood guide to where to stay in Chicago, picked for food, drink, and walkability.",
    url: `${SITE_URL}/guides/where-to-stay-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Where+to+Stay+in+Chicago&subtitle=Neighborhood-by-neighborhood+lodging+guide`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Where to Stay in Chicago by Neighborhood | 312Deals",
    description:
      "Neighborhood-by-neighborhood lodging guide for Chicago, picked for food, drink, and walkability.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/where-to-stay-chicago`,
  },
}

export default async function WhereToStayChicago() {
  const counts = await Promise.all(
    NEIGHBORHOODS.map((h) => getDealCountByNeighborhood(h.slug))
  )
  const hoods = NEIGHBORHOODS.map((h, i) => ({ ...h, deals: counts[i] }))
  const totalDeals = hoods.reduce((sum, h) => sum + h.deals, 0)

  const faqItems = [
    {
      q: "What's the best neighborhood to stay in Chicago for first-time visitors?",
      a: "River North. It's the closest residential-feeling neighborhood to the Magnificent Mile and Navy Pier, sits across the river from the Loop, and has the deepest hotel inventory at every price point. You'll be walking distance to most of what tourists actually came to see.",
    },
    {
      q: "Where should I stay if I'm visiting Chicago to eat?",
      a: "West Loop. Randolph Street's Restaurant Row, Girl & the Goat, Au Cheval, Avec, Aba, Maple & Ash, is the highest concentration of nationally-known restaurants in the Midwest. You'll be 10 minutes from downtown and walkable to the United Center.",
    },
    {
      q: "Where should I stay for a Cubs game?",
      a: "Wrigleyville, but only if Cubs baseball is the main reason you're in town. Hotels in the neighborhood book up early and price up fast on home-game weekends. If the Cubs game is one of several things on your trip, stay in Lincoln Park or River North and take the Red Line to Addison, it's a 15-minute ride.",
    },
    {
      q: "What's the best neighborhood for nightlife in Chicago?",
      a: "Wicker Park for indie bars, music venues, and a younger crowd. River North or Streeterville for upscale rooftops and clubbier energy. West Loop sits in between, strong cocktail bars without the bachelorette-party density of River North.",
    },
    {
      q: "Is it worth staying outside downtown to save money?",
      a: "Sometimes. Lincoln Park and Wicker Park can be 20-40% cheaper than River North or the Loop on the same nights and are both a 15-20 minute train ride downtown. You give up some walkability but gain a more residential, less touristy experience.",
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
                  { name: "Where to Stay in Chicago", url: `${SITE_URL}/guides/where-to-stay-chicago` },
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
                "headline": "Where to Stay in Chicago by Neighborhood (2026)",
                "description":
                  "Neighborhood-by-neighborhood lodging guide for Chicago, picked for food, drink, and walkability.",
                "url": `${SITE_URL}/guides/where-to-stay-chicago`,
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/where-to-stay-chicago`,
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
                "datePublished": "2026-05-06",
                "dateModified": new Date().toISOString().split("T")[0],
              }),
            }}
          />

          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <span className="text-foreground">Where to Stay in Chicago</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Where to Stay in Chicago by Neighborhood
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              We track {totalDeals.toLocaleString()}+ active food and drink deals across the seven neighborhoods most travelers
              actually want to stay in. This guide picks lodging neighborhoods the way a local would, by what's
              walkable from the front door, not by hotel-brand prestige.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Each neighborhood section links to filtered Booking.com results so you can compare hotels in that
              specific area instead of generic &ldquo;Chicago&rdquo; results.
            </p>
          </header>

          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Hotel className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{hoods.length}</div>
              <div className="text-xs text-muted-foreground">Neighborhoods</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Utensils className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{totalDeals.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Active Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">
                {hoods.find((h) => h.slug === "wicker-park")?.deals ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">Wicker Park Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">
                {hoods.find((h) => h.slug === "west-loop")?.deals ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">West Loop Deals</div>
            </div>
          </div>

          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">Quick Pick by Trip Type</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" aria-label="Best Chicago neighborhood by trip type">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">If you're here for...</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Stay in</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border"><td className="px-4 py-3">First-time tourist trip</td><td className="px-4 py-3 font-medium">River North</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Restaurant-focused weekend</td><td className="px-4 py-3 font-medium">West Loop</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Cubs game</td><td className="px-4 py-3 font-medium">Wrigleyville</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Bachelorette / nightlife</td><td className="px-4 py-3 font-medium">Wicker Park or River North</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Couples / quiet weekend</td><td className="px-4 py-3 font-medium">Lincoln Park</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-3">Business / convention</td><td className="px-4 py-3 font-medium">The Loop</td></tr>
                  <tr><td className="px-4 py-3">Lakefront views</td><td className="px-4 py-3 font-medium">Streeterville</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {hoods.map((h) => (
            <section key={h.slug} className="mb-12">
              <h2 className="mb-2 text-2xl font-bold text-foreground">
                <Link href={`/neighborhoods/${h.slug}`} className="hover:text-brand-600 dark:hover:text-brand-400">
                  {h.name}
                </Link>
              </h2>
              <Link href={`/neighborhoods/${h.slug}`} className="group relative mb-3 block aspect-[2/1] w-full overflow-hidden rounded-xl border border-border">
                <Image
                  src={`/neighborhood-photos/${h.slug}.jpg`}
                  alt={h.name}
                  fill
                  className="object-cover transition-transform group-hover:scale-[1.02]"
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              </Link>
              <p className="mb-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{h.deals.toLocaleString()}</span> active food &amp; drink deals tracked here
              </p>
              <p className="mb-3 text-base leading-relaxed text-foreground">{h.blurb}</p>
              <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Why stay here: </span>{h.whyHere}
              </p>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Walking distance to: </span>
                {h.walkTo.map((lm, idx) => (
                  <span key={lm.href}>
                    {lm.external ? (
                      <a
                        href={lm.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {lm.label}
                      </a>
                    ) : (
                      <Link
                        href={lm.href}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {lm.label}
                      </Link>
                    )}
                    {idx < h.walkTo.length - 1 && ", "}
                  </span>
                ))}
              </p>

              <BookingCTA
                campaign={`where_to_stay_${h.slug.replace(/-/g, "_")}`}
                destination={h.bookingDest}
                headline={`Hotels in ${h.name}`}
                subhead={`See available stays in ${h.name} on Booking.com, free cancellation on most rooms.`}
                ctaLabel={`See ${h.name} hotels →`}
              />

              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Link
                  href={`/neighborhoods/${h.slug}`}
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  See {h.name} deals →
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  href={`/happy-hours/${h.slug}`}
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  {h.name} happy hours →
                </Link>
              </div>
            </section>
          ))}

          <section className="mb-12 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold text-foreground">Frequently Asked Questions</h2>
            <dl className="space-y-4">
              {faqItems.map((item, i) => (
                <div key={i}>
                  <dt className="text-sm font-semibold text-foreground">{item.q}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">About This Guide</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Neighborhood picks are based on walkability, lodging inventory, and the food/drink scene we track at 312Deals.
              Booking.com links above are affiliate links, if you book through them, 312Deals earns a small commission at
              no extra cost to you. Hotel availability and prices are set by Booking.com and the hotels themselves.
              Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
