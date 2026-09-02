/**
 * Analytics event tracking via Plausible.
 *
 * Plausible is already loaded in layout.tsx. Custom events use the
 * `window.plausible()` function set up by the init script.
 *
 * Privacy: No PII is ever sent. Only categorical values (neighborhood slug,
 * deal type, boolean flags), never user-identifiable data.
 *
 * Plausible dashboard goals must be created manually to see these events:
 *   Settings → Goals → + Add Goal → Custom Event
 *
 * Goals to define:
 *   - Newsletter Signup
 *   - AI Chat Sent
 *   - Ask AI Click
 *   - Form Submission (existing event "Deal Submitted")
 *   - Affiliate Outbound: OpenTable
 *   - Affiliate Outbound: Resy
 *   - Affiliate Outbound: Amazon
 *   - Affiliate Outbound: Chain App
 *   - Affiliate Outbound: Delivery (DoorDash/Grubhub/UberEats)
 *   - Affiliate Outbound: Booking.com
 *   - Deal Reported
 *
 * Funnels to define (after Goals exist):
 *   - Affiliate funnel: Visit → Deal Clicked → Affiliate Outbound (any)
 *   - Newsletter funnel: Visit → /search view → Newsletter Signup
 *   - AI funnel: Visit → /chat view → AI Chat Sent
 *   - ChatGPT-referral funnel: source_channel=organic_chatgpt → Newsletter Signup OR AI Chat Sent
 *   - Social-referral funnel: source_channel IN (organic_social_*) → Newsletter Signup
 */

import { getCommonProps } from "./analytics-props"
import type { AffiliateNetwork } from "./affiliate"

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> }
    ) => void
  }
}

/**
 * Send an event to Plausible with the given props merged on top of common props.
 * Common props (source_channel, day_of_week, etc.) are attached to every event
 * so any goal can be filtered by them in the Plausible dashboard.
 */
function track(event: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined" || !window.plausible) return
  const merged = { ...getCommonProps(), ...(props || {}) }
  window.plausible(event, { props: merged })
}

// ─── User interaction events ──────────────────────────────────

/**
 * Advertise-page CTA clicks. Distinct event name per CTA so each can be its own
 * Plausible Goal (e.g. "Advertise: Get Featured ($39)"); the `cta` prop also
 * allows a single-goal breakdown, alongside the common props (source, day, etc.).
 */
export function trackAdvertiseClick(props: { cta: string }) {
  track(`Advertise: ${props.cta}`, { cta: props.cta })
}

/**
 * Normalise a neighborhood into slug form before it becomes a Plausible prop.
 *
 * Callers pass `neighborhood_slug || neighborhood`, so whenever the slug is
 * missing the DISPLAY name goes out instead. Plausible then records
 * "river-north" and "River North" as two separate values of the same prop,
 * silently splitting every breakdown built on it (72 vs 13 visitors for one
 * hood in the 28 days to 2026-08-21). Normalising here rather than at each
 * call site means a future caller cannot reintroduce the split.
 */
function hoodSlug(v: string | undefined | null): string | undefined {
  if (!v) return undefined
  return v
    .trim()
    .toLowerCase()
    .replace(/['\u2019.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || undefined
}

/** User searches or applies filters on the search page */
export function trackDealSearched(props: {
  query?: string
  neighborhood?: string
  day?: string
  deal_type?: string
  active_now?: boolean
  result_count: number
  /** Where the search originated, pathname of the page that initiated it.
   *  Hub-page searches arrive on /search via SearchBar's router.push and
   *  carry &source= so we can distinguish "direct /search visit" from
   *  "/happy-hours/wicker-park inline search bar". */
  source?: string
}) {
  track("Deal Searched", {
    has_query: !!props.query,
    neighborhood: hoodSlug(props.neighborhood) || "all",
    day: props.day || "any",
    deal_type: props.deal_type || "all",
    active_now: !!props.active_now,
    result_count: props.result_count,
    source: props.source || "search_page",
  })
}

/** User clicks through to a venue from a deal card */
export function trackDealClicked(props: {
  deal_type: string
  neighborhood: string
  venue_slug: string
  is_chain?: boolean
}) {
  track("Deal Clicked", {
    deal_type: props.deal_type,
    neighborhood: hoodSlug(props.neighborhood) || "unknown",
    venue_slug: props.venue_slug,
    is_chain: !!props.is_chain,
  })
}

/** User saves or unsaves a deal */
export function trackDealSaved(props: { action: "save" | "unsave" }) {
  track("Deal Saved", props)
}

/** User shares a deal via share button */
export function trackDealShared(props: { method: "twitter" | "facebook" | "copy" | "native" | "sms" | "whatsapp" }) {
  track("Deal Shared", props)
}

/** User confirms or reports a deal */
export function trackDealReported(props: {
  action: "confirm_active" | "report_outdated"
  deal_type?: string
  neighborhood?: string
}) {
  track("Deal Reported", {
    action: props.action,
    deal_type: props.deal_type || "unknown",
    neighborhood: hoodSlug(props.neighborhood) || "unknown",
  })
}

/** Newsletter signup, the highest-priority Plausible Goal */
export function trackNewsletterSignup(props: {
  source: string // e.g. "search_cta", "footer", "exit_modal", "submit_form"
  page: string
}) {
  track("Newsletter Signup", {
    source: props.source,
    page: props.page,
  })
}

/** Newsletter signup attempted but failed (API error, network error, validation).
 * Counterpart to Newsletter Signup, lets us see demand-during-outage.
 * Added 2026-05-19 after the Railway upstream-cloud outage made every
 * /search submission silently fail with no analytics signal. */
export function trackNewsletterSignupFailed(props: {
  source: string
  page: string
  reason: "api_error" | "network_error" | "validation"
  status?: number
}) {
  track("Newsletter Signup Failed", {
    source: props.source,
    page: props.page,
    reason: props.reason,
    status: props.status ?? 0,
  })
}

/** User submits a deal via the submit form */
export function trackDealSubmitted(props: { deal_type: string }) {
  track("Deal Submitted", { deal_type: props.deal_type || "unset" })
}

/** User generates a bar crawl plan */
export function trackCrawlPlanned(props: {
  neighborhood: string
  hours: number
  group_size: number
  stops: number
}) {
  track("Crawl Planned", props)
}

/** User uses the map "Near me" geolocation feature */
export function trackNearMeUsed() {
  track("Near Me Used")
}

/** User applies a filter on the search page */
export function trackFilterUsed(props: { filter_type: string; value: string }) {
  track("Filter Used", props)
}

/** User landed on a 404. Fired client-side from not-found.tsx. */
export function track404(props: { path: string; referrer?: string }) {
  track("404", {
    path: props.path,
    referrer: props.referrer || "unknown",
  })
}

// ─── AI Chat events ─────────────────────────────────────────────

/** User clicks an "Ask AI" CTA chip on a deal-type or guide page */
export function trackAskAIClick(props: {
  page: string // path the user clicked from, e.g. "/deals/wing-deals"
  deal_type?: string
  prefilled_query?: string
}) {
  track("Ask AI Click", {
    page: props.page,
    deal_type: props.deal_type || "unknown",
    prefilled_query: props.prefilled_query || "",
  })
}

/** User sends a message in the AI chat. Fired on EACH message sent. */
export function trackAIChatSent(props: {
  turn: number // 1 = first message of session, 2 = second, etc.
  deal_type?: string // parsed from query if detectable
  query_length?: number
}) {
  track("AI Chat Sent", {
    turn: props.turn,
    deal_type: props.deal_type || "unknown",
    query_length: props.query_length ?? 0,
  })
}

// ─── Affiliate outbound events ──────────────────────────────────

/**
 * User clicks an outbound link wrapped with an affiliate ID.
 * Fired AFTER the click (cookie/referral redirect handles the actual
 * affiliate tracking on the destination side).
 */
export function trackAffiliateOutbound(props: {
  network: AffiliateNetwork
  venue_slug?: string
  neighborhood?: string
  deal_type?: string
  campaign?: string
}) {
  // Use one event per network so each can be its own Plausible Goal.
  // Plausible Goals are easier to filter in the dashboard than props.
  const eventName = `Affiliate Outbound: ${humanNetworkName(props.network)}`
  track(eventName, {
    network: props.network,
    venue_slug: props.venue_slug || "unknown",
    neighborhood: props.neighborhood || "unknown",
    deal_type: props.deal_type || "unknown",
    campaign: props.campaign || "default",
  })
}

function humanNetworkName(network: AffiliateNetwork): string {
  switch (network) {
    case "opentable":
      return "OpenTable"
    case "resy":
      return "Resy"
    case "amazon":
      return "Amazon"
    case "doordash":
      return "DoorDash"
    case "grubhub":
      return "Grubhub"
    case "ubereats":
      return "UberEats"
    case "owner":
      return "Owner"
    case "booking":
      return "Booking.com"
    case "chain_ios":
    case "chain_android":
      return "Chain App"
    case "generic":
      return "Generic"
  }
}
