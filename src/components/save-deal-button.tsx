"use client"

import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/use-store"
import { trackDealSaved } from "@/lib/analytics"

interface SaveDealButtonProps {
  dealId: number
  className?: string
}

export function SaveDealButton({ dealId, className }: SaveDealButtonProps) {
  const savedDeals = useStore((s) => s.savedDeals)
  const toggleSaveDeal = useStore((s) => s.toggleSaveDeal)
  const isSaved = savedDeals.includes(dealId)

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        trackDealSaved({ action: isSaved ? "unsave" : "save" })
        toggleSaveDeal(dealId)
      }}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        isSaved
          ? "bg-brand-50 text-brand-500"
          : "bg-secondary text-muted-foreground hover:bg-brand-50 hover:text-brand-500",
        className
      )}
      aria-label={isSaved ? "Remove from saved" : "Save deal"}
    >
      <Heart
        className={cn("h-4 w-4", isSaved && "fill-current")}
      />
    </button>
  )
}
