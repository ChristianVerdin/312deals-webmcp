import Link from "next/link"
import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import {
  ArrowLeft,
  MapPin,
  Flag,
  Phone,
  Globe,
  Star,
  Clock,
  DollarSign,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCard } from "@/components/deal-card"
import { DealTypeBadge } from "@/components/deal-type-badge"
import { ActiveNowIndicator } from "@/components/active-now-indicator"
import { OpenStatus, HoursTable } from "@/components/open-status"
import { isDealActiveNow, formatDays, formatTimeRange } from "@/lib/deal-utils"
import { getLowestDealPrice, buildBreadcrumbJsonLd, buildFaqJsonLd, buildCheapestDrink, CUISINE_PAGES, DEAL_TYPE_SLUGS } from "@/lib/seo-utils"
import { proxyPhotoUrl } from "@/lib/utils"
import { withAffiliateId, inferNetwork } from "@/lib/affiliate"
import { AffiliateLink } from "@/components/affiliate-link"
import { AskAILink } from "@/components/ask-ai-link"
import { AdvertiseCta } from "@/components/advertise-cta"
import type { Venue, Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"

// ─── Data fetching ──────────────────────────────────────────

async function getVenue(slug: string): Promise<Venue | null> {
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

// ─── Metadata ────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const venue = await getVenue(params.slug)
  if (!venue) return { title: "Venue Not Found | 312Deals" }

  const deals = venue.deals ?? []
  const dealCount = deals.length
  // 634 indexable venues have no neighborhood; interpolating it raw shipped
  // "<title>Bitter Pops Deals, null | 312Deals</title>" to Google (seen live
  // 2026-08-22). Null it out here so every clause below drops rather than
  // renders the word "null".
  const hood: string | null =
    typeof venue.neighborhood === "string" && venue.neighborhood.trim() !== ""
      ? venue.neighborhood
      : null
  const hasAddress =
    typeof venue.address === "string" && venue.address.trim() !== ""

  // Lead with the venue's dominant deal type, not a generic "Deals". Branded
  // local queries are overwhelmingly "<venue> happy hour" / "<venue> specials",
  // and a title that echoes the query is the whole CTR lever here: 51 page-1
  // venue queries drew 1,352 impressions and zero clicks under the old
  // "<name> Deals, <hood>" wording (GSC 2026-07-25..08-21).
  const typeCounts = new Map<string, number>()
  for (const d of deals) {
    if (d.deal_type) typeCounts.set(d.deal_type, (typeCounts.get(d.deal_type) ?? 0) + 1)
  }
  const hookFor: Record<string, string> = {
    happy_hour: "Happy Hour",
    brunch_deal: "Brunch Deals",
    late_night: "Late-Night Specials",
    game_day: "Game Day Specials",
    daily_special: "Daily Specials",
  }
  // Happy hour wins whenever present -- it is the highest-demand query class
  // (344 queries / 6,600 impressions in range) even when it is not the modal type.
  let hook = "Deals"
  if (typeCounts.has("happy_hour")) {
    hook = hookFor.happy_hour
  } else {
    let best: string | null = null
    let bestN = 0
    for (const [t, n] of typeCounts) {
      if (n > bestN && hookFor[t]) { best = t; bestN = n }
    }
    if (best) hook = hookFor[best]
    else if (dealCount === 0) hook = "Menu & Info"
  }

  // Build title that fits within 60 characters, shedding the least valuable
  // part first: neighborhood, then the hook, then the brand suffix.
  const MAX_TITLE = 60
  const candidates = [
    ...(hood ? [`${venue.name} ${hook}, ${hood} | 312Deals`] : []),
    `${venue.name} ${hook} | 312Deals`,
    ...(hood ? [`${venue.name} Deals, ${hood} | 312Deals`] : []),
    `${venue.name} Deals | 312Deals`,
    `${venue.name} | 312Deals`,
  ]
  let title = candidates.find((c) => c.length <= MAX_TITLE) ?? ""
  if (!title) {
    const suffix = " | 312Deals"
    title = venue.name.slice(0, MAX_TITLE - suffix.length).trimEnd() + suffix
  }

  // Build a specific, CTR-optimized description using actual deal data
  let description: string
  if (dealCount > 0) {
    const parts: string[] = []

    // Find lowest price across all deals
    let lowestPrice: number | null = null
    for (const d of deals) {
      const p = getLowestDealPrice(d)
      if (p != null && (lowestPrice === null || p < lowestPrice)) lowestPrice = p
    }

    // Get unique deal types present
    const dealTypes = [...new Set(deals.map(d => d.deal_type))]
    const typeLabels: Record<string, string> = {
      happy_hour: "happy hour",
      daily_special: "daily specials",
      brunch_deal: "brunch deals",
      late_night: "late-night specials",
      chain_app_deal: "app deals",
      game_day: "game day specials",
      seasonal_lto: "limited-time offers",
    }
    const typeNames = dealTypes.slice(0, 3).map(t => typeLabels[t] || t.replace(/_/g, " ")).filter(Boolean)

    // Lead with a concrete deal and its day/time when we have one. The snippet
    // showing "Happy Hour: Mon-Fri 3-6pm" answers the query in the SERP and is
    // a stronger CTR lever than an abstract deal count.
    const topDeal = deals.find((d) => d.deal_type === "happy_hour") ?? deals[0]
    if (topDeal?.title) {
      // 18,908 of 76,984 active titles already spell out the schedule (the
      // freshness writer emits "Happy Hour: Mon-Thu 4-6 PM"), so appending the
      // formatted range unconditionally produced "... 3-5 PM: Tue-Fri 3PM-5PM".
      // Only append when the title carries no time of its own.
      const titleHasTime = /\d\s*(am|pm)|\d\s*[-\u2013]\s*\d/i.test(topDeal.title)
      const when = titleHasTime
        ? ""
        : [
            formatDays(topDeal.days_available),
            formatTimeRange(topDeal.start_time, topDeal.end_time, topDeal.is_all_day ? 1 : 0),
          ]
            .filter(Boolean)
            .join(" ")
      parts.push(when ? `${topDeal.title}: ${when}` : topDeal.title)
    }

    // Then count + venue name
    parts.push(`${dealCount} deal${dealCount !== 1 ? "s" : ""} at ${venue.name}`)

    // Add price hook if available
    if (lowestPrice != null && lowestPrice > 0) {
      parts[parts.length - 1] += `, from $${lowestPrice % 1 === 0 ? lowestPrice.toFixed(0) : lowestPrice.toFixed(2)}`
    }

    // Add deal types
    if (typeNames.length > 0) {
      parts.push(typeNames.join(", "))
    }

    // Add neighborhood + rating
    const ratingStr = venue.google_rating ? ` (${venue.google_rating}★)` : ""
    parts.push(`${hood ? `${hood}, ` : ""}Chicago${ratingStr}`)

    description = parts.join(". ") + "."
  } else {
    description = `Discover food & drink deals and specials at ${venue.name} in ${hood ? `${hood}, ` : ""}Chicago.`
  }

  const ogParams = new URLSearchParams({
    title: venue.name,
    subtitle: dealCount > 0 ? `${dealCount} deal${dealCount !== 1 ? "s" : ""} available` : "",
    neighborhood: hood ?? "Chicago",
  })
  const ogImageUrl = `https://www.312deals.com/api/og?${ogParams}`

  return {
    title,
    description,
    // Prevent indexing of thin venue pages with zero deals; follow: false stops crawl budget waste
    ...(dealCount === 0 ? { robots: { index: false, follow: false } } : {}),
    // A venue with neither a street address nor a neighborhood is a chain-HQ
    // aggregator record ("Popeyes", "Pizza Hut", "Lettuce Entertain You"), not
    // a place anyone can go. 592 such pages were indexable and drew 2,243
    // impressions for 4 clicks -- 0.18% CTR -- because Google cannot tell them
    // apart: Pizza Hut was split across 3 near-identical pages and Domino's
    // across 4 (GSC 2026-07-25..08-21). 416 of them duplicate an addressed
    // sibling outright. They cannot serve local intent, which is the entire
    // query base, so keep them out of the index. `follow: true` (unlike the
    // zero-deal case) because these pages do carry real chain deals and link
    // out to neighborhood and deal-type pages that should still be crawled.
    ...(dealCount > 0 && !hood && !hasAddress
      ? { robots: { index: false, follow: true } }
      : {}),
    openGraph: {
      title,
      description,
      url: `https://www.312deals.com/venues/${params.slug}`,
      siteName: "312Deals",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: venue.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `https://www.312deals.com/venues/${params.slug}`,
    },
  }
}

async function getRelatedDeals(
  neighborhoodSlug: string | null,
  excludeSlug: string
): Promise<Deal[]> {
  if (!neighborhoodSlug) return []
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?neighborhood=${neighborhoodSlug}&limit=30`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    // Deduplicate by venue_slug, exclude current venue
    const seen = new Set<string>()
    seen.add(excludeSlug)
    return (data.deals ?? []).filter((d) => {
      if (!d.venue_slug || seen.has(d.venue_slug)) return false
      seen.add(d.venue_slug)
      return true
    }).slice(0, 6)
  } catch {
    return []
  }
}

// ─── Social SVG icons ───────────────────────────────────────

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function YelpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.16 12.594l-4.995 1.433c-.96.276-1.74-.8-1.176-1.63l2.905-4.308a1.072 1.072 0 011.596-.206 7.26 7.26 0 011.96 3.202c.22.738-.074 1.074-.29 1.509zm-4.213 5.89a7.3 7.3 0 01-3.033 2.166c-.71.244-1.227-.238-1.397-.544l-2.166-4.576c-.424-.893.478-1.784 1.36-1.346l4.93 2.42c.496.244.662.83.306 1.88zm-7.142-2.907L4.288 17.6a1.073 1.073 0 01-1.461-.578 7.26 7.26 0 01-.243-3.783c.15-.73.62-.96.883-1.088l5.13-2.025c.946-.372 1.77.72 1.246 1.648l-1.037 1.803zm.857-5.01L6.283 5.376c-.38-.662.032-1.42.55-1.66A7.2 7.2 0 0112.002 3c.774.01 1.058.47 1.187.76l2.44 5.59c.414.946-.655 1.77-1.617 1.248l-4.356-2.03z" />
    </svg>
  )
}

// ─── Star rating ────────────────────────────────────────────

function StarRating({
  rating,
  count,
}: {
  rating: number
  count: number | null
}) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.3
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < full) return "full"
    if (i === full && half) return "half"
    return "empty"
  })

  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex">
        {stars.map((s, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              s === "empty"
                ? "text-muted-foreground/30"
                : "fill-amber-400 text-amber-400"
            }`}
            strokeWidth={s === "half" ? 2 : 0}
          />
        ))}
      </span>
      <span className="text-sm font-semibold text-foreground">
        {rating.toFixed(1)}
      </span>
      {count != null && (
        <span className="text-sm text-muted-foreground">({count})</span>
      )}
    </span>
  )
}

// ─── Price level ────────────────────────────────────────────

function PriceLevel({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 4 }, (_, i) => (
        <DollarSign
          key={i}
          className={`h-3.5 w-3.5 ${
            i < level ? "text-foreground" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  )
}

// ─── URL normalizer ─────────────────────────────────────────

/** Upgrade http:// to https:// for outbound links */
function ensureHttps(url: string): string {
  return url.startsWith("http://") ? url.replace("http://", "https://") : url
}

// ─── Helpers ────────────────────────────────────────────────

const DAY_NAME_MAP: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
}

function formatTimeShort(t: string | null): string {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`
}

function buildDealProse(deal: Deal): string {
  const parts: string[] = []

  const dayNames = (Array.isArray(deal.days_available) ? deal.days_available : []).map((d) => DAY_NAME_MAP[d] || d)
  if (dayNames.length > 0 && deal.start_time && deal.end_time) {
    parts.push(
      `${deal.title} runs ${dayNames.join(", ")} from ${formatTimeShort(deal.start_time)} to ${formatTimeShort(deal.end_time)}.`
    )
  } else if (deal.is_all_day) {
    parts.push(`${deal.title} is available all day.`)
  } else {
    parts.push(`${deal.title}.`)
  }

  const drinks = Array.isArray(deal.drink_items) ? deal.drink_items : []
  if (drinks.length > 0) {
    const drinkStr = drinks
      .slice(0, 5)
      .map((d) => (d.deal_price ? `$${d.deal_price} ${d.name}` : d.name))
      .join(", ")
    parts.push(drinkStr + ".")
  }

  const food = Array.isArray(deal.food_items) ? deal.food_items : []
  if (food.length > 0) {
    const foodStr = food
      .slice(0, 5)
      .map((f) => (f.deal_price ? `$${f.deal_price} ${f.name}` : f.name))
      .join(", ")
    parts.push(foodStr + ".")
  }

  return parts.join(" ")
}

// ─── JSON-LD ────────────────────────────────────────────────

const SCHEMA_DAY_MAP: Record<string, string> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
}

/** Convert "11:30 AM", "2:00 PM", "12 PM" etc. to "HH:MM" 24h format. */
function to24h(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ap = m[3]?.toUpperCase()
  if (Number.isNaN(h) || h > 23 || min > 59) return null
  if (ap === "PM" && h < 12) h += 12
  if (ap === "AM" && h === 12) h = 0
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`
}

/** Build OpeningHoursSpecification entries from the venue's hours_json.
 *  hours_json is either {monday: "11AM-10PM", ...} or
 *  ["Monday: 11AM-10PM", ...]. Each day may have multiple ranges
 *  separated by commas (lunch + dinner). Each range becomes its own
 *  OpeningHoursSpecification entry. Days that are "closed", missing,
 *  or unparseable are skipped silently. Returns [] if nothing parses. */
function buildOpeningHoursSpec(hoursJson: string | null | undefined): Array<Record<string, string>> {
  if (!hoursJson) return []
  let parsed: Record<string, string> | null = null
  try {
    const raw = JSON.parse(hoursJson)
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      parsed = raw as Record<string, string>
    } else if (Array.isArray(raw)) {
      parsed = {}
      for (const entry of raw) {
        const cleaned = String(entry).replace(/[   ]/g, " ").trim()
        const colonIdx = cleaned.indexOf(":")
        if (colonIdx === -1) continue
        const day = cleaned.slice(0, colonIdx).trim().toLowerCase()
        const hours = cleaned.slice(colonIdx + 1).trim()
        if (SCHEMA_DAY_MAP[day]) parsed[day] = hours
      }
    }
  } catch {
    return []
  }
  if (!parsed) return []

  const out: Array<Record<string, string>> = []
  for (const [day, hoursRaw] of Object.entries(parsed)) {
    const dayUrl = SCHEMA_DAY_MAP[day.toLowerCase()]
    if (!dayUrl) continue
    const cleaned = String(hoursRaw).replace(/[   ]/g, " ").trim()
    if (!cleaned || cleaned.toLowerCase() === "closed") continue
    if (cleaned.toLowerCase().includes("24 hours") || cleaned.toLowerCase().includes("open 24")) {
      out.push({ "@type": "OpeningHoursSpecification", dayOfWeek: dayUrl, opens: "00:00", closes: "23:59" })
      continue
    }
    // Each range (split by comma) becomes its own entry, Google supports this.
    const ranges = cleaned.split(",").map((s) => s.trim()).filter(Boolean)
    for (const range of ranges) {
      const m = range.match(/^(.+?)\s*[–\-−]\s*(.+)$/)
      if (!m) continue
      const opens = to24h(m[1])
      const closes = to24h(m[2])
      if (!opens || !closes) continue
      out.push({ "@type": "OpeningHoursSpecification", dayOfWeek: dayUrl, opens, closes })
    }
  }
  return out
}

function VenueJsonLd({ venue }: { venue: Venue }) {
  const priceMap: Record<number, string> = {
    1: "$",
    2: "$$",
    3: "$$$",
    4: "$$$$",
  }

  const offers = (venue.deals ?? []).map((deal) => {
    const price = getLowestDealPrice(deal)
    const days = Array.isArray(deal.days_available) ? deal.days_available : []
    return {
      "@type": "Offer",
      name: deal.title,
      description: buildDealProse(deal),
      priceCurrency: "USD",
      ...(price != null && { price: price.toFixed(2) }),
      availability: "https://schema.org/InStock",
      ...(deal.start_time && { availabilityStarts: deal.start_time }),
      ...(deal.end_time && { availabilityEnds: deal.end_time }),
      ...(days.length > 0 && {
        eligibleTransactionVolume: {
          "@type": "PriceSpecification",
          validFrom: deal.start_time ?? undefined,
          validThrough: deal.end_time ?? undefined,
        },
        additionalProperty: {
          "@type": "PropertyValue",
          name: "daysAvailable",
          value: days.map((d) => DAY_NAME_MAP[d] || d).join(", "),
        },
      }),
      offeredBy: {
        "@type": "Restaurant",
        name: venue.name,
      },
    }
  })

  // Build sameAs links from social profiles
  const sameAs: string[] = []
  if (venue.website_url) sameAs.push(venue.website_url)
  if (venue.yelp_url) sameAs.push(venue.yelp_url)
  if (venue.facebook_url) sameAs.push(venue.facebook_url)
  if (venue.instagram_handle) {
    sameAs.push(
      venue.instagram_handle.startsWith("http")
        ? venue.instagram_handle
        : `https://instagram.com/${venue.instagram_handle.replace(/^@/, "")}`
    )
  }

  // Determine if venue has cuisine data to use Restaurant subtype
  let cuisines: string[] = []
  if (venue.cuisine_type) {
    try {
      const parsed = JSON.parse(venue.cuisine_type)
      if (Array.isArray(parsed)) cuisines = parsed
    } catch {
      cuisines = venue.cuisine_type.split(",").map((c: string) => c.trim()).filter(Boolean)
    }
  }

  const canonicalUrl = `https://www.312deals.com/venues/${venue.slug}`

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": cuisines.length > 0 ? "Restaurant" : "LocalBusiness",
    name: venue.name,
    url: canonicalUrl,
    address: {
      "@type": "PostalAddress",
      ...(venue.address && { streetAddress: venue.address }),
      // The venue's real city, not a hardcoded "Chicago". 4,056 of ~13,300
      // venues are suburban, and telling Google a Naperville restaurant is in
      // Chicago undercuts it for every local query that matters to it.
      addressLocality: venue.city || venue.neighborhood || "Chicago",
      addressRegion: "IL",
    },
    ...(venue.latitude &&
      venue.longitude && {
        geo: {
          "@type": "GeoCoordinates",
          latitude: venue.latitude,
          longitude: venue.longitude,
        },
      }),
    ...(venue.google_rating &&
      venue.google_review_count && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: venue.google_rating,
          bestRating: 5,
          reviewCount: venue.google_review_count,
        },
      }),
    ...(venue.price_level && {
      priceRange: priceMap[venue.price_level],
    }),
    ...(venue.phone && { telephone: venue.phone }),
    ...(venue.photo_url && { image: venue.photo_url }),
    ...(cuisines.length > 0 && { servesCuisine: cuisines }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(offers.length > 0 && { makesOffer: offers }),
    ...(() => {
      const ohs = buildOpeningHoursSpec(venue.hours_json)
      return ohs.length > 0 ? { openingHoursSpecification: ohs } : {}
    })(),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ─── Parse helpers for server rendering ─────────────────────

function parseCuisines(cuisineType: string | null): string[] | undefined {
  if (!cuisineType) return undefined
  try {
    const parsed = JSON.parse(cuisineType)
    if (Array.isArray(parsed)) return parsed.map((c: string) => c.trim()).filter(Boolean)
  } catch {
    // not JSON
  }
  return cuisineType.split(",").map((c) => c.trim()).filter(Boolean)
}

function parseTags(raw: string | null | undefined): string[] | undefined {
  if (!raw) return undefined
  return raw.split(",").map((t) => t.trim()).filter(Boolean)
}

function parseVibeTags(raw: string | null | undefined): string[] | undefined {
  if (!raw) return undefined
  let arr: string[]
  try {
    const parsed = JSON.parse(raw)
    arr = Array.isArray(parsed) ? parsed : raw.split(",")
  } catch {
    arr = raw.split(",")
  }
  return arr
    .map((t) =>
      t
        .trim()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .filter(Boolean)
}

function getSocialLinks(venue: Venue) {
  const links: { name: string; url: string; iconType: "instagram" | "facebook" | "x" | "yelp" }[] = []
  if (venue.instagram_handle)
    links.push({
      name: "Instagram",
      url: venue.instagram_handle.startsWith("http")
        ? venue.instagram_handle
        : `https://instagram.com/${venue.instagram_handle.replace(/^@/, "")}`,
      iconType: "instagram",
    })
  if (venue.facebook_url)
    links.push({ name: "Facebook", url: venue.facebook_url, iconType: "facebook" })
  if (venue.twitter_url)
    links.push({ name: "X", url: venue.twitter_url, iconType: "x" })
  if (venue.yelp_url)
    links.push({ name: "Yelp", url: venue.yelp_url, iconType: "yelp" })
  return links
}

function groupDeals(deals: Deal[]): [string, Deal[]][] {
  if (!deals?.length) return []
  const grouped = new Map<string, Deal[]>()
  for (const deal of deals) {
    const existing = grouped.get(deal.deal_type) ?? []
    existing.push(deal)
    grouped.set(deal.deal_type, existing)
  }
  return Array.from(grouped.entries())
}

const SOCIAL_ICONS = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  x: XIcon,
  yelp: YelpIcon,
}

// ─── Main page component (Server) ──────────────────────────

export default async function VenueDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const venue = await getVenue(params.slug)

  if (!venue) {
    notFound()
  }

  // NOTE: layout.tsx already redirects deal-less and deactivated venues, and
  // it is the one that actually works -- this conditional sits below the
  // loading.tsx Suspense boundary, so by the time it runs the 200 header has
  // committed and redirect() can no longer change the response. It stayed here
  // as a defensive fallback for the case where the layout guard is removed or
  // the route is rendered without it; it must not be treated as the real gate.
  if ((venue.deals?.length ?? 0) === 0) {
    if (venue.neighborhood_slug) {
      redirect(`/neighborhoods/${venue.neighborhood_slug}`)
    }
    notFound()
  }

  // Strip API key from photo URL, proxy through /api/photos
  venue.photo_url = proxyPhotoUrl(venue.photo_url) ?? null

  // Normalize the neighborhood once. 712 active venues have none, and the API
  // can also hand back the literal string "null"; both leaked straight into
  // public copy ("More Deals in null", alt="... in null, Chicago") and into the
  // page title. Two call sites had already been patched ad hoc with
  // `!== "null"` checks -- normalize here instead so every downstream
  // `venue.neighborhood && ...` guard is correct.
  if (
    !venue.neighborhood ||
    venue.neighborhood === "null" ||
    String(venue.neighborhood).trim() === ""
  ) {
    venue.neighborhood = null
  }

  // Enrich deals with venue context (API returns raw deal rows without venue_slug)
  const enrichedDeals = (venue.deals ?? []).map((deal) => ({
    ...deal,
    venue_slug: deal.venue_slug || venue.slug,
    venue_name: deal.venue_name || venue.name,
    neighborhood: deal.neighborhood || venue.neighborhood || "",
  }))

  // Fetch related venues in the same neighborhood (for internal linking)
  const relatedDeals = await getRelatedDeals(
    venue.neighborhood_slug,
    venue.slug
  )

  const cuisines = parseCuisines(venue.cuisine_type)
  const tags = parseTags(venue.tags)
  const vibeTags = parseVibeTags(venue.vibe_tags)
  const socialLinks = getSocialLinks(venue)
  const dealGroups = groupDeals(enrichedDeals)

  // Compute most recent verification/update timestamp across all deals
  const mostRecentDealTimestamp = enrichedDeals.reduce<string | null>((latest, deal) => {
    const ts = (deal as any).last_checked_at || (deal as any).verified_at || (deal as any).updated_at || (deal as any).created_at
    if (!ts) return latest
    if (!latest) return ts
    return ts > latest ? ts : latest
  }, null)

  // Build cross-link data
  const dealTypesPresent = [...new Set(enrichedDeals.map(d => d.deal_type))]
  const cuisineSlugs = cuisines
    ?.map(c => c.toLowerCase())
    .filter(c => CUISINE_PAGES[c])
    ?? []

  const mapsUrl =
    venue.latitude && venue.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`
      : venue.address
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venue.address + ", Chicago, IL")}`
        : null

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <Link
            href="/search"
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>

          <VenueJsonLd venue={venue} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: "https://www.312deals.com" },
                  ...(venue.neighborhood && venue.neighborhood_slug
                    ? [{ name: venue.neighborhood, url: `https://www.312deals.com/neighborhoods/${venue.neighborhood_slug}` }]
                    : []),
                  { name: venue.name, url: `https://www.312deals.com/venues/${params.slug}` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebPage",
                name: `${venue.name}, Deals & Specials`,
                url: `https://www.312deals.com/venues/${params.slug}`,
                dateModified: mostRecentDealTimestamp || venue.updated_at || new Date().toISOString().split("T")[0],
              }),
            }}
          />
          {enrichedDeals.length > 0 && (() => {
            const hasHappyHour = enrichedDeals.some(d => d.deal_type === "happy_hour")
            const dealTimes = enrichedDeals
              .filter(d => d.start_time && d.end_time)
              .map(d => `${d.start_time}-${d.end_time}`)
            const commonTime = dealTimes.length > 0 ? dealTimes[0] : null
            const faqItems = [
              ...(hasHappyHour ? [{
                q: `Does ${venue.name} have happy hour?`,
                a: `Yes! ${venue.name} has ${enrichedDeals.filter(d => d.deal_type === "happy_hour").length} happy hour deal${enrichedDeals.filter(d => d.deal_type === "happy_hour").length !== 1 ? "s" : ""}. ${enrichedDeals.filter(d => d.deal_type === "happy_hour").slice(0, 2).map(d => d.title).join(". ")}.`,
              }] : []),
              {
                q: `What are the deals at ${venue.name}?`,
                a: `${venue.name} has ${enrichedDeals.length} active deal${enrichedDeals.length !== 1 ? "s" : ""}. ${enrichedDeals.slice(0, 3).map(d => d.title).join(". ")}.`,
              },
              ...(commonTime ? [{
                q: `What are the deal times at ${venue.name}?`,
                a: `Deals at ${venue.name} typically run from ${commonTime.split("-").map(t => {
                  const [h, m] = t.split(":").map(Number)
                  const suffix = h >= 12 ? "PM" : "AM"
                  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
                  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`
                }).join(" to ")}. Check individual deals for exact schedules.`,
              }] : []),
            ]
            return (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
              />
            )
          })()}

          {/* 1. Hero Section */}
          <div className="relative mb-6 overflow-hidden rounded-xl aspect-[21/9] sm:aspect-[3/1] lg:aspect-[4/1]">
            {venue.photo_url ? (
              <Image
                src={venue.photo_url}
                alt={`Interior photo of ${venue.name} in ${venue.neighborhood ? `${venue.neighborhood}, ` : ""}Chicago`}
                fill
                priority
                quality={75}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 100vw, 1280px"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 via-sky-500/10 to-brand-500/5" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
              <h1 className="text-2xl font-bold text-white drop-shadow-lg sm:text-3xl lg:text-4xl">
                {venue.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                {venue.neighborhood_slug && venue.neighborhood_slug !== "null" && venue.neighborhood ? (
                  <Link
                    href={`/search?neighborhood=${venue.neighborhood_slug}`}
                    className="text-sm font-medium text-white/90 underline decoration-white/40 hover:decoration-white"
                  >
                    {venue.neighborhood}
                  </Link>
                ) : venue.neighborhood && venue.neighborhood !== "null" ? (
                  <span className="text-sm font-medium text-white/90">
                    {venue.neighborhood}
                  </span>
                ) : null}
                {cuisines && cuisines.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cuisines.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Quick Info Bar */}
          {(venue.google_rating || venue.price_level || venue.hours_json) && (
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-5 py-4">
              {venue.google_rating != null && (
                <StarRating
                  rating={venue.google_rating}
                  count={venue.google_review_count}
                />
              )}
              {venue.price_level != null && (
                <PriceLevel level={venue.price_level} />
              )}
              <OpenStatus hoursJson={venue.hours_json ?? null} />
            </div>
          )}

          {/* === Two-column layout: deals (main) + venue info (sidebar) === */}
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            {/* ── Main Column: Deals ── */}
            <div>
              <div className="mb-4 flex items-baseline gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-foreground">
                  Deals ({venue.deals?.length ?? 0})
                </h2>
                {/* Inline Ask-AI link, surfaces /chat from the highest-intent
                    page on the site. /chat converts 50% of visitors but only
                    4 of 333 found it in the 9d window. Venue page is the
                    cleanest contextual handoff: query is pre-filled with the
                    venue name so chat opens with the right context. */}
                <AskAILink
                  page={`/venues/${params.slug}`}
                  prefilledQuery={`What's good at ${venue.name}?`}
                  href={`/chat?q=${encodeURIComponent(`What's good at ${venue.name}?`)}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  <Sparkles className="h-3 w-3" />
                  Ask AI
                </AskAILink>
                {mostRecentDealTimestamp && (() => {
                  const diffMs = Date.now() - new Date(mostRecentDealTimestamp).getTime()
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                  if (diffDays < 0) return null
                  const label = diffDays === 0
                    ? "Verified today"
                    : diffDays === 1
                      ? "Verified 1 day ago"
                      : diffDays <= 30
                        ? `Verified ${diffDays} days ago`
                        : `Last updated ${new Date(mostRecentDealTimestamp).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
                  return (
                    <span className="text-xs text-muted-foreground">
                      · {label}
                    </span>
                  )
                })()}
              </div>
              {dealGroups.length > 0 ? (
                <div className="space-y-8">
                  {dealGroups.map(([dealType, deals]) => (
                    <div key={dealType}>
                      <div className="mb-3 flex items-center gap-2">
                        <DealTypeBadge dealType={dealType} />
                        <span className="text-sm text-muted-foreground">
                          {deals.length} deal{deals.length !== 1 && "s"}
                        </span>
                      </div>
                      <div className="grid gap-4">
                        {deals.map((deal) => (
                          <div key={deal.id} className="relative">
                            {isDealActiveNow(deal) && (
                              <div className="absolute -top-2 right-3 z-10">
                                <ActiveNowIndicator />
                              </div>
                            )}
                            <DealCard deal={deal} variant="venue-detail" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No deals currently available for this venue.
                  </p>
                  <Link href="/submit" className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
                    Know a deal? Submit it here
                  </Link>
                </div>
              )}
            </div>

            {/* ── Sidebar: Venue Info ── */}
            <div className="space-y-6 lg:mt-0">
              {/* Contact buttons */}
              {(venue.phone || venue.website_url || mapsUrl) && (
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                  {venue.phone && (
                    <a
                      href={`tel:${venue.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      <Phone className="h-4 w-4 shrink-0" />
                      {venue.phone}
                    </a>
                  )}
                  {venue.website_url && (() => {
                    const websiteHref = ensureHttps(venue.website_url)
                    const websiteNetwork = inferNetwork(websiteHref)
                    return (
                      <AffiliateLink
                        href={withAffiliateId(websiteHref, websiteNetwork, { medium: "venue_page", campaign: `website_${venue.slug}` })}
                        network={websiteNetwork}
                        venueSlug={venue.slug}
                        neighborhood={venue.neighborhood ?? undefined}
                        campaign={`website_${venue.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        <Globe className="h-4 w-4 shrink-0" />
                        Website
                      </AffiliateLink>
                    )
                  })()}
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="col-span-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary lg:col-span-1"
                    >
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{venue.address ?? "Directions"}</span>
                    </a>
                  )}
                  <Link
                    href="/submit"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Flag className="h-4 w-4 shrink-0" />
                    Submit Update
                  </Link>
                </div>
              )}

              {/* Affiliate Action Buttons */}
              {(venue.is_chain === 1 && (venue.app_url_ios || venue.app_url_android)) && (
                <div className="flex flex-wrap gap-2">
                  {venue.app_url_ios && (
                    <AffiliateLink
                      href={withAffiliateId(venue.app_url_ios, "chain_ios", { medium: "venue_page", campaign: venue.slug })}
                      network="chain_ios"
                      venueSlug={venue.slug}
                      neighborhood={venue.neighborhood ?? undefined}
                      campaign={venue.slug}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-80"
                    >
                      <Smartphone className="h-4 w-4" />
                      Get {venue.chain_name || venue.name} App (iOS)
                    </AffiliateLink>
                  )}
                  {venue.app_url_android && (
                    <AffiliateLink
                      href={withAffiliateId(venue.app_url_android, "chain_android", { medium: "venue_page", campaign: venue.slug })}
                      network="chain_android"
                      venueSlug={venue.slug}
                      neighborhood={venue.neighborhood ?? undefined}
                      campaign={venue.slug}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                    >
                      <Smartphone className="h-4 w-4" />
                      Get {venue.chain_name || venue.name} App (Android)
                    </AffiliateLink>
                  )}
                </div>
              )}

              {/* Order / Reserve buttons */}
              {venue.is_chain !== 1 && (venue.online_order_url || venue.resy_url || venue.name) && (
                <div className="flex flex-wrap gap-2">
                  {venue.online_order_url && (
                    <AffiliateLink
                      href={withAffiliateId(ensureHttps(venue.online_order_url), "generic", { medium: "venue_page", campaign: `order_${venue.slug}` })}
                      network="generic"
                      venueSlug={venue.slug}
                      neighborhood={venue.neighborhood ?? undefined}
                      campaign={`order_${venue.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#C41E3A] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                      Order Online
                    </AffiliateLink>
                  )}
                  {/* OpenTable reservation CTA dropped, affiliate rejected/unpaid. Resy only. */}
                  {venue.resy_url && (
                    <AffiliateLink
                      href={withAffiliateId(ensureHttps(venue.resy_url), "resy", { medium: "venue_page", campaign: venue.slug })}
                      network="resy"
                      venueSlug={venue.slug}
                      neighborhood={venue.neighborhood ?? undefined}
                      campaign={venue.slug}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#C41E3A] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <Clock className="h-4 w-4" />
                      Make Reservation
                    </AffiliateLink>
                  )}
                  {!venue.online_order_url && (
                    <AffiliateLink
                      href={withAffiliateId(`https://www.doordash.com/search/store/${encodeURIComponent(venue.name + " Chicago")}/`, "doordash", { medium: "venue_page", campaign: venue.slug })}
                      network="doordash"
                      venueSlug={venue.slug}
                      neighborhood={venue.neighborhood ?? undefined}
                      campaign={venue.slug}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                      Order Delivery
                    </AffiliateLink>
                  )}
                </div>
              )}

              {/* About */}
              {(venue.description || (tags && tags.length > 0) || (vibeTags && vibeTags.length > 0)) && (
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-foreground">
                    About
                  </h2>
                  {venue.description && (
                    <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                      {venue.description}
                    </p>
                  )}
                  {vibeTags && vibeTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {vibeTags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Hours, collapsed by default, shows only today */}
              {venue.hours_json && (
                <div>
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Clock className="h-5 w-5" />
                    Hours
                  </h2>
                  <HoursTable hoursJson={venue.hours_json} />
                </div>
              )}

              {/* Social Links */}
              {socialLinks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {socialLinks.map((link) => {
                    const Icon = SOCIAL_ICONS[link.iconType]
                    return (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        aria-label={link.name}
                      >
                        <Icon className="h-4 w-4" />
                        {link.name}
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Internal Cross-Links: Related Venues ── */}
          {relatedDeals.length > 0 && venue.neighborhood && (
            <div className="mt-12">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                More Deals in {venue.neighborhood}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {relatedDeals.map((deal) => (
                  <Link
                    key={deal.venue_slug}
                    href={`/venues/${deal.venue_slug}`}
                    className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300"
                  >
                    <p className="text-sm font-semibold text-foreground group-hover:text-brand-500 transition-colors">
                      {deal.venue_name}
                    </p>
                    <p className="mt-1 text-xs text-brand-600 dark:text-brand-400 line-clamp-1">
                      {deal.title}
                    </p>
                    {deal.best_deal_item && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {deal.best_deal_item}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
              {venue.neighborhood_slug && (
                <Link
                  href={`/neighborhoods/${venue.neighborhood_slug}`}
                  className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  All deals in {venue.neighborhood} &rarr;
                </Link>
              )}
            </div>
          )}

          {/* ── Internal Cross-Links: Explore More ── */}
          <div className="mt-8 space-y-4">
            {/* Deal type links */}
            {dealTypesPresent.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Browse by Deal Type
                </h3>
                <div className="flex flex-wrap gap-2">
                  {dealTypesPresent.map((dt) => {
                    const config = DEAL_TYPE_SLUGS[dt.replace(/_/g, "-")]
                    if (!config) return null
                    const slug = dt.replace(/_/g, "-")
                    return (
                      <Link
                        key={dt}
                        href={`/deals/${slug === "happy-hour" ? "happy-hours" : slug === "daily-special" ? "daily-specials" : slug === "brunch-deal" ? "brunch-deals" : slug === "chain-app-deal" ? "chain-deals" : slug === "seasonal-lto" ? "limited-time" : slug}`}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                      >
                        {config.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Cuisine links */}
            {cuisineSlugs.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Browse by Cuisine
                </h3>
                <div className="flex flex-wrap gap-2">
                  {cuisineSlugs.map((c) => (
                    <Link
                      key={c}
                      href={`/cuisine/${c}`}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                    >
                      {CUISINE_PAGES[c]?.label ?? c}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Neighborhood link */}
            {venue.neighborhood_slug && venue.neighborhood && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Explore {venue.neighborhood}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/neighborhoods/${venue.neighborhood_slug}`}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    All {venue.neighborhood} deals
                  </Link>
                  <Link
                    href={`/happy-hours/${venue.neighborhood_slug}`}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    {venue.neighborhood} happy hours
                  </Link>
                  <Link
                    href="/search"
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    Search all deals
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Owner CTA, passive inbound for venue owners who find their own page.
              Tracked, because this is the highest-reach venue-owner touchpoint on
              the site (9,397 venue pages carrying deals, 62,656 GSC impressions
              in a 28d window) and it was the ONLY /advertise entry point not
              firing an event -- navbar, mobile nav, bottom nav and the
              /advertise page itself all do. With $0 in real featured-listing
              revenue to date and /advertise drawing 36 impressions and 0 clicks,
              there was no way to tell whether venue pages send anyone there. */}
          <div className="mt-12 flex flex-col gap-1 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              Own {venue.name}? Get featured at the top of {venue.neighborhood ? `${venue.neighborhood} ` : ""}search.
            </span>
            <AdvertiseCta
              href="/advertise"
              cta="Venue Page"
              className="shrink-0 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Advertise on 312Deals →
            </AdvertiseCta>
          </div>

          {/* Affiliate Disclosure */}
          <p className="mt-6 text-xs text-muted-foreground/60">
            Some links on this page are affiliate links. 312Deals may earn a small commission at no extra cost to you.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
