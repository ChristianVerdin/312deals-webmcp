import type { Metadata } from "next"
import { statsEncoded } from "@/lib/product-stats"

export const metadata: Metadata = {
  title: "Chicago Neighborhoods, Browse Deals by Area | 312Deals",
  description:
    "Browse food & drink deals across Chicago and 60+ suburbs. Find happy hours, daily specials, and brunch deals in your neighborhood.",
  alternates: { canonical: "https://www.312deals.com/neighborhoods" },
  openGraph: {
    title: "Chicago Neighborhoods, Browse Deals by Area | 312Deals",
    description: "Browse food & drink deals across Chicago and 60+ suburbs.",
    url: "https://www.312deals.com/neighborhoods",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: `https://www.312deals.com/api/og?title=Chicago+Neighborhoods&subtitle=Deals+across+${statsEncoded.neighborhoods}+neighborhoods`,
      width: 1200,
      height: 630,
      alt: "312Deals, Chicago Neighborhoods",
    }],
  },
}

export default function NeighborhoodsLayout({ children }: { children: React.ReactNode }) {
  return children
}
