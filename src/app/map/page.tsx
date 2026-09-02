"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import Link from "next/link"
import {
  APIProvider,
  Map,
  AdvancedMarker,
} from "@vis.gl/react-google-maps"
import {
  MapPin,
  X,
  Clock,
  Tag,
  Search,
  Locate,
  Layers,
  List,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { trackNearMeUsed } from "@/lib/analytics"
import { Navbar } from "@/components/navbar"
import { DealTypeBadge } from "@/components/deal-type-badge"
import { ActiveNowIndicator } from "@/components/active-now-indicator"
import { SaveDealButton } from "@/components/save-deal-button"
import {
  isDealActiveNow,
  formatDays,
  formatTimeRange,
  getDealTypeConfig,
} from "@/lib/deal-utils"
import { useDeals, useNearbyDeals } from "@/hooks/use-deals"
import { useMapsKey } from "@/hooks/use-maps-key"
import type { Deal } from "@/lib/types"
import {
  CHICAGO_CENTER,
  DEFAULT_ZOOM,
  groupDealsByVenue,
  MarkerPin,
  MapInfoWindow,
  HorizontalMapLegend,
  FitBounds,
} from "@/components/map-utils"
import { stats } from "@/lib/product-stats"

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

function DealListItem({
  deal,
  isSelected,
  onSelect,
}: {
  deal: Deal
  isSelected: boolean
  onSelect: () => void
}) {
  const active = isDealActiveNow(deal)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [isSelected])

  return (
    <button
      ref={ref}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1.5 border-b border-border px-4 py-3.5 text-left transition-colors",
        isSelected ? "bg-brand-50/50" : "hover:bg-secondary"
      )}
    >
      <div className="flex items-center gap-2">
        <DealTypeBadge dealType={deal.deal_type} />
        {active && <ActiveNowIndicator showLabel={false} />}
      </div>
      <p className="truncate text-sm font-semibold text-foreground">
        {deal.venue_name}
      </p>
      <p className="truncate text-xs font-medium text-brand-600">
        {deal.title}
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{deal.neighborhood}</span>
        {deal.distance_miles != null && (
          <>
            <span className="text-border">{"/"}</span>
            <span>{deal.distance_miles.toFixed(1)} mi</span>
          </>
        )}
        {deal.best_savings_pct != null && deal.best_savings_pct > 0 && (
          <>
            <span className="text-border">{"/"}</span>
            <span className="font-semibold text-green-600">
              {Math.round(deal.best_savings_pct)}% off
            </span>
          </>
        )}
      </div>
    </button>
  )
}

export default function MapPage() {
  const [selectedVenueKey, setSelectedVenueKey] = useState<string | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [showNearby, setShowNearby] = useState(false)
  const [sidebarSearch, setSidebarSearch] = useState("")
  const [filterType, setFilterType] = useState("")
  const [showActiveOnly, setShowActiveOnly] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [locating, setLocating] = useState(false)

  const { key: mapsApiKey, loading: mapsKeyLoading } = useMapsKey()
  const { data: allDeals, isLoading } = useDeals({ limit: 200 })
  const { data: nearbyData } = useNearbyDeals(
    userLocation?.lat ?? null,
    userLocation?.lng ?? null,
    { radius: 2, limit: 100 }
  )

  const rawDeals =
    showNearby && nearbyData?.deals ? nearbyData.deals : allDeals?.deals ?? []

  const deals = useMemo(() => {
    let filtered = rawDeals.filter(
      (d) => d.latitude != null && d.longitude != null
    )
    if (sidebarSearch) {
      const q = sidebarSearch.toLowerCase()
      filtered = filtered.filter(
        (d) =>
          d.venue_name.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.neighborhood.toLowerCase().includes(q)
      )
    }
    if (filterType) {
      filtered = filtered.filter((d) => d.deal_type === filterType)
    }
    if (showActiveOnly) {
      filtered = filtered.filter((d) => isDealActiveNow(d))
    }
    return filtered
  }, [rawDeals, sidebarSearch, filterType, showActiveOnly])

  const venueGroups = useMemo(() => groupDealsByVenue(deals), [deals])

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
        setShowNearby(true)
        setLocating(false)
        trackNearMeUsed()
      },
      () => {
        alert("Could not get your location. Please enable location services.")
        setLocating(false)
      }
    )
  }, [])

  const activeCount = useMemo(
    () => deals.filter((d) => isDealActiveNow(d)).length,
    [deals]
  )

  const handleMarkerClick = useCallback(
    (key: string, deals: Deal[]) => {
      if (selectedVenueKey === key) {
        setSelectedVenueKey(null)
        setSelectedDeal(null)
      } else {
        setSelectedVenueKey(key)
        setSelectedDeal(deals[0])
      }
    },
    [selectedVenueKey]
  )

  const handleSidebarSelect = useCallback(
    (deal: Deal) => {
      if (selectedDeal?.id === deal.id) {
        setSelectedDeal(null)
        setSelectedVenueKey(null)
      } else {
        setSelectedDeal(deal)
        if (deal.latitude != null && deal.longitude != null) {
          setSelectedVenueKey(
            `${deal.latitude.toFixed(5)},${deal.longitude.toFixed(5)}`
          )
        }
      }
    },
    [selectedDeal]
  )

  // Find the selected venue group for InfoWindow
  const selectedGroup = selectedVenueKey
    ? venueGroups.find(
        (g) =>
          `${g.lat.toFixed(5)},${g.lng.toFixed(5)}` === selectedVenueKey
      )
    : null

  return (
    <div className="flex h-screen flex-col">
      <Navbar />
      <div className="relative flex flex-1 overflow-hidden">
        <h1 className="sr-only">Chicago Deal Map, Find Food & Drink Specials Near You</h1>
        <p className="sr-only">
          Use this interactive map to explore food and drink deals across Chicago.
          Tap any pin to see happy hours, daily specials, brunch deals, and late-night
          offers at that location. Use the &quot;Near me&quot; button to find the closest deals
          to your current location, or filter by deal type and search by venue name or
          neighborhood. The sidebar lists every deal on the map with key details like
          savings percentage, neighborhood, and distance. Whether you are planning a
          bar crawl through Wicker Park or looking for after-work specials in the Loop,
          the deal map puts every active offer within reach.
        </p>
        {/* Map area */}
        <div className="relative flex flex-1 flex-col">
          {/* External horizontal legend */}
          <HorizontalMapLegend
            deals={deals}
            activeFilter={filterType}
            onFilterChange={setFilterType}
          />

          <div className="relative flex-1">
          {/* Map controls - top bar */}
          <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-2 pointer-events-none">
            <button
              onClick={handleLocateMe}
              disabled={locating}
              className={cn(
                "pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-colors",
                showNearby
                  ? "border-brand-200 bg-brand-50 text-brand-700"
                  : "text-foreground hover:bg-secondary"
              )}
            >
              <Locate className={cn("h-4 w-4", locating && "animate-spin")} />
              {locating ? "Locating..." : "Near me"}
            </button>
            {showNearby && (
              <button
                onClick={() => {
                  setShowNearby(false)
                  setUserLocation(null)
                }}
                className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-secondary"
              >
                <Layers className="h-4 w-4" />
                Show all
              </button>
            )}

            {/* Deal count badge */}
            <div className="pointer-events-auto ml-auto flex items-center gap-2">
              {activeCount > 0 && (
                <span className="hidden items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 shadow-sm sm:flex">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  {activeCount} active now
                </span>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary lg:hidden"
              >
                <List className="h-4 w-4" />
                {deals.length}
              </button>
            </div>
          </div>

          {/* Google Map */}
          {mapsKeyLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted p-8 text-center">
              <MapPin className="h-10 w-10 animate-pulse text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          ) : mapsApiKey ? (
            <APIProvider apiKey={mapsApiKey}>
              <Map
                defaultCenter={
                  userLocation ?? CHICAGO_CENTER
                }
                defaultZoom={DEFAULT_ZOOM}
                mapId="312deals-map"
                gestureHandling="greedy"
                disableDefaultUI={false}
                zoomControl={true}
                mapTypeControl={false}
                streetViewControl={false}
                fullscreenControl={false}
                className="h-full w-full"
              >
                <FitBounds deals={deals} />

                {/* Deal markers */}
                {venueGroups.map((group) => {
                  const key = `${group.lat.toFixed(5)},${group.lng.toFixed(5)}`
                  const isSelected = selectedVenueKey === key

                  return (
                    <AdvancedMarker
                      key={key}
                      position={{ lat: group.lat, lng: group.lng }}
                      onClick={() => handleMarkerClick(key, group.deals)}
                      zIndex={isSelected ? 100 : undefined}
                    >
                      <MarkerPin
                        deals={group.deals}
                        isSelected={isSelected}
                      />
                    </AdvancedMarker>
                  )
                })}

                {/* User location marker */}
                {userLocation && (
                  <AdvancedMarker position={userLocation} zIndex={200}>
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-500 shadow-lg">
                      <div className="h-2 w-2 rounded-full bg-white" />
                    </div>
                  </AdvancedMarker>
                )}

                {/* Info window */}
                {selectedGroup && (
                  <MapInfoWindow
                    deals={selectedGroup.deals}
                    position={{ lat: selectedGroup.lat, lng: selectedGroup.lng }}
                    onClose={() => {
                      setSelectedVenueKey(null)
                      setSelectedDeal(null)
                    }}
                  />
                )}
              </Map>
            </APIProvider>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted p-8 text-center">
              <MapPin className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Map unavailable, API key not configured.
              </p>
            </div>
          )}

          {/* Mobile bottom summary bar (visible when sidebar closed) */}
          {!sidebarOpen && (
            <div className="absolute bottom-3 left-3 right-3 z-20 lg:hidden">
              <div className="flex items-center gap-3 rounded-xl bg-[#1A1A2E]/95 backdrop-blur-sm border border-white/10 px-4 py-3 shadow-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {deals.length} deal{deals.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-white/60 truncate">
                    {activeCount > 0
                      ? `${activeCount} active now`
                      : "Tap a pin for details"}
                  </p>
                </div>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
                >
                  <List className="h-3.5 w-3.5" />
                  View list
                </button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Sidebar deal list */}
        <aside
          className={cn(
            "absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-border bg-card transition-transform sm:w-96 lg:relative lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Sidebar header */}
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  {showNearby ? "Nearby Deals" : "All Deals"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {deals.length} deal{deals.length !== 1 ? "s" : ""}
                  {showActiveOnly && " (active now)"}
                </p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sidebar search */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                placeholder="Filter deals..."
                aria-label="Filter deals"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
              {sidebarSearch && (
                <button onClick={() => setSidebarSearch("")} aria-label="Clear filter">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Quick filters row */}
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="map-deal-type-select" className="sr-only">Deal type</label>
              <select
                id="map-deal-type-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none"
              >
                <option value="">All types</option>
                {DEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {getDealTypeConfig(t).label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowActiveOnly(!showActiveOnly)}
                className={cn(
                  "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  showActiveOnly
                    ? "border-green-300 bg-green-50 text-green-700"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary"
                )}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {showActiveOnly && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex h-1.5 w-1.5 rounded-full",
                      showActiveOnly ? "bg-green-500" : "bg-muted-foreground/30"
                    )}
                  />
                </span>
                Active
              </button>
            </div>
          </div>

          {/* Deal list */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-b border-border px-4 py-3.5"
                  >
                    <div className="mb-2 h-5 w-20 animate-pulse rounded-full bg-muted" />
                    <div className="mb-1 h-4 w-36 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : deals.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <MapPin className="mb-2 h-6 w-6 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">
                  No deals to show here
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try clearing filters, or jump to:
                </p>
                <div className="mt-4 flex w-full flex-col gap-2">
                  <Link
                    href="/search"
                    className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  >
                    🔎 Search {stats.deals} deals
                  </Link>
                  <Link
                    href="/chat"
                    className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-brand-300"
                  >
                    💬 Ask AI for a recommendation
                  </Link>
                  <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                    {["river-north", "west-loop", "lakeview", "wicker-park"].map((slug) => (
                      <Link
                        key={slug}
                        href={`/neighborhoods/${slug}`}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:border-brand-300 hover:text-brand-600"
                      >
                        {slug.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ")}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              deals.map((deal) => (
                <DealListItem
                  key={deal.id}
                  deal={deal}
                  isSelected={selectedDeal?.id === deal.id}
                  onSelect={() => handleSidebarSelect(deal)}
                />
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
