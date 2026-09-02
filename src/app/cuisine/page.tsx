import Link from "next/link"
import type { Metadata } from "next"
import { UtensilsCrossed, Tag } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CUISINE_PAGES, DEAL_TYPE_PAGES } from "@/lib/seo-utils"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Chicago Deals by Cuisine | 312Deals",
  description:
    "Browse food and drink deals by cuisine type across Chicago. Mexican, Italian, Japanese, BBQ, and more, find specials at restaurants near you.",
  openGraph: {
    title: "Chicago Deals by Cuisine | 312Deals",
    description: "Browse food and drink deals by cuisine type across Chicago.",
    url: "https://www.312deals.com/cuisine",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: "https://www.312deals.com/api/og?title=Deals+by+Cuisine&subtitle=Mexican%2C+Italian%2C+Japanese%2C+BBQ+%26+more",
      width: 1200,
      height: 630,
      alt: "312Deals, Chicago Deals by Cuisine",
    }],
  },
  alternates: {
    canonical: "https://www.312deals.com/cuisine",
  },
}

export default function CuisineIndexPage() {
  const cuisines = Object.entries(CUISINE_PAGES)

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "ItemList",
                name: "Chicago Deals by Cuisine",
                description: `Food and drink deals across ${cuisines.length} cuisine types in Chicago`,
                url: "https://www.312deals.com/cuisine",
                numberOfItems: cuisines.length,
                itemListElement: cuisines.map(([slug, config], i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  item: {
                    "@type": "WebPage",
                    name: config.seoTitle,
                    url: `https://www.312deals.com/cuisine/${slug}`,
                  },
                })),
              }),
            }}
          />

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <UtensilsCrossed className="h-5 w-5 text-brand-500" />
              <h1 className="text-2xl font-bold text-foreground">
                Chicago Deals by Cuisine
              </h1>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Browse food and drink deals by cuisine type across {cuisines.length} categories.
              Find happy hours, daily specials, and more at your favorite restaurants.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Chicago is one of the most diverse food cities in the country, and every cuisine has its own deal landscape. Mexican restaurants in Pilsen and Little Village run weekday taco and margarita specials. Italian spots in the West Loop and River North offer happy hour antipasti and discounted wine. Japanese and sushi restaurants feature lunch combos and all-you-can-eat promotions. Korean BBQ joints in the Northwest Side bundle group packages with complimentary sides. Whether you are craving Thai curries, Indian buffets, Mediterranean platters, or classic American bar food, each cuisine page below lists every current deal with venue details, hours, and neighborhood so you can find exactly what you want.
            </p>
          </div>

          {/* Cuisine grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cuisines.map(([slug, config]) => (
              <Link
                key={slug}
                href={`/cuisine/${slug}`}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-brand-300"
              >
                <span className="text-sm font-semibold text-foreground group-hover:text-brand-600 transition-colors">
                  {config.label}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  View deals
                </span>
              </Link>
            ))}
          </div>

          {/* Related deal types */}
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Browse by Deal Type
            </h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DEAL_TYPE_PAGES).map(([slug, config]) => (
                <Link
                  key={slug}
                  href={`/deals/${slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-600"
                >
                  {config.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Happy hours link */}
          <div className="mt-6">
            <Link
              href="/happy-hours"
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-400"
            >
              <Tag className="h-4 w-4" />
              Happy Hours by Neighborhood
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
