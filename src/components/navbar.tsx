"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Search,
  Menu,
  X,
  Heart,
  Sparkles,
  Megaphone,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/use-store"
import { ThemeToggle } from "./theme-toggle"
import { MobileNav } from "./mobile-nav"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import {
  exploreGroup,
  specialsGroup,
  guidesGroup,
  isGroupActive,
} from "./nav-config"
import type { NavGroup } from "./nav-config"
import { trackAdvertiseClick } from "@/lib/analytics"

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const savedDeals = useStore((s) => s.savedDeals)

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1A1A2E]/95 backdrop-blur-sm safe-top">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 lg:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={36} height={36} className="rounded-lg" />
          <div className="flex items-center gap-0.5">
            <span className="text-xl font-bold tracking-tight text-brand-500">312</span>
            <span className="text-xl font-bold tracking-tight text-white">Deals</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {/* Search, direct link */}
          <DirectNavLink href="/search" pathname={pathname}>
            <Search className="h-4 w-4" />
            Search
          </DirectNavLink>

          {/* Mega-menu dropdowns */}
          <NavigationMenu>
            <NavigationMenuList>
              <DropdownGroup group={exploreGroup} pathname={pathname} />
              <DropdownGroup group={specialsGroup} pathname={pathname} />
              <DropdownGroup group={guidesGroup} pathname={pathname} />
            </NavigationMenuList>
          </NavigationMenu>

          {/* AI Guide, direct link. (Submit a Deal + Feedback moved to the footer to declutter the top nav.) */}
          <DirectNavLink href="/chat" pathname={pathname}>
            <Sparkles className="h-4 w-4" />
            AI Guide
          </DirectNavLink>

          {/* Advertise, B2B/owner CTA, amber pill to stand apart from consumer nav */}
          <Link
            href="/advertise"
            onClick={() => trackAdvertiseClick({ cta: "Nav Pill" })}
            className="ml-1 flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-[#1A1A2E] transition-colors hover:bg-brand-400"
          >
            <Megaphone className="h-4 w-4" />
            Advertise
          </Link>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/saved"
            className="relative hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white md:flex"
          >
            <Heart className="h-4 w-4" />
            <span>Saved</span>
            {savedDeals.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                {savedDeals.length}
              </span>
            )}
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/5 active:bg-white/10 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet nav */}
      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
    </header>
  )
}

// --- Direct nav link (no dropdown) ---

function DirectNavLink({
  href,
  pathname,
  children,
}: {
  href: string
  pathname: string
  children: React.ReactNode
}) {
  const isActive = pathname === href || pathname.startsWith(href + "/")
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-white/10 text-brand-400"
          : "text-gray-300 hover:bg-white/5 hover:text-white"
      )}
    >
      {children}
    </Link>
  )
}

// --- Dropdown group with mega-menu content ---

function DropdownGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const active = isGroupActive(group, pathname)
  const visibleLinks = group.featuredCount
    ? group.links.slice(0, group.featuredCount)
    : group.links

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className={cn(
          "h-auto rounded-lg bg-transparent px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-white/5 hover:text-white focus:bg-white/5 focus:text-white",
          "data-[state=open]:bg-white/10 data-[state=open]:text-white",
          active ? "text-brand-400" : "text-gray-300"
        )}
      >
        {group.label}
      </NavigationMenuTrigger>
      <NavigationMenuContent
        className="w-[340px] rounded-xl border border-white/10 bg-[#1A1A2E] shadow-2xl"
      >
        <div className="p-3">
          {visibleLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
            return (
              <NavigationMenuLink key={link.href} asChild>
                <Link
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                    isActive
                      ? "bg-white/10 text-brand-400"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-gray-500" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{link.label}</span>
                    {link.description && (
                      <span className="truncate text-xs text-gray-500">{link.description}</span>
                    )}
                  </div>
                </Link>
              </NavigationMenuLink>
            )
          })}
        </div>
        {group.moreHref && (
          <div className="border-t border-white/10 px-3 py-2">
            <NavigationMenuLink asChild>
              <Link
                href={group.moreHref}
                className="block text-center text-xs font-medium text-brand-400 transition-colors hover:text-brand-300"
              >
                {group.moreLabel ?? "View all"} &rarr;
              </Link>
            </NavigationMenuLink>
          </div>
        )}
      </NavigationMenuContent>
    </NavigationMenuItem>
  )
}
