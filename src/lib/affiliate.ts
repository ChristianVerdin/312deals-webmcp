/**
 * Affiliate URL wrapper.
 *
 * Wraps outbound URLs with money-bearing affiliate parameters per network.
 * Falls back to UTM trio if a network's affiliate ID is not configured
 * so removing or misconfiguring an env var never breaks an outbound link.
 *
 * Wire env vars in .env.local (NEXT_PUBLIC_*_PARTNER_ID). Without them,
 * outbound URLs still work but carry only attribution UTMs (no commission).
 *
 * Usage:
 *   import { withAffiliateId } from "@/lib/affiliate"
 *   const url = withAffiliateId(deal.opentable_url, "opentable")
 *   const url = withAffiliateId(amazonProductUrl, "amazon", { campaign: "cubs_guide" })
 */

export type AffiliateNetwork =
  | "opentable"
  | "resy"
  | "amazon"
  | "doordash"
  | "grubhub"
  | "ubereats"
  | "owner"
  | "booking"
  | "chain_ios"
  | "chain_android"
  | "generic"

interface AffiliateContext {
  /** Optional sub-id / campaign for granular reporting (e.g. "cubs_guide") */
  campaign?: string
  /** Optional medium override (default: "deal_card") */
  medium?: string
}

const DEFAULT_UTM = {
  source: "312deals",
  medium: "deal_card",
}

/**
 * Append affiliate ID + UTM params to an outbound URL.
 * Network-specific params are added before the UTM trio so primary
 * affiliate networks read their own params first.
 */
export function withAffiliateId(
  url: string | null | undefined,
  network: AffiliateNetwork,
  context: AffiliateContext = {}
): string {
  if (!url) return ""

  const normalized = url.startsWith("http") ? url : `https://${url}`

  let result: string
  try {
    const u = new URL(normalized)
    applyNetworkParams(u, network, context)
    applyUtmParams(u, network, context)
    result = u.toString()
  } catch {
    // Malformed URL, return as-is to avoid breaking the link
    return normalized
  }

  return result
}

/**
 * Network-specific affiliate parameter logic.
 * Reads NEXT_PUBLIC_*_PARTNER_ID env vars; if missing, only UTMs are appended.
 */
function applyNetworkParams(
  u: URL,
  network: AffiliateNetwork,
  context: AffiliateContext
): void {
  switch (network) {
    case "opentable": {
      // OpenTable Affiliate Network (via Impact Radius). The `ref` param is
      // the partner identifier OpenTable forwards to the diner ID system.
      // Existing URLs already carry restref / ot_source, leave those intact.
      const id = process.env.NEXT_PUBLIC_OPENTABLE_PARTNER_ID
      if (id) {
        u.searchParams.set("ref", id)
        if (context.campaign) u.searchParams.set("ref_subid", context.campaign)
      }
      return
    }

    case "resy": {
      // Resy direct partnerships (no public API). If a partnership lands,
      // they'll provide a referral code that goes in `?referrer=`.
      const id = process.env.NEXT_PUBLIC_RESY_REFERRAL_ID
      if (id) {
        u.searchParams.set("referrer", id)
      }
      return
    }

    case "amazon": {
      // Amazon Associates: tag=YOURTAG-20
      const id = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG
      if (id) {
        u.searchParams.set("tag", id)
        // Optional: ascsubtag for sub-id reporting
        if (context.campaign) u.searchParams.set("ascsubtag", context.campaign)
      }
      return
    }

    case "doordash":
    case "grubhub":
    case "ubereats": {
      // CJ Affiliate / Impact Radius pattern: redirect through the network's
      // tracking URL with PID + AID + URL params. We store the click-redirect
      // template in env, then wrap the destination URL through it.
      const networkKey = network.toUpperCase()
      const template = process.env[
        `NEXT_PUBLIC_${networkKey}_AFFILIATE_TEMPLATE`
      ] as string | undefined
      if (template) {
        // Template format: "https://www.dpbolvw.net/click-XXX-YYY?url={url}"
        // Caller is responsible for url-encoding inside template.
        const wrapped = template.replace(
          "{url}",
          encodeURIComponent(u.toString())
        )
        // Replace the URL in place by parsing the wrapped redirect
        try {
          const wrappedUrl = new URL(wrapped)
          u.protocol = wrappedUrl.protocol
          u.host = wrappedUrl.host
          u.pathname = wrappedUrl.pathname
          u.search = wrappedUrl.search
        } catch {
          // Malformed template; leave URL unwrapped
        }
      }
      return
    }

    case "owner": {
      // Owner.com PartnerStack
      const id = process.env.NEXT_PUBLIC_OWNER_PARTNERSTACK_KEY
      if (id) {
        u.searchParams.set("ps_partner_key", id)
        if (context.campaign) u.searchParams.set("ps_xid", context.campaign)
      }
      return
    }

    case "booking": {
      // Booking.com via Awin (MID 6776 = North America).
      // Awin requires the destination URL to be CLEAN of `aid` / `label` so
      // it can dynamically inject fresh tracking params (per Awin linking
      // structure guide). We strip those, URL-encode the cleaned destination,
      // and wrap the whole thing through awin1.com/cread.php.
      const pubId = process.env.NEXT_PUBLIC_AWIN_PUBLISHER_ID
      const mid = process.env.NEXT_PUBLIC_BOOKING_AWIN_MID
      if (!pubId || !mid) return

      u.searchParams.delete("aid")
      u.searchParams.delete("label")
      const cleanDest = u.toString()

      const params = new URLSearchParams({
        awinmid: mid,
        awinaffid: pubId,
        ued: cleanDest,
      })
      if (context.campaign) params.set("clickref", context.campaign)

      try {
        const wrapped = new URL(`https://www.awin1.com/cread.php?${params.toString()}`)
        u.protocol = wrapped.protocol
        u.host = wrapped.host
        u.pathname = wrapped.pathname
        u.search = wrapped.search
      } catch {
        // leave unwrapped
      }
      return
    }

    case "chain_ios":
    case "chain_android": {
      // Most chain apps don't have public affiliate programs. UTM only.
      return
    }

    case "generic":
      return
  }
}

function applyUtmParams(
  u: URL,
  network: AffiliateNetwork,
  context: AffiliateContext
): void {
  if (!u.searchParams.has("utm_source")) {
    u.searchParams.set("utm_source", DEFAULT_UTM.source)
  }
  if (!u.searchParams.has("utm_medium")) {
    u.searchParams.set("utm_medium", context.medium || DEFAULT_UTM.medium)
  }
  if (!u.searchParams.has("utm_campaign")) {
    u.searchParams.set("utm_campaign", networkCampaign(network, context))
  }
}

function networkCampaign(
  network: AffiliateNetwork,
  context: AffiliateContext
): string {
  if (context.campaign) return context.campaign
  switch (network) {
    case "opentable":
    case "resy":
      return "reservation"
    case "amazon":
      return "guide_affiliate"
    case "doordash":
    case "grubhub":
    case "ubereats":
      return "delivery"
    case "owner":
      return "owner_referral"
    case "booking":
      return "lodging"
    case "chain_ios":
    case "chain_android":
      return "chain_app"
    case "generic":
      return "outbound"
  }
}

/**
 * Infer the affiliate network from a URL host. Useful for the secondary
 * outbound-link sweep where call sites have raw URLs but no network context.
 */
export function inferNetwork(url: string | null | undefined): AffiliateNetwork {
  if (!url) return "generic"
  const host = url.toLowerCase()
  if (host.includes("opentable.com")) return "opentable"
  if (host.includes("resy.com")) return "resy"
  if (host.includes("amazon.com") || host.includes("amzn.to")) return "amazon"
  if (host.includes("doordash.com")) return "doordash"
  if (host.includes("grubhub.com")) return "grubhub"
  if (host.includes("ubereats.com") || host.includes("uber.com/eats"))
    return "ubereats"
  if (host.includes("owner.com")) return "owner"
  if (host.includes("booking.com")) return "booking"
  return "generic"
}
