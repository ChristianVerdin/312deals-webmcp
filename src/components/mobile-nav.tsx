"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Heart, Sparkles, Search, Send, MessageSquarePlus, Megaphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { trackAdvertiseClick } from "@/lib/analytics"
import { useStore } from "@/store/use-store"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { exploreGroup, specialsGroup, guidesGroup, isGroupActive } from "./nav-config"
import type { NavGroup } from "./nav-config"

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const dropdownGroups = [exploreGroup, specialsGroup, guidesGroup]

const mobileDirectLinks = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/submit", label: "Submit a Deal", icon: Send },
  { href: "/chat", label: "AI Guide", icon: Sparkles },
]

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname()
  const savedDeals = useStore((s) => s.savedDeals)

  const close = () => onOpenChange(false)

  // Find default open accordion based on current pathname
  const defaultValue = dropdownGroups.find((g) => isGroupActive(g, pathname))?.label

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[300px] border-white/10 bg-[#1A1A2E] p-0 sm:max-w-[300px] [&>button]:text-gray-400 [&>button]:hover:text-white"
      >
        <SheetHeader className="border-b border-white/10 px-4 py-4">
          <SheetTitle className="flex items-center gap-1 text-left">
            <span className="text-lg font-bold text-brand-500">312</span>
            <span className="text-lg font-bold text-white">Deals</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-4 py-2" aria-label="Mobile navigation">
          {/* Direct links */}
          {mobileDirectLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-brand-400"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}

          {/* Advertise, B2B/owner CTA (matches the desktop nav pill) */}
          <Link
            href="/advertise"
            onClick={() => {
              trackAdvertiseClick({ cta: "Mobile Menu" })
              close()
            }}
            className="mt-1 flex items-center gap-3 rounded-lg bg-brand-500 px-3 py-2.5 text-sm font-semibold text-[#1A1A2E] transition-colors hover:bg-brand-400"
          >
            <Megaphone className="h-4 w-4" />
            Advertise
          </Link>

          {/* Accordion groups */}
          <Accordion
            type="single"
            collapsible
            defaultValue={defaultValue}
            className="mt-1"
          >
            {dropdownGroups.map((group) => (
              <MobileNavGroup
                key={group.label}
                group={group}
                pathname={pathname}
                onNavigate={close}
              />
            ))}
          </Accordion>

          {/* Feedback */}
          <a
            href="mailto:deals@312deals.com?subject=312Deals%20Feedback%20%2F%20Feature%20Request"
            onClick={close}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Feedback
          </a>

          {/* Saved */}
          <Link
            href="/saved"
            onClick={close}
            className={cn(
              "mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === "/saved"
                ? "bg-white/10 text-brand-400"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            )}
          >
            <Heart className="h-4 w-4" />
            Saved
            {savedDeals.length > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">
                {savedDeals.length}
              </span>
            )}
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function MobileNavGroup({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup
  pathname: string
  onNavigate: () => void
}) {
  const active = isGroupActive(group, pathname)

  return (
    <AccordionItem value={group.label} className="border-white/10">
      <AccordionTrigger
        className={cn(
          "px-3 py-2.5 text-sm font-medium hover:no-underline [&>svg]:text-gray-500",
          active ? "text-brand-400" : "text-gray-300"
        )}
      >
        {group.label}
      </AccordionTrigger>
      <AccordionContent className="pb-2">
        <div className="flex flex-col gap-0.5 pl-3">
          {group.links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-white/10 text-brand-400"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Link>
            )
          })}
          {group.label === "Specials" && (
            <Link
              href="/deals"
              onClick={onNavigate}
              className="mt-1 px-3 py-2 text-xs font-medium text-brand-400 transition-colors hover:text-brand-300"
            >
              View all deals &rarr;
            </Link>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
