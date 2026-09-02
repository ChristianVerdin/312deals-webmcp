import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Ask About Chicago Deals (AI Chat) | 312Deals",
  description:
    "Get instant recommendations for Chicago food & drink deals. Ask about happy hours, cheap eats, brunch spots, or deals near you. AI-powered search of 11K+ verified specials.",
  alternates: { canonical: "https://www.312deals.com/chat" },
  openGraph: {
    title: "Ask About Chicago Deals (AI Chat) | 312Deals",
    description:
      "Get instant recommendations for Chicago food & drink deals, happy hours, late-night bites, brunch, and more across Chicago and 60+ suburbs.",
    url: "https://www.312deals.com/chat",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: "https://www.312deals.com/api/og?title=AI+Deal+Guide&subtitle=Ask+about+8K%2B+Chicago+deals",
      width: 1200,
      height: 630,
      alt: "312Deals, AI Deal Guide",
    }],
  },
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
