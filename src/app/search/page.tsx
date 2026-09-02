import type { Metadata } from "next"
import Link from "next/link"
import SearchContent from "./search-content"
import type { Deal, SearchResponse } from "@/lib/types"
import { stats } from "@/lib/product-stats"

export const revalidate = 3600

const API_URL = process.env.API_URL || "http://localhost:8000"

const DEAL_TYPE_LABELS: Record<string, string> = {
  happy_hour: "Happy Hour",
  daily_special: "Daily Special",
  brunch_deal: "Brunch",
  late_night: "Late Night",
  chain_app_deal: "Chain App",
  game_day: "Game Day",
  seasonal_lto: "Limited Time",
  loyalty_reward: "Loyalty Reward",
  event_driven: "Event",
  new_opening: "New Opening",
  restaurant_week: "Restaurant Week",
  group_package: "Group",
}

const DEAL_TYPE_DESCRIPTIONS: Record<string, string> = {
  happy_hour: `Browse Chicago happy hour deals, discounted drinks, appetizer specials, and after-work deals at bars and restaurants across ${stats.neighborhoods} neighborhoods.`,
  daily_special: "Find today's daily specials at Chicago restaurants and bars. Taco Tuesdays, wing nights, burger deals, and more updated weekly.",
  brunch_deal: "Discover Chicago brunch deals, bottomless mimosas, prix fixe menus, and weekend brunch specials at restaurants across the city.",
  late_night: "Late night food and drink deals in Chicago. Reverse happy hours, after-midnight specials, and late-night bites at bars and restaurants citywide.",
  chain_app_deal: "App-exclusive deals and offers from chain restaurants in Chicago, McDonald's, Chipotle, Portillo's, Starbucks, and more.",
  game_day: "Game day food and drink specials at Chicago sports bars. Deals for Bears, Bulls, Cubs, Sox, and Blackhawks watch parties.",
  seasonal_lto: "Limited time food and drink offers at Chicago restaurants. Seasonal specials, new menu items, and promotional deals happening now.",
  loyalty_reward: "Loyalty reward deals at Chicago restaurants and bars. Points programs, frequent diner perks, and member-exclusive specials.",
  event_driven: "Event-driven food and drink specials in Chicago. Deals tied to concerts, festivals, holidays, and special occasions at local venues.",
  new_opening: "Grand opening deals and specials at newly opened Chicago restaurants and bars. Be first to try new spots with introductory offers.",
  restaurant_week: "Chicago Restaurant Week deals, prix fixe menus, multi-course specials, and limited-time offers at participating restaurants citywide.",
  group_package: "Group dining deals and party packages at Chicago restaurants. Specials for large parties, corporate events, and celebrations.",
}

const DAY_LABELS: Record<string, string> = {
  today: "Today's",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function getStr(val: string | string[] | undefined): string | undefined {
  return typeof val === "string" && val ? val : undefined
}

async function getInitialDeals(params: Record<string, string | string[] | undefined>): Promise<Deal[]> {
  try {
    const apiParams = new URLSearchParams({ limit: "20" })

    const q = getStr(params.q)
    const neighborhood = getStr(params.neighborhood)
    const dealType = getStr(params.deal_type) ?? getStr(params.type)
    const day = getStr(params.day)
    const cuisine = getStr(params.cuisine)
    const activeNow = params.active_now === "true"
    const glutenFree = params.gluten_free === "true"
    const hasPatio = params.has_patio === "true"
    const zone = getStr(params.zone)
    const priceRange = getStr(params.price_range)
    const minRating = getStr(params.min_rating)

    if (q) apiParams.set("q", q)
    if (neighborhood) apiParams.set("neighborhood", neighborhood)
    if (dealType) apiParams.set("deal_type", dealType)
    if (day) apiParams.set("day", day)
    if (cuisine) apiParams.set("cuisine", cuisine)
    if (activeNow) apiParams.set("active_now", "true")
    if (glutenFree) apiParams.set("gluten_free", "true")
    if (hasPatio) apiParams.set("has_patio", "true")
    if (zone) apiParams.set("zone", zone)
    if (priceRange) apiParams.set("price_range", priceRange)
    if (minRating) apiParams.set("min_rating", minRating)

    const res = await fetch(`${API_URL}/api/v1/deals/search?${apiParams}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data: SearchResponse = await res.json()
    return data.deals ?? []
  } catch {
    return []
  }
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams

  const activeNow = params.active_now === "true"
  const dealType = getStr(params.deal_type) ?? getStr(params.type)
  const day = getStr(params.day)
  const q = getStr(params.q)
  const neighborhood = getStr(params.neighborhood)
  const cuisine = getStr(params.cuisine)

  const dealTypeLabel = dealType
    ? (DEAL_TYPE_LABELS[dealType] ?? dealType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    : undefined

  // --- Build title ---
  const titleParts: string[] = []
  let description: string

  if (activeNow) {
    titleParts.push("Active Now")
  }
  if (day) {
    const dayLabel = DAY_LABELS[day.toLowerCase()] ?? day.replace(/\b\w/g, (c) => c.toUpperCase())
    titleParts.push(dayLabel)
  }
  if (dealTypeLabel) {
    titleParts.push(dealTypeLabel)
  }
  if (cuisine) {
    titleParts.push(cuisine.replace(/\b\w/g, (c) => c.toUpperCase()))
  }
  if (q) {
    titleParts.push(`"${q}"`)
  }
  if (neighborhood) {
    titleParts.push(neighborhood.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
  }

  let title: string
  if (titleParts.length > 0) {
    title = `${titleParts.join(" ")} Chicago Deals | 312Deals`
  } else {
    title = "Search Chicago Food & Drink Deals | 312Deals"
  }

  // --- Build description (unique per variant, 120+ chars) ---
  if (activeNow && dealType) {
    description = `Chicago ${dealTypeLabel?.toLowerCase()} deals happening right now. See what's active at bars and restaurants near you, live-updated specials across ${stats.neighborhoods} neighborhoods.`
  } else if (activeNow) {
    description = `Deals happening right now at Chicago bars and restaurants. Browse live-updated food and drink specials that are active at this moment across ${stats.neighborhoods} neighborhoods.`
  } else if (day && dealType) {
    const dayLabel = DAY_LABELS[day.toLowerCase()] ?? day
    description = `${dayLabel === "Today's" ? "Today's" : dayLabel} ${dealTypeLabel?.toLowerCase()} deals in Chicago. Find the best food and drink specials at bars and restaurants across ${stats.neighborhoods} neighborhoods.`
  } else if (day) {
    const dayLabel = DAY_LABELS[day.toLowerCase()] ?? day
    if (dayLabel === "Today's") {
      description = `Today's food and drink deals in Chicago. Browse happy hours, daily specials, brunch deals, and more happening at bars and restaurants across ${stats.neighborhoods} neighborhoods.`
    } else {
      description = `${dayLabel} food and drink deals in Chicago. Browse happy hours, daily specials, and more available every ${dayLabel} at bars and restaurants across ${stats.neighborhoods} neighborhoods.`
    }
  } else if (dealType && DEAL_TYPE_DESCRIPTIONS[dealType]) {
    description = DEAL_TYPE_DESCRIPTIONS[dealType]
  } else if (dealType) {
    description = `Chicago ${dealTypeLabel?.toLowerCase()} deals at bars and restaurants. Browse specials, compare prices, and find the best food and drink offers across ${stats.neighborhoods} neighborhoods.`
  } else if (cuisine) {
    const cuisineLabel = cuisine.replace(/\b\w/g, (c) => c.toUpperCase())
    description = `${cuisineLabel} restaurant deals in Chicago. Find happy hours, daily specials, and discounts at ${cuisineLabel.toLowerCase()} restaurants and bars across ${stats.neighborhoods} neighborhoods.`
  } else if (q) {
    description = `Search results for "${q}", Chicago food and drink deals at bars and restaurants. Browse matching happy hours, daily specials, and more across ${stats.neighborhoods} neighborhoods.`
  } else if (neighborhood) {
    const hoodName = neighborhood.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    description = `Food and drink deals in ${hoodName}, Chicago. Happy hours, daily specials, brunch deals, and more at bars and restaurants in the ${hoodName} neighborhood.`
  } else {
    description = `Search ${stats.deals} food and drink deals across Chicago's ${stats.neighborhoods} neighborhoods. Filter by cuisine, day, price, deal type, and more to find specials near you.`
  }

  return {
    title,
    description,
  }
}

function formatTime12(t: string | null): string {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${m.toString().padStart(2, "0")}${suffix}`
}

function formatDaysShort(days: string[]): string {
  if (!days || days.length === 0) return ""
  if (days.length === 7) return "Daily"
  return days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const deals = await getInitialDeals(params)

  const q = getStr(params.q)
  const neighborhood = getStr(params.neighborhood)
  const dealType = getStr(params.deal_type) ?? getStr(params.type)
  const cuisine = getStr(params.cuisine)

  // Build a human-readable heading for the server-rendered section
  const parts: string[] = []
  if (cuisine) parts.push(cuisine)
  if (dealType) parts.push(DEAL_TYPE_LABELS[dealType] ?? dealType.replace(/_/g, " "))
  if (q) parts.push(`"${q}"`)
  if (neighborhood) parts.push(`in ${neighborhood.replace(/-/g, " ")}`)
  const heading = parts.length > 0
    ? `${parts.join(" ")} Deals in Chicago`
    : "Chicago Food & Drink Deals"

  const venueCount = new Set(deals.map(d => d.venue_slug)).size

  return (
    <>
      {/* Interactive client-side search UI */}
      <SearchContent />

      {/* Server-rendered deal content for crawlers (hidden when JS runs) */}
      <noscript>
        <style>{`.ssr-deals { display: block !important; }`}</style>
      </noscript>
      <section
        className="ssr-deals"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
        data-nosnippet=""
      >
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h2>{heading}</h2>
          <p>
            {deals.length > 0
              ? `Showing ${deals.length} deals at ${venueCount} venues across Chicago.`
              : `Search Chicago food and drink deals across ${stats.neighborhoods} neighborhoods. Find happy hours, daily specials, brunch deals, and more.`}
          </p>

          {deals.length > 0 && (
            <ul>
              {deals.map((deal) => (
                <li key={deal.id}>
                  <article>
                    <h3>
                      <Link href={`/venues/${deal.venue_slug}`}>
                        {deal.venue_name}, {deal.title}
                      </Link>
                    </h3>
                    {deal.description && <p>{deal.description}</p>}
                    <dl>
                      <dt>Neighborhood</dt>
                      <dd>
                        {deal.neighborhood_slug ? (
                          <Link href={`/neighborhoods/${deal.neighborhood_slug}`}>
                            {deal.neighborhood || "Unknown"}
                          </Link>
                        ) : (
                          <span>{deal.neighborhood || "Unknown"}</span>
                        )}
                      </dd>
                      <dt>Type</dt>
                      <dd>{DEAL_TYPE_LABELS[deal.deal_type] ?? deal.deal_type}</dd>
                      {deal.days_available && deal.days_available.length > 0 && (
                        <>
                          <dt>Days</dt>
                          <dd>{formatDaysShort(deal.days_available)}</dd>
                        </>
                      )}
                      {(deal.start_time || deal.end_time) && (
                        <>
                          <dt>Time</dt>
                          <dd>
                            {deal.is_all_day
                              ? "All Day"
                              : `${formatTime12(deal.start_time)}${deal.end_time ? ` - ${formatTime12(deal.end_time)}` : ""}`}
                          </dd>
                        </>
                      )}
                      {deal.cuisine_type && (
                        <>
                          <dt>Cuisine</dt>
                          <dd>{deal.cuisine_type}</dd>
                        </>
                      )}
                      {deal.address && (
                        <>
                          <dt>Address</dt>
                          <dd>{deal.address}</dd>
                        </>
                      )}
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          )}

          {/* Internal links for crawlers */}
          <nav>
            <h3>Browse by Deal Type</h3>
            <ul>
              <li><Link href="/deals/happy-hours">Happy Hour Deals</Link></li>
              <li><Link href="/deals/daily-specials">Daily Specials</Link></li>
              <li><Link href="/deals/brunch-deals">Brunch Deals</Link></li>
              <li><Link href="/deals/late-night">Late Night Deals</Link></li>
              <li><Link href="/deals/game-day">Game Day Specials</Link></li>
            </ul>
            <h3>Browse by Cuisine</h3>
            <ul>
              <li><Link href="/cuisine/mexican">Mexican Deals</Link></li>
              <li><Link href="/cuisine/italian">Italian Deals</Link></li>
              <li><Link href="/cuisine/japanese">Japanese Deals</Link></li>
              <li><Link href="/cuisine/chinese">Chinese Deals</Link></li>
              <li><Link href="/cuisine/thai">Thai Deals</Link></li>
              <li><Link href="/cuisine/indian">Indian Deals</Link></li>
              <li><Link href="/cuisine/korean">Korean Deals</Link></li>
              <li><Link href="/search?q=gluten+free">Gluten Free Deals</Link></li>
              <li><Link href="/search?q=vegan">Vegan Deals</Link></li>
            </ul>
            <h3>Popular Searches</h3>
            <ul>
              <li><Link href="/search?q=tacos">Taco Deals</Link></li>
              <li><Link href="/search?q=pizza">Pizza Deals</Link></li>
              <li><Link href="/search?q=sushi">Sushi Deals</Link></li>
              <li><Link href="/search?q=wings">Wing Deals</Link></li>
              <li><Link href="/search?q=brunch">Brunch Specials</Link></li>
              <li><Link href="/search?q=margaritas">Margarita Deals</Link></li>
              <li><Link href="/search?q=gluten+free+chinese">Gluten Free Chinese</Link></li>
              <li><Link href="/search?q=gluten+free+pizza">Gluten Free Pizza</Link></li>
            </ul>
          </nav>
        </div>
      </section>
    </>
  )
}
