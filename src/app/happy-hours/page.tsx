import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Tag } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { ShowMore } from "@/components/show-more"
import type { NeighborhoodResponse, Neighborhood } from "@/lib/types"
import { DEAL_TYPE_PAGES } from "@/lib/seo-utils"
import { stats } from "@/lib/product-stats"

export const revalidate = 3600

export const metadata: Metadata = {
  title: `Happy Hours by Chicago Neighborhood, All ${stats.neighborhoods} Areas | 312Deals`,
  description:
    "Browse happy hours in every Chicago neighborhood, River North, West Loop, Lincoln Park, Lakeview, and 140+ more. Discounted cocktails, cheap beers, and appetizer specials tonight.",
  openGraph: {
    title: `Happy Hours by Chicago Neighborhood, All ${stats.neighborhoods} Areas | 312Deals`,
    description:
      "Browse happy hours in every Chicago neighborhood, River North, West Loop, Lincoln Park, Lakeview, and 140+ more.",
    url: "https://www.312deals.com/happy-hours",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: "https://www.312deals.com/api/og?title=Happy+Hours+by+Neighborhood&subtitle=All+145%2B+Chicago+areas",
      width: 1200,
      height: 630,
      alt: "312Deals, Chicago Happy Hours",
    }],
  },
  alternates: {
    canonical: "https://www.312deals.com/happy-hours",
  },
}

const API_URL = process.env.API_URL || "http://localhost:8000"

async function getNeighborhoods(): Promise<Neighborhood[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/neighborhoods`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data: NeighborhoodResponse = await res.json()
    return data.neighborhoods ?? []
  } catch {
    return []
  }
}

export default async function HappyHoursIndexPage() {
  const neighborhoods = await getNeighborhoods()
  const sorted = [...neighborhoods].sort(
    (a, b) => b.active_deal_count - a.active_deal_count
  )
  const totalDeals = sorted.reduce((s, n) => s + n.active_deal_count, 0)

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "ItemList",
                name: "Chicago Happy Hours by Neighborhood",
                description: `Happy hour deals across ${neighborhoods.length} Chicago neighborhoods`,
                url: "https://www.312deals.com/happy-hours",
                numberOfItems: neighborhoods.length,
                itemListElement: sorted.slice(0, 30).map((n, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  item: {
                    "@type": "Place",
                    name: `${n.name} Happy Hours`,
                    url: `https://www.312deals.com/happy-hours/${n.slug}`,
                  },
                })),
              }),
            }}
          />

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-brand-500" />
              <h1 className="text-2xl font-bold text-foreground">
                Chicago Happy Hours
              </h1>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Browse happy hour deals across {neighborhoods.length} Chicago-area neighborhoods.
              {totalDeals > 0 && ` ${totalDeals} deals and counting.`}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              After-work drink specials are a Chicago institution. Most bars and restaurants run promotions between 3 PM and 6 PM on weekdays, though timing varies by neighborhood and venue. River North and the Loop cater to the office crowd with discounted wells and half-price appetizers. Wicker Park and Bucktown lean into craft cocktail pricing with $2-3 off specialty drinks. Lincoln Park spots often extend offers until 7 PM to catch the dinner crowd. Further north, Andersonville and Edgewater feature laid-back patio specials in summer. Each neighborhood page below shows every active listing with pricing, hours, and days so you can pick the best spot for your schedule. Click any area to see the full rundown of what is available there.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              New here? Read the complete{" "}
              <Link href="/guides/chicago-happy-hours" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Chicago Happy Hour Guide</Link>{" "}
              the cheapest drinks, when happy hours start, and the top neighborhoods ranked by deal count.
            </p>
          </div>

          {/* Neighborhood grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <ShowMore
              items={sorted.map((n) => (
                <Link
                  key={n.slug}
                  href={`/happy-hours/${n.slug}`}
                  className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-brand-300"
                >
                  <span className="text-sm font-semibold text-foreground group-hover:text-brand-600 transition-colors">
                    {n.name}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    {n.active_deal_count} deal{n.active_deal_count !== 1 ? "s" : ""}
                  </span>
                  {n.zone && n.zone !== "city" && (
                    <span className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {n.zone.replace(/_/g, " ")}
                    </span>
                  )}
                </Link>
              ))}
              initialCount={36}
              noun="neighborhoods"
            />
          </div>

          {/* Related deal types */}
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Browse by Deal Type
            </h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DEAL_TYPE_PAGES)
                .filter(([slug]) => slug !== "happy-hours")
                .map(([slug, config]) => (
                  <Link
                    key={slug}
                    href={`/deals/${slug}`}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    {config.label}
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
        </div>
      </div>
      <Footer />
    </div>
  )
}
