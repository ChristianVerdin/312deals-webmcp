"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Beer, Waves, Martini, Wheat, GlassWater, Package } from "lucide-react"
import type { PatioDealLite } from "@/lib/types"

type Theme = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  blurb: string
  match: (itemName: string, deal: PatioDealLite) => boolean
  useFood?: boolean
}

const DOMESTIC_BOTTLES = [
  "miller lite", "miller light", "bud light", "budweiser", "coors light", "coors banquet",
  "michelob ultra", "mich ultra", "high life", "pbr", "pabst", "hamms", "hamm's",
  "modelo", "corona", "blue moon", "yuengling", "rolling rock", "busch", "natty",
]

const SELTZERS = [
  "seltzer", "high noon", "white claw", "truly", "cutwater", "vodka soda",
  "nuetral", "neutral cider", "vizzy", "bud light seltzer",
]

const COCKTAILS = [
  "cocktail", "martini", "margarita", "old fashioned", "mule", "moscow mule", "spritz",
  "aperol", "negroni", "manhattan", "paloma", "daiquiri", "mai tai", "mojito",
  "sangria", "frozen", "slushy", "espresso martini", "whiskey sour",
]

const BUCKETS = ["bucket"]

const WINE_SPECIALS = ["wine", "bottle of wine", "glass of wine", "rosé", "rose", "prosecco", "champagne"]

const THEMES: Theme[] = [
  {
    key: "domestic",
    label: "Cheap Domestic Bottles",
    icon: Beer,
    blurb: "Miller Lite, Michelob Ultra, High Life, PBR, and the classic value lineup.",
    match: (name) => {
      const lower = name.toLowerCase()
      return DOMESTIC_BOTTLES.some((kw) => lower.includes(kw))
    },
  },
  {
    key: "seltzer",
    label: "Seltzer Deals",
    icon: Waves,
    blurb: "High Noons, White Claws, vodka sodas, summer patio essentials.",
    match: (name) => {
      const lower = name.toLowerCase()
      return SELTZERS.some((kw) => lower.includes(kw))
    },
  },
  {
    key: "buckets",
    label: "Bucket Deals",
    icon: Package,
    blurb: "Share with the table, buckets of beer for group patios.",
    match: (name, deal) => {
      const lower = name.toLowerCase()
      const title = (deal.title ?? "").toLowerCase()
      const desc = (deal.description ?? "").toLowerCase()
      return BUCKETS.some((kw) => lower.includes(kw) || title.includes(kw) || desc.includes(kw))
    },
  },
  {
    key: "cocktails",
    label: "Cheap Cocktails",
    icon: Martini,
    blurb: "Margaritas, martinis, spritzes, the fancy drinks on sale.",
    match: (name) => {
      const lower = name.toLowerCase()
      return COCKTAILS.some((kw) => lower.includes(kw))
    },
  },
  {
    key: "wine",
    label: "Wine Specials",
    icon: GlassWater,
    blurb: "Bottles, glasses, and rosé deals for sunny patios.",
    match: (name) => {
      const lower = name.toLowerCase()
      return WINE_SPECIALS.some((kw) => lower.includes(kw))
    },
  },
  {
    key: "gluten_free",
    label: "Gluten-Free Options",
    icon: Wheat,
    blurb: "Safe patio picks for gluten-free diners.",
    match: (_name, deal) => !!deal.is_gluten_free,
    useFood: true,
  },
]

export default function PatioDrinkThemes({ deals }: { deals: PatioDealLite[] }) {
  const [active, setActive] = useState<string>("domestic")

  const themedResults = useMemo(() => {
    type VenueGroup = {
      venue: string
      venue_slug: string
      neighborhood: string
      items: { name: string; price: number | null }[]
      cheapest: number
    }
    const results: Record<string, VenueGroup[]> = {}

    for (const theme of THEMES) {
      const venueMap = new Map<string, VenueGroup>()

      const addItem = (
        d: PatioDealLite,
        name: string,
        price: number | null
      ) => {
        if (!d.venue_slug) return
        const existing = venueMap.get(d.venue_slug)
        const dup = existing?.items.some((x) => x.name.toLowerCase() === name.toLowerCase())
        if (existing && !dup) {
          existing.items.push({ name, price })
          if (price != null && price < existing.cheapest) existing.cheapest = price
        } else if (!existing) {
          venueMap.set(d.venue_slug, {
            venue: d.venue_name,
            venue_slug: d.venue_slug,
            neighborhood: d.neighborhood ?? "",
            items: [{ name, price }],
            cheapest: price ?? 9999,
          })
        }
      }

      for (const d of deals) {
        if (theme.key === "gluten_free") {
          if (!d.is_gluten_free) continue
          addItem(d, d.title, null)
          continue
        }

        const pool: { items: typeof d.drink_items }[] = [{ items: d.drink_items }]
        if (theme.useFood) pool.push({ items: d.food_items })

        for (const { items: itemList } of pool) {
          if (!Array.isArray(itemList)) continue
          for (const item of itemList) {
            if (!item?.name) continue
            if (theme.match(item.name, d)) {
              addItem(d, item.name, item.deal_price ?? null)
            }
          }
        }
      }

      const groups = Array.from(venueMap.values())
      // Sort each venue's items cheapest first
      for (const g of groups) g.items.sort((a, b) => (a.price ?? 9999) - (b.price ?? 9999))
      groups.sort((a, b) => a.cheapest - b.cheapest)

      // Diversify: max 2 per neighborhood
      const counts = new Map<string, number>()
      const out: VenueGroup[] = []
      for (const g of groups) {
        const k = g.neighborhood || "_"
        const c = counts.get(k) ?? 0
        if (c >= 2) continue
        out.push(g)
        counts.set(k, c + 1)
      }
      results[theme.key] = out
    }

    return results
  }, [deals])

  const activeTheme = THEMES.find((t) => t.key === active) ?? THEMES[0]
  const items = themedResults[active] ?? []

  return (
    <div>
      {/* Theme chips */}
      <div className="mb-5 flex flex-wrap gap-2">
        {THEMES.map((t) => {
          const Icon = t.icon
          const count = themedResults[t.key]?.length ?? 0
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
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
              }>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active theme content */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-300">
            <activeTheme.icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{activeTheme.label}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{activeTheme.blurb}</p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No {activeTheme.label.toLowerCase()} found on patio deals yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.slice(0, 12).map((v) => {
              const lead = v.items[0]
              const more = v.items.slice(1, 3)
              return (
                <li key={v.venue_slug} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/venues/${v.venue_slug}`}
                        className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        {v.venue}
                      </Link>
                      {v.neighborhood && <div className="text-xs text-muted-foreground">{v.neighborhood}</div>}
                    </div>
                    {v.cheapest < 9999 && (
                      <span className="shrink-0 text-base font-bold text-green-600 dark:text-green-400 tabular-nums">
                        ${v.cheapest.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs text-foreground">
                      {lead.name}
                    </span>
                    {more.map((it, idx) => (
                      <span key={idx} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {it.name}
                        {it.price != null && (
                          <> <span className="text-green-600 dark:text-green-400 tabular-nums">${it.price.toFixed(2)}</span></>
                        )}
                      </span>
                    ))}
                    {v.items.length > 3 && (
                      <span className="text-[11px] text-muted-foreground">+{v.items.length - 3} more</span>
                    )}
                  </div>
                </li>
              )
            })}
            {items.length > 12 && (
              <p className="pt-3 text-xs text-muted-foreground">
                Showing 12 of {items.length} venues · max 2 per neighborhood for spread.
              </p>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
