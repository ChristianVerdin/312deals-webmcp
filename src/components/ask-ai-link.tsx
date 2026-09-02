"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { trackAskAIClick } from "@/lib/analytics"

interface AskAILinkProps {
  href?: string
  page: string
  dealType?: string
  prefilledQuery?: string
  className?: string
  children: ReactNode
}

export function AskAILink({
  href = "/chat",
  page,
  dealType,
  prefilledQuery,
  className,
  children,
}: AskAILinkProps) {
  return (
    <Link
      href={href}
      className={className}
      rel="nofollow"
      onClick={() => {
        trackAskAIClick({
          page,
          deal_type: dealType,
          prefilled_query: prefilledQuery,
        })
      }}
    >
      {children}
    </Link>
  )
}
