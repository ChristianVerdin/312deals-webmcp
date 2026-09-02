import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Redirect map for merged/deduped venue slugs.
 * Generated from venues with data_quality_notes LIKE 'merged_into_venue_%'
 * where old_slug != new_slug.
 */
const VENUE_REDIRECTS: Record<string, string> = {
  "avaspi-anatolian-tapas": "avaspi",
  "beatrix-streeterville": "beatrix",
  "becks-chicago": "becks",
  "bub-city": "bub-city-river-north",
  "daisys-po-boy-and-tavern": "daisys-poboy-and-tavern",
  "ema": "ema-river-north",
  "felix-modern-american-dining": "felix",
  "gaslight-bar-grill": "gaslight",
  "genes-bistro-big-bowl-tallboy-taco": "genes-bistro-big-bowl-tallboy-ta",
  "huaraches": "huaraches-bright-park",
  "lil-babareeba": "lil-ba-ba-reeba",
  "middlebrow": "middle-brow",
  "sluggers": "sluggers-grill",
  "sushi-san": "sushi-san-river-north",
  "wildfire": "wildfire-chicago",
  // Merged 2026-03-19
  "duffys-tavern-grille": "duffys-tavern-and-grille",
  "charlies-chicago": "charlies",
  "cheesies-pub-grub-lost-reef-lounge": "cheesies-pub-grub",
  "almost-home-tavern-grill": "almost-home-tavern",
  "nancys-pizzeria": "nancys-home-of-stuffed-pizza",
  "merkles-bar-grill": "merkles",
  "sports-corner": "the-sports-corner",
  "trader-todds-restaurant-bar": "trader-todds",
  "scarlet-bar": "scarlet",
  "splash-chicago": "splash",
  "replay": "replay-lakeview",
  "kit-kat-club": "kit-kat-lounge",
  "kit-kat-lounge-and-restaurant": "kit-kat-lounge",
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only check /venues/ paths
  if (pathname.startsWith("/venues/")) {
    const slug = pathname.split("/")[2]
    if (slug && VENUE_REDIRECTS[slug]) {
      const url = request.nextUrl.clone()
      url.pathname = `/venues/${VENUE_REDIRECTS[slug]}`
      return NextResponse.redirect(url, 301)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/venues/:slug*",
}
