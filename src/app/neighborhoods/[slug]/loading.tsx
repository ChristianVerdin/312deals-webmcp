import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCardSkeleton } from "@/components/deal-card"

export default function NeighborhoodLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <div className="mb-4 h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="mb-6">
            <div className="h-7 w-64 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <DealCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
