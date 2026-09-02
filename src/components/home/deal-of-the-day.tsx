"use client"

import Link from "next/link"
import { useDealOfTheDay } from "@/hooks/use-deals"
import { Star, ArrowRight } from "lucide-react"
import {
  getDealTimeStatus,
  formatTimeRange,
} from "@/lib/deal-utils"
import { trackDealClicked } from "@/lib/analytics"

export function DealOfTheDay() {
  const { data, isLoading, error } = useDealOfTheDay()

  if (error || (!isLoading && !data?.deal)) return null

  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-4 sm:py-5 lg:px-6">
        <div className="animate-pulse rounded-lg border border-brand-200 bg-gradient-to-r from-brand-50 to-orange-50 px-3 py-2.5 dark:border-brand-800 dark:from-brand-950/50 dark:to-orange-950/30">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="mt-1.5 h-3.5 w-48 rounded bg-muted" />
            </div>
            <div className="h-8 w-8 rounded-full bg-muted" />
          </div>
        </div>
      </section>
    )
  }

  const deal = data!.deal
  const timeStatus = getDealTimeStatus(deal)
  const timeText = formatTimeRange(deal.start_time, deal.end_time, deal.is_all_day)

  return (
    <section className="mx-auto max-w-7xl px-4 py-4 sm:py-5 lg:px-6">
      <Link
        href={`/venues/${deal.venue_slug}`}
        onClick={() => trackDealClicked({ deal_type: deal.deal_type, neighborhood: deal.neighborhood_slug || deal.neighborhood, venue_slug: deal.venue_slug })}
        className="group flex items-center gap-3 rounded-lg border border-brand-200 bg-gradient-to-r from-brand-50/80 to-orange-50/60 px-3 py-2.5 transition-all hover:shadow-sm hover:border-brand-300 active:scale-[0.99] dark:border-brand-800 dark:from-brand-950/50 dark:to-orange-950/30 sm:px-4 sm:py-3"
      >
        {/* Star icon */}
        <Star className="h-4 w-4 shrink-0 text-brand-500 fill-brand-500" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500">
              Deal of the Day
            </span>
            {timeStatus?.status === "active" && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
              </span>
            )}
          </div>
          <p className="truncate text-sm font-semibold text-foreground group-hover:text-brand-600 transition-colors">
            {deal.venue_name}, <span className="font-medium text-brand-600 dark:text-brand-400">{deal.title}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {deal.neighborhood}
            {timeText && ` · ${timeText}`}
            {deal.google_rating != null && deal.google_rating > 0 && ` · ${deal.google_rating.toFixed(1)}★`}
          </p>
        </div>

        {/* Arrow CTA */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-transform group-hover:translate-x-0.5">
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </Link>
    </section>
  )
}
