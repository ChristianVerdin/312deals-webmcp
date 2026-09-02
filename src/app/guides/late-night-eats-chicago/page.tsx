import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Moon, Clock, Beer } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getLateNightDeals(): Promise<Deal[]> {
  const queries = ["late night", "after hours", "late-night", "midnight", "open late", "after 10pm", "2am"]
  const all = new Map<number, Deal>()
  await Promise.all(
    queries.map(async (q) => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/deals/search?q=${encodeURIComponent(q)}&limit=200`,
          { next: { revalidate: 3600 } }
        )
        if (!res.ok) return
        const data: SearchResponse = await res.json()
        for (const d of data.deals ?? []) if (!all.has(d.id)) all.set(d.id, d)
      } catch {
        // ignore
      }
    })
  )
  return Array.from(all.values())
}

function isLateNightDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return (
    d.deal_type === "late_night" ||
    /late[\s-]?night|after[\s-]?hours|after\s*1[01]|midnight|open\s*late|til+\s*2|2\s*am|1\s*am|11pm|after\s*10/.test(text)
  )
}

export const metadata: Metadata = {
  // Retitled 2026-09-02 off the page's own GSC cluster: 14 queries, 1,221
  // impressions, positions 6.6-9.9, ZERO clicks, and no other page of ours
  // ranks for any of them. Token share of that cluster: "food" 70.2%,
  // "late night" 61.4%, "open late" 38.6%, "restaurants" 15.1%, "eats"
  // 14.7% -- and "midnight" 0%, "drink" 0%, "tonight" 0%. The old title led
  // on exactly the terms nobody searches. Dropped the year too: no query in
  // the cluster contains 2026.
  title: "Late Night Food Chicago, Restaurants & Bars Open Late",
  description:
    "Late night food in Chicago: restaurants and bars open late, kitchens serving past midnight, and after-hours deals by neighborhood from River North to Logan Square.",
  openGraph: {
    title: "Late Night Food Chicago, Open Late | 312Deals",
    description:
      "Restaurants and bars open late across Chicago, mapped by neighborhood. River North to Logan Square.",
    url: `${SITE_URL}/guides/late-night-eats-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Late+Night+Food+Chicago&subtitle=Restaurants+%26+bars+open+late&emoji=%F0%9F%8C%AE&badges=Open+past+midnight%2CBy+neighborhood&v=2`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Late Night Food Chicago, Open Late | 312Deals",
    description: "Restaurants and bars open late across Chicago, with after-hours deals by neighborhood.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/late-night-eats-chicago`,
  },
}

export default async function LateNightGuide() {
  const allDeals = await getLateNightDeals()
  const lateDeals = allDeals.filter(isLateNightDeal)

  const totalDeals = lateDeals.length
  const uniqueVenues = new Set(lateDeals.map((d) => d.venue_name)).size

  // Group by neighborhood
  const byHood = new Map<string, { name: string; slug: string; deals: Deal[] }>()
  for (const d of lateDeals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = byHood.get(d.neighborhood_slug)
      if (existing) existing.deals.push(d)
      else byHood.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, deals: [d] })
    }
  }
  const neighborhoods = Array.from(byHood.values()).sort((a, b) => b.deals.length - a.deals.length)

  const faqItems = [
    {
      q: "Where can I eat late at night in Chicago?",
      a:
        totalDeals > 0
          ? `We're tracking ${totalDeals} late-night food and drink deals across ${uniqueVenues} Chicago venues. ${neighborhoods.slice(0, 3).map((n) => `${n.name} (${n.deals.length})`).join(", ")} lead the list. The densest late-night corridors are River North, Wrigleyville, Logan Square, and West Town / Wicker Park, where kitchens routinely run past midnight.`
          : "The densest late-night corridors are River North, Wrigleyville, Logan Square, and West Town / Wicker Park, kitchens there routinely run past midnight, and the bars hold standard 2am licenses (some 4am on weekends). Check back as we surface more after-hours specials.",
    },
    {
      q: "What bars are open until 2am or 4am in Chicago?",
      a: "Most Chicago bars hold a 2am license (3am Saturdays). A smaller set carries a late-hour license good until 4am (5am Saturdays), concentrated in River North, Wrigleyville, and the West Town / Wicker Park nightlife strips. Kitchen hours are usually shorter than bar hours, so confirm the late-night menu cutoff before you go.",
    },
    {
      q: "Are there late-night food deals and happy hours in Chicago?",
      a: "Yes, beyond the classic early happy hour, plenty of spots run a 'reverse' or late-night happy hour (often after 9 or 10pm) plus after-bar food specials. Wrigleyville runs post-game late deals on Cubs home dates; Logan Square and West Town lean on the bar-and-kitchen-till-late model.",
    },
    {
      q: "Which Chicago neighborhoods are best for late-night eats?",
      a: "Wrigleyville for post-game and bar-crowd volume, River North for downtown late dining, Logan Square and West Town / Wicker Park for the kitchen-open-late bar scene, and Lakeview / Lincoln Park for the after-11 college and young-professional crowd.",
    },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <article className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
          {/* JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: SITE_URL },
                  { name: "Guides", url: `${SITE_URL}/guides` },
                  { name: "Late Night Food Chicago", url: `${SITE_URL}/guides/late-night-eats-chicago` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
          />
          {lateDeals.length > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(
                  buildItemListJsonLd(
                    "Late Night Food Chicago, Restaurants & Bars Open Late",
                    `${SITE_URL}/guides/late-night-eats-chicago`,
                    lateDeals
                  )
                ),
              }}
            />
          )}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "Late Night Food Chicago, Restaurants & Bars Open Late",
                description: `${totalDeals} late-night food and drink deals across ${uniqueVenues} Chicago venues, kitchens open past midnight, 2am bars, and after-hours specials by neighborhood.`,
                url: `${SITE_URL}/guides/late-night-eats-chicago`,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/late-night-eats-chicago`,
                },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
                },
                image: `${SITE_URL}/api/og?title=Late+Night+Eats+Chicago&subtitle=Kitchens+open+past+midnight&emoji=%F0%9F%8C%AE&badges=Open+past+midnight%2CBy+neighborhood&v=2`,
                datePublished: "2026-05-27",
                dateModified: new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
              <span>/</span>
              <Link href="/guides" className="transition-colors hover:text-foreground">Guides</Link>
              <span>/</span>
              <span className="text-foreground">Late Night Food Chicago</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Late Night Food in Chicago, Restaurants &amp; Bars Open Late
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              When the kitchen at most places has closed, Chicago&apos;s late-night corridors are just getting going.
              {totalDeals > 0
                ? ` ${totalDeals} late-night food and drink deals are live across ${uniqueVenues} venues right now`
                : " We track late-night kitchens, 2am bars, and after-hours specials"}
              {" "}, concentrated in River North, Wrigleyville, Logan Square, and West Town. Here&apos;s where to land after 11.
            </p>
          </header>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Moon className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{totalDeals > 0 ? totalDeals : "Live"}</div>
              <div className="text-xs text-muted-foreground">Late-Night Deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{uniqueVenues}</div>
              <div className="text-xs text-muted-foreground">Venues</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Clock className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">2am</div>
              <div className="text-xs text-muted-foreground">Standard Last Call</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{neighborhoods.length}</div>
              <div className="text-xs text-muted-foreground">Neighborhoods</div>
            </div>
          </div>

          {/* How late Chicago runs */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">How Late Chicago Actually Runs</h2>
            <ul className="space-y-3 text-sm leading-relaxed text-foreground">
              <li>
                <strong>Standard last call is 2am</strong> (3am on Saturdays). Most neighborhood bars and their kitchens run to that window.
              </li>
              <li>
                <strong>Late-hour (4am/5am) licenses</strong> cluster in River North, Wrigleyville, and the West Town / Wicker Park strips, that&apos;s where the night keeps going.
              </li>
              <li>
                <strong>Kitchens close before the bar does.</strong> The move is knowing which spots actually serve food late, confirm the kitchen cutoff, not just the bar hours.
              </li>
              <li>
                <strong>Reverse / late-night happy hours</strong> (often after 9 or 10pm) are the deal sweet spot, same discounts as the early window, fewer crowds.
              </li>
            </ul>
          </section>

          {/* Deals by neighborhood */}
          {neighborhoods.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Late-Night Deals by Neighborhood</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Live after-hours and late-night specials across Chicago, updated automatically as venues post them.
              </p>
              <div className="space-y-6">
                {neighborhoods.map((nh) => (
                  <div key={nh.slug}>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">
                      <Link href={`/neighborhoods/${nh.slug}`} className="hover:text-brand-600 dark:hover:text-brand-400">
                        {nh.name}
                      </Link>
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({nh.deals.length} {nh.deals.length === 1 ? "deal" : "deals"})
                      </span>
                    </h3>
                    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {nh.deals.slice(0, 8).map((d) => (
                        <li key={d.id} className="px-4 py-3">
                          <Link
                            href={`/venues/${d.venue_slug}`}
                            className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                          >
                            {d.venue_name}
                          </Link>
                          <p className="mt-0.5 text-sm text-foreground">{d.title}</p>
                          {d.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Search handoff */}
          <section className="mb-12">
            <GuideSearchHandoff
              headline="Hungry right now?"
              subtitle="Search every live late-night special near you, filtered by neighborhood and what's still open."
              cta={{ label: "Search late-night deals", href: "/search?q=late%20night" }}
              links={[
                { label: "Late-night deals", href: "/deals/late-night" },
                { label: "Wing deals", href: "/deals/wing-deals" },
                { label: "Daily specials", href: "/deals/daily-specials" },
                { label: "BOGO deals", href: "/deals/bogo" },
              ]}
            />
          </section>

          {/* Cross-links */}
          <section className="mb-12 rounded-xl border border-brand-300/40 bg-brand-50/40 dark:bg-brand-950/20 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
              Adjacent plays
            </h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/deals/happy-hours"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🍻 Happy Hours, the early window
              </Link>
              <Link
                href="/guides/world-cup-chicago"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                ⚽ World Cup, late kickoffs &amp; watch parties
              </Link>
              <Link
                href="/guides/cubs-game-day-chicago"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                ⚾ Cubs Game Day, post-game in Wrigleyville
              </Link>
              <Link
                href="/neighborhoods/wrigleyville"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                📍 Wrigleyville, the late-night stronghold
              </Link>
            </div>
          </section>

          {/* Newsletter */}
          <section className="mb-12">
            <EmailSignup source="guide_late_night" />
          </section>

          {/* FAQ */}
          <section className="mb-12 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold text-foreground">Frequently Asked Questions</h2>
            <dl className="space-y-4">
              {faqItems.map((item, i) => (
                <div key={i}>
                  <dt className="text-sm font-semibold text-foreground">{item.q}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* About */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">About This Guide</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Live data from 312Deals, {totalDeals} late-night food and drink deals across {uniqueVenues} Chicago venues.
              Kitchen and bar hours change without notice, and last call varies by license, always confirm the late-night
              kitchen cutoff with the venue. Last updated:{" "}
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
