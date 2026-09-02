import Link from "next/link"
import type { Metadata } from "next"
import { Wheat, Leaf, Sprout } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import { buildBreadcrumbJsonLd } from "@/lib/seo-utils"
import { stats } from "@/lib/product-stats"

export const revalidate = 86400 // 24h, page is mostly evergreen

const SITE_URL = "https://www.312deals.com"

const DIETARY_PAGES = [
  {
    slug: "gluten-free",
    title: "Gluten-Free Deals",
    icon: Wheat,
    count: "400+ verified · 2,200+ likely-GF",
    blurb:
      "Every deal tagged gluten-free, plus naturally GF items (steaks, sashimi, grilled fish, corn-tortilla tacos). Top hoods: River North, Lakeview, Lincoln Park, West Loop, The Loop.",
    accentBg: "bg-amber-50 dark:bg-amber-950/30",
    accentBorder: "border-amber-200 dark:border-amber-900",
    accentIcon: "text-amber-600",
    available: true,
  },
  {
    slug: "vegan",
    title: "Vegan Deals",
    icon: Sprout,
    count: "150+ verified",
    blurb:
      "Plant-based deals across Chicago and the suburbs. Coming soon, search results currently surface via the search page filter.",
    accentBg: "bg-emerald-50 dark:bg-emerald-950/30",
    accentBorder: "border-emerald-200 dark:border-emerald-900",
    accentIcon: "text-emerald-600",
    available: false,
  },
  {
    slug: "vegetarian",
    title: "Vegetarian Deals",
    icon: Leaf,
    count: "200+ verified",
    blurb:
      "Meatless deals citywide. Coming soon, search results currently surface via the search page filter.",
    accentBg: "bg-green-50 dark:bg-green-950/30",
    accentBorder: "border-green-200 dark:border-green-900",
    accentIcon: "text-green-600",
    available: false,
  },
]

export const metadata: Metadata = {
  title: "Dietary Deals in Chicago, Gluten-Free, Vegan, Vegetarian | 312Deals",
  description:
    `Find Chicago food and drink deals that match your dietary needs. 400+ gluten-free, 150+ vegan, 150+ vegetarian deals across ${stats.venues} venues. Updated weekly.`,
  alternates: { canonical: `${SITE_URL}/dietary` },
  openGraph: {
    title: "Dietary Deals in Chicago, Gluten-Free, Vegan, Vegetarian",
    description:
      "400+ gluten-free, 150+ vegan, 150+ vegetarian deals across Chicago. Filter by neighborhood, day, and price.",
    url: `${SITE_URL}/dietary`,
    type: "website",
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630 }],
  },
}

export default function Page() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Dietary", url: `${SITE_URL}/dietary` },
  ])

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />

        <nav className="mx-auto max-w-7xl px-4 pt-4 text-xs text-muted-foreground lg:px-6">
          <Link href="/" className="hover:underline">Home</Link> /{" "}
          <span className="text-foreground">Dietary</span>
        </nav>

        <section className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Dietary Deals in Chicago
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Food and drink deals filtered by dietary need across {stats.neighborhoods} Chicagoland neighborhoods. Updated weekly
            from venue websites and social media. For celiac and other allergy-sensitive diners, always confirm
            with the venue before visiting; 312Deals tags deals based on how venues market them, not on certified
            kitchen practices.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DIETARY_PAGES.map((page) => {
              const Icon = page.icon
              const card = (
                <article
                  className={`rounded-xl border ${page.accentBorder} ${page.accentBg} p-6 transition-colors ${page.available ? "hover:border-amber-400" : "opacity-70"}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-7 w-7 ${page.accentIcon}`} />
                    <h2 className="text-lg font-bold text-foreground">{page.title}</h2>
                    {!page.available && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-500">
                    {page.count}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{page.blurb}</p>
                  <div className="mt-4 text-xs font-medium text-amber-600">
                    {page.available ? (
                      <>Browse {page.title.toLowerCase()} &rarr;</>
                    ) : (
                      <>
                        <Link
                          href={`/search?dietary=${page.slug}`}
                          className="hover:underline"
                        >
                          Search via filter &rarr;
                        </Link>
                      </>
                    )}
                  </div>
                </article>
              )
              return page.available ? (
                <Link key={page.slug} href={`/dietary/${page.slug}`} className="group block">
                  {card}
                </Link>
              ) : (
                <div key={page.slug}>{card}</div>
              )
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-6">
          <h2 className="mb-3 text-lg font-bold text-foreground">Why we built this</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Dietary needs aren&apos;t niche. About 1% of Americans have celiac disease and 6% follow gluten-free
            diets for other reasons. About 6% identify as vegetarian and 1% as vegan. Across our 12,636 venues
            and {stats.deals} deals, we tag each deal by dietary compatibility based on the underlying ingredients
            and the language venues use. Filter, browse by neighborhood, and verify with the venue before
            visiting if you have allergies or strict requirements.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-12 lg:px-6">
          <EmailSignup source="dietary-index" />
        </section>
      </main>
      <Footer />
    </div>
  )
}
