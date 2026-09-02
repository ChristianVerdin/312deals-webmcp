import type { Metadata } from "next"
import Link from "next/link"
import {
  Sparkles,
  Check,
  ArrowUpNarrowWide,
  BadgeCheck,
  Mail,
  ExternalLink,
  Trophy,
  Newspaper,
  Megaphone,
  HeartHandshake,
} from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { AdvertiseCta } from "@/components/advertise-cta"
import { sponsorshipCtaHref } from "@/lib/sponsorship"

export const metadata: Metadata = {
  title: "Advertise on 312Deals, Reach Chicago Diners (and the AI They Ask)",
  description:
    "Put your restaurant, bar, or brand in front of Chicagoans deciding where to eat and drink, and the AI assistants they ask. Featured venue listings from $39, plus newsletter and guide sponsorships.",
  alternates: { canonical: "https://www.312deals.com/advertise" },
  openGraph: {
    title: "Advertise on 312Deals",
    description:
      "Featured venue listings from $39, plus newsletter and guide sponsorships. Reach Chicago deal-seekers across the city and suburbs.",
    url: "https://www.312deals.com/advertise",
    siteName: "312Deals",
    type: "website",
  },
}

const STATS = [
  { figure: "81%", label: "of visitors are in Chicagoland (57% Chicago proper)" },
  { figure: "5,000+", label: "Chicago-area visitors a month, up ~8x this quarter" },
  { figure: "Page 1", label: "of Google for local deal searches" },
  { figure: "ChatGPT + Claude", label: "cite our deals via MCP" },
]

const CONTACT = "mailto:deals@312deals.com?subject=Advertising%20Inquiry"

export default function AdvertisePage() {
  const stripeLink = sponsorshipCtaHref()

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Megaphone className="h-3.5 w-3.5" aria-hidden="true" /> For restaurants, bars &amp; brands
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Advertise on 312Deals</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            312Deals is where Chicagoans decide where to eat and drink, and increasingly where the AI
            assistants they ask get their answers. This is a genuinely local audience, <span className="font-semibold text-foreground">81% of our visitors are in Chicagoland</span> and most are on their phone deciding where to go tonight. We rank on page one of Google for the searches your customers are already running, across the city and the suburbs. Advertising puts your venue at the front of that line.
          </p>

          {/* Which is right for you */}
          <p className="mt-4 max-w-2xl rounded-xl border border-border bg-card/50 p-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Three ways to reach diners.</span>{" "}
            <span className="font-semibold text-foreground">Advertising</span> (you&apos;re here) puts a single venue or brand at the front of search and the guides, starting at $39. A <span className="font-semibold text-foreground">newsletter sponsorship</span> (below) puts your brand in our weekly Deal Sheet email. Represent many venues, clients, or a whole district?{" "}
            <Link href="/partner" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Partner with us →</Link>
          </p>

          {/* Proof */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="text-lg font-bold text-foreground">{s.figure}</div>
                <div className="mt-1 text-xs leading-snug text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Traffic up roughly 8x in the last quarter, with growing referrals from AI assistants. Free for
            the people searching; you only pay to stand out.
          </p>

          {/* Featured listing, self-serve */}
          <div className="mt-10 rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ArrowUpNarrowWide className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <h2 className="text-xl font-bold text-foreground">Featured venue listing</h2>
                </div>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground">
                  Your venue sorts first across the neighborhood, search, and deal-type pages locals already
                  browse, with a premium <span className="font-semibold">★ Featured</span> badge on every
                  deal card and priority in our weekly newsletter.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-2xl font-bold text-foreground">$39</div>
                <div className="text-xs text-muted-foreground">one-time</div>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-foreground">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> Top of search in your neighborhood + on every relevant deal-type page.</li>
              <li className="flex gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" /> Amber ★ Featured badge on all your deal cards.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> Your existing deals keep updating automatically, nothing to build.</li>
            </ul>

            <div className="mt-5 rounded-xl border border-amber-400/60 bg-white/60 p-4 dark:bg-black/20">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" /> Bears Season Spotlight, kickoff September 10
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Football season is our biggest traffic run of the fall, five months of game days through January.
                Lock your game-day placement before Week 1.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <AdvertiseCta
                href={stripeLink}
                cta="Get Featured ($39)"
                newTab
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Sparkles className="h-4 w-4" /> Get featured, $39 <ExternalLink className="h-3.5 w-3.5" />
              </AdvertiseCta>
              <span className="text-xs text-muted-foreground">
                Prefer the full breakdown first?{" "}
                <Link href="/featured" className="font-medium text-brand-600 hover:underline dark:text-brand-400">See how featuring works →</Link>
              </span>
            </div>
          </div>

          {/* Other paid options */}
          <h2 className="mt-12 text-xl font-bold text-foreground">Bigger reach</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <Newspaper className="mb-3 h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Newsletter sponsorship</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Put your brand in front of our weekly &ldquo;Deal Sheet&rdquo; audience of Chicagoans actively
                deciding where to go. Single issue or a multi-week run.
              </p>
              <AdvertiseCta href={CONTACT} cta="Newsletter Sponsorship" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                <Mail className="h-3.5 w-3.5" /> Ask about sponsor slots
              </AdvertiseCta>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Sparkles className="mb-3 h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Guide &amp; category sponsorship</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Own a high-traffic guide, Happy Hours, Game Day, Patio Season, Cubs Game Day, or a deal
                category page, with a featured placement and brand callout.
              </p>
              <AdvertiseCta href={CONTACT} cta="Guide Sponsorship" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                <Mail className="h-3.5 w-3.5" /> Ask about guide sponsorships
              </AdvertiseCta>
            </div>
          </div>

          {/* Partner pointer */}
          <div className="mt-12 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <h2 className="text-lg font-bold text-foreground">Running a restaurant group, agency, or media outlet?</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              One relationship can put all your concepts, or all your clients, in front of locals across every
              neighborhood they sit in. We also offer data partnerships for publishers and neighborhood orgs.
            </p>
            <AdvertiseCta href="/partner" cta="Partner" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Partner with 312Deals →
            </AdvertiseCta>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Questions about any of this? Email{" "}
            <a href={CONTACT} className="font-medium text-brand-600 hover:underline dark:text-brand-400">deals@312deals.com</a>{" "}
            and we&apos;ll get you set up. Not a venue owner?{" "}
            <Link href="/" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Browse Chicago deals →</Link>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
