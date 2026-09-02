import { Hotel } from "lucide-react"
import { withAffiliateId } from "@/lib/affiliate"
import { AffiliateLink } from "@/components/affiliate-link"
import { BookingDisclosure } from "@/components/booking-disclosure"

interface BookingCTAProps {
  /** Plausible clickref / Awin clickref, e.g. "cubs_guide", "mothers_day_guide" */
  campaign: string
  /** Booking.com search-results URL or deep link. Leave default for generic Chicago. */
  destination?: string
  /** Headline above the CTA, e.g. "Visiting for opening day?" */
  headline: string
  /** One-line subhead, keep it tight. */
  subhead: string
  /** CTA button label */
  ctaLabel?: string
}

const DEFAULT_DESTINATION = "https://www.booking.com/searchresults.html?ss=Chicago%2C+IL"

/**
 * Inline lodging-affiliate module for guide pages where visitors arrive with
 * planning intent (Cubs, March Madness, holidays, brunch weekends, etc.).
 *
 * Booking.com's cookie window is in-session only (2 days max), so this MUST
 * sit on the page itself, generic homepage banners won't convert.
 */
export function BookingCTA({
  campaign,
  destination = DEFAULT_DESTINATION,
  headline,
  subhead,
  ctaLabel = "See available stays →",
}: BookingCTAProps) {
  const href = withAffiliateId(destination, "booking", { campaign })

  return (
    <section className="my-8 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-secondary p-2">
          <Hotel className="h-5 w-5 text-brand-500" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground">{headline}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{subhead}</p>
          <AffiliateLink
            href={href}
            network="booking"
            campaign={campaign}
            className="mt-3 inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-600"
          >
            {ctaLabel}
          </AffiliateLink>
          <BookingDisclosure className="mt-3" />
        </div>
      </div>
    </section>
  )
}
