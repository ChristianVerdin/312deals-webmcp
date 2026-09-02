"use client"

import Link from "next/link"
import Image from "next/image"
import { MapPin } from "lucide-react"
import { cn, proxyPhotoUrl } from "@/lib/utils"
import type { Neighborhood } from "@/lib/types"

const zoneColors: Record<string, string> = {
  city: "from-brand-500/10 to-brand-500/5",
  north_shore: "from-sky-400/10 to-sky-400/5",
  northwest_suburbs: "from-green-500/10 to-green-500/5",
  western_suburbs: "from-amber-500/10 to-amber-500/5",
  south_suburbs: "from-purple-500/10 to-purple-500/5",
}

const zoneLabels: Record<string, string> = {
  city: "City",
  north_shore: "North Shore",
  northwest_suburbs: "NW Suburbs",
  western_suburbs: "West Suburbs",
  south_suburbs: "South Suburbs",
}

interface NeighborhoodCardProps {
  neighborhood: Neighborhood
  className?: string
}

export function NeighborhoodCard({
  neighborhood,
  className,
}: NeighborhoodCardProps) {
  const gradient = zoneColors[neighborhood.zone] || zoneColors.city
  const zoneLabel = zoneLabels[neighborhood.zone] || neighborhood.zone
  const hasDeals = neighborhood.active_deal_count > 0
  const activeNow = neighborhood.active_now_count ?? 0
  const photoUrl = proxyPhotoUrl(neighborhood.top_venue_photo)

  return (
    <Link
      href={hasDeals ? `/search?neighborhood=${neighborhood.slug}` : `/neighborhoods/${neighborhood.slug}`}
      className={cn(
        "group relative flex flex-col rounded-xl border border-border bg-gradient-to-br overflow-hidden transition-all hover:shadow-md cursor-pointer",
        gradient,
        !hasDeals && "opacity-75",
        className
      )}
    >
      {/* Photo thumbnail */}
      {photoUrl ? (
        <div className="relative h-24 w-full bg-muted overflow-hidden">
          <Image
            src={photoUrl}
            alt={neighborhood.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          {/* Active now badge */}
          {activeNow > 0 && (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-600/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              {activeNow} now
            </span>
          )}
        </div>
      ) : (
        <div className="relative flex h-24 w-full items-center justify-center bg-muted/50">
          <MapPin className="h-8 w-8 text-muted-foreground/20" aria-hidden="true" />
          {activeNow > 0 && (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              {activeNow} now
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-3">
        <div>
          <div className="flex items-start justify-between gap-1">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-brand-600 transition-colors text-balance leading-tight">
              {neighborhood.name}
            </h3>
            {hasDeals && (
              <span className="flex shrink-0 items-center justify-center rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-primary-foreground">
                {neighborhood.active_deal_count}
              </span>
            )}
          </div>
          {hasDeals && (
            <p className="mt-1 text-xs text-muted-foreground leading-tight line-clamp-1">
              {neighborhood.active_deal_count} deal{neighborhood.active_deal_count !== 1 ? "s" : ""}
              {neighborhood.venue_count ? ` · ${neighborhood.venue_count} venues` : ""}
              {neighborhood.top_venue_name ? ` · Top: ${neighborhood.top_venue_name}` : ""}
            </p>
          )}
        </div>
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
          {zoneLabel}
        </span>
        {!hasDeals && (
          <p className="mt-1 text-xs text-muted-foreground">
            {neighborhood.venue_count ? `${neighborhood.venue_count} venues · Deals coming soon` : "Coming Soon"}
          </p>
        )}
      </div>
    </Link>
  )
}

export function NeighborhoodCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-muted/50 overflow-hidden">
      <div className="h-24 w-full animate-pulse bg-muted" />
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-5 w-8 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-2.5 w-16 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
