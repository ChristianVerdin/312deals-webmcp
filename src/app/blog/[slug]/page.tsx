import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { compileMDX } from "next-mdx-remote/rsc"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { BlogCard } from "@/components/blog-card"
import { ShareButtons } from "@/components/share-buttons"
import { mdxComponents } from "@/components/mdx-components"
import { GUIDE_PHOTOS } from "@/lib/guide-photos"
import { GuideHeroImage } from "@/components/guide-hero-image"
import {
  getPostBySlug,
  getAllPostSlugs,
  getRelatedPosts,
  BLOG_CATEGORIES,
} from "@/lib/blog"
import {
  buildBreadcrumbJsonLd,
  buildBlogArticleJsonLd,
  buildFaqJsonLd,
} from "@/lib/seo-utils"

const SITE_URL = "https://www.312deals.com"

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const post = getPostBySlug(params.slug)
  if (!post) return { title: "Blog | 312Deals" }

  const cat = BLOG_CATEGORIES[post.category]
  const ogImage =
    post.coverImage
      ? `${SITE_URL}${post.coverImage}`
      : `${SITE_URL}/api/og?title=${encodeURIComponent(post.title)}&subtitle=${encodeURIComponent(cat?.label ?? "Blog")}`

  return {
    title: `${post.title} | 312Deals Blog`,
    description: post.description,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      siteName: "312Deals",
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string }
}) {
  const post = getPostBySlug(params.slug)
  if (!post) notFound()

  const { content: mdxContent } = await compileMDX({
    source: post.content,
    components: mdxComponents,
  })

  const relatedPosts = getRelatedPosts(params.slug, 3)
  const cat = BLOG_CATEGORIES[post.category]

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
          {/* JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildBreadcrumbJsonLd([
                  { name: "Home", url: SITE_URL },
                  { name: "Blog", url: `${SITE_URL}/blog` },
                  {
                    name: post.title,
                    url: `${SITE_URL}/blog/${post.slug}`,
                  },
                ])
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(buildBlogArticleJsonLd(post)),
            }}
          />
          {post.faq && post.faq.length > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(buildFaqJsonLd(post.faq)),
              }}
            />
          )}

          {/* Header */}
          <header className="mb-10">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-foreground">
                Blog
              </Link>
              <span>/</span>
              <span className="truncate text-foreground">{post.title}</span>
            </nav>

            <span className="inline-block rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
              {cat?.label ?? post.category}
            </span>

            <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
              {post.title}
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              {post.description}
            </p>

            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              <span>{post.author}</span>
              <span>&middot;</span>
              <time dateTime={post.date}>{post.dateLabel ?? formatDate(post.date)}</time>
              <span>&middot;</span>
              <span>{post.readingTime}</span>
            </div>
          </header>

          {/* Cover image, prefer an attributed Unsplash hero from GUIDE_PHOTOS
              (e.g. the Father's Day guide); else the post's own coverImage. */}
          {GUIDE_PHOTOS[post.slug] ? (
            <div className="mb-10">
              <GuideHeroImage photo={GUIDE_PHOTOS[post.slug]} priority />
            </div>
          ) : post.coverImage ? (
            <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-xl">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          ) : null}

          {/* MDX content */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            {mdxContent}
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Share */}
          <ShareButtons
            title={post.title}
            url={`${SITE_URL}/blog/${post.slug}`}
          />

          {/* Related posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-16 border-t border-border pt-10">
              <h2 className="text-xl font-semibold text-foreground">
                Related Articles
              </h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((p) => (
                  <BlogCard key={p.slug} post={p} />
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
      <Footer />
    </div>
  )
}
