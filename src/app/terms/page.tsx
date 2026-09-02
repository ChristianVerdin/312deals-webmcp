import { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Terms of Service, 312Deals Usage Agreement",
  description: "Terms of service for 312Deals, Chicago's food and drink deals platform. Usage agreement covering deal accuracy, API access, newsletter, and community guidelines.",
  alternates: { canonical: "https://www.312deals.com/terms" },
  openGraph: {
    title: "Terms of Service, 312Deals",
    description: "Terms of service for 312Deals. Usage agreement covering deal accuracy, API access, and community guidelines.",
    url: "https://www.312deals.com/terms",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: "https://www.312deals.com/api/og?title=Terms+of+Service&subtitle=312Deals+usage+agreement",
      width: 1200,
      height: 630,
      alt: "312Deals Terms of Service",
    }],
  },
}

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              "name": "Terms of Service, 312Deals",
              "url": "https://www.312deals.com/terms",
              "description": "Terms of service for 312Deals, Chicago's food and drink deals platform.",
              "datePublished": "2026-02-18",
              "dateModified": "2026-05-06",
              "publisher": {
                "@type": "Organization",
                "name": "312Deals",
                "url": "https://www.312deals.com",
              },
            }),
          }}
        />
        <h1 className="mb-8 text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="mb-6 text-sm text-muted-foreground">Last updated: May 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Acceptance of Terms</h2>
            <p>
              By accessing 312Deals (&quot;the Service&quot;), including our website at
              312deals.com and our API, you agree to these terms. If you do not agree, do not
              use the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Description of Service</h2>
            <p>
              312Deals is a free platform that aggregates food and drink deals from restaurants
              and bars across Chicago. We provide deal information through our website, REST
              API, and AI assistant integrations.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Deal Accuracy Disclaimer</h2>
            <p>
              Deal information is collected from public sources and user submissions. While we
              strive for accuracy, <strong>deals may change without notice</strong>. Prices,
              hours, availability, and terms are set by individual restaurants and may differ
              from what is listed. Always confirm deals directly with the venue before visiting.
            </p>
            <p className="mt-2">
              312Deals is not responsible for deals that have ended, changed, or been
              misrepresented. We do not guarantee the availability of any deal.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">API Usage</h2>
            <ul className="ml-4 list-disc space-y-2">
              <li>The 312Deals API is available for personal and commercial use.</li>
              <li>Rate limits apply: 60 requests/minute for search endpoints, 120/minute for autocomplete.</li>
              <li>Do not attempt to circumvent rate limits or overload the API.</li>
              <li>We reserve the right to block access for abusive usage patterns.</li>
              <li>API responses may be cached. Data freshness is not guaranteed in real-time.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">User Submissions</h2>
            <p>
              By submitting a deal tip, you confirm that the information is accurate to the best
              of your knowledge. Submissions are reviewed before being published. We may edit
              submissions for clarity.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Newsletter and Email</h2>
            <ul className="ml-4 list-disc space-y-2">
              <li>By subscribing to our newsletter, you consent to receive weekly email communications.</li>
              <li>We send the &ldquo;Deal Sheet&rdquo; newsletter on Thursdays with curated deal picks.</li>
              <li>You can unsubscribe at any time via the one-click unsubscribe link in every email.</li>
              <li>We do not sell or share subscriber email addresses with third parties.</li>
              <li>Emails are delivered via Resend. Your email address is stored securely and used only for newsletter delivery.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Affiliate Disclosure</h2>
            <p>
              312Deals participates in affiliate programs and may earn a
              commission when you click certain outbound links and complete a
              qualifying action (purchase, hotel booking, restaurant
              reservation, etc.) on the partner site. <strong>This is at no
              extra cost to you.</strong> Affiliate revenue helps us keep
              312Deals free and does not influence our editorial decisions
              about which deals or venues we feature.
            </p>
            <p className="mt-3">
              Per the Federal Trade Commission&apos;s Endorsement Guides (16
              CFR Part 255), we disclose the following relationships:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>
                <strong>Amazon Associates Program:</strong> As an Amazon
                Associate, 312Deals earns from qualifying purchases.
              </li>
              <li>
                <strong>Booking.com Affiliate Program (via Awin):</strong> As a
                Booking.com Affiliate, 312Deals earns from qualifying
                transactions.
              </li>
            </ul>
            <p className="mt-3">
              We may participate in additional affiliate programs in the
              future; this Terms page and our{" "}
              <a href="/privacy" className="text-brand-500 hover:underline">
                Privacy Policy
              </a>{" "}
              will be updated when we do. Outbound affiliate links are marked
              with{" "}
              <code className="rounded bg-secondary px-1 py-0.5 text-xs">
                rel=&quot;sponsored&quot;
              </code>{" "}
              in their HTML, consistent with search-engine and consumer
              transparency standards.
            </p>
            <p className="mt-3">
              For details on how affiliate-network click tracking works and
              what cookies may be set on third-party domains when you click an
              affiliate link, see the{" "}
              <a href="/privacy#affiliate-links-and-tracking" className="text-brand-500 hover:underline">
                Affiliate Links and Tracking
              </a>{" "}
              section of our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Intellectual Property</h2>
            <p>
              Deal data aggregated by 312Deals is factual information and is not subject to
              copyright. Our website design, branding, and original content are owned by
              312Deals. Venue names and trademarks belong to their respective owners.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">No Warranty</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind, express
              or implied. We do not warrant that the Service will be uninterrupted, error-free,
              or that deal information will be accurate or current.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Limitation of Liability</h2>
            <p>
              312Deals shall not be liable for any indirect, incidental, or consequential
              damages arising from your use of the Service. Our total liability shall not exceed
              the amount you paid for the Service (which is free for the base tier).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Changes to Terms</h2>
            <p>
              We may update these terms at any time. Continued use of the Service after changes
              constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Contact</h2>
            <p>
              Questions about these terms? Email us at{" "}
              <a href="mailto:deals@312deals.com" className="text-brand-500 hover:underline">
                deals@312deals.com
              </a>
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </>
  )
}
