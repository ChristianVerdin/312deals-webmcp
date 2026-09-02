import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function VenueLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <div className="mb-4 h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="mb-6 space-y-3">
            <div className="h-8 w-72 animate-pulse rounded bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
          <div className="h-48 w-full animate-pulse rounded-xl bg-muted" />
          <div className="mt-6 space-y-4">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
