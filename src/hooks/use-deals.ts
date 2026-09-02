import { useQuery } from "@tanstack/react-query"
import type {
  SearchResponse,
  Deal,
  NeighborhoodResponse,
  NeighborhoodSummaryResponse,
  Venue,
  VenueSearchResponse,
  CrawlResponse,
} from "@/lib/types"

interface DealFilters {
  neighborhood?: string | null
  day?: string | null
  deal_type?: string | null
  q?: string | null
  cuisine?: string | null
  active_now?: boolean
  chain_filter?: string | null
  gluten_free?: boolean
  has_patio?: boolean
  price_range?: string | null
  min_rating?: number | null
  min_quality?: number | null
  time_filter?: string | null
  zone?: string | null
  exclude_venue_ids?: string | null
  sort?: string | null
  limit?: number
  offset?: number
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export function useDeals(filters: DealFilters) {
  const params = new URLSearchParams()
  if (filters.neighborhood) params.set("neighborhood", filters.neighborhood)
  if (filters.day) params.set("day", filters.day)
  if (filters.deal_type) params.set("deal_type", filters.deal_type)
  if (filters.q) params.set("q", filters.q)
  if (filters.cuisine) params.set("cuisine", filters.cuisine)
  if (filters.active_now) params.set("active_now", "true")
  if (filters.chain_filter) params.set("chain_filter", filters.chain_filter)
  if (filters.gluten_free) params.set("gluten_free", "true")
  if (filters.has_patio) params.set("has_patio", "true")
  if (filters.price_range) params.set("price_range", filters.price_range)
  if (filters.min_rating) params.set("min_rating", String(filters.min_rating))
  if (filters.min_quality) params.set("min_quality", String(filters.min_quality))
  if (filters.time_filter) params.set("time_filter", filters.time_filter)
  if (filters.zone) params.set("zone", filters.zone)
  if (filters.exclude_venue_ids) params.set("exclude_venue_ids", filters.exclude_venue_ids)
  if (filters.sort) params.set("sort", filters.sort)
  if (filters.limit) params.set("limit", String(filters.limit))
  if (filters.offset) params.set("offset", String(filters.offset))

  return useQuery<SearchResponse>({
    queryKey: ["deals", filters],
    queryFn: () => fetchJson(`/api/v1/deals/search?${params}`),
  })
}

export interface TypeCountsResponse {
  day: string | null
  zone: string | null
  counts: Record<string, number>
  total: number
  weekend: number
}

/** True per-deal-type counts (homepage Browse-by-Type badges). */
export function useDealTypeCounts(opts: { day?: string | null; zone?: string | null } = {}) {
  const params = new URLSearchParams()
  if (opts.day) params.set("day", opts.day)
  if (opts.zone) params.set("zone", opts.zone)
  const qs = params.toString()
  return useQuery<TypeCountsResponse>({
    queryKey: ["deal-type-counts", opts.day ?? null, opts.zone ?? null],
    queryFn: () => fetchJson(`/api/v1/deals/type-counts${qs ? `?${qs}` : ""}`),
    staleTime: 5 * 60 * 1000,
  })
}

export interface SuggestResponse {
  neighborhoods: { name: string; slug: string; deal_count: number }[]
  venues: { name: string; slug: string; neighborhood: string; deal_count: number }[]
  terms: string[]
  cuisines?: string[]
}

export function useSavedDeals(ids: number[]) {
  const idsParam = ids.join(",")
  return useQuery<SearchResponse>({
    queryKey: ["saved-deals", idsParam],
    queryFn: () => fetchJson(`/api/v1/deals/search?ids=${encodeURIComponent(idsParam)}`),
    enabled: ids.length > 0,
  })
}

export function useSuggest(query: string) {
  return useQuery<SuggestResponse>({
    queryKey: ["suggest", query],
    queryFn: () => fetchJson(`/api/v1/search/suggest?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 5,
  })
}

export function useDealOfTheDay() {
  return useQuery<{ deal: Deal; day: string }>({
    queryKey: ["deal-of-the-day"],
    queryFn: () => fetchJson("/api/v1/deals/deal-of-the-day"),
  })
}

export function useNearbyDeals(
  lat: number | null,
  lng: number | null,
  options?: { radius?: number; activeNow?: boolean; limit?: number }
) {
  const params = new URLSearchParams()
  if (lat !== null) params.set("lat", String(lat))
  if (lng !== null) params.set("lng", String(lng))
  if (options?.radius) params.set("radius_miles", String(options.radius))
  if (options?.activeNow) params.set("active_now", "true")
  if (options?.limit) params.set("limit", String(options.limit))

  return useQuery<SearchResponse>({
    queryKey: ["nearby-deals", lat, lng, options],
    queryFn: () => fetchJson(`/api/v1/deals/nearby?${params}`),
    enabled: lat !== null && lng !== null,
  })
}

export function useNeighborhoods(zone?: string) {
  const params = new URLSearchParams()
  if (zone && zone !== "all") params.set("zone", zone)

  return useQuery<NeighborhoodResponse>({
    queryKey: ["neighborhoods", zone],
    queryFn: () => fetchJson(`/api/v1/neighborhoods?${params}`),
    staleTime: 1000 * 60 * 30,
  })
}

export function useNeighborhoodSummary(neighborhood?: string) {
  const params = new URLSearchParams()
  if (neighborhood) params.set("neighborhood", neighborhood)

  return useQuery<NeighborhoodSummaryResponse>({
    queryKey: ["neighborhood-summary", neighborhood],
    queryFn: () => fetchJson(`/api/v1/neighborhoods/summary?${params}`),
  })
}

export function useVenue(slug: string) {
  return useQuery<Venue>({
    queryKey: ["venue", slug],
    queryFn: () => fetchJson(`/api/v1/venues/${slug}`),
    enabled: !!slug,
  })
}

export function useVenueSearch(params: {
  name?: string
  neighborhood?: string
  cuisine?: string
  limit?: number
}) {
  const searchParams = new URLSearchParams()
  if (params.name) searchParams.set("name", params.name)
  if (params.neighborhood)
    searchParams.set("neighborhood", params.neighborhood)
  if (params.cuisine) searchParams.set("cuisine", params.cuisine)
  if (params.limit) searchParams.set("limit", String(params.limit))

  return useQuery<VenueSearchResponse>({
    queryKey: ["venues", params],
    queryFn: () => fetchJson(`/api/v1/venues/search?${searchParams}`),
    enabled: !!(params.name || params.neighborhood || params.cuisine),
  })
}

export function useCrawl(params: {
  neighborhood: string
  budget?: number
  hours?: number
  group_size?: number
  preferences?: string
}) {
  const searchParams = new URLSearchParams()
  searchParams.set("neighborhood", params.neighborhood)
  if (params.budget) searchParams.set("budget", String(params.budget))
  if (params.hours) searchParams.set("hours", String(params.hours))
  if (params.group_size)
    searchParams.set("group_size", String(params.group_size))
  if (params.preferences)
    searchParams.set("preferences", params.preferences)

  return useQuery<CrawlResponse>({
    queryKey: ["crawl", params],
    queryFn: () => fetchJson(`/api/v1/deals/plan-crawl?${searchParams}`),
    enabled: !!params.neighborhood,
  })
}
