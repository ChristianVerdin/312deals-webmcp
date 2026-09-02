import Link from "next/link"
import Image from "next/image"
import { BLOG_CATEGORIES } from "@/lib/blog-types"
import type { BlogPostMeta } from "@/lib/blog-types"

const SITE_URL = "https://www.312deals.com"

const categoryColors: Record<string, string> = {
  "game-day": "bg-green-500/10 text-green-600 dark:text-green-400",
  "date-night": "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  "best-of": "bg-brand-500/10 text-brand-600 dark:text-brand-400",
  "hidden-gems": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  guides: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function BlogCard({ post }: { post: BlogPostMeta }) {
  const cat = BLOG_CATEGORIES[post.category]
  const colorClass = categoryColors[post.category] ?? categoryColors.guides

  const imageUrl =
    post.coverImage ??
    `${SITE_URL}/api/og?title=${encodeURIComponent(post.title)}&subtitle=${encodeURIComponent(cat?.label ?? "Blog")}`

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-brand-300"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <Image
          src={imageUrl}
          alt={post.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${colorClass}`}
          >
            {cat?.label ?? post.category}
          </span>
          <span className="text-xs text-muted-foreground">
            {post.readingTime}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-foreground group-hover:text-brand-500 transition-colors line-clamp-2">
          {post.title}
        </h3>
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
          {post.description}
        </p>
        <p className="mt-auto pt-3 text-xs text-muted-foreground">
          {post.dateLabel ?? formatDate(post.date)}
        </p>
      </div>
    </Link>
  )
}
