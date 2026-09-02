"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Fragment, useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react"
import dynamic from "next/dynamic"
import { Search, X, ArrowUpDown, Send, MapPin, Store, TrendingUp, LayoutGrid, Map as MapIcon, Clock, Flame, Sparkles, UtensilsCrossed, Leaf, Sun, Building2, TreePine } from "lucide-react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCard, DealCardSkeleton } from "@/components/deal-card"
import { EmailSignup } from "@/components/email-signup"
import { AskAILink } from "@/components/ask-ai-link"
import { NearbyDeals } from "@/components/nearby-deals"
import { FilterSidebar, MobileFilterSheet } from "@/components/filter-sidebar"
import type { FilterState } from "@/components/filter-sidebar"
import { useDeals, useSuggest } from "@/hooks/use-deals"
import { getTodayName } from "@/lib/deal-utils"
import { trackDealSearched, trackFilterUsed } from "@/lib/analytics"
import { stats } from "@/lib/product-stats"

const SearchMap = dynamic(() => import("@/components/search-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[350px] items-center justify-center rounded-xl border border-border bg-muted sm:h-[500px]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
    </div>
  ),
})

const POPULAR_SEARCHES = [
  "gluten free", "tacos", "margaritas", "brunch", "wings",
  "pizza", "sushi", "late night", "rooftop", "oysters",
  "vegan", "$5 beers", "wine wednesday",
]

const QUICK_FILTERS = [
  { label: "Active Now", icon: Flame, filter: { active_now: true } as Partial<FilterState> },
  { label: "Happy Hour", icon: Clock, filter: { deal_type: "happy_hour" } as Partial<FilterState> },
  { label: "Today", icon: Sparkles, filter: { day: "today" } as Partial<FilterState> },
]

type SortOption = "best_match" | "highest_rated" | "nearest" | "most_deals" | "recently_updated"

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "best_match", label: "Best Match" },
  { value: "highest_rated", label: "Highest Rated" },
  { value: "nearest", label: "Nearest" },
  { value: "most_deals", label: "Most Deals" },
  { value: "recently_updated", label: "Recently Updated" },
]

function SearchContentInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const resultsRef = useRef<HTMLDivElement>(null)

  // Default the day filter to "today" so first-time visitors see TODAY's deals,
  // not a cross-day mix. Users can still clear / pick another day from the sidebar.
  // Honors any explicit day in URL (including "all" via empty string).
  const initialDay = searchParams.has("day") ? (searchParams.get("day") || "") : "today"
  const [filters, setFilters] = useState<FilterState>({
    neighborhood: searchParams.get("neighborhood") || "",
    day: initialDay,
    deal_type: searchParams.get("type") || "",
    q: searchParams.get("q") || "",
    chain_filter: searchParams.get("chain_filter") || "local",
    zone: searchParams.get("zone") || "",
    gluten_free: searchParams.get("gluten_free") === "true",
    has_patio: searchParams.get("has_patio") === "true",
    active_now: searchParams.get("active_now") === "true",
    price_range: searchParams.get("price_range") || "",
    min_rating: parseFloat(searchParams.get("min_rating") || "0") || 0,
    time_filter: searchParams.get("time_filter") || "",
    cuisine: searchParams.get("cuisine") || "",
  })

  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [sortBy, setSortBy] = useState<SortOption>("recently_updated")
  const [offset, setOffset] = useState(0)
  const limit = 25
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [debouncedQ, setDebouncedQ] = useState("")
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const suggestRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce search query for suggestions
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300)
    return () => clearTimeout(t)
  }, [filters.q])

  const { data: suggestions } = useSuggest(debouncedQ)

  // Build flat suggestion list for keyboard nav
  const flatSuggestions = useMemo(() => {
    if (!suggestions || debouncedQ.length < 2) return []
    const items: { type: "neighborhood" | "venue" | "cuisine" | "term"; value: string; slug?: string; extra?: string }[] = []
    suggestions.neighborhoods.forEach((n) =>
      items.push({ type: "neighborhood", value: n.name, slug: n.slug, extra: `${n.deal_count} deals` })
    )
    suggestions.venues.forEach((v) =>
      items.push({ type: "venue", value: v.name, slug: v.slug, extra: v.neighborhood })
    )
    if (suggestions.cuisines) {
      suggestions.cuisines.forEach((c: string) =>
        items.push({ type: "cuisine", value: c })
      )
    }
    suggestions.terms.forEach((t) =>
      items.push({ type: "term", value: t })
    )
    return items
  }, [suggestions, debouncedQ])

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIndex(-1)
  }, [flatSuggestions])

  // Close suggestions on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Keyboard navigation for autocomplete
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || flatSuggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((prev) => (prev < flatSuggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : flatSuggestions.length - 1))
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault()
      const item = flatSuggestions[highlightIndex]
      selectSuggestion(item)
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
      inputRef.current?.blur()
    }
  }

  function selectSuggestion(item: { type: string; value: string; slug?: string }) {
    if (item.type === "neighborhood") {
      setFilters((f) => ({ ...f, neighborhood: item.slug!, q: "" }))
    } else if (item.type === "venue") {
      router.push(`/venues/${item.slug}`)
    } else if (item.type === "cuisine") {
      setFilters((f) => ({ ...f, q: item.value }))
    } else {
      setFilters((f) => ({ ...f, q: item.value }))
    }
    setShowSuggestions(false)
  }

  const apiFilters = {
    neighborhood: filters.neighborhood || undefined,
    day:
      filters.day === "today"
        ? getTodayName()
        : filters.day || undefined,
    deal_type: filters.deal_type || undefined,
    q: filters.q || undefined,
    active_now: filters.active_now || undefined,
    chain_filter: filters.chain_filter || undefined,
    zone: filters.zone || undefined,
    gluten_free: filters.gluten_free || undefined,
    has_patio: filters.has_patio || undefined,
    price_range: filters.price_range || undefined,
    min_rating: filters.min_rating || undefined,
    time_filter: filters.time_filter || undefined,
    cuisine: filters.cuisine || undefined,
    sort: sortBy !== "best_match" ? sortBy : undefined,
    limit,
    offset,
  }

  const { data, isLoading, error, refetch } = useDeals(apiFilters)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.neighborhood) params.set("neighborhood", filters.neighborhood)
    if (filters.day) params.set("day", filters.day)
    if (filters.deal_type) params.set("type", filters.deal_type)
    if (filters.q) params.set("q", filters.q)
    if (filters.chain_filter && filters.chain_filter !== "local") params.set("chain_filter", filters.chain_filter)
    if (filters.zone) params.set("zone", filters.zone)
    if (filters.gluten_free) params.set("gluten_free", "true")
    if (filters.has_patio) params.set("has_patio", "true")
    if (filters.active_now) params.set("active_now", "true")
    if (filters.price_range) params.set("price_range", filters.price_range)
    if (filters.min_rating) params.set("min_rating", String(filters.min_rating))
    if (filters.time_filter) params.set("time_filter", filters.time_filter)
    if (filters.cuisine) params.set("cuisine", filters.cuisine)
    router.replace(`/search?${params.toString()}`, { scroll: false })
  }, [filters, router])

  useEffect(() => {
    setOffset(0)
  }, [filters])

  // Fire Plausible "Filter Used" goal whenever a filter actually changes.
  // Skips the very first render (initial state from URL) so we don't fire
  // on page load. Uses a ref to track previous filters and only sends
  // events for the field(s) that actually changed.
  const prevFiltersRef = useRef<FilterState | null>(null)
  useEffect(() => {
    const prev = prevFiltersRef.current
    prevFiltersRef.current = filters
    if (prev === null) return // initial render, don't double-count
    const FIELDS = [
      "neighborhood", "day", "deal_type", "cuisine",
      "zone", "chain_filter", "gluten_free", "has_patio", "active_now",
    ] as const
    for (const field of FIELDS) {
      const before = (prev as unknown as Record<string, unknown>)[field]
      const after = (filters as unknown as Record<string, unknown>)[field]
      if (before !== after) {
        trackFilterUsed({
          filter_type: field,
          value: String(after ?? ""),
        })
      }
    }
  }, [filters])

  // Track searches when results load. `source` (set by hub-page <SearchBar>'s
  // handleSearch) lets us tell direct /search visits apart from inline-search
  // submissions on /happy-hours/[hood], /neighborhoods/[hood], etc.
  useEffect(() => {
    if (!isLoading && data) {
      trackDealSearched({
        query: filters.q || undefined,
        neighborhood: filters.neighborhood || undefined,
        day: filters.day || undefined,
        deal_type: filters.deal_type || undefined,
        active_now: filters.active_now,
        result_count: data.total ?? 0,
        source: searchParams.get("source") || undefined,
      })
    }
  }, [data, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const pageCount = data?.count ?? 0
  const totalDeals = data?.total ?? 0
  const rawDeals = data?.deals ?? []
  const hasMore = offset + pageCount < totalDeals
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(totalDeals / limit)

  // Client-side sort
  const deals = useMemo(() => {
    const sorted = [...rawDeals]
    if (sortBy === "highest_rated") {
      sorted.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0))
    }
    if (sortBy === "nearest") {
      sorted.sort(
        (a, b) => (a.distance_miles ?? 9999) - (b.distance_miles ?? 9999)
      )
    }
    if (sortBy === "recently_updated") {
      sorted.sort((a, b) => {
        const aDate = (a as any).updated_at || (a as any).created_at || ""
        const bDate = (b as any).updated_at || (b as any).created_at || ""
        return bDate.localeCompare(aDate)
      })
    }
    return sorted
  }, [rawDeals, sortBy])

  const activeFilterCount = [
    filters.neighborhood,
    filters.day,
    filters.deal_type,
    filters.price_range,
    filters.min_rating > 0 ? "yes" : "",
    filters.time_filter,
    filters.active_now ? "yes" : "",
    filters.zone,
    filters.cuisine,
  ].filter(Boolean).length

  // Build descriptive result text
  const neighborhoodLabel =
    filters.neighborhood
      ? filters.neighborhood.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : null
  const resultText = isLoading
    ? null
    : totalDeals === 0
      ? "No deals found"
      : `Showing ${offset + 1}–${offset + pageCount} of ${totalDeals} deal${totalDeals !== 1 ? "s" : ""}${
          neighborhoodLabel ? ` in ${neighborhoodLabel}` : ""
        }${filters.day ? ` on ${filters.day === "today" ? "today" : filters.day}` : ""}`

  function scrollToResults() {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function handlePageChange(newOffset: number) {
    setOffset(newOffset)
    scrollToResults()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1 overflow-x-clip">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6 lg:px-6">
          {/* Header */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              {filters.q ? `Results for "${filters.q}"` : "Search Deals"}
            </h1>
            {!filters.q && !resultText && (
              <p className="mt-1 text-sm text-muted-foreground">
                Search {stats.deals} Chicago food and drink deals by neighborhood, day of the week, cuisine, or keyword.
              </p>
            )}
            {resultText && (
              <p className="mt-1 text-sm text-muted-foreground">
                {resultText}
              </p>
            )}
          </div>

          {/* Search input with autocomplete */}
          <form
            id="deal-search-form"
            ref={suggestRef}
            className="relative mb-4 sm:mb-6"
            onSubmit={(e) => e.preventDefault()}
            role="search"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 sm:px-4 sm:py-2.5 shadow-sm">
              <Search className="h-5 w-5 text-muted-foreground sm:h-4 sm:w-4" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                name="query"
                placeholder="Search deals, venues, or cuisines..."
                aria-label="Search deals, venues, or cuisines"
                aria-expanded={showSuggestions && flatSuggestions.length > 0}
                aria-activedescendant={highlightIndex >= 0 ? `suggestion-${highlightIndex}` : undefined}
                role="combobox"
                aria-autocomplete="list"
                aria-controls={showSuggestions && flatSuggestions.length > 0 ? "suggestions-list" : undefined}
                value={filters.q}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, q: e.target.value }))
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
              />
              {filters.q && (
                <button
                  onClick={() => {
                    setFilters((f) => ({ ...f, q: "" }))
                    setShowSuggestions(false)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary active:bg-secondary/80"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Autocomplete dropdown */}
            {showSuggestions && flatSuggestions.length > 0 && (
              <div
                id="suggestions-list"
                role="listbox"
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-card shadow-lg"
              >
                {suggestions!.neighborhoods.length > 0 && (
                  <div className="border-b border-border p-2">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Neighborhoods</p>
                    {suggestions!.neighborhoods.map((n) => {
                      const idx = flatSuggestions.findIndex((s) => s.type === "neighborhood" && s.slug === n.slug)
                      return (
                        <button
                          key={n.slug}
                          id={`suggestion-${idx}`}
                          role="option"
                          aria-selected={highlightIndex === idx}
                          onClick={() => {
                            setFilters((f) => ({ ...f, neighborhood: n.slug, q: "" }))
                            setShowSuggestions(false)
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground transition-colors ${
                            highlightIndex === idx ? "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400" : "hover:bg-secondary"
                          }`}
                        >
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-left">{n.name}</span>
                          <span className="text-xs text-muted-foreground">{n.deal_count} deals</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {suggestions!.venues.length > 0 && (
                  <div className="border-b border-border p-2">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Venues</p>
                    {suggestions!.venues.map((v) => {
                      const idx = flatSuggestions.findIndex((s) => s.type === "venue" && s.slug === v.slug)
                      return (
                        <Link
                          key={v.slug}
                          id={`suggestion-${idx}`}
                          role="option"
                          aria-selected={highlightIndex === idx}
                          href={`/venues/${v.slug}`}
                          onClick={() => setShowSuggestions(false)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground transition-colors ${
                            highlightIndex === idx ? "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400" : "hover:bg-secondary"
                          }`}
                        >
                          <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-left">{v.name}</span>
                          <span className="text-xs text-muted-foreground">{v.neighborhood}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
                {suggestions!.cuisines && suggestions!.cuisines.length > 0 && (
                  <div className="border-b border-border p-2">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cuisines</p>
                    {suggestions!.cuisines.map((cuisine: string) => {
                      const idx = flatSuggestions.findIndex((s) => s.type === "cuisine" && s.value === cuisine)
                      return (
                        <button
                          key={cuisine}
                          id={`suggestion-${idx}`}
                          role="option"
                          aria-selected={highlightIndex === idx}
                          onClick={() => {
                            setFilters((f) => ({ ...f, q: cuisine }))
                            setShowSuggestions(false)
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground transition-colors ${
                            highlightIndex === idx ? "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400" : "hover:bg-secondary"
                          }`}
                        >
                          <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-left">{cuisine}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {suggestions!.terms.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Searches</p>
                    {suggestions!.terms.map((term) => {
                      const idx = flatSuggestions.findIndex((s) => s.type === "term" && s.value === term)
                      return (
                        <button
                          key={term}
                          id={`suggestion-${idx}`}
                          role="option"
                          aria-selected={highlightIndex === idx}
                          onClick={() => {
                            setFilters((f) => ({ ...f, q: term }))
                            setShowSuggestions(false)
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground transition-colors ${
                            highlightIndex === idx ? "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400" : "hover:bg-secondary"
                          }`}
                        >
                          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-left">{term}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* No results in autocomplete */}
            {showSuggestions && debouncedQ.length >= 2 && flatSuggestions.length === 0 && suggestions && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-border bg-card p-4 text-center shadow-lg">
                <p className="text-sm text-muted-foreground">No suggestions for &ldquo;{debouncedQ}&rdquo;</p>
                <p className="mt-1 text-xs text-muted-foreground">Try a different spelling or keyword</p>
              </div>
            )}

            {/* Popular searches, show when search is empty and focused */}
            {showSuggestions && !filters.q && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground mt-1.5" />
                {POPULAR_SEARCHES.map((term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setFilters((f) => ({ ...f, q: term }))
                      setShowSuggestions(false)
                    }}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 active:bg-brand-100 dark:hover:bg-brand-950 dark:hover:text-brand-400"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Near-me prompt, only on the empty landing, hidden once a query or
              filter is active so it never competes with real search results. */}
          {!filters.q && !filters.neighborhood && !filters.deal_type && !filters.active_now && (
            <NearbyDeals className="!mx-0 !max-w-none !px-0 !py-0 mb-6" />
          )}

          {/* Quick filter chips */}
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 sm:mb-6 no-scrollbar">
            {QUICK_FILTERS.map((qf) => {
              const Icon = qf.icon
              const isActive =
                (qf.filter.active_now && filters.active_now) ||
                (qf.filter.deal_type && filters.deal_type.split(",").includes(qf.filter.deal_type)) ||
                (qf.filter.day && filters.day === qf.filter.day)
              return (
                <button
                  key={qf.label}
                  onClick={() => {
                    if (isActive) {
                      const reset: Partial<FilterState> = {}
                      if (qf.filter.active_now) reset.active_now = false
                      if (qf.filter.deal_type) reset.deal_type = ""
                      if (qf.filter.day) reset.day = ""
                      setFilters((f) => ({ ...f, ...reset }))
                    } else {
                      setFilters((f) => ({ ...f, ...qf.filter }))
                    }
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-500 text-primary-foreground shadow-sm"
                      : "bg-card border border-border text-foreground hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 active:bg-brand-100 dark:hover:bg-brand-950 dark:hover:text-brand-400"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {qf.label}
                </button>
              )
            })}

            {/* Zone: Chicago / Suburbs */}
            <span className="mx-0.5 h-5 w-px bg-border shrink-0" />
            {([
              { value: "", label: "All Areas", icon: null },
              { value: "city", label: "Chicago", icon: Building2 },
              { value: "suburbs", label: "Suburbs", icon: TreePine },
            ] as const).map((opt) => {
              const ZoneIcon = opt.icon
              return (
                <button
                  key={`zone-${opt.value}`}
                  onClick={() =>
                    setFilters((f) => ({ ...f, zone: opt.value, neighborhood: "" }))
                  }
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    filters.zone === opt.value
                      ? "bg-brand-500 text-primary-foreground shadow-sm"
                      : "bg-card border border-border text-foreground hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 active:bg-brand-100 dark:hover:bg-brand-950 dark:hover:text-brand-400"
                  }`}
                >
                  {ZoneIcon && <ZoneIcon className="mr-1 inline h-3.5 w-3.5" />}
                  {opt.label}
                </button>
              )
            })}

            {/* Chain/Local/All */}
            <span className="mx-0.5 h-5 w-px bg-border shrink-0" />
            {([
              { value: "", label: "All" },
              { value: "local", label: "Local" },
              { value: "chain", label: "Chains" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setFilters((f) => ({ ...f, chain_filter: opt.value }))
                }
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  filters.chain_filter === opt.value
                    ? "bg-brand-500 text-primary-foreground shadow-sm"
                    : "bg-card border border-border text-foreground hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 active:bg-brand-100 dark:hover:bg-brand-950 dark:hover:text-brand-400"
                }`}
              >
                {opt.label}
              </button>
            ))}

            <span className="mx-0.5 h-5 w-px bg-border shrink-0" />

            <button
              onClick={() =>
                setFilters((f) => ({ ...f, gluten_free: !f.gluten_free }))
              }
              aria-label="GF, Gluten free"
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filters.gluten_free
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-card border border-border text-foreground hover:bg-green-50 hover:text-green-700 active:bg-green-100 dark:hover:bg-green-950 dark:hover:text-green-400"
              }`}
            >
              <Leaf className="mr-1 inline h-3.5 w-3.5" />
              GF
            </button>

            <button
              onClick={() =>
                setFilters((f) => ({ ...f, has_patio: !f.has_patio }))
              }
              aria-label="Patio, Outdoor seating"
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filters.has_patio
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-card border border-border text-foreground hover:bg-amber-50 hover:text-amber-700 active:bg-amber-100 dark:hover:bg-amber-950 dark:hover:text-amber-400"
              }`}
            >
              <Sun className="mr-1 inline h-3.5 w-3.5" />
              Patio
            </button>
          </div>

          {/* View toggle + Sort, separate row */}
          <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-brand-500 text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  aria-label="Map view"
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === "map"
                      ? "bg-brand-500 text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <MapIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Map</span>
                </button>
              </div>
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-1.5 text-sm">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="sort-select" className="sr-only">Sort by</label>
              <select
                id="sort-select"
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

          <h2 className="sr-only">Deal Results</h2>
          <div ref={resultsRef} className="flex gap-6">
            {/* Desktop sidebar */}
            <FilterSidebar
              filters={filters}
              onFiltersChange={setFilters}
              className="hidden w-56 shrink-0 lg:flex"
            />

            {/* Results */}
            <div className="flex-1 min-w-0">
              {/* Mobile filters */}
              <div className="mb-4 flex items-center gap-2 lg:hidden">
                <MobileFilterSheet
                  filters={filters}
                  onFiltersChange={setFilters}
                />
                {activeFilterCount > 0 && (
                  <button
                    onClick={() =>
                      setFilters({
                        neighborhood: "",
                        day: "",
                        deal_type: "",
                        q: filters.q,
                        chain_filter: "local",
                        zone: "",
                        gluten_free: false,
                        has_patio: false,
                        active_now: false,
                        price_range: "",
                        min_rating: 0,
                        time_filter: "",
                        cuisine: "",
                      })
                    }
                    className="text-xs font-medium text-brand-500 active:text-brand-700"
                  >
                    Clear filters ({activeFilterCount})
                  </button>
                )}
              </div>

              {error ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
                  <p className="text-sm text-muted-foreground">
                    Something went wrong loading deals.
                  </p>
                  <button
                    onClick={() => refetch()}
                    className="mt-3 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600 active:bg-brand-700"
                  >
                    Retry
                  </button>
                </div>
              ) : isLoading ? (
                viewMode === "map" ? (
                  <div className="flex h-[350px] items-center justify-center rounded-xl border border-border bg-muted sm:h-[500px]">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <DealCardSkeleton key={i} />
                    ))}
                  </div>
                )
              ) : viewMode === "map" ? (
                <SearchMap deals={deals} />
              ) : deals.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
                  <Search className="mb-3 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">
                    No deals match your filters
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Try broadening your search, picking a different neighborhood, or clearing filters. We have {stats.deals} deals across {stats.neighborhoods} neighborhoods.
                  </p>
                  {/* AI chat escape hatch, /chat converts 50% of visitors but
                      only 4 found it in 9d (May 11-19). Empty-state on /search
                      is the highest-intent moment to surface it. Pre-fills
                      the query so chat opens with the right context. */}
                  {filters.q && (
                    <AskAILink
                      page="/search"
                      prefilledQuery={filters.q}
                      href={`/chat?q=${encodeURIComponent(filters.q)}`}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Ask AI: &ldquo;{filters.q}&rdquo;
                    </AskAILink>
                  )}
                  <Link
                    href="/submit"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600 active:bg-brand-700"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Know a deal? Submit it!
                  </Link>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {["Wicker Park", "River North", "Lakeview"].map(
                      (area) => (
                        <button
                          key={area}
                          onClick={() =>
                            setFilters({
                              neighborhood: area
                                .toLowerCase()
                                .replace(/ /g, "-"),
                              day: "",
                              deal_type: "",
                              q: "",
                              chain_filter: "local",
                              zone: "",
                              gluten_free: false,
                              has_patio: false,
                              active_now: false,
                              price_range: "",
                              min_rating: 0,
                              time_filter: "",
                              cuisine: "",
                            })
                          }
                          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
                        >
                          {area}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Top-of-results inline CTA, fires only on page 1 so paginated
                      browsers don't see it twice. Distinct source value from the
                      mid-scroll banner so Plausible's `source` custom prop tells
                      us which placement converts. Pre-step-5: 0/31 conversion in
                      7d May 1-7, placement was the bottleneck, not the form. */}
                  {deals.length > 0 && offset === 0 && (
                    <div className="mb-5 rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-3 dark:border-brand-800 dark:bg-brand-950/20">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium text-foreground">
                          Like these? Get the week&apos;s 5 best Chicago deals every Thursday, free.
                        </p>
                        <div className="sm:min-w-[280px]">
                          <EmailSignup source="search-top-cta" variant="inline" />
                        </div>
                      </div>
                    </div>
                  )}

                  {(() => {
                    // Group deals by venue
                    const venueMap = new Map<string, typeof deals>()
                    for (const deal of deals) {
                      const key = deal.venue_slug || deal.venue_name || String(deal.id)
                      if (!venueMap.has(key)) venueMap.set(key, [])
                      venueMap.get(key)!.push(deal)
                    }

                    // When a day filter is active, sort each venue's deals so the day-matching
                    // deal is shown FIRST in the card (not whatever happened to come back first
                    // from the API). Prevents "Tuesday burger" showing as the lead when user
                    // filtered to Saturday.
                    const activeDayFilter =
                      filters.day === "today" ? getTodayName() : filters.day
                    if (activeDayFilter) {
                      for (const [, venueDeals] of venueMap) {
                        venueDeals.sort((a, b) => {
                          const aMatch = (a.is_all_day || (a.days_available || []).includes(activeDayFilter)) ? 1 : 0
                          const bMatch = (b.is_all_day || (b.days_available || []).includes(activeDayFilter)) ? 1 : 0
                          if (aMatch !== bMatch) return bMatch - aMatch
                          return (b.quality_score ?? 0) - (a.quality_score ?? 0)
                        })
                      }
                    }

                    // Convert to array and sort if "most_deals" selected
                    let venueGroups = Array.from(venueMap.entries()).map(([slug, venueDeals]) => ({
                      slug,
                      deals: venueDeals,
                      venue_name: venueDeals[0].venue_name,
                      google_rating: venueDeals[0].google_rating,
                    }))

                    if (sortBy === "most_deals") {
                      venueGroups.sort((a, b) => b.deals.length - a.deals.length)
                    }

                    // Inject newsletter capture banner after the 6th venue card.
                    // /search has 308s avg session at 0% bounce, these are the most
                    // engaged users on the site. Mid-scroll injection captures them
                    // without disrupting the search experience.
                    const NEWSLETTER_INJECT_AFTER = 6
                    return (
                      <div className="deal-grid grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {venueGroups.map((group, idx) => (
                          <Fragment key={group.slug}>
                            <DealCard deal={group.deals[0]} variant="full" additionalDeals={group.deals.slice(1)} />
                            {idx === NEWSLETTER_INJECT_AFTER - 1 && venueGroups.length > NEWSLETTER_INJECT_AFTER && (
                              <div className="sm:col-span-2 lg:col-span-3">
                                <EmailSignup
                                  source="search-mid-results"
                                  variant="banner"
                                  headline="Deals like these, in your inbox"
                                  subtitle="Every Thursday: the best new happy hours, BOGO nights & specials in your Chicago neighborhoods. Free, unsubscribe anytime."
                                />
                              </div>
                            )}
                          </Fragment>
                        ))}
                      </div>
                    )
                  })()}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-1.5 sm:gap-2">
                      <button
                        onClick={() => handlePageChange(Math.max(0, offset - limit))}
                        disabled={offset === 0}
                        className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary active:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>

                      {/* Page numbers on larger screens */}
                      <div className="hidden items-center gap-1 sm:flex">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange((pageNum - 1) * limit)}
                              className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors ${
                                currentPage === pageNum
                                  ? "bg-brand-500 text-primary-foreground"
                                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        })}
                      </div>

                      <span className="px-2 py-2 text-sm text-muted-foreground sm:hidden">
                        {currentPage}/{totalPages}
                      </span>

                      <button
                        onClick={() => handlePageChange(offset + limit)}
                        disabled={!hasMore}
                        className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default function SearchContent() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <div className="flex-1">
            <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
              <p className="text-2xl font-bold text-foreground">Search Deals</p>
            </div>
          </div>
          <Footer />
        </div>
      }
    >
      <SearchContentInner />
    </Suspense>
  )
}
