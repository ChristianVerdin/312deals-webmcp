import type { Metadata } from "next"
import { Suspense } from "react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { BlogCard } from "@/components/blog-card"
import { BlogCategoryFilter } from "@/components/blog-category-filter"
import { EmailSignup } from "@/components/email-signup"
import { getAllPosts, BLOG_CATEGORIES } from "@/lib/blog"
import { buildBreadcrumbJsonLd } from "@/lib/seo-utils"
import type { BlogCategory } from "@/lib/blog"

const SITE_URL = "https://www.312deals.com"

export const metadata: Metadata = {
  title: "Blog, Chicago Food & Drink Guides | 312Deals",
  description:
    "Curated guides to Chicago's food and drink scene, best bars for game day, date night spots, hidden gems, taco rankings, and more.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "312Deals Blog, Chicago Food & Drink Guides",
    description:
      "Curated guides to Chicago's food and drink scene, best bars for game day, date night spots, hidden gems, and more.",
    url: `${SITE_URL}/blog`,
    siteName: "312Deals",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/api/og?title=312Deals+Blog&subtitle=Chicago+Food+%26+Drink+Guides`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "312Deals Blog, Chicago Food & Drink Guides",
    description:
      "Curated guides to Chicago's food and drink scene, game day bars, date night spots, hidden gems, and more.",
  },
}

export default function BlogPage({
  searchParams,
}: {
  searchParams: { category?: string }
}) {
  const allPosts = getAllPosts()
  const activeCategory = searchParams.category as BlogCategory | undefined
  const posts =
    activeCategory && activeCategory in BLOG_CATEGORIES
      ? allPosts.filter((p) => p.category === activeCategory)
      : allPosts

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 lg:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: SITE_URL },
                  { name: "Blog", url: `${SITE_URL}/blog` },
                ])
              ),
            }}
          />

          <h1 className="text-3xl font-bold text-foreground">Blog</h1>
          <p className="mt-2 text-muted-foreground">
            Curated guides to Chicago&apos;s food and drink scene, written by
            people who actually live here.
          </p>

          <div className="mt-6">
            <Suspense>
              <BlogCategoryFilter />
            </Suspense>
          </div>

          {posts.length > 0 ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <div className="mt-16 text-center">
              <p className="text-lg font-semibold text-foreground">
                {activeCategory
                  ? "No articles in this category yet"
                  : "Articles coming soon"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                We&apos;re working on guides to Chicago&apos;s best game day
                bars, date night spots, hidden gems, and more. Sign up to get
                notified when we publish.
              </p>
              <div className="mx-auto mt-6 max-w-md">
                <EmailSignup source="blog-empty" variant="inline" />
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
