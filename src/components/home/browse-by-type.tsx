"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Sun, Wine, Coffee, Moon, Tag, Heart, Sparkles, Trophy, MapPin, Star, Clock, ExternalLink,
  Beer, Waves, Martini, Wheat, GlassWater, Package, PartyPopper, Smartphone
} from "lucide-react"
import { useDeals, useDealTypeCounts } from "@/hooks/use-deals"
import type { Deal } from "@/lib/types"

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const DEAL_TYPE_LABEL: Record<string, string> = {
  happy_hour: "Happy Hour",
  daily_special: "Daily Special",
  brunch_deal: "Brunch",
  late_night: "Late Night",
  game_day: "Game Day",
  seasonal_lto: "Seasonal",
  event_driven: "Event",
  loyalty_reward: "Loyalty",
  group_package: "Group",
  chain_app_deal: "App Deal",
  restaurant_week: "Restaurant Week",
  new_opening: "New",
  other: "Deal",
}

const DAY_SHORT: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
}

function todayKey() { return DAYS[new Date().getDay()] }
function todayLabel() { return DAY_LABELS[new Date().getDay()] }

// Compact large counts so the badge pills stay tidy: 37933 -> "37.9K", 3065 -> "3.1K".
function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`
  return String(n)
}

function formatDays(days: string[] | null | undefined): string {
  if (!days || days.length === 0) return "Every day"
  if (days.length === 7) return "Every day"
  const weekdays = ["monday","tuesday","wednesday","thursday","friday"]
  const weekend = ["saturday","sunday"]
  const lower = days.map((d) => d.toLowerCase())
  if (lower.length === 5 && weekdays.every((d) => lower.includes(d))) return "Weekdays"
  if (lower.length === 2 && weekend.every((d) => lower.includes(d))) return "Weekends"
  return lower.map((d) => DAY_SHORT[d] ?? d.slice(0, 3)).join(", ")
}

function formatTime12(t: string | null): string {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hh = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hh}${ampm}` : `${hh}:${m.toString().padStart(2, "0")}${ampm}`
}

function formatTimeRange(start: string | null, end: string | null, allDay: number | boolean): string | null {
  if (allDay) return "All day"
  if (!start && !end) return null
  if (start && end) return `${formatTime12(start)} – ${formatTime12(end)}`
  return start ? `From ${formatTime12(start)}` : null
}

type Tab = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  filter: (d: Deal) => boolean
}

function isLiveToday(d: Deal, today: string): boolean {
  const days = (d.days_available ?? []).map((x) => x.toLowerCase())
  // No specific days = runs every day. Otherwise it must include today, an
  // "all day" deal is still only live on its listed days (a Friday-only all-day
  // special is NOT live on Wednesday).
  return days.length === 0 || days.includes(today)
}

function makeTabs(): Tab[] {
  const today = todayKey()
  return [
    { key: "today", label: `Today · ${todayLabel()}`, icon: Sparkles, filter: (d) => isLiveToday(d, today) },
    { key: "happy_hour", label: "Happy Hour", icon: Wine, filter: (d) => d.deal_type === "happy_hour" },
    { key: "brunch_deal", label: "Brunch", icon: Coffee, filter: (d) => d.deal_type === "brunch_deal" },
    { key: "daily_special", label: "Daily Specials", icon: Tag, filter: (d) => d.deal_type === "daily_special" },
    { key: "event_driven", label: "Events", icon: PartyPopper, filter: (d) => d.deal_type === "event_driven" },
    { key: "late_night", label: "Late Night", icon: Moon, filter: (d) => d.deal_type === "late_night" },
    { key: "game_day", label: "Game Day", icon: Trophy, filter: (d) => d.deal_type === "game_day" },
    { key: "seasonal_lto", label: "Seasonal", icon: Sun, filter: (d) => d.deal_type === "seasonal_lto" },
    { key: "chain_app_deal", label: "App Deals", icon: Smartphone, filter: (d) => d.deal_type === "chain_app_deal" },
    { key: "weekend", label: "Weekends", icon: Heart, filter: (d) => {
      const days = (d.days_available ?? []).map((x) => x.toLowerCase())
      return days.includes("saturday") || days.includes("sunday")
    }},
  ]
}

// Deterministic daily rotation so the "Top spots" lineup isn't frozen in the
// same order every day. Seeded by date (stable within a day) + active tab.
// ssr:false component → no hydration mismatch from Date.
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice()
  const rand = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function dateSeed(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

const DOMESTIC_BOTTLES = ["miller lite","miller light","bud light","budweiser","coors light","coors banquet","michelob ultra","mich ultra","high life","pbr","pabst","hamms","hamm's","modelo","corona","blue moon","yuengling","rolling rock","busch","natty"]
const SELTZERS = ["seltzer","high noon","white claw","truly","cutwater","vodka soda","vizzy","bud light seltzer"]
const COCKTAILS = ["cocktail","martini","margarita","old fashioned","mule","moscow mule","spritz","aperol","negroni","manhattan","paloma","daiquiri","mai tai","mojito","sangria","frozen","slushy","espresso martini","whiskey sour"]
const BUCKETS = ["bucket"]
const WINE_SPECIALS = ["wine","bottle of wine","glass of wine","rosé","rose","prosecco","champagne"]

type Theme = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  blurb: string
  match: (item: string, deal: Deal) => boolean
  glutenFree?: boolean
}

const THEMES: Theme[] = [
  { key: "domestic", label: "Cheap Domestic Bottles", icon: Beer,
    blurb: "Miller Lite, Michelob Ultra, High Life, PBR, and the classic value lineup.",
    match: (n) => DOMESTIC_BOTTLES.some((kw) => n.toLowerCase().includes(kw)) },
  { key: "seltzer", label: "Seltzer Deals", icon: Waves,
    blurb: "High Noons, White Claws, vodka sodas, patio essentials.",
    match: (n) => SELTZERS.some((kw) => n.toLowerCase().includes(kw)) },
  { key: "buckets", label: "Bucket Deals", icon: Package,
    blurb: "Share with the table, buckets of beer for groups.",
    match: (n, d) => {
      const lower = n.toLowerCase()
      const t = (d.title ?? "").toLowerCase()
      const desc = (d.description ?? "").toLowerCase()
      return BUCKETS.some((kw) => lower.includes(kw) || t.includes(kw) || desc.includes(kw))
    }},
  { key: "cocktails", label: "Cheap Cocktails", icon: Martini,
    blurb: "Margaritas, martinis, spritzes, mules, fancy drinks on sale.",
    match: (n) => COCKTAILS.some((kw) => n.toLowerCase().includes(kw)) },
  { key: "wine", label: "Wine Specials", icon: GlassWater,
    blurb: "Bottles, glasses, rosé, wine deals across the city.",
    match: (n) => WINE_SPECIALS.some((kw) => n.toLowerCase().includes(kw)) },
  { key: "gluten_free", label: "Gluten-Free Options", icon: Wheat,
    blurb: "Safe picks for gluten-free diners.",
    match: () => false, glutenFree: true },
]

export default function HomeBrowseByType() {
  const today = todayKey()
  const { data, isLoading } = useDeals({ day: today, limit: 200, sort: "recently_updated" })
  const allDeals = data?.deals ?? []
  // True per-type counts for the tab badges. Falls back to the 200-deal sample
  // if the endpoint is unavailable (e.g. not yet deployed), no regression.
  const { data: liveCounts } = useDealTypeCounts({ day: today })

  const tabs = useMemo(() => makeTabs(), [])
  const [activeTab, setActiveTab] = useState("today")
  const [activeTheme, setActiveTheme] = useState<string | null>(null)

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of tabs) {
      if (liveCounts) {
        counts[t.key] =
          t.key === "today" ? liveCounts.total
          : t.key === "weekend" ? liveCounts.weekend
          : liveCounts.counts[t.key] ?? 0
      } else {
        counts[t.key] = allDeals.filter(t.filter).length
      }
    }
    return counts
  }, [liveCounts, allDeals, tabs])

  const filtered = useMemo(() => {
    const t = tabs.find((x) => x.key === activeTab) ?? tabs[0]
    return allDeals.filter(t.filter)
  }, [allDeals, activeTab, tabs])

  // Group by venue (top spots for selected tab)
  type VenueGroup = {
    venue_name: string; venue_slug: string; neighborhood: string; neighborhood_slug: string
    google_rating?: number | null; deals: Deal[]; rank: number
  }
  const featured = useMemo(() => {
    // `filtered` preserves the API's sort:"updated" order, so first-seen =
    // most-recently-updated. Build venue groups in that recency order.
    const map = new Map<string, VenueGroup>()
    const recencyOrder: string[] = []
    for (const d of filtered) {
      if (!d.venue_slug) continue
      const ex = map.get(d.venue_slug)
      if (ex) {
        ex.deals.push(d)
        ex.rank = Math.max(ex.rank, d.quality_score ?? 0)
      } else {
        map.set(d.venue_slug, {
          venue_name: d.venue_name, venue_slug: d.venue_slug,
          neighborhood: d.neighborhood ?? "", neighborhood_slug: d.neighborhood_slug ?? "",
          google_rating: d.google_rating, deals: [d], rank: d.quality_score ?? 0,
        })
        recencyOrder.push(d.venue_slug)
      }
    }
    // Keep the freshest venues, spread across areas (max 2 per neighborhood) so
    // the lineup is varied, then daily-rotate a generous pool down to 9 so it
    // isn't the same fixed order every visit. Underlying recency means the pool
    // genuinely shifts as deals get re-verified.
    const counts = new Map<string, number>()
    const pool: VenueGroup[] = []
    for (const slug of recencyOrder) {
      const g = map.get(slug)!
      const k = g.neighborhood_slug || "_"
      const c = counts.get(k) ?? 0
      if (c >= 2) continue
      pool.push(g); counts.set(k, c + 1)
      if (pool.length >= 24) break
    }
    return seededShuffle(pool, seedFromString(dateSeed() + ":" + activeTab)).slice(0, 9)
  }, [filtered, activeTab])

  // Themed drink results (only computed when a theme is active)
  type ThemedItem = { name: string; price: number | null; venue: string; venue_slug: string; neighborhood: string }
  const themedItems = useMemo<ThemedItem[]>(() => {
    if (!activeTheme) return []
    const theme = THEMES.find((t) => t.key === activeTheme)
    if (!theme) return []
    const results: ThemedItem[] = []
    const seen = new Set<string>()
    const hoodCount = new Map<string, number>()
    for (const d of allDeals) {
      if (theme.glutenFree) {
        if (!(d as any).is_gluten_free) continue
        const k = `${d.venue_slug}:${d.title}`
        if (seen.has(k)) continue; seen.add(k)
        const c = hoodCount.get(d.neighborhood ?? "") ?? 0
        if (c >= 2) continue
        hoodCount.set(d.neighborhood ?? "", c + 1)
        results.push({ name: d.title, price: null, venue: d.venue_name, venue_slug: d.venue_slug, neighborhood: d.neighborhood ?? "" })
      } else {
        const items = Array.isArray(d.drink_items) ? d.drink_items : []
        for (const it of items) {
          if (!it?.name) continue
          if (!theme.match(it.name, d)) continue
          const k = `${d.venue_slug}:${it.name}`
          if (seen.has(k)) continue; seen.add(k)
          const c = hoodCount.get(d.neighborhood ?? "") ?? 0
          if (c >= 2) continue
          hoodCount.set(d.neighborhood ?? "", c + 1)
          results.push({
            name: it.name, price: it.deal_price ?? null,
            venue: d.venue_name, venue_slug: d.venue_slug, neighborhood: d.neighborhood ?? "",
          })
        }
      }
    }
    results.sort((a, b) => (a.price ?? 9999) - (b.price ?? 9999))
    return results.slice(0, 10)
  }, [allDeals, activeTheme])

  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of THEMES) {
      let n = 0
      for (const d of allDeals) {
        if (t.glutenFree) { if ((d as any).is_gluten_free) n++ }
        else {
          const items = Array.isArray(d.drink_items) ? d.drink_items : []
          if (items.some((it) => it?.name && t.match(it.name, d))) n++
        }
      }
      counts[t.key] = n
    }
    return counts
  }, [allDeals])

  if (isLoading && allDeals.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:px-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted mb-4" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
      </section>
    )
  }

  if (allDeals.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:px-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">Browse Deals by Type</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live deal counts. Start with today&apos;s active deals or jump to a category.
          </p>
        </div>
        <Link href="/deals" className="shrink-0 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
          All Chicago food deals &rarr;
        </Link>
      </div>

      {/* Type tabs */}
      <div className="mb-5 overflow-x-auto">
        <div className="flex min-w-max gap-2 border-b border-border pb-px">
          {tabs.map((t) => {
            const Icon = t.icon
            const count = tabCounts[t.key] ?? 0
            const isActive = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                disabled={count === 0 && t.key !== "today"}
                className={
                  "group inline-flex items-center gap-2 rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors " +
                  (isActive
                    ? "border-b-2 border-brand-500 bg-brand-500/10 text-foreground"
                    : "border-b-2 border-transparent text-muted-foreground hover:bg-card hover:text-foreground")
                }
              >
                <Icon className={"h-4 w-4 " + (isActive ? "text-brand-500" : "")} />
                <span>{t.label}</span>
                <span className={
                  "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums " +
                  (isActive ? "bg-brand-500 text-primary-foreground" : "bg-muted text-muted-foreground")
                }>{formatCount(count)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Top venue cards for current tab */}
      {featured.length > 0 ? (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">
              Top {tabs.find((t) => t.key === activeTab)?.label} Spots
            </h3>
            <span className="text-xs text-muted-foreground">{featured.length} of {formatCount(tabCounts[activeTab] ?? filtered.length)} deals</span>
          </div>
          <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
            {featured.map((v) => {
              const lead = v.deals[0]
              const more = v.deals.length - 1
              const timeRange = formatTimeRange(lead.start_time, lead.end_time, lead.is_all_day)
              return (
                <article key={v.venue_slug} className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-400/60">
                  <div className="mb-2 min-w-0">
                    <h4 className="truncate text-sm font-semibold text-foreground">
                      <Link href={`/venues/${v.venue_slug}`} className="hover:text-brand-600 dark:hover:text-brand-400">
                        {v.venue_name}
                      </Link>
                    </h4>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {v.neighborhood && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />{v.neighborhood}
                        </span>
                      )}
                      {v.google_rating != null && (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />{v.google_rating.toFixed(1)}
                        </span>
                      )}
                      <span>·</span>
                      <span>{v.deals.length} deal{v.deals.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                      {DEAL_TYPE_LABEL[lead.deal_type] ?? "Deal"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{formatDays(lead.days_available)}</span>
                    {timeRange && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />{timeRange}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground">{lead.title}</p>
                  {more > 0 && (
                    <Link href={`/venues/${v.venue_slug}`} className="mt-2 inline-flex items-center gap-1 self-start text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                      +{more} more deal{more === 1 ? "" : "s"} <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </article>
              )
            })}
          </div>
        </>
      ) : (
        <div className="mb-8 rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No {tabs.find((t) => t.key === activeTab)?.label.toLowerCase()} deals available right now. Try another tab.</p>
        </div>
      )}

      {/* Drink-theme chips */}
      <div className="mb-3">
        <h3 className="text-base font-semibold text-foreground">Deals by Drink Category</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Themes pulled from live deal items, cheap domestics, seltzers, buckets, cocktails, wine, gluten-free.
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {THEMES.map((t) => {
          const Icon = t.icon
          const count = themeCounts[t.key] ?? 0
          const isActive = activeTheme === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTheme(isActive ? null : t.key)}
              disabled={count === 0}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors " +
                (isActive
                  ? "border-brand-500 bg-brand-500/15 text-foreground"
                  : count === 0
                    ? "border-border bg-card text-muted-foreground/40 cursor-not-allowed"
                    : "border-border bg-card text-muted-foreground hover:border-brand-400/60 hover:text-foreground")
              }
            >
              <Icon className={"h-3.5 w-3.5 " + (isActive ? "text-brand-500" : "")} />
              <span>{t.label}</span>
              <span className={
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums " +
                (isActive ? "bg-brand-500 text-primary-foreground" : "bg-muted")
              }>{formatCount(count)}</span>
            </button>
          )
        })}
      </div>

      {/* Active theme content */}
      {activeTheme && themedItems.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-start gap-3">
            {(() => {
              const t = THEMES.find((x) => x.key === activeTheme)!
              const Icon = t.icon
              return (
                <>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{t.label}</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.blurb}</p>
                  </div>
                </>
              )
            })()}
          </div>
          <ul className="divide-y divide-border/60">
            {themedItems.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/venues/${item.venue_slug}`} className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400">
                    {item.venue}
                  </Link>
                  {item.neighborhood && <div className="text-xs text-muted-foreground">{item.neighborhood}</div>}
                  <div className="mt-1">
                    <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs text-foreground">{item.name}</span>
                  </div>
                </div>
                {item.price != null && (
                  <span className="shrink-0 text-base font-bold text-green-600 dark:text-green-400 tabular-nums">
                    ${item.price.toFixed(2)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
