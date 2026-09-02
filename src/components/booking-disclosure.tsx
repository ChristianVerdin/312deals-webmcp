/**
 * FTC + Awin-required disclosure for any page containing a Booking.com
 * affiliate link. Per the Booking.com Affiliate Program terms, the wording
 * must be visible (not collapsed) and present on the page where the link is
 * displayed.
 */
export function BookingDisclosure({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground/70 ${className}`}>
      As a Booking.com Affiliate, 312Deals earns from qualifying transactions.
    </p>
  )
}
