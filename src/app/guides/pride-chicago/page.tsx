import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Sparkles, Calendar, PartyPopper } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getPrideDeals(): Promise<Deal[]> {
  const queries = ["pride", "drag", "brunch", "happy hour", "Halsted", "Andersonville", "Lakeview"]
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

function isPrideDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /\bpride\b|rainbow|lgbtq|gay\s*pride/.test(text)
}

function isDragDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /\bdrag\b|rupaul|rpdr|burlesque/.test(text)
}

function isBoystownVenue(d: Deal): boolean {
  // Halsted corridor (Lakeview/Wrigleyville Northalsted) + venue cues
  const slug = (d.neighborhood_slug ?? "").toLowerCase()
  const text = `${d.venue_name ?? ""}`.toLowerCase()
  return (
    slug === "lakeview" ||
    slug === "wrigleyville" ||
    slug === "andersonville" ||
    /roscoe|sidetrack|splash|kit\s*kat|elixir|replay|drew|hydrate|north\s*end|charlie/.test(text)
  )
}

export const metadata: Metadata = {
  title: "Pride Chicago 2026, Drag Brunches, Halsted Bars & Parade Weekend",
  description:
    "Every Pride Month food and drink deal in Chicago for June 2026. Drag brunches, Halsted corridor bars, Andersonville restaurants, and Pride Parade weekend (Sun June 28) coverage. Boystown, Lakeview, and beyond.",
  openGraph: {
    title: "Pride Chicago 2026 | 312Deals",
    description:
      "Drag brunches, Halsted bars, and Pride Parade weekend deals across Chicago for June 2026. Boystown, Lakeview, Andersonville mapped.",
    url: `${SITE_URL}/guides/pride-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Pride+Chicago+2026&subtitle=Drag+brunches%2C+Halsted+bars+%26+parade+weekend`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pride Chicago 2026 | 312Deals",
    description: "Drag brunches, Halsted bars, and Pride Parade weekend deals across Chicago for June 2026.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/pride-chicago`,
  },
}

export default async function PrideChicagoGuide() {
  const allDeals = await getPrideDeals()
  const prideDeals = allDeals.filter(isPrideDeal)
  const dragDeals = allDeals.filter((d) => !isPrideDeal(d) && isDragDeal(d))
  const boystownDeals = allDeals.filter(
    (d) => !isPrideDeal(d) && !isDragDeal(d) && isBoystownVenue(d)
  )

  const totalDeals = prideDeals.length
  const uniqueVenues = new Set(prideDeals.map((d) => d.venue_name)).size

  // Group strict Pride deals by neighborhood
  const byHood = new Map<string, { name: string; slug: string; deals: Deal[] }>()
  for (const d of prideDeals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = byHood.get(d.neighborhood_slug)
      if (existing) existing.deals.push(d)
      else byHood.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, deals: [d] })
    }
  }
  const neighborhoods = Array.from(byHood.values()).sort((a, b) => b.deals.length - a.deals.length)

  // Shortlist builder, dedup by venue, max 2 per hood, cap N
  function buildShortlist(pool: Deal[], cap = 16): Deal[] {
    const out: Deal[] = []
    const seenVenue = new Set<string>()
    const hoodCount = new Map<string, number>()
    for (const d of pool) {
      if (!d.venue_slug || seenVenue.has(d.venue_slug)) continue
      const k = d.neighborhood_slug || "_"
      if ((hoodCount.get(k) ?? 0) >= 2) continue
      seenVenue.add(d.venue_slug)
      hoodCount.set(k, (hoodCount.get(k) ?? 0) + 1)
      out.push(d)
      if (out.length >= cap) break
    }
    return out
  }
  const dragShortlist = buildShortlist(dragDeals, 12)
  const boystownShortlist = buildShortlist(boystownDeals, 12)

  const faqItems = [
    {
      q: "When is Chicago Pride Parade 2026?",
      a: "Chicago Pride Parade is Sunday, June 28, 2026, the last Sunday of Pride Month. The route runs through Lakeview / Boystown along Halsted Street, with the largest crowds at Belmont, Addison, and Roscoe. The parade typically steps off around noon.",
    },
    {
      q: "What are the best Pride deals in Chicago 2026?",
      a:
        totalDeals > 0
          ? `${totalDeals} explicit Pride specials are live across ${uniqueVenues} Chicago venues. ${neighborhoods.slice(0, 3).map((n) => `${n.name} has ${n.deals.length} deals`).join(", ")}. Plus ${dragDeals.length}+ drag brunches and ${boystownDeals.length}+ Halsted-corridor venues running standard happy hour and weekly specials throughout June.`
          : `Pride deals typically drop the first week of June. Reliable plays: drag brunches at Kit Kat Lounge (Lakeview), Lips Restaurant (South Loop), and Replay (Andersonville). Standard happy hours run all month at Roscoe's Tavern, Sidetrack, Hydrate, and SPLASH on Halsted.`,
    },
    {
      q: "Where is Boystown / Northalsted in Chicago?",
      a: "Boystown, officially renamed Northalsted in 2020, is the Halsted Street corridor in Lakeview, roughly Belmont Avenue (3200N) to Grace Street (3800N). It's North America's oldest officially recognized gay village. The Center on Halsted at 3656 N Halsted is the community anchor.",
    },
    {
      q: "What are the best drag brunches in Chicago?",
      a: "Kit Kat Lounge (Lakeview, 3700 N Halsted) runs the longest-standing drag brunch in the city. Lips Restaurant (South Loop, 2229 S Michigan) and Replay (Andersonville, 5358 N Clark) round out the top three. For weekly drag programming beyond brunch: SPLASH (Lakeview) runs RuPaul's Drag Race viewing parties; Way Out (Logan Square) does monthly drag-and-burlesque shows.",
    },
    {
      q: "Where can I watch the Pride Parade with a drink in hand?",
      a: "Halsted Street bars open early on parade Sunday, most by 10 AM. Sidetrack, Roscoe's, Hydrate, and SPLASH all have patios or sidewalk seating along the route. Note: capacity fills by 9:30 AM at the marquee spots; arrive early or commit to a brunch reservation at one of the Boystown restaurants for guaranteed access.",
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
                  { name: "Pride Chicago", url: `${SITE_URL}/guides/pride-chicago` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
          />
          {prideDeals.length > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(
                  buildItemListJsonLd(
                    "Pride Chicago Deals 2026",
                    `${SITE_URL}/guides/pride-chicago`,
                    prideDeals
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
                name: "Chicago Pride Month 2026",
                description: `Pride Month food and drink deals across Chicago, drag brunches, Halsted bars, and Pride Parade weekend coverage. Parade is Sunday June 28, 2026.`,
                startDate: "2026-06-01",
                endDate: "2026-06-30",
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                eventStatus: "https://schema.org/EventScheduled",
                location: {
                  "@type": "Place",
                  name: "Northalsted (Boystown), Lakeview, Chicago",
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: "Chicago",
                    addressRegion: "IL",
                    addressCountry: "US",
                  },
                },
                organizer: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                url: `${SITE_URL}/guides/pride-chicago`,
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "Pride Chicago 2026, Drag Brunches, Halsted Bars & Parade Weekend",
                description: `${totalDeals} Pride Month food and drink specials across ${uniqueVenues} Chicago venues. Drag brunches, Halsted-corridor bars, Andersonville restaurants, parade weekend coverage.`,
                url: `${SITE_URL}/guides/pride-chicago`,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/pride-chicago`,
                },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
                },
                image: `${SITE_URL}/api/og?title=Pride+Chicago+2026&subtitle=Drag+brunches%2C+Halsted+bars+%26+parade+weekend`,
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
              <span className="text-foreground">Pride Chicago</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Pride Chicago 2026, Drag Brunches, Halsted Bars &amp; Parade Weekend
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Pride Month runs all of June, with the Chicago Pride Parade on Sunday, June 28. The center of gravity is
              Halsted Street in Lakeview, Northalsted, the official-since-2020 name for what most still call Boystown.
              {totalDeals > 0 ? ` ${totalDeals} explicit Pride specials are live across ${uniqueVenues} venues right now,` : " "}
              plus {dragDeals.length}+ drag brunches and {boystownDeals.length}+ Halsted-corridor venues running through June.
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <PartyPopper className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{totalDeals}</div>
              <div className="text-xs text-muted-foreground">Pride Specials</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{dragDeals.length}+</div>
              <div className="text-xs text-muted-foreground">Drag Brunches &amp; Shows</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{boystownDeals.length}+</div>
              <div className="text-xs text-muted-foreground">Halsted-Corridor Venues</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">June 28</div>
              <div className="text-xs text-muted-foreground">Pride Parade Sunday</div>
            </div>
          </div>

          {/* The shape of Pride Month */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">The Shape of Pride Month</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Pride in Chicago isn&apos;t one weekend, it&apos;s a full month with the parade as the climax. Three
              distinct rhythms:
            </p>
            <ul className="space-y-3 text-sm leading-relaxed text-foreground">
              <li>
                <strong>Weekends 1–3 (June 6–21):</strong> Drag brunches every Saturday and Sunday, neighborhood pride
                kickoffs, themed cocktail menus. Andersonville Midsommarfest typically runs the second weekend.
              </li>
              <li>
                <strong>Pride Weekend (June 26–28):</strong> Halsted Market Days-style street energy. Bars open early,
                stay packed late. Reservations evaporate by Thursday.
              </li>
              <li>
                <strong>Parade Sunday (June 28):</strong> Lakeview is closed to cars along the route. Take the Red Line
                to Belmont or Addison, walk in. Bars in the parade zone hit capacity by 10 AM.
              </li>
            </ul>
          </section>

          {/* Drag Shortlist */}
          {dragShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Drag Brunches &amp; Shows</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Year-round drag programming worth booking during Pride Month. {dragDeals.length}+ in the index, top
                {" "}{dragShortlist.length} below, max 2 per neighborhood.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {dragShortlist.map((d) => (
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

          {/* Halsted/Boystown Shortlist */}
          {boystownShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Halsted Corridor &amp; Boystown</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Standard happy hours and weekly specials at venues along Northalsted (Lakeview), in Andersonville, and at
                LGBTQ+-anchored spots elsewhere. {boystownDeals.length}+ in the index, top {boystownShortlist.length}{" "}
                below, max 2 per neighborhood.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {boystownShortlist.map((d) => (
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

          {/* Explicit Pride Specials */}
          {neighborhoods.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Explicit Pride Specials by Neighborhood</h2>
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
              Plan around Pride Month
            </h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/neighborhoods/lakeview"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🏳️‍🌈 Lakeview (Boystown), all deals
              </Link>
              <Link
                href="/neighborhoods/andersonville"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                📍 Andersonville, all deals
              </Link>
              <Link
                href="/guides/best-brunch-chicago"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🥂 Best Brunch Chicago
              </Link>
              <Link
                href="/deals/happy-hours"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🍻 Happy Hours
              </Link>
            </div>
          </section>

          {/* Newsletter */}
          <section className="mb-12">
            <EmailSignup source="guide_pride_chicago" />
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
              Live data from 312Deals, {totalDeals} Pride Month deals across {uniqueVenues} Chicago venues, plus
              {" "}{dragDeals.length}+ drag programming and {boystownDeals.length}+ Halsted-corridor venues running
              standard specials this month. Prices and availability change without notice; call ahead for parade-weekend
              reservations. Last updated:{" "}
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
