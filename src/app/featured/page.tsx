import type { Metadata } from "next"
import Link from "next/link"
import { Sparkles, Check, ArrowUpNarrowWide, BadgeCheck, Mail, ExternalLink } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { sponsorshipCheckoutUrl, sponsorshipCtaHref } from "@/lib/sponsorship"

export const metadata: Metadata = {
  title: "Feature Your Venue on 312Deals, Reach Chicago Deal-Seekers",
  description:
    "Get your restaurant or bar in front of Chicagoans actively searching for where to eat and drink tonight. Featured venues sort first across 312Deals and carry a premium badge.",
  alternates: { canonical: "https://www.312deals.com/featured" },
  openGraph: {
    title: "Feature Your Venue on 312Deals",
    description:
      "Featured venues sort first across every neighborhood and deal-type page on 312Deals, plus a premium badge. Reach Chicagoans deciding where to go.",
    url: "https://www.312deals.com/featured",
    siteName: "312Deals",
    type: "website",
  },
}

const BENEFITS = [
  {
    icon: ArrowUpNarrowWide,
    title: "Top of every search",
    body: "Your deals sort first on the neighborhood, search, and deal-type pages your future customers already browse.",
  },
  {
    icon: BadgeCheck,
    title: "A premium ‘Featured’ badge",
    body: "An amber Featured badge on every one of your deal cards, instant credibility and a visual cut above the list.",
  },
  {
    icon: Sparkles,
    title: "Newsletter inclusion",
    body: "Priority consideration for The Deal Sheet, our weekly email to Chicago deal-seekers across the city and suburbs.",
  },
]

export default function FeaturedPage() {
  const hasStripe = sponsorshipCheckoutUrl() !== null
  const ctaHref = sponsorshipCtaHref()
  const ctaLabel = hasStripe ? "Get Featured" : "Get in touch"

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> For restaurants &amp; bars
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Feature your venue on 312Deals</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            312Deals is where Chicagoans go to decide where to eat and drink, tens of thousands of live deals across the
            city and suburbs, ranking on page one of Google for the searches your customers are already running. It is a
            genuinely local audience, <span className="font-semibold text-foreground">81% of visitors are in Chicagoland</span>,
            mostly on their phone deciding where to go tonight. A featured listing puts your venue at the front of that line.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-xl border border-border bg-card p-5">
                <b.icon className="mb-3 h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">{b.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
            <h2 className="text-xl font-bold text-foreground">How it works</h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> Tell us your venue and the dates you want to run.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> We flag your listing, it sorts first and gets the Featured badge across the site.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> Your existing deals keep updating automatically; nothing else changes on your end.</li>
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={ctaHref}
                target={hasStripe ? "_blank" : undefined}
                rel={hasStripe ? "noopener noreferrer" : undefined}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                {hasStripe ? <Sparkles className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                {ctaLabel}
                {hasStripe && <ExternalLink className="h-3.5 w-3.5" />}
              </a>
              <span className="text-xs text-muted-foreground">
                Questions? Email <a href="mailto:deals@312deals.com" className="font-medium text-brand-600 hover:underline dark:text-brand-400">deals@312deals.com</a>.
              </span>
            </div>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Not a venue owner?{" "}
            <Link href="/" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Browse Chicago deals →</Link>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
