import Link from "next/link"
import type { Metadata } from "next"
import { GraduationCap, MapPin } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { STUDENT_GUIDE_PAGES, slugToName } from "@/lib/seo-utils"
import type { SearchResponse } from "@/lib/types"

export const metadata: Metadata = {
  title: "Student Deal Guides, Chicago University Deals | 312Deals",
  description:
    "Find the cheapest eats and best happy hours near Chicago's top universities. Deals for students at UChicago, DePaul, Loyola, UIC, and Northwestern.",
  openGraph: {
    title: "Student Deal Guides, Chicago University Deals | 312Deals",
    description:
      "Find the cheapest eats and best happy hours near Chicago's top universities.",
    url: "https://www.312deals.com/student-guides",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: "https://www.312deals.com/api/og?title=Student+Deal+Guides&subtitle=Cheap+eats+near+Chicago+universities",
      width: 1200,
      height: 630,
      alt: "312Deals, Student Deal Guides",
    }],
  },
  alternates: {
    canonical: "https://www.312deals.com/student-guides",
  },
}

const API_URL = process.env.API_URL || "http://localhost:8000"

async function getDealCount(neighborhoods: string[]): Promise<number> {
  try {
    let total = 0
    const seenIds = new Set<number>()
    for (const neighborhood of neighborhoods) {
      const res = await fetch(
        `${API_URL}/api/v1/deals/search?neighborhood=${neighborhood}&limit=50`,
        { next: { revalidate: 3600 } }
      )
      if (!res.ok) continue
      const data: SearchResponse = await res.json()
      for (const deal of data.deals ?? []) {
        if (!seenIds.has(deal.id)) {
          seenIds.add(deal.id)
          total++
        }
      }
    }
    return total
  } catch {
    return 0
  }
}

export default async function StudentGuidesIndex() {
  const schools = await Promise.all(
    Object.entries(STUDENT_GUIDE_PAGES).map(async ([slug, config]) => ({
      slug,
      ...config,
      dealCount: await getDealCount(config.neighborhoods),
    }))
  )

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Chicago Student Deal Guides",
    description: `Food and drink deal guides for ${schools.length} Chicago universities`,
    url: "https://www.312deals.com/student-guides",
    numberOfItems: schools.length,
    itemListElement: schools.map((school, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "WebPage",
        name: school.schoolName,
        url: `https://www.312deals.com/student-guides/${school.slug}`,
        description: school.description,
      },
    })),
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
          />
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="h-6 w-6 text-brand-500" />
              <h1 className="text-2xl font-bold text-foreground">
                Student Deal Guides
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Find the cheapest eats and best happy hours near Chicago&apos;s top universities.
            </p>
          </div>

          {/* School Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {schools.map((school) => (
              <Link
                key={school.slug}
                href={`/student-guides/${school.slug}`}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-brand-300"
              >
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="h-5 w-5 text-brand-500" />
                  <h2 className="font-semibold text-foreground group-hover:text-brand-600 transition-colors">
                    {school.schoolName}
                  </h2>
                </div>
                <div className="flex items-center gap-1 mb-3 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {school.neighborhoods.map((s) => slugToName(s)).join(", ")}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {school.description}
                </p>
                <span className="text-sm font-semibold text-brand-500">
                  {school.dealCount} deal{school.dealCount !== 1 ? "s" : ""} nearby
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
