import Link from "next/link"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { MapPin, Store, Tag, Clock, HelpCircle } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCard } from "@/components/deal-card"
import type { Deal, SearchResponse } from "@/lib/types"
import {
  DEAL_TYPE_SLUGS,
  DEAL_TYPE_API_TO_SLUG,
  slugToName,
  formatTime,
  buildBreadcrumbJsonLd,
  buildCheapestDrink,
  buildItemListJsonLd,
  buildFaqJsonLd,
  uniqueVenueCount,
  topVenueNames,
  getLowestDealPrice,
} from "@/lib/seo-utils"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"

async function getDeals(neighborhood: string, dealType: string): Promise<Deal[]> {
  return (await getDealsWithTotal(neighborhood, dealType)).deals
}

/** The page fetches 50 rows, so `deals.length` caps at 50 while a hood like
 *  River North actually has 1,411 happy hours. Any headline count must come
 *  from the response `total`, never from the sampled array. */
async function getDealsWithTotal(
  neighborhood: string,
  dealType: string
): Promise<{ deals: Deal[]; total: number }> {
  try {
    const config = DEAL_TYPE_SLUGS[dealType]
    if (!config) return { deals: [], total: 0 }
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?neighborhood=${neighborhood}&deal_type=${config.apiValue}&limit=50`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return { deals: [], total: 0 }
    const data: SearchResponse = await res.json()
    const deals = data.deals ?? []
    return { deals, total: data.total ?? deals.length }
  } catch {
    return { deals: [], total: 0 }
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; dealType: string }
}): Promise<Metadata> {
  const config = DEAL_TYPE_SLUGS[params.dealType]
  if (!config) return { title: "Deals | 312Deals" }

  const name = slugToName(params.slug)
  const url = `https://www.312deals.com/neighborhoods/${params.slug}/${params.dealType}`

  // Check deal count, noindex thin content pages with 0 deals
  const { deals, total: dealCount } = await getDealsWithTotal(params.slug, params.dealType)

  // Lead with the venue count and price floor, the way /happy-hours/<hood>
  // does. That sibling route serves the SAME content under a second URL and
  // converts 3.2x better -- 5.86% CTR over 3,313 impressions vs 1.85% over
  // 10,734 here (GSC 2026-07-25..08-21) -- and the difference is specificity:
  // "Pilsen Happy Hours, Drinks from $4.00 at 26+ Bars" against a bare
  // "Happy Hours in Pilsen, Chicago". Both numbers come from the fetch this
  // function already makes, so this costs nothing.
  const venueCount = uniqueVenueCount(deals)
  let lowestPrice: number | null = null
  for (const d of deals) {
    const pr = getLowestDealPrice(d)
    if (pr != null && pr > 0 && (lowestPrice === null || pr < lowestPrice)) lowestPrice = pr
  }
  const priceHook =
    lowestPrice != null
      ? `, from $${lowestPrice % 1 === 0 ? lowestPrice.toFixed(0) : lowestPrice.toFixed(2)}`
      : ""
  // "Bars" reads right for drink-led types; "Spots" for the food-led ones.
  const noun = config.apiValue === "happy_hour" || config.apiValue === "late_night" ? "Bars" : "Spots"

  // Shed the least valuable clause first so the 60-char cap never truncates
  // mid-phrase on a long neighborhood name.
  const MAX_TITLE = 60
  // Scoped deliberately. /happy-hours/<hood> is a SECOND route serving this
  // same content for the happy-hour type only, and it already titles itself
  // "River North Happy Hours at 48+ Bars". Giving this page the identical
  // headline would hand Google two byte-identical titles on duplicate content
  // and make the split worse, so happy-hour keeps its distinct wording until
  // the two routes are consolidated. The other six deal types have no twin.
  const hasTwinRoute = config.apiValue === "happy_hour"
  const titleCandidates = hasTwinRoute
    ? [
        `${config.label} in ${name}, Chicago | 312Deals`,
        `${config.label} in ${name} | 312Deals`,
      ]
    : [
        ...(venueCount > 0 && priceHook
          ? [`${name} ${config.label}${priceHook} at ${venueCount}+ ${noun} | 312Deals`]
          : []),
        ...(venueCount > 0 ? [`${name} ${config.label} at ${venueCount}+ ${noun} | 312Deals`] : []),
        `${name} ${config.label}, Chicago | 312Deals`,
        `${name} ${config.label} | 312Deals`,
        `${config.label} in ${name} | 312Deals`,
      ]
  const title = titleCandidates.find((c) => c.length <= MAX_TITLE) ?? titleCandidates[titleCandidates.length - 1]

  // topVenueNames dedupes and ranks by deal count. Taking the raw first three
  // rows yields "Including The Owl, The Owl, The Owl" whenever one venue
  // dominates the head of the result set, which is the common case.
  const topNames = topVenueNames(deals, 3).filter(Boolean)
  const description = dealCount > 0
    ? [
        // Thousands separator matters here: "2011 daily special deals in River
        // North" reads as the year 2011 in a SERP snippet.
        `${dealCount.toLocaleString("en-US")} ${config.singular} deal${dealCount !== 1 ? "s" : ""} in ${name}, Chicago` +
          (venueCount > 0 ? ` at ${venueCount}+ bars and restaurants` : "") +
          (priceHook ? priceHook.replace(/^, /, ", drinks and plates ") : "") + ".",
        topNames.length > 0 ? `Including ${topNames.join(", ")}.` : "",
        "Updated daily.",
      ].filter(Boolean).join(" ")
    : `${config.label} in ${name}, Chicago. Browse ${config.singular} deals and specials at bars and restaurants in ${name}.`

  const ogParams = new URLSearchParams({
    title: `${config.label} in ${name}`,
    subtitle: `Chicago ${config.label}`,
    neighborhood: name,
  })

  return {
    title,
    description,
    ...(dealCount === 0 ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: "312Deals",
      type: "website",
      images: [{
        url: `https://www.312deals.com/api/og?${ogParams}`,
        width: 1200,
        height: 630,
        alt: `${config.label} in ${name}`,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    // Consolidate the happy-hour duplicate. /happy-hours/<hood> serves this
    // exact content under a second URL and converts 3.2x better: 5.86% CTR
    // over 3,313 impressions vs 1.85% over 10,734 here (GSC 2026-07-25..
    // 08-21). Both routes self-canonicalised, so Google picked a winner per
    // hood and picked inconsistently -- Pilsen resolved to /happy-hours/pilsen
    // (102 clicks) while West Loop resolved here (57 clicks), and River North,
    // the largest happy-hour inventory on the site at 1,411 deals, drew ZERO
    // impressions on its /happy-hours/ twin. Pointing this route at the
    // better-converting one consolidates the signal instead of splitting it.
    // Safe target: /happy-hours/<hood> 404s only on unknown slugs, and real
    // hoods with no happy-hour inventory still render via its drink-specials
    // fallback. Verified 200 for all 16 hoods carrying traffic on either route.
    alternates: {
      canonical:
        config.apiValue === "happy_hour"
          ? `https://www.312deals.com/happy-hours/${params.slug}`
          : url,
    },
  }
}

export default async function NeighborhoodDealTypePage({
  params,
}: {
  params: { slug: string; dealType: string }
}) {
  const config = DEAL_TYPE_SLUGS[params.dealType]
  if (!config) notFound()

  const deals = await getDeals(params.slug, params.dealType)

  // 0-deal hood × deal-type combos are thin content, and this used to
  // redirect() to the parent hood. That redirect could never fire: the
  // Suspense boundary comes from /neighborhoods/[slug]/loading.tsx, one
  // segment ABOVE this route, so the streamed 200 header commits before this
  // line runs. Every such URL answered 200 with no <h1> at all -- just the
  // skeleton (verified 2026-08-22 on albany-park and auburn-gresham brunch).
  // Unlike /venues/[slug], no layout here can sit above that boundary, since
  // the parent layout does not receive the dealType param.
  //
  // So render a real page instead of attempting a redirect. generateMetadata
  // already marks these noindex,nofollow, so the SEO goal is met without the
  // 307, and a visitor gets an honest empty state with somewhere to go rather
  // than a skeleton that never resolves.
  if (deals.length === 0) {
    const emptyName = slugToName(params.slug)
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            No {config.label.toLowerCase()} in {emptyName} yet
          </h1>
          <p className="mt-3 text-muted-foreground">
            We track every {config.singular} deal we can find across Chicagoland, and
            we have not turned one up in {emptyName} yet. These land as venues publish
            them, so it is worth checking back.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/neighborhoods/${params.slug}`}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              All {emptyName} deals &rarr;
            </Link>
            <Link
              href={`/deals/${params.dealType}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-brand-300 hover:text-brand-600"
            >
              {config.label} citywide
            </Link>
            <Link
              href="/search"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-brand-300 hover:text-brand-600"
            >
              Search all deals
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const name = slugToName(params.slug)
  const venueCount = uniqueVenueCount(deals)
  const topVenues = topVenueNames(deals)
  const cheapest = buildCheapestDrink(deals)

  const starts = deals.map((d) => d.start_time).filter(Boolean) as string[]
  const commonStart = starts.length > 0
    ? starts.sort((a, b) => starts.filter((v) => v === a).length - starts.filter((v) => v === b).length).pop()!
    : null

  // Related neighborhoods with the same deal type (from the deals data)
  const relatedNeighborhoods = [...new Set(
    deals.map((d) => d.neighborhood_slug).filter((s) => s && s !== params.slug)
  )].slice(0, 8)

  const pageUrl = `https://www.312deals.com/neighborhoods/${params.slug}/${params.dealType}`

  // FAQ, unique per page, data-driven
  const faqItems = deals.length > 0
    ? [
        {
          q: `Where can I find ${config.singular} deals in ${name}?`,
          a: `${name} has ${deals.length} ${config.singular} deal${deals.length !== 1 ? "s" : ""} at ${venueCount} venue${venueCount !== 1 ? "s" : ""}. ${topVenues.length > 0 ? `Popular spots include ${topVenues.join(", ")}.` : ""}`,
        },
        {
          q: `What are the best ${config.singular} deals in ${name}, Chicago?`,
          a: deals.slice(0, 3).map((d) => `${d.venue_name} offers ${d.title}`).join(". ") + ".",
        },
        ...(cheapest
          ? [{
              q: `What's the cheapest ${config.singular} drink deal in ${name}?`,
              a: `The cheapest drink is ${cheapest}. Browse all ${deals.length} deals for more options.`,
            }]
          : []),
        ...(commonStart
          ? [{
              q: `When do ${config.label.toLowerCase()} start in ${name}?`,
              a: `Most ${config.label.toLowerCase()} in ${name} start at ${formatTime(commonStart)}. Check individual listings for exact times.`,
            }]
          : []),
      ]
    : []

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
                      { name: name, url: `https://www.312deals.com/neighborhoods/${params.slug}` },
                      { name: config.label, url: pageUrl },
                    ])
                  ),
                }}
              />
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(
                    buildItemListJsonLd(
                      `${config.label} in ${name}, Chicago`,
                      pageUrl,
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
            <Link href="/neighborhoods" className="hover:text-foreground transition-colors">
              Neighborhoods
            </Link>
            <span>/</span>
            <Link href={`/neighborhoods/${params.slug}`} className="hover:text-foreground transition-colors">
              {name}
            </Link>
            <span>/</span>
            <span className="text-foreground">{config.label}</span>
          </nav>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <h1 className="text-2xl font-bold text-foreground">
                {config.label} in {name}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {deals.length > 0
                ? `${deals.length} ${config.singular} deal${deals.length !== 1 ? "s" : ""} at ${venueCount} venue${venueCount !== 1 ? "s" : ""} in ${name}, Chicago`
                : `No ${config.singular} deals found in ${name} yet`}
            </p>
          </div>

          {/* Data-driven prose intro, unique per page */}
          {deals.length > 0 && (
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {name} has {deals.length} {config.singular} deal{deals.length !== 1 ? "s" : ""} across {venueCount} bar{venueCount !== 1 ? "s" : ""} and restaurant{venueCount !== 1 ? "s" : ""}.
              {topVenues.length > 0 && ` Popular spots include ${topVenues.join(", ")}.`}
              {commonStart && ` Most ${config.label.toLowerCase()} start at ${formatTime(commonStart)}.`}
              {cheapest && ` The cheapest drink deal is ${cheapest}.`}
            </p>
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
                  <span className="font-semibold">{deals.length}</span> deals
                </span>
              </div>
              {commonStart && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm text-foreground">
                    Most start at <span className="font-semibold">{formatTime(commonStart)}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Deals Grid */}
          <h2 className="sr-only">{config.label} in {name}</h2>
          {deals.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No {config.singular} deals found in {name} yet.
              </p>
              <div className="mt-4 flex gap-3">
                <Link
                  href={`/neighborhoods/${params.slug}`}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  All {name} deals
                </Link>
                <Link
                  href="/submit"
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
                >
                  Submit a deal
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} variant="full" />
              ))}
            </div>
          )}

          {/* Same deal type in other neighborhoods */}
          {relatedNeighborhoods.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                {config.label} in Other Neighborhoods
              </h2>
              <div className="flex flex-wrap gap-2">
                {relatedNeighborhoods.map((nSlug) => (
                  <Link
                    key={nSlug}
                    href={`/neighborhoods/${nSlug}/${params.dealType}`}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    {slugToName(nSlug)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Other deal types in this neighborhood */}
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              More Deals in {name}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/neighborhoods/${params.slug}`}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-400"
              >
                All {name} Deals
              </Link>
              {Object.entries(DEAL_TYPE_SLUGS)
                .filter(([slug]) => slug !== params.dealType)
                .slice(0, 6)
                .map(([slug, c]) => (
                  <Link
                    key={slug}
                    href={`/neighborhoods/${params.slug}/${slug}`}
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
                <HelpCircle className="h-5 w-5" aria-hidden="true" />
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
