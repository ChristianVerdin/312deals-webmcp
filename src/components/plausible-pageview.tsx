"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { getCommonProps } from "@/lib/analytics-props"

/**
 * Fires a manual Plausible pageview with full common-props payload on every
 * client-side route change.
 *
 * Why this exists: Plausible's auto-pageview (enabled by default) does NOT
 * carry the custom properties returned by getCommonProps(), `source_channel`,
 * `entry_page`, `day_of_week`, `weather_bucket`, `viewport_size`,
 * `session_origin`, `device_class`. Without them attached to pageviews, every
 * dashboard breakdown by these properties shows ~98% of sessions as "(none)".
 *
 * Pair this component with `autoCapturePageviews: false` in the Plausible init
 * script in layout.tsx so we don't double-count.
 *
 * RACE-CONDITION FIX (May 5 2026): both Plausible scripts in layout.tsx use
 * `strategy="afterInteractive"`, which means React's useEffect can fire BEFORE
 * `window.plausible` is defined on cold-load. The previous
 * `if (!window.plausible) return` silently dropped the first pageview of every
 * cold-load session, which caused a ~50% visitor undercount starting Apr 28
 * (when this component shipped). The fix: poll briefly until plausible exists,
 * up to ~3s, then queue the pageview.
 */
export function PlausiblePageview() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined") return

    const fire = () => {
      if (!window.plausible) return false
      window.plausible("pageview", {
        props: getCommonProps() as unknown as Record<string, string | number | boolean>,
      })
      return true
    }

    if (fire()) return

    let attempts = 0
    const maxAttempts = 30 // 30 × 100ms = 3s
    const interval = window.setInterval(() => {
      attempts++
      if (fire() || attempts >= maxAttempts) {
        window.clearInterval(interval)
      }
    }, 100)

    return () => window.clearInterval(interval)
  }, [pathname])

  return null
}
