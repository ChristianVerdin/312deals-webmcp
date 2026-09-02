"use client"

import { useState } from "react"
import { toast } from "sonner"
import { trackNewsletterSignup, trackNewsletterSignupFailed } from "@/lib/analytics"

interface EmailSignupProps {
  source?: string
  variant?: "banner" | "inline"
  /** Banner headline. Defaults to the generic "best Chicago deals" pitch.
   *  Override with intent-matched copy on high-converting pages. */
  headline?: string
  /** Banner subtitle. Defaults to the generic weekly-roundup pitch. */
  subtitle?: string
  onSuccess?: () => void
}

const DEFAULT_HEADLINE = "The best Chicago deals, before the weekend"
const DEFAULT_SUBTITLE =
  "Every Thursday: 5 hand-picked happy hours, BOGO nights & hidden gems across the city and suburbs. Free, unsubscribe anytime."

export function EmailSignup({
  source = "website",
  variant = "banner",
  headline = DEFAULT_HEADLINE,
  subtitle = DEFAULT_SUBTITLE,
  onSuccess,
}: EmailSignupProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)

    try {
      const res = await fetch("/api/v1/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      })
      const data = await res.json()

      if (!res.ok) {
        const msg = typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail) && data.detail[0]?.msg
            ? data.detail[0].msg
            : "Something went wrong. Try again."
        toast.error(msg)
        trackNewsletterSignupFailed({
          source,
          page: typeof window !== "undefined" ? window.location.pathname : "/",
          reason: res.status >= 400 && res.status < 500 ? "validation" : "api_error",
          status: res.status,
        })
        return
      }

      trackNewsletterSignup({
        source,
        page: typeof window !== "undefined" ? window.location.pathname : "/",
      })
      toast.success(data.message)
      setEmail("")
      onSuccess?.()
    } catch {
      toast.error("Network error. Try again.")
      trackNewsletterSignupFailed({
        source,
        page: typeof window !== "undefined" ? window.location.pathname : "/",
        reason: "network_error",
      })
    } finally {
      setLoading(false)
    }
  }

  if (variant === "inline") {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          aria-label="Email address"
          required
          className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-9 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {loading ? "..." : "Subscribe"}
        </button>
      </form>
    )
  }

  return (
    <section className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-orange-50 p-6 dark:border-brand-800 dark:from-brand-950/50 dark:to-orange-950/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            {headline}
          </h3>
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2 sm:min-w-[340px]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          aria-label="Email address"
            required
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? "..." : "Subscribe"}
          </button>
        </form>
      </div>
    </section>
  )
}
