import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Beer, Calendar, Compass } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { BookingCTA } from "@/components/booking-cta"
import { AskAILink } from "@/components/ask-ai-link"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getStPatDeals(): Promise<Deal[]> {
  const queries = ["patrick", "irish", "shamrock", "green beer", "paddy", "leprechaun"]
  const allDeals = new Map<number, Deal>()

  await Promise.all(
    queries.map(async (q) => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/deals/search?q=${encodeURIComponent(q)}&limit=200`,
          { next: { revalidate: 3600 } }
        )
        if (!res.ok) return
        const data: SearchResponse = await res.json()
        for (const deal of data.deals ?? []) {
          if (!allDeals.has(deal.id)) {
            allDeals.set(deal.id, deal)
          }
        }
      } catch {
        // skip failed queries
      }
    })
  )

  return Array.from(allDeals.values())
}

/** Only keep deals that are specifically about St. Patrick's Day */
function isStPatDeal(deal: Deal): boolean {
  const text = `${deal.title} ${deal.description ?? ""}`.toLowerCase()
  return /st\.?\s*pat|shamrock|green\s*beer|river\s*dye|river\s*dyi|paddy|leprechaun|luck.*irish|get\s*lucky|kegs?\s*(n|and)\s*egg|irish\s*(bash|fest)|goes?\s*green/.test(text)
}

/** Extract dates mentioned in deal title/description */
function extractDealDate(deal: Deal): string | null {
  const text = `${deal.title} ${deal.description ?? ""}`
  const match = text.match(
    /March\s+\d{1,2}(?:th|st|nd|rd)?(?:\s*[-–]\s*(?:March\s+)?\d{1,2}(?:th|st|nd|rd)?)?(?:,?\s*\d{4})?/i
  )
  return match ? match[0] : null
}

type VenueGroup = { venue_name: string; venue_slug: string; deals: Deal[] }

function groupByVenue(deals: Deal[]): VenueGroup[] {
  const map = new Map<string, VenueGroup>()
  for (const d of deals) {
    const key = d.venue_slug
    const existing = map.get(key)
    if (existing) {
      existing.deals.push(d)
    } else {
      map.set(key, { venue_name: d.venue_name, venue_slug: d.venue_slug, deals: [d] })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.deals.length - a.deals.length)
}

export const metadata: Metadata = {
  title: "St. Patrick's Day Chicago Deals 2026, 160+ Specials | 312Deals",
  description:
    "Every St. Patrick's Day food and drink deal in Chicago for 2026. 160+ specials across River North, Lakeview, The Loop, Lincoln Park, and more. Updated daily.",
  openGraph: {
    title: "St. Patrick's Day Chicago Deals 2026 | 312Deals",
    description:
      "160+ St. Patrick's Day food & drink specials across Chicago. River North, Lakeview, The Loop, Lincoln Park, and 30+ more neighborhoods.",
    url: `${SITE_URL}/guides/st-patricks-day-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=St.+Patrick%27s+Day+Chicago+Deals+2026&subtitle=160%2B+specials+across+73+neighborhoods`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "St. Patrick's Day Chicago Deals 2026 | 312Deals",
    description:
      "160+ St. Patrick's Day food & drink specials across Chicago. Every deal mapped by neighborhood.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/st-patricks-day-chicago`,
  },
}

export default async function StPatricksDayGuide() {
  const allDeals = await getStPatDeals()
  const deals = allDeals.filter(isStPatDeal)

  const totalDeals = deals.length
  const uniqueVenues = new Set(deals.map((d) => d.venue_name)).size

  // Group deals by neighborhood
  const byNeighborhood = new Map<
    string,
    { name: string; slug: string; deals: Deal[] }
  >()
  for (const d of deals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = byNeighborhood.get(d.neighborhood_slug)
      if (existing) {
        existing.deals.push(d)
      } else {
        byNeighborhood.set(d.neighborhood_slug, {
          name: d.neighborhood,
          slug: d.neighborhood_slug,
          deals: [d],
        })
      }
    }
  }
  const neighborhoods = Array.from(byNeighborhood.values()).sort(
    (a, b) => b.deals.length - a.deals.length
  )

  const faqItems = [
    {
      q: "What are the best St. Patrick's Day deals in Chicago 2026?",
      a: `We found ${totalDeals} St. Patrick's Day food and drink specials across ${uniqueVenues} Chicago venues. ${neighborhoods.slice(0, 3).map((n) => `${n.name} has ${n.deals.length} deals`).join(", ")}. Deals range from Irish beer specials and green cocktails to corned beef dinners and themed brunch events.`,
    },
    {
      q: "When is St. Patrick's Day 2026 in Chicago?",
      a: "St. Patrick's Day 2026 is Saturday, March 14. The Chicago River dyeing happens at 10 AM, and the downtown parade starts at noon on Columbus Drive. Many bars open as early as 7 AM for the celebration.",
    },
    {
      q: "Where is the Chicago River dyed green?",
      a: "The river is dyed green between Columbus Drive and Lake Shore Drive. Best viewing spots include the Michigan Avenue Bridge, Wacker Drive, and riverwalk restaurants. Many River North and Loop venues offer rooftop or riverside specials.",
    },
    {
      q: "What neighborhoods have the most St. Patrick's Day specials?",
      a: neighborhoods.length > 0
        ? `${neighborhoods[0].name} leads with ${neighborhoods[0].deals.length} specials, followed by ${neighborhoods.slice(1, 5).map((n) => `${n.name} (${n.deals.length})`).join(", ")}. Chicago's south side Irish neighborhoods like Beverly and Edison Park also have celebrations.`
        : "River North, Lakeview, The Loop, and Lincoln Park typically have the most St. Patrick's Day specials.",
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
                  {
                    name: "St. Patrick's Day Chicago",
                    url: `${SITE_URL}/guides/st-patricks-day-chicago`,
                  },
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
              __html: JSON.stringify(
                buildItemListJsonLd(
                  "St. Patrick's Day Chicago Deals 2026",
                  `${SITE_URL}/guides/st-patricks-day-chicago`,
                  deals
                )
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Event",
                name: "St. Patrick's Day Chicago 2026",
                description: `${totalDeals} food and drink specials across ${uniqueVenues} Chicago venues for St. Patrick's Day 2026.`,
                startDate: "2026-03-14",
                endDate: "2026-03-14",
                eventAttendanceMode:
                  "https://schema.org/OfflineEventAttendanceMode",
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
                organizer: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                },
                url: `${SITE_URL}/guides/st-patricks-day-chicago`,
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline:
                  "St. Patrick's Day Chicago Deals 2026, Every Special by Neighborhood",
                description: `${totalDeals} St. Patrick's Day food and drink specials across ${uniqueVenues} Chicago venues. Every deal mapped by neighborhood.`,
                url: `${SITE_URL}/guides/st-patricks-day-chicago`,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/st-patricks-day-chicago`,
                },
                author: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                },
                publisher: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                  logo: {
                    "@type": "ImageObject",
                    url: `${SITE_URL}/apple-touch-icon.png`,
                  },
                },
                image: `${SITE_URL}/api/og?title=St.+Patrick%27s+Day+Chicago+Deals+2026&subtitle=160%2B+specials+across+73+neighborhoods`,
                datePublished: "2026-03-09",
                dateModified: new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link
                href="/"
                className="transition-colors hover:text-foreground"
              >
                Home
              </Link>
              <span>/</span>
              <span className="text-foreground">
                St. Patrick&apos;s Day Chicago
              </span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              St. Patrick&apos;s Day Chicago Deals 2026
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By{" "}
              <span className="font-medium text-foreground">
                312Deals Team
              </span>{" "}
              · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              {totalDeals} St. Patrick&apos;s Day food &amp; drink specials
              across {uniqueVenues} venues and {neighborhoods.length}{" "}
              neighborhoods. From Irish pubs to rooftop bars, from $5 green
              beers to prix fixe corned beef dinners, every deal in one place.
              The river turns green Saturday March 14 at 10 AM.
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-green-600" />
              <div className="text-2xl font-bold text-foreground">
                {totalDeals}
              </div>
              <div className="text-xs text-muted-foreground">
                St. Pat&apos;s Deals
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-green-600" />
              <div className="text-2xl font-bold text-foreground">
                {uniqueVenues}
              </div>
              <div className="text-xs text-muted-foreground">Venues</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Compass className="mx-auto mb-2 h-6 w-6 text-green-600" />
              <div className="text-2xl font-bold text-foreground">
                {neighborhoods.length}
              </div>
              <div className="text-xs text-muted-foreground">
                Neighborhoods
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-green-600" />
              <div className="text-2xl font-bold text-foreground">Mar 14</div>
              <div className="text-xs text-muted-foreground">
                St. Patrick&apos;s Day
              </div>
            </div>
          </div>

          {/* River Dyeing Info */}
          <section className="mb-10 rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/30">
            <h2 className="mb-2 text-lg font-bold text-foreground">
              Chicago River Dyeing, Saturday March 14
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The Chicago River gets dyed green at <strong>10 AM</strong>{" "}
              between Columbus Drive and Lake Shore Drive. The downtown parade
              starts at <strong>noon</strong> on Columbus Drive. Many bars and
              restaurants open early with specials starting at 7-9 AM. Best
              viewing: Michigan Avenue Bridge, Wacker Drive, and riverwalk
              restaurants in River North and The Loop.
            </p>
          </section>

          {/* Deals by Neighborhood */}
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-foreground">
              St. Patrick&apos;s Day Deals by Neighborhood
            </h2>
            <div className="space-y-8">
              {neighborhoods.map((nh) => {
                const venues = groupByVenue(nh.deals)
                return (
                  <div key={nh.slug}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        <Link
                          href={`/neighborhoods/${nh.slug}`}
                          className="transition-colors hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          {nh.name}
                        </Link>
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          ({nh.deals.length}{" "}
                          {nh.deals.length === 1 ? "deal" : "deals"} at{" "}
                          {venues.length}{" "}
                          {venues.length === 1 ? "venue" : "venues"})
                        </span>
                      </h3>
                      <Link
                        href={`/neighborhoods/${nh.slug}`}
                        className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                      >
                        All {nh.name} deals
                      </Link>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-border">
                      {venues.slice(0, 15).map((venue, vi) => (
                        <div
                          key={venue.venue_slug}
                          className={
                            vi < Math.min(venues.length, 15) - 1
                              ? "border-b border-border"
                              : ""
                          }
                        >
                          <div className="flex items-baseline gap-2 bg-card px-4 py-2.5">
                            <Link
                              href={`/venues/${venue.venue_slug}`}
                              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                            >
                              {venue.venue_name}
                            </Link>
                            {venue.deals.length > 1 && (
                              <span className="text-xs text-muted-foreground">
                                {venue.deals.length} deals
                              </span>
                            )}
                          </div>
                          <div className="divide-y divide-border/50">
                            {venue.deals.map((deal) => {
                              const date = extractDealDate(deal)
                              return (
                                <div
                                  key={deal.id}
                                  className="flex flex-col gap-1 px-4 py-2 pl-6 sm:flex-row sm:items-start sm:gap-3"
                                >
                                  <div className="flex-1">
                                    <span className="text-sm text-foreground">
                                      {deal.title}
                                    </span>
                                    {deal.description && (
                                      <span className="hidden text-sm text-muted-foreground sm:inline">
                                        {", "}
                                        {deal.description}
                                      </span>
                                    )}
                                  </div>
                                  {date && (
                                    <span className="shrink-0 self-start rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                      {date}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                      {venues.length > 15 && (
                        <div className="border-t border-border bg-card px-4 py-2 text-center text-xs text-muted-foreground">
                          +{venues.length - 15} more venues in {nh.name}, {" "}
                          <Link
                            href={`/search?q=patrick+irish&neighborhood=${nh.slug}`}
                            className="text-brand-600 hover:underline dark:text-brand-400"
                          >
                            view all
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Quick Links */}
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-foreground">
              Jump to a Neighborhood
            </h2>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((nh) => (
                <Link
                  key={nh.slug}
                  href={`/neighborhoods/${nh.slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-green-300 hover:text-green-600"
                >
                  {nh.name} ({nh.deals.length})
                </Link>
              ))}
            </div>
          </section>

          {/* What to Know */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              St. Patrick&apos;s Day in Chicago: What to Know
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                Chicago celebrates St. Patrick&apos;s Day harder than almost any
                city in America. The tradition of dyeing the Chicago River green
                has been going on since 1962, and it draws hundreds of thousands
                of people downtown every year. In 2026, the festivities fall on
                Saturday, March 14, meaning bars and restaurants go all out.
              </p>
              <p>
                <strong>River North</strong> is ground zero with{" "}
                {byNeighborhood.get("river-north")?.deals.length ?? 33} deals,
                thanks to its concentration of bars along the riverwalk.{" "}
                <strong>Lakeview</strong> comes in second with{" "}
                {byNeighborhood.get("lakeview")?.deals.length ?? 25} specials,
                especially along Clark Street.{" "}
                <strong>The Loop</strong> and{" "}
                <strong>Lincoln Park</strong> round out the top four.
              </p>
              <p>
                Expect deals on Guinness, Jameson, Irish-themed cocktails, corned
                beef and cabbage, and shepherd&apos;s pie. Many venues host
                ticketed events with open bars and live music. Others run
                walk-in specials all day. Use our{" "}
                <Link
                  href="/search"
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  search
                </Link>{" "}
                to find exactly what you&apos;re looking for.
              </p>
            </div>
          </section>

          {/* Search CTA */}
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-foreground">
              Find St. Patrick&apos;s Day Deals Near You
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/search?q=patrick"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                Search All St. Pat&apos;s Deals
              </Link>
              <Link
                href="/map"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                View Deal Map
              </Link>
              <AskAILink
                page="/guides/st-patricks-day-chicago"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Ask AI About Deals
              </AskAILink>
            </div>
          </section>

          <BookingCTA
            campaign="st_pats_guide"
            headline="In town for the parade?"
            subhead="Find hotels close to the river-dyeing and parade route. Free cancellation on most rooms."
          />

          {/* FAQ */}
          <section className="mb-12 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold text-foreground">
              Frequently Asked Questions
            </h2>
            <dl className="space-y-4">
              {faqItems.map((item, i) => (
                <div key={i}>
                  <dt className="text-sm font-semibold text-foreground">
                    {item.q}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Email Signup */}
          <EmailSignup source="st-patricks-guide" />

          {/* About */}
          <section className="mt-8 mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              About This Guide
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This guide is based on data from 312Deals, which tracks{" "}
              {totalDeals}+ St. Patrick&apos;s Day deals across Chicago. Deals
              are scraped from restaurant websites and social media, then
              verified by our community. Prices and times may change without
              notice, always confirm with the venue directly. Last updated:{" "}
              {new Date().toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              .
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
