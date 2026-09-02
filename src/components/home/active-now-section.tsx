"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useDeals } from "@/hooks/use-deals"
import { DealCard, DealCardSkeleton } from "@/components/deal-card"
import { ActiveNowIndicator } from "@/components/active-now-indicator"
import { pickVariedVenues } from "@/lib/home-rotation"

export function ActiveNowSection() {
  // Only city deals, suburbs have their own section. Fetch a fresh, generous
  // pool so we can rotate + vary by neighborhood instead of the same top 8.
  const { data, isLoading } = useDeals({ zone: "city", active_now: true, limit: 40, sort: "recently_updated", min_quality: 35 })
  const dealCount = data?.total ?? 0

  // One deal per venue, varied across neighborhoods, daily-rotated to 8.
  const deals = useMemo(
    () => pickVariedVenues(data?.deals ?? [], { count: 8, seedSalt: "active-now" }),
    [data?.deals]
  )

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:px-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ActiveNowIndicator showLabel={false} />
          <h2 className="text-lg font-bold text-foreground sm:text-xl">Active Now</h2>
          {!isLoading && dealCount > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
              {dealCount}
            </span>
          )}
        </div>
        <Link
          href="/search?active_now=true"
          className="flex items-center gap-1 text-sm font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          View all active
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:gap-4 sm:snap-none">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-[280px] snap-start sm:min-w-0">
                <DealCardSkeleton />
              </div>
            ))
          : deals.map((deal) => (
              <div key={deal.id} className="min-w-[280px] snap-start sm:min-w-0">
                <DealCard deal={deal} />
              </div>
            ))}
      </div>

      {!isLoading && deals.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No deals are active right now. Check back during happy hour!
          </p>
          <Link
            href="/search"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600 active:bg-brand-700"
          >
            Browse all deals
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  )
}
