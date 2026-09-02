"use client"

import { useState, useMemo } from "react"
import { ArrowUpDown } from "lucide-react"
import { DealCard } from "@/components/deal-card"
import type { Deal } from "@/lib/types"

type SortOption = "default" | "highest_rated" | "best_value" | "a_z"

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "highest_rated", label: "Highest Rated" },
  { value: "best_value", label: "Best Value" },
  { value: "a_z", label: "A, Z" },
]

interface SortableDealsGridProps {
  deals: Deal[]
  columns?: 2 | 3
}

export function SortableDealsGrid({ deals, columns = 2 }: SortableDealsGridProps) {
  const [sortBy, setSortBy] = useState<SortOption>("default")

  const sorted = useMemo(() => {
    const list = [...deals]
    switch (sortBy) {
      case "highest_rated":
        list.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0))
        break
      case "best_value":
        list.sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0))
        break
      case "a_z":
        list.sort((a, b) => (a.venue_name ?? "").localeCompare(b.venue_name ?? ""))
        break
    }
    return list
  }, [deals, sortBy])

  if (deals.length === 0) return null

  const gridCols = columns === 3
    ? "grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3"
    : "grid gap-3 sm:gap-4 sm:grid-cols-2"

  return (
    <div>
      {/* Sort controls */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground tabular-nums">
          {deals.length} deal{deals.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-1.5 text-sm">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="sort-grid" className="sr-only">Sort by</label>
          <select
            id="sort-grid"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-lg border border-border bg-card px-2 py-2 text-base text-foreground outline-none sm:text-sm"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Deal grid */}
      <div className={`deal-grid ${gridCols}`}>
        {sorted.map((deal) => (
          <DealCard key={deal.id} deal={deal} variant="full" />
        ))}
      </div>
    </div>
  )
}
