import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Privacy Policy, 312Deals",
  description:
    "Privacy policy for 312Deals, Chicago's food and drink deals platform. Learn what data we collect, how we use it, and your rights.",
  alternates: { canonical: "https://www.312deals.com/privacy" },
  openGraph: {
    title: "Privacy Policy, 312Deals",
    description: "Privacy policy for 312Deals. Learn what data we collect, how we use it, and your rights.",
    url: "https://www.312deals.com/privacy",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: "https://www.312deals.com/api/og?title=Privacy+Policy&subtitle=How+we+handle+your+data",
      width: 1200,
      height: 630,
      alt: "312Deals Privacy Policy",
    }],
  },
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated: August 2026
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            312Deals (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
            operates the website at{" "}
            <a href="https://www.312deals.com" className="font-medium text-brand-500 hover:underline">
              312deals.com
            </a>
            , its associated API, and our mobile applications. This policy
            explains what information we collect, how we use it, and your
            choices regarding that information.
          </p>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Information We Collect</h2>
              <p>
                We collect minimal data. 312Deals does not require account
                creation or login, and we do not collect passwords or payment
                information.
              </p>
              <p className="mt-3 font-medium text-foreground">
                Data you provide voluntarily:
              </p>
              <ul className="ml-4 mt-2 list-disc space-y-2">
                <li>
                  <strong>Deal submissions:</strong> When you submit a deal, we
                  collect the venue name, deal description, and any address,
                  timing, or source-link details you provide. An email address
                  is optional, we use it only to confirm the submission and to
                  follow up if the deal needs clarification. We also record the
                  IP address the submission came from, to prevent spam and abuse
                  of the submission form.
                </li>
                <li>
                  <strong>Location (only if you ask for it):</strong> Features
                  like &ldquo;Deals open near you&rdquo; and the map&apos;s
                  &ldquo;Near me&rdquo; button use your device&apos;s location.
                  Nothing happens until you tap the button and grant permission,
                  we never request your location automatically. Your coordinates
                  are sent to our API to run that one search, are not written to
                  our database, and are never linked to you or used to build a
                  profile. Because the search travels as an ordinary web
                  request, the coordinates may appear in our hosting providers&apos;
                  standard server logs (see below). You can decline, or revoke
                  the permission at any time in your browser or device settings,
                  and search by neighborhood instead.
                </li>
                <li>
                  <strong>AI chat:</strong> If you use our AI chat assistant, we
                  store the messages you send and the replies you receive, along
                  with an anonymous session identifier and the page you started
                  from. We use this to fix broken answers and improve the
                  assistant. Your messages are also sent to Anthropic to generate
                  a response (see Third-Party Services). The chat has no login
                  and we do not ask for identifying information, so please do not
                  type anything into it you would not want stored.
                </li>
                <li>
                  <strong>Deal reports:</strong> When you report or confirm a
                  deal, we store the action type (e.g., &ldquo;report
                  outdated&rdquo; or &ldquo;confirm active&rdquo;), an optional
                  reason, and a one-way hash of your IP address. The hash cannot
                  be reversed to recover your actual IP address.
                </li>
                <li>
                  <strong>Email subscriptions:</strong> If you subscribe to our
                  newsletter, we store your email address. You can unsubscribe at
                  any time.
                </li>
              </ul>
              <p className="mt-3 font-medium text-foreground">
                Data collected automatically:
              </p>
              <ul className="ml-4 mt-2 list-disc space-y-2">
                <li>
                  <strong>Usage analytics:</strong> We use{" "}
                  <a
                    href="https://plausible.io/data-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-500 hover:underline"
                  >
                    Plausible Analytics
                  </a>
                  , a privacy-friendly analytics service, to understand how
                  visitors use the site (pages viewed, referrer, screen size,
                  device type, country/region). Plausible does not use cookies,
                  does not collect or store any personal data, and does not
                  build personal profiles. All data is aggregated and anonymous.
                  Plausible is GDPR, CCPA, and PECR compliant by design.
                </li>
                <li>
                  <strong>WebMCP analytics:</strong> If you use 312Deals
                  through an AI assistant, we record which tool actions were
                  invoked (parameter keys only, never values). No search queries,
                  locations, or personal data are stored through this channel.
                </li>
                <li>
                  <strong>Server logs:</strong> Our hosting providers (Vercel
                  and Railway) may collect standard server logs including IP
                  addresses, browser type, and request timestamps. These logs are
                  managed by the hosting providers under their respective privacy
                  policies.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">No User Accounts</h2>
              <p>
                312Deals does not have user accounts, passwords, or login
                systems. All deal data is publicly accessible. Saved deals use
                your browser&apos;s local storage and are never sent to our
                servers.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">How We Use Your Information</h2>
              <ul className="ml-4 list-disc space-y-2">
                <li>To display and improve deal information on the platform.</li>
                <li>To review and publish user-submitted deals.</li>
                <li>To maintain deal accuracy through community reports.</li>
                <li>To find deals near you, when you ask us to.</li>
                <li>To answer your questions in the AI chat and improve its responses.</li>
                <li>To analyze site usage and improve the user experience.</li>
                <li>To prevent abuse of our API, submission form, and reporting features.</li>
                <li>To send our newsletter (only if you subscribed).</li>
              </ul>
              <p className="mt-3">
                We do not sell, rent, or share your information with third
                parties for marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Cookies</h2>
              <p>312Deals uses a minimal number of cookies:</p>
              <ul className="ml-4 mt-2 list-disc space-y-2">
                <li>
                  <strong>Theme preference:</strong> A cookie to remember your
                  light/dark mode setting. This is a functional cookie that does
                  not track you.
                </li>
              </ul>
              <p className="mt-3">
                We do <strong>not</strong> use Google Analytics, advertising
                cookies, or third-party tracking pixels. Our analytics provider
                (Plausible) is cookie-free by design.
              </p>
              <p className="mt-3">
                We do not use advertising cookies, tracking pixels, or
                fingerprinting techniques. However, when you click an affiliate
                link (see Affiliate Links and Tracking below), the destination
                site or its tracking partner may set its own cookies under its
                own privacy policy.
              </p>
            </section>

            <section id="affiliate-links-and-tracking">
              <h2 className="mb-3 text-lg font-semibold text-foreground">Affiliate Links and Tracking</h2>
              <p>
                312Deals participates in affiliate programs that pay us a small
                commission when a visitor clicks one of our links and completes
                a qualifying action (purchase, hotel booking, restaurant
                reservation, etc.) on the partner site. This is at no extra
                cost to you, and our editorial decisions are not influenced by
                affiliate revenue.
              </p>
              <p className="mt-3 font-medium text-foreground">
                Programs we currently participate in:
              </p>
              <ul className="ml-4 mt-2 list-disc space-y-2">
                <li>
                  <strong>Amazon Associates:</strong> Some product links on our
                  guides (game-day essentials, etc.) are Amazon affiliate links.
                  As an Amazon Associate, 312Deals earns from qualifying
                  purchases.
                </li>
                <li>
                  <strong>Booking.com Affiliate Program (via Awin):</strong>{" "}
                  Lodging recommendations on our visitor-intent guides link to
                  Booking.com search results. As a Booking.com Affiliate,
                  312Deals earns from qualifying transactions.
                </li>
              </ul>
              <p className="mt-3">
                When you click an affiliate link, you may be redirected through
                the affiliate network&apos;s tracking domain (e.g.{" "}
                <code className="rounded bg-secondary px-1 py-0.5 text-xs">
                  awin1.com
                </code>{" "}
                for Awin partners,{" "}
                <code className="rounded bg-secondary px-1 py-0.5 text-xs">
                  amazon.com
                </code>{" "}
                with our tag for Amazon). The affiliate network and the
                destination site may set cookies on their own domains to
                attribute the click to 312Deals, this is the standard
                affiliate-tracking mechanism. We never receive any
                personally-identifiable information about you from these
                networks; we only see aggregated click and commission counts in
                their reporting dashboards.
              </p>
              <p className="mt-3">
                If you prefer to avoid affiliate tracking, you can manually type
                the destination site&apos;s URL into your browser instead of
                clicking the link, or block third-party cookies for the
                affiliate-network domains in your browser settings.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Third-Party Services</h2>
              <p>We use the following third-party services:</p>
              <ul className="ml-4 mt-2 list-disc space-y-2">
                <li>
                  <strong>Vercel:</strong> Website hosting.{" "}
                  <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <strong>Railway:</strong> API hosting.{" "}
                  <a href="https://railway.app/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <strong>Plausible Analytics:</strong> Privacy-friendly,
                  cookie-free, GDPR/CCPA-compliant usage analytics. No personal
                  data collected.{" "}
                  <a href="https://plausible.io/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <strong>Google Maps Platform:</strong> Venue location data
                  and map display. When a map is shown, Google receives the
                  information needed to render it, which may include device
                  identifiers and, if you have used &ldquo;Near me,&rdquo; your
                  position on the map.{" "}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <strong>Anthropic:</strong> Powers our AI chat assistant. The
                  messages you send in chat are transmitted to Anthropic&apos;s
                  API to generate a response. Anthropic processes them on our
                  behalf and does not use API inputs to train its models.{" "}
                  <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <strong>Stripe:</strong> Payment processing for businesses
                  that purchase a featured listing. Payment details are entered
                  on Stripe&apos;s own hosted checkout page, we never see or
                  store card information.{" "}
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <strong>Resend:</strong> Transactional and newsletter email
                  delivery.{" "}
                  <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <strong>Awin:</strong> Affiliate-network click tracking and
                  commission reporting for partner programs (currently
                  Booking.com).{" "}
                  <a href="https://www.awin.com/gb/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <strong>Amazon Associates:</strong> Affiliate-link tracking
                  and commission reporting for Amazon product links.{" "}
                  <a href="https://www.amazon.com/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    Privacy policy
                  </a>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">AI and API Access</h2>
              <p>
                Our API is accessed by outside AI assistants (ChatGPT, Claude,
                and others) to help people find deals. Those integrations only
                read public deal data through the same public endpoints the
                website uses, and we send them no information about you.
              </p>
              <p className="mt-3">
                Our own AI chat assistant on 312deals.com works differently: the
                messages you type there are sent to Anthropic to generate a
                reply, and are stored by us as described under Information We
                Collect.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Data Retention</h2>
              <p>
                Deal submissions and reports are retained indefinitely to
                maintain the accuracy of our database. IP hashes in deal reports
                cannot be used to identify you and are retained for abuse
                prevention. Newsletter subscriber emails are kept until you
                unsubscribe. AI chat transcripts are retained to diagnose and
                improve the assistant. Location coordinates are used to run your
                search and are not retained in our database. Server logs are
                retained according to our hosting providers&apos; standard
                retention policies.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Your Rights</h2>
              <p>
                Because we collect minimal data and do not maintain user
                accounts, there is limited personal data to access, correct, or
                delete. If you believe we hold data connected to you and would
                like it removed, contact us and we will respond within 30 days.
              </p>
              <p className="mt-3">
                If you are a California resident, you have the right to request
                disclosure of data collected about you under the CCPA. If you
                are located in the European Economic Area, you may have
                additional rights under the GDPR. Contact us to exercise these
                rights.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Children&apos;s Privacy</h2>
              <p>
                312Deals is not directed at children under 13. We do not
                knowingly collect information from children. If you believe a
                child has provided information to us, please contact us so we
                can remove it.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. Changes
                will be posted on this page with an updated &ldquo;Last
                updated&rdquo; date. Continued use of the Service after changes
                constitutes acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Contact</h2>
              <p>
                Questions or concerns about this privacy policy? Contact us at{" "}
                <a href="mailto:deals@312deals.com" className="text-brand-500 hover:underline">
                  deals@312deals.com
                </a>{" "}
                or visit our{" "}
                <Link href="/contact" className="text-brand-500 hover:underline">
                  contact page
                </Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
