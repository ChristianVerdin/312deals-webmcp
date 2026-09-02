export interface DealItem {
  name: string
  deal_price: number | null
  description: string | null
}

export interface Deal {
  id: number
  venue_id?: number
  venue_name: string
  venue_slug: string
  neighborhood: string
  neighborhood_slug: string
  deal_type: string
  title: string
  description: string | null
  days_available: string[]
  start_time: string | null
  end_time: string | null
  is_all_day: number
  food_items: DealItem[] | null
  drink_items: DealItem[] | null
  best_deal_item: string | null
  best_savings_pct: number | null
  estimated_savings_per_person: number | null
  restrictions: string | null
  source_url: string | null
  quality_score: number | null
  is_verified: number
  latitude: number | null
  longitude: number | null
  address: string | null
  cuisine_type: string | null
  distance_miles?: number
  google_rating?: number | null
  is_gluten_free?: number
  dietary_tags?: string
  is_chain?: number
  chain_name?: string
  chain_slug?: string
  app_url_ios?: string
  app_url_android?: string
  opentable_url?: string | null
  resy_url?: string | null
  verified_at?: string
  last_checked_at?: string
  updated_at?: string
  created_at?: string
  is_featured?: number
  featured_until?: string | null
}

/** Subset of Deal sent to client components on heavy listing pages.
 *  Trims fields the UI doesn't read so we don't ship a 4 MB RSC payload
 *  for pages like /guides/patio-season-chicago (was 4.1 MB → < 600 KB).
 *  If the client component starts using a Deal field, add it here. */
export type PatioDealLite = Pick<
  Deal,
  | "id"
  | "title"
  | "description"
  | "deal_type"
  | "days_available"
  | "start_time"
  | "end_time"
  | "is_all_day"
  | "is_gluten_free"
  | "neighborhood"
  | "neighborhood_slug"
  | "quality_score"
  | "google_rating"
  | "drink_items"
  | "food_items"
  | "venue_name"
  | "venue_slug"
>

export interface Neighborhood {
  name: string
  slug: string
  zone: string
  latitude: number | null
  longitude: number | null
  active_deal_count: number
  venue_count?: number
  top_venue_photo?: string | null
  top_venue_name?: string | null
  active_now_count?: number
}

export interface NeighborhoodSummary {
  name: string
  slug: string
  venue_count: number
  deal_count: number
  deal_types: string[]
  avg_quality: number
  avg_savings_pct: number
}

export interface Venue {
  id?: number
  name: string
  slug: string
  address: string | null
  /** Municipality, e.g. "Naperville". Returned by the API but previously
   *  undeclared. Used for schema.org addressLocality — see venues/[slug]. */
  city?: string | null
  /** Nullable in practice: 712 active venues have no neighborhood, and the API
   *  can also return the literal string "null". Declaring it non-null let
   *  `${venue.neighborhood}` ship "Bitter Pops Deals, null | 312Deals" to
   *  Google on 634 indexable pages. Guard before interpolating. */
  neighborhood: string | null
  neighborhood_slug: string
  /** 0 for deactivated venues. The API does not filter on it, so deactivated
   *  venues stay resolvable by slug and the route has to handle them. */
  is_active?: number | boolean
  cuisine_type: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  website_url: string | null
  instagram_handle: string | null
  facebook_url: string | null
  twitter_url: string | null
  yelp_url: string | null
  photo_url: string | null
  google_rating: number | null
  google_review_count: number | null
  google_place_id: string | null
  price_level: number | null
  hours_json: string | null
  description: string | null
  tags: string | null
  vibe_tags: string | null
  is_verified: number
  is_chain: number
  chain_name?: string | null
  chain_slug?: string | null
  app_url_ios?: string | null
  app_url_android?: string | null
  opentable_url?: string | null
  resy_url?: string | null
  online_order_url?: string | null
  website_platform?: string | null
  verified_at?: string
  updated_at?: string
  deals: Deal[]
  active_deal_count: number
}

export interface SearchResponse {
  deals: Deal[]
  count: number
  total: number
  filters: Record<string, string | null>
}

export interface NeighborhoodResponse {
  neighborhoods: Neighborhood[]
  count: number
}

export interface NeighborhoodSummaryResponse {
  neighborhoods: NeighborhoodSummary[]
}

export interface VenueSearchResponse {
  venues: Venue[]
  count: number
}

export interface CrawlResponse {
  crawl: Deal[]
  stops: number
  estimated_savings: number
  group_size: number
}

export interface HealthResponse {
  status: string
  active_deals: number
  db_path: string
  timestamp: string
}

// College Bars / Team Affiliations
export interface TeamAffiliation {
  team: string
  league: string
  sport: string
  url?: string
}

export interface CollegeBarVenue {
  id: number
  name: string
  slug: string
  address: string | null
  neighborhood: string
  neighborhood_slug: string
  latitude: number | null
  longitude: number | null
  cuisine_type: string | null
  google_rating: number | null
  phone: string | null
  website_url: string | null
  photo_url: string | null
  sports_affiliations: TeamAffiliation[]
  is_sports_bar: number
  price_level: number | null
  deals: Deal[]
}

export interface TeamSummary {
  team: string
  league: string
  sport: string
  venue_count: number
}

export interface CollegeBarsResponse {
  venues: CollegeBarVenue[]
  count: number
  teams: TeamSummary[]
  team_count: number
}

// Chat
export interface DealReference {
  deal_id: number
  venue_name: string
  title: string
  neighborhood: string | null
}

export interface ChatResponse {
  response: string
  deals_referenced: DealReference[]
  follow_up_suggestions: string[]
}
