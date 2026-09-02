import Link from "next/link"
import type { Metadata } from "next"
import { MapPin, Sparkles, Calendar, Flame, Tag, Search } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

async function getJulyFourthDeals(): Promise<Deal[]> {
  const queries = [
    "fourth of july",
    "4th of july",
    "july 4",
    "independence",
    "rooftop",
    "fireworks",
    "patio",
    "bbq",
    "ribs",
  ]
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

function isJulyFourthDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /4th\s*of\s*july|fourth\s*of\s*july|july\s*4|independence\s*day/.test(text)
}

// False positives the loose "rooftop/fireworks" match used to drag in:
// "Fútbol Fireworks Flavor" (ice cream), Kentucky Derby parties (May), bowling
// leagues, mixology classes. Drop these so the section stays on-topic.
const ROOFTOP_JUNK = /\bderby\b|fireworks?\s*flavor|\bbowling\b|league\s*signup|mixology\s*class/i

function isRooftopOrFireworksDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""} ${d.venue_name ?? ""}`.toLowerCase()
  if (ROOFTOP_JUNK.test(text)) return false
  return /rooftop|skyline|river\s*view|firework|navy\s*pier|grant\s*park/.test(text)
}

function isBbqDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  return /\bbbq\b|barbecue|ribs|brisket|smoked|pulled\s*pork|pitmaster/.test(text)
}

// Pull a concise price/discount snippet (max 3 tokens) from a deal's structured
// item prices first, then from its title/description text. Returns null when the
// deal carries no concrete price, used both to render a chip and to rank
// price-bearing deals to the top of each section.
function extractPrice(d: Deal): string | null {
  const items = [
    ...(Array.isArray(d.food_items) ? d.food_items : []),
    ...(Array.isArray(d.drink_items) ? d.drink_items : []),
  ]
  const structured: string[] = []
  for (const it of items) {
    if (it && it.deal_price != null) {
      const n = Number(it.deal_price)
      const amt = `$${Number.isInteger(n) ? n : n.toFixed(2)}`
      structured.push(it.name ? `${amt} ${it.name}` : amt)
      if (structured.length >= 2) break
    }
  }
  if (structured.length) return structured.join(" · ")

  const text = `${d.title} ${d.description ?? ""}`
  const re = /\$\d+(?:\.\d{2})?(?:\s?off)?|\b\d{1,3}%\s?off\b|\bBOGO\b|buy one,? get one|half[-\s]?price/gi
  const tokens: string[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null && tokens.length < 3) {
    const tok = m[0].replace(/\s+/g, " ").trim()
    const key = tok.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      tokens.push(tok)
    }
  }
  return tokens.length ? tokens.join(" · ") : null
}

// Sort comparator: deals with a concrete price come first (stable otherwise).
function priceFirst(a: Deal, b: Deal): number {
  return (extractPrice(b) ? 1 : 0) - (extractPrice(a) ? 1 : 0)
}

export const metadata: Metadata = {
  title: "4th of July in Chicago: Fireworks Views, Rooftop Bars & BBQ Deals",
  description:
    "Where to watch July 4th fireworks in Chicago + the best deals: rooftop bars with fireworks views, river-view restaurants, BBQ specials & patio brunches from River North to the suburbs.",
  openGraph: {
    title: "4th of July in Chicago | 312Deals",
    description:
      "Rooftop fireworks views, BBQ specials, and patio brunches across Chicago for Independence Day.",
    url: `${SITE_URL}/guides/4th-of-july-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=4th+of+July+in+Chicago&subtitle=Rooftops%2C+fireworks+views+%26+BBQ&emoji=%F0%9F%8E%86&badges=Rooftops+%26+fireworks%2CBBQ+%26+patios%2CJul+4+weekend&v=3`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "4th of July in Chicago | 312Deals",
    description: "Rooftop fireworks views, BBQ specials, and patio brunches across Chicago for Independence Day.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/4th-of-july-chicago`,
  },
}

export default async function JulyFourthGuide() {
  const allDeals = await getJulyFourthDeals()
  const julyFourthDeals = allDeals.filter(isJulyFourthDeal)
  const rooftopDeals = allDeals.filter((d) => !isJulyFourthDeal(d) && isRooftopOrFireworksDeal(d))
  const bbqDeals = allDeals.filter((d) => !isJulyFourthDeal(d) && !isRooftopOrFireworksDeal(d) && isBbqDeal(d))

  const totalDeals = julyFourthDeals.length
  const uniqueVenues = new Set(julyFourthDeals.map((d) => d.venue_name)).size

  // Group strict 4th of July deals by neighborhood
  const byHood = new Map<string, { name: string; slug: string; deals: Deal[] }>()
  for (const d of julyFourthDeals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = byHood.get(d.neighborhood_slug)
      if (existing) existing.deals.push(d)
      else byHood.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, deals: [d] })
    }
  }
  const neighborhoods = Array.from(byHood.values())
    .map((h) => ({ ...h, deals: [...h.deals].sort(priceFirst) }))
    .sort((a, b) => b.deals.length - a.deals.length)

  function buildShortlist(pool: Deal[], cap = 16): Deal[] {
    const out: Deal[] = []
    const seenVenue = new Set<string>()
    const hoodCount = new Map<string, number>()
    for (const d of pool) {
      if (!d.venue_slug || seenVenue.has(d.venue_slug)) continue
      const k = d.neighborhood_slug || "_"
      if ((hoodCount.get(k) ?? 0) >= 2) continue
      seenVenue.add(d.venue_slug)
      hoodCount.set(k, (hoodCount.get(k) ?? 0) + 1)
      out.push(d)
      if (out.length >= cap) break
    }
    return out
  }
  const rooftopShortlist = buildShortlist([...rooftopDeals].sort(priceFirst), 12)
  const bbqShortlist = buildShortlist([...bbqDeals].sort(priceFirst), 12)

  const faqItems = [
    {
      q: "When is Independence Day?",
      a: "Independence Day is July 4 every year, and it anchors a summer-holiday weekend in Chicago. The main fireworks shows are at Navy Pier (nightly around the holiday) and the Grant Park area; lakefront and rooftop views fill up by 6 PM.",
    },
    {
      q: "What are the best rooftop bars for Chicago fireworks on July 4?",
      a:
        rooftopDeals.length > 0
          ? `Top spots with views: River North rooftops (ROOF on theWit, Cabra, Apogee, LH Rooftop), Streeterville (Aire), and Gold Coast (The J. Parker, Drumbar). Most book 4-6 weeks ahead for fireworks night. Walk-in capacity exists at smaller patios in West Loop and Logan Square if you're flexible on view.`
          : "Top fireworks rooftops: ROOF on theWit, Cabra, Apogee, LH Rooftop (River North), Aire (Streeterville), J. Parker, Drumbar (Gold Coast). Book 4-6 weeks ahead for fireworks-night.",
    },
    {
      q: "Where can I get BBQ in Chicago for the 4th of July?",
      a: "Smoque BBQ (Portage Park) is the city benchmark. Sanders BBQ Supply Co. (Beverly), Briny Swine Smokehouse (Lincoln Park), The Levee (Belmont Cragin), Miller's Ale House (Schaumburg, Orland Park, $15.99 full-rack Sun-Mon). Lines run long all weekend, order takeout midday Friday for sides + brisket if you're hosting.",
    },
    {
      q: "Are restaurants open on July 4 in Chicago?",
      a: "Most restaurants and bars are open with abbreviated holiday hours on July 4. Brunch service typically runs 10 AM - 3 PM; dinner is normal. Fireworks-view spots fill earliest, book 2-3 weeks out for guaranteed seating. Walk-in is fine for neighborhood bars, beer gardens, and BBQ joints.",
    },
    {
      q: "Where's the best 4th of July fireworks view in Chicago?",
      a: "Navy Pier hosts the official fireworks (multiple nights around July 4). For unobstructed views: Lakefront Trail north of Navy Pier (Oak Street Beach, North Avenue Beach), Streeterville rooftops, Gold Coast skyscrapers, and Northerly Island Park. The river-corridor restaurants in River North also catch the show.",
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
                  { name: "4th of July Chicago", url: `${SITE_URL}/guides/4th-of-july-chicago` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
          />
          {julyFourthDeals.length > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(
                  buildItemListJsonLd(
                    "4th of July Chicago Deals",
                    `${SITE_URL}/guides/4th-of-july-chicago`,
                    julyFourthDeals
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
                headline: "4th of July in Chicago, Rooftops, Fireworks Views & BBQ",
                description: `${totalDeals} Independence Day food and drink specials across ${uniqueVenues} Chicago venues. Rooftop fireworks views, river-view restaurants, BBQ specials, and patio brunches.`,
                url: `${SITE_URL}/guides/4th-of-july-chicago`,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/4th-of-july-chicago`,
                },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
                },
                image: `${SITE_URL}/api/og?title=4th+of+July+in+Chicago&subtitle=Rooftops%2C+fireworks+views+%26+BBQ&emoji=%F0%9F%8E%86&badges=Rooftops+%26+fireworks%2CBBQ+%26+patios%2CJul+4+weekend&v=3`,
                datePublished: "2026-05-19",
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
              <span className="text-foreground">4th of July Chicago</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              4th of July in Chicago, Rooftops, Fireworks Views &amp; BBQ
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">312Deals Team</span> · Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Independence Day is Chicago's biggest fireworks-and-patio night. Navy Pier runs the marquee show
              (plus nightly displays around the holiday), and the rooftops book 4-6 weeks ahead.
              {totalDeals > 0 ? ` ${totalDeals} explicit 4th of July specials live across ${uniqueVenues} venues right now,` : " "}
              plus {rooftopDeals.length}+ rooftop and fireworks-view spots and {bbqDeals.length}+ BBQ specials running through the weekend.
            </p>
          </header>

          {/* Prominent above-the-fold deal CTA, converts seasonal search traffic into deal-clicks */}
          <div className="mb-10 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <Tag className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-foreground">Find July 4 deals near you</p>
                <p className="text-xs text-muted-foreground">
                  {totalDeals > 0
                    ? `${totalDeals} explicit 4th of July specials are live right now, plus rooftop, patio, and BBQ deals across Chicago.`
                    : "Rooftop, patio, and BBQ deals across Chicago, plus thousands more food & drink specials, updated daily."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href="/search?q=fireworks" className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                July 4 deals near you
              </Link>
              <Link href="/deals" className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:border-amber-400">
                All Chicago deals
              </Link>
            </div>
          </div>

          {/* Key Stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{totalDeals}</div>
              <div className="text-xs text-muted-foreground">4th of July Specials</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{rooftopDeals.length}+</div>
              <div className="text-xs text-muted-foreground">Rooftops &amp; Views</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Flame className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">{bbqDeals.length}+</div>
              <div className="text-xs text-muted-foreground">BBQ Specials</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <div className="text-2xl font-bold text-foreground">July 4</div>
              <div className="text-xs text-muted-foreground">Independence Day</div>
            </div>
          </div>

          {/* Weekend shape */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">The Weekend Shape</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              The lakefront fireworks setup means the days around the holiday play very differently:
            </p>
            <ul className="space-y-3 text-sm leading-relaxed text-foreground">
              <li>
                <strong>Fireworks eve.</strong> Navy Pier runs its first fireworks night.
                Lakefront restaurants + rooftops fill by 6 PM. Less crowded than the 4th but still
                heavy. Book a couple of weeks ahead for a fireworks-view dinner.
              </li>
              <li>
                <strong>July 4, the day.</strong> Patio breakfast → BBQ midday → fireworks
                view at dusk. The lakefront is wall-to-wall. Rooftop bars require reservations made
                weeks ahead. Walk-in is realistic for west-side patios and Logan Square beer gardens.
              </li>
              <li>
                <strong>The morning after, recovery.</strong> Brunch crush, smaller crowds than the
                4th itself. The day for the steakhouse if you skipped the holiday.
              </li>
            </ul>
          </section>

          {/* Rooftop shortlist */}
          {rooftopShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Rooftops &amp; Fireworks Views</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                The view-tier rooftops + river-corridor restaurants. {rooftopDeals.length}+ running this month
                top {rooftopShortlist.length} below, max 2 per neighborhood. Book 4-6 weeks ahead for fireworks night.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {rooftopShortlist.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <Link
                      href={`/venues/${d.venue_slug}`}
                      className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                    >
                      {d.venue_name}
                    </Link>
                    {d.neighborhood && (
                      <span className="ml-2 text-xs text-muted-foreground">{d.neighborhood}</span>
                    )}
                    <p className="mt-0.5 text-sm text-foreground">
                      {d.title}
                      {extractPrice(d) && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {extractPrice(d)}
                        </span>
                      )}
                    </p>
                    {d.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Explicit Specials by Neighborhood */}
          {neighborhoods.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">Explicit Independence Day Specials</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Deals that explicitly mention 4th of July / Independence Day. Most drop in the last week of June
                and run through the holiday weekend.
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
                      {nh.deals.map((d) => (
                        <li key={d.id} className="px-4 py-3">
                          <Link
                            href={`/venues/${d.venue_slug}`}
                            className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                          >
                            {d.venue_name}
                          </Link>
                          <p className="mt-0.5 text-sm text-foreground">
                            {d.title}
                            {extractPrice(d) && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                {extractPrice(d)}
                              </span>
                            )}
                          </p>
                          {d.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{d.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* BBQ shortlist */}
          {bbqShortlist.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-foreground">BBQ Specials Worth a Visit</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Year-round BBQ deals running through the long weekend. {bbqDeals.length}+ in the index
                top {bbqShortlist.length} below, max 2 per neighborhood. Lines run long all weekend.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {bbqShortlist.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <Link
                      href={`/venues/${d.venue_slug}`}
                      className="text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-400"
                    >
                      {d.venue_name}
                    </Link>
                    {d.neighborhood && (
                      <span className="ml-2 text-xs text-muted-foreground">{d.neighborhood}</span>
                    )}
                    <p className="mt-0.5 text-sm text-foreground">
                      {d.title}
                      {extractPrice(d) && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {extractPrice(d)}
                        </span>
                      )}
                    </p>
                    {d.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Search handoff — redirect post-holiday traffic to evergreen surfaces */}
          <section className="mb-12">
            <GuideSearchHandoff
              headline="Looking for deals any day, not just the 4th?"
              subtitle="Search every live special near you, patios, happy hours, and BBQ, updated daily all summer."
              cta={{ label: "Search Chicago deals", href: "/search" }}
              links={[
                { label: "Patio & rooftop deals", href: "/guides/patio-season-chicago" },
                { label: "Happy hours", href: "/deals/happy-hours" },
                { label: "Brunch deals", href: "/deals/brunch-deals" },
                { label: "Daily specials", href: "/deals/daily-specials" },
              ]}
            />
          </section>

          {/* Cross-links */}
          <section className="mb-12 rounded-xl border border-brand-300/40 bg-brand-50/40 dark:bg-brand-950/20 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
              Plan around the weekend
            </h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/guides/patio-season-chicago"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🌞 Patio Season Guide, 9,500+ outdoor deals
              </Link>
              <Link
                href="/deals/brunch-deals"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🥂 Brunch Deals, Sunday recovery
              </Link>
              <Link
                href="/deals/happy-hours"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                🍻 Happy Hours
              </Link>
              <Link
                href="/neighborhoods/river-north"
                className="rounded-md bg-card border border-border px-3 py-2 text-foreground hover:border-brand-400 transition-colors"
              >
                📍 River North, rooftop density
              </Link>
            </div>
          </section>

          {/* Newsletter */}
          <section className="mb-12">
            <EmailSignup source="guide_4th_of_july" />
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
              Live data from 312Deals, {totalDeals} 4th of July deals across {uniqueVenues} Chicago venues, plus
              {" "}{rooftopDeals.length}+ rooftop and fireworks-view spots and {bbqDeals.length}+ BBQ specials running
              this month. Prices and availability change without notice; book rooftops 4-6 weeks ahead. Last updated:{" "}
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
