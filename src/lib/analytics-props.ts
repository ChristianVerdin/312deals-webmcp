/**
 * Common Plausible properties attached to every event.
 *
 * Lets us slice any goal by neighborhood, deal type, source channel,
 * day of week, weather bucket, returning vs new visitor, and more
 * all without sending PII.
 *
 * Usage in a track function:
 *   import { getCommonProps } from "@/lib/analytics-props"
 *   track("Goal Name", { ...getCommonProps(), event_specific: "value" })
 */

export type SourceChannel =
  | "organic_google"
  | "organic_bing"
  | "organic_duckduckgo"
  | "organic_yahoo"
  | "organic_chatgpt"
  | "organic_perplexity"
  | "organic_claude"
  | "organic_social_ig"
  | "organic_social_x"
  | "organic_social_tiktok"
  | "organic_social_fb"
  | "organic_social_reddit"
  | "organic_social_other"
  | "direct"
  | "referral_other"

export type WeatherBucket = "cold" | "mild" | "warm" | "unknown"
export type SessionOrigin = "cold" | "warm" | "regular"
export type DeviceClass = "mobile" | "desktop" | "tablet" | "unknown"
export type ViewportSize = "small" | "medium" | "large"

export interface CommonProps {
  source_channel: SourceChannel
  day_of_week: string
  weather_bucket: WeatherBucket
  session_origin: SessionOrigin
  device_class: DeviceClass
  viewport_size: ViewportSize
  entry_page: string
}

const STORAGE_KEY = "_312d_session"
const RETURN_KEY = "_312d_visit_count"

interface SessionState {
  entryPage: string
  startedAt: number
}

/**
 * Returns common Plausible props for the current session.
 * Safe to call from any client component, returns sensible defaults if SSR.
 */
export function getCommonProps(): CommonProps {
  if (typeof window === "undefined") {
    return defaultProps()
  }

  return {
    source_channel: deriveSourceChannel(document.referrer),
    day_of_week: dayOfWeek(),
    weather_bucket: getCachedWeatherBucket(),
    session_origin: deriveSessionOrigin(),
    device_class: deriveDeviceClass(),
    viewport_size: deriveViewportSize(),
    entry_page: deriveEntryPage(),
  }
}

function defaultProps(): CommonProps {
  return {
    source_channel: "direct",
    day_of_week: dayOfWeek(),
    weather_bucket: "unknown",
    session_origin: "cold",
    device_class: "unknown",
    viewport_size: "medium",
    entry_page: "/",
  }
}

// ─── Source channel ─────────────────────────────────────────

export function deriveSourceChannel(referrer: string): SourceChannel {
  if (!referrer) return "direct"
  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase()
  } catch {
    return "direct"
  }

  // AI search
  if (host.includes("chatgpt.com") || host.includes("chat.openai.com"))
    return "organic_chatgpt"
  if (host.includes("perplexity.ai")) return "organic_perplexity"
  if (host.includes("claude.ai") || host.includes("anthropic.com"))
    return "organic_claude"

  // Search engines
  if (host.includes("google.")) return "organic_google"
  if (host.includes("bing.com")) return "organic_bing"
  if (host.includes("duckduckgo.com") || host.includes("duck.ai"))
    return "organic_duckduckgo"
  if (host.includes("yahoo.com")) return "organic_yahoo"

  // Social
  if (host.includes("instagram.com")) return "organic_social_ig"
  if (host.includes("twitter.com") || host.includes("x.com") || host.includes("t.co"))
    return "organic_social_x"
  if (host.includes("tiktok.com")) return "organic_social_tiktok"
  if (host.includes("facebook.com") || host.includes("fb.com") || host.includes("l.facebook"))
    return "organic_social_fb"
  if (host.includes("reddit.com") || host.includes("redd.it"))
    return "organic_social_reddit"

  return "referral_other"
}

// ─── Day of week ────────────────────────────────────────────

function dayOfWeek(): string {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
  return days[new Date().getDay()] ?? "unknown"
}

// ─── Weather bucket ─────────────────────────────────────────

const WEATHER_CACHE_KEY = "_312d_weather"

interface WeatherCache {
  bucket: WeatherBucket
  expiresAt: number
}

function getCachedWeatherBucket(): WeatherBucket {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY)
    if (!raw) return "unknown"
    const parsed = JSON.parse(raw) as WeatherCache
    if (parsed.expiresAt < Date.now()) return "unknown"
    return parsed.bucket
  } catch {
    return "unknown"
  }
}

/**
 * Set the weather bucket for the day. Called once per session by the
 * homepage or root layout component after a free Open-Meteo fetch.
 * Bucketing: cold <55°F, mild 55–70°F, warm >70°F.
 */
export function cacheWeatherBucket(highF: number): void {
  if (typeof window === "undefined") return
  const bucket: WeatherBucket =
    highF < 55 ? "cold" : highF > 70 ? "warm" : "mild"
  const expiresAt = Date.now() + 6 * 60 * 60 * 1000 // 6 hours
  try {
    localStorage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({ bucket, expiresAt })
    )
  } catch {
    // ignore storage errors
  }
}

// ─── Session origin (returning visitor detection, cookieless) ──

function deriveSessionOrigin(): SessionOrigin {
  try {
    const visitCount = parseInt(localStorage.getItem(RETURN_KEY) || "0", 10)
    if (visitCount === 0) return "cold"
    if (visitCount <= 3) return "warm"
    return "regular"
  } catch {
    return "cold"
  }
}

/**
 * Increment the visit-count counter. Called once per session by root layout.
 * Uses sessionStorage to avoid double-incrementing within the same session.
 */
export function bumpVisitCount(): void {
  if (typeof window === "undefined") return
  try {
    const sessionMarker = "_312d_session_marker"
    if (sessionStorage.getItem(sessionMarker)) return
    sessionStorage.setItem(sessionMarker, "1")
    const current = parseInt(localStorage.getItem(RETURN_KEY) || "0", 10)
    localStorage.setItem(RETURN_KEY, String(current + 1))
  } catch {
    // ignore storage errors
  }
}

// ─── Device class ──────────────────────────────────────────

function deriveDeviceClass(): DeviceClass {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent.toLowerCase()
  if (/ipad|tablet/.test(ua)) return "tablet"
  if (/mobi|iphone|android.*mobile|phone/.test(ua)) return "mobile"
  return "desktop"
}

// ─── Viewport size ─────────────────────────────────────────

function deriveViewportSize(): ViewportSize {
  if (typeof window === "undefined") return "medium"
  const w = window.innerWidth
  if (w < 640) return "small"
  if (w < 1024) return "medium"
  return "large"
}

// ─── Entry page ────────────────────────────────────────────

function deriveEntryPage(): string {
  if (typeof sessionStorage === "undefined") return "/"
  const existing = sessionStorage.getItem(STORAGE_KEY)
  if (existing) {
    try {
      return (JSON.parse(existing) as SessionState).entryPage
    } catch {
      // fallthrough
    }
  }
  const entryPage = window.location.pathname
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ entryPage, startedAt: Date.now() })
    )
  } catch {
    // ignore storage errors
  }
  return entryPage
}
