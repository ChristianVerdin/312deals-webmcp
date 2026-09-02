import type { Metadata } from "next"
import Link from "next/link"
import { Mail, MessageSquare, Flag, Send, ExternalLink } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Contact 312Deals, Get in Touch",
  description:
    "Contact 312Deals for questions, feedback, partnership inquiries, or to report incorrect deal information. Email us at deals@312deals.com. Follow us on X, Instagram, Facebook, and TikTok.",
  alternates: { canonical: "https://www.312deals.com/contact" },
  openGraph: {
    title: "Contact 312Deals, Get in Touch",
    description: "Contact 312Deals for questions, feedback, or partnership inquiries. Email deals@312deals.com.",
    url: "https://www.312deals.com/contact",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: "https://www.312deals.com/api/og?title=Contact+312Deals&subtitle=Questions%2C+feedback%2C+or+partnerships",
      width: 1200,
      height: 630,
      alt: "Contact 312Deals",
    }],
  },
}

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "ContactPage",
                "name": "Contact 312Deals",
                "url": "https://www.312deals.com/contact",
                "description": "Contact 312Deals for questions, feedback, partnership inquiries, or to report incorrect deal information.",
                "mainEntity": {
                  "@type": "Organization",
                  "name": "312Deals",
                  "url": "https://www.312deals.com",
                  "email": "deals@312deals.com",
                  "sameAs": [
                    "https://x.com/312deals",
                    "https://www.instagram.com/312deals",
                    "https://www.facebook.com/312Deals",
                    "https://www.tiktok.com/@312deals",
                    "https://www.linkedin.com/company/312deals",
                  ],
                },
                "dateModified": "2026-03-03",
              }),
            }}
          />
          <h1 className="text-3xl font-bold text-foreground">Contact Us</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Whether you have a question, spotted an error, or want to
            collaborate, we&apos;re here to help. 312Deals is a one-person
            operation, so you&apos;re always talking directly to the person
            who built it. Choose the best way to reach us below.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <Mail className="mb-3 h-6 w-6 text-brand-500" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground">Email us</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                General questions, feedback, press inquiries, or anything else
                on your mind. This is the fastest way to reach us.
              </p>
              <a
                href="mailto:deals@312deals.com"
                className="mt-3 inline-block text-sm font-medium text-brand-500 hover:underline"
              >
                deals@312deals.com
              </a>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <Send className="mb-3 h-6 w-6 text-brand-500" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground">Submit a deal</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Know a great deal we haven&apos;t listed yet? Submit it and
                we&apos;ll review it within 48 hours. No account needed.
              </p>
              <Link
                href="/submit"
                className="mt-3 inline-block text-sm font-medium text-brand-500 hover:underline"
              >
                Submit a deal &rarr;
              </Link>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <Flag className="mb-3 h-6 w-6 text-brand-500" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground">Report an issue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Found an outdated or incorrect deal? Use the report button on
                any deal card, or let us know directly. Include the venue name
                and deal details so we can investigate quickly.
              </p>
              <a
                href="mailto:deals@312deals.com?subject=Deal%20Report"
                className="mt-3 inline-block text-sm font-medium text-brand-500 hover:underline"
              >
                Report by email
              </a>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <MessageSquare className="mb-3 h-6 w-6 text-brand-500" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground">Partnerships</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Restaurant owner or local business? We&apos;d love to feature
                your deals. Reach out about featured listings, newsletter
                placements, or data partnerships.
              </p>
              <a
                href="mailto:deals@312deals.com?subject=Partnership%20Inquiry"
                className="mt-3 inline-block text-sm font-medium text-brand-500 hover:underline"
              >
                Partner with us
              </a>
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-border bg-card/50 p-6">
            <h2 className="text-lg font-semibold text-foreground">Response time</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We typically reply within 24 hours on business days. Deal
              submissions are reviewed within 48 hours. If you&apos;re reporting
              an accuracy issue, include the venue name and deal details so we
              can investigate quickly.
            </p>
          </div>

          {/* Social media links */}
          <h2 className="mt-10 text-xl font-semibold text-foreground">Follow us</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Stay up to date with the latest deals, neighborhood spotlights,
            and Chicago food news.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <a
              href="https://x.com/312deals"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <div>
                <span className="text-sm font-semibold text-foreground">X / Twitter</span>
                <p className="mt-0.5 text-xs text-muted-foreground">@312deals, Deal drops, neighborhood stats, and city data.</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </a>
            <a
              href="https://www.instagram.com/312deals"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <div>
                <span className="text-sm font-semibold text-foreground">Instagram</span>
                <p className="mt-0.5 text-xs text-muted-foreground">@312deals, Deal cards, carousels, and neighborhood guides.</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </a>
            <a
              href="https://www.facebook.com/312Deals"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <div>
                <span className="text-sm font-semibold text-foreground">Facebook</span>
                <p className="mt-0.5 text-xs text-muted-foreground">312Deals, City and suburban deal roundups.</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </a>
            <a
              href="https://www.tiktok.com/@312deals"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <div>
                <span className="text-sm font-semibold text-foreground">TikTok</span>
                <p className="mt-0.5 text-xs text-muted-foreground">@312deals, Coming soon.</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </a>
          </div>

          {/* Newsletter CTA */}
          <div className="mt-10 rounded-xl border border-brand-300/30 bg-brand-500/5 p-6">
            <h2 className="text-lg font-semibold text-foreground">Get the Deal Sheet</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Our free weekly newsletter drops every Thursday with the 5 best
              food and drink deals of the week, curated picks from city and
              suburbs. No spam, unsubscribe anytime.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Subscribe on{" "}
              <Link href="/" className="font-medium text-brand-500 hover:underline">
                our homepage
              </Link>{" "}
              or email{" "}
              <a href="mailto:deals@312deals.com?subject=Subscribe%20to%20Deal%20Sheet" className="font-medium text-brand-500 hover:underline">
                deals@312deals.com
              </a>{" "}
              with &ldquo;subscribe&rdquo; in the subject line.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
