"use client"

import { Moon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Deal } from "@/lib/types"
import { useStore } from "@/store/use-store"

interface TonightButtonProps {
  deal: Deal
  className?: string
}

export function TonightButton({ deal, className }: TonightButtonProps) {
  const stops = useStore((s) => s.tonight.stops)
  const addTonightStop = useStore((s) => s.addTonightStop)
  const removeTonightStop = useStore((s) => s.removeTonightStop)
  const existing = stops.find((s) => s.dealId === deal.id)

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (existing) {
          const res = removeTonightStop(existing.id, { force: true })
          if (res.ok) toast(`Removed ${deal.venue_name} from tonight`)
          return
        }
        addTonightStop({
          dealId: deal.id,
          venueId: deal.venue_id ?? null,
          venueName: deal.venue_name,
          venueSlug: deal.venue_slug ?? null,
          neighborhood: deal.neighborhood ?? null,
          address: deal.address ?? null,
          dealTitle: deal.title,
          dealType: deal.deal_type,
          daysAvailable: deal.days_available ?? null,
          startTime: deal.start_time,
          endTime: deal.end_time,
          isAllDay: !!deal.is_all_day,
          estimatedSavings: deal.estimated_savings_per_person,
          resyUrl: deal.resy_url ?? null,
          opentableUrl: deal.opentable_url ?? null,
          onlineOrderUrl: null,
          addedBy: "you",
          note: null,
        })
        toast(`Added ${deal.venue_name} to tonight`, { description: deal.title })
      }}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        existing
          ? "bg-brand-50 text-brand-500"
          : "bg-secondary text-muted-foreground hover:bg-brand-50 hover:text-brand-500",
        className
      )}
      aria-label={existing ? "Remove from tonight's plan" : "Add to tonight's plan"}
      title={existing ? "In tonight's plan" : "Add to tonight"}
    >
      <Moon className={cn("h-4 w-4", existing && "fill-current")} />
    </button>
  )
}
