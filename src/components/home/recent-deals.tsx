"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRight, MapPin } from "lucide-react"
import { useDeals } from "@/hooks/use-deals"
import { DealCard, DealCardSkeleton } from "@/components/deal-card"
import { pickVariedVenues } from "@/lib/home-rotation"

export function RecentDeals() {
  // Fresh, generous suburb pool so the spotlight rotates + varies by suburb.
  // min_quality keeps recency from promoting thin listings: `recently_updated`
  // orders on updated_at alone, and ~a quarter of the harvester's output is
  // chain merch ("Crazy Puffs Crave Combo") that would otherwise take a slot
  // from a priced, timed offer. 35 drops that tail and keeps 82% of the corpus.
  const { data, isLoading } = useDeals({ zone: "suburbs", limit: 40, sort: "recently_updated", min_quality: 35 })

  // One deal per venue, varied across suburbs, daily-rotated to 8.
  const deals = useMemo(
    () => pickVariedVenues(data?.deals ?? [], { count: 8, seedSalt: "suburbs" }),
    [data?.deals]
  )

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:px-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-brand-500" />
          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            Suburb Spotlight
          </h2>
        </div>
        <Link
          href="/search?zone=suburbs"
          className="flex items-center gap-1 text-sm font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          Browse suburbs
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <DealCardSkeleton key={i} />
            ))
          : deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
      </div>

      {!isLoading && deals.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No suburb deals yet. Check back soon!
          </p>
        </div>
      )}
    </section>
  )
}
