"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Tag, Map, Clock, Megaphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { trackAdvertiseClick } from "@/lib/analytics"

// Five primary destinations max keeps the bar legible on a phone (more than ~5
// forces 2-line labels + truncation). Happy Hours lives in the menu/guides;
// Saved lives in the header + hamburger. Advertise is the amber B2B CTA.
const navItems = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/deals", label: "Deals", icon: Tag },
  { href: "/map", label: "Map", icon: Map },
  { href: "/today", label: "Today", icon: Clock },
]

const itemClass =
  "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors min-h-[48px] min-w-0 touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/60"

export function BottomNav() {
  const pathname = usePathname()

  // Hide bottom nav on the chat page, chat has its own full-height input bar
  if (pathname === "/chat") return null

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm md:hidden safe-bottom"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                itemClass,
                isActive ? "text-brand-500" : "text-muted-foreground active:text-brand-500"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "stroke-[2.5px]")} />
              <span className="max-w-full truncate whitespace-nowrap">{item.label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-brand-500" />
              )}
            </Link>
          )
        })}
        {/* Advertise, B2B/owner CTA, amber so it stands apart from the consumer tabs */}
        <Link
          href="/advertise"
          onClick={() => trackAdvertiseClick({ cta: "Bottom Nav" })}
          className={cn(itemClass, "text-brand-500 active:text-brand-400")}
        >
          <Megaphone className="h-5 w-5 shrink-0" />
          <span className="max-w-full truncate whitespace-nowrap">Advertise</span>
        </Link>
      </div>
    </nav>
  )
}
