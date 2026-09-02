import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, MapPin, Store, Tag, TrendingUp, HelpCircle, Clock } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCard } from "@/components/deal-card"
import { ShowMore } from "@/components/show-more"
import { SearchBar } from "@/components/search-bar"
import type { Deal, SearchResponse } from "@/lib/types"
import {
  slugToName,
  formatTime,
  buildBreadcrumbJsonLd,
  buildCheapestDrink,
  buildItemListJsonLd,
  buildFaqJsonLd,
  uniqueVenueCount,
  topVenueNames,
} from "@/lib/seo-utils"
import { DEAL_TYPE_PAGES, CUISINE_PAGES } from "@/lib/seo-utils"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"

/**
 * Hood-specific intent callouts shown above the deals grid. Used when a hood's
 * happy-hour SERP traffic carries an extra intent that the generic template
 * doesn't satisfy, e.g. /happy-hours/wrigleyville is 92% bounce on 11 entries
 * because searchers expect Cubs game-day context, not a generic deal list.
 * Add a new entry here when an analytics audit surfaces another such hood.
 */
const HOOD_CALLOUTS: Record<string, {
  emoji: string
  badge: string
  headline: string
  body: string
  links: Array<{ label: string; href: string }>
}> = {
  wrigleyville: {
    emoji: "⚾",
    badge: "Heading to Wrigley?",
    headline: "Cubs game-day happy hours",
    body: "Wrigleyville happy hours run before, during, and after every Cubs home game. Most spots open by 11 AM on game day, with extended specials through the 7th inning.",
    links: [
      { label: "Cubs game day guide →", href: "/guides/cubs-game-day-chicago" },
      { label: "Kincade's, top-rated Wrigleyville bar", href: "/venues/kincades-wrigleyville" },
    ],
  },
}

async function getDeals(neighborhood: string): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?neighborhood=${neighborhood}&deal_type=happy_hour&limit=50`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

/**
 * Validate the slug corresponds to a real neighborhood. Returns true if the
 * neighborhood exists in our DB; false otherwise. Used to gate the page with
 * notFound() so fake/typoed slugs return HTTP 404 instead of an empty 200
 * (soft-404, hurts Mintlify Agent Score and Google indexing quality).
 */
async function hoodExists(neighborhood: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/neighborhoods/summary?neighborhood=${neighborhood}`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) return false
    const data = await res.json()
    // /api/v1/neighborhoods/summary returns { neighborhoods: [...], count: N }
    // and matches via LIKE on name OR slug, confirm at least one row has a
    // slug that's an exact match (otherwise "river" would falsely match
    // "river-north", "river-grove", etc.).
    const rows: Array<{ slug?: string }> = Array.isArray(data?.neighborhoods)
      ? data.neighborhoods
      : []
    return rows.some((r) => r?.slug === neighborhood)
  } catch {
    return false
  }
}

async function getOtherDrinkSpecials(neighborhood: string, excludeIds: Set<number>): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?neighborhood=${neighborhood}&limit=50`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    const all = data.deals ?? []
    const drinkKeywords = /\b(beer|wine|cocktail|margarita|bourbon|whiskey|mimosa|bloody|bellini|draft|pint|bucket|martini|shot|sangria|pitcher|tequila|vodka|rum|drink|spirit|liquor|bar)\b/i
    return all.filter((d) => {
      if (excludeIds.has(d.id)) return false
      const text = `${d.title ?? ""} ${d.description ?? ""}`
      return drinkKeywords.test(text)
    }).slice(0, 24)
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: { neighborhood: string }
}): Promise<Metadata> {
  const name = slugToName(params.neighborhood)
  const deals = await getDeals(params.neighborhood)
  const venueCount = uniqueVenueCount(deals)
  const cheapest = buildCheapestDrink(deals)

  const priceSnippet = cheapest ? `, Drinks from ${cheapest.split(" for ")[1]}` : ""
  const countSnippet = deals.length > 0 ? ` at ${venueCount}+ Bars` : ""
  const title = `${name} Happy Hours${priceSnippet}${countSnippet} | 312Deals`
  const truncatedTitle = title.length <= 60 ? title : `${name} Happy Hours${priceSnippet} | 312Deals`

  const topVenues = topVenueNames(deals, 3)
  const venueSnippet = topVenues.length > 0 ? ` Popular spots: ${topVenues.join(", ")}.` : ""
  // When HH inventory is thin, lean into broader "drink specials" intent for long-tail suburbs.
  const lowHH = deals.length > 0 && deals.length < 10
  const description = deals.length > 0
    ? lowHH
      ? `Happy hour and weekday drink specials in ${name}, Chicago${priceSnippet}. Beer buckets, wine nights, cocktail deals, and daily specials at ${name} bars and restaurants.${venueSnippet}`
      : `${deals.length} happy hour deals in ${name}, Chicago${priceSnippet}. After-work drink specials, cheap apps, and daily happy hours.${venueSnippet}`
    : `Find the best happy hour specials in ${name}, Chicago. Discounted drinks, appetizer deals, and after-work specials at bars and restaurants near you.`

  return {
    title: truncatedTitle,
    description,
    openGraph: {
      title: truncatedTitle,
      description,
      url: `https://www.312deals.com/happy-hours/${params.neighborhood}`,
      siteName: "312Deals",
      type: "website",
      images: [{
        url: `https://www.312deals.com/api/og?title=${encodeURIComponent(`Happy Hours in ${name}`)}&subtitle=${encodeURIComponent("Chicago Happy Hour Deals")}`,
        width: 1200,
        height: 630,
        alt: `Happy Hours in ${name}`,
      }],
    },
    alternates: {
      canonical: `https://www.312deals.com/happy-hours/${params.neighborhood}`,
    },
  }
}

export default async function NeighborhoodHappyHoursPage({
  params,
}: {
  params: { neighborhood: string }
}) {
  const { neighborhood } = params

  // Gate fake slugs with HTTP 404 (Phase 7B soft-404 fix). Real hoods with
  // zero happy hour inventory still render via the otherDrinkSpecials
  // fallback below, only unknown slugs are rejected.
  if (!(await hoodExists(neighborhood))) {
    notFound()
  }

  const deals = await getDeals(neighborhood)

  const name = slugToName(neighborhood)
  const venueCount = uniqueVenueCount(deals)
  const topVenues = topVenueNames(deals)

  // Always fetch other drink specials so zero-HH-deals hoods still render content.
  // Plays both: thin-HH-inventory long-tail queries AND prevents the 100% bounce
  // bug where /happy-hours/[hood] used to 404 when no happy_hour rows existed
  // (~82 visitors/month landing on a not-found page per Plausible).
  const otherDrinkSpecials =
    deals.length < 10
      ? await getOtherDrinkSpecials(neighborhood, new Set(deals.map((d) => d.id)))
      : []
  const hasAnyContent = deals.length > 0 || otherDrinkSpecials.length > 0

  const starts = deals.map((d) => d.start_time).filter(Boolean) as string[]
  const commonStart = starts.length > 0
    ? starts.sort((a, b) => starts.filter((v) => v === a).length - starts.filter((v) => v === b).length).pop()!
    : null
  const cheapest = buildCheapestDrink(deals)

  const faqItems = deals.length > 0
    ? [
        {
          q: `What are the best happy hours in ${name}?`,
          a: `${name} has ${deals.length} happy hour deals. ${deals.slice(0, 3).map((d) => `${d.venue_name} offers ${d.title}`).join(". ")}.`,
        },
        {
          q: `When do happy hours start in ${name}?`,
          a: commonStart
            ? `Most happy hours in ${name} start at ${formatTime(commonStart)}. Times vary by venue.`
            : `Happy hour times vary by venue in ${name}. Check individual listings for schedules.`,
        },
        {
          q: `What's the cheapest happy hour drink in ${name}?`,
          a: cheapest
            ? `The cheapest happy hour drink in ${name} is ${cheapest}. Browse all ${deals.length} deals for more.`
            : `Browse all ${deals.length} happy hour deals in ${name} to find the best drink prices.`,
        },
      ]
    : []

  // Related neighborhoods, pick up to 6 from common Chicago neighborhoods
  const relatedSlugs = [
    "west-loop", "lincoln-park", "wicker-park", "river-north",
    "lakeview", "logan-square", "old-town", "bucktown",
    "roscoe-village", "andersonville", "pilsen", "hyde-park",
  ].filter((s) => s !== neighborhood).slice(0, 6)

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: "https://www.312deals.com" },
                  { name: "Happy Hours", url: "https://www.312deals.com/happy-hours" },
                  { name: name, url: `https://www.312deals.com/happy-hours/${neighborhood}` },
                ])
              ),
            }}
          />
          {deals.length > 0 && (
            <>
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(
                    buildItemListJsonLd(
                      `Happy Hour Deals in ${name}, Chicago`,
                      `https://www.312deals.com/happy-hours/${neighborhood}`,
                      deals
                    )
                  ),
                }}
              />
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(buildFaqJsonLd(faqItems)),
                }}
              />
            </>
          )}

          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/happy-hours" className="hover:text-foreground transition-colors">
              Happy Hours
            </Link>
            <span>/</span>
            <span className="text-foreground">{name}</span>
          </nav>

          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-brand-500" />
              <h1 className="text-2xl font-bold text-foreground">
                Happy Hour {name}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {deals.length > 0
                ? `${deals.length} happy hour deal${deals.length !== 1 ? "s" : ""} at ${venueCount} venue${venueCount !== 1 ? "s" : ""}`
                : otherDrinkSpecials.length > 0
                ? `${otherDrinkSpecials.length} drink specials at ${name} bars and restaurants`
                : `Find happy hour and drink specials in ${name}`}
            </p>
          </div>

          {/* Hood-specific intent callout, covers cases where SERP intent
              isn't satisfied by a generic happy-hour list (e.g. Wrigleyville
              searchers expect Cubs context). Renders only when HOOD_CALLOUTS
              has an entry for this hood; cheap if not. */}
          {HOOD_CALLOUTS[neighborhood] && (() => {
            const c = HOOD_CALLOUTS[neighborhood]
            return (
              <div className="mb-4 rounded-xl border border-brand-300/40 bg-brand-50/60 dark:bg-brand-950/30 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden="true">{c.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                      {c.badge}
                    </p>
                    <h2 className="mt-0.5 text-base font-bold text-foreground">{c.headline}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-brand-400 transition-colors"
                        >
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Inline search, above-the-fold action for the search-intent users
              who land on /happy-hours/[hood] looking for a specific venue or
              keyword. Plausible: /search has 0% bounce, /happy-hours/[hood]
              had 100% bounce, surfacing the search input on the hub page is
              the single biggest engagement lift available. */}
          {hasAnyContent && (
            <div className="mb-4">
              <SearchBar
                compact
                defaultNeighborhood={neighborhood}
                defaultType="happy_hour"
              />
            </div>
          )}

          {/* Above-the-fold navigation chips, capture mobile visitors before they exit */}
          <div className="mb-6 flex flex-wrap gap-2">
            <Link
              href={`/neighborhoods/${neighborhood}`}
              className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-400"
            >
              All {name} deals →
            </Link>
            <Link
              href={`/map?neighborhood=${neighborhood}`}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
            >
              📍 Map view
            </Link>
            {relatedSlugs.slice(0, 3).map((slug) => (
              <Link
                key={`top-${slug}`}
                href={`/happy-hours/${slug}`}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
              >
                Compare {slugToName(slug)}
              </Link>
            ))}
          </div>

          {/* Prose intro, hidden on mobile when deals exist (redundant with the
              count line above; eats above-the-fold real estate that should be
              showing actual deal cards). Always shown when there are no deals
              (it carries the only contextual content for empty hoods). */}
          {deals.length > 0 ? (
            <p className="mb-6 hidden text-sm leading-relaxed text-muted-foreground md:block">
              {name} has {deals.length} happy hour deal{deals.length !== 1 ? "s" : ""} at {venueCount} bar{venueCount !== 1 ? "s" : ""} and restaurant{venueCount !== 1 ? "s" : ""}.
              {topVenues.length > 0 && ` Popular spots include ${topVenues.join(", ")}.`}
              {commonStart && ` Most happy hours start at ${formatTime(commonStart)}.`}
              {cheapest && ` The cheapest drink deal is ${cheapest}.`}
            </p>
          ) : otherDrinkSpecials.length > 0 ? (
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              No dedicated happy hour menus posted in {name} yet, but {otherDrinkSpecials.length} weekday drink specials, beer buckets, wine nights, and daily deals are running at {name} bars and restaurants right now.
            </p>
          ) : (
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Looking for happy hour in {name}? Browse drink specials at nearby Chicago neighborhoods below, or check the full list of Chicago happy hours.
            </p>
          )}

          {/* Stats bar, hidden on mobile (every stat is duplicated in the
              count line + intro prose; on a 375px screen this 80-100px block
              just pushes the deals grid below the fold). */}
          {deals.length > 0 && (
            <div className="mb-8 hidden flex-wrap gap-4 rounded-xl border border-border bg-card p-4 md:flex">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{venueCount}</span> venues
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{deals.length}</span> happy hour deals
                </span>
              </div>
              {commonStart && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    Most start at <span className="font-semibold">{formatTime(commonStart)}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Deals Grid */}
          <h2 className="sr-only">Happy Hour Deals in {name}</h2>
          {deals.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <ShowMore
                items={deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} variant="full" />
                ))}
                initialCount={50}
                noun="deals"
              />
            </div>
          ) : otherDrinkSpecials.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No happy hour or drink specials posted in {name} yet, but new deals are added daily.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Link
                  href={`/neighborhoods/${neighborhood}`}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
                >
                  All {name} Deals
                </Link>
                <Link
                  href="/happy-hours"
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  All Chicago Happy Hours
                </Link>
                <Link
                  href="/submit"
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  Submit a Deal
                </Link>
              </div>
            </div>
          ) : null}

          {/* Other Drink Specials (shown when HH inventory is thin) */}
          {otherDrinkSpecials.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                More Drink Specials in {name}
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Weekday drink specials, beer buckets, wine nights, and daily deals at {name} bars and restaurants.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <ShowMore
                  items={otherDrinkSpecials.map((deal) => (
                    <DealCard key={`other-${deal.id}`} deal={deal} variant="full" />
                  ))}
                  initialCount={12}
                  noun="specials"
                />
              </div>
            </div>
          )}

          {/* Related neighborhoods */}
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Happy Hours in Other Neighborhoods
            </h2>
            <div className="flex flex-wrap gap-2">
              {relatedSlugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/happy-hours/${slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                >
                  {slugToName(slug)}
                </Link>
              ))}
              <Link
                href="/happy-hours"
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-400"
              >
                All neighborhoods
              </Link>
            </div>
          </div>

          {/* Related deal types */}
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              More Deals in {name}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/neighborhoods/${neighborhood}`}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
              >
                All {name} Deals
              </Link>
              {["brunch-deals", "late-night", "taco-tuesday"].map((slug) => (
                <Link
                  key={slug}
                  href={`/deals/${slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                >
                  {DEAL_TYPE_PAGES[slug]?.label ?? slugToName(slug)}
                </Link>
              ))}
            </div>
          </div>

          {/* FAQ */}
          {faqItems.length > 0 && (
            <div className="mt-12 rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <HelpCircle className="h-5 w-5" />
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
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
