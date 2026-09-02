import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { GraduationCap, Store, Tag, HelpCircle, ExternalLink } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCard } from "@/components/deal-card"
import { ShowMore } from "@/components/show-more"
import type { Deal, SearchResponse } from "@/lib/types"
import {
  STUDENT_GUIDE_PAGES,
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

async function getDeals(config: (typeof STUDENT_GUIDE_PAGES)[string]): Promise<Deal[]> {
  try {
    const allDeals: Deal[] = []
    const seenIds = new Set<number>()

    for (const neighborhood of config.neighborhoods) {
      const params = new URLSearchParams({
        neighborhood,
        limit: "50",
      })
      const res = await fetch(`${API_URL}/api/v1/deals/search?${params}`, {
        next: { revalidate: 3600 },
      })
      if (!res.ok) continue
      const data: SearchResponse = await res.json()
      for (const deal of data.deals ?? []) {
        if (!seenIds.has(deal.id)) {
          seenIds.add(deal.id)
          allDeals.push(deal)
        }
      }
    }

    return allDeals
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: { school: string }
}): Promise<Metadata> {
  const config = STUDENT_GUIDE_PAGES[params.school]
  if (!config) return { title: "Student Guides | 312Deals" }

  const ogParams = new URLSearchParams({
    title: config.seoTitle,
    subtitle: config.description.slice(0, 100),
    type: config.schoolName,
  })
  const ogImageUrl = `https://www.312deals.com/api/og?${ogParams}`

  // Soft-404 guard (Mintlify Phase 7B): emit noindex when the school's
  // surrounding-neighborhood query returns 0 deals, keeps Google from
  // indexing thin pages but lets us add deals later without a redirect.
  const deals = await getDeals(config)
  const isEmpty = deals.length === 0

  return {
    title: `${config.seoTitle} | 312Deals`,
    description: config.description,
    ...(isEmpty ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `${config.seoTitle} | 312Deals`,
      description: config.description,
      url: `https://www.312deals.com/student-guides/${params.school}`,
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
      canonical: `https://www.312deals.com/student-guides/${params.school}`,
    },
  }
}

export default async function StudentGuidePage({
  params,
}: {
  params: { school: string }
}) {
  const config = STUDENT_GUIDE_PAGES[params.school]
  if (!config) notFound()

  const deals = await getDeals(config)
  const venueCount = uniqueVenueCount(deals)
  const topVenues = topVenueNames(deals)
  const cheapest = buildCheapestDrink(deals)

  const faqItems = deals.length > 0
    ? [
        {
          q: `Where can I find cheap eats near ${config.schoolName}?`,
          a: `There are ${deals.length} food and drink deal${deals.length !== 1 ? "s" : ""} at ${venueCount} venue${venueCount !== 1 ? "s" : ""} near ${config.schoolName}. ${topVenues.length > 0 ? `Popular spots include ${topVenues.join(", ")}.` : ""}`,
        },
        {
          q: `What are the best happy hours near ${config.schoolName}?`,
          a: deals.slice(0, 3).map((d) => `${d.venue_name} offers ${d.title}`).join(". ") + ".",
        },
        ...(cheapest
          ? [{
              q: `What's the cheapest drink deal near ${config.schoolName}?`,
              a: `The cheapest drink deal is ${cheapest}. Browse all ${deals.length} deals for more options.`,
            }]
          : []),
      ]
    : []

  const otherSchools = Object.entries(STUDENT_GUIDE_PAGES).filter(
    ([slug]) => slug !== params.school
  )

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
                  { name: "Student Guides", url: "https://www.312deals.com/student-guides" },
                  { name: config.schoolName, url: `https://www.312deals.com/student-guides/${params.school}` },
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
                      `https://www.312deals.com/student-guides/${params.school}`,
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
            <Link href="/student-guides" className="hover:text-foreground transition-colors">
              Student Guides
            </Link>
            <span>/</span>
            <span className="text-foreground">{config.schoolName}</span>
          </nav>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": config.seoTitle,
                "description": config.description,
                "url": `https://www.312deals.com/student-guides/${params.school}`,
                "author": {
                  "@type": "Organization",
                  "name": "312Deals",
                  "url": "https://www.312deals.com",
                },
                "publisher": {
                  "@type": "Organization",
                  "name": "312Deals",
                  "url": "https://www.312deals.com",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://www.312deals.com/apple-touch-icon.png",
                  },
                },
                "image": {
                  "@type": "ImageObject",
                  "url": `https://www.312deals.com/api/og?${new URLSearchParams({ title: config.seoTitle, subtitle: config.description.slice(0, 100), type: config.schoolName })}`,
                  "width": 1200,
                  "height": 630,
                },
                "datePublished": "2026-02-01",
                "dateModified": new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="h-5 w-5 text-brand-500" />
              <h1 className="text-2xl font-bold text-foreground">
                {config.seoTitle}
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Last updated February 2026
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {config.description}
            </p>
            {config.externalLinks.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Related resources:{" "}
                {config.externalLinks.map((link, i) => (
                  <span key={link.url}>
                    {i > 0 && ", "}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {link.label}
                      <ExternalLink className="inline h-3 w-3" />
                    </a>
                  </span>
                ))}
                .
              </p>
            )}
          </div>

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
          <h2 className="sr-only">Deals Near {config.schoolName}</h2>
          {deals.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No deals found near {config.schoolName} yet.
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
                initialCount={30}
                noun="deals"
              />
            </div>
          )}

          {/* Related neighborhoods */}
          {config.neighborhoods.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Neighborhoods Near {config.schoolName}
              </h2>
              <div className="flex flex-wrap gap-2">
                {config.neighborhoods.map((slug) => (
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

          {/* Other schools */}
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              More Student Guides
            </h2>
            <div className="flex flex-wrap gap-2">
              {otherSchools.map(([slug, c]) => (
                <Link
                  key={slug}
                  href={`/student-guides/${slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                >
                  {c.schoolName}
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
