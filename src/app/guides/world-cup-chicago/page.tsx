import Link from "next/link"
import type { Metadata } from "next"
import { Trophy, Beer, MapPin, Calendar, Clock, Star, Search, Tv, Sun, Tag, Mail } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { EmailSignup } from "@/components/email-signup"
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildItemListJsonLd,
  getLowestDealPrice,
} from "@/lib/seo-utils"
import type { Deal, SearchResponse } from "@/lib/types"
import { AffiliateEssentials } from "@/components/affiliate-essentials"
import { GuideSearchHandoff } from "@/components/guide-search-handoff"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"
const SITE_URL = "https://www.312deals.com"

type SoccerBar = {
  slug: string
  name: string
  hood: string
  address?: string
  rating?: number
  reviews?: number
  note: string
}

// Flagship footie pubs, open early for every match, dedicated soccer rooms.
// Hardcoded because match-day specials don't carry "World Cup" in deal text until
// kickoff nears. All resolve to live venue pages; ratings/addresses from the May 2026 corpus.
const FLAGSHIP_BARS: SoccerBar[] = [
  { slug: "the-globe-pub", name: "The Globe Pub", hood: "North Center", address: "1934 W Irving Park Rd", rating: 4.6, reviews: 1043, note: "Chicago's flagship footie bar, opens early for every match, full breakfast, every league on the screens." },
  { slug: "fado-irish-pub", name: "Fadó Irish Pub", hood: "River North", address: "100 W Grand Ave", rating: 4.5, reviews: 2474, note: "Downtown's go-to for marquee matches and the post-work soccer crowd. Opens early for the big kickoffs." },
  { slug: "wills-northwoods-inn", name: "Will's Northwoods Inn", hood: "Lakeview", address: "3032 N Racine Ave", rating: 4.6, reviews: 993, note: "North-woods dive that turns into a watch party, deepest deal board of the bunch, Wisconsin-supper-club energy." },
  { slug: "the-atlantic-bar-grill", name: "The Atlantic Bar & Grill", hood: "Lincoln Square", address: "5062 N Lincoln Ave", rating: 4.5, reviews: 407, note: "Long-running soccer pub for the north-side supporters' groups. Scarves on the wall, every match on." },
  { slug: "budweiser-brickhouse-tavern", name: "Budweiser Brickhouse Tavern", hood: "Wrigleyville", address: "3647 N Clark St", rating: 4.7, reviews: 1741, note: "Massive Wrigleyville sports bar with a wall of screens, the big-crowd, big-screen option for marquee fixtures." },
  { slug: "d4-irish-pub-cafe", name: "D4 Irish Pub & Cafe", hood: "Streeterville", address: "345 E Ohio St", rating: 4.4, reviews: 2214, note: "Downtown Irish pub off Michigan Ave, opens early for the big kickoffs and pulls the Streeterville soccer crowd." },
  { slug: "codys-public-house", name: "Cody's Public House", hood: "Lakeview", address: "1658 W Barry Ave", rating: 4.6, reviews: 365, note: "Lakeview neighborhood bar running daily World Cup specials all tournament, $6 22oz Michelob Ultra drafts, $6 Fireball shots and $10 Tito's cocktails." },
]

// Beer gardens, patios & casual watch spots, the warm-weather move. With 80° days
// holding, daytime knockout matches are best watched outdoors.
const GARDEN_BARS: SoccerBar[] = [
  { slug: "kaiser-tiger", name: "Kaiser Tiger", hood: "West Loop", address: "1415 W Randolph St", note: "Beer garden and sausages, the warm-weather match-viewing move. Big outdoor screens when the sun's out." },
  { slug: "the-northman-beer-and-cider-garden", name: "The Northman Beer & Cider Garden", hood: "The Loop", address: "233 E Riverwalk", rating: 4.7, reviews: 1341, note: "Riverwalk cider garden, outdoor downtown viewing with the city's best cider list. Peak patio-season play." },
  { slug: "galway-arms", name: "Galway Arms", hood: "Lincoln Park", address: "2440 N Clark St", rating: 4.5, reviews: 858, note: "Irish pub with a proper patio, reliable for group-stage day-drinking in the sun." },
  { slug: "cleos-southern-cuisine", name: "Cleo's Southern Cuisine", hood: "Lakeview", address: "2826 N Lincoln Ave", rating: 4.5, reviews: 44, note: "Southern comfort food to pair with the afternoon slate, fried chicken and a screen." },
  { slug: "sheffield-beer-wine-garden", name: "Sheffield Beer & Wine Garden", hood: "Lakeview", address: "3256 N Sheffield Ave", rating: 4.5, reviews: 1447, note: "Lakeview beer garden a block from Wrigley, outdoor screens and a deep tap list for the daytime slate." },
  { slug: "district-brew-yards", name: "District Brew Yards", hood: "Near West Side", address: "417 N Ashland Ave", rating: 4.6, reviews: 1543, note: "Self-pour brewery with a huge open yard, room to spread out for a group-stage afternoon in the sun." },
  { slug: "burning-bush-brewery", name: "Burning Bush Brewery", hood: "North Center", address: "4014 N Rockwell St", rating: 4.8, reviews: 352, note: "North Center brewery pouring $2 off select pints on World Cup match days, the craft-beer move for the daytime slate." },
]

// Where to watch Mexico (El Tri), one of the most-supported teams in the tournament.
// Curated on venue facts: several are Mexican-owned, all show the match on a big screen.
// Confirm the bar is showing the game before you go, some are kitchens/cantinas, not
// dedicated sports rooms.
const MEXICO_BARS: SoccerBar[] = [
  { slug: "park-and-field", name: "Park & Field", hood: "Logan Square", address: "3509 W Fullerton Ave", rating: 4.2, reviews: 1229, note: "Big Logan Square sports bar with a beer garden and a wall of screens, room for a crowd on a Mexico match day." },
  { slug: "avondale-tap", name: "Avondale Tap", hood: "Avondale", address: "3634 W Belmont Ave", rating: 4.6, reviews: 611, note: "Neighborhood sports bar in Avondale, a local pick for catching El Tri with the block." },
  { slug: "la-victoria-barra-cocina", name: "La Victoria Barra + Cocina", hood: "Logan Square", address: "2443 N Milwaukee Ave", rating: 4.5, reviews: 1167, note: "Mexican bar and kitchen on Milwaukee, micheladas, tacos, and the match. Call ahead to confirm the game's on." },
  { slug: "birrieria-la-tapatia", name: "Birrieria La Tapatia", hood: "Little Village", address: "2861 W Cermak Rd", rating: 4.5, reviews: 645, note: "Little Village birrieria, the move for a Mexico-match taco spread. Confirm they'll have the game before heading over." },
  { slug: "taqueria-los-comales-pilsen", name: "Taqueria Los Comales", hood: "Pilsen", address: "1544 W 18th St", rating: 4.3, reviews: 3683, note: "Pilsen institution on 18th St, tacos and a screen for the El Tri crowd. Counter-service energy; call ahead to confirm the game's on." },
  { slug: "la-quebrada-aurora-restaurant", name: "La Quebrada Aurora", hood: "Aurora", address: "723 S Broadway", rating: 4.4, reviews: 1976, note: "Big sit-down Mexican restaurant on Aurora's Broadway, a far-west-suburban gathering spot on Mexico match days." },
  { slug: "pacos-tacos", name: "Paco's Tacos", hood: "Gage Park", address: "4311 S Archer Ave", rating: 4.5, reviews: 2552, note: "Southwest-side taqueria on Archer, a neighborhood El Tri spot. Confirm they'll have the match before heading over." },
  { slug: "taqueria-el-tapatio", name: "Taqueria El Tapatio", hood: "Hermosa", address: "4238 W Fullerton Ave", rating: 4.6, reviews: 754, note: "Northwest-side taqueria with full World Cup specials, $22.99 beer buckets, the $10 Goalazo margarita and combo deals on El Tri match days." },
]

// Marquee tournament-long watch parties, the venues every Chicago outlet (Time Out,
// FOX 32, Axios) leads with. Press-verified June 10, 2026; all show every match.
const MARQUEE_PARTIES: SoccerBar[] = [
  { slug: "city-hall-recess", name: "Recess", hood: "West Town", address: "838 W Kinzie St", rating: 4.2, reviews: 1450, note: "Chicago Fire FC's official Soccer Celebration, every match on a 360° jumbotron, free entry with an event pass, merch drops, musical guests. The city's flagship watch party." },
  { slug: "tree-house-chicago", name: "OLÉ at Tree House", hood: "River North", address: "149 W Kinzie St", rating: 3.9, reviews: 712, note: "Tree House transformed into OLÉ for the tournament, jerseys, flags and memorabilia from every nation. All ages until 8pm Fri-Sun, walk-ins welcome, tables reservable online." },
  { slug: "soccer-house", name: "Soccer House", hood: "West Town", address: "501 N Ogden Ave", rating: 4.7, reviews: 45, note: "The new West Town soccer bar's first World Cup, every match outdoors in a German-style beer garden, with Argentinian sausage, pretzels and Mexican-inspired ramen." },
  { slug: "lotties-pub", name: "Lottie's Pub", hood: "Bucktown", address: "1925 W Cortland St", rating: 4.4, reviews: 1685, note: "Tournament-long watch parties with World Cup specials June 11–July 19, including $6 22oz Michelob Ultra drafts, and a big match-day crowd." },
]

// Lincoln Square & Ravenswood watch parties, the chamber of commerce published its
// official World Cup roster (June 10), so every spot here is venue-confirmed for the
// tournament. The Atlantic (flagship list above) anchors the same strip.
const LSRCC_BARS: SoccerBar[] = [
  { slug: "gideon-welles", name: "Gideon Welles", hood: "Lincoln Square", address: "4500 N Lincoln Ave", rating: 4.5, reviews: 796, note: "Craft-beer pub on the Lincoln strip with a deep weekday happy hour, solid pick for the afternoon group-stage slate." },
  { slug: "wild-goose-bar-and-grill", name: "Wild Goose Bar & Grill", hood: "Lincoln Square", address: "4600 N Lincoln Ave", rating: 4.4, reviews: 978, note: "Classic neighborhood sports bar two blocks from The Atlantic, screens everywhere and a proper deal board." },
  { slug: "platform-47", name: "Platform 47", hood: "Lincoln Square", address: "4707 N Damen Ave", rating: 4.2, reviews: 605, note: "Damen Ave hangout with happy hour Mon–Fri, weekend afternoons, and all-day Sunday, lines up with the match windows." },
  { slug: "capriccio", name: "Capriccio", hood: "Lincoln Square", address: "4771 N Lincoln Ave", rating: 4.7, reviews: 134, note: "Artisan pizza and coffee with the matches on, the family-brunch end of the watch-party spectrum." },
  { slug: "2h-cafe-bar", name: "2H Cafe Bar", hood: "Lincoln Square", address: "5074 N Lincoln Ave", note: "Cafe-bar flying a 'Watch World Cup With Us' banner over its sidewalk patio, every game, every moment, all tournament." },
  { slug: "gios-bbq-and-bar", name: "Gio's BBQ and Bar", hood: "Ravenswood", note: "Ravenswood BBQ joint on the chamber's watch-party roster, brisket and the morning kickoffs." },
  { slug: "piccadilly-pub", name: "Piccadilly Pub", hood: "Ravenswood", note: "Neighborhood pub on the Ravenswood side of the roster, low-key room for a weekday match." },
  { slug: "bien-me-sabe-venezuelan-cafe-restaurant", name: "Bien Me Sabe", hood: "Ravenswood", address: "1637 W Montrose Ave", rating: 4.5, reviews: 2428, note: "Venezuelan arepa bar where fútbol is the house religion, South American match days are the move here." },
  { slug: "dank-haus-german-american-cultural-center", name: "DANK Haus", hood: "Lincoln Square", address: "4740 N Western Ave", note: "German cultural center hosting Fußball Fieber watch parties through the tournament, with snacks, drinks, and Gemütlichkeit." },
  { slug: "fire-pitch", name: "Fire Pitch", hood: "Avondale", address: "3626 N Talman Ave", note: "The Chicago Fire's community soccer facility, family-friendly watch parties with kids' activities and festival-style match days." },
]

// Classic pubs, beer halls & suburban spots, the traditional football rooms
// (Irish/British pubs always show the match) plus city beer halls and the
// south/west-suburban picks. Reader-confirmed June 2026. For the beer halls,
// confirm the match is on before you go.
const CLASSIC_BARS: SoccerBar[] = [
  { slug: "chief-oneills-pub-and-restaurant", name: "Chief O'Neill's Pub", hood: "Avondale", address: "3471 N Elston Ave", rating: 4.6, reviews: 1851, note: "Avondale's storied Irish pub and traditional-music house, football's always on, with a leafy patio for the afternoon slate." },
  { slug: "elephant-castle-pub", name: "Elephant & Castle Pub", hood: "The Loop", address: "111 W Adams St", rating: 4.3, reviews: 2492, note: "Classic British pub in the heart of the Loop, the natural downtown home for England and the European sides. Opens for the big kickoffs." },
  { slug: "monks-pub", name: "Monk's Pub", hood: "The Loop", address: "205 W Lake St", rating: 4.5, reviews: 2613, note: "Beloved Loop dive with a deep beer list, a low-key downtown room to catch a match away from the big-screen crowds." },
  { slug: "the-berghoff", name: "The Berghoff", hood: "The Loop", address: "17 W Adams St", rating: 4.5, reviews: 5077, note: "Chicago's historic German beer hall, house beer and schnitzel, a natural home for the German-supporter crowd. Confirm the match is on before you go." },
  { slug: "hopleaf-bar", name: "Hopleaf Bar", hood: "Andersonville", address: "5148 N Clark St", rating: 4.7, reviews: 3785, note: "Andersonville's Belgian beer destination, one of the city's deepest tap lists for the European-match crowd. Confirm the game's on before you go." },
  { slug: "jamesons-pub-frankfort", name: "Jameson's Pub", hood: "Frankfort", address: "9545 W St Francis Rd", rating: 4.4, reviews: 2146, note: "Frankfort's Irish pub, football on the screens and a big deal board, the southwest-suburban watch-party pick." },
  { slug: "crosstown-pub-grill-naperville", name: "Crosstown Pub & Grill", hood: "Naperville", address: "909 E Ogden Ave", rating: 4.2, reviews: 2092, note: "Naperville sports pub on Ogden, screens throughout and a west-suburban crowd for the marquee fixtures." },
  { slug: "irish-times", name: "Irish Times", hood: "Brookfield", address: "8869 Burlington Ave", rating: 4.6, reviews: 1816, note: "West-suburban Irish pub in Brookfield, football on the screens and a proper Guinness pour, an easy near-home watch spot." },
  { slug: "elgin-public-house", name: "Elgin Public House", hood: "Elgin", address: "219 E Chicago St", rating: 4.4, reviews: 2155, note: "Downtown Elgin gastropub, screens and a deep beer list for the Fox Valley match crowd." },
  { slug: "old-republic-kitchen-bar", name: "Old Republic Kitchen + Bar", hood: "Elgin", address: "155 S Randall Rd", rating: 4.4, reviews: 2650, note: "Randall Road bar and kitchen in Elgin, a big-screen room for a far-west-suburban watch party." },
  { slug: "anyways-pub-oakbrook-terrace", name: "Anyway's Pub", hood: "Oakbrook Terrace", address: "5 Roosevelt Rd", rating: 4.4, reviews: 1792, note: "Roosevelt Road pub near Oak Brook, screens throughout and a west-suburban crowd for the marquee fixtures." },
  { slug: "the-bavarian-lodge", name: "The Bavarian Lodge", hood: "Lisle", address: "1800 Ogden Ave", rating: 4.6, reviews: 2901, note: "Authentic Bavarian beer hall on Ogden, imported drafts and the natural west-suburban home for the German-supporter crowd. Confirm the match is on before you go." },
  { slug: "chef-klaus-bier-stube", name: "Chef Klaus' Bier Stube", hood: "Mokena", address: "20827 LaGrange Rd", rating: 4.6, reviews: 1829, note: "South-suburban German bier stube, schnitzel, imported drafts, and Gemütlichkeit for the German matches. Confirm the game's on before you go." },
  { slug: "trinity-pub-chicago", name: "Trinity Pub", hood: "Jefferson Park", address: "5943 N Northwest Hwy", rating: 4.6, reviews: 158, note: "Jefferson Park Irish sports bar on Northwest Highway, every televised match with no cover, a true Northwest-side footie room." },
  { slug: "tavern-on-the-point", name: "Tavern On The Point", hood: "Portage Park", address: "6722 N Northwest Hwy", rating: 4.4, reviews: 759, note: "Portage Park corner tavern on Northwest Highway, FIFA matches on the screens all tournament, a Northwest-side local pick." },
  { slug: "vaughans-pub-grill", name: "Vaughan's Pub & Grill", hood: "Jefferson Park", address: "5485 N Northwest Hwy", rating: 4.6, reviews: 492, note: "Jefferson Park Irish pub by the Blue Line, TVs for every match and a deep daily deal board, an easy Northwest-side watch spot." },
  { slug: "ma-obriens-irish-pub", name: "Ma O'Brien's Irish Pub", hood: "Jefferson Park", address: "5734 N Elston Ave", rating: 4.9, reviews: 65, note: "Proper Irish sports pub on Elston, GAA, Premier League and World Cup matches with weekly drink specials, the Jefferson Park footie home." },
]

const ALL_BARS = [...MARQUEE_PARTIES, ...FLAGSHIP_BARS, ...GARDEN_BARS, ...MEXICO_BARS, ...LSRCC_BARS, ...CLASSIC_BARS]

const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
}

function dayChips(deal: Deal): string {
  const days = deal.days_available ?? []
  if (!days.length || days.length === 7) return "Daily"
  if (days.length >= 5 && days.every((d) => ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(d))) return "Mon–Fri"
  return days.map((d) => DAY_LABELS[d] ?? d).join(", ")
}

function timeRange(deal: Deal): string | null {
  if (!deal.start_time && !deal.end_time) return null
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    const hh = h % 12 || 12
    const ap = h < 12 ? "a" : "p"
    return m ? `${hh}:${String(m).padStart(2, "0")}${ap}` : `${hh}${ap}`
  }
  if (deal.start_time && deal.end_time) return `${fmt(deal.start_time)}–${fmt(deal.end_time)}`
  return null
}

function uniqueByVenue(deals: Deal[]): Deal[] {
  const seen = new Set<number>()
  const out: Deal[] = []
  for (const d of deals) {
    const id = d.venue_id
    if (id == null || seen.has(id)) continue
    seen.add(id); out.push(d)
  }
  return out
}

async function getWorldCupDeals(): Promise<Deal[]> {
  // Evergreen soccer-bar guide: cast wide across club + national-team terms;
  // isWorldCupDeal does the precision filtering below.
  const queries = ["world cup", "premier league", "champions league", "liga mx", "fifa", "futbol", "soccer", "el tri"]
  const all = new Map<number, Deal>()
  await Promise.all(
    queries.map(async (q) => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/deals/search?q=${encodeURIComponent(q)}&limit=200`,
          { next: { revalidate: 3600 } }
        )
        if (!res.ok) return
        const data: SearchResponse = await res.json()
        for (const d of data.deals ?? []) if (!all.has(d.id)) all.set(d.id, d)
      } catch {
        // ignore
      }
    })
  )
  return Array.from(all.values())
}

type WcTopDeal = {
  title: string
  deal_type?: string | null
  days_available?: string[] | null
  start_time?: string | null
  end_time?: string | null
  price?: number | null
  is_wc?: boolean
}
type WcVenue = {
  id: number
  name: string
  slug: string
  address?: string | null
  google_rating?: number | null
  google_review_count?: number | null
  neighborhood?: string | null
  neighborhood_slug?: string | null
  zone?: string | null
  has_wc_deal?: number
  deal_count?: number
  top_deal?: WcTopDeal | null
}
type WcGroup = { name: string; slug: string | null; zone?: string | null; venues: WcVenue[] }
type WcVenuesResponse = {
  venues: WcVenue[]
  count: number
  neighborhoods: WcGroup[]
  neighborhood_count: number
  deal_count: number
}

// Full watch-party roster, every venue tagged world_cup_2026 (WatchPartyRadar +
// Crain's), grouped by neighborhood. Distinct from the curated/editorial lists above.
async function getWorldCupVenues(): Promise<WcVenuesResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/venues/world-cup`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    return (await res.json()) as WcVenuesResponse
  } catch {
    return null
  }
}

function isWorldCupDeal(d: Deal): boolean {
  const text = `${d.title} ${d.description ?? ""}`.toLowerCase()
  // Hard exclusions FIRST, other sports/TV (boxing/Canelo/Crawford, UFC, US pro
  // leagues, awards shows)…
  if (/survivor|traitors|kentucky derby|\bderby\b|\bmasters\b|\bgolf\b|\bufc\b|\bmma\b|fight night|boxing|canelo|crawford|wrestlemania|\bnfl\b|\bbears\b|packers|\bnhl\b|blackhawks|\bnba\b|\bbulls\b|\bmlb\b|\bcubs\b|white sox|\bsox\b|oscars|grammys|\brugby\b|nascar|hannah montana|election/.test(text)) return false
  // Club soccer signals, always admit — the guide is evergreen "Chicago soccer
  // bars" now (Premier League, Champions League, Liga MX, MLS, Chicago Fire).
  if (/\bmls\b|premier league|champions league|europa league|bundesliga|la liga|serie a|liga mx|chicago fire|\barsenal\b|\bliverpool\b|man(?:chester)? (?:united|city)|\bchelsea\b|\bdortmund\b|\bbvb\b/.test(text)) return true
  // World Cup / national-team / tournament-structure signals, always admit.
  if (/world\s*cup|\bfifa\b|\bel\s*tri\b|\busmnt\b|group stage|knockout (?:round|stage)|round of (?:32|16)/.test(text)) return true
  // Generic soccer terms only when paired with a watch-party / fest context,
  // so soccer-bar generic happy hours don't slip through.
  if (/f[uú]tbol|\bsoccer\b/.test(text) && /watch\s*part|viewing|fan\s*zone|\bfest\b|fiesta|tournament/.test(text)) return true
  return false
}

export const metadata: Metadata = {
  title: "Best Soccer Bars in Chicago: Where to Watch (Premier League, Liga MX, USMNT)",
  description:
    "The best soccer bars in Chicago and where to watch the Premier League, Champions League, Liga MX, USMNT and Chicago Fire, beer gardens, Irish pubs, and match-day food and drink specials by neighborhood, from The Globe Pub to Kaiser Tiger.",
  openGraph: {
    title: "Best Soccer Bars in Chicago: Where to Watch | 312Deals",
    description:
      "Chicago's soccer bars, beer gardens, and match-day watch-party specials, from the Premier League to Liga MX. Mapped by neighborhood.",
    url: `${SITE_URL}/guides/world-cup-chicago`,
    siteName: "312Deals",
    type: "article",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Chicago+Soccer+Bars&subtitle=Where+to+watch+%2B+match-day+specials&emoji=%E2%9A%BD&badges=520%2B+bars%2C99+neighborhoods%2CEvery+league&v=3`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Soccer Bars in Chicago: Where to Watch | 312Deals",
    description: "Chicago's best soccer bars and match-day watch-party specials, by neighborhood.",
  },
  alternates: {
    canonical: `${SITE_URL}/guides/world-cup-chicago`,
  },
}

// Browse-by-neighborhood pills, soccer-bar hoods first, then adjacent nightlife hoods.
const HOOD_PILLS: [string, string][] = [
  ["north-center", "North Center"],
  ["river-north", "River North"],
  ["lincoln-park", "Lincoln Park"],
  ["lakeview", "Lakeview"],
  ["wrigleyville", "Wrigleyville"],
  ["lincoln-square", "Lincoln Square"],
  ["west-loop", "West Loop"],
  ["the-loop", "The Loop"],
  ["wicker-park", "Wicker Park"],
  ["logan-square", "Logan Square"],
  ["west-town", "West Town"],
  ["old-town", "Old Town"],
  ["gold-coast", "Gold Coast"],
  ["streeterville", "Streeterville"],
  ["pilsen", "Pilsen"],
]

function BarCard({ b, accent }: { b: SoccerBar; accent: "slate" | "amber" | "emerald" }) {
  const cls =
    accent === "slate"
      ? "border-slate-300 bg-slate-50 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-500"
      : accent === "emerald"
        ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/30 dark:hover:border-emerald-700"
        : "border-amber-200 bg-amber-50 hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:border-amber-700"
  const iconCls = accent === "slate" ? "text-slate-600 dark:text-slate-300" : accent === "emerald" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
  const hoodCls = accent === "slate" ? "text-slate-700 dark:text-slate-300" : accent === "emerald" ? "text-emerald-800 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300"
  const hoverName = accent === "slate" ? "group-hover:text-slate-700 dark:group-hover:text-slate-200" : accent === "emerald" ? "group-hover:text-emerald-700 dark:group-hover:text-emerald-400" : "group-hover:text-amber-700 dark:group-hover:text-amber-400"
  return (
    <Link href={`/venues/${b.slug}`} className={`group min-h-[120px] rounded-xl border-2 p-4 transition-colors ${cls}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className={`text-sm font-bold text-foreground ${hoverName}`}>{b.name}</h3>
        {accent === "slate" ? (
          <Tv className={`h-4 w-4 shrink-0 ${iconCls}`} aria-hidden="true" />
        ) : accent === "emerald" ? (
          <Trophy className={`h-4 w-4 shrink-0 ${iconCls}`} aria-hidden="true" />
        ) : (
          <Sun className={`h-4 w-4 shrink-0 ${iconCls}`} aria-hidden="true" />
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] font-medium">
        <span className={hoodCls}>{b.hood}</span>
        {b.rating != null && (
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
            {b.rating.toFixed(1)}
            {b.reviews != null && <span className="text-muted-foreground/70"> ({b.reviews.toLocaleString()})</span>}
          </span>
        )}
      </div>
      {b.address && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/80">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
          {b.address}
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{b.note}</p>
    </Link>
  )
}

export default async function WorldCupGuide() {
  const [allDeals, radar] = await Promise.all([getWorldCupDeals(), getWorldCupVenues()])
  const wcDeals = allDeals.filter(isWorldCupDeal)

  const totalDeals = wcDeals.length
  const uniqueVenues = new Set(wcDeals.map((d) => d.venue_name)).size
  const featured = uniqueByVenue(wcDeals).slice(0, 12)

  // Group live World Cup / soccer specials by neighborhood
  const byHood = new Map<string, { name: string; slug: string; deals: Deal[] }>()
  for (const d of wcDeals) {
    if (d.neighborhood && d.neighborhood_slug) {
      const existing = byHood.get(d.neighborhood_slug)
      if (existing) existing.deals.push(d)
      else byHood.set(d.neighborhood_slug, { name: d.neighborhood, slug: d.neighborhood_slug, deals: [d] })
    }
  }
  const neighborhoods = Array.from(byHood.values()).sort((a, b) => b.deals.length - a.deals.length).slice(0, 9)

  const faqItems = [
    {
      q: "Where are the best soccer bars in Chicago?",
      a: "The Globe Pub (North Center) is the city's flagship soccer bar, it opens early and shows every match. Fadó (River North) and Galway Arms (Lincoln Park) cover the downtown and north-side crowds, The Atlantic Bar & Grill (Lincoln Square) is a longtime supporters' pub, and Kaiser Tiger (West Loop) plus The Northman (Riverwalk) are the beer-garden plays when the weather's good.",
    },
    {
      q: "Where can I watch the Premier League and Champions League in Chicago?",
      a: "The Irish and British pubs are the move: The Globe Pub (North Center), Fadó (River North), D4 (Streeterville), and Elephant & Castle (the Loop) open for weekend-morning and midweek European kickoffs. Most show every match; call ahead for the smaller fixtures.",
    },
    {
      q: "Are there soccer watch-party drink specials in Chicago?",
      a:
        totalDeals > 0
          ? `We're tracking ${totalDeals} live soccer and watch-party specials across ${uniqueVenues} Chicago venues right now. Early-kickoff matches pair with brunch and bottomless deals; afternoon and evening slates run drink buckets and happy-hour pricing.`
          : "Match-day specials run all season, drink buckets, brunch packages for early kickoffs, and happy-hour pricing during the afternoon slate. This page updates automatically as bars post them.",
    },
    {
      q: "What time are soccer matches in Chicago time?",
      a: "Premier League weekend matches air late morning through midday Central; Champions League is typically midweek afternoons; Liga MX runs weekend evenings. The early kickoffs are why brunch-and-a-match becomes the move, several soccer bars open hours ahead of their normal schedule.",
    },
    {
      q: "Where can I watch soccer outside on a patio in Chicago?",
      a: "The beer gardens are the move for daytime matches: The Northman Beer & Cider Garden on the Riverwalk, Kaiser Tiger's West Loop garden, Sheffield Beer & Wine Garden in Lakeview, and District Brew Yards on the Near West Side all run outdoor screens. See our patio-season guide for the full list of outdoor spots.",
    },
    {
      q: "Where can I watch Mexico (El Tri) and Liga MX games in Chicago?",
      a: "Mexico is one of the most-supported teams in the city, and its matches draw some of the biggest crowds. Park & Field (Logan Square) is a big sports bar with a beer garden and a wall of screens; Avondale Tap is a solid neighborhood sports bar; La Victoria Barra + Cocina on Milwaukee is a Mexican bar and kitchen running micheladas and the match; and Birrieria La Tapatia in Little Village is the move for a taco spread. Several are Mexican-owned and all show the game on a big screen, arrive early, they fill up fast.",
    },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pb-24 md:pb-0">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildBreadcrumbJsonLd([
                { name: "Home", url: SITE_URL },
                { name: "Guides", url: `${SITE_URL}/guides` },
                { name: "Chicago Soccer Bars", url: `${SITE_URL}/guides/world-cup-chicago` },
              ])
            ),
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faqItems)) }} />
        {wcDeals.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildItemListJsonLd(
                  "Chicago Soccer & Watch-Party Deals",
                  `${SITE_URL}/guides/world-cup-chicago`,
                  wcDeals
                )
              ),
            }}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: "Best Soccer Bars in Chicago: Where to Watch",
              description: `Chicago's best soccer bars, beer gardens, and match-day watch-party specials, from the Premier League to Liga MX, mapped by neighborhood.`,
              url: `${SITE_URL}/guides/world-cup-chicago`,
              mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/guides/world-cup-chicago` },
              author: { "@type": "Organization", name: "312Deals", url: SITE_URL },
              publisher: {
                "@type": "Organization",
                name: "312Deals",
                url: SITE_URL,
                logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
              },
              image: `${SITE_URL}/api/og?title=Chicago+Soccer+Bars&subtitle=Where+to+watch+%2B+match-day+specials&emoji=%E2%9A%BD&badges=520%2B+bars%2C99+neighborhoods%2CEvery+league&v=3`,
              datePublished: "2026-05-27",
              dateModified: new Date().toISOString().split("T")[0],
            }),
          }}
        />
        {/* Curated watch-spot list as BarOrPub LocalBusiness items, lets answer engines
            cite specific Chicago bars (with addresses) for "where to watch" queries. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: "Chicago Soccer Bars & Watch Spots",
              itemListElement: ALL_BARS.map((b, i) => ({
                "@type": "ListItem",
                position: i + 1,
                item: {
                  "@type": "BarOrPub",
                  name: b.name,
                  url: `${SITE_URL}/venues/${b.slug}`,
                  ...(b.address
                    ? {
                        address: {
                          "@type": "PostalAddress",
                          streetAddress: b.address,
                          addressLocality: "Chicago",
                          addressRegion: "IL",
                          addressCountry: "US",
                        },
                      }
                    : {}),
                  ...(b.rating != null
                    ? {
                        aggregateRating: {
                          "@type": "AggregateRating",
                          ratingValue: b.rating,
                          reviewCount: b.reviews ?? undefined,
                        },
                      }
                    : {}),
                },
              })),
            }),
          }}
        />

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-4 text-xs text-muted-foreground lg:px-6">
          <Link href="/" className="hover:underline">Home</Link>
          {" / "}
          <Link href="/guides" className="hover:underline">Guides</Link>
          {" / "}
          <span className="text-foreground">Chicago Soccer Bars</span>
        </nav>

        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
          <div className="flex flex-wrap items-center gap-3">
            <Trophy className="h-7 w-7 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-700">Premier League · Liga MX · USMNT</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
            Where to Watch Soccer in Chicago: Best Soccer Bars &amp; Watch Parties
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Chicago is one of the best soccer towns in the country. The same Irish pubs, dedicated soccer bars,
            and Riverwalk beer gardens that packed out for the World Cup open early for Premier League weekend
            mornings, midweek Champions League, Liga MX, and every USMNT and Chicago Fire match.{" "}
            {totalDeals > 0
              ? `${totalDeals} live soccer and watch-party specials are running across ${uniqueVenues} venues right now.`
              : "Match-day specials post here as bars drop them."}{" "}
            The beer gardens are the daytime move; the Irish pubs and beer halls open early for the morning kickoffs.
          </p>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-amber-600" aria-hidden="true" />
              <div className="text-2xl font-bold text-foreground">Year-round</div>
              <div className="text-xs text-muted-foreground">Every match week</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Trophy className="mx-auto mb-2 h-6 w-6 text-amber-600" aria-hidden="true" />
              <div className="text-2xl font-bold text-foreground">6</div>
              <div className="text-xs text-muted-foreground">Leagues shown</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Beer className="mx-auto mb-2 h-6 w-6 text-amber-600" aria-hidden="true" />
              <div className="text-2xl font-bold text-foreground">{ALL_BARS.length}</div>
              <div className="text-xs text-muted-foreground">Curated soccer bars</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-amber-600" aria-hidden="true" />
              <div className="text-2xl font-bold text-foreground">{totalDeals > 0 ? totalDeals : "Live"}</div>
              <div className="text-xs text-muted-foreground">{totalDeals > 0 ? "Specials tracked" : "Updates daily"}</div>
            </div>
          </div>

          {/* Prominent above-the-fold deal CTA, converts social/guide traffic into deal-clicks */}
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <Tag className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-foreground">See live deals near you</p>
                <p className="text-xs text-muted-foreground">
                  {totalDeals > 0
                    ? `${totalDeals} watch-party specials are live right now, plus thousands more food & drink deals across Chicago.`
                    : "Thousands of live food & drink deals across Chicago, happy hours, game-day specials, and more."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href="/search?q=soccer" className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                Watch-party deals
              </Link>
              <Link href="/deals" className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:border-amber-400">
                All Chicago food deals
              </Link>
            </div>
          </div>

          {/* High-intent newsletter capture, above the fold. WC traffic is ~24% of
              the site yet the buried mid-page form converts ~0 signups — this is the
              intent-matched catch before the bounce. Own source for A/B measurement. */}
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900/40">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-slate-700 dark:text-slate-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-foreground">Get the day&apos;s watch parties before kickoff</p>
                <p className="text-xs text-muted-foreground">
                  A free rundown of the Chicago bars running match-day specials, in your inbox. No spam, unsubscribe anytime.
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[300px]">
              <EmailSignup source="guide_world_cup_hero" variant="inline" />
            </div>
          </div>
        </section>

        {/* Sticky filter chip row, desktop only */}
        <div className="sticky top-0 z-30 hidden border-y border-border bg-background/95 backdrop-blur md:block">
          <div className="mx-auto max-w-7xl px-4 py-2 lg:px-6">
            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              <span className="shrink-0 font-semibold text-muted-foreground">Find:</span>
              <Link href="/search?q=soccer" className="shrink-0 rounded-full bg-slate-800 px-3 py-1.5 font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">Watch parties</Link>
              <Link href="#mexico-watch-spots" className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800 hover:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Mexico matches</Link>
              <Link href="/guides/patio-season-chicago" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Beer gardens &amp; patios</Link>
              <Link href="/deals/beer-specials" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Beer specials</Link>
              <Link href="/guides/chicago-happy-hours" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Happy hours</Link>
              <Link href="/guides/best-brunch-chicago" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Brunch (early kickoffs)</Link>
              <Link href="/deals/late-night" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Late night</Link>
              <Link href="/deals/wing-deals" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Wing deals</Link>
              <Link href="/guides/cheap-drinks-chicago" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Cheap drinks</Link>
            </div>
          </div>
        </div>


        {/* Flagship soccer bars */}
        <section className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
          <div className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
            <h2 className="text-lg font-bold text-foreground sm:text-xl">Flagship Soccer Bars</h2>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-slate-700">OPEN EARLY · EVERY MATCH</span>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            The established footie pubs that open hours ahead of kickoff and pull a real crowd for every match.
            Tap through for each bar&apos;s current food and drink deals, match-day specials post here as they drop.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FLAGSHIP_BARS.map((b) => (
              <BarCard key={b.slug} b={b} accent="slate" />
            ))}
          </div>
        </section>

        {/* Beer gardens & patios */}
        <section className="mx-auto max-w-7xl px-4 pb-6 lg:px-6 lg:pb-8">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <h2 className="text-lg font-bold text-foreground sm:text-xl">Beer Gardens &amp; Patio Viewing</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">WARM-WEATHER MOVE</span>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Daytime weekend matches are best watched outdoors. These run patios, gardens, and outdoor
            screens, so pair a midday kickoff with a cider and a sausage.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GARDEN_BARS.map((b) => (
              <BarCard key={b.slug} b={b} accent="amber" />
            ))}
          </div>
        </section>

        {/* World Cup watch-party essentials (Amazon affiliate), above the Mexico section */}
        <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-6">
          <AffiliateEssentials
            columns={4}
            title="Soccer Fan Essentials"
            subtitle="Jerseys, caps, and match-day gear to rep your club or country at any Chicago watch party."
            footnote="As an Amazon Associate, 312Deals earns from qualifying purchases. Check Amazon for current pricing and sizes."
            items={[
              { href: "https://amzn.to/4ajJWmO", img: "https://m.media-amazon.com/images/I/81U-X5SItCL._AC_SX679_.jpg", label: "Mexico (Youth)", subtitle: "adidas · Youth home jersey", price: "$45.00" },
              { href: "https://amzn.to/4oMTqNm", img: "https://m.media-amazon.com/images/I/51Adz1A1UUL._AC_SX679_.jpg", label: "USA Retro Tee", subtitle: "500 LEVEL · Retro graphic tee", price: "$39.99" },
              { href: "https://amzn.to/4vxSbUQ", img: "https://m.media-amazon.com/images/I/61VmPLba97L._AC_SX679_.jpg", label: "USMNT Cap", subtitle: "U.S. Soccer · Adjustable dad cap", price: "$29.99" },
              { href: "https://amzn.to/4uXognU", img: "https://m.media-amazon.com/images/I/51rzdtgoJmL._AC_SX679_.jpg", label: "Argentina (Men's)", subtitle: "adidas · Men's home jersey", price: "$149.99" },
              { href: "https://amzn.to/4gCJofy", img: "https://m.media-amazon.com/images/I/61WOAOcI7eL._AC_SX679_.jpg", label: "Argentina (Youth)", subtitle: "adidas · Youth home jersey", price: "$45.00" },
              { href: "https://amzn.to/4uRRgNK", img: "https://m.media-amazon.com/images/I/71YCZY7g+KL._AC_SX679_.jpg", label: "Germany (White)", subtitle: "adidas · Men's jersey", price: "$50.00" },
              { href: "https://amzn.to/4uY9yNB", img: "https://m.media-amazon.com/images/I/71qnp9MRN7L._AC_SX679_.jpg", label: "Germany", subtitle: "adidas · Retro home jersey" },
              { href: "https://amzn.to/43SFl7A", img: "https://m.media-amazon.com/images/I/81earE3Ig7L._AC_SX679_.jpg", label: "Mexico Fan Jersey", subtitle: "Puma · Varsity Green", price: "$60.00" },
              { href: "https://amzn.to/4w6W8Qj", img: "https://m.media-amazon.com/images/I/513rVJju3IL._AC_SL1000_.jpg", label: "Track Jacket", subtitle: "U.S. Soccer · Full-zip track jacket", price: "$36.18" },
              { href: "https://amzn.to/4ajJbKu", img: "https://m.media-amazon.com/images/I/71DcPY86mwL._AC_SY695_.jpg", label: "Clear Bag", subtitle: "Stadium-approved clear crossbody", price: "$22.50", note: "25% off" },
            ]}
          />
        </div>

        {/* Where to watch Mexico (El Tri) */}
        <section id="mexico-watch-spots" className="mx-auto max-w-7xl px-4 pb-6 lg:px-6 lg:pb-8 scroll-mt-16">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <h2 className="text-lg font-bold text-foreground sm:text-xl">Where to Watch Mexico (El Tri)</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">BIGGEST CROWDS</span>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Mexico (El Tri) is one of the most-supported teams in Chicago, and its matches draw some of the
            biggest, loudest crowds in the city. These spots, several Mexican-owned, all with the game on the
            big screen, are the move on match day. Call ahead on the big days and grab a spot early.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MEXICO_BARS.map((b) => (
              <BarCard key={b.slug} b={b} accent="emerald" />
            ))}
          </div>
        </section>

        {/* Lincoln Square & Ravenswood watch parties (chamber-verified) */}
        <section id="lincoln-square-watch-parties" className="mx-auto max-w-7xl px-4 pb-6 lg:px-6 lg:pb-8 scroll-mt-16">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-slate-700 dark:text-slate-300" aria-hidden="true" />
            <h2 className="text-lg font-bold text-foreground sm:text-xl">Lincoln Square &amp; Ravenswood Watch Parties</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-900 dark:bg-slate-800 dark:text-slate-200">CHAMBER-VERIFIED</span>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            The Lincoln Square Ravenswood Chamber of Commerce published an official soccer watch-party
            roster, and these spots reliably show matches. Add The Atlantic
            (flagship list above) and you can walk the whole strip between kickoffs.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LSRCC_BARS.map((b) => (
              <BarCard key={b.slug} b={b} accent="slate" />
            ))}
          </div>
        </section>

        {/* Classic pubs, beer halls & suburban spots */}
        <section className="mx-auto max-w-7xl px-4 pb-6 lg:px-6 lg:pb-8">
          <div className="flex items-center gap-2">
            <Beer className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
            <h2 className="text-lg font-bold text-foreground sm:text-xl">Classic Pubs, Beer Halls &amp; Suburban Spots</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-900 dark:bg-slate-800 dark:text-slate-200">CITY &amp; SUBURBS</span>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            The traditional football rooms, Irish and British pubs that put every match on, plus the city&apos;s
            historic beer halls and the south- and west-suburban picks for fans watching closer to home.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CLASSIC_BARS.map((b) => (
              <BarCard key={b.slug} b={b} accent="slate" />
            ))}
          </div>
        </section>

        {/* High-intent newsletter capture */}
        <section className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
          <EmailSignup
            source="guide_world_cup_games"
            headline="Get the day's watch parties before kickoff"
            subtitle="The Chicago bars running match-day soccer specials, in your inbox. Free, no spam."
          />
        </section>

        {/* Search handoff — keep match-day readers moving into live deals */}
        <section className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
          <GuideSearchHandoff
            headline="Going out for the match?"
            subtitle="Every live special near your bar, searchable by neighborhood, kickoff to final whistle."
            cta={{ label: "Find soccer bar deals", href: "/search?q=soccer" }}
            links={[
              { label: "Happy hours tonight", href: "/deals/happy-hours" },
              { label: "Game-day specials", href: "/deals/game-day" },
              { label: "Beer specials", href: "/deals/beer-specials" },
              { label: "Late-night eats", href: "/deals/late-night" },
            ]}
          />
        </section>

        {/* Live specials by neighborhood */}
        {neighborhoods.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
            <h2 className="mb-1 text-lg font-bold text-foreground sm:text-xl">Live Soccer &amp; Watch-Party Specials by Neighborhood</h2>
            <p className="mb-4 max-w-3xl text-xs text-muted-foreground">
              Live soccer and watch-party specials across Chicago, updated automatically as bars post them.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {neighborhoods.map((nh) => (
                <article key={nh.slug} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-foreground">{nh.name}</h3>
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      {nh.deals.length} {nh.deals.length === 1 ? "deal" : "deals"}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs">
                    {nh.deals.slice(0, 4).map((d) => (
                      <li key={d.id}>
                        <Link href={`/venues/${d.venue_slug}`} className="block min-h-[44px] py-1 hover:text-amber-700 dark:hover:text-amber-400">
                          <span className="font-medium text-foreground">{d.venue_name}</span>
                          <span className="text-muted-foreground">, {d.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/neighborhoods/${nh.slug}`}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-1 py-2 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
                  >
                    All deals in {nh.name} &rarr;
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Featured live specials */}
        {featured.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
            <h2 className="mb-4 text-lg font-bold text-foreground sm:text-xl">Featured Watch-Party Deals Citywide</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((d) => {
                const price = getLowestDealPrice(d)
                const time = timeRange(d)
                const days = dayChips(d)
                return (
                  <Link
                    key={d.id}
                    href={`/venues/${d.venue_slug}`}
                    className="group min-h-[120px] rounded-lg border border-border bg-card p-4 transition-colors hover:border-amber-400"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400">
                        {d.venue_name}
                      </h3>
                      <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-slate-700">
                        ⚽
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.title}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {d.neighborhood ?? "Chicago"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {days}{time ? ` · ${time}` : ""}
                      </span>
                      {price != null && (
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          ${price.toFixed(price % 1 === 0 ? 0 : 2)}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Every bar showing the World Cup, full watch-party roster */}
        {radar && radar.count > 0 && (
          <section id="every-bar-showing-matches" className="mx-auto max-w-7xl px-4 pb-8 lg:px-6 scroll-mt-16">
            <div className="flex flex-wrap items-center gap-2">
              <Tv className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
              <h2 className="text-lg font-bold text-foreground sm:text-xl">Every Bar Showing Soccer in Chicago</h2>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-slate-700">
                {radar.count}+ SPOTS · {radar.neighborhood_count} HOODS
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              The full citywide and suburban roster of bars and restaurants that show soccer,
              {radar.count} spots across {radar.neighborhood_count} neighborhoods, compiled
              from the WatchPartyRadar map and <em>Crain&apos;s</em> reporting. Each shows its rating and
              top live deal with pricing where we have one; a ⚽ marks a venue running a
              match-day special. Tap any name for its full venue page and deals.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {radar.neighborhoods.map((g) => (
                <article key={g.slug ?? g.name} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-foreground">{g.name}</h3>
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                      {g.venues.length}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {g.venues.slice(0, 12).map((v) => (
                      <li key={v.id}>
                        <Link
                          href={`/venues/${v.slug}`}
                          className="group block rounded-md px-1.5 py-1 hover:bg-muted/60"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400">
                              {v.has_wc_deal ? <span aria-label="match-day deal">⚽ </span> : null}
                              {v.name}
                            </span>
                            {v.google_rating != null && (
                              <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                                {v.google_rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          {v.top_deal && (
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Tag className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden="true" />
                              <span className="line-clamp-1">{v.top_deal.title}</span>
                              {v.top_deal.price != null && (
                                <span className="shrink-0 font-bold text-emerald-700 dark:text-emerald-400">
                                  ${v.top_deal.price.toFixed(v.top_deal.price % 1 === 0 ? 0 : 2)}
                                </span>
                              )}
                            </div>
                          )}
                        </Link>
                      </li>
                    ))}
                    {g.venues.length > 12 && g.slug && (
                      <li>
                        <Link
                          href={`/neighborhoods/${g.slug}`}
                          className="inline-flex min-h-[28px] items-center px-1.5 py-0.5 font-semibold text-amber-700 hover:underline dark:text-amber-400"
                        >
                          +{g.venues.length - 12} more &rarr;
                        </Link>
                      </li>
                    )}
                  </ul>
                </article>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground/80">
              Listings reflect venues known to show matches this tournament; always confirm the
              specific game with the bar before heading out.
            </p>
          </section>
        )}


        {/* B2B, feature-your-venue CTA, right under the full roster (bar owners are primed here) */}
        <section className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
          <div className="flex flex-col gap-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-card p-6 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:from-amber-950/30 dark:to-card">
            <div className="flex items-start gap-3">
              <Trophy className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-bold text-foreground sm:text-xl">Run a bar showing the matches?</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Get a <strong>Featured</strong> listing and jump to the top of these neighborhood rosters and
                  312Deals search on your busiest match weekends, from the derbies to the finals.
                  Premium badge, top placement, and newsletter priority.
                </p>
              </div>
            </div>
            <Link
              href="/featured"
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-700"
            >
              Feature your venue
            </Link>
          </div>
        </section>

        {/* Match-day playbook */}
        <section className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
          <h2 className="mb-4 text-lg font-bold text-foreground sm:text-xl">The Match-Day Playbook</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground">Early kickoff → brunch</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                The earliest matches air late morning Central. Soccer bars open hours early, pair the match with bottomless
                mimosas or a breakfast special. See the <Link href="/guides/best-brunch-chicago" className="text-amber-700 hover:underline dark:text-amber-400">brunch guide</Link>.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground">Afternoon → beer garden</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Midday and afternoon slates in the summer heat belong outdoors. Drink buckets and happy-hour pricing run at the
                gardens, browse <Link href="/deals/beer-specials" className="text-amber-700 hover:underline dark:text-amber-400">beer specials</Link> and the <Link href="/guides/patio-season-chicago" className="text-amber-700 hover:underline dark:text-amber-400">patio guide</Link>.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground">Evening → marquee rooms</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Prime-time and weekend matches fill the flagship bars fast. Arrive early or reserve, and check{" "}
                <Link href="/deals/happy-hours" className="text-amber-700 hover:underline dark:text-amber-400">happy hours</Link> for match-window drink pricing.
              </p>
            </div>
          </div>
        </section>

        {/* Evergreen: soccer in Chicago year-round — the page's core after the World Cup cutover (2026-07-20). */}
        <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-6">
          <h2 className="mb-1 text-lg font-bold text-foreground sm:text-xl">Watch Soccer in Chicago Year-Round</h2>
          <p className="mb-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Chicago&apos;s soccer scene runs all year. The bars below show <strong>Premier League</strong> on weekend
            mornings, midweek <strong>Champions League</strong>, <strong>Liga MX</strong> weekends, and every{" "}
            <strong>USMNT</strong> and <strong>Chicago Fire</strong> match, plus Copa América, the Euros, and the next
            World Cup. Bookmark this page, these are the rooms to know all season.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/venues/the-globe-pub" className="rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">The Globe Pub &mdash; every league, opens early</Link>
            <Link href="/venues/fado-irish-pub" className="rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">Fad&oacute; Irish Pub &mdash; downtown marquee matches</Link>
            <Link href="/venues/the-atlantic-bar-grill" className="rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">The Atlantic &mdash; north-side supporters</Link>
            <Link href="/venues/d4-irish-pub-cafe" className="rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-amber-400">D4 Irish Pub &mdash; Streeterville kickoffs</Link>
            <Link href="/search?q=soccer" className="rounded-full bg-slate-800 px-3 py-1.5 font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">Find soccer bars near you</Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-6">
          <h2 className="mb-4 text-lg font-bold text-foreground sm:text-xl">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <details key={i} className="rounded-lg border border-border bg-card p-4">
                <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-semibold text-foreground">{item.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Email signup */}
        <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-6">
          <EmailSignup source="guide_world_cup" />
        </section>

        {/* Browse by neighborhood */}
        <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-6">
          <h2 className="mb-3 text-lg font-bold text-foreground sm:text-xl">Browse Watch Spots by Neighborhood</h2>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
            {HOOD_PILLS.map(([slug, name]) => (
              <Link
                key={slug}
                href={`/neighborhoods/${slug}`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-400"
              >
                {name}
              </Link>
            ))}
          </div>
        </section>

        {/* Related */}
        <section className="mx-auto max-w-7xl px-4 pb-12 lg:px-6">
          <h2 className="mb-3 text-lg font-bold text-foreground sm:text-xl">Related</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/guides/patio-season-chicago" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">
              <Sun className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Patio Season Guide
            </Link>
            <Link href="/deals/beer-specials" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">Beer Specials</Link>
            <Link href="/deals/happy-hours" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">Happy Hours</Link>
            <Link href="/guides/best-brunch-chicago" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">Best Brunch</Link>
            <Link href="/guides/cubs-game-day-chicago" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">Cubs Game Day</Link>
            <Link href="/guides/cheap-drinks-chicago" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 py-2 hover:border-amber-400">Cheap Drinks</Link>
          </div>
        </section>

        {/* About */}
        <section className="mx-auto max-w-7xl px-4 pb-12 lg:px-6">
          <h2 className="mb-2 text-base font-semibold text-foreground">About This Guide</h2>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Live data from 312Deals. The soccer-bar roster is hand-curated from Chicago&apos;s established watch-party spots;
            the specials lists update automatically as venues post match-day deals. Ratings reflect Google review data from the
            May 2026 corpus. Prices and hours change without notice, confirm with the bar before heading out. Last updated:{" "}
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
          </p>
        </section>
      </main>

      {/* Mobile floating CTA */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-6 pb-6 md:hidden">
        <Link
          href="/search?q=soccer"
          className="pointer-events-auto flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-slate-800 px-6 py-4 text-base font-bold text-white shadow-2xl shadow-slate-900/30 transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Find watch parties near you
        </Link>
      </div>

      <Footer />
    </div>
  )
}
