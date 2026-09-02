import type { Metadata } from "next"
import { stats, statsEncoded } from "@/lib/product-stats"

export const metadata: Metadata = {
  title: "Chicago Deal Map, Find Food & Drink Deals Near You | 312Deals",
  description:
    `Interactive map of ${stats.deals} food & drink deals across Chicago. Find happy hours, daily specials, brunch deals, and late-night offers near any location in ${stats.neighborhoods} neighborhoods.`,
  alternates: { canonical: "https://www.312deals.com/map" },
  openGraph: {
    title: "Chicago Deal Map, Find Deals Near You | 312Deals",
    description: `Interactive map of ${stats.deals} food & drink deals across Chicago and 60+ suburbs.`,
    url: "https://www.312deals.com/map",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: `https://www.312deals.com/api/og?title=Chicago+Deal+Map&subtitle=11K%2B+deals+across+${statsEncoded.neighborhoods}+neighborhoods`,
      width: 1200,
      height: 630,
      alt: "312Deals, Chicago Deal Map",
    }],
  },
}

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children
}
