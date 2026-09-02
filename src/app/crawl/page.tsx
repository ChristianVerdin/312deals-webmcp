"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Beer,
  Users,
  Clock,
  DollarSign,
  MapPin,
  ArrowDown,
  Share2,
  Sparkles,
  Route,
  ChevronRight,
  Wallet,
  Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { trackCrawlPlanned } from "@/lib/analytics"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCard, DealCardSkeleton } from "@/components/deal-card"
import { DealTypeBadge } from "@/components/deal-type-badge"
import { ActiveNowIndicator } from "@/components/active-now-indicator"
import { SaveDealButton } from "@/components/save-deal-button"
import {
  isDealActiveNow,
  formatDays,
  formatTimeRange,
  getDealTypeConfig,
} from "@/lib/deal-utils"
import { useNeighborhoods, useCrawl } from "@/hooks/use-deals"

const HOUR_OPTIONS = [2, 3, 4, 5, 6]
const GROUP_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

function CrawlStopCard({
  deal,
  stopNumber,
  isLast,
}: {
  deal: import("@/lib/types").Deal
  stopNumber: number
  isLast: boolean
}) {
  const active = isDealActiveNow(deal)
  const daysText = formatDays(deal.days_available)
  const timeText = formatTimeRange(
    deal.start_time,
    deal.end_time,
    deal.is_all_day
  )

  return (
    <div className="flex gap-4">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            active
              ? "bg-green-500 text-primary-foreground"
              : "bg-brand-500 text-primary-foreground"
          )}
        >
          {stopNumber}
        </div>
        {!isLast && (
          <div className="my-1 flex flex-1 flex-col items-center">
            <div className="h-full w-px bg-border" />
            <ArrowDown className="my-1 h-3 w-3 text-muted-foreground/50" />
            <div className="h-2 w-px bg-border" />
          </div>
        )}
      </div>

      {/* Card */}
      <div className="mb-4 flex-1 rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <DealTypeBadge dealType={deal.deal_type} />
                {active && <ActiveNowIndicator />}
              </div>
              <h3 className="text-base font-bold text-foreground">
                {deal.venue_name}
              </h3>
              <p className="mt-0.5 text-sm font-medium text-brand-600">
                {deal.title}
              </p>
            </div>
            <SaveDealButton dealId={deal.id} />
          </div>

          {deal.best_deal_item && (
            <p className="mt-3 text-sm text-foreground">
              <Tag className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
              {deal.best_deal_item}
            </p>
          )}

          {deal.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {deal.description}
            </p>
          )}

          {/* Food & drink items */}
          {Array.isArray(deal.food_items) && deal.food_items.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {deal.food_items.slice(0, 3).map((item, i) => (
                <span
                  key={i}
                  className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                >
                  {item.name}
                  {item.deal_price !== null && ` $${item.deal_price}`}
                </span>
              ))}
            </div>
          )}

          {Array.isArray(deal.drink_items) && deal.drink_items.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {deal.drink_items.slice(0, 3).map((item, i) => (
                <span
                  key={i}
                  className="rounded-md bg-sky-400/10 px-2 py-0.5 text-xs text-sky-500"
                >
                  {item.name}
                  {item.deal_price !== null && ` $${item.deal_price}`}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {deal.neighborhood}
            </span>
            {daysText && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {daysText}
                {timeText && ` ${timeText}`}
              </span>
            )}
            {deal.best_savings_pct != null && deal.best_savings_pct > 0 && (
              <span className="font-semibold text-green-600">
                Save {Math.round(deal.best_savings_pct)}%
              </span>
            )}
          </div>

          {deal.restrictions && (
            <p className="mt-2 text-xs italic text-muted-foreground">
              {deal.restrictions}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CrawlPage() {
  const [neighborhood, setNeighborhood] = useState("")
  const [hours, setHours] = useState(3)
  const [groupSize, setGroupSize] = useState(2)
  const [budget, setBudget] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const { data: nhData, isLoading: nhLoading } = useNeighborhoods()
  const neighborhoods = useMemo(
    () =>
      nhData?.neighborhoods
        ?.filter((n) => n.active_deal_count > 0)
        .sort((a, b) => b.active_deal_count - a.active_deal_count) ?? [],
    [nhData]
  )

  const crawlParams = useMemo(
    () =>
      submitted && neighborhood
        ? {
            neighborhood,
            hours,
            group_size: groupSize,
            ...(budget ? { budget: Number(budget) } : {}),
          }
        : { neighborhood: "" },
    [submitted, neighborhood, hours, groupSize, budget]
  )

  const {
    data: crawlData,
    isLoading: crawlLoading,
    error,
  } = useCrawl(crawlParams)

  // Track successful crawl plans
  useEffect(() => {
    if (submitted && crawlData?.crawl && !crawlLoading) {
      trackCrawlPlanned({
        neighborhood,
        hours,
        group_size: groupSize,
        stops: crawlData.stops,
      })
    }
  }, [crawlData, crawlLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePlan(e: React.FormEvent) {
    e.preventDefault()
    if (neighborhood) setSubmitted(true)
  }

  function resetForm() {
    setSubmitted(false)
  }

  function handleShare() {
    const params = new URLSearchParams({
      neighborhood,
      hours: String(hours),
      group_size: String(groupSize),
    })
    if (budget) params.set("budget", budget)
    const url = `${window.location.origin}/crawl?${params}`

    if (navigator.share) {
      navigator.share({ title: "312Deals Bar Crawl", url })
    } else {
      navigator.clipboard.writeText(url)
      alert("Link copied to clipboard!")
    }
  }

  const selectedNhName = neighborhoods.find(
    (n) => n.slug === neighborhood
  )?.name

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6 lg:py-12">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
              <Beer className="h-7 w-7 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
              Bar Crawl Planner
            </h1>
            <p className="mt-2 text-sm text-muted-foreground lg:text-base">
              Plan the perfect deals-optimized bar crawl route through Chicago.
            </p>
          </div>

          {/* Planning Form */}
          <form
            onSubmit={handlePlan}
            className="mb-10 rounded-xl border border-border bg-card p-5 lg:p-6"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Neighborhood */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="crawl-neighborhood" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Neighborhood
                </label>
                <select
                  id="crawl-neighborhood"
                  value={neighborhood}
                  onChange={(e) => {
                    setNeighborhood(e.target.value)
                    setSubmitted(false)
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20"
                  required
                >
                  <option value="">Select area</option>
                  {nhLoading ? (
                    <option disabled>Loading...</option>
                  ) : (
                    neighborhoods.map((n) => (
                      <option key={n.slug} value={n.slug}>
                        {n.name} ({n.active_deal_count})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Hours */}
              <div>
                <label htmlFor="crawl-duration" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Duration
                </label>
                <select
                  id="crawl-duration"
                  value={hours}
                  onChange={(e) => {
                    setHours(Number(e.target.value))
                    setSubmitted(false)
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20"
                >
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h} hours
                    </option>
                  ))}
                </select>
              </div>

              {/* Group size */}
              <div>
                <label htmlFor="crawl-group-size" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3 w-3" />
                  Group Size
                </label>
                <select
                  id="crawl-group-size"
                  value={groupSize}
                  onChange={(e) => {
                    setGroupSize(Number(e.target.value))
                    setSubmitted(false)
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20"
                >
                  {GROUP_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s} {s === 1 ? "person" : "people"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Budget (optional) */}
              <div>
                <label htmlFor="crawl-budget" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Wallet className="h-3 w-3" />
                  Budget
                  <span className="font-normal normal-case text-muted-foreground/60">
                    (optional)
                  </span>
                </label>
                <input
                  id="crawl-budget"
                  type="number"
                  min={0}
                  step={5}
                  value={budget}
                  onChange={(e) => {
                    setBudget(e.target.value)
                    setSubmitted(false)
                  }}
                  placeholder="$"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!neighborhood}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600 disabled:opacity-40 sm:w-auto"
            >
              <Route className="h-4 w-4" />
              Plan My Crawl
            </button>
          </form>

          {/* Loading state */}
          {submitted && crawlLoading && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                <div className="h-5 w-28 animate-pulse rounded bg-muted" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                    {i < 2 && <div className="my-1 h-16 w-px bg-border" />}
                  </div>
                  <div className="flex-1">
                    <DealCardSkeleton />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {submitted && error && !crawlLoading && (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                <Beer className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {"Couldn't generate a crawl plan"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different neighborhood or adjust your settings.
              </p>
              <button
                onClick={resetForm}
                className="mt-4 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Try again
              </button>
            </div>
          )}

          {/* Results */}
          {submitted && crawlData && crawlData.crawl && !crawlLoading && (
            <div>
              {/* Summary bar */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm text-foreground">
                    <Route className="h-4 w-4 text-brand-500" />
                    <span className="font-bold">{crawlData.stops}</span>
                    <span className="text-muted-foreground">stops</span>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5 text-sm text-foreground">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{crawlData.group_size}</span>
                    <span className="text-muted-foreground">
                      {crawlData.group_size === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5 text-sm text-foreground">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{hours}h</span>
                  </div>
                  {crawlData.estimated_savings > 0 && (
                    <>
                      <div className="h-4 w-px bg-border" />
                      <div className="flex items-center gap-1.5 text-sm font-bold text-green-600">
                        <DollarSign className="h-4 w-4" />
                        Save ~${crawlData.estimated_savings.toFixed(0)}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetForm}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                </div>
              </div>

              {/* Route title */}
              {selectedNhName && (
                <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-brand-500" />
                  <span className="font-medium text-foreground">
                    {selectedNhName}
                  </span>
                  <ChevronRight className="h-3 w-3" />
                  <span>{crawlData.stops} stops</span>
                  <ChevronRight className="h-3 w-3" />
                  <span>~{hours} hours</span>
                </div>
              )}

              {/* Itinerary */}
              <div>
                {crawlData.crawl.map((deal, i) => (
                  <CrawlStopCard
                    key={deal.id}
                    deal={deal}
                    stopNumber={i + 1}
                    isLast={i === crawlData.crawl.length - 1}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!submitted && (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
                <Sparkles className="h-8 w-8 text-brand-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Ready to explore?
              </h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {"Select a neighborhood and hit Plan My Crawl. We'll build a deals-optimized itinerary for your group, sorted by proximity and deal quality."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {neighborhoods.slice(0, 5).map((n) => (
                  <button
                    key={n.slug}
                    onClick={() => setNeighborhood(n.slug)}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    {n.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
