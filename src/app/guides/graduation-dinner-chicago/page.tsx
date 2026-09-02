import Link from "next/link"
import type { Metadata } from "next"
import { GraduationCap, MapPin, Calendar, UtensilsCrossed, Users } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildItemListJsonLd } from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

/**
 * Campus → adjacent neighborhood slugs.
 * Used to pull dinner-appropriate venues near each graduation site.
 * UIC Pavilion (525 S Racine) hosts both UIC and IIT graduations.
 */
type CampusGroup = {
  slug: string
  campus: string
  venue: string
  blurb: string
  hoods: string[] // primary neighborhood slugs to pull venues from
}

const CAMPUS_GROUPS: CampusGroup[] = [
  {
    slug: "uic-iit",
    campus: "UIC & IIT",
    venue: "UIC Pavilion (525 S Racine Ave)",
    blurb:
      "Both UIC and IIT host commencement at UIC Pavilion in University Village. After the ceremony, you've got Greektown, Little Italy, West Loop, Pilsen, and the Loop all within a 10-minute drive.",
    hoods: ["university-village", "west-loop", "pilsen", "loop"],
  },
  {
    slug: "uchicago",
    campus: "University of Chicago",
    venue: "Main Quadrangles (Hyde Park)",
    blurb:
      "UChicago graduates at the Main Quad in the heart of Hyde Park. Walk to dinner in Hyde Park itself, or drive 10 minutes north to Bronzeville for a steakhouse-meets-jazz vibe.",
    hoods: ["hyde-park", "bronzeville"],
  },
  {
    slug: "northwestern",
    campus: "Northwestern",
    venue: "Ryan Field & The Lakefill (Evanston)",
    blurb:
      "Northwestern's commencement weekend draws families across Evanston's dining scene, lakefront patios, downtown Evanston, and the south-Evanston row near the campus border with Edgewater.",
    hoods: ["evanston"],
  },
  {
    slug: "loyola",
    campus: "Loyola Chicago",
    venue: "Gentile Arena (Rogers Park)",
    blurb:
      "Loyola's Lake Shore Campus ceremony is followed by family meals up and down Sheridan Road. Rogers Park, Edgewater, and Andersonville are the obvious picks; Lincoln Square is an easy fallback.",
    hoods: ["rogers-park", "edgewater", "andersonville"],
  },
  {
    slug: "depaul",
    campus: "DePaul",
    venue: "Wintrust Arena (South Loop) & Lincoln Park Campus",
    blurb:
      "DePaul splits ceremonies between Wintrust Arena and the Lincoln Park campus. Plan around either: Lincoln Park's restaurant row on Halsted, or South Loop / West Loop if the ceremony is at Wintrust.",
    hoods: ["lincoln-park", "south-loop", "west-loop"],
  },
  {
    slug: "columbia-roosevelt",
    campus: "Columbia & Roosevelt",
    venue: "Auditorium Theatre (South Loop)",
    blurb:
      "Both Columbia College Chicago and Roosevelt University commencements happen in or near the South Loop. The Loop and South Loop dining are right there; Printer's Row is the under-the-radar pick.",
    hoods: ["south-loop", "loop"],
  },
]

/** Suburb chips for "high school graduation" audiences. */
const SUBURB_PICKS = [
  { name: "Naperville", slug: "naperville", note: "Big patio scene downtown" },
  { name: "Oak Park", slug: "oak-park", note: "Walkable + family-friendly" },
  { name: "Evanston", slug: "evanston", note: "Lakefront, large patio inventory" },
  { name: "Wilmette", slug: "wilmette", note: "North Shore, freshly-flagged patios" },
  { name: "Hinsdale", slug: "hinsdale", note: "Upscale western suburb" },
  { name: "Lake Forest", slug: "lake-forest", note: "Far North Shore patios" },
  { name: "Highland Park", slug: "highland-park", note: "Ravinia-adjacent" },
  { name: "Winnetka", slug: "winnetka", note: "Quiet, upscale" },
  { name: "Glenview", slug: "glenview", note: "Halfway between city + Lake Forest" },
  { name: "Schaumburg", slug: "schaumburg", note: "NW suburbs hub" },
  { name: "Arlington Heights", slug: "arlington-heights", note: "Downtown AH" },
  { name: "Hyde Park", slug: "hyde-park", note: "If family stayed near UChicago" },
]

async function fetchHoodDeals(hoodSlug: string, limit = 8): Promise<Deal[]> {
  try {
    const params = new URLSearchParams({
      neighborhood: hoodSlug,
      limit: String(limit),
    })
    const res = await fetch(`${API_URL}/api/v1/deals/search?${params}`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

const EXCLUDED_VENUE_PATTERNS = [/^chipotle/i, /^taco\s*bell/i, /^mcdonald/i, /^subway/i]

function excludeBlockedVenues(deals: Deal[]): Deal[] {
  return deals.filter((d) => {
    const name = d.venue_name ?? ""
    return !EXCLUDED_VENUE_PATTERNS.some((re) => re.test(name))
  })
}

/** Deduplicate by venue id, keeping first occurrence. */
function uniqueByVenue(deals: Deal[]): Deal[] {
  const seen = new Set<string>()
  const out: Deal[] = []
  for (const d of deals) {
    const key = d.venue_slug ?? d.venue_name ?? String(d.id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(d)
  }
  return out
}

export const metadata: Metadata = {
  title: "Chicago Graduation Dinner Guide 2026, Where to Eat After Commencement | 312Deals",
  description:
    "Where to take your grad to dinner, near UIC Pavilion, Hyde Park, Evanston, Lincoln Park, Rogers Park, and the suburbs. Live deals at each spot, organized by campus.",
  openGraph: {
    title: "Chicago Graduation Dinner Guide 2026 | 312Deals",
    description:
      "Where to eat after commencement, by campus. UIC, UChicago, Northwestern, Loyola, DePaul, Columbia, and suburb high-school grads.",
    url: `${SITE_URL}/guides/graduation-dinner-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Chicago+Graduation+Dinner+Guide+2026&subtitle=Where+to+eat+after+commencement`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chicago Graduation Dinner Guide 2026 | 312Deals",
    description: "Where to eat after commencement, by campus.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/graduation-dinner-chicago`,
  },
}

export default async function GraduationDinnerGuide() {
  // Fetch deals per campus group (one fetch per unique hood, dedupe across groups)
  const allHoodSlugs = Array.from(
    new Set(CAMPUS_GROUPS.flatMap((g) => g.hoods))
  )
  const hoodDealsMap = new Map<string, Deal[]>()
  await Promise.all(
    allHoodSlugs.map(async (slug) => {
      const deals = await fetchHoodDeals(slug, 10)
      hoodDealsMap.set(slug, excludeBlockedVenues(deals))
    })
  )

  const totalDeals = Array.from(hoodDealsMap.values()).reduce((sum, arr) => sum + arr.length, 0)
  const uniqueCampuses = CAMPUS_GROUPS.length

  const faqItems = [
    {
      q: "Where should I take my graduate for dinner in Chicago?",
      a: "Pick by campus. UIC and IIT both grad at UIC Pavilion, Greektown, Little Italy, and West Loop are 5 minutes away. UChicago means Hyde Park. Northwestern means Evanston. Loyola means Rogers Park or Andersonville. DePaul splits between Lincoln Park and South Loop. We list live deals at each spot below.",
    },
    {
      q: "How close are restaurants to UIC Pavilion?",
      a: "UIC Pavilion is at 525 S Racine Ave in University Village. Within a 10-minute drive you have Greektown, Little Italy, the West Loop's restaurant row on Randolph, Pilsen's Mexican corridor along 18th Street, and the Loop. For walking distance, Little Italy's Taylor Street is closest.",
    },
    {
      q: "What about my high schooler's graduation in the suburbs?",
      a: "Most Chicagoland high-school graduations happen mid-May through early June. We track deals across Naperville, Oak Park, Evanston, Wilmette, Hinsdale, Lake Forest, Highland Park, Winnetka, Glenview, Schaumburg, and Arlington Heights. Click any suburb below for that town's live deals.",
    },
    {
      q: "Are reservations needed for graduation weekend?",
      a: "Yes, graduation weekends (mid-May through mid-June) book out 2–3 weeks ahead at popular spots near campuses. If you didn't book, look at venues with bigger floorplans or patio space, and aim for off-peak times (lunch or 9 PM dinner).",
    },
    {
      q: "Is this list updated for 2026?",
      a: "Yes, deals are pulled live from our database every hour. Restaurants that are temporarily closed, that have new specials, or that match the grad-night vibe (groups of 6+, celebratory drinks, dietary range) all surface here in real time.",
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
                  { name: "Graduation Dinner Chicago", url: `${SITE_URL}/guides/graduation-dinner-chicago` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(buildFaqJsonLd(faqItems)),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "Chicago Graduation Dinner Guide 2026, Where to Eat by Campus",
                description: `Live deals near each major Chicago campus and suburb for graduation weekends. ${totalDeals} deals across ${uniqueCampuses} campus areas.`,
                url: `${SITE_URL}/guides/graduation-dinner-chicago`,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `${SITE_URL}/guides/graduation-dinner-chicago`,
                },
                author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
                publisher: {
                  "@type": "Organization",
                  name: "312Deals",
                  url: SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
                },
                image: `${SITE_URL}/api/og?title=Chicago+Graduation+Dinner+Guide+2026&subtitle=Where+to+eat+after+commencement`,
                datePublished: "2026-05-13",
                dateModified: new Date().toISOString().split("T")[0],
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <Link href="/guides" className="hover:text-foreground transition-colors">Guides</Link>
              <span>/</span>
              <span className="text-foreground">Graduation Dinner</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Chicago Graduation Dinner Guide 2026
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
                <span className="font-medium text-foreground">Live</span>
              </span>
              <span>·</span>
              <span>Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              <span>·</span>
              <span>By <span className="font-medium text-foreground">312Deals Team</span></span>
            </p>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Where to take your grad to dinner, organized by campus. {totalDeals}+ live deals near {uniqueCampuses} major Chicago commencement sites and across the suburbs. Reservations book out fast in May; below is what's actually available right now.
            </p>
          </header>

          {/* Key stats */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <GraduationCap className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{uniqueCampuses}</div>
              <div className="text-xs text-muted-foreground">Campus areas</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{allHoodSlugs.length}</div>
              <div className="text-xs text-muted-foreground">Neighborhoods</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <UtensilsCrossed className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{totalDeals}+</div>
              <div className="text-xs text-muted-foreground">Live deals</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Users className="mx-auto mb-2 h-6 w-6 text-brand-500" />
              <div className="text-2xl font-bold text-foreground">{SUBURB_PICKS.length}</div>
              <div className="text-xs text-muted-foreground">Suburb picks</div>
            </div>
          </div>

          {/* Campus sections */}
          {CAMPUS_GROUPS.map((group) => {
            const groupDeals = uniqueByVenue(
              group.hoods.flatMap((slug) => hoodDealsMap.get(slug) ?? [])
            ).slice(0, 8)

            return (
              <section key={group.slug} id={group.slug} className="mb-12 scroll-mt-24">
                <div className="mb-4 flex items-start gap-3">
                  <GraduationCap className="mt-1 h-6 w-6 shrink-0 text-brand-500" aria-hidden />
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{group.campus}</h2>
                    <p className="mt-0.5 text-sm font-medium text-muted-foreground">{group.venue}</p>
                  </div>
                </div>
                <p className="mb-4 text-base leading-relaxed text-muted-foreground">{group.blurb}</p>

                {groupDeals.length > 0 ? (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {groupDeals.map((d) => (
                      <li key={d.id} className="rounded-lg border border-border bg-card p-4">
                        <Link
                          href={`/venues/${d.venue_slug}`}
                          className="font-semibold text-foreground hover:text-brand-500 transition-colors"
                        >
                          {d.venue_name}
                        </Link>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {d.neighborhood ?? ""}
                          {d.title ? ` · ${d.title}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                    No live deals indexed for this campus area right now. Browse the neighborhood pages:{" "}
                    {group.hoods.map((slug, i) => (
                      <span key={slug}>
                        {i > 0 && ", "}
                        <Link href={`/neighborhoods/${slug}`} className="text-brand-500 hover:underline">
                          {slug.replace(/-/g, " ")}
                        </Link>
                      </span>
                    ))}
                    .
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  {group.hoods.map((slug) => (
                    <Link
                      key={slug}
                      href={`/neighborhoods/${slug}`}
                      className="rounded-full border border-border bg-background px-3 py-1.5 capitalize hover:border-brand-500/50 hover:text-brand-500 transition-colors"
                    >
                      All deals in {slug.replace(/-/g, " ")} →
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}

          {/* Suburb section (high-school grads) */}
          <section id="suburbs" className="mb-12 scroll-mt-24">
            <div className="mb-4 flex items-start gap-3">
              <Calendar className="mt-1 h-6 w-6 shrink-0 text-brand-500" aria-hidden />
              <div>
                <h2 className="text-2xl font-bold text-foreground">High School Graduations, Suburbs</h2>
                <p className="mt-0.5 text-sm font-medium text-muted-foreground">Mid-May through early June</p>
              </div>
            </div>
            <p className="mb-4 text-base leading-relaxed text-muted-foreground">
              Most Chicagoland high schools graduate mid-May through early June. Patio season is on (
              <Link href="/guides/patio-season-chicago" className="text-brand-500 hover:underline">
                see the patio guide
              </Link>
              ), and the North Shore + western suburbs have the highest restaurant density per capita. Click any suburb for live deals.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SUBURB_PICKS.map((s) => (
                <Link
                  key={s.slug}
                  href={`/neighborhoods/${s.slug}`}
                  className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand-500/50"
                >
                  <div className="font-semibold text-foreground">{s.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{s.note}</div>
                </Link>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-foreground">FAQ</h2>
            <div className="space-y-4">
              {faqItems.map((item, i) => (
                <details key={i} className="rounded-lg border border-border bg-card p-4">
                  <summary className="cursor-pointer font-semibold text-foreground">{item.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="mb-12 rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-bold text-foreground">Get the weekly Deal Sheet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Free Thursday newsletter. 5 top deals, 1 hidden gem, a neighborhood spotlight. Built for the way Chicago actually eats and drinks.
            </p>
            <div className="mt-4">
              <EmailSignup source="guide-graduation-dinner-chicago" />
            </div>
          </section>

          {/* Related guides */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">Related guides</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/guides/patio-season-chicago" className="rounded-full border border-border px-3 py-1.5 hover:border-brand-500/50 hover:text-brand-500 transition-colors">
                Patio Season Guide →
              </Link>
              <Link href="/guides/college-bars-chicago" className="rounded-full border border-border px-3 py-1.5 hover:border-brand-500/50 hover:text-brand-500 transition-colors">
                College Bars →
              </Link>
              <Link href="/guides/chicago-happy-hours" className="rounded-full border border-border px-3 py-1.5 hover:border-brand-500/50 hover:text-brand-500 transition-colors">
                Happy Hours →
              </Link>
              <Link href="/guides/best-brunch-chicago" className="rounded-full border border-border px-3 py-1.5 hover:border-brand-500/50 hover:text-brand-500 transition-colors">
                Best Brunch →
              </Link>
            </div>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
