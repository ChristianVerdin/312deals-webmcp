import Link from "next/link"
import type { Metadata } from "next"
import { Pizza, MapPin, Clock, Star, Info, Search } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

/**
 * Iconic Chicago deep-dish (and stuffed/pan) pizzerias, hand-curated for tourists.
 * Split by how close they are to the downtown core so visitors can plan around it.
 * Addresses are the flagship/most-central location; several are small chains.
 */
const PIZZERIAS: {
  name: string
  hood: string
  address: string
  note: string
  downtown: boolean
}[] = [
  {
    name: "Pizzeria Uno",
    hood: "River North",
    address: "29 E Ohio St",
    note: "The original. Deep dish was invented here in 1943, the single most historic bite in the city. Pizzeria Due is a block away at 619 N Wabash if the wait is long.",
    downtown: true,
  },
  {
    name: "Lou Malnati's",
    hood: "River North",
    address: "439 N Wells St",
    note: "The locals' default. Flaky, almost buttery crust, a lean sausage patty, and sweet tomato on top. Central, consistent, and ships nationwide if you want to take a pie home.",
    downtown: true,
  },
  {
    name: "Giordano's",
    hood: "The Loop",
    address: "130 E Randolph St",
    note: "The famous stuffed pizza, a second crust on top holds in a deep layer of cheese, with sauce above. Touristy and central; order the second you sit, it bakes ~45 minutes.",
    downtown: true,
  },
  {
    name: "Gino's East",
    hood: "River North",
    address: "162 E Superior St",
    note: "Graffiti-covered walls and a golden cornmeal crust, a block off the Magnificent Mile. A River North classic and an easy walk from most downtown hotels.",
    downtown: true,
  },
  {
    name: "Pizano's",
    hood: "The Loop",
    address: "61 E Madison St",
    note: "Rudy Malnati Jr.'s spot, buttery deep dish and a great thin crust under one roof, right in the Loop. Open late, good for a post-theater pie.",
    downtown: true,
  },
  {
    name: "Labriola",
    hood: "Magnificent Mile",
    address: "535 N Michigan Ave",
    note: "An Italian eatery right on Michigan Avenue with a legit deep dish, the convenient pick if you're already shopping the Mag Mile.",
    downtown: true,
  },
  {
    name: "Pequod's Pizza",
    hood: "Lincoln Park",
    address: "2207 N Clybourn Ave",
    note: "The cult favorite. A ring of caramelized cheese is fused to the crust, burnt-on-purpose and genuinely unforgettable. Worth the short cab ride; expect a wait.",
    downtown: false,
  },
  {
    name: "Bartoli's",
    hood: "Roscoe Village",
    address: "1955 W Addison St",
    note: "Gino's East lineage, neighborhood feel, and what a lot of locals quietly call the best crust in town. More residents than tourists, that's the point.",
    downtown: false,
  },
  {
    name: "Art of Pizza",
    hood: "Lakeview",
    address: "3033 N Ashland Ave",
    note: "Famous for deep dish by the slice, the move when you want the experience without waiting 45 minutes for a whole pie.",
    downtown: false,
  },
]

async function getPizzaDeals(): Promise<Deal[]> {
  const queries = [
    "deep dish",
    "pizza",
    "stuffed pizza",
    "Lou Malnati",
    "Giordano",
    "Gino's East",
    "Pequod",
    "Pizzeria Uno",
    "Pizano",
    "Bartoli",
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

function isPizzaDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""} ${d.venue_name ?? ""}`.toLowerCase()
  return /pizza|deep\s*dish|stuffed|malnati|giordano|gino|pequod/.test(text)
}

export const metadata: Metadata = {
  title: "Chicago Deep Dish Near Downtown: What to Order + Live Deals",
  description:
    "A visitor's guide to Chicago deep dish: which iconic spots (Lou Malnati's, Gino's East, Pizzeria Uno) are closest to downtown and Navy Pier, what to order at each, and today's live pizza deals.",
  openGraph: {
    title: "Chicago Deep Dish Pizza, A Tourist's Guide | 312Deals",
    description:
      "The iconic deep dish spots, which are closest to downtown, what to order, and live pizza deals across Chicago.",
    url: `${SITE_URL}/guides/deep-dish-pizza-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Chicago+Deep+Dish+Pizza&subtitle=A+tourist%27s+guide+to+the+best+spots+%26+deals&emoji=%F0%9F%8D%95&badges=Deep+dish+%2B+tavern-style%2CBy+neighborhood%2CLive+deals&v=2`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chicago Deep Dish Pizza, A Tourist's Guide | 312Deals",
    description: "The iconic deep dish spots, which are closest to downtown, what to order, and live deals.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/deep-dish-pizza-chicago`,
  },
}

export default async function DeepDishGuide() {
  const allDeals = await getPizzaDeals()
  const pizzaDeals = allDeals.filter(isPizzaDeal)

  const totalDeals = pizzaDeals.length
  const uniqueVenues = new Set(pizzaDeals.map((d) => d.venue_name)).size
  const downtownCount = PIZZERIAS.filter((p) => p.downtown).length

  // Group live pizza deals by neighborhood, dedup by venue, cap per hood
  const byHood = new Map<string, { name: string; slug: string; deals: Deal[] }>()
  const seenVenue = new Set<string>()
  for (const d of pizzaDeals) {
    if (!d.neighborhood || !d.neighborhood_slug) continue
    if (d.venue_slug && seenVenue.has(d.venue_slug)) continue
    if (d.venue_slug) seenVenue.add(d.venue_slug)
    const existing = byHood.get(d.neighborhood_slug)
    if (existing) {
      if (existing.deals.length < 6) existing.deals.push(d)
    } else {
      byHood.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, deals: [d] })
    }
  }
  const neighborhoods = Array.from(byHood.values())
    .sort((a, b) => b.deals.length - a.deals.length)
    .slice(0, 9)

  const faqItems = [
    {
      q: "What is Chicago deep dish pizza?",
      a: "Deep dish is a pizza baked in a high-sided round pan so it comes out tall, like a savory pie. The order from the bottom up is crust, then a thick layer of mozzarella, then toppings, with chunky tomato sauce ladled on top so the cheese doesn't burn during the long bake. It's eaten with a knife and fork. 'Stuffed' pizza (Giordano's) goes a step further with a second sheet of dough over the cheese.",
    },
    {
      q: "Where should a tourist get deep dish in Chicago?",
      a: `If you're staying downtown, the easiest iconic spots are Pizzeria Uno (River North, where deep dish was invented), Lou Malnati's (Gold Coast), Giordano's (the Loop), Gino's East (River North), and Pizano's (the Loop). All are a short walk or quick ride from Mag Mile / Loop hotels. If you have time, Pequod's in Lincoln Park (the caramelized-crust local favorite) is worth the trip. ${totalDeals > 0 ? `${totalDeals} live pizza deals are running across ${uniqueVenues} Chicago venues right now.` : ""}`,
    },
    {
      q: "How long does deep dish take to make?",
      a: "Plan on roughly 30–45 minutes from order to table because the pie bakes from scratch. Smart move: call ahead and order your pizza before you arrive, or order it the moment you sit down and have a salad or app while you wait. Many spots also sell par-baked or frozen pies to take home.",
    },
    {
      q: "Is deep dish what locals actually eat?",
      a: "Honestly, not every day. Deep dish is the special-occasion, out-of-town-guest pizza. The everyday Chicago pie is thin, crispy 'tavern style,' cut into squares (the 'party cut'). Do the deep dish once for the experience, then ask a local where they get tavern-style.",
    },
    {
      q: "Deep dish vs. stuffed pizza, what's the difference?",
      a: "Both are tall and pan-baked. Deep dish (Lou Malnati's, Pizzeria Uno) has one crust with cheese and toppings under a top layer of sauce. Stuffed (Giordano's) adds a second thin layer of dough on top of the cheese, with the sauce on that, so it's even taller and pie-like. Stuffed takes a little longer to bake.",
    },
    {
      q: "Can I get Chicago deep dish shipped home?",
      a: "Yes, Lou Malnati's ships par-baked pies nationwide (via Tastes of Chicago), and Giordano's and Gino's East offer shipping too. It's a popular way to bring the trip home. You can also recreate it with a deep-dish pan and a Chicago-style recipe.",
    },
  ]

  const downtownSpots = PIZZERIAS.filter((p) => p.downtown)
  const trekSpots = PIZZERIAS.filter((p) => !p.downtown)

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <article className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
          {/* JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: SITE_URL },
                  { name: "Guides", url: `${SITE_URL}/guides` },
                  { name: "Chicago Deep Dish Pizza", url: `${SITE_URL}/guides/deep-dish-pizza-chicago` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }}
          />
          {pizzaDeals.length > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(
                  buildItemListJsonLd(
                    "Chicago Pizza Deals",
                    `${SITE_URL}/guides/deep-dish-pizza-chicago`,
                    pizzaDeals
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
                headline: "Chicago Deep Dish Pizza, A Tourist's Guide to the Best Spots & Deals",
                description: `The iconic Chicago deep dish pizzerias, which are closest to downtown, what to order, and ${totalDeals} live pizza deals across ${uniqueVenues} venues.`,
                url: `${SITE_URL}/guides/deep-dish-pizza-chicago`,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/deep-dish-pizza-chicago`,
                },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
                },
                image: `${SITE_URL}/api/og?title=Chicago+Deep+Dish+Pizza&subtitle=A+tourist%27s+guide+to+the+best+spots+%26+deals&emoji=%F0%9F%8D%95&badges=Deep+dish+%2B+tavern-style%2CBy+neighborhood%2CLive+deals&v=2`,
                datePublished: "2026-06-23",
                dateModified: new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-8">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
              <span>/</span>
              <Link href="/guides" className="transition-colors hover:text-foreground">Guides</Link>
              <span>/</span>
              <span className="text-foreground">Chicago Deep Dish Pizza</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <Pizza className="h-7 w-7 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Visitor's Guide
              </span>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-700">
                Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
              Chicago Deep Dish Pizza, A Tourist&apos;s Guide
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
              Deep dish is the one Chicago food every visitor wants, and it&apos;s easy to do well if you
              know which spots are worth it and which are closest to your hotel. Below are the iconic
              pizzerias (the ones that actually invented and defined the style), what to order, how long
              it takes, and the live pizza deals running across the city right now.
            </p>
          </header>

          {/* Stats */}
          <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Pizza className="mx-auto mb-2 h-6 w-6 text-amber-600" aria-hidden="true" />
              <div className="text-2xl font-bold text-foreground">{PIZZERIAS.length}</div>
              <div className="text-xs text-muted-foreground">Iconic spots</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-amber-600" aria-hidden="true" />
              <div className="text-2xl font-bold text-foreground">{downtownCount}</div>
              <div className="text-xs text-muted-foreground">Near downtown</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Clock className="mx-auto mb-2 h-6 w-6 text-amber-600" aria-hidden="true" />
              <div className="text-2xl font-bold text-foreground">1943</div>
              <div className="text-xs text-muted-foreground">Deep dish invented</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Star className="mx-auto mb-2 h-6 w-6 text-amber-600" aria-hidden="true" />
              <div className="text-2xl font-bold text-foreground">{totalDeals > 0 ? totalDeals : "Live"}</div>
              <div className="text-xs text-muted-foreground">{totalDeals > 0 ? "Pizza deals tracked" : "Updated daily"}</div>
            </div>
          </div>

          {/* Live deal CTA */}
          <div className="mb-10 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-foreground">Find a deal before you go</p>
                <p className="text-xs text-muted-foreground">
                  {totalDeals > 0
                    ? `${totalDeals} pizza specials are live right now, plus thousands more food & drink deals across Chicago.`
                    : "Thousands of live food & drink deals across Chicago, happy hours, lunch specials, and more."}
                </p>
              </div>
            </div>
            <Link
              href="/search?q=deep%20dish"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Search pizza deals
            </Link>
          </div>

          {/* Closest to downtown */}
          <section className="mb-12">
            <h2 className="mb-1 text-2xl font-bold text-foreground">Closest to Downtown, Start Here</h2>
            <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
              If you&apos;re staying near the Loop, River North, or the Magnificent Mile, these are an easy
              walk or short ride. You can hit the most iconic deep dish in the city without leaving the core.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {downtownSpots.map((p) => (
                <PizzeriaCard key={p.name} p={p} />
              ))}
            </div>
          </section>

          {/* Worth the trek */}
          <section className="mb-12">
            <h2 className="mb-1 text-2xl font-bold text-foreground">Worth the Trek, Locals&apos; Favorites</h2>
            <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
              A little farther out, but these are the ones Chicagoans actually argue about. If you have a
              free afternoon or evening, they reward the cab fare.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trekSpots.map((p) => (
                <PizzeriaCard key={p.name} p={p} />
              ))}
            </div>
          </section>

          {/* Tourist tips */}
          <section className="mb-12 rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold text-foreground">How to Do Deep Dish Like You Know What You&apos;re Doing</h2>
            <ul className="space-y-3 text-sm leading-relaxed text-foreground">
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span><strong>It takes 30–45 minutes to bake.</strong> Call ahead and pre-order, or order the pizza the second you sit down. Get a salad to split while you wait, the classic move.</span>
              </li>
              <li className="flex items-start gap-3">
                <Pizza className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span><strong>One pie feeds two to three people.</strong> Deep dish is dense. A medium between two people with a salad is plenty, don&apos;t over-order.</span>
              </li>
              <li className="flex items-start gap-3">
                <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span><strong>Order the sausage.</strong> The signature is a single lean sausage patty layered across the whole pie. It&apos;s the move at Lou Malnati&apos;s and Pizzeria Uno.</span>
              </li>
              <li className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span><strong>Locals eat tavern-style on a normal night.</strong> Do deep dish once for the bucket-list bite, then try the thin, square-cut Chicago tavern pie to see what residents actually order.</span>
              </li>
            </ul>
          </section>

          {/* Live deals by neighborhood */}
          {neighborhoods.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-1 text-2xl font-bold text-foreground">Live Pizza Deals by Neighborhood</h2>
              <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
                Current pizza specials across Chicago, updated automatically as venues post them.
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
              headline="Pizza night, sorted"
              subtitle="Search every live pizza special near you, BOGO pies, slice deals, and weeknight specials."
              cta={{ label: "Search pizza deals", href: "/search?q=pizza" }}
              links={[
                { label: "Pizza deals", href: "/deals/pizza-deals" },
                { label: "Daily specials", href: "/deals/daily-specials" },
                { label: "Happy hours", href: "/deals/happy-hours" },
                { label: "BOGO deals", href: "/deals/bogo" },
              ]}
            />
          </section>

          {/* Cross-links */}
          <section className="mb-12 rounded-xl border border-brand-300/40 bg-brand-50/40 p-5 dark:bg-brand-950/20">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
              More Chicago eating
            </h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/blog/best-deep-dish-pizza-chicago" className="rounded-md border border-border bg-card px-3 py-2 text-foreground transition-colors hover:border-brand-400">
                📝 Best deep dish: a local&apos;s take
              </Link>
              <Link href="/guides/chicago-food-deals" className="rounded-md border border-border bg-card px-3 py-2 text-foreground transition-colors hover:border-brand-400">
                🍕 All Chicago food deals
              </Link>
              <Link href="/guides/late-night-eats-chicago" className="rounded-md border border-border bg-card px-3 py-2 text-foreground transition-colors hover:border-brand-400">
                🌙 Late-night eats
              </Link>
              <Link href="/guides/best-brunch-chicago" className="rounded-md border border-border bg-card px-3 py-2 text-foreground transition-colors hover:border-brand-400">
                🥂 Best brunch
              </Link>
              <Link href="/neighborhoods/river-north" className="rounded-md border border-border bg-card px-3 py-2 text-foreground transition-colors hover:border-brand-400">
                📍 River North deals
              </Link>
            </div>
          </section>

          {/* Newsletter */}
          <section className="mb-12">
            <EmailSignup source="guide_deep_dish" />
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
              Curated by 312Deals from the iconic Chicago deep-dish pizzerias, with {totalDeals} live pizza
              deals pulled across {uniqueVenues} venues. Hours, prices, and availability change without
              notice, call ahead, especially for the long bake. Last updated:{" "}
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}

function PizzeriaCard({ p }: { p: { name: string; hood: string; address: string; note: string; downtown: boolean } }) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(p.name)}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
          {p.name}
        </h3>
        <Pizza className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{p.hood} · {p.address}</span>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{p.note}</p>
    </Link>
  )
}
