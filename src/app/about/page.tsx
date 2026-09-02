import type { Metadata } from "next"
import Link from "next/link"
import { MapPin, RefreshCw, Users, Mail, Globe, Shield, Newspaper, Heart, Search, Beer } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { stats, statsEncoded } from "@/lib/product-stats"

export const metadata: Metadata = {
  title: "About 312Deals, Chicago's Most Comprehensive Food & Drink Deal Finder",
  description:
    `312Deals is a free database of ${stats.deals} food & drink deals at ${stats.venues} venues across Chicago and 60+ suburbs. Learn how we keep every deal fresh and accurate.`,
  alternates: { canonical: "https://www.312deals.com/about" },
  openGraph: {
    title: "About 312Deals, Chicago's Most Comprehensive Food & Drink Deal Finder",
    description: `Free database of ${stats.deals} food & drink deals across Chicago and 60+ suburbs. Learn how we keep every deal fresh.`,
    url: "https://www.312deals.com/about",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: `https://www.312deals.com/api/og?title=About+312Deals&subtitle=${statsEncoded.deals}+deals+across+${statsEncoded.neighborhoods}+neighborhoods`,
      width: 1200,
      height: 630,
      alt: "About 312Deals, Chicago's food & drink deal finder",
    }],
  },
}

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "AboutPage",
                "name": "About 312Deals",
                "url": "https://www.312deals.com/about",
                "description": "312Deals is a free database of food and drink deals across Chicagoland.",
                "publisher": {
                  "@type": "Organization",
                  "name": "312Deals",
                  "url": "https://www.312deals.com",
                  "sameAs": [
                    "https://x.com/312deals",
                    "https://www.instagram.com/312deals",
                    "https://www.facebook.com/312Deals",
                    "https://www.tiktok.com/@312deals",
                  ],
                },
                "datePublished": "2026-02-01",
                "dateModified": "2026-06-30",
              }),
            }}
          />
          <h1 className="text-3xl font-bold text-foreground">About 312Deals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated June 2026
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            312Deals is a free, comprehensive database of food and drink deals
            across all of Chicagoland. We track happy hours, daily specials, brunch
            offers, late-night menus, game day deals, seasonal promotions, and more
            at {stats.venues} venues across Chicago and 60+ suburbs, from{" "}
            <Link href="/neighborhoods/river-north" className="text-brand-500 hover:underline">River North</Link> and{" "}
            <Link href="/neighborhoods/wicker-park" className="text-brand-500 hover:underline">Wicker Park</Link> to{" "}
            <Link href="/neighborhoods/naperville" className="text-brand-500 hover:underline">Naperville</Link> and{" "}
            <Link href="/neighborhoods/evanston" className="text-brand-500 hover:underline">Evanston</Link>.
          </p>

          {/* Stats bar */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-brand-500">{stats.deals}</p>
              <p className="mt-1 text-xs text-muted-foreground">Active deals</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-brand-500">{stats.venues}</p>
              <p className="mt-1 text-xs text-muted-foreground">Venues tracked</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-brand-500">{stats.neighborhoods}</p>
              <p className="mt-1 text-xs text-muted-foreground">Neighborhoods</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-brand-500">13</p>
              <p className="mt-1 text-xs text-muted-foreground">Deal types</p>
            </div>
          </div>

          {/* Mission statement */}
          <div className="mt-10 rounded-2xl border border-brand-500/20 bg-brand-50/50 p-8 text-center dark:bg-brand-950/10">
            <p className="text-xl font-semibold italic text-foreground">
              &ldquo;Never let a good deal go unnoticed.&rdquo;
            </p>
            <p className="mt-3 text-muted-foreground">
              Our mission is to make every food and drink deal in Chicagoland
              discoverable, whether it&apos;s a $3 draft in{" "}
              <Link href="/neighborhoods/lincoln-square" className="text-brand-500 hover:underline">Lincoln Square</Link> or a
              bottomless brunch in{" "}
              <Link href="/neighborhoods/naperville" className="text-brand-500 hover:underline">Naperville</Link>.
            </p>
          </div>

          <h2 className="mt-10 text-xl font-semibold text-foreground">Why we built this</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Every previous Chicago deal platform died because manual curation
            couldn&apos;t keep up with thousands of restaurants changing their
            specials. Menus rotate, happy hours shift, seasonal deals come and
            go. By the time someone catalogued everything, half the data was
            already stale.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We built a system that keeps up. Deals get structured, categorized,
            and re-verified on a weekly cadence. The result is a database that
            stays current without sacrificing coverage or quality.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            312Deals also covers the suburbs, not as an afterthought, but as
            equals.{" "}
            <Link href="/neighborhoods/oak-park" className="text-brand-500 hover:underline">Oak Park</Link>,{" "}
            <Link href="/neighborhoods/naperville" className="text-brand-500 hover:underline">Naperville</Link>,{" "}
            <Link href="/neighborhoods/evanston" className="text-brand-500 hover:underline">Evanston</Link>,{" "}
            <Link href="/neighborhoods/schaumburg" className="text-brand-500 hover:underline">Schaumburg</Link>, Elmhurst, and more
            are all part of the Chicagoland deal landscape. If there&apos;s a happy hour
            worth knowing about, we want it in the database.
          </p>

          {/* Why 312Deals value props */}
          <h2 className="mt-10 text-xl font-semibold text-foreground">Why 312Deals?</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <RefreshCw className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Always Current</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Deals are re-verified weekly across thousands of sources. Anything
                stale gets flagged and removed.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <MapPin className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Truly Comprehensive</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {stats.neighborhoods} neighborhoods, 52 Chicago city + 60+ active suburbs. City and suburbs equally. If there&apos;s a deal
                worth knowing about anywhere in Chicagoland, we want it here.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Shield className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Free for Everyone</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Free to use, always.
              </p>
            </div>
          </div>

          <h2 className="mt-10 text-xl font-semibold text-foreground">How it stays fresh</h2>
          <p className="mt-3 mb-4 leading-relaxed text-muted-foreground">
            Our system combines automated scanning and community feedback
            to keep {stats.deals} deals accurate and up to date:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <Search className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Structured &amp; searchable</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Every deal is captured with the details that matter, prices, times,
                days, items, and indexed into a fast, searchable database.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <RefreshCw className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Weekly verification</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Every week our system re-checks venues, compares against stored
                data, detects changes, and flags stale deals for review.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Users className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Community verified</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Anyone can report outdated deals or confirm active ones. Your
                feedback helps keep the database accurate and surfaces the best
                deals faster.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Shield className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Quality scoring</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Every deal gets a quality score (0–100) based on completeness of
                pricing, hours, days, and description. Higher-quality deals rank
                higher in search.
              </p>
            </div>
          </div>

          <h2 className="mt-10 text-xl font-semibold text-foreground">What you can find</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            312Deals covers 13 deal types across every category of food and drink savings:
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              "Happy hours",
              "Daily specials",
              "Brunch deals",
              "Late night",
              "Game day",
              "Taco Tuesday",
              "Wing deals",
              "Pizza deals",
              "Seasonal / LTO",
              "Chain app deals",
              "Loyalty programs",
              "Kids eat free",
              "BOGO offers",
            ].map((type) => (
              <div key={type} className="rounded-lg border border-border bg-card/50 px-3 py-2 text-sm text-muted-foreground">
                {type}
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-xl font-semibold text-foreground">Ways to use 312Deals</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Find deals however works best for you:
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <Globe className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Website &amp; mobile</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Search by neighborhood, day, cuisine, deal type, or keyword.
                Interactive map to find deals near you. Works on any device.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Beer className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Bar crawl planner</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Plan a deals-optimized bar crawl route through any neighborhood.
                Pick your area, group size, and we map out the best stops.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Heart className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Save &amp; share</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Save your favorite deals for later. Share them with friends.
                Build your own list of go-to spots around the city.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Mail className="mb-2 h-5 w-5 text-brand-500" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Weekly newsletter</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The Deal Sheet drops every Thursday with the 5 best deals of the
                week, curated picks from city and suburbs.
              </p>
            </div>
          </div>

          {/* About the project */}
          <h2 className="mt-10 text-xl font-semibold text-foreground">About the project</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            312Deals is an independent, bootstrapped Chicago project. No VC funding,
            no corporate parent. Built in 2026 and run solo.
          </p>

          {/* Press & Media */}
          <h2 className="mt-10 text-xl font-semibold text-foreground">Press &amp; Media</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            For press inquiries, interviews, or partnership opportunities,
            reach out at{" "}
            <a
              href="mailto:deals@312deals.com"
              className="font-medium text-brand-500 hover:underline"
            >
              deals@312deals.com
            </a>.
          </p>
          <div className="mt-4 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Featured coverage will appear here as 312Deals grows.
            </p>
          </div>

          <h2 className="mt-10 text-xl font-semibold text-foreground">Follow 312Deals</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://x.com/312deals"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-brand-300 hover:bg-accent"
            >
              X / Twitter
            </a>
            <a
              href="https://www.instagram.com/312deals"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-brand-300 hover:bg-accent"
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/312Deals"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-brand-300 hover:bg-accent"
            >
              Facebook
            </a>
            <a
              href="https://www.tiktok.com/@312deals"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-brand-300 hover:bg-accent"
            >
              TikTok
            </a>
          </div>

          <h2 className="mt-10 text-xl font-semibold text-foreground">Get in touch</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Have a question, feedback, or a deal to share? Reach out at{" "}
            <a href="mailto:deals@312deals.com" className="font-medium text-brand-500 hover:underline">
              deals@312deals.com
            </a>{" "}
            or{" "}
            <Link href="/submit" className="font-medium text-brand-500 hover:underline">
              submit a deal
            </Link>{" "}
            directly. We read every message and typically respond within 24 hours.
          </p>

          <h2 className="mt-10 text-xl font-semibold text-foreground">Explore 312Deals</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/search"
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <span className="text-sm font-semibold text-foreground">Search Deals</span>
              <p className="mt-1 text-xs text-muted-foreground">Browse {stats.deals} deals by neighborhood, day, cuisine, or keyword.</p>
            </Link>
            <Link
              href="/map"
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <span className="text-sm font-semibold text-foreground">Interactive Deal Map</span>
              <p className="mt-1 text-xs text-muted-foreground">Color-coded pins by deal type. Filter, explore, find deals near you.</p>
            </Link>
            <Link
              href="/guides/chicago-happy-hours"
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <span className="text-sm font-semibold text-foreground">Chicago Happy Hour Guide</span>
              <p className="mt-1 text-xs text-muted-foreground">Our definitive guide to the best happy hours across Chicago.</p>
            </Link>
            <Link
              href="/crawl"
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <span className="text-sm font-semibold text-foreground">Bar Crawl Planner</span>
              <p className="mt-1 text-xs text-muted-foreground">Plan a deals-optimized bar crawl route through any neighborhood.</p>
            </Link>
            <Link
              href="/neighborhoods"
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <span className="text-sm font-semibold text-foreground">Browse Neighborhoods</span>
              <p className="mt-1 text-xs text-muted-foreground">Explore deals across Chicago and 60+ suburbs.</p>
            </Link>
            <Link
              href="/blog"
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <span className="text-sm font-semibold text-foreground">Blog</span>
              <p className="mt-1 text-xs text-muted-foreground">Game day bars, date night spots, hidden gems, and curated guides.</p>
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Link
              href="/contact"
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Contact us
            </Link>
            <Link
              href="/faq"
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              FAQ
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
