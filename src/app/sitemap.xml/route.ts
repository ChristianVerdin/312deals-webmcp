import { NextResponse } from "next/server"
import { generateSitemaps } from "../sitemap"

const SITE_URL = "https://www.312deals.com"

/**
 * Explicit sitemap index at /sitemap.xml.
 *
 * Next.js 14's generateSitemaps() should auto-generate this, but it returns
 * 404 in production. This route handler creates the sitemap index XML manually,
 * pointing to /sitemap/0.xml through /sitemap/N.xml.
 */
export async function GET() {
  const sitemaps = await generateSitemaps()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map((s) => `  <sitemap><loc>${SITE_URL}/sitemap/${s.id}.xml</loc></sitemap>`).join("\n")}
</sitemapindex>`

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
