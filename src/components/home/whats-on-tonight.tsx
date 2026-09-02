"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useMemo } from "react"

interface DayConfig {
  emoji: string
  heading: string
  links: { label: string; href: string }[]
  accent: string // Tailwind classes for the subtle background tint
}

const DAY_CONFIGS: Record<number, DayConfig> = {
  0: {
    // Sunday
    emoji: "\uD83C\uDFC8",
    heading: "Sunday Funday, Game Day & Brunch",
    links: [
      { label: "Game Day Deals", href: "/deals/game-day" },
      { label: "Brunch Deals", href: "/deals/brunch-deals" },
    ],
    accent:
      "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30",
  },
  1: {
    // Monday
    emoji: "\uD83C\uDF2E",
    heading: "Taco Tuesday is tomorrow",
    links: [
      { label: "Taco Tuesday", href: "/deals/taco-tuesday" },
      { label: "Happy Hours", href: "/deals/happy-hours" },
    ],
    accent:
      "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
  },
  2: {
    // Tuesday
    emoji: "\uD83C\uDF2E",
    heading: "It's Taco Tuesday",
    links: [
      { label: "Taco Tuesday", href: "/deals/taco-tuesday" },
      { label: "Daily Specials", href: "/deals/daily-specials" },
    ],
    accent:
      "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
  },
  3: {
    // Wednesday
    emoji: "\uD83C\uDF57",
    heading: "Wing Night",
    links: [
      { label: "Wing Deals", href: "/deals/wing-deals" },
      { label: "Happy Hours", href: "/deals/happy-hours" },
    ],
    accent:
      "border-orange-200 bg-orange-50/60 dark:border-orange-900 dark:bg-orange-950/30",
  },
  4: {
    // Thursday
    emoji: "\uD83C\uDF7B",
    heading: "Weekend Preview, Happy Hours & Patio Deals",
    links: [
      { label: "Happy Hours", href: "/deals/happy-hours" },
      { label: "Patio Deals", href: "/deals/patio-deals" },
      { label: "Late Night", href: "/deals/late-night" },
    ],
    accent:
      "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
  },
  5: {
    // Friday
    emoji: "\uD83C\uDF19",
    heading: "Late Night Deals Tonight",
    links: [
      { label: "Late Night", href: "/deals/late-night" },
      { label: "Happy Hours", href: "/deals/happy-hours" },
    ],
    accent:
      "border-purple-200 bg-purple-50/60 dark:border-purple-900 dark:bg-purple-950/30",
  },
  6: {
    // Saturday
    emoji: "\u2600\uFE0F",
    heading: "Brunch Deals + Patio Season",
    links: [
      { label: "Brunch Deals", href: "/deals/brunch-deals" },
      { label: "Patio Deals", href: "/deals/patio-deals" },
    ],
    accent:
      "border-yellow-200 bg-yellow-50/60 dark:border-yellow-900 dark:bg-yellow-950/30",
  },
}

function getChicagoDay(): number {
  const now = new Date()
  const chicagoTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Chicago" })
  )
  return chicagoTime.getDay()
}

export function WhatsOnTonight() {
  const config = useMemo(() => {
    const day = getChicagoDay()
    return DAY_CONFIGS[day]
  }, [])

  return (
    <section className="mx-auto max-w-7xl px-4 py-3 lg:px-6">
      <div
        className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 transition-colors ${config.accent}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0" aria-hidden="true">
            {config.emoji}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground">
              {config.heading}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {config.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary hover:border-brand-300"
                >
                  {link.label}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
