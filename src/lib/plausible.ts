/**
 * Plausible Analytics Stats API v2 client
 * Docs: https://plausible.io/docs/stats-api
 *
 * Single endpoint: POST https://plausible.io/api/v2/query
 * Auth: Bearer token via PLAUSIBLE_API_KEY env var
 * Rate limit: 600 req/hour
 */

const PLAUSIBLE_API_URL = "https://plausible.io/api/v2/query"
const SITE_ID = "312deals.com"

// ─── Types ────────────────────────────────────────────────

export type DateRange =
  | "day" | "24h" | "7d" | "28d" | "30d" | "91d"
  | "month" | "6mo" | "12mo" | "year" | "all"
  | [string, string] // custom ISO8601 range

export type Metric =
  | "visitors" | "visits" | "pageviews" | "views_per_visit"
  | "bounce_rate" | "visit_duration" | "events"
  | "percentage" | "conversion_rate" | "time_on_page"

export type Dimension =
  | "event:page" | "event:hostname" | "event:goal"
  | "visit:source" | "visit:referrer" | "visit:channel"
  | "visit:utm_source" | "visit:utm_medium" | "visit:utm_campaign"
  | "visit:entry_page" | "visit:exit_page"
  | "visit:device" | "visit:browser" | "visit:os"
  | "visit:country_name" | "visit:region_name" | "visit:city_name"
  | "time" | "time:hour" | "time:day" | "time:week" | "time:month"

export type FilterOp = "is" | "is_not" | "contains" | "contains_not" | "matches"
export type Filter = [FilterOp, string, string[]]

interface PlausibleQuery {
  site_id: string
  metrics: Metric[]
  date_range: DateRange
  dimensions?: Dimension[]
  filters?: Filter[]
  order_by?: [string, string][]
  include?: { imports?: boolean; time_labels?: boolean; total_rows?: boolean }
  pagination?: { limit?: number; offset?: number }
}

export interface PlausibleResult {
  dimensions: string[]
  metrics: (number | null)[]
}

export interface PlausibleResponse {
  results: PlausibleResult[]
  meta: Record<string, unknown>
  query: PlausibleQuery
}

// ─── Core query function ──────────────────────────────────

export async function queryPlausible(
  query: Omit<PlausibleQuery, "site_id">
): Promise<PlausibleResponse> {
  const apiKey = process.env.PLAUSIBLE_API_KEY
  if (!apiKey) throw new Error("PLAUSIBLE_API_KEY not set")

  const res = await fetch(PLAUSIBLE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site_id: SITE_ID, ...query }),
    next: { revalidate: 300 }, // cache 5 min
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Plausible API ${res.status}: ${body}`)
  }

  return res.json()
}

// ─── Convenience functions ────────────────────────────────

/** Get aggregate stats (visitors, pageviews, bounce rate, visit duration) */
export async function getAggregate(dateRange: DateRange = "30d") {
  const data = await queryPlausible({
    metrics: ["visitors", "pageviews", "bounce_rate", "visit_duration", "views_per_visit"],
    date_range: dateRange,
  })
  const m = data.results[0]?.metrics ?? [0, 0, 0, 0, 0]
  return {
    visitors: m[0] ?? 0,
    pageviews: m[1] ?? 0,
    bounceRate: m[2] ?? 0,
    visitDuration: m[3] ?? 0,
    viewsPerVisit: m[4] ?? 0,
  }
}

/** Get top pages by visitors */
export async function getTopPages(dateRange: DateRange = "30d", limit = 20) {
  const data = await queryPlausible({
    metrics: ["visitors", "pageviews"],
    date_range: dateRange,
    dimensions: ["event:page"],
    order_by: [["visitors", "desc"]],
    pagination: { limit },
  })
  return data.results.map((r) => ({
    page: r.dimensions[0],
    visitors: r.metrics[0] ?? 0,
    pageviews: r.metrics[1] ?? 0,
  }))
}

/** Get traffic sources breakdown */
export async function getTrafficSources(dateRange: DateRange = "30d") {
  const data = await queryPlausible({
    metrics: ["visitors", "bounce_rate"],
    date_range: dateRange,
    dimensions: ["visit:source"],
    order_by: [["visitors", "desc"]],
    pagination: { limit: 20 },
  })
  return data.results.map((r) => ({
    source: r.dimensions[0],
    visitors: r.metrics[0] ?? 0,
    bounceRate: r.metrics[1] ?? 0,
  }))
}

/** Get daily visitor timeseries */
export async function getDailyVisitors(dateRange: DateRange = "30d") {
  const data = await queryPlausible({
    metrics: ["visitors", "pageviews"],
    date_range: dateRange,
    dimensions: ["time:day"],
    include: { time_labels: true },
  })
  return data.results.map((r) => ({
    date: r.dimensions[0],
    visitors: r.metrics[0] ?? 0,
    pageviews: r.metrics[1] ?? 0,
  }))
}

/** Get top entry pages */
export async function getTopEntryPages(dateRange: DateRange = "30d", limit = 10) {
  const data = await queryPlausible({
    metrics: ["visitors", "visits"],
    date_range: dateRange,
    dimensions: ["visit:entry_page"],
    order_by: [["visitors", "desc"]],
    pagination: { limit },
  })
  return data.results.map((r) => ({
    page: r.dimensions[0],
    visitors: r.metrics[0] ?? 0,
    visits: r.metrics[1] ?? 0,
  }))
}

/** Get device breakdown */
export async function getDeviceBreakdown(dateRange: DateRange = "30d") {
  const data = await queryPlausible({
    metrics: ["visitors", "percentage"],
    date_range: dateRange,
    dimensions: ["visit:device"],
  })
  return data.results.map((r) => ({
    device: r.dimensions[0],
    visitors: r.metrics[0] ?? 0,
    percentage: r.metrics[1] ?? 0,
  }))
}

/** Get city-level geo breakdown */
export async function getCityBreakdown(dateRange: DateRange = "30d", limit = 15) {
  const data = await queryPlausible({
    metrics: ["visitors"],
    date_range: dateRange,
    dimensions: ["visit:city_name"],
    order_by: [["visitors", "desc"]],
    pagination: { limit },
  })
  return data.results.map((r) => ({
    city: r.dimensions[0],
    visitors: r.metrics[0] ?? 0,
  }))
}

/** Get channel breakdown (Organic Search, Direct, Referral, etc.) */
export async function getChannelBreakdown(dateRange: DateRange = "30d") {
  const data = await queryPlausible({
    metrics: ["visitors", "bounce_rate"],
    date_range: dateRange,
    dimensions: ["visit:channel"],
    order_by: [["visitors", "desc"]],
  })
  return data.results.map((r) => ({
    channel: r.dimensions[0],
    visitors: r.metrics[0] ?? 0,
    bounceRate: r.metrics[1] ?? 0,
  }))
}
