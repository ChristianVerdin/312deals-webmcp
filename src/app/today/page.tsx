import Link from "next/link"
import type { Metadata } from "next"
import { CalendarDays, Store, Tag, HelpCircle } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { SortableDealsGrid } from "@/components/sortable-deals-grid"
import { SearchBar } from "@/components/search-bar"
import { EmailSignup } from "@/components/email-signup"
import type { Deal, SearchResponse } from "@/lib/types"
import {
  DEAL_TYPE_PAGES,
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildFaqJsonLd,
  uniqueVenueCount,
  topVenueNames,
} from "@/lib/seo-utils"

// ISR, not force-dynamic. force-dynamic disables the route cache outright,
// which also voided the `revalidate` on the deals fetch below -- every visitor
// paid a live backend round-trip, and a cold Railway container turned that into
// an 18s timeout (observed 2026-08-22). 10 minutes matches the homepage: fresh
// enough for a "today" page, and one unlucky empty render expires quickly.
export const revalidate = 600

const API_URL = process.env.API_URL || "http://localhost:8000"
const PAGE_URL = "https://www.312deals.com/today"

// Chicago weekday, recomputed on each revalidation so the midnight rollover is
// reflected within 10 minutes. Server-side date is fine for a listing page.
function chicagoWeekday(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  }).format(new Date())
}

async function getTodayDeals(): Promise<Deal[]> {
  try {
    const res = await fetch(
      // min_quality keeps recency from promoting thin listings — same floor as
      // the homepage recency surfaces (active-now, showcase, recent-deals).
      `${API_URL}/api/v1/deals/search?day=today&sort=recently_updated&min_quality=35&limit=50`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

export const metadata: Metadata = {
  title: "Chicago Food Deals Today, Happy Hours & Specials Near You | 312Deals",
  description:
    "Chicago food deals happening today: happy hours, daily specials, and day-of-the-week deals at bars and restaurants across the city and suburbs. Updated daily.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Chicago Food Deals Today | 312Deals",
    description:
      "Every food & drink deal live in Chicago today, updated daily across the city and suburbs.",
    url: PAGE_URL,
    siteName: "312Deals",
    type: "website",
    images: [
      {
        url: `https://www.312deals.com/api/og?${new URLSearchParams({
          title: "Chicago Food Deals Today",
          subtitle: "Happy hours, daily specials & more",
        })}`,
        width: 1200,
        height: 630,
        alt: "Chicago food deals today",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chicago Food Deals Today | 312Deals",
    description: "Every food & drink deal live in Chicago today.",
  },
}

export default async function TodayPage() {
  const weekday = chicagoWeekday()
  const deals = await getTodayDeals()
  const venueCount = uniqueVenueCount(deals)
  const topVenues = topVenueNames(deals)

  // Day-of-the-week deal-type pages that match today (e.g. Taco Tuesday on
  // Tuesdays), derived from the DEAL_TYPE_PAGES config so it stays in sync.
  const todaysDayTypes = Object.entries(DEAL_TYPE_PAGES).filter(
    ([, c]) => (c as { day?: string }).day === weekday.toLowerCase()
  )

  const faqItems = deals.length > 0
    ? [
        {
          q: "What food deals are available in Chicago today?",
          a: `There ${deals.length === 1 ? "is" : "are"} ${deals.length}+ deal${deals.length !== 1 ? "s" : ""} live today at ${venueCount} bar${venueCount !== 1 ? "s" : ""} and restaurant${venueCount !== 1 ? "s" : ""} across Chicago and the suburbs, including happy hours, daily specials${todaysDayTypes.length > 0 ? `, and ${weekday} deals like ${todaysDayTypes.map(([, c]) => c.label).join(" and ")}` : ""}.${topVenues.length > 0 ? ` Popular spots today include ${topVenues.join(", ")}.` : ""}`,
        },
        {
          q: `What deals are on in Chicago on ${weekday}?`,
          a: todaysDayTypes.length > 0
            ? `${weekday}s are big for ${todaysDayTypes.map(([, c]) => c.label).join(" and ")} in Chicago. Browse every deal running today, or filter by neighborhood and deal type.`
            : `Browse every food & drink deal running in Chicago today, filterable by neighborhood, cuisine, and deal type.`,
        },
        {
          q: "How do I find deals near me today?",
          a: "Use the search bar to filter today's deals by neighborhood or search your area. Every deal on 312Deals is verified and refreshed regularly, so what you see is live today.",
        },
      ]
    : []

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          {/* JSON-LD */}
          {deals.length > 0 && (
            <>
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(
                    buildBreadcrumbJsonLd([
                      { name: "Home", url: "https://www.312deals.com" },
                      { name: "Today's Deals", url: PAGE_URL },
                    ])
                  ),
                }}
              />
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(
                    buildItemListJsonLd("Chicago Food & Drink Deals Today", PAGE_URL, deals)
                  ),
                }}
              />
              {faqItems.length > 0 && (
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{
                    __html: JSON.stringify(buildFaqJsonLd(faqItems)),
                  }}
                />
              )}
            </>
          )}

          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-foreground">Today's Deals</span>
          </nav>

          {/* Header */}
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h1 className="text-2xl font-bold text-foreground">
                Chicago Food &amp; Drink Deals Today
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {deals.length > 0
                ? `${deals.length}+ deals live this ${weekday} at ${venueCount} bars and restaurants across Chicago and the suburbs.`
                : `Loading today's Chicago deals.`}
            </p>
          </div>

          {/* Above-the-fold search, captures intent before mobile bounce */}
          <div className="mb-6">
            <SearchBar />
          </div>

          {/* Today's day-of-week featured deal types */}
          {todaysDayTypes.length > 0 && (
            <div className="mb-8 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                Big on {weekday}
              </p>
              <div className="flex flex-wrap gap-2">
                {todaysDayTypes.map(([slug, c]) => (
                  <Link
                    key={slug}
                    href={`/deals/${slug}`}
                    className="rounded-full border border-brand-300 bg-card px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-900"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Stats bar */}
          {deals.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{venueCount}</span> venues
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{deals.length}+</span> deals today
                </span>
              </div>
            </div>
          )}

          {/* Deals grid */}
          <h2 className="sr-only">Today's Chicago Deals</h2>
          {deals.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No deals loaded right now, browse the full corpus of live Chicago deals.
              </p>
              <Link
                href="/deals"
                className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                Browse all deals
              </Link>
            </div>
          ) : (
            <SortableDealsGrid deals={deals} />
          )}

          {/* Newsletter capture */}
          <div className="mt-10">
            <EmailSignup
              source="today"
              headline="Today's best Chicago deals, in your inbox"
              subtitle="The week's best happy hours, daily specials, and hidden gems, hand-picked every Thursday, free, unsubscribe anytime."
            />
          </div>

          {/* Browse by deal type */}
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Browse Chicago Deals by Type
            </h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/deals"
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-400"
              >
                All Deal Types
              </Link>
              {["happy-hours", "daily-specials", "brunch-deals", "late-night", "taco-tuesday", "wing-deals"]
                .filter((slug) => DEAL_TYPE_PAGES[slug])
                .map((slug) => (
                  <Link
                    key={slug}
                    href={`/deals/${slug}`}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    {DEAL_TYPE_PAGES[slug].label}
                  </Link>
                ))}
            </div>
          </div>

          {/* FAQ */}
          {faqItems.length > 0 && (
            <div className="mt-12 rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <HelpCircle className="h-5 w-5" aria-hidden="true" />
                Frequently Asked Questions
              </h2>
              <dl className="space-y-4">
                {faqItems.map((item, i) => (
                  <div key={i}>
                    <dt className="text-sm font-semibold text-foreground">{item.q}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
