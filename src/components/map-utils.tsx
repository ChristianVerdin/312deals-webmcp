"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import { useMap, InfoWindow } from "@vis.gl/react-google-maps"
import {
  Wine,
  Tag,
  Coffee,
  Moon,
  Smartphone,
  Trophy,
  Sparkles,
  Star,
  MapPin,
  Clock,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  isDealActiveNow,
  getDealTypeConfig,
  formatDays,
  formatTimeRange,
} from "@/lib/deal-utils"
import type { Deal } from "@/lib/types"

export const CHICAGO_CENTER = { lat: 41.8827, lng: -87.6233 }
export const DEFAULT_ZOOM = 12

// --- Marker color & icon config ---

const MARKER_COLORS: Record<string, string> = {
  happy_hour: "#D97706",
  daily_special: "#2563EB",
  brunch_deal: "#EA580C",
  late_night: "#9333EA",
  chain_app_deal: "#16A34A",
  game_day: "#DC2626",
  seasonal_lto: "#DB2777",
  loyalty_reward: "#4F46E5",
}

const MARKER_ICONS: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number | string }>
> = {
  happy_hour: Wine,
  daily_special: Tag,
  brunch_deal: Coffee,
  late_night: Moon,
  chain_app_deal: Smartphone,
  game_day: Trophy,
  seasonal_lto: Sparkles,
  loyalty_reward: Star,
}

export function getMarkerColor(dealType: string): string {
  return MARKER_COLORS[dealType] ?? "#6B7280"
}

function getMarkerIcon(dealType: string) {
  return MARKER_ICONS[dealType] ?? MapPin
}

// --- Venue grouping ---

export function groupDealsByVenue(deals: Deal[]) {
  const groups: Record<
    string,
    { lat: number; lng: number; deals: Deal[] }
  > = {}
  for (const d of deals) {
    if (d.latitude == null || d.longitude == null) continue
    const key = `${d.latitude.toFixed(5)},${d.longitude.toFixed(5)}`
    if (!groups[key]) {
      groups[key] = { lat: d.latitude, lng: d.longitude, deals: [] }
    }
    groups[key].deals.push(d)
  }
  return Object.values(groups)
}

// --- MarkerPin (color-coded with type-specific icons) ---

export function MarkerPin({
  deals,
  isSelected,
}: {
  deals: Deal[]
  isSelected: boolean
}) {
  const hasActive = deals.some((d) => isDealActiveNow(d))
  const primary = deals[0]
  const markerColor = getMarkerColor(primary.deal_type)
  const Icon = getMarkerIcon(primary.deal_type)
  const size = deals.length > 1 ? 40 : 36

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full transition-transform cursor-pointer",
        isSelected ? "scale-[1.3] z-10" : "hover:scale-110"
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: markerColor,
        border: hasActive ? "3px solid #4ade80" : "2.5px solid white",
        boxShadow: hasActive
          ? "0 0 0 4px rgba(74, 222, 128, 0.25), 0 2px 8px rgba(0,0,0,0.3)"
          : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <Icon className="h-4 w-4 text-white" strokeWidth={2.5} />

      {/* Deal count badge */}
      {deals.length > 1 && (
        <span
          className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-white text-[10px] font-bold"
          style={{
            width: 18,
            height: 18,
            color: markerColor,
            border: `2px solid ${markerColor}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        >
          {deals.length}
        </span>
      )}

      {/* Active pulse ring */}
      {hasActive && (
        <span
          className="absolute inset-[-3px] rounded-full animate-ping pointer-events-none"
          style={{ backgroundColor: "rgba(74, 222, 128, 0.2)" }}
        />
      )}
    </div>
  )
}

// --- MapInfoWindow (enhanced with icons & time info) ---

export function MapInfoWindow({
  deals,
  position,
  onClose,
}: {
  deals: Deal[]
  position: { lat: number; lng: number }
  onClose: () => void
}) {
  if (deals.length === 0) return null
  const primary = deals[0]
  const hasLive = deals.some((d) => isDealActiveNow(d))
  // Sort: live deals first, then by quality_score desc
  const sortedDeals = [...deals].sort((a, b) => {
    const al = isDealActiveNow(a) ? 1 : 0
    const bl = isDealActiveNow(b) ? 1 : 0
    if (al !== bl) return bl - al
    return (b.quality_score ?? 0) - (a.quality_score ?? 0)
  })
  const visibleDeals = sortedDeals.slice(0, 4)
  const remaining = sortedDeals.length - visibleDeals.length

  return (
    <InfoWindow position={position} onCloseClick={onClose}>
      <div className="max-w-[280px] min-w-[240px]">
        {/* Venue header, shown once */}
        <div className="pb-2 border-b border-gray-200">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {primary.venue_name}
            </p>
            {hasLive && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-green-600">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                </span>
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            {primary.neighborhood && <span>{primary.neighborhood}</span>}
            {primary.neighborhood && <span>·</span>}
            <span className="font-medium text-gray-700">
              {deals.length} deal{deals.length === 1 ? "" : "s"}
            </span>
            {primary.google_rating != null && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <span className="text-yellow-500">★</span>
                  {primary.google_rating.toFixed(1)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Consolidated deal list */}
        <ul className="py-1">
          {visibleDeals.map((deal) => {
            const config = getDealTypeConfig(deal.deal_type)
            const Icon = getMarkerIcon(deal.deal_type)
            const markerColor = getMarkerColor(deal.deal_type)
            const isActive = isDealActiveNow(deal)
            return (
              <li key={deal.id} className="py-1.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
                    style={{ backgroundColor: markerColor }}
                  >
                    <Icon className="h-2 w-2" strokeWidth={2.5} />
                    {config.label}
                  </span>
                  {deal.days_available && deal.days_available.length > 0 && (
                    <span className="text-[10px] text-gray-500">
                      {formatDays(deal.days_available)}
                    </span>
                  )}
                  {deal.start_time && deal.end_time && !deal.is_all_day && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
                      <Clock className="h-2.5 w-2.5" />
                      {formatTimeRange(deal.start_time, deal.end_time, 0)}
                    </span>
                  )}
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  )}
                </div>
                <p className="text-xs font-medium text-gray-900 leading-snug line-clamp-2">
                  {deal.title}
                </p>
              </li>
            )
          })}
        </ul>

        {remaining > 0 && (
          <p className="text-[11px] text-gray-500 pb-1">
            + {remaining} more deal{remaining === 1 ? "" : "s"} at this venue
          </p>
        )}

        <Link
          href={`/venues/${primary.venue_slug}`}
          className="block mt-1 rounded-md bg-blue-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-blue-700"
        >
          View venue details &rarr;
        </Link>
      </div>
    </InfoWindow>
  )
}

// --- MapLegend (interactive, click-to-filter) ---

export function MapLegend({
  deals,
  activeFilter,
  onFilterChange,
}: {
  deals: Deal[]
  activeFilter: string
  onFilterChange: (type: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of deals) {
      counts[d.deal_type] = (counts[d.deal_type] || 0) + 1
    }
    return counts
  }, [deals])

  const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])

  if (types.length === 0) return null

  return (
    <div className="absolute bottom-20 left-3 z-20 lg:bottom-6">
      {isOpen ? (
        <div className="rounded-xl bg-[#1A1A2E]/95 backdrop-blur-sm border border-white/10 shadow-xl overflow-hidden w-[240px]">
          {/* Header */}
          <button
            onClick={() => setIsOpen(false)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/5 transition-colors"
          >
            <span>Deal Types</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {/* Type list */}
          <div className="px-1.5 pb-1.5 space-y-0.5">
            {types.map(([type, count]) => {
              const config = getDealTypeConfig(type)
              const Icon = getMarkerIcon(type)
              const color = getMarkerColor(type)
              const isActive = activeFilter === type
              return (
                <button
                  key={type}
                  onClick={() => onFilterChange(isActive ? "" : type)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                    isActive
                      ? "bg-white/15 ring-1 ring-white/20"
                      : "hover:bg-white/5"
                  )}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20"
                    style={{ backgroundColor: color }}
                  >
                    <Icon
                      className="h-3 w-3 text-white"
                      strokeWidth={2.5}
                    />
                  </div>
                  <span className="flex-1 text-[11px] font-medium text-white/90">
                    {config.label}
                  </span>
                  <span className="text-[11px] tabular-nums text-white/40">
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Clear filter */}
          {activeFilter && (
            <button
              onClick={() => onFilterChange("")}
              className="w-full border-t border-white/10 px-3 py-2 text-[11px] font-semibold text-brand-400 hover:bg-white/5 transition-colors"
            >
              Show all types
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-[#1A1A2E]/90 backdrop-blur-sm border border-white/10 px-3 py-2.5 text-xs font-medium text-white shadow-lg hover:bg-[#1A1A2E] transition-colors"
        >
          {/* Stacked color dots preview */}
          <div className="flex -space-x-1">
            {types.slice(0, 5).map(([type]) => (
              <div
                key={type}
                className="h-3.5 w-3.5 rounded-full"
                style={{
                  backgroundColor: getMarkerColor(type),
                  border: "1.5px solid #1A1A2E",
                }}
              />
            ))}
          </div>
          <span>Legend</span>
          <ChevronUp className="h-3 w-3 text-white/50" />
        </button>
      )}
    </div>
  )
}

// --- HorizontalMapLegend (external, theme-aware chip bar) ---

export function HorizontalMapLegend({
  deals,
  activeFilter,
  onFilterChange,
}: {
  deals: Deal[]
  activeFilter: string
  onFilterChange: (type: string) => void
}) {
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of deals) {
      counts[d.deal_type] = (counts[d.deal_type] || 0) + 1
    }
    return counts
  }, [deals])
  const activeNowCount = useMemo(() => deals.filter((d) => isDealActiveNow(d)).length, [deals])

  const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])

  if (types.length === 0) return null

  return (
    <div className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2.5">
        {/* Active now indicator (legend, not a filter) */}
        {activeNowCount > 0 && (
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="font-medium text-green-700 dark:text-green-300">{activeNowCount} live</span>
          </div>
        )}

        <div className="h-5 w-px bg-border shrink-0" />

        {/* All types pill */}
        <button
          onClick={() => onFilterChange("")}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            !activeFilter
              ? "border-brand-500 bg-brand-500/15 text-foreground"
              : "border-border bg-card text-muted-foreground hover:border-brand-400/60 hover:text-foreground"
          )}
        >
          All types
          <span className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
            !activeFilter ? "bg-brand-500 text-primary-foreground" : "bg-muted"
          )}>
            {deals.length}
          </span>
        </button>

        {types.map(([type, count]) => {
          const config = getDealTypeConfig(type)
          const Icon = getMarkerIcon(type)
          const color = getMarkerColor(type)
          const isActive = activeFilter === type
          return (
            <button
              key={type}
              onClick={() => onFilterChange(isActive ? "" : type)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-brand-500 bg-brand-500/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-brand-400/60 hover:text-foreground"
              )}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: color }}
              >
                <Icon className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
              </span>
              <span>{config.label}</span>
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                isActive ? "bg-brand-500 text-primary-foreground" : "bg-muted"
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- FitBounds ---

export function FitBounds({ deals }: { deals: Deal[] }) {
  const map = useMap()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (!map || deals.length === 0) return
    if (fittedRef.current) return
    fittedRef.current = true

    const bounds = new google.maps.LatLngBounds()
    let count = 0
    for (const d of deals) {
      if (d.latitude != null && d.longitude != null) {
        bounds.extend({ lat: d.latitude, lng: d.longitude })
        count++
      }
    }
    if (count > 1) {
      map.fitBounds(bounds, { top: 60, right: 20, bottom: 20, left: 20 })
    } else if (count === 1) {
      map.setCenter(bounds.getCenter())
      map.setZoom(15)
    }
  }, [map, deals])

  return null
}
