import Link from "next/link"
import type { Metadata } from "next"
import { Dog, PawPrint, MapPin, Sun, Droplets, Trees, Star } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import { GUIDE_PHOTOS } from "@/lib/guide-photos"
import { GuideHeroImage } from "@/components/guide-hero-image"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

const DEAL_TYPE_LABEL: Record<string, string> = {
  happy_hour: "Happy Hour",
  daily_special: "Daily Special",
  brunch_deal: "Brunch",
  late_night: "Late Night",
  game_day: "Game Day",
  seasonal_lto: "Seasonal",
  event_driven: "Event",
  loyalty_reward: "Loyalty",
  group_package: "Group",
  chain_app_deal: "App Deal",
  restaurant_week: "Restaurant Week",
  new_opening: "New",
  other: "Deal",
}

// Hotels and national chains carry huge Google review counts, so a popularity
// sort floods them into a "dog patio" guide. Drop them by name so the roster
// stays cool local restaurants, bars, and breweries. (Bare "inn"/"suites" are
// intentionally NOT matched — e.g. "The Leavitt Street Inn & Tavern" is a real
// local tavern; Lou Malnati's / Gino's / Superdawg are Chicago institutions.)
const EXCLUDE_VENUE =
  /hotel|marriott|hyatt|westin|sofitel|fairmont|sonesta|blackstone|staypineapple|residence inn|intercontinental|swissotel|warwick allerton|hilton|sheraton|kimpton|allegro royal|holiday inn|texas roadhouse|kona grill|lazy dog|outback steak|raising cane|olive garden|applebee|buffalo wild|city works/i

function isLocalVenue(d: Deal): boolean {
  return !EXCLUDE_VENUE.test(d.venue_name || "")
}

async function fetchDogPatioDeals(): Promise<Deal[]> {
  // API caps at MAX_LIMIT=200/page (limit>200 → 422). We sort by `popular`
  // (rating x review volume) so well-known, high-traffic venues lead over
  // tiny-sample 5.0s. Popular venues carry many deals each (and we later drop
  // hotels/chains), so we paginate deep (8 pages / 1,600 deals) and dedupe to a
  // clean, marquee-first local roster.
  try {
    const pages = await Promise.all(
      [0, 200, 400, 600, 800, 1000, 1200, 1400].map((offset) =>
        fetch(
          `${API_URL}/api/v1/deals/search?dog_friendly_patio=true&sort=popular&limit=200&offset=${offset}`,
          { next: { revalidate: 3600 } }
        )
          .then((r): Promise<{ deals?: Deal[] }> => (r.ok ? r.json() : Promise.resolve({ deals: [] })))
          .catch((): { deals?: Deal[] } => ({ deals: [] }))
      )
    )
    return pages.flatMap((p) => p.deals ?? [])
  } catch {
    return []
  }
}

async function fetchTopPicks(): Promise<Deal[]> {
  // Curated marquee row: city venues with a strong review base (rating >= 4.5),
  // ranked by popularity (rating x review volume). A separate, tighter query so
  // chains, hotels, and tiny-sample 5.0 spots don't dominate the top of the guide.
  try {
    const res = await fetch(
      `${API_URL}/api/v1/deals/search?dog_friendly_patio=true&zone=city&min_rating=4.5&sort=popular&limit=200`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data: { deals?: Deal[] } = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

/** One deal per venue (the highest-rated/first), for a clean venue roster. */
function uniqueByVenue(deals: Deal[]): Deal[] {
  const seen = new Set<string>()
  const out: Deal[] = []
  for (const d of deals) {
    const key = d.venue_slug || d.venue_name
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(d)
  }
  return out
}

type HoodGroup = { name: string; slug: string; venues: Deal[] }

function groupByNeighborhood(venues: Deal[]): HoodGroup[] {
  const map = new Map<string, HoodGroup>()
  for (const v of venues) {
    const name = v.neighborhood || "Chicago"
    const slug = v.neighborhood_slug || ""
    if (!map.has(name)) map.set(name, { name, slug, venues: [] })
    map.get(name)!.venues.push(v)
  }
  // Most venues first; ties broken alphabetically.
  return Array.from(map.values()).sort(
    (a, b) => b.venues.length - a.venues.length || a.name.localeCompare(b.name)
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const venues = uniqueByVenue(await fetchDogPatioDeals())
  const count = venues.length
  const hoods = new Set(venues.map((v) => v.neighborhood).filter(Boolean)).size
  const countLabel = count >= 25 ? `${Math.floor(count / 5) * 5}+` : `${count}`

  return {
    title: "Dog-Friendly Patios in Chicago 2026, Eat & Drink With Your Dog",
    description: `${countLabel} dog-friendly patios across ${hoods}+ Chicago neighborhoods, restaurants, breweries & bars that welcome dogs, with live happy hours and food & drink deals. Updated weekly.`,
    alternates: { canonical: `${SITE_URL}/guides/dog-friendly-patios-chicago` },
    openGraph: {
      title: "Dog-Friendly Patios in Chicago, Eat & Drink With Your Dog",
      description: `${countLabel} Chicago patios that welcome dogs, with current deals. Water bowls, shade, and pup-friendly menus across the city and suburbs.`,
      url: `${SITE_URL}/guides/dog-friendly-patios-chicago`,
      type: "article",
    },
  }
}

export default async function Page() {
  const allDeals = (await fetchDogPatioDeals()).filter(isLocalVenue)
  const venues = uniqueByVenue(allDeals)
  const groups = groupByNeighborhood(venues)
  const totalVenues = venues.length
  const totalHoods = groups.length
  // Curated marquee row (separate city + rating>=4.5 + popularity query so
  // chains, hotels, and suburban outliers don't dominate the top of the guide).
  const topPicks = uniqueByVenue((await fetchTopPicks()).filter(isLocalVenue)).slice(0, 8)

  const faqItems = [
    {
      q: "Are dogs allowed on restaurant patios in Chicago?",
      a: "Yes, Illinois lets municipalities permit dogs on outdoor patios, and many Chicago restaurants, breweries, and bars opt in. Dogs are welcome on the outdoor patio (not indoor dining rooms), typically must stay leashed, and food is ordered for people only. Always confirm with the venue, since each spot sets its own rules.",
    },
    {
      q: "Which Chicago neighborhoods have the most dog-friendly patios?",
      a:
        totalHoods > 0
          ? `Across 312Deals' corpus, the strongest neighborhoods right now are ${groups
              .slice(0, 5)
              .map((g) => g.name)
              .join(", ")}. Beer gardens and brewery patios tend to be the most dog-welcoming.`
          : "Beer gardens, brewery patios, and Lincoln Park / Logan Square / Wicker Park spots tend to be the most dog-welcoming. Browse the neighborhood sections below.",
    },
    {
      q: "Do dog-friendly patios serve water for dogs?",
      a: "Most dedicated dog-friendly patios keep water bowls on hand, and breweries with beer gardens almost always do. Shade, a leash-friendly layout, and the occasional 'pup cup' or dog treat are good signs a patio genuinely welcomes dogs rather than just tolerating them.",
    },
    {
      q: "Can I find happy hours and deals at dog-friendly patios?",
      a: "Yes, every venue on this page has at least one live deal in our database (happy hour, daily special, brunch, or seasonal). It's a patio season two-for-one: bring the dog and catch a deal. Deals are re-verified weekly.",
    },
  ]

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Guides", url: `${SITE_URL}/guides/patio-season-chicago` },
    { name: "Dog-Friendly Patios", url: `${SITE_URL}/guides/dog-friendly-patios-chicago` },
  ])
  const faqJsonLd = buildFaqJsonLd(faqItems)
  const itemListJsonLd = buildItemListJsonLd(
    "Dog-Friendly Patios in Chicago",
    `${SITE_URL}/guides/dog-friendly-patios-chicago`,
    venues
  )

  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <main className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
        {/* Hero */}
        <header className="mb-10">
          <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <span>/</span>
            <Link href="/guides/patio-season-chicago" className="hover:text-foreground transition-colors">Patio Season</Link>
            <span>/</span>
            <span className="text-foreground">Dog-Friendly Patios</span>
          </nav>
          <GuideHeroImage photo={GUIDE_PHOTOS["dog-friendly-patios-chicago"]} priority />
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
            <PawPrint className="h-3.5 w-3.5" /> Patio Season 2026
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Dog-Friendly Patios in Chicago, Eat &amp; Drink With Your Dog
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
            It&apos;s patio weather, and your dog is invited. These Chicago restaurants, breweries,
            and bars welcome dogs on the patio, and every one has a live deal worth showing up for.
            From Logan Square beer gardens to Lincoln Park sidewalk tables, here&apos;s where to grab
            a drink with your pup this summer.
          </p>

          {/* Stat chips */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Dog className="mx-auto mb-1.5 h-5 w-5 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{totalVenues}</div>
              <div className="text-xs text-muted-foreground">Dog-friendly patios</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-1.5 h-5 w-5 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{totalHoods}</div>
              <div className="text-xs text-muted-foreground">Neighborhoods</div>
            </div>
            <div className="col-span-2 rounded-xl border border-border bg-card p-4 text-center sm:col-span-1">
              <Sun className="mx-auto mb-1.5 h-5 w-5 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">All</div>
              <div className="text-xs text-muted-foreground">Have a live deal</div>
            </div>
          </div>
        </header>

        {/* What makes a patio dog-friendly */}
        <section className="mb-10 rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold text-foreground">What makes a patio actually dog-friendly</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Not every &quot;dogs allowed&quot; patio is built for a good time with your dog. Look for these:
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            <li className="flex items-start gap-3 text-sm text-muted-foreground">
              <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <span><span className="font-semibold text-foreground">Water bowls &amp; pup cups.</span> The best spots keep water out and many breweries hand out a free &quot;pup cup&quot; of whipped cream.</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-muted-foreground">
              <Trees className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <span><span className="font-semibold text-foreground">Shade &amp; space.</span> Beer gardens and wide sidewalk patios beat a hot, cramped two-top for a dog on an 80° afternoon.</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-muted-foreground">
              <PawPrint className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <span><span className="font-semibold text-foreground">A real welcome.</span> Dog treats behind the bar, a posted dog menu, or staff who greet your dog by name signal a true dog spot.</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-muted-foreground">
              <Sun className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <span><span className="font-semibold text-foreground">Leashed &amp; outdoors only.</span> Illinois lets venues allow dogs on the patio (not indoors); keep your dog leashed and order people food only.</span>
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Rules vary by venue, call ahead if your visit depends on bringing your dog. See also our{" "}
            <Link href="/guides/patio-season-chicago" className="text-brand-500 underline hover:text-brand-600">full Chicago patio guide</Link>{" "}
            for every outdoor deal in the city.
          </p>
        </section>

        {/* Top picks, marquee venues first (popularity = rating x review volume) */}
        {topPicks.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-1 text-xl font-bold text-foreground">Top picks: Chicago&apos;s most-loved dog-friendly patios</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              The highest-rated, most-reviewed spots on the list, each with a live deal.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {topPicks.map((v) => {
                const reviews = (v as { google_review_count?: number }).google_review_count
                return (
                  <Link
                    key={v.venue_slug || v.venue_name}
                    href={`/venues/${v.venue_slug}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{v.venue_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-brand-700 dark:text-brand-300">{DEAL_TYPE_LABEL[v.deal_type] ?? "Deal"}</span>
                        {v.neighborhood ? ` · ${v.neighborhood}` : ""}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{v.title}</p>
                    </div>
                    {v.google_rating ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {v.google_rating.toFixed(1)}
                        {reviews ? <span className="text-muted-foreground">({reviews.toLocaleString()})</span> : null}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {totalVenues === 0 ? (
          <section className="mb-10 rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              We&apos;re refreshing the dog-friendly patio roster for the season. In the meantime, browse the{" "}
              <Link href="/guides/patio-season-chicago" className="text-brand-500 underline hover:text-brand-600">full patio guide</Link>{" "}
              or <Link href="/search?has_patio=true" className="text-brand-500 underline hover:text-brand-600">all patio deals</Link>.
            </p>
          </section>
        ) : (
          <section className="mb-10">
            <h2 className="mb-4 text-xl font-bold text-foreground">Dog-friendly patios by neighborhood</h2>
            <div className="space-y-7">
              {groups.map((g) => (
                <div key={g.name}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="text-base font-semibold text-foreground">
                      {g.slug ? (
                        <Link href={`/neighborhoods/${g.slug}`} className="hover:text-brand-500 transition-colors">{g.name}</Link>
                      ) : g.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">{g.venues.length} spot{g.venues.length === 1 ? "" : "s"}</span>
                  </div>
                  <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                    {g.venues.map((v) => (
                      <li key={v.venue_slug || v.venue_name} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <Link href={`/venues/${v.venue_slug}`} className="block truncate text-sm font-semibold text-foreground hover:text-brand-500 transition-colors">
                            {v.venue_name}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                              {DEAL_TYPE_LABEL[v.deal_type] ?? "Deal"}
                            </span>
                            <span className="truncate">{v.title}</span>
                          </div>
                        </div>
                        {v.google_rating ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{v.google_rating.toFixed(1)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Email capture */}
        <div className="mb-10">
          <EmailSignup source="dog-friendly-patios-guide" variant="banner" />
        </div>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold text-foreground">Dog-friendly patio FAQ</h2>
          <div className="space-y-4">
            {faqItems.map((f) => (
              <div key={f.q} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground">{f.q}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cross-links */}
        <section className="mb-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">More patio season</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href="/guides/patio-season-chicago" className="text-brand-500 underline hover:text-brand-600">Chicago Patio Guide →</Link>
            <Link href="/deals/happy-hours" className="text-brand-500 underline hover:text-brand-600">Happy Hours →</Link>
            <Link href="/deals/brunch-deals" className="text-brand-500 underline hover:text-brand-600">Brunch Deals →</Link>
            <Link href="/search?has_patio=true" className="text-brand-500 underline hover:text-brand-600">All Patio Deals →</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
