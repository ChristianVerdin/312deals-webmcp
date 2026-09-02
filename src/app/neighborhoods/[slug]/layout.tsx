import type { Metadata } from "next"
import { notFound } from "next/navigation"

const API_URL = process.env.API_URL || "http://localhost:8000"

async function fetchNeighborhoodData(slug: string) {
  try {
    const [summaryRes, dealsRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/neighborhoods/summary?neighborhood=${slug}`, {
        next: { revalidate: 3600 },
      }),
      fetch(`${API_URL}/api/v1/deals/search?neighborhood=${slug}&limit=50`, {
        next: { revalidate: 3600 },
      }),
    ])
    const summary = summaryRes.ok ? await summaryRes.json() : null
    const deals = dealsRes.ok ? await dealsRes.json() : null
    return { summary: summary?.neighborhoods?.[0], deals: deals?.deals }
  } catch {
    return { summary: null, deals: null }
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const { summary, deals } = await fetchNeighborhoodData(params.slug)
  const name =
    summary?.name ||
    params.slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())

  const dealCount = summary?.deal_count ?? deals?.length ?? 0
  const venueCount = summary?.venue_count ?? 0

  const title = `Best Happy Hour Deals in ${name}, Chicago | 312Deals`
  const description = `${dealCount} food & drink deals at ${venueCount} bars & restaurants in ${name}, Chicago. Find happy hours, daily specials, and brunch deals on 312Deals.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "312Deals",
      images: [{
        url: `https://www.312deals.com/api/og?title=${encodeURIComponent(name)}&subtitle=${encodeURIComponent(`${dealCount} deals at ${venueCount} venues`)}`,
        width: 1200,
        height: 630,
        alt: `${name} Food & Drink Deals, 312Deals`,
      }],
    },
    alternates: {
      canonical: `https://www.312deals.com/neighborhoods/${params.slug}`,
    },
  }
}

export default async function NeighborhoodLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  // Existence check ABOVE the page's loading.tsx Suspense so notFound() yields a
  // real 404 (mirrors page.tsx's "no deals and no summary" guard). Fetch is deduped.
  const { summary, deals } = await fetchNeighborhoodData(params.slug)
  if ((deals?.length ?? 0) === 0 && !summary) notFound()
  return children
}
