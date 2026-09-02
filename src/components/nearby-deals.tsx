"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { MapPin, Loader2, ArrowRight } from "lucide-react"
import { useNearbyDeals } from "@/hooks/use-deals"
import { DealCard, DealCardSkeleton } from "@/components/deal-card"
import type { Deal } from "@/lib/types"

type GeoStatus = "idle" | "locating" | "ready" | "denied" | "error"

interface NearbyDealsProps {
  className?: string
  /** Heading shown once results load. */
  title?: string
}

/**
 * Mobile-first "deals open near you, right now" surface. Tap-to-activate
 * (never auto-prompts) so it stays privacy-friendly and doesn't spook the 73%
 * mobile / 51% Safari audience. Backed by GET /api/v1/deals/nearby (haversine,
 * distance-sorted). Coords are never persisted, used only for the live query.
 */
export function NearbyDeals({ className, title = "Open near you" }: NearbyDealsProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState<GeoStatus>("idle")
  const [activeNow, setActiveNow] = useState(true)
  const [radius, setRadius] = useState(1.5)

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error")
      return
    }
    setStatus("locating")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus("ready")
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  const { data, isLoading } = useNearbyDeals(coords?.lat ?? null, coords?.lng ?? null, {
    activeNow,
    radius,
    limit: 12,
  })
  const deals: Deal[] = data?.deals ?? []

  return (
    <section className={`mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:px-6 ${className ?? ""}`}>
      {/* Idle / permission states, a single slim card, minimal push-down */}
      {status !== "ready" && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground sm:text-xl">Deals open near you, right now</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {status === "denied"
                  ? "Location access is off, you can still search by neighborhood."
                  : status === "error"
                    ? "Couldn't get your location. Try searching by neighborhood instead."
                    : "We use your location only to find nearby deals, nothing is saved."}
              </p>
            </div>
          </div>
          {status === "denied" || status === "error" ? (
            <Link
              href="/search"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Search by neighborhood
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={requestLocation}
              disabled={status === "locating"}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600 disabled:opacity-70"
            >
              {status === "locating" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finding deals near you…
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4" />
                  Use my location
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {status === "ready" && (
        <>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-500" />
              <h2 className="text-lg font-bold text-foreground sm:text-xl">{title}</h2>
              {!isLoading && deals.length > 0 && (
                <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-400">
                  within {radius} mi
                </span>
              )}
            </div>
            {activeNow && !isLoading && (
              <button
                type="button"
                onClick={() => setActiveNow(false)}
                className="shrink-0 text-sm font-medium text-brand-500 transition-colors hover:text-brand-600"
              >
                Show all nearby
              </button>
            )}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 sm:overflow-visible sm:snap-none">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="min-w-[280px] snap-start sm:min-w-0">
                    <DealCardSkeleton />
                  </div>
                ))
              : deals.map((deal) => (
                  <div key={deal.id} className="relative min-w-[280px] snap-start sm:min-w-0">
                    {deal.distance_miles != null && (
                      <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-bold text-brand-600 shadow-sm dark:text-brand-400">
                        {deal.distance_miles} mi
                      </span>
                    )}
                    <DealCard deal={deal} />
                  </div>
                ))}
          </div>

          {/* Empty state, offer to relax the filters before giving up */}
          {!isLoading && deals.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {activeNow
                  ? `Nothing open right now within ${radius} mi.`
                  : `No deals found within ${radius} mi.`}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {activeNow && (
                  <button
                    type="button"
                    onClick={() => setActiveNow(false)}
                    className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
                  >
                    Show all nearby
                  </button>
                )}
                {radius < 5 && (
                  <button
                    type="button"
                    onClick={() => setRadius(5)}
                    className="inline-flex min-h-[44px] items-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    Widen to 5 mi
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
