import Link from "next/link"
import type { Metadata } from "next"
import { Tag, Beer, Utensils, Moon, Gamepad2, Clock, Link2, Timer, Beef, Martini } from "lucide-react"
import { DEAL_TYPE_PAGES } from "@/lib/seo-utils"
import { stats, statsEncoded } from "@/lib/product-stats"

// Aug 2026: "today" intent now belongs to /today (day-of-week page) — this hub
// takes the browse intent instead: 'restaurant deals' pos 27.3/609 impr,
// 'food deals' pos 13.2/1,968 impr per Jun-Aug GSC. Splitting the two intents
// resolves the /deals-vs-/today cannibalization on "food deals today".
const SEO_TITLE = `Chicago Restaurant Deals, Browse ${stats.deals} Specials by Type`
const SEO_DESC = `Browse ${stats.deals} verified Chicago restaurant & food deals by type: happy hours, Taco Tuesday, wing nights, BOGO, brunch & game day specials across ${stats.neighborhoods} neighborhoods and suburbs. Updated daily.`

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  alternates: {
    canonical: "https://www.312deals.com/deals",
  },
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: "https://www.312deals.com/deals",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: `https://www.312deals.com/api/og?title=Chicago+Restaurant+Deals&subtitle=${statsEncoded.deals}+specials+across+${statsEncoded.neighborhoods}+neighborhoods`,
      width: 1200,
      height: 630,
      alt: "312Deals, Food Deals Today",
    }],
  },
}

const ICONS: Record<string, React.ElementType> = {
  "happy-hours": Beer,
  "beer-specials": Beer,
  "cheap-cocktails": Martini,
  "brunch-deals": Utensils,
  "late-night": Moon,
  "taco-tuesday": Beef,
  "wing-deals": Beef,
  "wing-tuesday": Beef,
  "wednesday-deals": Clock,
  "thursday-deals": Clock,
  "monday-deals": Clock,
  "sunday-funday": Utensils,
  "game-day": Gamepad2,
  "daily-specials": Clock,
  "chain-deals": Link2,
  "limited-time": Timer,
}

export default function DealsIndexPage() {
  const entries = Object.entries(DEAL_TYPE_PAGES)

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Chicago Deals by Type",
    description: `Browse ${entries.length} types of food and drink deals in Chicago`,
    url: "https://www.312deals.com/deals",
    numberOfItems: entries.length,
    itemListElement: entries.map(([slug, config], i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "WebPage",
        name: config.label,
        url: `https://www.312deals.com/deals/${slug}`,
        description: config.description,
      },
    })),
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="h-5 w-5 text-brand-500" />
          <h1 className="text-2xl font-bold text-foreground">
            Chicago Food Deals by Type
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Explore Chicago food &amp; drink deals organized by category. Whether you&apos;re looking for weekday{" "}
          <Link href="/guides/chicago-happy-hours" className="text-brand-600 hover:underline dark:text-brand-400">
            happy hours
          </Link>
          , weekend brunch specials, or late-night bites, pick a deal type below to see what&apos;s available across the city.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Each category page collects the latest verified listings from bars and restaurants across Chicago and 60+ suburbs. Happy hours typically run weekdays between 3 PM and 6 PM with discounted drinks and half-price appetizers. Daily promotions cover recurring events like Taco Tuesday, Wing Wednesday, and Burger Night. Brunch offers highlight bottomless mimosa packages and prix fixe weekend menus. Late-night specials kick in after 10 PM for reverse happy hours and post-midnight food. Game day pricing surfaces around Bears, Bulls, Cubs, and Sox schedules with bucket savings and watch-party offers. Chain app exclusives track mobile-only promotions from national brands with local locations. Every category is refreshed weekly so you always see what is currently running.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs dark:border-amber-900 dark:bg-amber-950/30">
          <span aria-hidden="true">&#9203;</span>
          <span className="text-muted-foreground">Just want what&apos;s on right now?</span>
          <Link
            href="/today"
            className="font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            See every deal running today &rarr;
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([slug, config]) => {
          const Icon = ICONS[slug] ?? Tag
          return (
            <Link
              key={slug}
              href={`/deals/${slug}`}
              className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-400">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400">
                  {config.label}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                  {config.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Popular Chicago dining guides</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/guides/chicago-happy-hours" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Chicago Happy Hour Guide</Link>
          <Link href="/guides/cheap-drinks-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Cheap Drinks in Chicago</Link>
          <Link href="/guides/best-brunch-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Best Brunch in Chicago</Link>
          <Link href="/guides/patio-season-chicago" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600">Patio &amp; Beer Gardens</Link>
        </div>
      </div>
    </div>
  )
}
