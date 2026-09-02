import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Bar Crawl Planner, Plan a Chicago Deal Crawl | 312Deals",
  description:
    "Plan a multi-stop bar crawl across Chicago neighborhoods. Optimize your route for the best happy hours, deal timing, and savings at bars near you.",
  alternates: { canonical: "https://www.312deals.com/crawl" },
}

export default function CrawlLayout({ children }: { children: React.ReactNode }) {
  return children
}
