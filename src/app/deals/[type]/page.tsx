import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Tag, Store, HelpCircle } from "lucide-react"
import { DealCard } from "@/components/deal-card"
import { SortableDealsGrid } from "@/components/sortable-deals-grid"
import { SearchBar } from "@/components/search-bar"
import { EmailSignup } from "@/components/email-signup"
import type { Deal, SearchResponse } from "@/lib/types"
import type { DealTypePageConfig } from "@/lib/seo-utils"
import {
  DEAL_TYPE_PAGES,
  DEAL_TYPE_API_TO_SLUG,
  CUISINE_PAGES,
  slugToName,
  formatTime,
  buildBreadcrumbJsonLd,
  buildCheapestDrink,
  buildItemListJsonLd,
  buildFaqJsonLd,
  getLowestDealPrice,
  uniqueVenueCount,
  topVenueNames,
} from "@/lib/seo-utils"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"

async function getDeals(config: (typeof DEAL_TYPE_PAGES)[string]): Promise<Deal[]> {
  try {
    const params = new URLSearchParams({ limit: "50" })
    // Most pages lock to a deal_type; query-only pages (e.g. bogo, which spans
    // many types) leave apiValue "" and filter on the text query instead.
    if (config.apiValue) params.set("deal_type", config.apiValue)
    if (config.query) params.set("q", config.query)
    if (config.day) params.set("day", config.day)
    // Generic weekday pages only: keep them genuinely day-specific so they stop
    // being ~97% copies of one another. See DealTypePageConfig.dayStrict.
    if (config.dayStrict) {
      params.set("day_strict", "true")
      params.set("max_days", "3")
    }

    const res = await fetch(`${API_URL}/api/v1/deals/search?${params}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

/**
 * Rank neighborhoods by how many of THIS page's deals they actually hold.
 *
 * The previous derivation took the first 8 distinct slugs out of the limit=50
 * fetch in whatever order the API happened to return them. That is arbitrary,
 * and it showed: /deals/taco-tuesday was shipping "Evanston, Arlington Heights,
 * Palatine, Frankfort" as its first four chips -- three far suburbs -- to people
 * who had just searched "taco tuesday chicago". Ranking a 200-row sample by
 * frequency yields River North, Lakeview, West Loop, The Loop instead.
 *
 * Deliberately a SECOND fetch rather than raising the main one: SortableDealsGrid
 * renders every deal it is handed and this page is already ~470KB, so the render
 * set stays at 50. This request is server-side only, revalidates hourly with the
 * page, and never reaches the client.
 *
 * 200 is the API's ceiling (higher returns 422). The counts are a sample, not a
 * true total, which is why they rank the chips but are never displayed.
 */
async function getNeighborhoodRanking(
  config: DealTypePageConfig,
  n = 8
): Promise<string[]> {
  try {
    const params = new URLSearchParams({ limit: "200" })
    if (config.apiValue) params.set("deal_type", config.apiValue)
    if (config.query) params.set("q", config.query)
    if (config.day) params.set("day", config.day)
    if (config.dayStrict) {
      params.set("day_strict", "true")
      params.set("max_days", "3")
    }
    const res = await fetch(`${API_URL}/api/v1/deals/search?${params}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    const counts = new Map<string, number>()
    for (const d of data.deals ?? []) {
      const slug = d.neighborhood_slug
      if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([slug]) => slug)
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: { type: string }
}): Promise<Metadata> {
  const config = DEAL_TYPE_PAGES[params.type]
  if (!config) return { title: "Deals | 312Deals" }

  const ogParams = new URLSearchParams({
    title: config.seoTitle,
    subtitle: config.description.slice(0, 100),
    type: config.label,
  })
  const ogImageUrl = `https://www.312deals.com/api/og?${ogParams}`

  return {
    title: `${config.seoTitle} | 312Deals`,
    description: config.description,
    openGraph: {
      title: `${config.seoTitle} | 312Deals`,
      description: config.description,
      url: `https://www.312deals.com/deals/${params.type}`,
      siteName: "312Deals",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: config.seoTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${config.seoTitle} | 312Deals`,
      description: config.description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `https://www.312deals.com/deals/${params.type}`,
    },
  }
}

export default async function DealTypePage({
  params,
}: {
  params: { type: string }
}) {
  const config = DEAL_TYPE_PAGES[params.type]
  if (!config) notFound()

  const deals = await getDeals(config)
  const venueCount = uniqueVenueCount(deals)
  const topVenues = topVenueNames(deals)
  const cheapest = buildCheapestDrink(deals)

  // Neighborhood chips, ranked by how many of this page's deals each hood holds.
  // Falls back to the old first-seen derivation if the ranking fetch fails, so
  // the module degrades rather than disappearing.
  const ranked = await getNeighborhoodRanking(config)
  const neighborhoodSlugs = ranked.length > 0
    ? ranked
    : [...new Set(deals.map((d) => d.neighborhood_slug).filter(Boolean))].slice(0, 8)

  const faqItems = deals.length > 0
    ? [
        {
          q: `Where can I find ${config.label.toLowerCase()} in Chicago?`,
          a: `Chicago has ${deals.length} ${config.label.toLowerCase()} deal${deals.length !== 1 ? "s" : ""} at ${venueCount} venue${venueCount !== 1 ? "s" : ""}. ${topVenues.length > 0 ? `Popular spots include ${topVenues.join(", ")}.` : ""}`,
        },
        {
          q: `What are the best ${config.label.toLowerCase()} deals in Chicago?`,
          a: deals.slice(0, 3).map((d) => `${d.venue_name} offers ${d.title}`).join(". ") + ".",
        },
        ...(cheapest
          ? [{
              q: `What's the cheapest ${config.label.toLowerCase()} drink deal?`,
              a: `The cheapest drink deal is ${cheapest}. Browse all ${deals.length} deals for more options.`,
            }]
          : []),
      ]
    : []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbJsonLd([
              { name: "Home", url: "https://www.312deals.com" },
              { name: "Deals", url: "https://www.312deals.com/deals" },
              { name: config.label, url: `https://www.312deals.com/deals/${params.type}` },
            ])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: `${config.seoTitle} | 312Deals`,
            url: `https://www.312deals.com/deals/${params.type}`,
            dateModified: deals[0]?.updated_at || deals[0]?.created_at || new Date().toISOString().split("T")[0],
            description: config.description,
          }),
        }}
      />
      {deals.length > 0 && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildItemListJsonLd(
                  config.seoTitle,
                  `https://www.312deals.com/deals/${params.type}`,
                  deals
                )
              ),
            }}
          />
          {/* AggregateOffer, summarizes the price range across all deals on
              this hub. Eligible for rich-result enhancements; signals price
              range to AI engines for "cheapest [deal type] in Chicago". */}
          {(() => {
            const prices = deals
              .map((d) => getLowestDealPrice(d))
              .filter((p): p is number => typeof p === "number" && p > 0)
            if (prices.length === 0) return null
            const aggregateOffer = {
              "@context": "https://schema.org",
              "@type": "AggregateOffer",
              priceCurrency: "USD",
              lowPrice: Math.min(...prices).toFixed(2),
              highPrice: Math.max(...prices).toFixed(2),
              offerCount: deals.length,
              availability: "https://schema.org/InStock",
              url: `https://www.312deals.com/deals/${params.type}`,
              name: `${config.seoTitle}, Price Range`,
            }
            return (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(aggregateOffer) }}
              />
            )
          })()}
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
        <Link href="/search" className="hover:text-foreground transition-colors">
          Deals
        </Link>
        <span>/</span>
        <span className="text-foreground">{config.label}</span>
      </nav>

      {/* Header, H1 visible always, prose+stats hidden on mobile to push deals
          above the fold. Apr 28 fix replicating Session 33 SearchBar pattern.
          Pre-fix: /deals/wing-deals 73% bounce / 63s; /deals/taco-tuesday 67% bounce. */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="h-5 w-5 text-brand-500" />
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            {config.seoTitle}
          </h1>
        </div>
        <p className="hidden md:block text-sm text-muted-foreground">
          {config.description}
        </p>
      </div>

      {/* Inline SearchBar above-the-fold, captures intent before mobile bounce */}
      {deals.length > 0 && (
        <div className="mb-4 md:mb-6">
          <SearchBar
            compact
            defaultType={config.apiValue}
            defaultDay={config.day}
            defaultQuery={config.query}
          />
        </div>
      )}

      {/* Narrow-by-neighborhood, ABOVE the grid.
          These chips already existed, but 58 venue links, the FAQ and the email
          signup rendered before them, so the 89% of visitors who exit from this
          page never reached them. Deep hood pages convert at 7.3% outbound
          against 3.7% for this browse page, so the chips are the single most
          valuable thing here after the deals themselves -- they belong where the
          question "which of these is near me" actually gets asked.
          Rendered once; the old bottom copy is gone so the page does not carry
          two identical link sets. */}
      {neighborhoodSlugs.length > 0 && (() => {
        const comboSlug = config.apiValue ? DEAL_TYPE_API_TO_SLUG[config.apiValue] : undefined
        return (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {config.label} by neighborhood
            </h2>
            <div className="flex flex-wrap gap-2">
              {neighborhoodSlugs.map((slug) => (
                <Link
                  key={slug}
                  href={comboSlug ? `/neighborhoods/${slug}/${comboSlug}` : `/neighborhoods/${slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                >
                  {slugToName(slug)}
                </Link>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Quick answer summary for AEO, desktop only; mobile users see deals first */}
      {deals.length > 0 && (
        <p className="hidden md:block mb-6 text-sm leading-relaxed text-muted-foreground">
          Chicago has {deals.length} active {config.label.toLowerCase()} deal{deals.length !== 1 ? "s" : ""} across {venueCount} venue{venueCount !== 1 ? "s" : ""}.
          {topVenues.length > 0 && ` Popular spots include ${topVenues.join(", ")}.`}
          {cheapest && ` The cheapest drink deal is ${cheapest}.`}
        </p>
      )}

      {/* Stats bar */}
      {deals.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              <span className="font-semibold">{venueCount}</span> venues
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              <span className="font-semibold">{deals.length}</span> deals
            </span>
          </div>
        </div>
      )}

      {/* Deals Grid */}
      <h2 className="sr-only">{config.label} Deals</h2>
      {deals.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No {config.label.toLowerCase()} deals running right now, try another category or search the full corpus of live Chicago deals.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/deals"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
            >
              Browse all deal types
            </Link>
            <Link
              href="/search"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-brand-400"
            >
              Search all deals
            </Link>
            <Link
              href="/submit"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-brand-400"
            >
              Submit a deal
            </Link>
          </div>
        </div>
      ) : (
        <SortableDealsGrid deals={deals} />
      )}

      {/* Intent-matched newsletter capture, these deal-type pages are the
          highest deal-click entry points (e.g. /deals/taco-tuesday). Rendered
          on empty pages too: a visitor who found no live deals is the best
          person to capture, so a thin/empty page still converts. Headline
          swaps to a "notify me" hook when empty; source is per-type for
          conversion attribution. */}
      <div className="mt-10">
        <EmailSignup
          source={`deal-type-${params.type}`}
          headline={
            deals.length > 0
              ? `Get Chicago ${config.label} in your inbox`
              : `Get notified when ${config.label} deals drop`
          }
          subtitle={`The week's best ${config.label.toLowerCase()} and more, hand-picked every Thursday, free, unsubscribe anytime.`}
        />
      </div>

      {/* Top venues, explicit internal links */}
      {deals.length > 0 && (() => {
        const venueMap = new Map<string, { name: string; slug: string; count: number }>()
        for (const d of deals) {
          if (!d.venue_slug) continue
          const v = venueMap.get(d.venue_slug)
          if (v) { v.count++ }
          else { venueMap.set(d.venue_slug, { name: d.venue_name, slug: d.venue_slug, count: 1 }) }
        }
        const topVenues = [...venueMap.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
        if (topVenues.length === 0) return null
        return (
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Top {config.label} Venues
            </h2>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
              {topVenues.map((v) => (
                <Link
                  key={v.slug}
                  href={`/venues/${v.slug}`}
                  className="rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-brand-300 hover:bg-accent"
                >
                  <p className="text-sm font-medium text-foreground line-clamp-1">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.count} deal{v.count !== 1 ? "s" : ""}</p>
                </Link>
              ))}
            </div>
          </div>
        )
      })()}

      {/* This weekend callout, cross-links to seasonal guides for indexing signal */}
      <div className="mt-10 rounded-xl border border-brand-300/40 bg-brand-50/40 dark:bg-brand-950/20 p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
          This weekend in Chicago
        </h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/guides/patio-season-chicago"
            className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
          >
            🌞 Patio Season Guide, 1,500+ outdoor deals
          </Link>
          <Link
            href="/blog/mothers-day-chicago-2026"
            className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
          >
            💐 Mother&apos;s Day 2026 Recap
          </Link>
          <Link
            href="/deals/brunch-deals"
            className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
          >
            🥂 Brunch Deals, Bottomless Mimosas
          </Link>
        </div>
      </div>

      {/* Related deal types, prefer config.relatedTypes (e.g. wing-deals →
          wing-tuesday) so weekday/sibling variants get a direct internal link;
          fall back to generic top-6 otherwise. */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          More Deal Types
        </h2>
        <div className="flex flex-wrap gap-2">
          {/* Persistent link up to the /deals hub (renders even when this page
              has deals) so every deal-type page passes signal to the hub, which
              ranks page-2 for "food deals". */}
          <Link
            href="/deals"
            className="rounded-full border border-brand-300 bg-card px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:border-brand-500"
          >
            All Chicago food deals
          </Link>
          {(config.relatedTypes && config.relatedTypes.length > 0
            ? config.relatedTypes
                .filter((slug) => slug !== params.type && DEAL_TYPE_PAGES[slug])
                .map((slug) => [slug, DEAL_TYPE_PAGES[slug]] as const)
            : Object.entries(DEAL_TYPE_PAGES)
                .filter(([slug]) => slug !== params.type)
                .slice(0, 6))
            .map(([slug, c]) => (
              <Link
                key={slug}
                href={`/deals/${slug}`}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
              >
                {c.label}
              </Link>
            ))}
          <Link
            href="/cuisine"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
          >
            Browse by Cuisine
          </Link>
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
  )
}
