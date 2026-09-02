"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { BLOG_CATEGORIES } from "@/lib/blog-types"
import type { BlogCategory } from "@/lib/blog-types"
import { cn } from "@/lib/utils"

const categories = Object.entries(BLOG_CATEGORIES) as [
  BlogCategory,
  { label: string; description: string },
][]

export function BlogCategoryFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const active = searchParams.get("category") ?? "all"

  function select(category: string) {
    if (category === "all") {
      router.push("/blog", { scroll: false })
    } else {
      router.push(`/blog?category=${category}`, { scroll: false })
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => select("all")}
        className={cn(
          "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          active === "all"
            ? "bg-brand-500 text-white"
            : "bg-card border border-border text-muted-foreground hover:text-foreground"
        )}
      >
        All
      </button>
      {categories.map(([key, { label }]) => (
        <button
          key={key}
          onClick={() => select(key)}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            active === key
              ? "bg-brand-500 text-white"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
