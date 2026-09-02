import { NextRequest, NextResponse } from "next/server"

/**
 * Server-side proxy for Google Places photos.
 *
 * Accepts: /api/photos?ref=places/PLACE_ID/photos/PHOTO_REF/media&maxHeightPx=400&maxWidthPx=600
 * Fetches from Google Places API with the key added server-side,
 * then streams the image back. The API key never reaches the client.
 *
 * If the stored photo reference has expired (400 from Google), automatically
 * fetches a fresh photo reference using the place ID embedded in the ref path.
 *
 * Caching: CDN-cached for 7 days, stale-while-revalidate for 30 days.
 */

const ALLOWED_REF_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+\/media$/

// AI crawlers must NOT hit this route, each unique ref is a paid Google Places Photo
// call ($0.007 each). Robots.txt already disallows /api/photos for these UAs; this is
// belt-and-suspenders for crawlers that ignore robots.txt. 2026-05-14: Meta-ExternalAgent
// alone billed ~$25 of photo calls in 40 minutes before we added these guards.
const AI_BOT_UA_PATTERN = /\b(GPTBot|ChatGPT-User|OAI-SearchBot|PerplexityBot|Perplexity-User|ClaudeBot|Claude-SearchBot|anthropic-ai|Amazonbot|Google-Extended|Bytespider|cohere-ai|YouBot|Meta-ExternalAgent|FacebookBot|facebookexternalhit|CCBot|Timpibot|Diffbot|ImagesiftBot|Omgili|Omgilibot|DuckAssistBot|Applebot-Extended)\b/i

function getApiKey(): string {
  return (
    process.env.GOOGLE_PLACES_API_KEY_SERVER ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  )
}

/** Extract the place ID from a ref like "places/ChIJ.../photos/.../media" */
function extractPlaceId(ref: string): string | null {
  const match = ref.match(/^places\/([A-Za-z0-9_-]+)\//)
  return match ? match[1] : null
}

/** Fetch a fresh photo reference from Google Places API for a given place ID */
async function getFreshPhotoRef(
  placeId: string,
  apiKey: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?key=${apiKey}`,
      {
        headers: { "X-Goog-FieldMask": "photos" },
        next: { revalidate: 86400 }, // cache place lookup for 1 day
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const photos = data.photos
    if (!Array.isArray(photos) || photos.length === 0) return null
    // name is like "places/ChIJ.../photos/NEWREF/media", but without /media
    const name: string = photos[0].name
    return name.endsWith("/media") ? name : `${name}/media`
  } catch {
    return null
  }
}

/** Fetch the actual image bytes from Google Places Photo API */
async function fetchPhoto(
  ref: string,
  maxHeight: string,
  maxWidth: string,
  apiKey: string
): Promise<Response> {
  const googleUrl = `https://places.googleapis.com/v1/${ref}?maxHeightPx=${encodeURIComponent(maxHeight)}&maxWidthPx=${encodeURIComponent(maxWidth)}&key=${apiKey}`
  return fetch(googleUrl, {
    redirect: "follow",
    next: { revalidate: 604800 }, // 7 days
  })
}

const IMAGE_HEADERS = {
  "Cache-Control":
    "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000",
  "CDN-Cache-Control": "public, max-age=604800",
} as const

// 1×1 transparent PNG. This route ALWAYS returns a valid image with HTTP 200
// never a 4xx/5xx. Failures (Google rate-limit/429 when the daily GCP cap is hit,
// timeouts, bad refs, blocked crawlers) return this pixel instead of an error.
// Why: recurring Vercel "5xx on /api/photos" alerts + image-optimizer 502s were
// caused by this route returning 429/502 when crawlers (GPTBot/FacebookBot/Meta)
// hammered it past the cap. A 200 pixel = no alert, no optimizer cascade, no
// Google cost, and a graceful blank instead of a broken image. `maxAge` is short
// on transient failures so real photos return once the cap window resets.
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
)

function pixel(maxAge: number): NextResponse {
  return new NextResponse(TRANSPARENT_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      "CDN-Cache-Control": `public, max-age=${maxAge}`,
    },
  })
}

export async function GET(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || ""
  // Crawlers: cheap, silent, cached blank pixel (no Google call, no error/alert).
  if (AI_BOT_UA_PATTERN.test(userAgent)) {
    return pixel(86400)
  }

  const { searchParams } = request.nextUrl
  const ref = searchParams.get("ref")
  const maxHeight = searchParams.get("maxHeightPx") || "400"
  const maxWidth = searchParams.get("maxWidthPx") || "600"

  // Bad/garbage ref (won't become valid) → cached pixel.
  if (!ref || !ALLOWED_REF_PATTERN.test(ref)) {
    return pixel(86400)
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    return pixel(300)
  }

  try {
    // Attempt with the stored photo reference
    let response = await fetchPhoto(ref, maxHeight, maxWidth, apiKey)

    // If expired/invalid (400), try fetching a fresh photo reference
    if (response.status === 400) {
      const placeId = extractPlaceId(ref)
      if (placeId) {
        const freshRef = await getFreshPhotoRef(placeId, apiKey)
        if (freshRef) {
          response = await fetchPhoto(freshRef, maxHeight, maxWidth, apiKey)
        }
      }
    }

    // Google failed (429 = daily cap hit, 403, 5xx, etc.) → short-cached pixel so
    // real photos resume after the cap/transient clears. Never surface a 5xx.
    if (!response.ok) {
      return pixel(response.status === 404 ? 86400 : 900)
    }

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...IMAGE_HEADERS,
      },
    })
  } catch {
    return pixel(300)
  }
}
