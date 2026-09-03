"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, MapPin, Tag, ExternalLink, Star, Smartphone, MoreHorizontal, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Deal } from "@/lib/types"
import {
  getDealTimeStatus,
  getDealTypeConfig,
  formatDays,
  formatTimeRange,
} from "@/lib/deal-utils"
import { DealTypeBadge } from "./deal-type-badge"
import { SaveDealButton } from "./save-deal-button"
import { TonightButton } from "./tonight-button"
import { ShareButton } from "./share-button"
import { toast } from "sonner"
import { trackDealClicked, trackDealReported, trackAffiliateOutbound } from "@/lib/analytics"
import { withAffiliateId } from "@/lib/affiliate"

function FreshnessBadge({ deal }: { deal: Deal }) {
  const ts = (deal as any).verified_at || (deal as any).last_checked_at || (deal as any).updated_at
  if (!ts) return null

  const diffMs = Date.now() - new Date(ts).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0 || diffDays > 30) return null

  const dayLabel = diffDays === 0 ? "today" : `${diffDays}d ago`

  if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <Clock className="h-3 w-3" />
        Verified {dayLabel}
      </span>
    )
  }
  if (diffDays <= 14) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Checked {dayLabel}
      </span>
    )
  }
  // 15-30 days
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
      <Clock className="h-3 w-3" />
      Last checked {dayLabel}
    </span>
  )
}

interface DealCardProps {
  deal: Deal
  variant?: "compact" | "full" | "venue-detail"
  className?: string
  additionalDeals?: Deal[]
}

import { memo } from "react"

export const DealCard = memo(function DealCard({
  deal,
  variant = "compact",
  className,
  additionalDeals,
}: DealCardProps) {
  const timeStatus = getDealTimeStatus(deal)
  const typeConfig = getDealTypeConfig(deal.deal_type)
  const daysText = formatDays(deal.days_available)
  const timeText = formatTimeRange(
    deal.start_time,
    deal.end_time,
    deal.is_all_day
  )
  const [actionsOpen, setActionsOpen] = useState(false)

  function handleReport(e: React.MouseEvent, action: "report_outdated" | "confirm_active") {
    e.preventDefault()
    e.stopPropagation()
    setActionsOpen(false)
    trackDealReported({ action })
    fetch(`/api/v1/deals/${deal.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed")
        return res.json()
      })
      .then(() => {
        toast.success(
          action === "report_outdated"
            ? "Reported as outdated, thanks!"
            : "Confirmed active, thanks!"
        )
      })
      .catch(() => {
        toast.error("Something went wrong. Try again later.")
      })
  }

  const isVenueDetail = variant === "venue-detail"

  const cardContent = (
    <div className={cn(
      "flex flex-col rounded-xl border border-border bg-card",
      !isVenueDetail && "group relative transition-all hover:shadow-md active:scale-[0.98]",
      "border-l-4",
      typeConfig.borderClass,
      className
    )}>
      <div className="flex flex-col gap-2.5 p-4 sm:gap-3 sm:p-5">
        {/* Top row: badge + status + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {!isVenueDetail && <DealTypeBadge dealType={deal.deal_type} />}
            {timeStatus?.status === "active" && (
              <span className="inline-flex items-center gap-1.5 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                  Active Now
                </span>
              </span>
            )}
            {timeStatus?.status === "starts-soon" && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                {timeStatus.label}
              </span>
            )}
            {deal.is_featured === 1 && (!deal.featured_until || new Date(deal.featured_until) > new Date()) && (
              <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                ★ Featured
              </span>
            )}
          </div>

          {/* Actions: save + share always visible, overflow for rest */}
          <div className="flex items-center gap-0.5 shrink-0">
            <TonightButton deal={deal} />
            <SaveDealButton dealId={deal.id} />
            <ShareButton deal={deal} variant="icon" />
            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setActionsOpen(!actionsOpen)
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary active:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {actionsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setActionsOpen(false)
                    }}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-border bg-card py-1 shadow-lg">
                    <button
                      onClick={(e) => handleReport(e, "confirm_active")}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Confirm active
                    </button>
                    <button
                      onClick={(e) => handleReport(e, "report_outdated")}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Report outdated
                    </button>
                    <div
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                    >
                      <ShareButton
                        url={`/venues/${deal.venue_slug}#deal-${deal.id}`}
                        title={`${deal.venue_name}, ${deal.title}`}
                        text={`Check out this deal: ${deal.title} at ${deal.venue_name} in ${deal.neighborhood}`}
                        variant="menu-item"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Venue name + dietary tags (hidden on venue detail page) */}
        {!isVenueDetail && <div className="flex items-center gap-2 min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground group-hover:text-brand-600 transition-colors sm:text-sm">
            {deal.venue_name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {deal.is_gluten_free === 1 && (
              <span className="inline-flex items-center rounded-md bg-green-100 px-1.5 py-0.5 text-[11px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                GF
              </span>
            )}
            {deal.dietary_tags?.includes("vegan") && (
              <span className="inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                Vegan
              </span>
            )}
            {deal.dietary_tags?.includes("vegetarian") && !deal.dietary_tags?.includes("vegan") && (
              <span className="inline-flex items-center rounded-md bg-lime-100 px-1.5 py-0.5 text-[11px] font-bold text-lime-700 dark:bg-lime-900/40 dark:text-lime-400">
                Veggie
              </span>
            )}
          </div>
        </div>}

        {/* Deal title, prominent */}
        <p className={cn(
          "font-medium text-brand-600 dark:text-brand-400 leading-snug",
          isVenueDetail ? "text-lg" : "text-base sm:text-sm"
        )}>
          {deal.title}
        </p>

        {/* Freshness badge */}
        <FreshnessBadge deal={deal} />

        {/* Best deal item */}
        {deal.best_deal_item && (
          <p className="text-sm text-foreground">
            <Tag className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
            {deal.best_deal_item}
          </p>
        )}

        {(variant === "full" || isVenueDetail) && deal.description && (
          <p className={cn(
            "text-muted-foreground",
            isVenueDetail ? "text-sm leading-relaxed" : "text-sm line-clamp-2"
          )}>
            {deal.description}
          </p>
        )}

        {/* Price highlights, venue detail only, parsed from description */}
        {isVenueDetail && deal.description && (() => {
          const priceMatches = deal.description.match(/\$\d+(?:\.\d{2})?(?:\s*[-–]\s*\$\d+(?:\.\d{2})?)?\s+[a-zA-Z][a-zA-Z\s&']*/g)
          if (!priceMatches || priceMatches.length === 0) return null
          const prices = priceMatches.slice(0, 6).map(m => m.trim())
          return (
            <div className="flex flex-wrap gap-1.5">
              {prices.map((price, i) => (
                <span
                  key={i}
                  className="rounded-md bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400"
                >
                  {price}
                </span>
              ))}
            </div>
          )
        })()}

        {/* Food & drink items */}
        {(variant === "full" || isVenueDetail) && Array.isArray(deal.food_items) && deal.food_items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {deal.food_items.slice(0, 4).map((item, i) => (
              <span
                key={i}
                className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
              >
                {item.name}
                {item.deal_price != null && <span className="tabular-nums">{` $${item.deal_price}`}</span>}
                {item.description && !item.deal_price && ` (${item.description})`}
              </span>
            ))}
          </div>
        )}

        {(variant === "full" || isVenueDetail) && Array.isArray(deal.drink_items) && deal.drink_items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {deal.drink_items.slice(0, 4).map((item, i) => (
              <span
                key={i}
                className="rounded-md bg-sky-400/10 px-2 py-1 text-xs text-sky-600 dark:text-sky-400"
              >
                {item.name}
                {item.deal_price != null && <span className="tabular-nums">{` $${item.deal_price}`}</span>}
                {item.description && !item.deal_price && ` (${item.description})`}
              </span>
            ))}
          </div>
        )}

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {!isVenueDetail && <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {deal.neighborhood}
          </span>}
          {daysText && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {daysText}
              {timeText && ` ${timeText}`}
            </span>
          )}
          {deal.google_rating != null && deal.google_rating > 0 && (
            <span className="flex items-center gap-0.5 font-medium text-amber-600 dark:text-amber-400 tabular-nums">
              <Star className="h-3.5 w-3.5 fill-current" />
              {deal.google_rating.toFixed(1)}
            </span>
          )}
          {deal.best_savings_pct != null && deal.best_savings_pct > 0 && (
            <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
              Save {Math.round(deal.best_savings_pct)}%
            </span>
          )}
        </div>

        {(variant === "full" || isVenueDetail) && deal.restrictions && (
          <p className="text-xs text-muted-foreground italic">
            {deal.restrictions}
          </p>
        )}

        {(variant === "full" || isVenueDetail) && deal.source_url && (
          <a
            href={deal.source_url.startsWith("http") ? deal.source_url : `https://${deal.source_url}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
        )}

        {deal.is_chain === 1 && (deal.app_url_ios || deal.app_url_android) && (
          <div className="flex gap-2">
            {deal.app_url_ios && (
              <a
                href={withAffiliateId(deal.app_url_ios, "chain_ios")}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={(e) => {
                  e.stopPropagation()
                  trackAffiliateOutbound({
                    network: "chain_ios",
                    venue_slug: deal.venue_slug,
                    neighborhood: deal.neighborhood,
                    deal_type: deal.deal_type,
                  })
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-80 active:opacity-70"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Get App (iOS)
              </a>
            )}
            {deal.app_url_android && (
              <a
                href={withAffiliateId(deal.app_url_android, "chain_android")}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={(e) => {
                  e.stopPropagation()
                  trackAffiliateOutbound({
                    network: "chain_android",
                    venue_slug: deal.venue_slug,
                    neighborhood: deal.neighborhood,
                    deal_type: deal.deal_type,
                  })
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-muted active:bg-muted/80"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Get App (Android)
              </a>
            )}
          </div>
        )}

        {/* Reserve button, Resy only (OpenTable affiliate dropped: rejected/unpaid) */}
        {deal.is_chain !== 1 && deal.resy_url && (
          <a
            href={withAffiliateId(deal.resy_url, "resy")}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={(e) => {
              e.stopPropagation()
              trackAffiliateOutbound({
                network: "resy",
                venue_slug: deal.venue_slug,
                neighborhood: deal.neighborhood,
                deal_type: deal.deal_type,
              })
            }}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-chi-red-600 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Reserve on Resy
          </a>
        )}

        {/* Additional deals at this venue (grouped search results) */}
        {additionalDeals && additionalDeals.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              +{additionalDeals.length} more deal{additionalDeals.length > 1 ? 's' : ''} at this venue
            </p>
            <div className="space-y-1.5">
              {additionalDeals.slice(0, 3).map((d) => (
                <div key={d.id} className="flex items-baseline gap-2 text-xs">
                  <span className="shrink-0 rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">
                    {d.deal_type?.replace(/_/g, ' ')}
                  </span>
                  <span className="min-w-0 truncate text-foreground">{d.title}</span>
                </div>
              ))}
              {additionalDeals.length > 3 && (
                <p className="text-[10px] text-muted-foreground">
                  +{additionalDeals.length - 3} more...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (isVenueDetail) return cardContent

  return (
    <Link
      href={`/venues/${deal.venue_slug}`}
      onClick={() => trackDealClicked({ deal_type: deal.deal_type, neighborhood: deal.neighborhood_slug || deal.neighborhood, venue_slug: deal.venue_slug })}
    >
      {cardContent}
    </Link>
  )
})

export function DealCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border border-l-4 border-l-muted bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2.5">
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-44 animate-pulse rounded bg-muted" />
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mt-3 h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-3 flex gap-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
