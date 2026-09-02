import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a Google Places photo URL to a proxied URL that hides the API key.
 *
 * Input:  https://places.googleapis.com/v1/places/PLACE_ID/photos/PHOTO_REF/media?maxHeightPx=400&maxWidthPx=600&key=AIzaSy...
 * Output: /api/photos?ref=places/PLACE_ID/photos/PHOTO_REF/media&maxHeightPx=400&maxWidthPx=600
 *
 * Non-Google-Places URLs are returned unchanged.
 */
export function proxyPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "places.googleapis.com") return url

    // Extract the path after /v1/, e.g. "places/PLACE_ID/photos/PHOTO_REF/media"
    const pathMatch = parsed.pathname.match(/^\/v1\/(.+)$/)
    if (!pathMatch) return url

    const ref = pathMatch[1]
    const maxHeight = parsed.searchParams.get("maxHeightPx") || "400"
    const maxWidth = parsed.searchParams.get("maxWidthPx") || "600"

    return `/api/photos?ref=${encodeURIComponent(ref)}&maxHeightPx=${maxHeight}&maxWidthPx=${maxWidth}`
  } catch {
    return url
  }
}
