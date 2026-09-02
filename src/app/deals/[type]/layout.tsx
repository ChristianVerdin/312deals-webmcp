import { notFound } from "next/navigation"
import { DEAL_TYPE_PAGES } from "@/lib/seo-utils"

// Guard ABOVE the page's loading.tsx Suspense boundary: an unknown deal type must
// return a real 404, not a soft-404 (the streamed 200 header would otherwise commit
// before page.tsx's notFound() runs). Static map lookup, no fetch.
export default function DealTypeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { type: string }
}) {
  if (!DEAL_TYPE_PAGES[params.type]) notFound()
  return children
}
