"use client"

import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-7xl font-bold text-brand-500">500</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          We hit a snag loading this page. Try again, or head back to search.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" asChild>
            <Link href="/search">Search Deals</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  )
}
