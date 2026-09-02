"use client"

import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"

export default function VenueError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">Could not load venue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This venue may have moved or the page is temporarily unavailable.
        </p>
        <div className="mt-6 flex items-center gap-3">
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
