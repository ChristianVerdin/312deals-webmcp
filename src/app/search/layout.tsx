import type { Metadata } from "next"
import { stats, statsEncoded } from "@/lib/product-stats"

export const metadata: Metadata = {
  description:
    "Search 11K+ Chicago food & drink deals, happy hours, brunch specials, cheap eats, daily deals by neighborhood, day, cuisine, and price. All free, updated weekly.",
  alternates: { canonical: "https://www.312deals.com/search" },
  openGraph: {
    title: "Search Chicago Food & Drink Deals | 312Deals",
    description: `Search ${stats.deals} food & drink deals across Chicago and 60+ suburbs, happy hours, brunch, cheap eats, and more.`,
    url: "https://www.312deals.com/search",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: `https://www.312deals.com/api/og?title=Search+Chicago+Deals&subtitle=11K%2B+deals+across+${statsEncoded.neighborhoods}+neighborhoods`,
      width: 1200,
      height: 630,
      alt: "312Deals, Search Chicago Deals",
    }],
  },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
