"use client"

import Link from "next/link"
import { ArrowRight, TrendingUp } from "lucide-react"
import { useNeighborhoods } from "@/hooks/use-deals"
import {
  NeighborhoodCard,
  NeighborhoodCardSkeleton,
} from "@/components/neighborhood-card"

export function TrendingNeighborhoods() {
  const { data, isLoading } = useNeighborhoods()

  const trending = data?.neighborhoods
    ?.filter((n) => n.active_deal_count > 0)
    .sort((a, b) => b.active_deal_count - a.active_deal_count)
    .slice(0, 6)

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:px-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brand-500" />
          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            Trending Neighborhoods
          </h2>
        </div>
        <Link
          href="/neighborhoods"
          className="flex items-center gap-1 text-sm font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          All neighborhoods
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <NeighborhoodCardSkeleton key={i} />
            ))
          : trending?.map((n) => (
              <NeighborhoodCard key={n.slug} neighborhood={n} />
            ))}
      </div>
    </section>
  )
}
