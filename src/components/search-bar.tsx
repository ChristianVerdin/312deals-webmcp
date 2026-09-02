"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Search, X, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNeighborhoods } from "@/hooks/use-deals"
import { getDealTypeConfig } from "@/lib/deal-utils"

const DEAL_TYPES = [
  "happy_hour",
  "daily_special",
  "brunch_deal",
  "late_night",
  "chain_app_deal",
  "game_day",
  "seasonal_lto",
  "loyalty_reward",
]

const DAY_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
]

interface SearchBarProps {
  defaultNeighborhood?: string
  defaultDay?: string
  defaultType?: string
  defaultQuery?: string
  className?: string
  compact?: boolean
}

function getTodayValue(): string {
  const ct = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }))
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][ct.getDay()]
}

export function SearchBar({
  defaultNeighborhood = "",
  defaultDay = "today",
  defaultType = "",
  defaultQuery = "",
  className,
  compact = false,
}: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(defaultQuery)
  const [selectedNh, setSelectedNh] = useState<string[]>(
    defaultNeighborhood ? defaultNeighborhood.split(",").filter(Boolean) : []
  )
  const [day, setDay] = useState(defaultDay)
  const [dealType, setDealType] = useState(defaultType)
  const [nhOpen, setNhOpen] = useState(false)
  const [nhFilter, setNhFilter] = useState("")
  const nhRef = useRef<HTMLDivElement>(null)

  const { data: nhData } = useNeighborhoods()
  const neighborhoods = nhData?.neighborhoods ?? []
  const filteredNh = neighborhoods.filter((n) =>
    n.name.toLowerCase().includes(nhFilter.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (nhRef.current && !nhRef.current.contains(e.target as Node)) {
        setNhOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function toggleNh(slug: string) {
    setSelectedNh((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const params = new URLSearchParams()
    if (selectedNh.length) params.set("neighborhood", selectedNh.join(","))
    if (day) params.set("day", day)
    if (dealType) params.set("type", dealType)
    if (query) params.set("q", query)
    // Attribute the search to its originating hub page so the "Deal Searched"
    // Plausible goal can split direct /search visits from inline submissions
    // on /happy-hours/[hood], /neighborhoods/[hood], etc.
    if (pathname && pathname !== "/search") params.set("source", pathname)
    router.push(`/search?${params.toString()}`)
  }

  if (compact) {
    return (
      <form
        onSubmit={handleSearch}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2",
          className
        )}
      >
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search deals, venues, or cuisines..."
          aria-label="Search deals, venues, or cuisines"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        <button
          type="submit"
          className="min-h-[44px] rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs"
        >
          Search
        </button>
      </form>
    )
  }

  return (
    <form
      onSubmit={handleSearch}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search deals, venues, or cuisines..."
          aria-label="Search deals, venues, or cuisines"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Neighborhood Autocomplete */}
        <div ref={nhRef} className="relative flex-1">
          <button
            type="button"
            onClick={() => setNhOpen(!nhOpen)}
            aria-expanded={nhOpen}
            aria-haspopup="listbox"
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-sm sm:min-h-0"
          >
            <span
              className={cn(
                selectedNh.length > 0 ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {selectedNh.length === 0
                ? "All neighborhoods"
                : selectedNh.length === 1
                ? (nhData?.neighborhoods.find((n) => n.slug === selectedNh[0])?.name || selectedNh[0])
                : `${selectedNh.length} neighborhoods`}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {nhOpen && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-card shadow-lg">
              <input
                type="text"
                placeholder="Filter neighborhoods..."
                aria-label="Filter neighborhoods"
                value={nhFilter}
                onChange={(e) => setNhFilter(e.target.value)}
                className="w-full border-b border-border bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground sm:py-2 sm:text-sm"
                autoFocus
              />
              {selectedNh.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNh([])
                    setNhFilter("")
                  }}
                  className="flex w-full px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
                >
                  Clear all
                </button>
              )}
              {filteredNh.map((n) => {
                const selected = selectedNh.includes(n.slug)
                return (
                  <button
                    key={n.slug}
                    type="button"
                    onClick={() => toggleNh(n.slug)}
                    className={cn(
                      "flex min-h-[44px] w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-secondary sm:min-h-0 sm:py-2",
                      selected ? "text-brand-600 font-medium" : "text-foreground"
                    )}
                  >
                    <span className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      selected ? "border-brand-500 bg-brand-500" : "border-border"
                    )}>
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="flex-1 text-left">{n.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {n.active_deal_count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Day Selector */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {DAY_OPTIONS.map((d) => {
            const isToday = d.value === getTodayValue()
            const isSelected = day === d.value || (day === "today" && isToday)
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => setDay(day === d.value ? "" : d.value)}
                className={cn(
                  "flex min-h-[40px] shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:px-2.5 sm:py-1.5 sm:text-xs",
                  isSelected
                    ? "bg-brand-500 text-primary-foreground"
                    : isToday && day !== ""
                      ? "bg-brand-500/20 text-brand-500 ring-1 ring-brand-500/40"
                      : "bg-secondary text-secondary-foreground hover:bg-brand-50 hover:text-brand-600"
                )}
              >
                {d.label}
              </button>
            )
          })}
        </div>

        {/* Deal Type */}
        <label htmlFor="deal-type-select" className="sr-only">Deal type</label>
        <select
          id="deal-type-select"
          value={dealType}
          onChange={(e) => setDealType(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none"
        >
          <option value="">All types</option>
          {DEAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {getDealTypeConfig(t).label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="min-h-[44px] shrink-0 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600 sm:min-h-0"
        >
          Search
        </button>
      </div>
    </form>
  )
}
