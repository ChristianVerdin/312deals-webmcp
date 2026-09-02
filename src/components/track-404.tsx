"use client"

import { useEffect } from "react"
import { track404 } from "@/lib/analytics"

export function Track404() {
  useEffect(() => {
    track404({
      path: typeof window !== "undefined" ? window.location.pathname : "unknown",
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
    })
  }, [])
  return null
}
