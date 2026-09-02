"use client"

import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"

export default function NeighborhoodError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">Could not load neighborhood</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong loading deals for this neighborhood.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" asChild>
            <Link href="/neighborhoods">All Neighborhoods</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  )
}
