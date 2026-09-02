"use client"

import { useState, useMemo } from "react"
import { MapPin, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  NeighborhoodCard,
  NeighborhoodCardSkeleton,
} from "@/components/neighborhood-card"
import { useNeighborhoods } from "@/hooks/use-deals"
import type { Neighborhood } from "@/lib/types"

const ZONES = [
  { value: "all", label: "All" },
  { value: "city", label: "City" },
  { value: "north_shore", label: "North Shore" },
  { value: "northwest_suburbs", label: "NW Suburbs" },
  { value: "western_suburbs", label: "West Suburbs" },
  { value: "south_suburbs", label: "South Suburbs" },
]

interface NeighborhoodsBrowserProps {
  initialNeighborhoods: Neighborhood[]
}

export default function NeighborhoodsBrowser({ initialNeighborhoods }: NeighborhoodsBrowserProps) {
  const [zone, setZone] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Only fetch when a specific zone is selected; "all" uses server-provided data
  const { data, isLoading } = useNeighborhoods(zone === "all" ? undefined : zone)

  const neighborhoods = zone === "all"
    ? initialNeighborhoods
    : (data?.neighborhoods ?? [])

  // Only show loading skeletons when switching to a non-"all" zone that hasn't loaded yet
  const showSkeleton = zone !== "all" && isLoading

  const filtered = useMemo(() => {
    let result = [...neighborhoods]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((n) => n.name.toLowerCase().includes(q))
    }
    return result.sort((a, b) => b.active_deal_count - a.active_deal_count)
  }, [neighborhoods, searchQuery])

  const totalActiveNow = useMemo(
    () => filtered.reduce((sum, n) => sum + (n.active_now_count ?? 0), 0),
    [filtered]
  )

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-5 w-5 text-brand-500" />
            <h1 className="text-2xl font-bold text-foreground">
              Neighborhoods
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Explore deals across {neighborhoods.length} Chicago-area neighborhoods, from River North and Wicker Park to Logan Square and Hyde Park. Each neighborhood page shows every active happy hour, brunch deal, and daily special nearby.
            {totalActiveNow > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 text-green-600 font-medium dark:text-green-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                {totalActiveNow} deals active now
              </span>
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Chicago is a city of neighborhoods, each with its own dining personality. The North Side draws crowds to happy hours in Lincoln Park and craft cocktail specials in Logan Square. Downtown and the Loop are packed with weekday lunch deals and after-work drink specials. Head south for affordable brunch in Hyde Park or late-night bites in Pilsen. West of the expressway, Wicker Park and Bucktown compete for the best taco Tuesday and weekend brunch deals. Use the zone tabs above to narrow your search by region, or type a name to jump straight to your favorite area. Every listing links to a dedicated page with full deal details, hours, and venue info so you can plan your next outing with confidence.
          </p>
        </div>

        {/* Search + Zone Tabs */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Filter by zone">
            {ZONES.map((z) => (
              <button
                key={z.value}
                role="tab"
                aria-selected={zone === z.value}
                onClick={() => setZone(z.value)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  zone === z.value
                    ? "bg-brand-500 text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-brand-50 hover:text-brand-600"
                )}
              >
                {z.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 sm:w-56">
            <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              placeholder="Filter neighborhoods..."
              aria-label="Filter neighborhoods"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} aria-label="Clear filter">
                <span className="text-xs text-muted-foreground" aria-hidden="true">x</span>
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {showSkeleton
            ? Array.from({ length: 12 }).map((_, i) => (
                <NeighborhoodCardSkeleton key={i} />
              ))
            : filtered.map((n) => (
                <NeighborhoodCard key={n.slug} neighborhood={n} />
              ))}
        </div>

        {!showSkeleton && filtered.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {searchQuery
              ? `No neighborhoods matching "${searchQuery}".`
              : "No neighborhoods found for this zone."}
          </p>
        )}
      </div>
    </div>
  )
}
