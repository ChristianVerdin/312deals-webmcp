import fs from "fs"
import path from "path"
import matter from "gray-matter"
import readingTime from "reading-time"

// Re-export types and constants so server components can import from "@/lib/blog"
export {
  BLOG_CATEGORIES,
  type BlogCategory,
  type BlogPostMeta,
  type BlogPost,
} from "./blog-types"

import type { BlogCategory, BlogPostMeta, BlogPost } from "./blog-types"

// --- File system helpers (server-only) ---

const CONTENT_DIR = path.join(process.cwd(), "content", "blog")

export function getAllPostSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""))
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(raw)
  const stats = readingTime(content)

  return {
    slug,
    title: data.title ?? "",
    description: data.description ?? "",
    date: data.date ?? "",
    dateLabel: data.dateLabel,
    category: data.category ?? "guides",
    tags: data.tags ?? [],
    coverImage: data.coverImage,
    author: data.author ?? "312Deals",
    readingTime: stats.text,
    featured: data.featured ?? false,
    faq: data.faq ?? undefined,
    content,
  }
}

export function getAllPosts(): BlogPostMeta[] {
  const slugs = getAllPostSlugs()
  return slugs
    .map((slug) => {
      const post = getPostBySlug(slug)
      if (!post) return null
      const { content: _, ...meta } = post
      return meta
    })
    .filter((p): p is BlogPostMeta => p !== null)
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
}

export function getPostsByCategory(category: BlogCategory): BlogPostMeta[] {
  return getAllPosts().filter((p) => p.category === category)
}

export function getRelatedPosts(
  currentSlug: string,
  limit = 3
): BlogPostMeta[] {
  const current = getPostBySlug(currentSlug)
  if (!current) return []

  const all = getAllPosts().filter((p) => p.slug !== currentSlug)

  const scored = all.map((post) => {
    let score = post.category === current.category ? 3 : 0
    score += post.tags.filter((t) => current.tags.includes(t)).length
    return { post, score }
  })

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.post.date).getTime() - new Date(a.post.date).getTime()
    )
    .slice(0, limit)
    .map((s) => s.post)
}
