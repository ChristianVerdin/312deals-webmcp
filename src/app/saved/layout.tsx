import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Your Saved Deals, 312Deals Favorites",
  description:
    "Your saved food & drink deals on 312Deals. Quickly access your favorite happy hours, daily specials, brunch deals, and late-night offers across Chicago.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://www.312deals.com/saved" },
}

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return children
}
