import { NextRequest, NextResponse } from "next/server"

/**
 * Server-side route that provides the Google Maps API key.
 *
 * Defense in depth:
 *   1. Google Cloud Console: HTTP referrer restrictions on the key
 *      (312deals.com/*, www.312deals.com/*, localhost:3000/*) +
 *      API restrictions to Maps JS + Places JS only.
 *   2. THIS ROUTE: server-side Referer check before returning the key.
 *      Apr 28 2026 fix, earlier audit confirmed Geocoding API was not
 *      restricted in GCP and could be abused via any Referer. We now gate
 *      the key endpoint to allowlisted referrers.
 *
 * Note: a determined attacker can still spoof Referer/Origin headers on
 * direct Google Maps API calls. The GCP-side restrictions are the real
 * defense. Recommended: also lock down the key in GCP, for the Geocoding
 * API endpoint specifically, add referrer restrictions or rotate to a
 * separate restricted key.
 */
export async function GET(request: NextRequest) {
  const key =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""

  if (!key) {
    return NextResponse.json({ key: "" }, { status: 200 })
  }

  // Allow only requests from our own origins. Returns empty key otherwise.
  const referer = request.headers.get("referer") || ""
  const origin = request.headers.get("origin") || ""
  const ALLOWED_HOSTS = new Set([
    "www.312deals.com",
    "312deals.com",
    "chideals-production.up.railway.app",
    "localhost:3000",
    "localhost:3001",
  ])

  function hostFromUrl(s: string): string {
    if (!s) return ""
    try { return new URL(s).host.toLowerCase() } catch { return "" }
  }

  const refererAllowed = ALLOWED_HOSTS.has(hostFromUrl(referer))
  const originAllowed = ALLOWED_HOSTS.has(hostFromUrl(origin))

  // Browsers reliably send Referer for fetch() within the same origin, and
  // Origin for cross-origin fetch. CLI/script callers typically send neither
  // and will get the empty response. Same-origin browser callers always pass.
  if (!refererAllowed && !originAllowed) {
    return NextResponse.json({ key: "" }, { status: 200 })
  }

  return NextResponse.json(
    { key },
    {
      headers: {
        "Cache-Control": "private, max-age=3600",
      },
    }
  )
}
