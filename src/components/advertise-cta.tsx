"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { trackAdvertiseClick } from "@/lib/analytics"

/**
 * A CTA link on /advertise that fires a Plausible event on click so we can see
 * which advertising CTA gets clicked, how often, and from what source.
 * Internal hrefs use next/link; external (Stripe checkout) and mailto use <a>.
 */
export function AdvertiseCta({
  href,
  cta,
  className,
  children,
  newTab,
}: {
  href: string
  cta: string
  className?: string
  children: ReactNode
  newTab?: boolean
}) {
  const onClick = () => trackAdvertiseClick({ cta })
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {children}
      </Link>
    )
  }
  return (
    <a
      href={href}
      className={className}
      onClick={onClick}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  )
}
