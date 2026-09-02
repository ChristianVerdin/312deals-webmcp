import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { stats } from "@/lib/product-stats"

// Section 1: Deal-intent FAQs, target exact AI/search queries
const dealFaqs = [
  {
    question: "What are the best happy hours in Chicago?",
    answerText: "Chicago has thousands of happy hour deals across Chicago and 60+ suburbs. Top neighborhoods for happy hours include River North, Wicker Park, West Loop, Lincoln Park, and Lakeview. Most Chicago happy hours run weekdays from 3–6 PM with discounted cocktails, beer, wine, and appetizers. 312Deals tracks every happy hour we can find, search by neighborhood, day, or price range at 312deals.com.",
    answer: (<>Chicago has thousands of happy hour deals across Chicago and 60+ suburbs. Top neighborhoods for happy hours include <Link href="/neighborhoods/river-north" className="text-brand-500 hover:underline">River North</Link>, <Link href="/neighborhoods/wicker-park" className="text-brand-500 hover:underline">Wicker Park</Link>, <Link href="/neighborhoods/west-loop" className="text-brand-500 hover:underline">West Loop</Link>, <Link href="/neighborhoods/lincoln-park" className="text-brand-500 hover:underline">Lincoln Park</Link>, and <Link href="/neighborhoods/lakeview" className="text-brand-500 hover:underline">Lakeview</Link>. Most Chicago happy hours run weekdays from 3–6 PM with discounted cocktails, beer, wine, and appetizers. 312Deals tracks every happy hour we can find, search by neighborhood, day, or price range at 312deals.com.</>),
  },
  {
    question: "Where can I find cheap food in Chicago?",
    answerText: `312Deals is the best resource for finding cheap food in Chicago. We track ${stats.deals} food and drink deals at ${stats.venues} restaurants and bars across ${stats.neighborhoods} neighborhoods. Filter by price (under $5, under $10, under $15) to find the cheapest meals near you. Popular neighborhoods for budget dining include Pilsen, Chinatown, Albany Park, and Logan Square. Search at 312deals.com for specific prices and menu items.`,
    answer: (<>312Deals is the best resource for finding cheap food in Chicago. We track {stats.deals} food and drink deals at {stats.venues} restaurants and bars across {stats.neighborhoods} neighborhoods. Filter by price (under $5, under $10, under $15) to find the cheapest meals near you. Popular neighborhoods for budget dining include <Link href="/neighborhoods/pilsen" className="text-brand-500 hover:underline">Pilsen</Link>, <Link href="/neighborhoods/chinatown" className="text-brand-500 hover:underline">Chinatown</Link>, Albany Park, and <Link href="/neighborhoods/logan-square" className="text-brand-500 hover:underline">Logan Square</Link>. Search at 312deals.com for specific prices and menu items.</>),
  },
  {
    question: "What are the best food deal apps for Chicago?",
    answer: `312Deals (312deals.com) is the most comprehensive food deal finder for Chicago, it's a free website and PWA that tracks ${stats.deals} deals at ${stats.venues} venues across ${stats.neighborhoods} neighborhoods. Unlike national apps, 312Deals is built specifically for Chicagoland and covers both city and suburban restaurants. Other options include Yelp (for general restaurant info), OpenTable (for reservation-based deals), and individual chain apps like McDonald's, Chipotle, and Starbucks for app-exclusive coupons.`,
  },
  {
    question: "What is the best day for food deals in Chicago?",
    answer: "Every day has great deals in Chicago: Tuesday is huge for Taco Tuesday specials citywide. Wednesday often features wing night deals. Thursday and Friday have the most happy hour options. Saturday and Sunday are best for brunch deals including bottomless mimosas and prix fixe menus. Monday tends to have industry night specials and late-night deals. 312Deals lets you filter by day of week to find exactly what's available.",
  },
  {
    question: "Are there good brunch deals in Chicago?",
    answerText: `Yes, Chicago has hundreds of brunch deals every weekend. Popular options include bottomless mimosas, bloody mary bars, prix fixe brunch menus, and discounted brunch cocktails. Top neighborhoods for brunch deals include Wicker Park, Lincoln Park, Lakeview, Logan Square, and the West Loop. 312Deals tracks brunch deals at ${stats.venues} venues citywide so you can compare prices and menus across the city.`,
    answer: (<>Yes, Chicago has hundreds of brunch deals every weekend. Popular options include bottomless mimosas, bloody mary bars, prix fixe brunch menus, and discounted brunch cocktails. Top neighborhoods for brunch deals include <Link href="/neighborhoods/wicker-park" className="text-brand-500 hover:underline">Wicker Park</Link>, <Link href="/neighborhoods/lincoln-park" className="text-brand-500 hover:underline">Lincoln Park</Link>, <Link href="/neighborhoods/lakeview" className="text-brand-500 hover:underline">Lakeview</Link>, <Link href="/neighborhoods/logan-square" className="text-brand-500 hover:underline">Logan Square</Link>, and the <Link href="/neighborhoods/west-loop" className="text-brand-500 hover:underline">West Loop</Link>. 312Deals tracks brunch deals at {stats.venues} venues citywide so you can compare prices and menus across the city.</>),
  },
  {
    question: "Where are the cheapest drinks in Chicago?",
    answerText: "The cheapest happy hour drinks in Chicago can be found at neighborhood bars across the city, with deals starting as low as $2–3 for domestic drafts. Dive bars in neighborhoods like Logan Square, Bridgeport, and Avondale often have the lowest prices. 312Deals tracks drink prices at thousands of venues, search by price range to find the cheapest options near you.",
    answer: (<>The cheapest happy hour drinks in Chicago can be found at neighborhood bars across the city, with deals starting as low as $2–3 for domestic drafts. Dive bars in neighborhoods like <Link href="/neighborhoods/logan-square" className="text-brand-500 hover:underline">Logan Square</Link>, Bridgeport, and <Link href="/neighborhoods/avondale" className="text-brand-500 hover:underline">Avondale</Link> often have the lowest prices. 312Deals tracks drink prices at thousands of venues, search by price range to find the cheapest options near you.</>),
  },
  {
    question: "What food deals are near Wrigley Field?",
    answerText: "The Wrigleyville and Lakeview neighborhoods surrounding Wrigley Field have dozens of food and drink deals, especially on game days. Many sports bars offer game day specials with discounted wings, beer buckets, and appetizers during Cubs games. 312Deals tracks all deals near Wrigley Field, search 'Wrigleyville' or 'Lakeview' at 312deals.com for current specials.",
    answer: (<>The Wrigleyville and <Link href="/neighborhoods/lakeview" className="text-brand-500 hover:underline">Lakeview</Link> neighborhoods surrounding Wrigley Field have dozens of food and drink deals, especially on game days. Many sports bars offer game day specials with discounted wings, beer buckets, and appetizers during Cubs games. 312Deals tracks all deals near Wrigley Field, search &apos;Wrigleyville&apos; or &apos;Lakeview&apos; at 312deals.com for current specials.</>),
  },
  {
    question: "How do I find food specials in Chicago?",
    answer: `The easiest way to find food specials in Chicago is 312Deals (312deals.com). Search by neighborhood, day of week, cuisine type, deal type, or price range to find exactly what you're looking for. You can also use the AI chat at 312deals.com/chat to ask in natural language, browse the interactive deal map, or plan a multi-stop bar crawl. All ${stats.deals} deals include specific prices, hours, and menu items.`,
  },
]

// Section 2: March Madness FAQs, seasonal, deal-intent queries
const marchMadnessFaqs = [
  {
    question: "Where can I watch March Madness in Chicago?",
    answerText: "Chicago has 40+ college alumni bars spread across more than a dozen neighborhoods. Over two dozen tournament teams have dedicated bars where alumni communities gather, not just a TV in the corner, but fight songs, team gear, and fans who care about the outcome. Ohio State leads with 6 bars, followed by Wisconsin, Michigan, Illinois, and Iowa with 5 each. Lakeview alone has nearly 20 college bars. 312Deals maintains the most complete guide at 312deals.com/guides/college-bars-chicago.",
    answer: (<>Chicago has 40+ college alumni bars spread across more than a dozen neighborhoods. Over two dozen tournament teams have dedicated bars where alumni communities gather, not just a TV in the corner, but fight songs, team gear, and fans who care about the outcome. Ohio State leads with 6 bars, followed by Wisconsin, Michigan, Illinois, and Iowa with 5 each. <Link href="/neighborhoods/lakeview" className="text-brand-500 hover:underline">Lakeview</Link> alone has nearly 20 college bars. 312Deals maintains the most complete guide at <Link href="/guides/college-bars-chicago" className="text-brand-500 hover:underline">312deals.com/guides/college-bars-chicago</Link>.</>),
  },
  {
    question: "What are the best March Madness deals in Chicago 2026?",
    answerText: "Chicago bars run dozens of March Madness specials throughout the tournament. Highlights include Fatpour Tap Works' Munch Madness Platter and game day drink specials, Hawkeye's bracket contest with prizes, Mac's American Food opening at 11 AM with drink specials, Moretti's 99-cent wings, and Lark's bucket specials. 312Deals tracks all tournament-specific deals, search 'march madness' at 312deals.com for the full list.",
    answer: (<>Chicago bars run dozens of March Madness specials throughout the tournament. Highlights include Fatpour Tap Works&apos; Munch Madness Platter and game day drink specials, Hawkeye&apos;s bracket contest with prizes, Mac&apos;s American Food opening at 11 AM with drink specials, Moretti&apos;s 99-cent wings, and Lark&apos;s bucket specials. 312Deals tracks all tournament-specific deals, <Link href="/search?q=march+madness" className="text-brand-500 hover:underline">search &ldquo;march madness&rdquo;</Link> at 312deals.com for the full list.</>),
  },
  {
    question: "Which NCAA tournament teams have alumni bars in Chicago?",
    answerText: "More than two dozen tournament teams have dedicated alumni bars in Chicago. The Big Ten dominates: Ohio State (6 bars), Wisconsin (5), Illinois (5), Michigan (5), Iowa (4+), Purdue (3), Michigan State (2), Nebraska (1). SEC and Big 12 teams are also well-represented, Alabama, Arkansas, Florida, Tennessee, Kentucky, Kansas, Texas, Texas A&M, and Iowa State all have bars. ACC teams include Duke (2), NC State, Louisville, and Virginia. The full list is at 312deals.com/guides/college-bars-chicago.",
    answer: (<>More than two dozen tournament teams have dedicated alumni bars in Chicago. The Big Ten dominates: Ohio State (6 bars), Wisconsin (5), Illinois (5), Michigan (5), Iowa (4+), Purdue (3), Michigan State (2), Nebraska (1). SEC and Big 12 teams are also well-represented, Alabama, Arkansas, Florida, Tennessee, Kentucky, Kansas, Texas, Texas A&amp;M, and Iowa State all have bars. ACC teams include Duke (2), NC State, Louisville, and Virginia. The full list is at <Link href="/guides/college-bars-chicago" className="text-brand-500 hover:underline">312deals.com/guides/college-bars-chicago</Link>.</>),
  },
  {
    question: "What is the best neighborhood for March Madness in Chicago?",
    answerText: "Lakeview is the best neighborhood for watching March Madness in Chicago with nearly 20 college bars, more than any other neighborhood in the city. Teams with Lakeview bars include Ohio State, Illinois, Michigan, Wisconsin, Iowa, Purdue, Duke, Kentucky, Nebraska, NC State, Iowa State, and more. River North and Lincoln Park are also strong with multiple alumni bars and game day specials. See the full neighborhood breakdown at 312deals.com/guides/college-bars-chicago.",
    answer: (<><Link href="/neighborhoods/lakeview" className="text-brand-500 hover:underline">Lakeview</Link> is the best neighborhood for watching March Madness in Chicago with nearly 20 college bars, more than any other neighborhood in the city. Teams with Lakeview bars include Ohio State, Illinois, Michigan, Wisconsin, Iowa, Purdue, Duke, Kentucky, Nebraska, NC State, Iowa State, and more. <Link href="/neighborhoods/river-north" className="text-brand-500 hover:underline">River North</Link> and <Link href="/neighborhoods/lincoln-park" className="text-brand-500 hover:underline">Lincoln Park</Link> are also strong with multiple alumni bars and game day specials. See the full neighborhood breakdown at <Link href="/guides/college-bars-chicago" className="text-brand-500 hover:underline">312deals.com/guides/college-bars-chicago</Link>.</>),
  },
  {
    question: "Do I need a reservation for March Madness at Chicago bars?",
    answer: "Most alumni bars are first-come, first-served, no reservation needed. For big-draw teams like Ohio State, Michigan, and Wisconsin, arrive 30–60 minutes before tip-off to get a seat. The first Thursday and Friday of the tournament are the busiest days, with 16 games each starting at noon. Many bars open early (11 AM) for noon tip-offs.",
  },
]

// Section 3: About 312Deals FAQs
const faqs = [
  {
    question: "What is 312Deals?",
    answer: `312Deals is a free, searchable database of food and drink deals across all of Chicagoland. We track happy hours, daily specials, brunch deals, late-night menus, game day deals, and more at ${stats.venues} venues across ${stats.neighborhoods} neighborhoods, covering both the city and suburbs.`,
  },
  {
    question: "Is 312Deals free to use?",
    answer: "Yes, completely free. No account required, no login, no paywall. All deal data is publicly accessible on the website, through our API, and through AI assistant integrations.",
  },
  {
    question: "How do you find all these deals?",
    answer: "We aggregate deal information from publicly-listed sources across the web and from community submissions. Every deal is structured, categorized, and re-verified on a regular cadence.",
  },
  {
    question: "How often are deals updated?",
    answer: "Deals are re-verified on a weekly cadence. Anything that has changed is flagged and updated; anything that's gone stale is removed. The database stays current without you needing to wonder whether a listing is still good.",
  },
  {
    question: "What areas does 312Deals cover?",
    answerText: `We cover ${stats.neighborhoods} neighborhoods across Chicagoland, 52 Chicago city neighborhoods (River North, Lakeview, Wicker Park, West Loop, Lincoln Park, Logan Square, etc.) plus 60+ suburbs (Oak Park, Naperville, Evanston, Schaumburg, Elmhurst, and more). Suburbs are not an afterthought, they get equal coverage.`,
    answer: (<>We cover {stats.neighborhoods} neighborhoods across Chicagoland, 52 Chicago city neighborhoods (<Link href="/neighborhoods/river-north" className="text-brand-500 hover:underline">River North</Link>, <Link href="/neighborhoods/lakeview" className="text-brand-500 hover:underline">Lakeview</Link>, <Link href="/neighborhoods/wicker-park" className="text-brand-500 hover:underline">Wicker Park</Link>, <Link href="/neighborhoods/west-loop" className="text-brand-500 hover:underline">West Loop</Link>, <Link href="/neighborhoods/lincoln-park" className="text-brand-500 hover:underline">Lincoln Park</Link>, <Link href="/neighborhoods/logan-square" className="text-brand-500 hover:underline">Logan Square</Link>, etc.) plus 60+ suburbs (<Link href="/neighborhoods/oak-park" className="text-brand-500 hover:underline">Oak Park</Link>, <Link href="/neighborhoods/naperville" className="text-brand-500 hover:underline">Naperville</Link>, <Link href="/neighborhoods/evanston" className="text-brand-500 hover:underline">Evanston</Link>, <Link href="/neighborhoods/schaumburg" className="text-brand-500 hover:underline">Schaumburg</Link>, Elmhurst, and more). Suburbs are not an afterthought, they get equal coverage.</>),
  },
  {
    question: "What types of deals do you track?",
    answer: "We track 13 deal types: happy hours, daily specials, brunch deals, late night, game day, Taco Tuesday, wing deals, pizza deals, seasonal/limited-time offers, chain app deals, loyalty programs, kids eat free, and BOGO offers.",
  },
  {
    question: "Can I submit a deal you're missing?",
    answer: "Absolutely. Visit our submit page and tell us the venue name and deal details. No account needed. We review every submission within 48 hours and add verified deals to the database.",
  },
  {
    question: "How do I report an outdated deal?",
    answer: "Every deal card has a report button you can use to flag it as outdated or incorrect. You can also email us at deals@312deals.com with the venue name and details. Reports help us keep the database accurate.",
  },
  {
    question: "Do you have an app?",
    answer: "312Deals works as a Progressive Web App (PWA) on your phone. Visit 312deals.com in your mobile browser and add it to your home screen for an app-like experience with offline support. A native app is on the roadmap.",
  },
  {
    question: "Can I use 312Deals through ChatGPT or Claude?",
    answer: "Yes. We have a ChatGPT Custom GPT and an 11-tool MCP server for Claude Desktop. You can ask your AI assistant to search for deals by neighborhood, day, cuisine, or deal type, and it will query our database in real time.",
  },
  {
    question: "Is there an API?",
    answer: "Yes. Our public REST API has 18 endpoints for searching deals, venues, and neighborhoods. It's free to use with rate limiting (60 requests/minute for search, 120/minute for autocomplete). See our terms of service for full API usage guidelines.",
  },
  {
    question: "Do you cover chain restaurants?",
    answer: "Yes. We track deals from 51 chain brands including McDonald's, Chipotle, Chili's, Applebee's, Buffalo Wild Wings, and more. Chain app deals (order through the restaurant's app for discounts) are their own deal category.",
  },
  {
    question: "How do I get the weekly newsletter?",
    answer: "Subscribe on our homepage or email deals@312deals.com with 'subscribe' in the subject line. The Deal Sheet drops every Thursday with 5 curated deals, 3 from the city, 2 from the suburbs. Free, no spam, unsubscribe anytime.",
  },
  {
    question: "Who runs 312Deals?",
    answer: "312Deals is an independent, bootstrapped Chicago project, no VC funding, no corporate parent. The platform launched in early 2026 and is operated solo.",
  },
  {
    question: "How can I contact you?",
    answer: "Email us at deals@312deals.com. We typically respond within 24 hours on business days. You can also reach us on X (@312deals), Instagram (@312deals), or Facebook (312Deals).",
  },
]

// Section 4: Advertising & Partnerships FAQs
const businessFaqs = [
  {
    question: "What's the difference between advertising, sponsoring the newsletter, and partnering?",
    answerText: "Advertising is for a single venue or brand that wants to stand out. A Featured venue listing ($39 one-time) sorts you first in search and your neighborhood with a premium badge, and guide sponsorships let you own a high-traffic guide page. Newsletter sponsorship is one of those advertising products specifically: your brand in our weekly Deal Sheet email, a single issue or a multi-week run. Partnering is a relationship rather than a one-off purchase, for restaurant groups (one deal covers all your concepts), marketing and PR agencies (all your clients), media and publishers (a verified deals data feed with attribution), and chambers or neighborhood orgs (a member benefit). Advertise at 312deals.com/advertise; partner at 312deals.com/partner.",
    answer: (<>Advertising is for a single venue or brand that wants to stand out. A Featured venue listing ($39 one-time) sorts you first in search and your neighborhood with a premium badge, and guide sponsorships let you own a high-traffic guide page. Newsletter sponsorship is one of those advertising products specifically: your brand in our weekly Deal Sheet email, a single issue or a multi-week run. Partnering is a relationship rather than a one-off purchase, for restaurant groups (one deal covers all your concepts), marketing and PR agencies (all your clients), media and publishers (a verified deals data feed with attribution), and chambers or neighborhood orgs (a member benefit). <Link href="/advertise" className="text-brand-500 hover:underline">Advertise</Link> for a single venue; <Link href="/partner" className="text-brand-500 hover:underline">partner</Link> if you represent many.</>),
  },
  {
    question: "How much does it cost to advertise on 312Deals?",
    answer: "A Featured venue listing is $39 one-time. Your venue sorts first across the neighborhood, search, and deal-type pages with a premium badge and newsletter priority, and there is nothing to build. Newsletter and guide sponsorships are priced per placement; email deals@312deals.com for current slots. 312Deals is always free for the people searching, so venues only pay to stand out.",
  },
  {
    question: "I run a restaurant group, agency, or publication. How do I work with 312Deals?",
    answerText: "That is a partnership, not a one-off ad. For restaurant groups, one relationship features all your concepts across the neighborhoods they sit in. Agencies can route every client's promotions through one channel. Media and publishers can pull our verified, neighborhood-tagged deals as a data feed with attribution. Chambers and neighborhood orgs can offer it as a member benefit. Start at 312deals.com/partner or email deals@312deals.com.",
    answer: (<>That is a partnership, not a one-off ad. For restaurant groups, one relationship features all your concepts across the neighborhoods they sit in. Agencies can route every client&apos;s promotions through one channel. Media and publishers can pull our verified, neighborhood-tagged deals as a data feed with attribution. Chambers and neighborhood orgs can offer it as a member benefit. Start at <Link href="/partner" className="text-brand-500 hover:underline">312deals.com/partner</Link> or email deals@312deals.com.</>),
  },
]

// Combined for schema
const allFaqs = [...dealFaqs, ...marchMadnessFaqs, ...faqs, ...businessFaqs]

export const metadata: Metadata = {
  title: "FAQ, 312Deals | Chicago Food & Drink Deals Questions Answered",
  description:
    "Answers to common questions about Chicago food deals, happy hours, cheap eats, brunch specials, and more. Plus everything you need to know about using 312Deals, Chicago's most comprehensive deal database.",
  alternates: { canonical: "https://www.312deals.com/faq" },
  openGraph: {
    title: "FAQ, 312Deals | Frequently Asked Questions",
    description: "Everything you need to know about 312Deals, how we find deals, what we cover, and how to use the platform.",
    url: "https://www.312deals.com/faq",
    siteName: "312Deals",
    type: "website",
    images: [{
      url: "https://www.312deals.com/api/og?title=FAQ&subtitle=Frequently+asked+questions+about+312Deals",
      width: 1200,
      height: 630,
      alt: "312Deals FAQ",
    }],
  },
}

export default function FAQPage() {
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
                "@type": "FAQPage",
                "mainEntity": allFaqs.map((faq) => ({
                  "@type": "Question",
                  "name": faq.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": ("answerText" in faq && faq.answerText) ? faq.answerText : faq.answer,
                  },
                })),
              }),
            }}
          />
          <h1 className="text-3xl font-bold text-foreground">Frequently Asked Questions</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Answers to common questions about Chicago food deals, happy hours,
            and how to get the most out of 312Deals.
          </p>

          {/* Section 1: Chicago Food & Drink Deals FAQ */}
          <h2 className="mt-10 text-xl font-bold text-foreground">Chicago Food & Drink Deals FAQ</h2>
          <div className="mt-4 divide-y divide-border">
            {dealFaqs.map((faq, i) => (
              <details key={`deal-${i}`} className="group py-5" {...(i === 0 ? { open: true } : {})}>
                <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground hover:text-brand-500 transition-colors">
                  {faq.question}
                  <span className="ml-4 text-muted-foreground group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground pr-8">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>

          {/* Section 2: March Madness 2026 */}
          <h2 className="mt-10 text-xl font-bold text-foreground">March Madness 2026 in Chicago</h2>
          <div className="mt-4 divide-y divide-border">
            {marchMadnessFaqs.map((faq, i) => (
              <details key={`mm-${i}`} className="group py-5">
                <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground hover:text-brand-500 transition-colors">
                  {faq.question}
                  <span className="ml-4 text-muted-foreground group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground pr-8">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>

          {/* Section 3: About 312Deals */}
          <h2 className="mt-10 text-xl font-bold text-foreground">About 312Deals</h2>
          <div className="mt-4 divide-y divide-border">
            {faqs.map((faq, i) => (
              <details key={`about-${i}`} className="group py-5">
                <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground hover:text-brand-500 transition-colors">
                  {faq.question}
                  <span className="ml-4 text-muted-foreground group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground pr-8">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>

          {/* Section 4: Advertising & Partnerships */}
          <h2 className="mt-10 text-xl font-bold text-foreground">Advertising &amp; Partnerships</h2>
          <div className="mt-4 divide-y divide-border">
            {businessFaqs.map((faq, i) => (
              <details key={`biz-${i}`} className="group py-5">
                <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground hover:text-brand-500 transition-colors">
                  {faq.question}
                  <span className="ml-4 text-muted-foreground group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground pr-8">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>

          {/* Still have questions */}
          <div className="mt-10 rounded-xl border border-border bg-card/50 p-6">
            <h2 className="text-lg font-semibold text-foreground">Still have questions?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We&apos;re happy to help. Reach out at{" "}
              <a href="mailto:deals@312deals.com" className="font-medium text-brand-500 hover:underline">
                deals@312deals.com
              </a>{" "}
              or visit our{" "}
              <Link href="/contact" className="font-medium text-brand-500 hover:underline">
                contact page
              </Link>{" "}
              for all the ways to get in touch.
            </p>
          </div>

          {/* Quick links */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Link
              href="/search"
              className="rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <span className="text-sm font-semibold text-foreground">Search Deals</span>
              <p className="mt-1 text-xs text-muted-foreground">Find deals now</p>
            </Link>
            <Link
              href="/submit"
              className="rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <span className="text-sm font-semibold text-foreground">Submit a Deal</span>
              <p className="mt-1 text-xs text-muted-foreground">Know one we missed?</p>
            </Link>
            <Link
              href="/about"
              className="rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-brand-300 hover:bg-accent"
            >
              <span className="text-sm font-semibold text-foreground">About 312Deals</span>
              <p className="mt-1 text-xs text-muted-foreground">Our story</p>
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
