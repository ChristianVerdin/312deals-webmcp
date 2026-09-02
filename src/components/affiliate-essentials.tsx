"use client"

import { ShoppingBag, ArrowUpRight } from "lucide-react"
import { trackAffiliateOutbound } from "@/lib/analytics"

export interface AffiliateItem {
  /** Amazon SiteStripe short link (amzn.to/...) generated under our Associates tag. */
  href: string
  /** Amazon product image URL (m.media-amazon.com/...). */
  img: string
  label: string
  /** Short honest descriptor under the label, e.g. "adidas · Youth jersey". */
  subtitle?: string
  /**
   * Display price (e.g. "$29.99"). Amazon's Operating Agreement forbids static
   * prices, only set this from PA-API/SiteStripe live data, never hardcode an
   * invented or stale number. Left unset, the tile shows a "View on Amazon" CTA.
   */
  price?: string
  /** Small note beside the price (e.g. "Prime", "Free shipping"). Verifiable only. */
  note?: string
}

interface AffiliateEssentialsProps {
  title: string
  subtitle?: string
  items: AffiliateItem[]
  /** Optional line under the grid (e.g. a tip). */
  footnote?: string
  /** Desktop column count (default 4). Pass 3 when you have exactly 3 items so the row stays balanced. */
  columns?: 2 | 3 | 4
}

/**
 * Reusable Amazon-affiliate product grid. Each product sits on a uniform white
 * tile (square) so mixed-background Amazon photos read as a clean catalog on the
 * dark theme. Links carry rel="sponsored"; pages that use this MUST also render
 * the "As an Amazon Associate, 312Deals earns from qualifying purchases." disclosure.
 */
export function AffiliateEssentials({
  title,
  subtitle,
  items,
  footnote,
  columns = 4,
}: AffiliateEssentialsProps) {
  if (items.length === 0) return null
  const colClass =
    columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"
  return (
    <section className="mb-10 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold leading-tight text-foreground sm:text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <div className={`mt-5 grid grid-cols-2 gap-3 sm:gap-4 ${colClass}`}>
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => trackAffiliateOutbound({ network: "amazon", campaign: title })}
            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="relative aspect-square overflow-hidden bg-white">
              <img
                src={item.img}
                alt={item.label}
                loading="lazy"
                className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105 sm:p-4"
              />
            </div>
            <div className="flex flex-1 flex-col px-3 py-2.5">
              <div className="flex items-start justify-between gap-1.5">
                <span className="text-xs font-semibold leading-tight text-foreground transition-colors group-hover:text-brand-500 sm:text-sm">
                  {item.label}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-500" aria-hidden="true" />
              </div>
              {item.subtitle && (
                <span className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{item.subtitle}</span>
              )}
              {item.price && (
                <span className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {item.price}
                  {item.note && (
                    <span className="ml-1 text-[10px] font-medium text-muted-foreground">{item.note}</span>
                  )}
                </span>
              )}
              <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-bold text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                View on Amazon <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </div>
          </a>
        ))}
      </div>

      {footnote && <p className="mt-5 text-xs text-muted-foreground">{footnote}</p>}
    </section>
  )
}
