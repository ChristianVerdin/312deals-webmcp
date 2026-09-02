import { notFound, redirect } from "next/navigation"

const API_URL = process.env.API_URL || "http://localhost:8000"

interface VenueLayoutProps {
  children: React.ReactNode
  params: { slug: string }
}

async function fetchVenue(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/venues/${slug}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// NOTE: no generateMetadata here on purpose. Next.js merges layout and page
// metadata with the DEEPEST segment winning, so page.tsx's generateMetadata
// silently shadowed the version that used to live here -- the happy-hour-aware
// title shipped in 6d12a71 never reached a single live page. The title/meta
// logic now lives solely in page.tsx. This layout exists only for the
// above-Suspense existence guard.
export default async function VenueLayout({ children, params }: VenueLayoutProps) {
  // Every one of these checks must live ABOVE the page's loading.tsx Suspense
  // boundary. Below it the streamed 200 header commits first, so notFound() and
  // redirect() can no longer set a status and the visitor is left looking at the
  // loading skeleton forever.
  //
  // The existence check was moved up for that reason. The zero-deal redirect was
  // not, and had the same defect: 3,827 active venues have no deals, and every
  // one of them served a 200 with no <h1> at all -- just the skeleton -- to users
  // and to Googlebot (verified 2026-08-22 on the-irish-oak, jin-ju, the-nook and
  // shinya-ramen-house, none of which had been touched). page.tsx still carries
  // the same conditional, but it can only ever run too late to matter.
  //
  // Same fetch as page's getVenue → deduped by Next within the request.
  const venue = await fetchVenue(params.slug)
  if (!venue) notFound()

  // Deactivated venues stay resolvable by slug because the API does not filter
  // on is_active, so they need the same treatment as the deal-less ones.
  const deactivated = venue.is_active === 0 || venue.is_active === false
  const noDeals = (venue.deals?.length ?? 0) === 0
  if (deactivated || noDeals) {
    // Prefer the neighborhood over a 404: it keeps the visitor moving and
    // consolidates link equity instead of dead-ending it.
    if (venue.neighborhood_slug) {
      redirect(`/neighborhoods/${venue.neighborhood_slug}`)
    }
    notFound()
  }

  return children
}
