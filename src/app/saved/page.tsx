"use client"

import { Heart } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCard, DealCardSkeleton } from "@/components/deal-card"
import { SortableDealsGrid } from "@/components/sortable-deals-grid"
import { useStore } from "@/store/use-store"
import { useSavedDeals } from "@/hooks/use-deals"

export default function SavedPage() {
  const savedDeals = useStore((s) => s.savedDeals)
  const { data, isLoading } = useSavedDeals(savedDeals)

  const saved = data?.deals ?? []

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="h-5 w-5 text-brand-500" />
              <h1 className="text-2xl font-bold text-foreground">
                Saved Deals
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {savedDeals.length} deal{savedDeals.length !== 1 ? "s" : ""} saved
            </p>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <DealCardSkeleton key={i} />
              ))}
            </div>
          ) : saved.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
              <Heart className="mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">
                No saved deals yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap the heart icon on any deal to save it here.
              </p>
            </div>
          ) : (
            <SortableDealsGrid deals={saved} columns={3} />
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
