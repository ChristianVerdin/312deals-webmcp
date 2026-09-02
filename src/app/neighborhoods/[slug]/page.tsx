import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft, MapPin, Store, Tag, TrendingUp, HelpCircle } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCard } from "@/components/deal-card"
import { SortableDealsGrid } from "@/components/sortable-deals-grid"
import { DealTypeBadge } from "@/components/deal-type-badge"
import type { Deal, Neighborhood, NeighborhoodSummary, SearchResponse, NeighborhoodResponse, NeighborhoodSummaryResponse } from "@/lib/types"
import {
  DEAL_TYPE_API_TO_SLUG,
  DEAL_TYPE_SLUGS,
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildFaqJsonLd,
  formatTime,
  buildCheapestDrink,
  slugToName,
  uniqueVenueCount,
  topVenueNames,
} from "@/lib/seo-utils"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"

// ─── Data fetching ──────────────────────────────────────────

async function getNeighborhoodData(slug: string) {
  try {
    const [dealsRes, summaryRes, neighborhoodsRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/deals/search?neighborhood=${slug}&limit=50`, {
        next: { revalidate: 3600 },
      }),
      fetch(`${API_URL}/api/v1/neighborhoods/summary?neighborhood=${slug}`, {
        next: { revalidate: 3600 },
      }),
      fetch(`${API_URL}/api/v1/neighborhoods`, {
        next: { revalidate: 3600 },
      }),
    ])

    const dealsData: SearchResponse | null = dealsRes.ok ? await dealsRes.json() : null
    const summaryData: NeighborhoodSummaryResponse | null = summaryRes.ok ? await summaryRes.json() : null
    const neighborhoodsData: NeighborhoodResponse | null = neighborhoodsRes.ok ? await neighborhoodsRes.json() : null

    return {
      deals: dealsData?.deals ?? [],
      summary: summaryData?.neighborhoods?.[0] ?? null,
      allNeighborhoods: neighborhoodsData?.neighborhoods ?? [],
    }
  } catch {
    return { deals: [], summary: null, allNeighborhoods: [] }
  }
}

// ─── Metadata ────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const { slug } = params
  const displayName = slugToName(slug)
  const { deals, summary } = await getNeighborhoodData(slug)

  const dealCount = summary?.deal_count ?? deals.length
  const venueCount = summary?.venue_count ?? 0
  const title = `${displayName} Deals, ${dealCount} Specials | 312Deals`
  const description = dealCount > 0
    ? `Discover ${dealCount} food & drink deals at ${venueCount} venues in ${displayName}, Chicago. Find happy hours, daily specials, brunch deals, and late-night offers near you.`
    : `Explore food & drink deals in ${displayName}, Chicago. Browse happy hours, daily specials, brunch deals, and late-night offers at local bars and restaurants.`

  const ogParams = new URLSearchParams({
    title: `${displayName} Deals`,
    subtitle: dealCount > 0 ? `${dealCount} deals at ${venueCount} venues` : "",
    neighborhood: displayName,
  })
  const ogImageUrl = `https://www.312deals.com/api/og?${ogParams}`

  return {
    title,
    description,
    // Prevent indexing of thin content pages with zero deals
    // Use deals.length (not summary.deal_count) to stay consistent with schema emission gate
    ...(deals.length === 0 ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      url: `https://www.312deals.com/neighborhoods/${slug}`,
      siteName: "312Deals",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${displayName} deals` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `https://www.312deals.com/neighborhoods/${slug}`,
    },
  }
}

// ─── Helpers ────────────────────────────────────────────────

function buildProseIntro(
  name: string,
  deals: Deal[],
  venueCount: number,
  dealCount: number
): string | null {
  if (deals.length === 0) return null

  const topVenues = topVenueNames(deals, 3)

  const starts = deals.map((d) => d.start_time).filter(Boolean) as string[]
  const ends = deals.map((d) => d.end_time).filter(Boolean) as string[]
  const commonStart = starts.length > 0
    ? starts.sort((a, b) => starts.filter((v) => v === a).length - starts.filter((v) => v === b).length).pop()
    : null
  const commonEnd = ends.length > 0
    ? ends.sort((a, b) => ends.filter((v) => v === a).length - ends.filter((v) => v === b).length).pop()
    : null

  let prose = `${name} has ${dealCount} food & drink deal${dealCount !== 1 ? "s" : ""} at ${venueCount} bar${venueCount !== 1 ? "s" : ""} and restaurant${venueCount !== 1 ? "s" : ""}.`

  if (topVenues.length > 0) {
    prose += ` Popular spots include ${topVenues.join(", ")}.`
  }

  if (commonStart && commonEnd) {
    prose += ` Most happy hours run from ${formatTime(commonStart)} to ${formatTime(commonEnd)}.`
  }

  return prose
}

function buildFaqItems(name: string, deals: Deal[]) {
  if (deals.length === 0) return []
  const cheapest = buildCheapestDrink(deals)
  const starts = deals.map((d) => d.start_time).filter(Boolean) as string[]
  const commonStart = starts.length > 0
    ? starts.sort((a, b) => starts.filter((v) => v === a).length - starts.filter((v) => v === b).length).pop()
    : null

  return [
    {
      q: `What are the best happy hours in ${name}?`,
      a: `${name} has ${deals.length} active deals. ${deals.slice(0, 3).map((d) => `${d.venue_name} offers ${d.title}`).join(". ")}.`,
    },
    {
      q: `When do happy hours start in ${name}?`,
      a: commonStart
        ? `Most happy hours in ${name} start at ${formatTime(commonStart)}. Times vary by venue, check individual listings for exact schedules.`
        : `Happy hour times vary by venue in ${name}. Check individual listings for exact schedules.`,
    },
    {
      q: `What's the cheapest drink deal in ${name}?`,
      a: cheapest
        ? `The cheapest drink deal in ${name} is ${cheapest}. Browse all ${deals.length} deals to find more options.`
        : `Browse all ${deals.length} deals in ${name} to find the best drink prices.`,
    },
  ]
}

function pickNearbyNeighborhoods(
  currentSlug: string,
  allNeighborhoods: Neighborhood[],
  currentZone: string | null,
  count: number = 8
): Neighborhood[] {
  const others = allNeighborhoods.filter(
    (n) => n.slug !== currentSlug && n.active_deal_count > 0
  )

  // Prefer same-zone neighborhoods, sorted by deal count descending
  const sameZone = currentZone
    ? others
        .filter((n) => n.zone === currentZone)
        .sort((a, b) => b.active_deal_count - a.active_deal_count)
    : []

  if (sameZone.length >= count) return sameZone.slice(0, count)

  // Fill remaining slots with other neighborhoods sorted by deal count
  const sameZoneSlugs = new Set(sameZone.map((n) => n.slug))
  const rest = others
    .filter((n) => !sameZoneSlugs.has(n.slug))
    .sort((a, b) => b.active_deal_count - a.active_deal_count)

  return [...sameZone, ...rest].slice(0, count)
}

// ─── Main page component (Server) ──────────────────────────

export default async function NeighborhoodDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const { deals, summary, allNeighborhoods } = await getNeighborhoodData(slug)

  // No deals and no summary means this neighborhood doesn't exist
  if (deals.length === 0 && !summary) notFound()

  // Find current neighborhood's zone for nearby section
  const currentNeighborhood = allNeighborhoods.find((n) => n.slug === slug)
  const nearbyNeighborhoods = pickNearbyNeighborhoods(
    slug,
    allNeighborhoods,
    currentNeighborhood?.zone ?? null
  )

  const displayName = summary?.name
    ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  const proseIntro = buildProseIntro(
    displayName,
    deals,
    summary?.venue_count ?? 0,
    summary?.deal_count ?? deals.length
  )

  const faqItems = buildFaqItems(displayName, deals)

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          {/* JSON-LD, only emit schema on indexable pages (with deals) */}
          {deals.length > 0 && (
            <>
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(
                    buildBreadcrumbJsonLd([
                      { name: "Home", url: "https://www.312deals.com" },
                      { name: "Neighborhoods", url: "https://www.312deals.com/neighborhoods" },
                      { name: displayName, url: `https://www.312deals.com/neighborhoods/${slug}` },
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
                    name: `${displayName} Deals, Chicago Food & Drink Specials`,
                    url: `https://www.312deals.com/neighborhoods/${slug}`,
                    dateModified: deals[0]?.updated_at || deals[0]?.created_at || new Date().toISOString().split("T")[0],
                  }),
                }}
              />
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(
                    buildItemListJsonLd(
                      `Deals in ${displayName}, Chicago`,
                      `https://www.312deals.com/neighborhoods/${slug}`,
                      deals
                    )
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

          {/* Back link */}
          <Link
            href="/neighborhoods"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All neighborhoods
          </Link>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-brand-500" />
              <h1 className="text-2xl font-bold text-foreground">
                What are the best deals in {displayName}?
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {deals.length} deal{deals.length !== 1 ? "s" : ""} available
            </p>
          </div>

          {/* Prose intro for SEO/AEO */}
          {proseIntro && (
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {proseIntro}
            </p>
          )}

          {/* Stats bar */}
          {summary && (
            <div className="mb-8 flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{summary.venue_count}</span>{" "}
                  venues
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{summary.deal_count}</span>{" "}
                  deals
                </span>
              </div>
              {summary.avg_savings_pct > 0 && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-foreground">
                    <span className="font-semibold text-green-600">
                      {Math.round(summary.avg_savings_pct)}%
                    </span>{" "}
                    avg savings
                  </span>
                </div>
              )}
              {summary.deal_types.length > 0 && (
                <div className="flex items-center gap-2">
                  {summary.deal_types.slice(0, 4).map((t) => (
                    <DealTypeBadge key={t} dealType={t} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FAQ Section for AEO, placed high for visibility */}
          {faqItems.length > 0 && (
            <div className="mb-8 rounded-xl border border-border bg-card p-6">
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

          {/* Deals Grid */}
          <h2 className="sr-only">Deals in {displayName}</h2>
          {deals.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No deals found in {displayName} yet.
              </p>
              <Link
                href="/submit"
                className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                Submit a deal
              </Link>
            </div>
          ) : (
            <SortableDealsGrid deals={deals} />
          )}

          {/* Top venues, explicit internal links to venue pages */}
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
                  Top Venues in {displayName}
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

          {/* Browse by deal type, links to programmatic pSEO pages */}
          {summary && summary.deal_types.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Browse {displayName} by Deal Type
              </h2>
              <div className="flex flex-wrap gap-2">
                {summary.deal_types
                  .map((dt) => ({ slug: DEAL_TYPE_API_TO_SLUG[dt], config: DEAL_TYPE_SLUGS[DEAL_TYPE_API_TO_SLUG[dt]] }))
                  .filter((x): x is { slug: string; config: (typeof DEAL_TYPE_SLUGS)[string] } => !!x.slug && !!x.config)
                  .map(({ slug: dtSlug, config: dtConfig }) => (
                    <Link
                      key={dtSlug}
                      href={`/neighborhoods/${params.slug}/${dtSlug}`}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                    >
                      {dtConfig.label}
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* Nearby Neighborhoods, internal cross-links */}
          {nearbyNeighborhoods.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Explore More Neighborhoods
              </h2>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                {nearbyNeighborhoods.map((n) => (
                  <Link
                    key={n.slug}
                    href={`/neighborhoods/${n.slug}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-brand-300 hover:bg-accent"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {n.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {n.active_deal_count} deal{n.active_deal_count !== 1 ? "s" : ""}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
