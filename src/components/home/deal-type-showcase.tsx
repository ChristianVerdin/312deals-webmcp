"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useDeals } from "@/hooks/use-deals"
import { DealCard, DealCardSkeleton } from "@/components/deal-card"
import { getDealTypeConfig } from "@/lib/deal-utils"
import { cn } from "@/lib/utils"
import { pickVariedVenues } from "@/lib/home-rotation"

const DEAL_TYPES = [
  "happy_hour",
  "daily_special",
  "brunch_deal",
  "late_night",
  "game_day",
  "seasonal_lto",
]

function DealGrid({ dealType }: { dealType: string }) {
  // Only city deals, suburbs have their own section. Fresh, generous pool.
  const { data, isLoading } = useDeals({ zone: "city", deal_type: dealType, limit: 30, sort: "recently_updated", min_quality: 35 })

  // One deal per venue, varied across neighborhoods, daily-rotated to 6.
  const deals = useMemo(
    () => pickVariedVenues(data?.deals ?? [], { count: 6, seedSalt: `type:${dealType}` }),
    [data?.deals, dealType]
  )

  if (!isLoading && deals.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No {getDealTypeConfig(dealType).label.toLowerCase()} deals right now. Check back soon!
      </p>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible sm:gap-4">
      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="min-w-[280px] sm:min-w-0">
              <DealCardSkeleton />
            </div>
          ))
        : deals.map((deal) => (
            <div key={deal.id} className="min-w-[280px] sm:min-w-0">
              <DealCard deal={deal} />
            </div>
          ))}
    </div>
  )
}

export function DealTypeShowcases() {
  const [activeType, setActiveType] = useState(DEAL_TYPES[0])
  const config = getDealTypeConfig(activeType)

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:px-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground sm:text-xl">Browse by Type</h2>
        <Link
          href={`/search?type=${activeType}`}
          className="flex items-center gap-1 text-sm font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          All {config.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Tab pills, horizontally scrollable on mobile */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 no-scrollbar sm:flex-wrap sm:gap-2">
        {DEAL_TYPES.map((type) => {
          const tc = getDealTypeConfig(type)
          const isActive = activeType === type
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-brand-50 hover:text-brand-600 active:bg-brand-100 dark:hover:bg-brand-950 dark:hover:text-brand-400"
              )}
            >
              {tc.label}
            </button>
          )
        })}
      </div>

      {/* Deal grid for selected type */}
      <DealGrid key={activeType} dealType={activeType} />
    </section>
  )
}
