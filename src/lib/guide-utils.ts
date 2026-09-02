import type { Deal } from "@/lib/types"

// Shared helpers for guide pages. Extracted from dog-friendly-patios (Aug 2026)
// so new guides stop copy-pasting them; older guides keep their local copies.

export const DEAL_TYPE_LABEL: Record<string, string> = {
  happy_hour: "Happy Hour",
  daily_special: "Daily Special",
  brunch_deal: "Brunch",
  late_night: "Late Night",
  game_day: "Game Day",
  seasonal_lto: "Seasonal",
  event_driven: "Event",
  loyalty_reward: "Loyalty",
  group_package: "Group",
  chain_app_deal: "App Deal",
  restaurant_week: "Restaurant Week",
  new_opening: "New",
  other: "Deal",
}

// Hotels and national chains carry huge Google review counts, so a popularity
// sort floods them into curated guides. Drop them by name. (Bare "inn"/"suites"
// intentionally NOT matched — local taverns use those words.)
export const EXCLUDE_HOTEL_CHAIN =
  /hotel|marriott|hyatt|westin|sofitel|fairmont|sonesta|blackstone|staypineapple|residence inn|intercontinental|swissotel|warwick allerton|hilton|sheraton|kimpton|allegro royal|holiday inn|home2 suites|texas roadhouse|kona grill|lazy dog|outback steak|raising cane|olive garden|applebee/i

export function isLocalVenue(d: Deal): boolean {
  return !EXCLUDE_HOTEL_CHAIN.test(d.venue_name || "")
}

/**
 * Collapse the corpus's duplicate venue rows ("R.J. Grunts" / "R J Grunts",
 * "Bandit" / "The Bandit") to one key: lowercase, drop a leading "the" and
 * everything non-alphanumeric.
 */
export function normalizeVenueName(name: string): string {
  return name.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "")
}

/**
 * One deal per venue (first wins — pre-sort by relevance/popularity). Pass
 * `byName` to also collapse duplicate venue rows that share a normalized name.
 */
export function uniqueByVenue(deals: Deal[], byName = false): Deal[] {
  const seen = new Set<string>()
  const out: Deal[] = []
  for (const d of deals) {
    const key = byName && d.venue_name ? normalizeVenueName(d.venue_name) : d.venue_slug || d.venue_name
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(d)
  }
  return out
}

export type HoodGroup = { name: string; slug: string; venues: Deal[] }

export function groupByNeighborhood(venues: Deal[]): HoodGroup[] {
  const map = new Map<string, HoodGroup>()
  for (const v of venues) {
    const name = v.neighborhood || "Chicago"
    const slug = v.neighborhood_slug || ""
    if (!map.has(name)) map.set(name, { name, slug, venues: [] })
    map.get(name)!.venues.push(v)
  }
  return Array.from(map.values()).sort(
    (a, b) => b.venues.length - a.venues.length || a.name.localeCompare(b.name)
  )
}
