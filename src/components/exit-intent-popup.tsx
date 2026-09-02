"use client"

import { useEffect, useState, useCallback } from "react"
import { X } from "lucide-react"
import { EmailSignup } from "./email-signup"

const DISMISSED_KEY = "312deals_exit_popup_dismissed"
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isRecentlyDismissed(): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (!dismissed) return false
    return Date.now() - parseInt(dismissed, 10) < COOLDOWN_MS
  } catch {
    return false
  }
}

export function ExitIntentPopup() {
  const [show, setShow] = useState(false)

  const handleMouseLeave = useCallback((e: MouseEvent) => {
    if (e.clientY <= 0 && !isRecentlyDismissed()) {
      setShow(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.innerWidth < 768) return
    if (isRecentlyDismissed()) return

    // Delay listener to avoid triggering on page load
    const timer = setTimeout(() => {
      document.addEventListener("mouseleave", handleMouseLeave)
    }, 5000)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [handleMouseLeave])

  function dismiss() {
    setShow(false)
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch {}
    document.removeEventListener("mouseleave", handleMouseLeave)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 text-center">
          <p className="mb-1 text-3xl">🍕🍺</p>
          <h2 className="text-xl font-bold text-foreground">
            Wait, don't miss the deals!
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Get Chicago's top 5 weekend deals delivered every Thursday. Free, no spam.
          </p>
        </div>

        <EmailSignup source="exit_intent" onSuccess={dismiss} />
      </div>
    </div>
  )
}
