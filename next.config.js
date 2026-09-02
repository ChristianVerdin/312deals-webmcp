/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Gate deploys on TypeScript errors (backlog cleared 2026-07-06). Keep this false.
    ignoreBuildErrors: false,
  },
  eslint: {
    // ESLint is not configured in this repo yet, so there is nothing to gate on.
    // Leave true until ESLint is set up + its backlog triaged (separate task).
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/guides/march-madness-chicago',
        destination: '/guides/college-bars-chicago',
        permanent: true,
      },
      {
        source: '/guides/cubs-opening-day-chicago',
        destination: '/guides/cubs-game-day-chicago',
        permanent: true,
      },
      {
        // Removed 2026-05-06 — page was promoting competitor tools (Yelp, OpenTable,
        // Reddit, etc.) on our own site. Internal analysis preserved at
        // docs/strategy/competitive-analysis-deal-finders.md.
        source: '/guides/find-chicago-deals',
        destination: '/guides/chicago-food-deals',
        permanent: true,
      },
      {
        // Mother's Day 2026 retrospective lives in the blog (May 11). Old guide
        // was never indexed by Google — moved to match the cubs-opening-day pattern.
        source: '/guides/mothers-day-chicago',
        destination: '/blog/mothers-day-chicago-2026',
        permanent: true,
      },
      {
        // Thin generic post consolidated into the Bears game-day guide (Aug 2026)
        // — it targeted exactly the guide's head query ("where to watch the bears").
        // The venue-specific listicle best-bears-bars-chicago stays.
        source: '/blog/where-to-watch-the-bears-chicago',
        destination: '/guides/bears-game-day-chicago',
        permanent: true,
      },
      // Legacy "mt-prospect" slug (GSC was crawling 404s; DB slug is mount-prospect).
      {
        source: '/neighborhoods/mt-prospect/:path*',
        destination: '/neighborhoods/mount-prospect/:path*',
        permanent: true,
      },
      {
        source: '/happy-hours/mt-prospect',
        destination: '/happy-hours/mount-prospect',
        permanent: true,
      },
      // B2B advertising aliases — all funnel to the /advertise hub.
      { source: '/promote', destination: '/advertise', permanent: false },
      { source: '/sponsor', destination: '/advertise', permanent: false },
      { source: '/advertise-with-us', destination: '/advertise', permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.API_URL
          ? `${process.env.API_URL}/api/v1/:path*`
          : 'http://localhost:8000/api/v1/:path*',
      },
      {
        source: '/.well-known/webmcp.json',
        destination: process.env.API_URL
          ? `${process.env.API_URL}/.well-known/webmcp.json`
          : 'http://localhost:8000/.well-known/webmcp.json',
      },
      // Markdown URL siblings — Phase 3 of AEO/GEO lift plan.
      // Rewrites are evaluated BEFORE Next.js page routing, so this
      // cleanly maps /about.md → /api/markdown?path=about without
      // conflicting with existing /about/page.tsx. Excludes /api,
      // /_next, and llms*.txt by virtue of those being more-specific
      // routes that match first.
      {
        source: '/:path*.md',
        destination: '/api/markdown?path=:path*',
      },
    ];
  },
  async headers() {
    return [
      // Improve TTFB for ISR pages — allow CDN/browser to serve stale while revalidating
      {
        source: '/venues/:slug*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/crawl',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Signal',
            value: 'ai-train=yes, search=yes, ai-input=yes',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            // NOTE: 'unsafe-inline' is required for Next.js inline scripts and styled-jsx.
            // Switching to nonce-based CSP requires custom middleware and is a future improvement.
            // 'unsafe-eval' removed — not needed in production.
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io https://maps.googleapis.com https://cdnjs.buymeacoffee.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://plausible.io https://maps.googleapis.com https://chideals-production.up.railway.app https://api.open-meteo.com; frame-src 'self' https://maps.googleapis.com;",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
    formats: ['image/avif', 'image/webp'],
    // Cache the optimized image for 30 days. The Image Optimizer was
    // round-tripping back to /api/photos every 7 days, which round-tripped
    // back to Google Places Photo (paid SKU) on every miss.
    minimumCacheTTL: 2592000, // 30 days
    // Restrict responsive widths. Next.js default is 8 device sizes (640/750/828/1080/1200/1920/2048/3840).
    // Every distinct width = a separate cache entry = potential separate Google call.
    // Venue cards display at ~400px and full-bleed images at ~1024px max, so 2 is enough.
    deviceSizes: [640, 1080],
    imageSizes: [256, 384],
  },
  experimental: {
    esmExternals: true,
  },
};

module.exports = nextConfig;
