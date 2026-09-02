import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import { Providers } from "@/components/providers"
// import { ExitIntentPopup } from "@/components/exit-intent-popup" // Paused, re-enable when traffic > 100/day
import { SkipLink } from "@/components/skip-link"
import { BottomNav } from "@/components/bottom-nav"
import { PlausiblePageview } from "@/components/plausible-pageview"
import { WeatherBucketInit } from "@/components/weather-bucket-init"
import "./globals.css"
import { stats, statsEncoded } from "@/lib/product-stats"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: `312Deals, ${stats.deals} Chicago Food & Drink Deals | Happy Hours, Specials & More`,
  description:
    `Chicago's largest food & drink deal database. ${stats.deals} verified deals at ${stats.venues} restaurants and bars across ${stats.neighborhoods} neighborhoods. Happy hours, Taco Tuesday, wing nights, brunch specials, and patio deals. Free, updated weekly.`,
  metadataBase: new URL("https://www.312deals.com"),
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || "",
    other: {
      // Bing Webmaster Tools verification, set BING_SITE_VERIFICATION in
      // Vercel env vars after adding the site at https://www.bing.com/webmasters
      "msvalidate.01": process.env.BING_SITE_VERIFICATION || "",
    },
  },
  openGraph: {
    title: `312Deals, ${stats.deals} Chicago Food & Drink Deals`,
    description:
      `Chicago's largest food & drink deal database. ${stats.deals} verified deals at ${stats.venues} restaurants and bars across ${stats.neighborhoods} neighborhoods.`,
    siteName: "312Deals",
    locale: "en_US",
    type: "website",
    images: [{ url: `/api/og?title=Chicago%27s+Best+Food+%26+Drink+Deals&subtitle=${statsEncoded.deals}+deals+across+${statsEncoded.neighborhoods}+neighborhoods`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `312Deals, ${stats.deals} Chicago Food & Drink Deals`,
    description:
      `Chicago's largest food & drink deal database. ${stats.deals} verified deals at ${stats.venues} restaurants and bars across ${stats.neighborhoods} neighborhoods.`,
    images: [`/api/og?title=Chicago%27s+Best+Food+%26+Drink+Deals&subtitle=${statsEncoded.deals}+deals+across+${statsEncoded.neighborhoods}+neighborhoods`],
  },
  alternates: {
    types: {
      "text/markdown": "/llms.txt",
    },
  },
  other: {
    "llms.txt": "https://www.312deals.com/llms.txt",
    "llms-full.txt": "https://www.312deals.com/llms-full.txt",
    "agent-skill": "https://www.312deals.com/skill.md",
    "mcp-server": "https://www.312deals.com/.well-known/mcp.json",
    "webmcp": "https://www.312deals.com/.well-known/webmcp.json",
  },
}

export const viewport: Viewport = {
  themeColor: "#D4940A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Agent-readiness directives, kept first so AFDocs/llms.txt crawlers find them near the top */}
        <link rel="alternate" type="text/markdown" href="/llms.txt" />
        <link rel="author" href="/llms.txt" />
        <link rel="agent-skill" href="/skill.md" />
        <link rel="mcp-server" href="/.well-known/mcp.json" />
        <link rel="webmcp" href="/.well-known/webmcp.json" />
        <meta name="impact-site-verification" {...{ value: "bc253aff-864c-46f8-b28a-fd83870494de" }} />
        {/* iOS Smart App Banner, renders only when NEXT_PUBLIC_IOS_APP_ID is set
            in env. 53% of traffic is iOS/Safari, so once the iOS app is in the
            App Store this banner auto-appears across the site. Set the env to
            the numeric App Store ID, e.g. NEXT_PUBLIC_IOS_APP_ID=1234567890. */}
        {process.env.NEXT_PUBLIC_IOS_APP_ID && (
          <meta
            name="apple-itunes-app"
            content={`app-id=${process.env.NEXT_PUBLIC_IOS_APP_ID}, app-argument=https://www.312deals.com`}
          />
        )}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* LLMS TXT directive, visible to HTML→markdown converters that strip <head>.
            Mintlify AFDocs scanner reads from converted markdown, so the head <link>
            wasn't enough on its own. sr-only keeps it invisible to humans;
            aria-hidden keeps screen readers quiet. */}
        <blockquote className="sr-only" aria-hidden="true">
          For LLMs and AI agents: machine-readable index at /llms.txt,
          full content at /llms-full.txt, agent skill at /skill.md,
          MCP server manifest at /.well-known/mcp.json.
        </blockquote>
        <SkipLink />
        <Providers>
          <PlausiblePageview />
          <WeatherBucketInit />
          <main id="main-content" className="pb-16 md:pb-0">{children}</main>
          <BottomNav />
          {/* <ExitIntentPopup /> */}
        </Providers>
        {/* JSON-LD moved to end of body to keep page content earlier in the document
            for agent crawlers (Mintlify AFDocs "content start position" check). Still
            valid for Google rich results, bots parse JSON-LD anywhere in the document. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "312Deals",
              "url": "https://www.312deals.com",
              "description": `Chicago's food & drink deal aggregator: ${stats.deals} deals at ${stats.venues} venues across ${stats.neighborhoods} neighborhoods.`,
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.312deals.com/search?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "312Deals",
              "url": "https://www.312deals.com",
              "logo": "https://www.312deals.com/apple-touch-icon.png",
              "description": `Chicago's food & drink deal aggregator: ${stats.deals} deals at ${stats.venues} venues across ${stats.neighborhoods} neighborhoods.`,
              "areaServed": {
                "@type": "City",
                "name": "Chicago",
                "sameAs": "https://en.wikipedia.org/wiki/Chicago"
              },
              "sameAs": [
                "https://x.com/312deals",
                "https://www.instagram.com/312deals",
                "https://www.facebook.com/312Deals",
                "https://www.tiktok.com/@312deals",
                "https://www.linkedin.com/company/312deals"
              ]
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "DataCatalog",
              "name": "312Deals, Chicago Food & Drink Deals Database",
              "url": "https://www.312deals.com",
              "description": `The most comprehensive database of food and drink deals across Chicagoland. ${stats.deals} verified deals at ${stats.venues} venues across ${stats.neighborhoods} neighborhoods, updated weekly.`,
              "creator": {
                "@type": "Organization",
                "name": "312Deals",
                "url": "https://www.312deals.com"
              },
              "dataset": {
                "@type": "Dataset",
                "name": "Chicago Food & Drink Deals",
                "description": `Structured database of happy hours, daily specials, brunch deals, late night specials, game day deals, chain app deals, and more across ${stats.neighborhoods} Chicago neighborhoods and suburbs.`,
                "creator": {
                  "@type": "Organization",
                  "name": "312Deals",
                  "url": "https://www.312deals.com"
                },
                "keywords": ["Chicago food deals", "happy hours Chicago", "restaurant specials", "cheap eats Chicago", "bar deals", "brunch deals Chicago"],
                "spatialCoverage": {
                  "@type": "Place",
                  "name": "Chicagoland",
                  "geo": {
                    "@type": "GeoShape",
                    "box": "41.6 -88.3 42.2 -87.5"
                  }
                },
                "temporalCoverage": "2026/..",
                "license": "https://www.312deals.com/terms",
                "distribution": {
                  "@type": "DataDownload",
                  "contentUrl": "https://www.312deals.com/api/v1/deals/search",
                  "encodingFormat": "application/json"
                }
              }
            }),
          }}
        />
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`}
        </Script>
        {/* WebMCP tools registered via React WebMCPProvider (in Providers), standalone /js/webmcp.js available for non-React consumers */}
        <Script
          async
          src="https://plausible.io/js/pa-3EwdO-X_I4cKFYN30Soy7.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init({autoCapturePageviews:false});`}
        </Script>
        <Script
          src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js"
          data-name="BMC-Widget"
          data-cfasync="false"
          data-id="hoynelabs"
          data-description="Support Hoyne Labs!"
          data-message="Love the deals? If you find 312 Deals useful, consider buying us a coffee!"
          data-color="#FF5F5F"
          data-position="Right"
          data-x_margin="18"
          data-y_margin="18"
          strategy="lazyOnload"
        />
      </body>
    </html>
  )
}
