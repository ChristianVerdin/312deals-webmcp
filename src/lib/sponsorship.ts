/**
 * The paid Sponsored Listing checkout link.
 *
 * Single source of truth for `/advertise` and `/featured`. Set
 * NEXT_PUBLIC_FEATURED_LISTING_STRIPE_LINK to the live Stripe Payment Link.
 *
 * There is deliberately NO hardcoded URL fallback. Both pages previously
 * defaulted to the "312Deals World Cup Spotlight" link, which kept selling an
 * offer that expired at the World Cup Final on 2026-07-19 — a buyer reaching
 * that checkout saw a dead promotion. When the env var is unset we send people
 * to email instead, which is always safe.
 */
export const SPONSORSHIP_EMAIL =
  "mailto:deals@312deals.com?subject=Sponsored%20Listing%20Inquiry"

/** Price in whole dollars — keep in sync with the Stripe price. */
export const SPONSORSHIP_PRICE_USD = 39

/** Days of placement a purchase buys — mirrors FEATURED_DEFAULT_DAYS on the API. */
export const SPONSORSHIP_DAYS = 30

/** The live Stripe Payment Link, or null when unconfigured. */
export function sponsorshipCheckoutUrl(): string | null {
  const link = (process.env.NEXT_PUBLIC_FEATURED_LISTING_STRIPE_LINK || "").trim()
  return link.startsWith("https://") ? link : null
}

/** Where the "Get Featured" CTA should point: checkout if live, else email. */
export function sponsorshipCtaHref(): string {
  return sponsorshipCheckoutUrl() ?? SPONSORSHIP_EMAIL
}
