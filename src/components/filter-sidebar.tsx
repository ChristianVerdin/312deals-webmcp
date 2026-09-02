"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { SlidersHorizontal, X, Clock, Star, DollarSign, ChevronRight, UtensilsCrossed, Sun, MapPin, Check, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNeighborhoods } from "@/hooks/use-deals"
import { getDealTypeConfig, getTodayName } from "@/lib/deal-utils"

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

const PRICE_OPTIONS = [
  { value: "", label: "Any" },
  { value: "under5", label: "Under $5" },
  { value: "under10", label: "Under $10" },
  { value: "under15", label: "Under $15" },
  { value: "under20", label: "Under $20" },
]

const RATING_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 4.0, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
]

const TIME_OPTIONS = [
  { value: "", label: "Any Time" },
  { value: "lunch", label: "Lunch (11a-2p)" },
  { value: "happy_hour", label: "Happy Hour (3-7p)" },
  { value: "dinner", label: "Dinner (5-9p)" },
  { value: "late_night", label: "Late Night (9p+)" },
]

export interface FilterState {
  neighborhood: string
  day: string
  deal_type: string
  q: string
  chain_filter: string
  zone: string
  gluten_free: boolean
  has_patio: boolean
  active_now: boolean
  price_range: string
  min_rating: number
  time_filter: string
  cuisine: string
}

const CUISINE_OPTIONS = [
  { value: "", label: "All Cuisines" },
  { value: "Mexican", label: "Mexican" },
  { value: "Italian", label: "Italian" },
  { value: "Japanese", label: "Japanese" },
  { value: "Chinese", label: "Chinese" },
  { value: "Thai", label: "Thai" },
  { value: "Indian", label: "Indian" },
  { value: "Korean", label: "Korean" },
  { value: "Mediterranean", label: "Mediterranean" },
  { value: "American", label: "American" },
  { value: "Seafood", label: "Seafood" },
  { value: "BBQ", label: "BBQ" },
  { value: "Pizza", label: "Pizza" },
  { value: "Sushi", label: "Sushi" },
  { value: "Vegan", label: "Vegan" },
  { value: "Gluten-Free", label: "Gluten-Free" },
]

const DEFAULT_FILTERS: FilterState = {
  neighborhood: "",
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
}

function toggleCsv(csv: string, value: string): string {
  const items = csv ? csv.split(",").filter(Boolean) : []
  const idx = items.indexOf(value)
  if (idx >= 0) items.splice(idx, 1)
  else items.push(value)
  return items.join(",")
}

function csvIncludes(csv: string, value: string): boolean {
  return csv ? csv.split(",").includes(value) : false
}

function csvCount(csv: string): number {
  return csv ? csv.split(",").filter(Boolean).length : 0
}

// --- Collapsible section wrapper ---
function FilterSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string
  icon?: React.ReactNode
  badge?: number | string | null
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-90"
          )}
        />
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {badge != null && Number(badge) > 0 && (
          <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white normal-case">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="pt-1 pb-1">{children}</div>}
    </div>
  )
}

// --- Active filter count helper ---
function countActiveFilters(filters: FilterState): number {
  let count = 0
  if (filters.active_now) count++
  if (filters.has_patio) count++
  if (filters.zone) count++
  if (filters.neighborhood) count += csvCount(filters.neighborhood)
  if (filters.day) count++
  if (filters.time_filter) count++
  if (filters.price_range) count++
  if (filters.min_rating > 0) count++
  if (filters.cuisine) count += csvCount(filters.cuisine)
  if (filters.deal_type) count += csvCount(filters.deal_type)
  return count
}

interface FilterSidebarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  className?: string
}

export function FilterSidebar({
  filters,
  onFiltersChange,
  className,
}: FilterSidebarProps) {
  const [nhSearch, setNhSearch] = useState("")
  const { data: nhData } = useNeighborhoods()
  const neighborhoods = nhData?.neighborhoods ?? []

  const todayName = getTodayName()
  const activeCount = countActiveFilters(filters)

  const handleReset = useCallback(() => {
    onFiltersChange({ ...DEFAULT_FILTERS, q: filters.q })
  }, [filters.q, onFiltersChange])

  return (
    <aside className={cn("flex flex-col gap-1", className)}>
      {/* Header with active count + reset */}
      {activeCount > 0 && (
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-border/50">
          <span className="text-xs font-medium text-muted-foreground">
            {activeCount} filter{activeCount !== 1 ? "s" : ""} active
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400"
          >
            <RotateCcw className="h-3 w-3" />
            Clear all
          </button>
        </div>
      )}

      {/* Active Now + Patio, always visible, not collapsible */}
      <div className="flex gap-2 pb-3 border-b border-border/50">
        <button
          onClick={() =>
            onFiltersChange({ ...filters, active_now: !filters.active_now })
          }
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors border",
            filters.active_now
              ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
              : "bg-card border-border text-foreground hover:bg-green-50 hover:border-green-200 hover:text-green-700 dark:hover:bg-green-950 dark:hover:text-green-400"
          )}
        >
          <span className={cn(
            "inline-block h-2 w-2 rounded-full",
            filters.active_now ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"
          )} />
          Active Now
        </button>

        <button
          onClick={() =>
            onFiltersChange({ ...filters, has_patio: !filters.has_patio })
          }
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors border",
            filters.has_patio
              ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400"
              : "bg-card border-border text-foreground hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 dark:hover:bg-amber-950 dark:hover:text-amber-400"
          )}
        >
          <Sun className={cn("h-3.5 w-3.5", filters.has_patio ? "text-amber-500" : "text-muted-foreground/50")} />
          Patio
        </button>
      </div>

      {/* Area */}
      <FilterSection
        title="Area"
        icon={<MapPin className="h-3 w-3" />}
        badge={filters.zone ? 1 : null}
        defaultOpen
      >
        <div className="flex gap-1.5">
          {([
            { value: "", label: "All" },
            { value: "city", label: "Chicago" },
            { value: "suburbs", label: "Suburbs" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                onFiltersChange({ ...filters, zone: opt.value, neighborhood: "" })
              }
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                filters.zone === opt.value
                  ? "bg-brand-500 text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950 dark:hover:text-brand-400"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Neighborhood */}
      <FilterSection
        title="Neighborhood"
        badge={csvCount(filters.neighborhood) || null}
      >
        {/* Selected pills, quick-remove without scrolling the list */}
        {filters.neighborhood && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {filters.neighborhood.split(",").filter(Boolean).map((slug) => {
              const nh = neighborhoods.find((n) => n.slug === slug)
              const label = nh?.name ?? slug
              return (
                <button
                  key={slug}
                  onClick={() =>
                    onFiltersChange({ ...filters, neighborhood: toggleCsv(filters.neighborhood, slug) })
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-primary-foreground active:bg-brand-700"
                >
                  {label}
                  <X className="h-3 w-3" />
                </button>
              )
            })}
            <button
              onClick={() => onFiltersChange({ ...filters, neighborhood: "" })}
              className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground active:bg-secondary"
            >
              Clear all
            </button>
          </div>
        )}
        <div className="max-h-56 overflow-auto rounded-lg border border-border bg-background overscroll-contain">
          <input
            type="text"
            placeholder="Search neighborhoods…"
            value={nhSearch}
            onChange={(e) => setNhSearch(e.target.value)}
            className="sticky top-0 z-10 w-full border-b border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          {neighborhoods
            .filter((n) => n.name.toLowerCase().includes(nhSearch.toLowerCase()))
            .map((n) => {
              const selected = csvIncludes(filters.neighborhood, n.slug)
              return (
                <button
                  key={n.slug}
                  onClick={() =>
                    onFiltersChange({ ...filters, neighborhood: toggleCsv(filters.neighborhood, n.slug) })
                  }
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary active:bg-secondary",
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
                  <span className="text-xs text-muted-foreground/60">{n.active_deal_count}</span>
                </button>
              )
            })}
        </div>
      </FilterSection>

      {/* Deal Type */}
      <FilterSection
        title="Deal Type"
        badge={csvCount(filters.deal_type) || null}
      >
        <div className="flex flex-col gap-1">
          {DEAL_TYPES.map((t) => {
            const config = getDealTypeConfig(t)
            const isSelected = csvIncludes(filters.deal_type, t)
            return (
              <button
                key={t}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    deal_type: toggleCsv(filters.deal_type, t),
                  })
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors text-left",
                  isSelected
                    ? "bg-brand-50 text-brand-600 font-medium dark:bg-brand-950 dark:text-brand-400"
                    : "text-foreground hover:bg-secondary"
                )}
              >
                <span className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                  isSelected ? "border-brand-500 bg-brand-500" : "border-border"
                )}>
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                {config.label}
              </button>
            )
          })}
        </div>
      </FilterSection>

      {/* Day */}
      <FilterSection
        title="Day"
        badge={filters.day ? 1 : null}
      >
        <div className="flex flex-wrap gap-1.5">
          {DAY_OPTIONS.map((d) => {
            const isToday = d.value !== "today" && d.value === todayName
            return (
              <button
                key={d.value}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    day: filters.day === d.value ? "" : d.value,
                  })
                }
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  filters.day === d.value
                    ? "bg-brand-500 text-primary-foreground"
                    : isToday
                    ? "bg-brand-50 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-950 dark:text-brand-400 dark:ring-brand-800"
                    : "bg-secondary text-secondary-foreground hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950 dark:hover:text-brand-400"
                )}
              >
                {d.label}
              </button>
            )
          })}
        </div>
      </FilterSection>

      {/* Time of Day */}
      <FilterSection
        title="Time"
        icon={<Clock className="h-3 w-3" />}
        badge={filters.time_filter ? 1 : null}
      >
        <div className="flex flex-col gap-0.5">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  time_filter: filters.time_filter === t.value ? "" : t.value,
                })
              }
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors",
                filters.time_filter === t.value
                  ? "bg-brand-50 text-brand-600 font-medium dark:bg-brand-950 dark:text-brand-400"
                  : "text-foreground hover:bg-secondary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Cuisine */}
      <FilterSection
        title="Cuisine"
        icon={<UtensilsCrossed className="h-3 w-3" />}
        badge={csvCount(filters.cuisine) || null}
      >
        <div className="flex flex-wrap gap-1.5">
          {CUISINE_OPTIONS.filter(c => c.value).map((c) => {
            const selected = csvIncludes(filters.cuisine, c.value)
            return (
              <button
                key={c.value}
                onClick={() =>
                  onFiltersChange({ ...filters, cuisine: toggleCsv(filters.cuisine, c.value) })
                }
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "bg-brand-500 text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950 dark:hover:text-brand-400"
                )}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </FilterSection>

      {/* Price Range */}
      <FilterSection
        title="Price"
        icon={<DollarSign className="h-3 w-3" />}
        badge={filters.price_range ? 1 : null}
      >
        <div className="flex flex-wrap gap-1.5">
          {PRICE_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  price_range: filters.price_range === p.value ? "" : p.value,
                })
              }
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                filters.price_range === p.value
                  ? "bg-brand-500 text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950 dark:hover:text-brand-400"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Rating */}
      <FilterSection
        title="Rating"
        icon={<Star className="h-3 w-3" />}
        badge={filters.min_rating > 0 ? 1 : null}
      >
        <div className="flex gap-1.5">
          {RATING_OPTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  min_rating: filters.min_rating === r.value ? 0 : r.value,
                })
              }
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                filters.min_rating === r.value
                  ? "bg-amber-500 text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950 dark:hover:text-amber-400"
              )}
            >
              {r.value > 0 ? `★ ${r.label}` : r.label}
            </button>
          ))}
        </div>
      </FilterSection>
    </aside>
  )
}

export function MobileFilterSheet({
  filters,
  onFiltersChange,
}: FilterSidebarProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterState>(filters)
  const sheetRef = useRef<HTMLDivElement>(null)
  const activeCount = countActiveFilters(filters)
  const draftCount = countActiveFilters(draft)

  const handleOpen = () => {
    setDraft(filters)
    setOpen(true)
  }

  const handleApply = () => {
    onFiltersChange(draft)
    setOpen(false)
  }

  const handleReset = () => {
    const reset: FilterState = { ...DEFAULT_FILTERS, q: filters.q }
    setDraft(reset)
  }

  // Lock body scroll + track visualViewport so the sheet stays anchored to the
  // VISIBLE area when the user pinch-zooms (otherwise the Apply button can be
  // off-screen at the bottom of the layout viewport).
  useEffect(() => {
    if (!open) return
    const body = document.body
    const prevOverflow = body.style.overflow
    const prevPaddingRight = body.style.paddingRight
    // Compensate for scrollbar disappearing on desktop; harmless on mobile.
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = "hidden"
    if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`

    const sheet = sheetRef.current
    const vv = typeof window !== "undefined" ? window.visualViewport : null

    const sync = () => {
      if (!sheet || !vv) return
      // Distance from bottom of layout viewport to bottom of visual viewport.
      // > 0 when the user is zoomed and scrolled, or when the on-screen
      // keyboard is up. Anchoring `bottom` to this keeps the sheet visible.
      const layoutH = document.documentElement.clientHeight
      const visibleBottom = vv.offsetTop + vv.height
      const bottomOffset = Math.max(0, layoutH - visibleBottom)
      sheet.style.setProperty("--vv-bottom", `${bottomOffset}px`)
      sheet.style.setProperty("--vv-height", `${vv.height}px`)
    }
    sync()

    if (vv) {
      vv.addEventListener("resize", sync)
      vv.addEventListener("scroll", sync)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)

    return () => {
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPaddingRight
      if (vv) {
        vv.removeEventListener("resize", sync)
        vv.removeEventListener("scroll", sync)
      }
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filter deals"
        >
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div
            ref={sheetRef}
            className="fixed left-0 right-0 flex flex-col rounded-t-2xl bg-card shadow-2xl"
            style={{
              // Anchor to the VISUAL viewport bottom (set by sync()), with a
              // safe-area fallback. Height caps at 92% of the visible area so
              // the Apply bar is always above the fold even when zoomed.
              bottom: "calc(var(--vv-bottom, 0px) + env(safe-area-inset-bottom, 0px))",
              maxHeight: "min(var(--vv-height, 92dvh), 92dvh)",
              // Vertical scroll inside the sheet, but disable pinch-zoom
              // gestures here so the page underneath doesn't fight us.
              touchAction: "pan-y",
            }}
          >
            {/* Drag indicator */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
              <h2 className="text-lg font-semibold text-foreground">Filters</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-5 pb-2"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <FilterSidebar
                filters={draft}
                onFiltersChange={setDraft}
              />
            </div>
            <div className="shrink-0 flex gap-3 border-t border-border bg-card px-5 pt-3 pb-[max(env(safe-area-inset-bottom,0px),16px)]">
              <button
                onClick={handleReset}
                className="flex-1 min-h-[48px] rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="flex-[1.5] min-h-[48px] rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600 active:bg-brand-700"
              >
                {draftCount > 0 ? `Apply Filters (${draftCount})` : "Apply Filters"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
