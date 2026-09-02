import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import NeighborhoodsBrowser from "@/components/neighborhoods-browser"
import { AskAILink } from "@/components/ask-ai-link"
import type { Neighborhood, NeighborhoodResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"

const ZONE_LABELS: Record<string, string> = {
  city: "City of Chicago",
  north_shore: "North Shore",
  northwest_suburbs: "Northwest Suburbs",
  western_suburbs: "Western Suburbs",
  south_suburbs: "South Suburbs",
}

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

export async function generateMetadata(): Promise<Metadata> {
  const neighborhoods = await getNeighborhoods()
  const totalDeals = neighborhoods.reduce((sum, n) => sum + n.active_deal_count, 0)
  const count = neighborhoods.length

  return {
    title: `Chicago Neighborhoods, ${count} Areas, ${totalDeals.toLocaleString()}+ Deals | 312Deals`,
    description: `Browse food & drink deals across ${count} Chicago-area neighborhoods. From River North and Wicker Park to Logan Square and the suburbs, find happy hours, daily specials, brunch deals, and more near you.`,
  }
}

export default async function NeighborhoodsPage() {
  const neighborhoods = await getNeighborhoods()

  // Group by zone for the crawler-friendly hidden section
  const byZone = neighborhoods.reduce<Record<string, Neighborhood[]>>((acc, n) => {
    const zone = n.zone || "city"
    if (!acc[zone]) acc[zone] = []
    acc[zone].push(n)
    return acc
  }, {})

  const totalDeals = neighborhoods.reduce((sum, n) => sum + n.active_deal_count, 0)

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <NeighborhoodsBrowser initialNeighborhoods={neighborhoods} />

      {/* Server-rendered neighborhood links for crawlers */}
      <noscript>
        <style>{`.ssr-neighborhoods { display: block !important; }`}</style>
      </noscript>
      <section
        className="ssr-neighborhoods"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
        data-nosnippet=""
      >
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h2>Chicago Neighborhood Deals, {neighborhoods.length} Areas, {totalDeals.toLocaleString()}+ Deals</h2>
          <p>
            Browse food and drink deals across {neighborhoods.length} Chicago-area neighborhoods.
            Find happy hours, daily specials, brunch deals, and late-night specials near you.
          </p>

          {Object.entries(byZone)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([zone, hoods]) => (
            <div key={zone}>
              <h3>{ZONE_LABELS[zone] ?? zone}</h3>
              <ul>
                {hoods
                  .sort((a, b) => b.active_deal_count - a.active_deal_count)
                  .map((n) => (
                  <li key={n.slug}>
                    <Link href={`/neighborhoods/${n.slug}`}>
                      {n.name}, {n.active_deal_count} deals{n.venue_count ? `, ${n.venue_count} venues` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <nav>
            <h3>Browse by Deal Type</h3>
            <ul>
              <li><Link href="/deals/happy-hours">Happy Hour Deals</Link></li>
              <li><Link href="/deals/daily-specials">Daily Specials</Link></li>
              <li><Link href="/deals/brunch-deals">Brunch Deals</Link></li>
              <li><Link href="/deals/late-night">Late Night Deals</Link></li>
              <li><Link href="/deals/game-day">Game Day Specials</Link></li>
            </ul>
            <h3>More</h3>
            <ul>
              <li><Link href="/search">Search All Deals</Link></li>
              <li><AskAILink page="/neighborhoods">Ask About Deals (AI Chat)</AskAILink></li>
              <li><Link href="/cuisine">Browse by Cuisine</Link></li>
              <li><Link href="/happy-hours">Happy Hours by Neighborhood</Link></li>
            </ul>
          </nav>
        </div>
      </section>

      <Footer />
    </div>
  )
}
