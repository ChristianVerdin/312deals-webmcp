"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { SearchBar } from "@/components/search-bar"
import { MapPin, Tag, Store, Flame, Clock, Leaf, Sun, Sparkles } from "lucide-react"
import { stats } from "@/lib/product-stats"

// Capability-discovery prompts for the hero. Each deep-links into /chat?q=… which
// auto-asks the question, showing visitors what the AI can do (neighborhoods,
// dietary, late-night, the dog-patio feature, brunch, "near me / tonight").
const AI_PROMPTS: { label: string; q: string }[] = [
  { label: "Happy hour in River North?", q: "Best happy hour in River North right now?" },
  { label: "Dog-friendly patios", q: "Which dog-friendly patios have deals right now?" },
  { label: "Late-night tacos", q: "Where can I get late-night tacos in Chicago tonight?" },
  { label: "Bottomless brunch", q: "Best bottomless brunch deals this weekend?" },
  { label: "Gluten-free pizza", q: "Gluten-free pizza deals in Chicago?" },
  { label: "Cheap drinks near me", q: "Cheapest drink deals near me tonight?" },
  { label: "Where to watch the game?", q: "Where can I watch the game with drink specials tonight?" },
  { label: "Wing night tonight", q: "Where are the best wing deals tonight?" },
  // Area chips driven by May 2026 traffic (top areas: West Loop, River North,
  // Pilsen, Wicker Park). River North is already chip #1; Naperville had ~0
  // traffic so it was dropped.
  { label: "Deals in West Loop", q: "Best food and drink deals in West Loop right now?" },
  { label: "Pilsen happy hours", q: "Best happy hours in Pilsen right now?" },
  { label: "Wicker Park deals", q: "Happy hour deals in Wicker Park tonight?" },
  { label: "$1 oysters", q: "Where can I find dollar oyster happy hours in Chicago?" },
  { label: "Patio happy hours", q: "Best patio happy hours in Chicago right now?" },
]

type SeasonalBanner = {
  text: string
  href: string
  /** Tailwind class string for the banner background, defaults to amber if omitted. */
  accentClass?: string
}

const AMBER_BANNER =
  "border-amber-200 bg-gradient-to-r from-amber-600 to-amber-700 dark:from-amber-700 dark:to-amber-800"
const SLATE_BANNER =
  "border-slate-700 bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-800 dark:to-slate-900"

function getTopBanners(): SeasonalBanner[] {
  const now = new Date()
  const ct = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }))
  const month = ct.getMonth() + 1
  const day = ct.getDate()
  const banners: SeasonalBanner[] = []

  // Patio season Apr-Sep, persistent top banner. May 8-10 2026: swap in
  // weather-specific copy for the 70\u00b0F sunny weekend.
  const weekendWeatherWindow = month === 5 && (day === 8 || day === 9 || day === 10)
  // Ends Sep 10 rather than Sep 30. Patio is the only evergreen banner here and
  // the only one with no deadline, so it yields to the September stack: on Sat
  // Sep 12 the rotation was patio + Bears + Sox + El Grito + Oktoberfest, five
  // banners at 6s each, leaving El Grito ~20% of its own peak weekend.
  if (month >= 4 && (month <= 8 || (month === 9 && day <= 10))) {
    banners.push({
      text: weekendWeatherWindow
        ? "70\u00b0 & sunny this weekend, 9,500+ patio deals at 3,000+ Chicago spots"
        : "Patio season is here, 9,500+ outdoor deals at 3,000+ venues",
      href: "/guides/patio-season-chicago",
    })
  }

  // Visiting Chicago, date-gated to peak travel windows only (was always-on, moved to
  // Guides nav for permanent discoverability). Memorial Day weekend, July 4, Lollapalooza,
  // Thanksgiving, Christmas week. Reduces always-on banner stack from 3 \u2192 2 on landing.
  const travelWindow =
    (month === 5 && day >= 22 && day <= 27) ||      // Memorial Day weekend
    (month === 6 && day >= 28) || (month === 7 && day <= 6) ||  // July 4
    (month === 7 && day >= 28) || (month === 8 && day <= 4) ||  // Lollapalooza
    (month === 11 && day >= 22 && day <= 30) ||     // Thanksgiving
    (month === 12 && day >= 22) || (month === 1 && day <= 2)    // Christmas/NYE
  if (travelWindow) {
    banners.push({
      text: "Visiting Chicago? Where to stay by neighborhood, picked for food, drink & walkability",
      href: "/guides/where-to-stay-chicago",
      accentClass: SLATE_BANNER,
    })
  }

  // World Cup banner retired 2026-07-20 after the tournament ended. The guide lives
  // on as the evergreen "Chicago soccer bars" page at /guides/world-cup-chicago and
  // in the /guides hub — intentionally NOT surfaced on the homepage anymore.

  // Cinco de Mayo (May 5 only)
  if (month === 5 && day === 5) {
    banners.push({
      text: "Cinco de Mayo tonight, $10 margs, $6 tequila shots & mariachis citywide",
      href: "/guides/cinco-de-mayo-chicago",
    })
  }

  // Memorial Day: intentionally not surfaced as a top banner, lives in /blog
  // (memorial-day-chicago-2026) and /guides/memorial-day-weekend-chicago.
  // Top-banner stack is reserved for Patio (evergreen) + Graduation (May-Jun)
  // during this window to avoid 3-banner stacking on the homepage.

  // Father's Day lead-up (Jun 8 \u2013 Jun 15, 2026). Window opens 1 week ahead so
  // high-intent reservation traffic sees the guide while booking slots are still
  // open at the marquee steakhouses.
  if (month === 6 && day >= 8 && day <= 15) {
    banners.push({
      text: "Father's Day Sun June 15, steakhouses, BBQ & bourbon bars (book by Friday)",
      href: "/guides/fathers-day-chicago",
    })
  }

  // Pride Month, full month of June. Parade is Sun June 28. Banner runs the
  // last week of June so high-intent parade-weekend traffic sees the guide.
  if (month === 6 && day >= 22 && day <= 29) {
    banners.push({
      text: "Pride Parade Sun June 28, drag brunches, Halsted bars & parade-weekend deals",
      href: "/guides/pride-chicago",
    })
  }

  // 4th of July, Saturday this year. Banner runs Mon June 29 (post-Pride
  // window) through Sun July 5 to cover indexing lead + the long weekend.
  if ((month === 6 && day >= 29) || (month === 7 && day <= 5)) {
    banners.push({
      text: "4th of July Sat July 4, rooftops, fireworks views & BBQ specials",
      href: "/guides/4th-of-july-chicago",
    })
  }

  // Lollapalooza, Thu Jul 30 \u2013 Sun Aug 2. Banner runs Mon Jul 20 through (fills the slot the day after the World Cup banner drops Jul 19)
  // Mon Aug 3 to cover indexing lead, the festival itself, and the recovery
  // brunch surge on Monday.
  if ((month === 7 && day >= 20) || (month === 8 && day <= 3)) {
    banners.push({
      text: "Lollapalooza Jul 30\u2013Aug 2, Grant Park restaurants, late night & recovery brunch",
      href: "/guides/lollapalooza-chicago",
    })
  }

  // \u2500\u2500 Fall/winter 2026 calendar (added Aug 4) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Each window points at a guide from the fall content plan. Publish-by dates
  // all precede their windows (Bears guide live Aug 8; El Grito + Oktoberfest
  // Aug 15; Marathon Aug 22; Halloween Aug 29; holiday Oct 10; Black Wednesday
  // Oct 15). If a guide slips, comment its window out here.

  // Football, split by day of week so the Bears and college football never
  // stack. College football plays Fri/Sat, the Bears play Sun plus a handful
  // of off-pattern primetime dates, so one banner covers each day and the
  // rotation count does not grow. Until Sep 2 2026 the Bears banner also
  // claimed Fri and Sat, which advertised the Bears on days they do not play
  // AND pushed the September rotation to five banners at 6s each, cutting El
  // Grito to ~20% of its own peak weekend. Every extra banner is a real cost
  // to the others.
  const dow = ct.getDay() // 0 = Sunday

  // Bears 2026 (verified against nfl.com): Week 1 is Sun Sep 13 AT Carolina,
  // so there is deliberately no Bears banner before then. Off-pattern dates
  // are MNF Sep 28 (Eagles), TNF Oct 22 (Patriots), MNF Nov 2 (at Seahawks),
  // Thanksgiving Thu Nov 26 (at Lions), Sat Dec 19 (at Bills) and Christmas
  // Fri Dec 25 (Packers). Week 18 at Minnesota is TBD and falls under the
  // Sunday rule. The old code only knew about Sep 28 and Oct 22.
  const bearsOffPattern: Array<[number, number]> = [
    [9, 28], [10, 22], [11, 2], [11, 26], [12, 19], [12, 25],
  ]
  const bearsSeason =
    (month === 9 && day >= 13) || month === 10 || month === 11 || month === 12 ||
    (month === 1 && day <= 10)
  const bearsWindow =
    (bearsSeason && dow === 0) ||
    bearsOffPattern.some(([m, d]) => month === m && day === d)
  if (bearsWindow) {
    banners.push({
      text: "Bears season, where to watch + game-day specials at 300+ bars, city & suburbs",
      href: "/guides/bears-game-day-chicago",
      accentClass: SLATE_BANNER,
    })
  }

  // College football: 2026 Week 1 is Fri Sep 4 / Sat Sep 5, and the regular
  // season runs Fri/Sat through the conference championships in early Dec.
  // Added Sep 2 2026: the fall calendar had no college football entry at all,
  // and /guides/college-football-chicago had zero editorial inbound links
  // anywhere on the site, which is the likeliest reason it sits at position
  // ~21 for "college football bar chicago". Bowl season is deliberately out
  // of scope here.
  const cfbSeason =
    (month === 9 && day >= 3) || month === 10 || month === 11 ||
    (month === 12 && day <= 6)
  if (cfbSeason && (dow === 5 || dow === 6)) {
    banners.push({
      text: "College football Saturdays, where to watch your team + game-day specials",
      href: "/guides/college-football-chicago",
      accentClass: SLATE_BANNER,
    })
  }

  // White Sox: the Crosstown Classic windows get a dedicated line (2026 series
  // ran May 15-17 at Rate Field and Aug 17-19 at Wrigley), and the rest of the
  // season the guide surfaces on the big bar days, Fri-Sun Apr through Sep.
  const crosstownWindow =
    (month === 5 && day >= 15 && day <= 17) || (month === 8 && day >= 17 && day <= 19)
  const soxSeasonWindow =
    month >= 4 && month <= 9 && (dow === 0 || dow === 5 || dow === 6)
  if (crosstownWindow) {
    banners.push({
      text: "Crosstown Classic, Cubs vs Sox, bar specials on both sides of town",
      href: "/guides/white-sox-game-day-chicago",
      accentClass: SLATE_BANNER,
    })
  } else if (soxSeasonWindow) {
    banners.push({
      text: "Sox game day, Bridgeport taverns & Chinatown pre-game near Rate Field",
      href: "/guides/white-sox-game-day-chicago",
      accentClass: SLATE_BANNER,
    })
  }

  // Mexican Independence Day: El Grito (Grant Park) Sep 12-13, the 26th St
  // Parade Sun Sep 13, and the holiday itself Wed Sep 16. The window used to be
  // Sep 8-13, so the banner went dark three days BEFORE the holiday it promotes.
  // The copy switches after the 13th: without the ternary it would advertise a
  // weekend that has already passed on the three days holiday intent peaks.
  if (month === 9 && day <= 16) {
    banners.push({
      text:
        day <= 13
          ? "El Grito weekend Sep 12\u201313, tacos, margaritas & specials in Pilsen & Little Village"
          : "Mexican Independence Day Wed Sep 16, tacos, margaritas & specials in Pilsen & Little Village",
      href: "/guides/mexican-independence-day-chicago",
    })
  }

  // Oktoberfest season: Schaumburg Septemberfest opens Sep 5-7, Glendale Heights
  // Sep 10-20, Old Town Sep 18-20, Lakeview Sep 25-27, suburb fests through
  // Buffalo Creek (Long Grove) Oct 2-4. The window used to start Sep 14, which
  // missed the first two fests and contradicted the guide's own "Sep 5 - Oct 4".
  if ((month === 9 && day >= 5) || (month === 10 && day <= 4)) {
    banners.push({
      text: "Oktoberfest season, steins, brats & fest specials across the city and suburbs",
      href: "/guides/oktoberfest-chicago",
    })
  }

  // Chicago Marathon, Sun Oct 11: carb-loading + spectator bars week.
  if (month === 10 && day >= 5 && day <= 11) {
    banners.push({
      text: "Marathon weekend Oct 11, carb-loading dinners & spectator bars along the course",
      href: "/guides/chicago-marathon-bars-restaurants",
    })
  }

  // Halloween, Sat Oct 31.
  if (month === 10 && day >= 24 && day <= 31) {
    banners.push({
      text: "Halloween in Chicago, costume parties, bar crawls & late-night specials",
      href: "/guides/halloween-bars-chicago",
    })
  }

  // Black Wednesday (night before Thanksgiving, Nov 25) \u2014 biggest bar night of the year.
  if (month === 11 && day >= 19 && day <= 25) {
    banners.push({
      text: "Black Wednesday Nov 25, the biggest bar night of the year, plan your spot",
      href: "/guides/black-wednesday-chicago",
    })
  }

  // Holiday season: Christkindlmarket (Nov 20 - Dec 24), tree lighting, ZooLights.
  if ((month === 11 && day >= 20) || (month === 12 && day <= 24)) {
    banners.push({
      text: "Holiday season, Christkindlmarket eats, festive pop-up bars & downtown deals",
      href: "/guides/christkindlmarket-holiday-chicago",
    })
  }

  // Mother's Day lead-up (May 7 Thu \u2013 May 10 Sun, 2026 dates).
  // After the holiday, /blog/mothers-day-chicago-2026 is the retrospective.
  if (month === 5 && day >= 7 && day <= 10) {
    banners.push({
      text: "Mother's Day is Sunday, bottomless mimosas, drag brunches & prix fixe across Chicago",
      href: "/blog/mothers-day-chicago-2026",
    })
  }

  // Graduation season, college commencements May, HS graduations late May / early June.
  // June tail retired June 4 2026 to avoid a 3-banner pileup on the early-June landing.
  if (month === 5) {
    banners.push({
      text: "Graduation dinner planning? 106+ deals near UIC, UChicago, Northwestern, Loyola, DePaul & Columbia",
      href: "/guides/graduation-dinner-chicago",
    })
  }

  return banners
}

export function HeroSection() {
  const banners = getTopBanners()
  const [bannerIdx, setBannerIdx] = useState(0)

  // Rotate ONE announcement at a time (was a stacked column of up to 3, clunky,
  // and on mobile it shoved the hero far down the page). Auto-advances every 6s;
  // respects prefers-reduced-motion (stays on the first banner).
  useEffect(() => {
    if (banners.length <= 1) return
    if (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 6000)
    return () => clearInterval(t)
  }, [banners.length])

  const activeBanner = banners.length ? banners[bannerIdx % banners.length] : null

  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-brand-50/80 to-background">
      {activeBanner && (
        <div className="relative">
          <Link
            href={activeBanner.href}
            className={`block border-b px-4 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90 ${activeBanner.accentClass ?? AMBER_BANNER}`}
          >
            {activeBanner.text}
            <span className="ml-1.5 inline-block">&#8594;</span>
          </Link>
          {/* Position dots, desktop only + pointer-events-none so they never
              overlap or block the wrapping banner text on mobile. */}
          {banners.length > 1 && (
            <div className="pointer-events-none absolute inset-y-0 right-3 hidden items-center gap-1 sm:flex">
              {banners.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${i === bannerIdx % banners.length ? "bg-white/90" : "bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-16 lg:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
            Chicago food &amp; drink deals{" "}
            <span className="text-brand-500">right now</span>
          </h1>
          <p className="mt-3 text-sm text-foreground/70 text-balance leading-relaxed sm:text-base">
            {stats.deals} happy hours, brunch deals, and daily specials across Chicago &amp; the suburbs. Updated weekly.
          </p>
        </div>

        <div className="mx-auto mt-6 max-w-3xl">
          <SearchBar />
        </div>

        {/* Quick action buttons, the most common things users want */}
        <div className="mx-auto mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/search?active_now=true"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 active:scale-[0.97]"
          >
            <Flame className="h-3.5 w-3.5" />
            Active Now
          </Link>
          <Link
            href="/search?type=happy_hour"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-secondary active:scale-[0.97]"
          >
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            Find Happy Hours
          </Link>
          <Link
            href="/search?has_patio=true"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 active:scale-[0.97] dark:hover:bg-amber-950 dark:hover:text-amber-400"
          >
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            Patio
          </Link>
          <Link
            href="/dietary/gluten-free"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-green-50 hover:text-green-700 hover:border-green-200 active:scale-[0.97] dark:hover:bg-green-950 dark:hover:text-green-400"
          >
            <Leaf className="h-3.5 w-3.5 text-green-600" />
            GF
          </Link>
        </div>

        {/* Ask-the-AI capability prompts, show what you can ask; each deep-links
            into /chat with the question pre-filled. Single swipeable row on
            mobile, wraps centered on desktop. */}
        <div className="mx-auto mt-5 max-w-2xl">
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
            New here? Ask the AI
          </div>
          {/* Mobile: two-row horizontally-scrollable chip grid (exactly 2 rows,
              swipe for the rest, compact, shows every use case). Desktop: a
              wrapped, centered cloud. */}
          <div className="grid grid-flow-col grid-rows-2 justify-start gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex sm:flex-wrap sm:justify-center sm:overflow-visible">
            {AI_PROMPTS.map((p) => (
              <Link
                key={p.label}
                href={`/chat?q=${encodeURIComponent(p.q)}`}
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-card/60 px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-400/60 hover:bg-card hover:text-foreground active:scale-[0.97]"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Social proof stats */}
        <div className="mx-auto mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
          <span className="flex items-center gap-1">
            <Store className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-semibold text-foreground">{stats.venues}</span> venues
          </span>
          <span className="flex items-center gap-1">
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-semibold text-foreground">{stats.deals}</span> deals
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-semibold text-foreground">{stats.neighborhoods}</span> neighborhoods + suburbs
          </span>
        </div>
      </div>
    </section>
  )
}
