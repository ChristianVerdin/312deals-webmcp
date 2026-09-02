"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { MapPin, Star, Clock, ExternalLink, Sun, Wine, Coffee, Moon, Tag, Heart, Sparkles, Beer, Smartphone, PartyPopper } from "lucide-react"
import type { PatioDealLite } from "@/lib/types"

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

function formatDays(days: string[] | null | undefined): string {
  if (!days || days.length === 0) return "Every day"
  if (days.length === 7) return "Every day"
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"]
  const weekend = ["saturday", "sunday"]
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
  filter: (d: PatioDealLite) => boolean
}

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function todayKey(): string {
  return DAYS[new Date().getDay()]
}

function todayLabel(): string {
  return DAY_LABELS[new Date().getDay()]
}

function isLiveToday(d: PatioDealLite, today: string): boolean {
  const days = (d.days_available ?? []).map((x) => x.toLowerCase())
  // No specific days listed = runs every day. Otherwise it must include today
  // an "all day" deal is still only live on its listed days (e.g. a Friday-only
  // all-day special is NOT live on Wednesday).
  return days.length === 0 || days.includes(today)
}

function makeTabs(): Tab[] {
  const today = todayKey()
  return [
    { key: "today", label: `Today · ${todayLabel()}`, icon: Sparkles, filter: (d) => isLiveToday(d, today) },
    { key: "all", label: "All Patios", icon: Sun, filter: () => true },
    { key: "happy_hour", label: "Happy Hour", icon: Wine, filter: (d) => d.deal_type === "happy_hour" },
    { key: "daily_special", label: "Daily Specials", icon: Tag, filter: (d) => d.deal_type === "daily_special" },
    { key: "brunch_deal", label: "Brunch", icon: Coffee, filter: (d) => d.deal_type === "brunch_deal" },
    { key: "event_driven", label: "Events", icon: PartyPopper, filter: (d) => d.deal_type === "event_driven" },
    { key: "game_day", label: "Game Day", icon: Beer, filter: (d) => d.deal_type === "game_day" },
    { key: "late_night", label: "Late Night", icon: Moon, filter: (d) => d.deal_type === "late_night" },
    { key: "seasonal_lto", label: "Seasonal", icon: Sun, filter: (d) => d.deal_type === "seasonal_lto" },
    { key: "chain_app_deal", label: "App Deals", icon: Smartphone, filter: (d) => d.deal_type === "chain_app_deal" },
    { key: "weekend", label: "Weekends", icon: Heart, filter: (d) => {
      const days = (d.days_available ?? []).map((x) => x.toLowerCase())
      return days.includes("saturday") || days.includes("sunday")
    } },
  ]
}

// Deterministic daily rotation so the "top spots" aren't frozen in the same
// order every day. Seeded by date (stable within a day) + tab key so each tab
// rotates independently. This component is ssr:false, so no hydration mismatch.
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

export default function PatioFilterTabs({ deals }: { deals: PatioDealLite[] }) {
  const tabs = useMemo(() => makeTabs(), [])
  const [active, setActive] = useState("today")

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of tabs) counts[t.key] = deals.filter(t.filter).length
    return counts
  }, [deals, tabs])

  const filtered = useMemo(() => {
    const t = tabs.find((x) => x.key === active) ?? tabs[0]
    return deals.filter(t.filter)
  }, [deals, active, tabs])

  // Group filtered deals by venue
  const venueMap = new Map<string, {
    venue_name: string
    venue_slug: string
    neighborhood: string
    neighborhood_slug: string
    google_rating: number | null | undefined
    deals: PatioDealLite[]
    score: number
  }>()
  for (const d of filtered) {
    if (!d.venue_slug) continue
    const existing = venueMap.get(d.venue_slug)
    if (existing) {
      existing.deals.push(d)
      existing.score = Math.max(existing.score, d.quality_score ?? 0)
    } else {
      venueMap.set(d.venue_slug, {
        venue_name: d.venue_name,
        venue_slug: d.venue_slug,
        neighborhood: d.neighborhood ?? "",
        neighborhood_slug: d.neighborhood_slug ?? "",
        google_rating: d.google_rating,
        deals: [d],
        score: d.quality_score ?? 0,
      })
    }
  }
  // Rank by quality, then rotate within the top tier so the lineup changes
  // daily instead of being frozen in the same order. Seeded by date + active
  // tab → stable within a day, different each day and per category.
  const ranked = Array.from(venueMap.values())
    .map((v) => ({ ...v, rank: v.score + v.deals.length * 2 + (v.google_rating ? v.google_rating * 5 : 0) }))
    .sort((a, b) => b.rank - a.rank)
  const featured = seededShuffle(ranked.slice(0, 30), seedFromString(dateSeed() + ":" + active)).slice(0, 12)

  // Neighborhood breakdown
  const nhCounts = new Map<string, { name: string; slug: string; count: number }>()
  for (const d of filtered) {
    if (!d.neighborhood || !d.neighborhood_slug) continue
    const x = nhCounts.get(d.neighborhood_slug)
    if (x) x.count++
    else nhCounts.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, count: 1 })
  }
  const topNh = Array.from(nhCounts.values()).sort((a, b) => b.count - a.count).slice(0, 16)

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-max gap-2 border-b border-border pb-px">
          {tabs.map((t) => {
            const Icon = t.icon
            const count = tabCounts[t.key] ?? 0
            const isActive = active === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={
                  "group inline-flex items-center gap-2 rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors " +
                  (isActive
                    ? "border-b-2 border-brand-500 bg-brand-500/10 text-foreground"
                    : "border-b-2 border-transparent text-muted-foreground hover:bg-card hover:text-foreground")
                }
                disabled={count === 0 && t.key !== "all"}
              >
                <Icon className={"h-4 w-4 " + (isActive ? "text-brand-500" : "")} />
                <span>{t.label}</span>
                <span className={
                  "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums " +
                  (isActive ? "bg-brand-500 text-primary-foreground" : "bg-muted text-muted-foreground")
                }>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Featured venues */}
      {featured.length > 0 ? (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold text-foreground">
              Top {tabs.find((t) => t.key === active)?.label} Spots
            </h3>
            <span className="text-xs text-muted-foreground">{featured.length} of {venueMap.size} venues</span>
          </div>
          <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {featured.map((v) => {
              const topDeals = v.deals.slice().sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0)).slice(0, 2)
              return (
                <article key={v.venue_slug} className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand-400/60">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-semibold text-foreground">
                        <Link href={`/venues/${v.venue_slug}`} className="hover:text-brand-600 dark:hover:text-brand-400">
                          {v.venue_name}
                        </Link>
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {v.neighborhood && (
                          <Link href={`/neighborhoods/${v.neighborhood_slug}`} className="inline-flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400">
                            <MapPin className="h-3 w-3" />
                            {v.neighborhood}
                          </Link>
                        )}
                        {v.google_rating != null && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                            {v.google_rating.toFixed(1)}
                          </span>
                        )}
                        <span>·</span>
                        <span>{v.deals.length} deal{v.deals.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {topDeals.map((d) => {
                      const timeRange = formatTimeRange(d.start_time, d.end_time, d.is_all_day)
                      return (
                        <li key={d.id} className="rounded-lg border border-border/60 bg-background/50 px-3 py-2.5">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                              {DEAL_TYPE_LABEL[d.deal_type] ?? "Deal"}
                            </span>
                            <span className="text-[11px] text-muted-foreground">{formatDays(d.days_available)}</span>
                            {timeRange && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                <Clock className="h-2.5 w-2.5" />
                                {timeRange}
                              </span>
                            )}
                          </div>
                          <p className="line-clamp-2 text-sm text-foreground">{d.title}</p>
                        </li>
                      )
                    })}
                  </ul>
                  <Link href={`/venues/${v.venue_slug}`} className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                    View all {v.deals.length} deal{v.deals.length === 1 ? "" : "s"} <ExternalLink className="h-3 w-3" />
                  </Link>
                </article>
              )
            })}
          </div>
        </>
      ) : (
        <div className="mb-10 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No {tabs.find((t) => t.key === active)?.label.toLowerCase()} deals on patios yet. Try another tab.</p>
        </div>
      )}

      {/* Neighborhood breakdown for this filter */}
      {topNh.length > 0 && (
        <>
          <h3 className="mb-3 text-lg font-semibold text-foreground">
            Neighborhoods with {tabs.find((t) => t.key === active)?.label}
          </h3>
          <div className="flex flex-wrap gap-2">
            {topNh.map((nh) => (
              <Link
                key={nh.slug}
                href={`/neighborhoods/${nh.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
              >
                <MapPin className="h-3 w-3" />
                {nh.name}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{nh.count}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
