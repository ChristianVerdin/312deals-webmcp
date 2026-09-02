import Link from "next/link"
import type { Metadata } from "next"
import { MapPin } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { LANDMARK_PAGES, slugToName } from "@/lib/seo-utils"
import type { SearchResponse } from "@/lib/types"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Deals Near Chicago Landmarks & Stadiums | 312Deals",
  description:
    "Find bars, restaurants, and deals near Chicago's biggest venues, Wrigley Field, United Center, McCormick Place, Navy Pier, Soldier Field, and more.",
  openGraph: {
    title: "Deals Near Chicago Landmarks & Stadiums | 312Deals",
    description:
      "Bars, restaurants, and deals near Chicago's biggest stadiums, arenas, and landmarks.",
    url: "https://www.312deals.com/near",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: "https://www.312deals.com/api/og?title=Deals+Near+Chicago+Landmarks&subtitle=Stadiums+arenas+and+convention+centers",
      width: 1200,
      height: 630,
      alt: "312Deals, Deals Near Chicago Landmarks",
    }],
  },
  alternates: {
    canonical: "https://www.312deals.com/near",
  },
}

const API_URL = process.env.API_URL || "http://localhost:8000"

async function getDealCount(neighborhoods: string[]): Promise<number> {
  try {
    let total = 0
    const seenIds = new Set<number>()
    for (const neighborhood of neighborhoods) {
      const res = await fetch(
        `${API_URL}/api/v1/deals/search?neighborhood=${neighborhood}&limit=50`,
        { next: { revalidate: 3600 } }
      )
      if (!res.ok) continue
      const data: SearchResponse = await res.json()
      for (const deal of data.deals ?? []) {
        if (!seenIds.has(deal.id)) {
          seenIds.add(deal.id)
          total++
        }
      }
    }
    return total
  } catch {
    return 0
  }
}

export default async function NearIndex() {
  const landmarks = await Promise.all(
    Object.entries(LANDMARK_PAGES).map(async ([slug, config]) => ({
      slug,
      ...config,
      dealCount: await getDealCount(config.neighborhoods),
    }))
  )

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Deals Near Chicago Landmarks & Stadiums",
    description: `Food and drink deal guides for ${landmarks.length} Chicago landmarks and venues`,
    url: "https://www.312deals.com/near",
    numberOfItems: landmarks.length,
    itemListElement: landmarks.map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "WebPage",
        name: l.landmarkName,
        url: `https://www.312deals.com/near/${l.slug}`,
        description: l.description,
      },
    })),
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
          />
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-6 w-6 text-brand-500" />
              <h1 className="text-2xl font-bold text-foreground">
                Deals Near Chicago Landmarks
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Headed to a game, concert, or convention? Find bars, restaurants, and deals
              within walking distance of Chicago&apos;s biggest venues.
            </p>
          </div>

          {/* Landmark Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {landmarks.map((l) => (
              <Link
                key={l.slug}
                href={`/near/${l.slug}`}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-brand-300"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-5 w-5 text-brand-500" />
                  <h2 className="font-semibold text-foreground group-hover:text-brand-600 transition-colors">
                    {l.landmarkName}
                  </h2>
                </div>
                <div className="flex items-center gap-1 mb-3 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {l.neighborhoods.map((s) => slugToName(s)).join(", ")}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {l.description}
                </p>
                <span className="text-sm font-semibold text-brand-500">
                  {l.dealCount} deal{l.dealCount !== 1 ? "s" : ""} nearby
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
