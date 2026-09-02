import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Submit a Chicago Deal | 312Deals",
  description:
    "Know a great food or drink deal in Chicago? Submit it to 312Deals and help fellow deal-hunters discover happy hours, specials, and discounts near them.",
  alternates: { canonical: "https://www.312deals.com/submit" },
}

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return children
}
