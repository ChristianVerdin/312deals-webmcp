import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DealCardSkeleton } from "@/components/deal-card"

export default function SearchLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
          <p className="text-2xl font-bold text-foreground" role="status">Loading deals...</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
