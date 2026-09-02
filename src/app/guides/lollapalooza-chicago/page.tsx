import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Music, Calendar, Moon } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getLollaDeals(): Promise<Deal[]> {
  const queries = [
    "lollapalooza",
    "lolla",
    "grant park",
    "south loop",
    "loop",
    "west loop",
    "late night",
    "brunch",
  ]
  const all = new Map<number, Deal>()
  await Promise.all(
    queries.map(async (q) => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/deals/search?q=${encodeURIComponent(q)}&limit=200`,
          { next: { revalidate: 3600 } }
        )
        if (!res.ok) return
        const data: SearchResponse = await res.json()
        for (const d of data.deals ?? []) if (!all.has(d.id)) all.set(d.id, d)
      } catch {
        // ignore
      }
    })
  )
  return Array.from(all.values())
}

function isLollaDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /lollapalooza|\blolla\b|grant\s*park\s*fest/.test(text)
}

function isGrantParkAdjacent(d: Deal): boolean {
  const slug = (d.neighborhood_slug ?? "").toLowerCase()
  return slug === "the-loop" || slug === "south-loop" || slug === "west-loop" || slug === "streeterville"
}

function isLateNight(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /late\s*night|2\s*am|midnight|after\s*hours/.test(text) || d.deal_type === "late_night"
}

function isBrunch(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /brunch|mimosa|bottomless/.test(text) || d.deal_type === "brunch_deal"
}

export const metadata: Metadata = {
  title: "Lollapalooza Chicago 2026, Restaurants, Late Night & Recovery Brunch",
  description:
    "Every Lollapalooza food and drink deal in Chicago Thu Jul 30 - Sun Aug 2, 2026. Grant Park-adjacent restaurants, late-night spots after sets, recovery brunches across the Loop, South Loop, and West Loop.",
  openGraph: {
    title: "Lollapalooza Chicago 2026 | 312Deals",
    description:
      "Grant Park-adjacent restaurants, late-night food, and recovery brunches for Lolla 2026 (Thu Jul 30 - Sun Aug 2).",
    url: `${SITE_URL}/guides/lollapalooza-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Lollapalooza+Chicago+2026&subtitle=Restaurants%2C+late+night+%26+recovery+brunch`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lollapalooza Chicago 2026 | 312Deals",
    description: "Restaurants near Grant Park + late night + recovery brunch for Lolla 2026.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/lollapalooza-chicago`,
  },
}

export default async function LollapaloozaGuide() {
  const allDeals = await getLollaDeals()
  const lollaDeals = allDeals.filter(isLollaDeal)
  const grantParkDeals = allDeals.filter(
    (d) => !isLollaDeal(d) && isGrantParkAdjacent(d)
  )
  const lateNightDeals = allDeals.filter(
    (d) => !isLollaDeal(d) && !isGrantParkAdjacent(d) && isLateNight(d)
  )
  const brunchDeals = allDeals.filter(
    (d) => !isLollaDeal(d) && !isGrantParkAdjacent(d) && !isLateNight(d) && isBrunch(d)
  )

  const totalDeals = lollaDeals.length
  const uniqueVenues = new Set(lollaDeals.map((d) => d.venue_name)).size

  const byHood = new Map<string, { name: string; slug: string; deals: Deal[] }>()
  for (const d of lollaDeals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = byHood.get(d.neighborhood_slug)
      if (existing) existing.deals.push(d)
      else byHood.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, deals: [d] })
    }
  }
  const neighborhoods = Array.from(byHood.values()).sort((a, b) => b.deals.length - a.deals.length)

  function buildShortlist(pool: Deal[], cap = 12): Deal[] {
    const out: Deal[] = []
    const seenVenue = new Set<string>()
    const hoodCount = new Map<string, number>()
    for (const d of pool) {
      if (!d.venue_slug || seenVenue.has(d.venue_slug)) continue
      const k = d.neighborhood_slug || "_"
      if ((hoodCount.get(k) ?? 0) >= 3) continue
      seenVenue.add(d.venue_slug)
      hoodCount.set(k, (hoodCount.get(k) ?? 0) + 1)
      out.push(d)
      if (out.length >= cap) break
    }
    return out
  }
  const grantParkShortlist = buildShortlist(grantParkDeals, 16)
  const lateNightShortlist = buildShortlist(lateNightDeals, 10)
  const brunchShortlist = buildShortlist(brunchDeals, 10)

  const faqItems = [
    {
      q: "When is Lollapalooza 2026?",
      a: "Lollapalooza 2026 runs Thursday July 30 through Sunday August 2 in Grant Park, Chicago. Gates typically open around 11 AM each day; headliner sets run until 10 PM. Daily attendance is 100,000+, so all Loop and South Loop restaurants run at capacity from 9 AM open through midnight close.",
    },
    {
      q: "What restaurants are closest to Grant Park for Lollapalooza?",
      a: "The Loop, South Loop, and Streeterville are the three nearest neighborhoods to Grant Park (within 10-min walk of festival gates). West Loop is a 15-min walk west and has the densest dinner-quality option. Avoid driving, all Lolla traffic is routed via Red Line (Roosevelt, Harrison, Jackson) and Blue Line (Monroe, Jackson).",
    },
    {
      q: "Where can I get late-night food after Lollapalooza sets?",
      a: "Late-night spots near Grant Park stay open well past midnight during Lolla. South Loop has Chicago Curry House, Ronnie's Steakhouse, and Eleven City Diner running late. The Loop diner cluster (Tempo, Lou Mitchell's, Plymouth Restaurant) runs 24-hour or 2 AM service. Lou Malnati's, Giordano's, and Pizano's all have Loop locations open past midnight for deep dish.",
    },
    {
      q: "Where's the best recovery brunch after Lollapalooza?",
      a: "Recovery brunches the morning after Lolla are concentrated in West Loop (Athena, Avec, Bonci) and the Loop/South Loop (Eleven City Diner, Chicago Curry House, Tempo). For something further out and quieter, Wicker Park (Big Star, Map Room) and Logan Square (Lula Cafe, Longman & Eagle) absorb the recovery crowd Sunday + Monday.",
    },
    {
      q: "Should I book Lollapalooza restaurant reservations in advance?",
      a: "Yes. Festival-week dinner reservations book out 2-3 weeks ahead. Loop hotels (Hilton Chicago, Palmer House, Renaissance Blackstone) sell their restaurants out earliest because they pre-package with Lolla VIP rooms. Walk-in is fine for pre-festival lunch (11 AM - 1 PM) and post-festival late night (after 11 PM), the crush window is 5 PM - 10 PM.",
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
                  { name: "Lollapalooza Chicago", url: `${SITE_URL}/guides/lollapalooza-chicago` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
          />
          {lollaDeals.length > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(
                  buildItemListJsonLd(
                    "Lollapalooza Chicago Deals 2026",
                    `${SITE_URL}/guides/lollapalooza-chicago`,
                    lollaDeals
                  )
                ),
              }}
            />
          )}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Event",
                name: "Lollapalooza Chicago 2026 (Restaurant Companion)",
                description: `${totalDeals} restaurant + bar specials across ${uniqueVenues} Chicago venues during Lollapalooza 2026 (Thu Jul 30 - Sun Aug 2).`,
                startDate: "2026-07-30",
                endDate: "2026-08-02",
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
                url: `${SITE_URL}/guides/lollapalooza-chicago`,
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "Lollapalooza Chicago 2026, Restaurants, Late Night & Recovery Brunch",
                description: `${totalDeals} food and drink specials across ${uniqueVenues} Chicago venues during Lollapalooza 2026. Grant Park-adjacent restaurants, late-night food, and recovery brunches.`,
                url: `${SITE_URL}/guides/lollapalooza-chicago`,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/lollapalooza-chicago`,
                },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
                },
                image: `${SITE_URL}/api/og?title=Lollapalooza+Chicago+2026&subtitle=Restaurants%2C+late+night+%26+recovery+brunch`,
                datePublished: "2026-05-19",
                dateModified: new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
              <span>/</span>
              <Link href="/guides" className="transition-colors hover:text-foreground">Guides</Link>
              <span>/</span>
              <span className="text-foreground">Lollapalooza Chicago</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Lollapalooza Chicago 2026, Restaurants, Late Night &amp; Recovery Brunch
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Lollapalooza runs Thursday July 30 through Sunday August 2 in Grant Park. 100,000+ daily attendance means every Loop and South Loop restaurant runs at capacity from 9 AM through midnight.
              {totalDeals > 0 ? ` ${totalDeals} explicit Lolla specials live across ${uniqueVenues} venues right now,` : " "}
              plus {grantParkDeals.length}+ Grant-Park-adjacent restaurants, {lateNightDeals.length}+ late-night spots after sets, and {brunchDeals.length}+ recovery brunches.
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Music className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{totalDeals}</div>
              <div className="text-xs text-muted-foreground">Lolla Specials</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{grantParkDeals.length}+</div>
              <div className="text-xs text-muted-foreground">Grant Park-Adjacent</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Moon className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{lateNightDeals.length}+</div>
              <div className="text-xs text-muted-foreground">Late Night</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">Jul 30–Aug 2</div>
              <div className="text-xs text-muted-foreground">Thu–Sun</div>
            </div>
          </div>

          {/* The Festival Logistics */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">The Festival Restaurant Map</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Three concentric rings around Grant Park, each with a different dining rhythm:
            </p>
            <ul className="space-y-3 text-sm leading-relaxed text-foreground">
              <li>
                <strong>Inside the park (festival food):</strong> Chow Town vendors only. Cash-equivalent
                (Lolla wristband chip). Expect $15+ for a basic plate; great for variety, bad for value.
              </li>
              <li>
                <strong>Within 10-min walk (the rush ring):</strong> The Loop, South Loop, Streeterville.
                These restaurants run at 110% capacity during the festival; reservations 2-3 weeks ahead.
                Hotels in this ring (Hilton Chicago, Palmer House, Renaissance Blackstone) sell out earliest.
              </li>
              <li>
                <strong>15-30 min away (the calm ring):</strong> West Loop, River North, Wicker Park, Pilsen.
                Worth the L ride or short rideshare. Better food, lower prices, walk-in tolerant.
              </li>
              <li>
                <strong>The recovery ring:</strong> Logan Square, Andersonville, Lincoln Park for Sunday +
                Monday brunch. Locals' neighborhoods that absorb the morning-after crowd.
              </li>
            </ul>
          </section>

          {/* Grant Park-Adjacent Shortlist */}
          {grantParkShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Grant Park-Adjacent Restaurants</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Loop / South Loop / Streeterville / West Loop venues within walking distance of festival
                gates. {grantParkDeals.length}+ in the index, top {grantParkShortlist.length} below.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {grantParkShortlist.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <Link
                      href={`/venues/${d.venue_slug}`}
                      className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                    >
                      {d.venue_name}
                    </Link>
                    {d.neighborhood && (
                      <span className="ml-2 text-xs text-muted-foreground">{d.neighborhood}</span>
                    )}
                    <p className="mt-0.5 text-sm text-foreground">{d.title}</p>
                    {d.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Late-Night Shortlist */}
          {lateNightShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Late-Night After Sets</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Spots running past 10 PM headliner-set end. Diners, pizza places, and post-show kitchens
                worth knowing. {lateNightDeals.length}+ in the index, top {lateNightShortlist.length} below.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {lateNightShortlist.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <Link
                      href={`/venues/${d.venue_slug}`}
                      className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                    >
                      {d.venue_name}
                    </Link>
                    {d.neighborhood && (
                      <span className="ml-2 text-xs text-muted-foreground">{d.neighborhood}</span>
                    )}
                    <p className="mt-0.5 text-sm text-foreground">{d.title}</p>
                    {d.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Recovery Brunch Shortlist */}
          {brunchShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Recovery Brunch (Sat, Sun &amp; Mon)</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Brunches running through Lolla weekend. Bottomless mimosas, big-portion plates, the works.
                {brunchDeals.length}+ in the index, top {brunchShortlist.length} below.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {brunchShortlist.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <Link
                      href={`/venues/${d.venue_slug}`}
                      className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                    >
                      {d.venue_name}
                    </Link>
                    {d.neighborhood && (
                      <span className="ml-2 text-xs text-muted-foreground">{d.neighborhood}</span>
                    )}
                    <p className="mt-0.5 text-sm text-foreground">{d.title}</p>
                    {d.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Explicit Lolla Specials */}
          {neighborhoods.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Explicit Lollapalooza Specials</h2>
              <div className="space-y-6">
                {neighborhoods.map((nh) => (
                  <div key={nh.slug}>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">
                      <Link href={`/neighborhoods/${nh.slug}`} className="hover:text-brand-600 dark:hover:text-brand-400">
                        {nh.name}
                      </Link>
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({nh.deals.length} {nh.deals.length === 1 ? "deal" : "deals"})
                      </span>
                    </h3>
                    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {nh.deals.map((d) => (
                        <li key={d.id} className="px-4 py-3">
                          <Link
                            href={`/venues/${d.venue_slug}`}
                            className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                          >
                            {d.venue_name}
                          </Link>
                          <p className="mt-0.5 text-sm text-foreground">{d.title}</p>
                          {d.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{d.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Cross-links */}
          <section className="mb-12 rounded-xl border border-brand-300/40 bg-brand-50/40 dark:bg-brand-950/20 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
              Plan around the festival
            </h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/neighborhoods/the-loop"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                📍 The Loop, closest to Grant Park
              </Link>
              <Link
                href="/neighborhoods/south-loop"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                📍 South Loop, south gate access
              </Link>
              <Link
                href="/deals/late-night"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🌙 Late Night Deals
              </Link>
              <Link
                href="/deals/brunch-deals"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🥂 Brunch Deals, Sun/Mon recovery
              </Link>
            </div>
          </section>

          {/* Newsletter */}
          <section className="mb-12">
            <EmailSignup source="guide_lollapalooza" />
          </section>

          {/* FAQ */}
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

          {/* About */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">About This Guide</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Live data from 312Deals, {totalDeals} Lollapalooza-related deals across {uniqueVenues} Chicago venues,
              plus {grantParkDeals.length}+ Grant Park-adjacent restaurants, {lateNightDeals.length}+ late-night,
              and {brunchDeals.length}+ recovery-brunch options. Prices and availability change without notice;
              book festival-week reservations 2-3 weeks ahead. Last updated:{" "}
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
