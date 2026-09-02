import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Sun, Flame, Calendar } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getMemorialDealsRaw(): Promise<Deal[]> {
  const queries = ["memorial", "bbq", "ribs", "brisket", "smoked", "patio", "rooftop", "long weekend"]
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

function isMemorialDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /memorial\s*day|long\s*weekend|holiday\s*weekend/.test(text)
}

function isBbqDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /\bbbq\b|barbecue|ribs|brisket|smoked|pulled\s*pork|pitmaster/.test(text)
}

export const metadata: Metadata = {
  title: "Memorial Day Weekend Chicago 2026, BBQ, Patio & Rooftop Specials",
  description:
    "Every Memorial Day weekend food and drink deal in Chicago for 2026. BBQ specials, patio kickoffs, rooftop brunches, and holiday hours from River North to Logan Square. May 23–26.",
  openGraph: {
    title: "Memorial Day Weekend Chicago 2026 | 312Deals",
    description:
      "BBQ specials, patio kickoffs, and rooftop brunches across Chicago for Memorial Day weekend 2026. Every deal mapped by neighborhood.",
    url: `${SITE_URL}/guides/memorial-day-weekend-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Memorial+Day+Weekend+Chicago+2026&subtitle=BBQ%2C+patio+%26+rooftop+specials`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Memorial Day Weekend Chicago 2026 | 312Deals",
    description: "BBQ, patio & rooftop specials across Chicago for Memorial Day weekend 2026.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/memorial-day-weekend-chicago`,
  },
}

export default async function MemorialDayGuide() {
  const allDeals = await getMemorialDealsRaw()
  const memorialDeals = allDeals.filter(isMemorialDeal)
  const bbqDeals = allDeals.filter((d) => !isMemorialDeal(d) && isBbqDeal(d))

  const totalDeals = memorialDeals.length
  const uniqueVenues = new Set(memorialDeals.map((d) => d.venue_name)).size

  // Group strict Memorial Day deals by neighborhood
  const byHood = new Map<string, { name: string; slug: string; deals: Deal[] }>()
  for (const d of memorialDeals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = byHood.get(d.neighborhood_slug)
      if (existing) existing.deals.push(d)
      else byHood.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, deals: [d] })
    }
  }
  const neighborhoods = Array.from(byHood.values()).sort((a, b) => b.deals.length - a.deals.length)

  // BBQ shortlist, dedupe by venue, cap at 16, max 2 per hood
  const bbqShortlist: Deal[] = []
  const bbqSeenVenue = new Set<string>()
  const bbqHoodCount = new Map<string, number>()
  for (const d of bbqDeals) {
    if (!d.venue_slug || bbqSeenVenue.has(d.venue_slug)) continue
    const k = d.neighborhood_slug || "_"
    if ((bbqHoodCount.get(k) ?? 0) >= 2) continue
    bbqSeenVenue.add(d.venue_slug)
    bbqHoodCount.set(k, (bbqHoodCount.get(k) ?? 0) + 1)
    bbqShortlist.push(d)
    if (bbqShortlist.length >= 16) break
  }

  const faqItems = [
    {
      q: "When is Memorial Day 2026?",
      a: "Memorial Day 2026 falls on Monday, May 25, giving Chicago a three-day weekend from Saturday May 23 through Monday May 25. Most restaurants run weekend-long specials; bars run Sunday and Monday daytime deals.",
    },
    {
      q: "What are the best Memorial Day weekend deals in Chicago 2026?",
      a:
        totalDeals > 0
          ? `We're tracking ${totalDeals} Memorial Day weekend specials across ${uniqueVenues} Chicago venues right now. ${neighborhoods.slice(0, 3).map((n) => `${n.name} has ${n.deals.length} deals`).join(", ")}. Plus ${bbqDeals.length}+ year-round BBQ specials worth a visit.`
          : "Memorial Day specials drop late in the week. Expect $3 bottled beers and $3 shot specials at neighborhood bars like Halligan in Lincoln Park, BBQ events at Edgewater's ANVIL Bar, and meal-kit pickups from Bistro Campagne. Check back Thursday for the full live list.",
    },
    {
      q: "Which Chicago patios are open for Memorial Day weekend?",
      a: "Most patios are open by Memorial Day, it's the unofficial start of patio season in Chicago. River North rooftops, Logan Square beer gardens, Wicker Park sidewalk seating, and West Loop dinner patios all run. Browse our live patio guide for the full inventory of 9,500+ outdoor deals.",
    },
    {
      q: "Are restaurants open on Memorial Day Monday?",
      a: "Most restaurants and bars are open on Memorial Day, often with abbreviated holiday hours. Brunch-focused spots typically open by 10 AM; full-service dinner runs as normal. Call ahead for the high-end rooms, many run reduced staffing on Monday afternoons.",
    },
    {
      q: "Where can I get BBQ in Chicago for Memorial Day?",
      a: "Smoque BBQ in Portage Park is the city benchmark. Sanders BBQ Supply Co. (Beverly), Briny Swine Smokehouse (Lincoln Park), and The Levee (Belmont Cragin) all run weekend specials. Miller's Ale House runs full-rack rib specials Monday–Tuesday at $15.99, Memorial Day falls right on the deal day.",
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
                  { name: "Memorial Day Weekend Chicago", url: `${SITE_URL}/guides/memorial-day-weekend-chicago` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
          />
          {memorialDeals.length > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(
                  buildItemListJsonLd(
                    "Memorial Day Weekend Chicago Deals 2026",
                    `${SITE_URL}/guides/memorial-day-weekend-chicago`,
                    memorialDeals
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
                name: "Memorial Day Weekend Chicago 2026",
                description: `${totalDeals} food and drink specials across ${uniqueVenues} Chicago venues for Memorial Day weekend 2026.`,
                startDate: "2026-05-23",
                endDate: "2026-05-25",
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                eventStatus: "https://schema.org/EventScheduled",
                location: {
                  "@type": "City",
                  name: "Chicago",
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: "Chicago",
                    addressRegion: "IL",
                    addressCountry: "US",
                  },
                },
                organizer: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                url: `${SITE_URL}/guides/memorial-day-weekend-chicago`,
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "Memorial Day Weekend Chicago 2026, Where to Eat, Drink, and Sit Outside",
                description: `${totalDeals} Memorial Day weekend food and drink specials across ${uniqueVenues} Chicago venues. BBQ, patio kickoffs, and rooftop brunches mapped by neighborhood.`,
                url: `${SITE_URL}/guides/memorial-day-weekend-chicago`,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/memorial-day-weekend-chicago`,
                },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
                },
                image: `${SITE_URL}/api/og?title=Memorial+Day+Weekend+Chicago+2026&subtitle=BBQ%2C+patio+%26+rooftop+specials`,
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
              <span className="text-foreground">Memorial Day Weekend Chicago</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Memorial Day Weekend in Chicago, Where to Eat, Drink, and Sit Outside
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Memorial Day 2026 lands on Monday May 25, a full three-day weekend (May 23–25) and the
              unofficial kickoff of Chicago patio season. {totalDeals > 0 ? `${totalDeals} Memorial Day specials across ${uniqueVenues} venues are live now, ` : ""}
              plus {bbqDeals.length}+ BBQ specials and 9,500+ patio deals running all weekend.
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Flame className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{totalDeals}</div>
              <div className="text-xs text-muted-foreground">Memorial Day Specials</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{uniqueVenues}</div>
              <div className="text-xs text-muted-foreground">Venues</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Sun className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{bbqDeals.length}+</div>
              <div className="text-xs text-muted-foreground">BBQ Specials</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">May 23–25</div>
              <div className="text-xs text-muted-foreground">3-day weekend</div>
            </div>
          </div>

          {/* Weekend shape */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">The Weekend Shape</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Three days, three rhythms. Plan around the weather and book the high-end rooms by Thursday.
            </p>
            <ul className="space-y-3 text-sm leading-relaxed text-foreground">
              <li>
                <strong>Saturday May 23, Patio Saturday.</strong> Rooftops in River North, beer gardens in
                Logan Square, sidewalk patios in Wicker Park. If it&apos;s sunny, the whole city is outside
                by 1 PM.
              </li>
              <li>
                <strong>Sunday May 24, Brunch into late afternoon.</strong> Slower start, longer linger.
                The day for an 11 AM table and a 4 PM second drink.
              </li>
              <li>
                <strong>Monday May 25, The actual holiday.</strong> BBQ specials at restaurants and bars,
                cookouts at home for everyone else. Many spots run abbreviated holiday hours.
              </li>
            </ul>
          </section>

          {/* Neighborhood pill grid */}
          {neighborhoods.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Neighborhoods with Memorial Day Specials</h2>
              <div className="flex flex-wrap gap-2">
                {neighborhoods.map((nh) => (
                  <Link
                    key={nh.slug}
                    href={`/neighborhoods/${nh.slug}`}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-foreground"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>{nh.name}</span>
                    <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground group-hover:bg-brand-500/15 group-hover:text-brand-600 dark:group-hover:text-brand-300">
                      {nh.deals.length}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Memorial Day deals by neighborhood */}
          {neighborhoods.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Memorial Day Deals by Neighborhood</h2>
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

          {/* BBQ shortlist */}
          {bbqShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">BBQ Specials Worth a Memorial Day Visit</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Year-round BBQ deals running this weekend, ribs, brisket, pulled pork, smoked everything.
                {bbqDeals.length}+ in the index, top {bbqShortlist.length} below (max 2 per neighborhood).
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {bbqShortlist.map((d) => (
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

          {/* Cross-links */}
          <section className="mb-12 rounded-xl border border-brand-300/40 bg-brand-50/40 dark:bg-brand-950/20 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
              Plan the rest of the weekend
            </h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/guides/patio-season-chicago"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🌞 Patio Season Guide, 9,500+ outdoor deals
              </Link>
              <Link
                href="/deals/brunch-deals"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🥂 Brunch Deals, Sunday lineup
              </Link>
              <Link
                href="/deals/happy-hours"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🍻 Happy Hours, Saturday into Monday
              </Link>
              <Link
                href="/blog/memorial-day-chicago-2026"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                📖 The longer read, Memorial Day in Chicago
              </Link>
            </div>
          </section>

          {/* Newsletter */}
          <section className="mb-12">
            <EmailSignup source="guide_memorial_day" />
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
              Live data from 312Deals, {totalDeals} Memorial Day weekend deals across {uniqueVenues} Chicago venues,
              refreshed from venue websites and verified within the last week. Prices and availability change without
              notice; call ahead for the high-traffic spots. Last updated:{" "}
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
