"use client"

import Link from "next/link"
import { Star, MapPin, ArrowRight } from "lucide-react"
import { useDeals } from "@/hooks/use-deals"
import { getDealTimeStatus, formatTimeRange } from "@/lib/deal-utils"
import { DealTypeBadge } from "@/components/deal-type-badge"
import { trackDealClicked } from "@/lib/analytics"
import type { Deal } from "@/lib/types"
import { useMemo } from "react"

function PickCard({ deal }: { deal: Deal }) {
  const timeStatus = getDealTimeStatus(deal)
  const timeText = formatTimeRange(deal.start_time, deal.end_time, deal.is_all_day)

  return (
    <Link
      href={`/venues/${deal.venue_slug}`}
      onClick={() =>
        trackDealClicked({
          deal_type: deal.deal_type,
          neighborhood: deal.neighborhood_slug || deal.neighborhood,
          venue_slug: deal.venue_slug,
        })
      }
      className="group flex flex-col rounded-xl border border-border bg-card p-3.5 transition-all hover:shadow-md hover:border-brand-300 active:scale-[0.98] sm:p-4"
    >
      {/* Top: badge + active indicator */}
      <div className="flex items-center gap-2 mb-2">
        <DealTypeBadge dealType={deal.deal_type} />
        {timeStatus?.status === "active" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
            </span>
            Active
          </span>
        )}
      </div>

      {/* Venue name */}
      <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-brand-600 transition-colors">
        {deal.venue_name}
      </h3>

      {/* Deal title */}
      <p className="mt-0.5 text-sm font-medium text-brand-600 dark:text-brand-400 line-clamp-2 leading-snug">
        {deal.title}
      </p>

      {/* Meta row */}
      <div className="mt-auto pt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-0.5 truncate">
          <MapPin className="h-3 w-3 shrink-0" />
          {deal.neighborhood}
        </span>
        {deal.google_rating != null && deal.google_rating > 0 && (
          <span className="flex items-center gap-0.5 font-medium text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
            <Star className="h-3 w-3 fill-current" />
            {deal.google_rating.toFixed(1)}
          </span>
        )}
        {timeText && (
          <span className="hidden sm:inline truncate">{timeText}</span>
        )}
      </div>
    </Link>
  )
}

function PickCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-3.5 sm:p-4">
      <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
      <div className="mt-2.5 h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-1.5 h-4 w-44 animate-pulse rounded bg-muted" />
      <div className="mt-auto pt-2.5 flex gap-2">
        <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-10 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const

export function FeaturedPicks() {
  const today = DAY_NAMES[new Date().getDay()]
  // Only city deals for today's day, suburbs have their own section
  // Increase limit so the freshness sort has more headroom
  const { data, isLoading } = useDeals({ zone: "city", day: today, limit: 100 })

  // Pick 3 deals prioritizing recently scraped/refreshed venues, one per venue
  const picks = useMemo(() => {
    if (!data?.deals || data.deals.length === 0) return []
    const now = Date.now()
    const candidates = [...data.deals].sort((a, b) => {
      // Use the FRESHEST timestamp available (updated_at preferred, then last_checked_at, then created_at)
      const aFresh = (a as any).updated_at || (a as any).last_checked_at || (a as any).created_at || ""
      const bFresh = (b as any).updated_at || (b as any).last_checked_at || (b as any).created_at || ""
      const aAge = aFresh ? (now - new Date(aFresh).getTime()) / 86400000 : 999
      const bAge = bFresh ? (now - new Date(bFresh).getTime()) / 86400000 : 999
      // Heavy freshness weighting (3× quality, 2× rating). Deals refreshed today bubble to top.
      // 7-day-old deal scores ~93. 30-day-old ~70. 60-day-old ~40.
      const aFreshScore = Math.max(0, 100 - aAge * 1.0)
      const bFreshScore = Math.max(0, 100 - bAge * 1.0)
      const aScore = aFreshScore * 3 + (a.quality_score ?? 0) * 0.5 + (a.google_rating ?? 0) * 10
      const bScore = bFreshScore * 3 + (b.quality_score ?? 0) * 0.5 + (b.google_rating ?? 0) * 10
      return bScore - aScore
    })
    // One deal per venue, take the top 3 deterministically (no shuffle)
    const seenVenues = new Set<string>()
    const unique: Deal[] = []
    for (const d of candidates) {
      if (seenVenues.has(d.venue_slug)) continue
      seenVenues.add(d.venue_slug)
      unique.push(d)
      if (unique.length >= 3) break
    }
    return unique
  }, [data?.deals])

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:px-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-brand-500" />
          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            Featured Picks
          </h2>
        </div>
        <Link
          href="/search"
          className="flex items-center gap-1 text-sm font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          See all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <PickCardSkeleton key={i} />
            ))
          : picks.map((deal) => <PickCard key={deal.id} deal={deal} />)}
      </div>
    </section>
  )
}
