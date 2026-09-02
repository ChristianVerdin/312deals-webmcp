import type { MetadataRoute } from "next"

// AI crawlers are explicitly allowed for content discovery (agent-readiness strategy)
// but disallowed on expensive image-proxy routes that round-trip to Google Places.
// Background: 2026-05-14, Meta-ExternalAgent hit /api/photos 3,600 times in 40min,
// each request a unique cache key → fresh Google Places Photo SKU calls (~$25).
// /chat added 2026-06-10: every venue page links /chat?q=... which auto-submits a
// paid Claude call on load, JS-rendering crawlers were generating ~$1.30/day of
// non-human Anthropic spend (13,000 crawlable unique-query URLs). Agents should
// use the API/MCP, not the chat UI.
const AI_DISALLOWED_PATHS = ["/api/photos", "/api/og", "/chat"]

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "anthropic-ai",
  "Amazonbot",
  "Google-Extended",
  "Googlebot-Extended",
  "Applebot-Extended",
  "Bytespider",
  "cohere-ai",
  "YouBot",
  "Meta-ExternalAgent",
  "FacebookBot",
  "facebookexternalhit",
  "CCBot",
  "Timpibot",
  "Diffbot",
  "ImagesiftBot",
  "Omgili",
  "Omgilibot",
  "DuckAssistBot",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default: allow everything except /chat (auto-submits a paid Claude call per load)
      { userAgent: "*", allow: "/", disallow: ["/chat"] },
      // AI bots: allow content discovery but block the paid-API proxy routes
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: AI_DISALLOWED_PATHS,
      })),
    ],
    sitemap: [
      "https://www.312deals.com/sitemap.xml",
      "https://www.312deals.com/sitemap/0.xml",
    ],
  }
}
