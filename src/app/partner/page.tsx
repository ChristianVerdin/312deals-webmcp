import type { Metadata } from "next"
import Link from "next/link"
import {
  HeartHandshake,
  Building2,
  Megaphone,
  Newspaper,
  Landmark,
  Mail,
  Check,
} from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { stats } from "@/lib/product-stats"

export const metadata: Metadata = {
  title: "Partner With 312Deals, Restaurant Groups, Agencies & Media",
  description:
    "One relationship, every neighborhood. 312Deals partners with restaurant groups, marketing agencies, publishers, and neighborhood organizations to promote venues and share verified Chicago deals data.",
  alternates: { canonical: "https://www.312deals.com/partner" },
  openGraph: {
    title: "Partner With 312Deals",
    description:
      "Restaurant groups, agencies, media, and neighborhood orgs: promote your venues or clients across every Chicago neighborhood, and surface them in AI assistants.",
    url: "https://www.312deals.com/partner",
    siteName: "312Deals",
    type: "website",
  },
}

const CONTACT = "mailto:deals@312deals.com?subject=Partnership%20Inquiry"

const PARTNERS = [
  {
    icon: Building2,
    title: "Restaurant groups",
    body: "Feature every concept in your portfolio across the exact neighborhoods each one sits in, happy hours, prix-fixe nights, events, with one relationship and zero per-venue lift. We already list venues from most major Chicago groups.",
  },
  {
    icon: Megaphone,
    title: "Marketing & PR agencies",
    body: "Add a hyperlocal distribution channel for your food-and-drink clients. Send us their promotions, we surface them across the right neighborhoods and in AI assistants, a value-add you can offer every client.",
  },
  {
    icon: Newspaper,
    title: "Media & publishers",
    body: `Pull from a live database of ${stats.deals} verified Chicago deals, tagged by neighborhood and category, instead of compiling roundups by hand. A data feed with attribution that saves your team time.`,
  },
  {
    icon: Landmark,
    title: "Chambers & neighborhood orgs",
    body: "Make 312Deals the official deals partner for your district, a free visibility perk for your restaurant and bar members, plus a monthly deal-intelligence report on what's running in your area.",
  },
]

export default function PartnerPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" /> For groups, agencies, media &amp; civic partners
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Partner with 312Deals</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            312Deals is Chicago&apos;s largest hyperlocal food and drink deals network, {stats.deals} verified deals
            across {stats.venues} venues and {stats.neighborhoods} neighborhoods, ranking on page one of Google and increasingly cited
            by AI assistants like ChatGPT and Claude. If you represent many venues, many clients, or a whole
            district, one partnership reaches all of them at once.
          </p>

          {/* Which is right for you */}
          <p className="mt-4 max-w-2xl rounded-xl border border-border bg-card/50 p-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Partnering is different from advertising.</span>{" "}
            Advertising is a one-off purchase for a single venue (a $39 featured listing or a newsletter slot). Partnering is an ongoing relationship for organizations with many venues, many clients, or a whole district. Just one venue?{" "}
            <Link href="/advertise" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Advertise instead →</Link>
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PARTNERS.map((p) => (
              <div key={p.title} className="rounded-xl border border-border bg-card p-5">
                <p.icon className="mb-3 h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">{p.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
            <h2 className="text-xl font-bold text-foreground">Why it works</h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> People come to 312Deals already deciding where to eat and drink, high intent, hyperlocal.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> Your venues surface when someone asks an AI assistant &ldquo;where should I go in [neighborhood]?&rdquo;</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> Coverage is equal across the city and suburbs, not just the wealthy neighborhoods.</li>
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={CONTACT}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Mail className="h-4 w-4" /> Start a partnership
              </a>
              <span className="text-xs text-muted-foreground">
                Email <a href={CONTACT} className="font-medium text-brand-600 hover:underline dark:text-brand-400">deals@312deals.com</a> and tell us who you represent.
              </span>
            </div>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Just one venue?{" "}
            <Link href="/advertise" className="font-medium text-brand-600 hover:underline dark:text-brand-400">See advertising options →</Link>{" "}
            or{" "}
            <Link href="/featured" className="font-medium text-brand-600 hover:underline dark:text-brand-400">feature your venue for $39 →</Link>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
