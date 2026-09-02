"use client"

import type { AffiliateNetwork } from "@/lib/affiliate"
import { trackAffiliateOutbound } from "@/lib/analytics"
import type { ReactNode, MouseEvent } from "react"

interface AffiliateLinkProps {
  href: string
  network: AffiliateNetwork
  venueSlug?: string
  neighborhood?: string
  dealType?: string
  campaign?: string
  className?: string
  children: ReactNode
}

export function AffiliateLink({
  href,
  network,
  venueSlug,
  neighborhood,
  dealType,
  campaign,
  className,
  children,
}: AffiliateLinkProps) {
  const handleClick = (_e: MouseEvent<HTMLAnchorElement>) => {
    trackAffiliateOutbound({
      network,
      venue_slug: venueSlug,
      neighborhood,
      deal_type: dealType,
      campaign,
    })
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  )
}
