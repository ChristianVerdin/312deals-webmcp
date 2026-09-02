/**
 * Markdown URL handler, serves .md siblings of every public page.
 *
 * Wired via next.config.js rewrite:
 *   /:path*.md  →  /api/markdown?path=:path*
 *
 * The rewrite approach (vs a [[...mdpath]] catch-all at root) avoids
 * Next.js routing conflicts where existing static pages like /about/page.tsx
 * would shadow /about.md. Rewrites are evaluated BEFORE page-level routing,
 * so /about.md cleanly maps to /api/markdown?path=about and dispatches.
 *
 * Phase 3 of AEO/GEO lift plan. Fixes Mintlify AFDocs:
 *   - Markdown URL Support
 *   - Content Negotiation
 *   - LLMS TXT Links Markdown
 *   - Markdown Content Parity
 */
import { NextRequest, NextResponse } from "next/server"
import { dispatch } from "@/lib/markdown-adapters"

export const revalidate = 3600

// Prepended to every .md body so agents discover the full index (AFDocs
// "LLMS TXT Directive MD" check). HTML pages carry the same directive via layout.
const DIRECTIVE =
  "> ## Documentation Index\n" +
  "> For the complete machine-readable index of 312Deals, see " +
  "[llms.txt](https://www.312deals.com/llms.txt).\n" +
  "> Use it to discover all available pages before exploring further.\n\n"

export async function GET(req: NextRequest) {
  const pathParam = req.nextUrl.searchParams.get("path")

  // No path, likely a misrouted request. 404 quietly.
  if (!pathParam) {
    return new NextResponse("Not Found", { status: 404 })
  }

  // Rewrite preserves "/" between path segments, so pathParam is like
  // "venues/avec" or "neighborhoods/wicker-park" or "about".
  const realPath = pathParam.startsWith("/") ? pathParam : `/${pathParam}`

  const md = await dispatch(realPath)

  if (md == null) {
    return new NextResponse("Not Found", { status: 404 })
  }

  return new NextResponse(DIRECTIVE + md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      // Don't index .md siblings as duplicates in Google SERPs;
      // they exist for AI crawlers + AFDocs scanners.
      "X-Robots-Tag": "noindex",
    },
  })
}
