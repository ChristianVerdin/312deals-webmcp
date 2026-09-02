import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Wheat, MapPin, ShieldCheck, Star, Clock } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd, getLowestDealPrice } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"
import { stats } from "@/lib/product-stats"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

/** Top 25 Chicago neighborhoods + key suburbs that index well on dietary queries. */
const HOOD_INDEX: Record<string, { name: string; description: string }> = {
  "river-north": { name: "River North", description: "Steakhouses, sushi rooms, and modern American kitchens with the highest gluten-free density in the city." },
  "west-loop": { name: "West Loop", description: "Randolph Restaurant Row. Higher-end menus flag GF items by default; some kitchens are dedicated." },
  "lincoln-park": { name: "Lincoln Park", description: "DePaul corridor + Halsted restaurant row. GF variety from pizza to fine dining, plus a dedicated cafe & bakery on Diversey." },
  "lakeview": { name: "Lakeview", description: "Wrigleyville-adjacent. Strong celiac-aware coverage in casual gastropubs and brunch spots, plus a dedicated vegan-GF spot." },
  "the-loop": { name: "The Loop", description: "Downtown lunch + theater dinner. Hotel restaurants take GF seriously; a dedicated GF Korean spot sits on Michigan Avenue." },
  "logan-square": { name: "Logan Square", description: "Newer indie kitchens that built GF into the menu, not as an afterthought." },
  "wicker-park": { name: "Wicker Park", description: "Milwaukee Avenue corridor, dedicated GF options sit next to taquerias and craft cocktail bars." },
  "west-town": { name: "West Town", description: "Includes a dedicated gluten-free pizzeria, Neapolitan-style pies in a 100% GF kitchen." },
  "andersonville": { name: "Andersonville", description: "Home to one of Chicago's longest-running dedicated gluten-free bakeries, breads, cookies, cakes." },
  "south-loop": { name: "South Loop", description: "Wintrust Arena + theater district. Reliable GF at hotel kitchens and chain locations." },
  "streeterville": { name: "Streeterville", description: "Magnificent Mile + Northwestern Memorial. Mix of hotel-restaurant GF menus and trained kitchens." },
  "wrigleyville": { name: "Wrigleyville", description: "Pre-game GF options across sports bars and game-day kitchens near the Cubs." },
  "hyde-park": { name: "Hyde Park", description: "UChicago campus + 53rd Street corridor. GF-aware kitchens, often with vegan crossover." },
  "gold-coast": { name: "Gold Coast", description: "Upscale dining with allergen-trained staff; many menus mark GF by default." },
  "old-town": { name: "Old Town", description: "Wells Street corridor, neighborhood favorites with reliable GF coverage." },
  "rogers-park": { name: "Rogers Park", description: "Loyola Lake Shore Campus area. Casual GF options up and down Sheridan Road." },
  "edgewater": { name: "Edgewater", description: "Bryn Mawr + Broadway corridor. Strong vegetarian-GF crossover." },
  "pilsen": { name: "Pilsen", description: "Mexican corridor along 18th Street, corn-tortilla tacos and ceviche are naturally GF." },
  "humboldt-park": { name: "Humboldt Park", description: "Puerto Rican corridor + indie kitchens. Naturally GF items dominate." },
  "ukrainian-village": { name: "Ukrainian Village", description: "Chicago Avenue corridor, small-batch kitchens with thoughtful GF offerings." },
  "bucktown": { name: "Bucktown", description: "Damen + Milwaukee corridor. Cafe and bistro GF coverage." },
  "evanston": { name: "Evanston", description: "Northwestern campus + downtown Evanston. Strong celiac-aware coverage." },
  "oak-park": { name: "Oak Park", description: "Frank Lloyd Wright suburb with walkable dining; strong GF options downtown." },
  "naperville": { name: "Naperville", description: "Downtown Naperville dining scene with consistent GF representation." },
  "lincoln-square": { name: "Lincoln Square", description: "Lawrence Avenue corridor, bakeries and brunch with GF crossover." },
}

const RELATED_HOODS = Object.keys(HOOD_INDEX)

async function fetchHoodGFDeals(hoodSlug: string, limit = 40): Promise<Deal[]> {
  try {
    const params = new URLSearchParams({ neighborhood: hoodSlug, gluten_free: "true", limit: String(limit) })
    const res = await fetch(`${API_URL}/api/v1/deals/search?${params}`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch { return [] }
}

async function fetchHoodLikelyGF(hoodSlug: string, limit = 20): Promise<Deal[]> {
  try {
    const params = new URLSearchParams({ neighborhood: hoodSlug, limit: String(limit) })
    const res = await fetch(`${API_URL}/api/v1/deals/search?${params}`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return (data.deals ?? []).filter((d) => d.dietary_tags?.includes("likely_gf"))
  } catch { return [] }
}

function uniqueByVenue(deals: Deal[]): Deal[] {
  const seen = new Set<number>()
  const out: Deal[] = []
  for (const d of deals) {
    const id = d.venue_id
    if (id == null || seen.has(id)) continue
    seen.add(id); out.push(d)
  }
  return out
}

const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
}

function dayChips(deal: Deal): string {
  const days = deal.days_available ?? []
  if (!days.length || days.length === 7) return "Daily"
  if (days.length >= 5 && days.every((d) => ["monday","tuesday","wednesday","thursday","friday"].includes(d))) return "Mon–Fri"
  return days.map((d) => DAY_LABELS[d] ?? d).join(", ")
}

export async function generateStaticParams() {
  return Object.keys(HOOD_INDEX).map((neighborhood) => ({ neighborhood }))
}

export async function generateMetadata(
  { params }: { params: { neighborhood: string } }
): Promise<Metadata> {
  const hood = HOOD_INDEX[params.neighborhood]
  if (!hood) return { title: "Gluten-Free Deals in Chicago | 312Deals" }

  // Soft-404 guard (Mintlify Phase 7B): emit noindex when both the
  // confirmed-GF and likely-GF pools come back empty. Render path keeps
  // its empty-state UX (since the parent /dietary/gluten-free page is
  // already indexed and aggregates), but a per-hood thin shell shouldn't
  // be in Google's index until inventory lands.
  const [confirmedRaw, likelyRaw] = await Promise.all([
    fetchHoodGFDeals(params.neighborhood, 5),
    fetchHoodLikelyGF(params.neighborhood, 5),
  ])
  const isEmpty = (confirmedRaw?.length ?? 0) === 0 && (likelyRaw?.length ?? 0) === 0

  return {
    title: `Gluten-Free Restaurants in ${hood.name}, Chicago 2026`,
    description: `Every gluten-free deal in ${hood.name}, verified dedicated facilities and strong-GF-menu spots. Updated weekly across 312Deals' ${stats.venues} venue corpus.`,
    alternates: { canonical: `${SITE_URL}/dietary/gluten-free/${params.neighborhood}` },
    ...(isEmpty ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `Gluten-Free Restaurants in ${hood.name}, Chicago`,
      description: hood.description,
      url: `${SITE_URL}/dietary/gluten-free/${params.neighborhood}`,
      type: "article",
    },
  }
}

export default async function Page({ params }: { params: { neighborhood: string } }) {
  const hood = HOOD_INDEX[params.neighborhood]
  if (!hood) return notFound()

  const [confirmedRaw, likelyRaw] = await Promise.all([
    fetchHoodGFDeals(params.neighborhood, 40),
    fetchHoodLikelyGF(params.neighborhood, 24),
  ])

  const confirmed = uniqueByVenue(confirmedRaw)
  const likely = uniqueByVenue(likelyRaw).filter(
    (d) => !confirmed.find((c) => c.venue_id === d.venue_id)
  )

  const totalConfirmed = confirmed.length
  const totalLikely = likely.length

  const faqItems = [
    {
      q: `How many gluten-free restaurants are in ${hood.name}?`,
      a: `312Deals tracks ${totalConfirmed} venues in ${hood.name} with explicit gluten-free deals, plus ${totalLikely} additional venues with naturally GF items (steaks, sashimi, grilled fish, corn-tortilla tacos). All updated weekly.`,
    },
    {
      q: `Are any ${hood.name} restaurants dedicated gluten-free?`,
      a: `Dedicated gluten-free facilities (100% GF kitchens) are listed on the main gluten-free page. Wheat's End Cafe is in Lincoln Park, Defloured is in Andersonville, Pizza Friendly Pizza is in West Town, and SeoulSpice is in Wicker Park. If your neighborhood isn't one of those, look for "strong GF menu" venues below and call ahead.`,
    },
    {
      q: `Best gluten-free brunch in ${hood.name}?`,
      a: `Filter ${hood.name} deals by Saturday or Sunday to find GF brunch options. Naturally GF brunch items include omelets, frittatas, smoked salmon, fresh fruit, and gluten-free pancake menus where flagged.`,
    },
  ]

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Dietary", url: `${SITE_URL}/dietary` },
    { name: "Gluten-Free", url: `${SITE_URL}/dietary/gluten-free` },
    { name: hood.name, url: `${SITE_URL}/dietary/gluten-free/${params.neighborhood}` },
  ])
  const faqJsonLd = buildFaqJsonLd(faqItems)
  const itemListJsonLd = buildItemListJsonLd(
    `Gluten-Free Restaurants in ${hood.name}, Chicago`,
    `${SITE_URL}/dietary/gluten-free/${params.neighborhood}`,
    confirmed.slice(0, 20),
  )

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pb-24 md:pb-0">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

        <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-4 text-xs text-muted-foreground lg:px-6">
          <Link href="/" className="hover:underline">Home</Link> /{" "}
          <Link href="/dietary" className="hover:underline">Dietary</Link> /{" "}
          <Link href="/dietary/gluten-free" className="hover:underline">Gluten-Free</Link> /{" "}
          <span className="text-foreground">{hood.name}</span>
        </nav>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_280px] lg:px-6 lg:py-8">
          <div>
            <div className="flex items-center gap-2">
              <Wheat className="h-6 w-6 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Updated weekly</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
              Gluten-Free Restaurants in {hood.name}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {hood.description}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{totalConfirmed}</div>
                <div className="text-xs text-muted-foreground">Verified GF deals</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{totalLikely}</div>
                <div className="text-xs text-muted-foreground">Likely GF items</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-2xl font-bold text-foreground">{hood.name}</div>
                <div className="text-xs text-muted-foreground">Chicago neighborhood</div>
              </div>
            </div>

            {/* Confirmed GF deals */}
            <h2 className="mt-8 flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl">
              <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              Verified Gluten-Free Deals in {hood.name}
            </h2>
            {confirmed.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No explicit gluten-free deals tracked in {hood.name} yet. See "Likely GF" below or check{" "}
                <Link href="/dietary/gluten-free" className="text-amber-700 hover:underline dark:text-amber-400">
                  the full gluten-free index
                </Link>.
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {confirmed.slice(0, 20).map((d, i) => {
                  const price = getLowestDealPrice(d)
                  return (
                    <li key={d.id} className="rounded-xl border border-border bg-card p-4">
                      <Link href={`/venues/${d.venue_slug}`} className="block min-h-[44px]">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-bold text-foreground hover:text-emerald-700 dark:hover:text-emerald-400">
                            {i + 1}. {d.venue_name}
                          </h3>
                          <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                            GF
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{d.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" aria-hidden="true" />
                            {d.address ?? hood.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {dayChips(d)}
                          </span>
                          {price != null && (
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              ${price.toFixed(price % 1 === 0 ? 0 : 2)}
                            </span>
                          )}
                          {d.google_rating && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" aria-hidden="true" />
                              {d.google_rating}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            )}

            {/* Likely GF */}
            {likely.length > 0 && (
              <>
                <h2 className="mt-10 flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl">
                  <Wheat className="h-5 w-5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                  Likely Gluten-Free in {hood.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Naturally GF items (steaks, sashimi, grilled fish, corn-tortilla tacos), not explicitly marketed as GF.
                  Always confirm with the venue if you're celiac.
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {likely.slice(0, 10).map((d) => (
                    <li key={d.id} className="rounded-lg border border-border bg-card p-3">
                      <Link href={`/venues/${d.venue_slug}`} className="block min-h-[44px]">
                        <span className="font-medium text-foreground hover:text-amber-700 dark:hover:text-amber-400">{d.venue_name}</span>
                        <span className="text-muted-foreground">, {d.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* FAQ */}
            <h2 className="mt-10 text-lg font-bold text-foreground sm:text-xl">FAQ</h2>
            <div className="mt-4 space-y-3">
              {faqItems.map((item, i) => (
                <details key={i} className="rounded-lg border border-border bg-card p-4">
                  <summary className="cursor-pointer min-h-[44px] py-2 text-sm font-semibold text-foreground">{item.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>

            <div className="mt-10">
              <EmailSignup source={`dietary-gluten-free-${params.neighborhood}`} />
            </div>
          </div>

          {/* Sidebar, neighborhood directory */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-foreground">Other Neighborhoods</h3>
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs lg:grid-cols-1">
                {RELATED_HOODS.filter((s) => s !== params.neighborhood).map((slug) => (
                  <li key={slug}>
                    <Link
                      href={`/dietary/gluten-free/${slug}`}
                      className="block min-h-[28px] py-1 text-muted-foreground hover:text-amber-700 hover:underline dark:hover:text-amber-400"
                    >
                      {HOOD_INDEX[slug].name}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/dietary/gluten-free"
                className="mt-4 block text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
              >
                ← All gluten-free deals (citywide)
              </Link>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-foreground">Gluten-Free by Cuisine</h3>
              <ul className="mt-3 space-y-1 text-xs">
                <li><Link href="/cuisine/mexican" className="text-muted-foreground hover:text-amber-700 hover:underline dark:hover:text-amber-400">Mexican (naturally GF, corn tortillas)</Link></li>
                <li><Link href="/cuisine/japanese" className="text-muted-foreground hover:text-amber-700 hover:underline dark:hover:text-amber-400">Japanese (sashimi + rice bowls)</Link></li>
                <li><Link href="/cuisine/indian" className="text-muted-foreground hover:text-amber-700 hover:underline dark:hover:text-amber-400">Indian (rice + dal)</Link></li>
                <li><Link href="/cuisine/thai" className="text-muted-foreground hover:text-amber-700 hover:underline dark:hover:text-amber-400">Thai (rice noodles + curries)</Link></li>
                <li><Link href="/cuisine/korean" className="text-muted-foreground hover:text-amber-700 hover:underline dark:hover:text-amber-400">Korean (rice bowls)</Link></li>
              </ul>
            </div>
          </aside>
        </section>
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-6 pb-6 md:hidden">
        <Link
          href={`/search?neighborhood=${params.neighborhood}&gluten_free=true`}
          className="pointer-events-auto flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-amber-700 px-6 py-4 text-base font-bold text-white shadow-2xl shadow-amber-900/30 transition-colors hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
        >
          Search all {hood.name} GF deals
        </Link>
      </div>

      <Footer />
    </div>
  )
}
