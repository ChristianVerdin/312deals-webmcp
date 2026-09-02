import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Store, Tag, HelpCircle, UtensilsCrossed } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCard } from "@/components/deal-card"
import { ShowMore } from "@/components/show-more"
import type { Deal, SearchResponse } from "@/lib/types"
import {
  CUISINE_PAGES,
  DEAL_TYPE_PAGES,
  slugToName,
  buildBreadcrumbJsonLd,
  buildCheapestDrink,
  buildItemListJsonLd,
  buildFaqJsonLd,
  uniqueVenueCount,
  topVenueNames,
} from "@/lib/seo-utils"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"

async function getDeals(cuisine: string): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?cuisine=${cuisine}&limit=50`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: { type: string }
}): Promise<Metadata> {
  const config = CUISINE_PAGES[params.type]
  if (!config) return { title: "Cuisine Deals | 312Deals" }

  // Soft-404 guard (Mintlify Phase 7B): emit noindex when the cuisine has
  // zero active deals. The route render path keeps its empty-state UX (so
  // returning users with bookmarks still see useful content), but tells
  // Google/Mintlify the URL isn't worth indexing while inventory is thin.
  const deals = await getDeals(config.apiCuisines ?? params.type)
  const isEmpty = deals.length === 0

  return {
    title: `${config.seoTitle} | 312Deals`,
    description: `Browse ${config.label.toLowerCase()} food and drink deals across Chicago. Happy hours, daily specials, and discounts at ${config.label.toLowerCase()} restaurants near you.`,
    ...(isEmpty ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `${config.seoTitle} | 312Deals`,
      description: `${config.label} restaurant deals across Chicago.`,
      url: `https://www.312deals.com/cuisine/${params.type}`,
      siteName: "312Deals",
      type: "website",
      images: [{
        url: `https://www.312deals.com/api/og?title=${encodeURIComponent(config.seoTitle)}&subtitle=${encodeURIComponent(config.label + " deals in Chicago")}`,
        width: 1200,
        height: 630,
        alt: config.seoTitle,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${config.seoTitle} | 312Deals`,
      description: `Browse ${config.label.toLowerCase()} food and drink deals across Chicago.`,
      images: [`https://www.312deals.com/api/og?title=${encodeURIComponent(config.seoTitle)}&subtitle=${encodeURIComponent(config.label + " deals in Chicago")}`],
    },
    alternates: {
      canonical: `https://www.312deals.com/cuisine/${params.type}`,
    },
  }
}

export default async function CuisineTypePage({
  params,
}: {
  params: { type: string }
}) {
  const config = CUISINE_PAGES[params.type]
  if (!config) notFound()

  const deals = await getDeals(config.apiCuisines ?? params.type)
  const venueCount = uniqueVenueCount(deals)
  const topVenues = topVenueNames(deals)
  const cheapest = buildCheapestDrink(deals)

  const neighborhoodSlugs = [...new Set(deals.map((d) => d.neighborhood_slug).filter(Boolean))].slice(0, 8)

  const faqItems = deals.length > 0
    ? [
        {
          q: `Where can I find ${config.label.toLowerCase()} food deals in Chicago?`,
          a: `Chicago has ${deals.length} ${config.label.toLowerCase()} food deal${deals.length !== 1 ? "s" : ""} at ${venueCount} restaurant${venueCount !== 1 ? "s" : ""}. ${topVenues.length > 0 ? `Top spots include ${topVenues.join(", ")}.` : ""}`,
        },
        {
          q: `What are the best ${config.label.toLowerCase()} restaurant deals in Chicago?`,
          a: deals.slice(0, 3).map((d) => `${d.venue_name} offers ${d.title}`).join(". ") + ".",
        },
        ...(cheapest
          ? [{
              q: `What's the cheapest ${config.label.toLowerCase()} deal in Chicago?`,
              a: `The cheapest deal is ${cheapest}. Browse all ${deals.length} ${config.label.toLowerCase()} deals for more.`,
            }]
          : []),
      ]
    : []

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
                  { name: "Cuisine", url: "https://www.312deals.com/cuisine" },
                  { name: config.label, url: `https://www.312deals.com/cuisine/${params.type}` },
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
                      config.seoTitle,
                      `https://www.312deals.com/cuisine/${params.type}`,
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

          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/cuisine" className="hover:text-foreground transition-colors">
              Cuisine
            </Link>
            <span>/</span>
            <span className="text-foreground">{config.label}</span>
          </nav>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <UtensilsCrossed className="h-5 w-5 text-brand-500" />
              <h1 className="text-2xl font-bold text-foreground">
                {config.seoTitle}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {deals.length} {config.label.toLowerCase()} deal{deals.length !== 1 ? "s" : ""} at {venueCount} restaurant{venueCount !== 1 ? "s" : ""} across Chicago
            </p>
          </div>

          {/* Prose intro */}
          {deals.length > 0 && (
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Find the best {config.label.toLowerCase()} food and drink deals across Chicago.
              {topVenues.length > 0 && ` Popular spots include ${topVenues.join(", ")}.`}
              {cheapest && ` The cheapest drink deal is ${cheapest}.`}
              {" "}Browse happy hours, daily specials, and more at {config.label.toLowerCase()} restaurants near you.
            </p>
          )}

          {/* Stats bar */}
          {deals.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{venueCount}</span> restaurants
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
                No {config.label.toLowerCase()} deals found yet.
              </p>
              <Link
                href="/submit"
                className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
              >
                Submit a deal
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <ShowMore
                items={deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} variant="full" />
                ))}
                initialCount={50}
                noun="deals"
              />
            </div>
          )}

          {/* Related neighborhoods */}
          {neighborhoodSlugs.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                {config.label} Deals by Neighborhood
              </h2>
              <div className="flex flex-wrap gap-2">
                {neighborhoodSlugs.map((slug) => (
                  <Link
                    key={slug}
                    href={`/neighborhoods/${slug}`}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    {slugToName(slug)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related cuisines + deal types */}
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              More Cuisines
            </h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CUISINE_PAGES)
                .filter(([slug]) => slug !== params.type)
                .slice(0, 8)
                .map(([slug, c]) => (
                  <Link
                    key={slug}
                    href={`/cuisine/${slug}`}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    {c.label}
                  </Link>
                ))}
              <Link
                href="/cuisine"
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-400"
              >
                All cuisines
              </Link>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Browse by Deal Type
            </h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DEAL_TYPE_PAGES)
                .slice(0, 6)
                .map(([slug, c]) => (
                  <Link
                    key={slug}
                    href={`/deals/${slug}`}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    {c.label}
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
