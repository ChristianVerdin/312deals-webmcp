// Blog types and constants, safe to import from client components (no fs)

export type BlogCategory =
  | "game-day"
  | "date-night"
  | "best-of"
  | "hidden-gems"
  | "guides"

export interface BlogPostMeta {
  slug: string
  title: string
  description: string
  date: string
  /** Optional override for the human-rendered date label. Use for posts that
   *  should show "Updated May 2026" instead of a specific calendar day. */
  dateLabel?: string
  category: BlogCategory
  tags: string[]
  coverImage?: string
  author: string
  readingTime: string
  featured?: boolean
  /** Optional Q&A pairs emitted as FAQPage JSON-LD (AEO). Mirrors the prose
   *  FAQ section in the post body so answer engines can cite it. */
  faq?: { q: string; a: string }[]
}

export interface BlogPost extends BlogPostMeta {
  content: string
}

export const BLOG_CATEGORIES: Record<
  BlogCategory,
  { label: string; description: string }
> = {
  "game-day": {
    label: "Game Day",
    description:
      "Best bars for watching Bears, Cubs, Bulls, and March Madness",
  },
  "date-night": {
    label: "Date Night",
    description: "Romantic spots and bars perfect for a first date",
  },
  "best-of": {
    label: "Best Of",
    description: "The best tacos, pizza, wings, and more across Chicago",
  },
  "hidden-gems": {
    label: "Hidden Gems",
    description: "Underrated spots that deserve more recognition",
  },
  guides: {
    label: "Guides",
    description: "Neighborhood guides, seasonal tips, and how-tos",
  },
}
