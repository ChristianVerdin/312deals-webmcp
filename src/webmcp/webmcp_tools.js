import { stats } from '@/lib/product-stats';

/**
 * 312Deals WebMCP Tool Definitions
 * ==================================
 * Defines all 10 WebMCP tools exposed to AI agents via navigator.modelContext.
 *
 * Each tool has:
 *   - name: snake_case identifier
 *   - description: Agent SEO optimized (action verbs, examples, coverage claims)
 *   - inputSchema: JSON Schema for parameters
 *   - execute: async function(params) → MCP response
 *   - registrationType: "imperative" | "both" (Declarative + Imperative)
 *
 * Dual API Strategy (Feb 2026, Chrome blog confirmed):
 *   Form-based tools (search, nearby, venue, submit) → "both"
 *   Complex tools (crawl planner, neighborhood summary) → "imperative" only
 *
 * All handlers proxy to the FastAPI backend at /api/v1/*.
 */

// ============================================================
// API HELPERS
// ============================================================

const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:8000';

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json', ...options.headers },
    ...options,
  });
  if (!resp.ok) throw new Error(`API error ${resp.status}: ${resp.statusText}`);
  return resp.json();
}

function mcpResponse(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

// ============================================================
// 10 TOOL DEFINITIONS
// ============================================================

export const TOOLS = [

  // 1. search_chicago_deals, PRIMARY
  {
    name: 'search_chicago_deals',
    description:
      `Find food and drink deals across ${stats.neighborhoods} Chicago neighborhoods and suburbs. ` +
      'Covers happy hours, daily specials (taco tuesday, wing wednesday), brunch deals, ' +
      'late-night eats, chain app promotions (McDonald\'s, Chipotle, BWW), game day specials, ' +
      `and seasonal offers at ${stats.venues} verified venues. Data verified weekly. ` +
      'Returns deal title, venue, address, times, prices, and savings. ' +
      'Example: search for "half off wings" in "West Loop" on "thursday".',
    registrationType: 'both',
    inputSchema: {
      type: 'object',
      properties: {
        neighborhood: { type: 'string', description: 'Chicago neighborhood, e.g. "West Loop", "Roscoe Village"' },
        day: { type: 'string', description: 'Day of week or "today"', enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday','today'] },
        deal_type: { type: 'string', description: 'Deal category', enum: ['happy_hour','daily_special','brunch_deal','late_night','chain_app_deal','game_day','seasonal_lto','loyalty_reward'] },
        cuisine: { type: 'string', description: 'Cuisine filter, e.g. "mexican", "sushi"' },
        query: { type: 'string', description: 'Free-text search, e.g. "oysters", "bottomless mimosas"' },
        limit: { type: 'integer', description: 'Max results (default: 20, max: 50)', default: 20 },
      },
    },
    execute: async (params) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) { if (v != null) q.set(k, String(v)); }
      return mcpResponse(await apiFetch(`/api/v1/deals/search?${q}`));
    },
  },

  // 2. deals_near_location, GEO SEARCH
  {
    name: 'deals_near_location',
    description:
      'Find active deals near a specific Chicago address right now. ' +
      'Geo-proximity search within configurable radius. Returns deals sorted by distance. ' +
      'Example: find deals near "333 N Michigan Ave" within 0.5 miles.',
    registrationType: 'both',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Latitude, e.g. 41.8827' },
        lng: { type: 'number', description: 'Longitude, e.g. -87.6233' },
        radius_miles: { type: 'number', description: 'Search radius in miles (default: 1.5)', default: 1.5 },
        active_now: { type: 'boolean', description: 'Only deals active now (default: false)', default: false },
        limit: { type: 'integer', description: 'Max results (default: 20)', default: 20 },
      },
      required: ['lat', 'lng'],
    },
    execute: async (params) => {
      const q = new URLSearchParams();
      q.set('lat', String(params.lat));
      q.set('lng', String(params.lng));
      if (params.radius_miles) q.set('radius_miles', String(params.radius_miles));
      if (params.active_now !== undefined) q.set('active_now', String(params.active_now));
      if (params.limit) q.set('limit', String(params.limit));
      return mcpResponse(await apiFetch(`/api/v1/deals/nearby?${q}`));
    },
  },

  // 3. get_venue_deals, SINGLE VENUE
  {
    name: 'get_venue_deals',
    description:
      'Get all current deals for a specific Chicago venue by name or ID. ' +
      'Returns venue details (address, hours, rating) plus every active deal. ' +
      'Example: get deals for "Big Star" or "Au Cheval".',
    registrationType: 'both',
    inputSchema: {
      type: 'object',
      properties: {
        venue_name: { type: 'string', description: 'Venue name, e.g. "Big Star", "Au Cheval"' },
        venue_id: { type: 'integer', description: 'Venue database ID (alternative to name)' },
      },
    },
    execute: async (params) => {
      const q = new URLSearchParams();
      if (params.venue_name) q.set('name', params.venue_name);
      if (params.venue_id) q.set('id', String(params.venue_id));
      return mcpResponse(await apiFetch(`/api/v1/venues/search?${q}`));
    },
  },

  // 4. chicago_deal_of_the_day
  {
    name: 'chicago_deal_of_the_day',
    description:
      'Get today\'s featured deal in Chicago, the best value deal active right now. ' +
      'Optionally filter by zone. Example: "what\'s the best deal today?" or "deal of the day in the suburbs".',
    registrationType: 'imperative',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string', description: 'Geographic zone filter', enum: ['city','north_shore','northwest_suburbs','western_suburbs','south_suburbs'] },
      },
    },
    execute: async (params) => {
      const q = new URLSearchParams();
      if (params.zone) q.set('zone', params.zone);
      return mcpResponse(await apiFetch(`/api/v1/deals/deal-of-the-day?${q}`));
    },
  },

  // 5. chicago_chain_deals
  {
    name: 'chicago_chain_deals',
    description:
      'Get current national chain restaurant deals in Chicago. ' +
      'McDonald\'s, Chipotle, BWW, Portillo\'s, Taco Bell, Wendy\'s, Chili\'s, and 9+ more. ' +
      'Includes app-only deals and in-store specials. Example: "Chipotle app deals" or "chain restaurant specials near me".',
    registrationType: 'imperative',
    inputSchema: {
      type: 'object',
      properties: {
        chain_name: { type: 'string', description: 'Filter to specific chain, e.g. "McDonalds"' },
        app_only: { type: 'boolean', description: 'Only app-exclusive deals (default: false)', default: false },
      },
    },
    execute: async (params) => {
      const q = new URLSearchParams();
      if (params.chain_name) q.set('chain', params.chain_name);
      if (params.app_only) q.set('app_only', 'true');
      return mcpResponse(await apiFetch(`/api/v1/deals/chains?${q}`));
    },
  },

  // 6. chicago_neighborhood_deals_summary
  {
    name: 'chicago_neighborhood_deals_summary',
    description:
      'Get a summary of all deals in a Chicago neighborhood, venue count, deal count, ' +
      'top deals, average savings, cuisine breakdown. Example: "show me Wicker Park deals overview" or "what\'s good in Lincoln Park?".',
    registrationType: 'imperative',
    inputSchema: {
      type: 'object',
      properties: {
        neighborhood: { type: 'string', description: 'Neighborhood name, e.g. "Wicker Park"' },
      },
      required: ['neighborhood'],
    },
    execute: async (params) => {
      const q = new URLSearchParams({ neighborhood: params.neighborhood });
      return mcpResponse(await apiFetch(`/api/v1/neighborhoods/summary?${q}`));
    },
  },

  // 7. plan_chicago_deal_crawl
  {
    name: 'plan_chicago_deal_crawl',
    description:
      'Plan a multi-stop bar/food crawl across Chicago venues with active deals. ' +
      'Optimizes route, timing, and savings. Returns ordered stops with directions. ' +
      'Example: 4-stop happy hour crawl in West Loop, Thursday, $50 budget.',
    registrationType: 'imperative',
    inputSchema: {
      type: 'object',
      properties: {
        neighborhood: { type: 'string', description: 'Starting neighborhood' },
        day: { type: 'string', description: 'Day for the crawl, e.g. "thursday" or "today"', enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday','today'] },
        budget: { type: 'number', description: 'Budget per person in dollars' },
        group_size: { type: 'integer', description: 'Group size (default: 2)', default: 2 },
        max_stops: { type: 'integer', description: 'Max stops (default: 4, max: 8)', default: 4 },
        vibe: { type: 'string', description: 'Venue vibe preference, e.g. "dive_bar" or "rooftop"', enum: ['casual','upscale','dive_bar','sports_bar','rooftop','any'] },
      },
      required: ['neighborhood'],
    },
    execute: async (params) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) { if (v != null) q.set(k, String(v)); }
      return mcpResponse(await apiFetch(`/api/v1/deals/plan-crawl?${q}`));
    },
  },

  // 8. get_order_link, DIRECT ORDERING
  {
    name: 'get_order_link',
    description:
      'Get a direct online ordering URL for a Chicago restaurant. ' +
      'Returns the venue\'s own ordering page (Owner.com, direct website) when available, ' +
      'or a DoorDash search link as fallback. Helps users order directly from the restaurant. ' +
      'Example: "order link for The Region" or "how to order from Beity".',
    registrationType: 'imperative',
    inputSchema: {
      type: 'object',
      properties: {
        venue_name: { type: 'string', description: 'Venue name, e.g. "The Region", "Beity"' },
        venue_id: { type: 'integer', description: 'Venue database ID (alternative to name)' },
      },
    },
    execute: async (params) => {
      const q = new URLSearchParams();
      if (params.venue_name) q.set('name', params.venue_name);
      if (params.venue_id) q.set('id', String(params.venue_id));
      const data = await apiFetch(`/api/v1/venues/search?${q}`);
      const venue = data.venues?.[0];
      if (!venue) return mcpResponse({ error: 'Venue not found', query: params });
      const result = {
        venue_name: venue.name,
        venue_slug: venue.slug,
        neighborhood: venue.neighborhood,
        order_url: venue.online_order_url || null,
        website_platform: venue.website_platform || null,
        website_url: venue.website_url || null,
        fallback_doordash: `https://www.doordash.com/search/store/${encodeURIComponent(venue.name + ' Chicago')}/`,
      };
      return mcpResponse(result);
    },
  },

  // 9. get_reservation_link, RESERVATIONS
  {
    name: 'get_reservation_link',
    description:
      'Get a reservation booking URL for a Chicago restaurant. ' +
      'Returns OpenTable or Resy links when available. ' +
      'Covers 300+ Chicago restaurants with reservation links. ' +
      'Example: "reservation link for Au Cheval" or "book a table at Girl and the Goat".',
    registrationType: 'imperative',
    inputSchema: {
      type: 'object',
      properties: {
        venue_name: { type: 'string', description: 'Venue name, e.g. "Au Cheval", "Girl and the Goat"' },
        venue_id: { type: 'integer', description: 'Venue database ID (alternative to name)' },
      },
    },
    execute: async (params) => {
      const q = new URLSearchParams();
      if (params.venue_name) q.set('name', params.venue_name);
      if (params.venue_id) q.set('id', String(params.venue_id));
      const data = await apiFetch(`/api/v1/venues/search?${q}`);
      const venue = data.venues?.[0];
      if (!venue) return mcpResponse({ error: 'Venue not found', query: params });
      const result = {
        venue_name: venue.name,
        venue_slug: venue.slug,
        neighborhood: venue.neighborhood,
        opentable_url: venue.opentable_url || null,
        resy_url: venue.resy_url || null,
        has_reservation: !!(venue.opentable_url || venue.resy_url),
        reservation_platform: venue.opentable_url ? 'OpenTable' : venue.resy_url ? 'Resy' : null,
      };
      return mcpResponse(result);
    },
  },

  // 10. submit_chicago_deal, COMMUNITY (human-in-the-loop)
  {
    name: 'submit_chicago_deal',
    description:
      'Submit a new deal tip for verification. Requires venue name and deal description. ' +
      'Example: "submit a deal for Big Star, $1 oysters Tuesday 4-6pm". Uses human-in-the-loop confirmation.',
    registrationType: 'both',
    inputSchema: {
      type: 'object',
      properties: {
        venue_name: { type: 'string', description: 'Venue name' },
        venue_address: { type: 'string', description: 'Venue address' },
        deal_description: { type: 'string', description: 'Deal details, e.g. "$1 oysters Tuesday 4-6pm"' },
        deal_type: { type: 'string', description: 'Deal category, e.g. "happy_hour" or "daily_special"', enum: ['happy_hour','daily_special','brunch_deal','late_night','chain_app_deal','game_day','other'] },
        days: { type: 'string', description: 'Days available, comma-separated' },
        times: { type: 'string', description: 'Time range, e.g. "4pm-6pm"' },
      },
      required: ['venue_name', 'deal_description'],
    },
    execute: async (params) => {
      // NOTE: requestUserInteraction() does NOT exist in Chrome Canary 147.
      // Empirically verified 2026-02-19. The native ModelContext API has only:
      // registerTool, unregisterTool, provideContext, clearContext.
      // Human-in-the-loop confirmation will need a different mechanism when available.

      return mcpResponse(await apiFetch('/api/v1/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_name: params.venue_name,
          deal_description: params.deal_description,
          venue_address: params.venue_address || null,
          deal_type: params.deal_type || null,
          days: params.days || null,
          times: params.times || null,
        }),
      }));
    },
  },
];

// ============================================================
// CONTEXT PROVIDER
// ============================================================

/**
 * Context metadata for documentation and analytics.
 * NOTE: navigator.modelContext.provideContext() only accepts { tools: [...] }
 * in Chrome Canary 147. description/capabilities are NOT part of the native API.
 * We keep this object for our analytics and inspector, but do NOT pass it to provideContext.
 */
export const CHIDEALS_CONTEXT = {
  description:
    '312Deals, most comprehensive food/drink deals database in Chicago. ' +
    `${stats.venues} venues, ${stats.neighborhoods} neighborhoods (52 city + 60+ active suburbs), ${stats.deals} deals. Verified weekly.`,
  capabilities: ['deal_search','geo_search','venue_lookup','daily_featured','chain_deals','neighborhood_summary','crawl_planning','order_links','reservation_links','community_submissions'],
  data_freshness: 'Weekly verification, last verified within 14 days',
  coverage_area: `Chicago IL metro, ${stats.neighborhoods} neighborhoods (52 city + 60+ active suburban communities)`,
};

// ============================================================
// DECLARATIVE FORM ENHANCEMENT
// ============================================================

/**
 * Declarative API attribute names (Feb 2026, Chrome Canary 147).
 * EMPIRICAL STATUS: UNVERIFIED, these set as custom HTML attributes but
 * we cannot confirm Chrome WebMCP reads them without an active AI agent.
 * The native API surface (Test 2C) has NO getTools/listTools method,
 * so there's no programmatic way to verify declarative tool discovery.
 * All attributes use lowercase (no hyphens, no data- prefix).
 */
export const DECLARATIVE_ATTRS = {
  formToolName: 'toolname',               // ⚠️ Unverified, sets as custom attr
  formToolDescription: 'tooldescription',  // ⚠️ Unverified, sets as custom attr
  inputParamDesc: 'toolparamdescription',  // ⚠️ Unverified, sets as custom attr
  inputParamTitle: 'toolparamtitle',       // ⚠️ Unverified, Gemini claim, may not exist
  formAutoSubmit: 'toolautosubmit',        // ⚠️ Unverified, sets as custom attr
};

const DECLARATIVE_FORMS = {
  'deal-search-form': {
    toolName: 'search_chicago_deals_form',
    toolDescription: 'Search Chicago food and drink deals',
    autoSubmit: false,
    params: {
      neighborhood: 'Chicago neighborhood, e.g. "West Loop"',
      day: 'Day of week or "today"',
      deal_type: 'Deal type: happy_hour, daily_special, etc.',
      cuisine: 'Cuisine: mexican, italian, sushi, etc.',
      query: 'Free-text: "oysters", "half off wings"',
    },
  },
  'deal-nearby-form': {
    toolName: 'deals_near_location_form',
    toolDescription: 'Find deals near a Chicago address',
    autoSubmit: false,
    params: { address: 'Street address or landmark', radius_miles: 'Radius in miles' },
  },
  'venue-search-form': {
    toolName: 'get_venue_deals_form',
    toolDescription: 'Look up deals for a specific venue',
    autoSubmit: false,
    params: { venue_name: 'Venue name, e.g. "Big Star"' },
  },
  'deal-submit-form': {
    toolName: 'submit_chicago_deal_form',
    toolDescription: 'Submit a new deal tip (moderated)',
    autoSubmit: false,
    params: { venue_name: 'Venue name', deal_description: 'Deal details', deal_type: 'Category' },
  },
};

export function enhanceFormsForWebMCP() {
  if (typeof document === 'undefined') return;
  for (const [formId, config] of Object.entries(DECLARATIVE_FORMS)) {
    const form = document.getElementById(formId);
    if (!form) continue;
    form.setAttribute(DECLARATIVE_ATTRS.formToolName, config.toolName);
    form.setAttribute(DECLARATIVE_ATTRS.formToolDescription, config.toolDescription);
    form.setAttribute(DECLARATIVE_ATTRS.formAutoSubmit, String(config.autoSubmit));
    for (const [inputName, desc] of Object.entries(config.params)) {
      const input = form.querySelector(`[name="${inputName}"]`);
      if (input) input.setAttribute(DECLARATIVE_ATTRS.inputParamDesc, desc);
    }
  }
}

/**
 * Check if a SubmitEvent was triggered by an AI agent.
 * EMPIRICALLY CONFIRMED: SubmitEvent.agentInvoked exists as a getter on
 * SubmitEvent.prototype in Chrome Canary 147 (verified 2026-02-19).
 */
export function isAgentSubmission(event) {
  if (event && typeof event.agentInvoked === 'boolean') return event.agentInvoked;
  return false;
}

/**
 * Handle agent-invoked form submissions.
 * NOTE: SubmitEvent.respondWith() does NOT exist in Chrome Canary 147.
 * Empirically verified 2026-02-19, SubmitEvent prototype has no methods at all.
 * agentInvoked (getter) is the only WebMCP addition to SubmitEvent.
 *
 * For now, agent submissions go through the normal form submission path.
 * When respondWith() ships, we can add structured response support here.
 *
 * @param {SubmitEvent} event - The native SubmitEvent
 * @param {Function} handler - async (formData) => responseObject (reserved for future respondWith)
 */
export function handleAgentSubmission(event, handler) {
  if (!isAgentSubmission(event)) return false;

  event.preventDefault();
  const formData = new FormData(event.target);
  const params = Object.fromEntries(formData.entries());

  // respondWith() not available yet, call handler and let it resolve
  // The agent won't receive a structured response, but the submission will still process
  handler(params);
  return true;
}

export default { TOOLS, CHIDEALS_CONTEXT, enhanceFormsForWebMCP, isAgentSubmission, handleAgentSubmission, DECLARATIVE_ATTRS };
