/**
 * Accept-header content negotiation middleware.
 *
 * Mintlify's AFDocs "Content Negotiation" check is binary: if a server
 * doesn't return text/markdown when the client sends `Accept: text/markdown`,
 * the check scores 0. The .md URL siblings (Phase 3) cover the case where
 * agents append `.md` themselves; this middleware covers autonomous agents
 * that respect HTTP content negotiation (Claude Code, Cursor, OpenCode).
 *
 * How it works:
 *   1. Match GET requests only.
 *   2. Skip everything that should never be markdown:
 *      - /api/* (the markdown handler itself + all other API)
 *      - /_next/* (Next.js internals)
 *      - /.well-known/* (manifests + verification files)
 *      - /admin/* (auth-gated)
 *      - Any path ending in a non-HTML file extension
 *      - Specific routes that are client-only or interactive (search, map, chat)
 *   3. Check Accept header for `text/markdown` substring.
 *   4. If matched: rewrite to /api/markdown?path=<original-path>.
 *   5. Always set `Vary: Accept` so Vercel caches HTML and markdown variants
 *      separately under the same URL.
 *
 * Risk register (validated against the AEO/GEO plan):
 *   - Vercel CDN cache: `Vary: Accept` is set; HTML and markdown variants
 *     cache independently under the same path.
 *   - ISR conflict: rewrite goes to /api/markdown (a route handler with
 *     its own cache headers), bypassing the ISR cache for the original page.
 *   - PWA service worker: sw.js fetches don't include Accept: text/markdown,
 *     so the middleware doesn't trigger on those paths.
 *   - Plausible: browsers don't send Accept: text/markdown, so client-side
 *     pageview tracking is unaffected.
 *   - Sitemap / robots / llms*.txt: skipped by the .txt suffix rule.
 *
 * Phase 6.6 of the AEO/GEO lift plan.
 */
import { NextRequest, NextResponse } from "next/server"

const SKIP_PREFIXES = [
  "/api/",
  "/_next/",
  "/.well-known/",
  "/admin/",
]

const SKIP_EXACT = new Set([
  "/sw.js",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
  "/llms-index.txt",
  "/llms-venues.txt",
  "/llms-deals.txt",
  "/llms-neighborhoods.txt",
  "/llms-cuisines.txt",
  "/llms-guides.txt",
  "/skill.md",
  "/ai.txt",
  "/openapi-gpt.json",
  // Auth-gated or client-interactive only
  "/saved",
  "/submit",
  "/chat",
  "/map",
  "/search",
])

const SKIP_SUFFIXES = [
  ".txt", ".xml", ".json", ".js", ".css",
  ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".gif",
  ".woff", ".woff2", ".ttf", ".otf",
  ".mp4", ".webm", ".mp3",
  ".pdf",
  ".md",  // Already markdown, don't rewrite, route handler serves it
]

export function middleware(req: NextRequest) {
  // Only intercept GETs.
  if (req.method !== "GET") return NextResponse.next()

  const path = req.nextUrl.pathname

  // Skip excluded prefixes.
  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) return NextResponse.next()

  // Skip excluded exact paths.
  if (SKIP_EXACT.has(path)) return NextResponse.next()

  // Skip non-HTML file extensions.
  if (SKIP_SUFFIXES.some((s) => path.endsWith(s))) return NextResponse.next()

  // Check Accept header for explicit text/markdown request.
  // Don't match `text/*` wildcards, browsers commonly send
  // `text/html,application/xhtml+xml,...` and we should serve HTML to them.
  const accept = req.headers.get("accept") ?? ""
  if (!accept.toLowerCase().includes("text/markdown")) {
    return NextResponse.next()
  }

  // Rewrite to the markdown handler. Pass the original path as a query param
  // so the handler can dispatch to the right adapter.
  const url = req.nextUrl.clone()
  url.pathname = "/api/markdown"
  url.searchParams.set("path", path.startsWith("/") ? path.slice(1) : path)

  const res = NextResponse.rewrite(url)
  // Critical: tell CDNs that this URL has multiple representations keyed
  // on Accept. Without this, the first response (HTML or markdown) gets
  // cached and served to everyone regardless of their Accept header.
  res.headers.set("Vary", "Accept")
  return res
}

export const config = {
  // Run the middleware on everything except Next.js internals + favicon.
  // The function handles the rest of the deny-list via SKIP_PREFIXES /
  // SKIP_EXACT / SKIP_SUFFIXES. Keeping the matcher simple avoids
  // negative-lookahead regex pitfalls in Next.js Edge runtime that can
  // silently disable the middleware.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
