import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Track404 } from "@/components/track-404"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Track404 />
      <Navbar />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-7xl font-bold text-brand-500">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          Page not found
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          {"This deal may have expired, or the page doesn't exist. Try searching for what you're looking for."}
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button asChild>
            <Link href="/search">Search Deals</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  )
}
