import Link from "next/link"
import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { buildBreadcrumbJsonLd } from "@/lib/seo-utils"

export const revalidate = 86400

const SITE_URL = "https://www.312deals.com"

type Guide = { href: string; title: string; blurb: string; cat: string; eventEnd?: string }

const GUIDES: Guide[] = [
  // Food & Drink
  { href: "/guides/deep-dish-pizza-chicago", title: "Deep Dish Pizza", blurb: "A visitor's guide to the iconic spots, which are closest to downtown, what to order, and live deals.", cat: "Food & Drink" },
  { href: "/guides/best-brunch-chicago", title: "Best Brunch", blurb: "Bottomless mimosas and the city's best brunch deals, by neighborhood.", cat: "Food & Drink" },
  { href: "/guides/chicago-happy-hours", title: "Happy Hours", blurb: "The definitive guide to Chicago happy hour, drinks and apps after work.", cat: "Food & Drink" },
  { href: "/guides/cheap-drinks-chicago", title: "Cheap Drinks", blurb: "$1 beers, $10 cocktails, and where to find them across the city.", cat: "Food & Drink" },
  { href: "/guides/late-night-eats-chicago", title: "Late Night Food", blurb: "Restaurants and bars open late, kitchens serving past midnight.", cat: "Food & Drink" },
  { href: "/guides/dog-friendly-patios-chicago", title: "Dog-Friendly Patios", blurb: "Eat and drink outside with your dog at patios across Chicago.", cat: "Food & Drink" },
  { href: "/guides/patio-season-chicago", title: "Patio Season", blurb: "Thousands of outdoor deals at rooftops, patios, and beer gardens.", cat: "Food & Drink" },
  { href: "/guides/chicago-food-deals", title: "Chicago Food Deals", blurb: "The everyday food-deal roundup across the whole city.", cat: "Food & Drink" },

  // Game Day & Events
  { href: "/guides/bears-game-day-chicago", title: "Bears Game Day", blurb: "Where to watch the Bears, 300+ sports bars with game-day specials, city and suburbs.", cat: "Game Day & Events" },
  { href: "/guides/college-football-chicago", title: "College Football", blurb: "Alumni bars by school for the Big Ten and SEC, plus sports bars with live Saturday specials, city and suburbs.", cat: "Game Day & Events", eventEnd: "2027-01-12" },
  { href: "/guides/world-cup-chicago", title: "Chicago Soccer Bars", blurb: "Where to watch soccer in Chicago, the best soccer bars, beer gardens, and watch parties by neighborhood.", cat: "Game Day & Events" },
  { href: "/guides/cubs-game-day-chicago", title: "Cubs Game Day", blurb: "Wrigleyville bars, pre-game brunch, and game-day drink specials.", cat: "Game Day & Events" },
  { href: "/guides/white-sox-game-day-chicago", title: "White Sox Game Day", blurb: "Bars near Rate Field, Bridgeport taverns, and Chinatown pre-game spots.", cat: "Game Day & Events" },
  { href: "/guides/college-bars-chicago", title: "College Bars", blurb: "Find your team's alumni bar for game day in Chicago.", cat: "Game Day & Events" },
  { href: "/guides/lollapalooza-chicago", title: "Lollapalooza", blurb: "Grant Park restaurants, late night, and recovery brunch for festival weekend.", cat: "Game Day & Events" },

  // Visiting Chicago
  { href: "/guides/where-to-stay-chicago", title: "Where to Stay", blurb: "Hotels picked by neighborhood for food, drink, and walkability.", cat: "Visiting Chicago" },

  // Seasonal & Holidays (eventEnd = last day the guide is "current"; auto-archives after)
  { href: "/guides/halloween-bars-chicago", title: "Halloween", blurb: "The Northalsted parade, costume-contest bars, crawl neighborhoods and late-night specials, city and suburbs.", cat: "Seasonal & Holidays", eventEnd: "2026-11-01" },
  { href: "/guides/chicago-marathon-bars-restaurants", title: "Chicago Marathon", blurb: "Spectator bars mile by mile, carb-loading dinners, and post-race brunch near the finish.", cat: "Seasonal & Holidays", eventEnd: "2026-10-12" },
  { href: "/guides/mexican-independence-day-chicago", title: "Mexican Independence Day", blurb: "El Grito, the 26th Street Parade, and where to eat and drink around them.", cat: "Seasonal & Holidays", eventEnd: "2026-09-16" },
  { href: "/guides/oktoberfest-chicago", title: "Oktoberfest", blurb: "Every Oktoberfest in the city and suburbs, plus beer halls with live deals.", cat: "Seasonal & Holidays", eventEnd: "2026-10-05" },
  { href: "/guides/pride-chicago", title: "Pride", blurb: "Drag brunches, Halsted-corridor bars, and Pride Parade weekend deals.", cat: "Seasonal & Holidays", eventEnd: "2026-06-30" },
  { href: "/guides/4th-of-july-chicago", title: "4th of July", blurb: "Rooftops, fireworks views, and BBQ specials for the long weekend.", cat: "Seasonal & Holidays", eventEnd: "2026-07-05" },
  { href: "/guides/memorial-day-weekend-chicago", title: "Memorial Day Weekend", blurb: "BBQ, patios, and what to book before the rooms fill up.", cat: "Seasonal & Holidays", eventEnd: "2026-05-26" },
  { href: "/guides/fathers-day-chicago", title: "Father's Day", blurb: "Steakhouses, smoke joints, and patios for Dad.", cat: "Seasonal & Holidays", eventEnd: "2026-06-21" },
  { href: "/guides/graduation-dinner-chicago", title: "Graduation Dinner", blurb: "Where to book for pre- and post-commencement dining.", cat: "Seasonal & Holidays", eventEnd: "2026-06-15" },
  { href: "/guides/cinco-de-mayo-chicago", title: "Cinco de Mayo", blurb: "Margaritas, tequila specials, and taco deals citywide.", cat: "Seasonal & Holidays", eventEnd: "2026-05-05" },
  { href: "/guides/st-patricks-day-chicago", title: "St. Patrick's Day", blurb: "The complete guide to Chicago's St. Paddy's food and drink deals.", cat: "Seasonal & Holidays", eventEnd: "2026-03-17" },
]

const CATEGORY_ORDER = ["Food & Drink", "Game Day & Events", "Visiting Chicago", "Seasonal & Holidays"]

export const metadata: Metadata = {
  title: "Chicago Food & Drink Guides, Deep Dish, Brunch, Happy Hours & More | 312Deals",
  description:
    "Curated Chicago food and drink guides written by locals: deep dish pizza, the best brunch, happy hours, patios, game-day watch parties, and seasonal events, each with live deals.",
  openGraph: {
    title: "Chicago Food & Drink Guides | 312Deals",
    description:
      "Locally-written guides to Chicago deep dish, brunch, happy hours, patios, game day, and seasonal events, each with live deals.",
    url: `${SITE_URL}/guides`,
    siteName: "312Deals",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chicago Food & Drink Guides | 312Deals",
    description: "Locally-written Chicago guides, deep dish, brunch, happy hours, patios, game day, and more.",
  },
  alternates: { canonical: `${SITE_URL}/guides` },
}

export default function GuidesIndex() {
  // Recomputed at each daily revalidate (revalidate=86400), so seasonal guides
  // move themselves from "Upcoming & Current" to "Past" as their date passes.
  const today = new Date().toISOString().slice(0, 10)
  const isPast = (g: Guide) => g.eventEnd != null && g.eventEnd < today
  const guideCard = (g: Guide, past = false) => (
    <Link
      key={g.href}
      href={g.href}
      className={`group flex flex-col rounded-xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/10 ${past ? "border-border/60 opacity-75 hover:opacity-100" : "border-border"}`}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-foreground group-hover:text-brand-500">{g.title}</h3>
        {past && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">2026</span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{g.blurb}</p>
      <span className="mt-3 text-xs font-semibold text-brand-600 dark:text-brand-400">Read the guide →</span>
    </Link>
  )
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <main className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: SITE_URL },
                  { name: "Guides", url: `${SITE_URL}/guides` },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: "Chicago Food & Drink Guides",
                description:
                  "Curated Chicago food and drink guides: deep dish, brunch, happy hours, patios, game day, and seasonal events.",
                url: `${SITE_URL}/guides`,
                hasPart: GUIDES.map((g) => ({
                  "@type": "WebPage",
                  name: `${g.title}, Chicago`,
                  url: `${SITE_URL}${g.href}`,
                })),
              }),
            }}
          />

          {/* Hero */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
              <span>/</span>
              <span className="text-foreground">Guides</span>
            </nav>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Chicago Food &amp; Drink Guides</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Curated guides to Chicago&apos;s food and drink scene, written by people who actually live here.
              Each one pulls live deals, so the picks stay current.
            </p>
          </header>

          {CATEGORY_ORDER.map((cat) => {
            const items = GUIDES.filter((g) => g.cat === cat)
            if (items.length === 0) return null
            if (cat === "Seasonal & Holidays") {
              const current = items.filter((g) => !isPast(g))
              const past = items.filter(isPast)
              return (
                <section key={cat} className="mb-10">
                  <h2 className="mb-4 text-xl font-bold text-foreground">{cat}</h2>
                  {current.length > 0 && (
                    <div className="mb-6">
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming &amp; Current</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {current.map((g) => guideCard(g))}
                      </div>
                    </div>
                  )}
                  {past.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Past 2026 Events &mdash; still worth a read</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {past.map((g) => guideCard(g, true))}
                      </div>
                    </div>
                  )}
                </section>
              )
            }
            return (
              <section key={cat} className="mb-10">
                <h2 className="mb-4 text-xl font-bold text-foreground">{cat}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((g) => guideCard(g))}
                </div>
              </section>
            )
          })}

          {/* Cross-links */}
          <section className="mt-4 rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Looking for something specific?{" "}
              <Link href="/search" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">Search every deal</Link>,
              browse <Link href="/neighborhoods" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">by neighborhood</Link>, or
              read the <Link href="/blog" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">blog</Link>.
            </p>
          </section>
        </main>
      </div>
      <Footer />
    </div>
  )
}
