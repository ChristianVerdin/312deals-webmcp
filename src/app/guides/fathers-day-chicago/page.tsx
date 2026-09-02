import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Beef, Flame, Calendar } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getFathersDayDeals(): Promise<Deal[]> {
  const queries = ["father", "dad", "steakhouse", "steak", "bourbon", "whiskey", "ribs", "brisket", "patio"]
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

function isFathersDayDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /father['']?s\s*day|dad['']?s\s*day|fathers\s*day/.test(text)
}

function isSteakhouseDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""} ${d.venue_name ?? ""}`.toLowerCase()
  return /steakhouse|\bsteak\b|porterhouse|ribeye|filet/.test(text)
}

function isBourbonDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /bourbon|whiskey|rye\b|scotch|old fashioned|manhattan/.test(text)
}

export const metadata: Metadata = {
  title: "Father's Day Chicago 2026, Steakhouses, BBQ & Bourbon Bars",
  description:
    "Every Father's Day food and drink deal in Chicago for Sunday June 15, 2026. Steakhouse reservations, BBQ specials, bourbon bars, and patio brunches from River North to the suburbs. Book early.",
  openGraph: {
    title: "Father's Day Chicago 2026 | 312Deals",
    description:
      "Steakhouse, BBQ, bourbon and patio brunch deals across Chicago for Father's Day Sunday June 15, 2026. Every spot mapped by neighborhood.",
    url: `${SITE_URL}/guides/fathers-day-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Father%27s+Day+Chicago+2026&subtitle=Steakhouses%2C+BBQ+%26+bourbon+bars`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Father's Day Chicago 2026 | 312Deals",
    description: "Steakhouse, BBQ, bourbon & patio brunch deals for Father's Day in Chicago.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/fathers-day-chicago`,
  },
}

export default async function FathersDayGuide() {
  const allDeals = await getFathersDayDeals()
  const fathersDayDeals = allDeals.filter(isFathersDayDeal)
  const steakhouseDeals = allDeals.filter((d) => !isFathersDayDeal(d) && isSteakhouseDeal(d))
  const bourbonDeals = allDeals.filter((d) => !isFathersDayDeal(d) && !isSteakhouseDeal(d) && isBourbonDeal(d))

  const totalDeals = fathersDayDeals.length
  const uniqueVenues = new Set(fathersDayDeals.map((d) => d.venue_name)).size

  // Group strict Father's Day deals by neighborhood
  const byHood = new Map<string, { name: string; slug: string; deals: Deal[] }>()
  for (const d of fathersDayDeals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = byHood.get(d.neighborhood_slug)
      if (existing) existing.deals.push(d)
      else byHood.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, deals: [d] })
    }
  }
  const neighborhoods = Array.from(byHood.values()).sort((a, b) => b.deals.length - a.deals.length)

  // Steakhouse shortlist, dedup by venue, max 2 per hood, cap 16
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
  const steakhouseShortlist = buildShortlist(steakhouseDeals, 12)
  const bourbonShortlist = buildShortlist(bourbonDeals, 8)

  const faqItems = [
    {
      q: "When is Father's Day 2026?",
      a: "Father's Day 2026 falls on Sunday, June 15. Top steakhouses and reservation-only rooms sell out 10–14 days in advance; book by Friday June 5 for the high-end Chicago spots.",
    },
    {
      q: "What are the best Father's Day deals in Chicago 2026?",
      a:
        totalDeals > 0
          ? `We're tracking ${totalDeals} Father's Day specials across ${uniqueVenues} Chicago venues. ${neighborhoods.slice(0, 3).map((n) => `${n.name} has ${n.deals.length} deals`).join(", ")}. Plus ${steakhouseDeals.length}+ steakhouse deals and ${bourbonDeals.length}+ bourbon and whiskey specials worth booking.`
          : `Father's Day deals drop in early June. Chicago's classic moves: steakhouse dinners (Chicago Cut, Mastro's, Morton's in River North; El Che in West Loop), BBQ at Smoque or Sanders, bourbon flights at Delilah's or Twain. Check back two weeks before June 15 for the full list.`,
    },
    {
      q: "Which Chicago steakhouses are best for Father's Day?",
      a: "River North dominates the high-end tier, Chicago Cut, Mastro's, RPM Steak, Maple & Ash. The Loop has Morton's Wacker Place and Smith & Wollensky-style classics. West Loop has El Che (Argentine asado) and Boeufhaus (French-influenced). Suburbs: Perry's in Vernon Hills, Rosebud Wheeling, Tomahawk BBQ Steakhouse.",
    },
    {
      q: "Where can I find Father's Day BBQ in Chicago?",
      a: "Smoque BBQ (Portage Park) is the Chicago BBQ benchmark. Sanders BBQ Supply Co. (Beverly) runs a rewards program worth signing up for. Briny Swine Smokehouse (Lincoln Park) holds up on the north side. The Levee (Belmont Cragin) does a $21.99 signature platter. Miller's Ale House (Schaumburg, Orland Park) runs $15.99 full-rack rib specials.",
    },
    {
      q: "Are there Father's Day brunch deals in Chicago?",
      a: "Yes, many steakhouses and patio spots run Father's Day brunch through 3 PM. Bottomless mimosa packages and prix fixe menus drop in the first week of June. The patio brunch play is strong if June 15 weather holds, River North rooftops, West Loop garden patios, and Logan Square beer gardens all run.",
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
                  { name: "Father's Day Chicago", url: `${SITE_URL}/guides/fathers-day-chicago` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
          />
          {fathersDayDeals.length > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(
                  buildItemListJsonLd(
                    "Father's Day Chicago Deals 2026",
                    `${SITE_URL}/guides/fathers-day-chicago`,
                    fathersDayDeals
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
                name: "Father's Day Chicago 2026",
                description: `${totalDeals} food and drink specials across ${uniqueVenues} Chicago venues for Father's Day Sunday June 15, 2026.`,
                startDate: "2026-06-15",
                endDate: "2026-06-15",
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
                url: `${SITE_URL}/guides/fathers-day-chicago`,
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "Father's Day Chicago 2026, Steakhouses, BBQ & Bourbon Bars",
                description: `${totalDeals} Father's Day food and drink specials across ${uniqueVenues} Chicago venues. Steakhouses, BBQ, bourbon bars, and patio brunches.`,
                url: `${SITE_URL}/guides/fathers-day-chicago`,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/fathers-day-chicago`,
                },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
                },
                image: `${SITE_URL}/api/og?title=Father%27s+Day+Chicago+2026&subtitle=Steakhouses%2C+BBQ+%26+bourbon+bars`,
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
              <span className="text-foreground">Father&apos;s Day Chicago</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Father&apos;s Day in Chicago 2026, Where Dad Actually Wants to Eat
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Father&apos;s Day falls on Sunday, June 15 this year. The high-end steakhouses book up by the first weekend of June.
              {totalDeals > 0 ? ` ${totalDeals} explicit Father's Day specials live across ${uniqueVenues} venues right now,` : " "}
              plus {steakhouseDeals.length}+ steakhouse deals, {bourbonDeals.length}+ bourbon and whiskey specials, and the full BBQ inventory from Memorial Day still running.
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Flame className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{totalDeals}</div>
              <div className="text-xs text-muted-foreground">Father&apos;s Day Specials</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beef className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{steakhouseDeals.length}+</div>
              <div className="text-xs text-muted-foreground">Steakhouse Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{uniqueVenues}</div>
              <div className="text-xs text-muted-foreground">Venues</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">June 15</div>
              <div className="text-xs text-muted-foreground">Sunday</div>
            </div>
          </div>

          {/* Booking window */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">The Booking Window</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Father&apos;s Day is one of the two heaviest reservation weekends of the year for Chicago steakhouses (Mother&apos;s Day is the other). The high-end rooms run tight:
            </p>
            <ul className="space-y-3 text-sm leading-relaxed text-foreground">
              <li>
                <strong>By Friday June 5</strong>, book the marquee steakhouses (Chicago Cut, Mastro&apos;s, RPM Steak, Maple &amp; Ash, El Che).
              </li>
              <li>
                <strong>By Wednesday June 11</strong>, book any reservation-only room for Saturday June 14 or Sunday June 15.
              </li>
              <li>
                <strong>Friday June 13</strong>, last realistic window for Saturday-night dinner. Sunday brunch still has walk-in capacity at most places.
              </li>
              <li>
                <strong>Saturday June 14 + Sunday June 15</strong>, walk-ins fine at neighborhood bars, patios, beer gardens. The smoke joints (Smoque, Sanders, Briny Swine) run normal lines.
              </li>
            </ul>
          </section>

          {/* Steakhouse shortlist */}
          {steakhouseShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">The Steakhouse Move</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Chicago steakhouse density is real. {steakhouseDeals.length}+ steakhouse deals running right now, top {steakhouseShortlist.length} below, max 2 per neighborhood.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {steakhouseShortlist.map((d) => (
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

          {/* Explicit Father's Day specials */}
          {neighborhoods.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Explicit Father&apos;s Day Specials</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Deals that name-check Father&apos;s Day specifically, most drop the first week of June and run May 30 through June 15.
              </p>
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

          {/* Bourbon shortlist */}
          {bourbonShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Bourbon &amp; Whiskey Bars</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                The dad-classic move when the steakhouse is booked solid. {bourbonDeals.length}+ bourbon and whiskey deals running this month.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {bourbonShortlist.map((d) => (
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
              Adjacent plays
            </h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/guides/patio-season-chicago"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🌞 Patio Season Guide, outdoor dinner spots
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
                🍻 Happy Hours, pre-dinner drinks
              </Link>
              <Link
                href="/guides/cubs-game-day-chicago"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                ⚾ Cubs Game Day, if it&apos;s a home weekend
              </Link>
            </div>
          </section>

          {/* Newsletter */}
          <section className="mb-12">
            <EmailSignup source="guide_fathers_day" />
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
              Live data from 312Deals, {totalDeals} Father&apos;s Day deals across {uniqueVenues} Chicago venues, plus {steakhouseDeals.length}+ steakhouse and {bourbonDeals.length}+ bourbon and whiskey deals running this month. Prices and availability change without notice; book the high-end rooms two weeks ahead. Last updated:{" "}
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
