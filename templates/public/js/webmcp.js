/**
 * 312Deals WebMCP, Standalone Browser Script
 * =============================================
 * Self-contained script that registers all 8 WebMCP tools
 * via navigator.modelContext for AI agent discovery.
 *
 * Load via: <script src="/js/webmcp.js" defer></script>
 *
 * Tools registered:
 *   1. search_chicago_deals, Search deals by neighborhood, day, type, cuisine
 *   2. deals_near_location, Geo-proximity deal search
 *   3. get_venue_deals, All deals for a specific venue
 *   4. chicago_deal_of_the_day, Today's featured deal
 *   5. chicago_chain_deals, National chain deals
 *   6. chicago_neighborhood_deals_summary, Neighborhood stats
 *   7. plan_chicago_deal_crawl, Multi-stop crawl planner
 *   8. submit_chicago_deal, Submit a deal tip
 */
(function () {
  'use strict';

  // Skip if already initialized or not in browser
  if (typeof window === 'undefined') return;
  if (window.__312deals_webmcp_loaded) return;
  window.__312deals_webmcp_loaded = true;

  // API helper, uses relative URLs (goes through Next.js rewrites to Railway backend)
  async function apiFetch(path, options) {
    var opts = options || {};
    var resp = await fetch(path, {
      headers: Object.assign({ 'Accept': 'application/json' }, opts.headers || {}),
      method: opts.method || 'GET',
      body: opts.body,
    });
    if (!resp.ok) throw new Error('API error ' + resp.status + ': ' + resp.statusText);
    return resp.json();
  }

  function mcpResponse(data) {
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }

  function toQuery(params) {
    var q = new URLSearchParams();
    for (var k in params) {
      if (params[k] != null) q.set(k, String(params[k]));
    }
    return q.toString();
  }

  // 8 Tool definitions
  var TOOLS = [
    {
      name: 'search_chicago_deals',
      description:
        'Find food and drink deals across {{neighborhoods}} Chicago neighborhoods and suburbs. ' +
        'Covers happy hours, daily specials (taco tuesday, wing wednesday), brunch deals, ' +
        'late-night eats, chain app promotions, game day specials, and seasonal offers ' +
        'at {{venues}} verified venues. Data verified weekly. ' +
        'Example: search for "half off wings" in "West Loop" on "thursday".',
      inputSchema: {
        type: 'object',
        properties: {
          neighborhood: { type: 'string', description: 'Chicago neighborhood, e.g. "West Loop", "Roscoe Village"' },
          day: { type: 'string', description: 'Day of week or "today"', enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday','today'] },
          deal_type: { type: 'string', description: 'Deal category', enum: ['happy_hour','daily_special','brunch_deal','late_night','chain_app_deal','game_day','seasonal_lto'] },
          cuisine: { type: 'string', description: 'Cuisine filter, e.g. "mexican", "sushi"' },
          query: { type: 'string', description: 'Free-text search, e.g. "oysters", "bottomless mimosas"' },
          limit: { type: 'integer', description: 'Max results (default: 20, max: 50)', default: 20 },
        },
      },
      execute: async function (params) {
        return mcpResponse(await apiFetch('/api/v1/deals/search?' + toQuery(params)));
      },
    },

    {
      name: 'deals_near_location',
      description:
        'Find active deals near a specific Chicago location by coordinates. ' +
        'Example: find deals near Wicker Park (lat 41.9088, lng -87.6796). Returns deals sorted by distance.',
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
      execute: async function (params) {
        return mcpResponse(await apiFetch('/api/v1/deals/nearby?' + toQuery(params)));
      },
    },

    {
      name: 'get_venue_deals',
      description:
        'Get all current deals for a specific Chicago venue by name or ID. ' +
        'Returns venue details (address, hours, rating) plus every active deal.',
      inputSchema: {
        type: 'object',
        properties: {
          venue_name: { type: 'string', description: 'Venue name, e.g. "Big Star", "Au Cheval"' },
          venue_id: { type: 'integer', description: 'Venue database ID (alternative to name)' },
        },
      },
      execute: async function (params) {
        var q = new URLSearchParams();
        if (params.venue_name) q.set('name', params.venue_name);
        if (params.venue_id) q.set('id', String(params.venue_id));
        return mcpResponse(await apiFetch('/api/v1/venues/search?' + q));
      },
    },

    {
      name: 'chicago_deal_of_the_day',
      description:
        "Get today's featured deal in Chicago, the best value deal active right now. Example: \"what's the best deal today?\" or \"deal of the day in the suburbs\".",
      inputSchema: {
        type: 'object',
        properties: {
          zone: { type: 'string', description: 'Geographic zone filter', enum: ['city','north_shore','northwest_suburbs','western_suburbs','south_suburbs'] },
        },
      },
      execute: async function (params) {
        return mcpResponse(await apiFetch('/api/v1/deals/deal-of-the-day?' + toQuery(params)));
      },
    },

    {
      name: 'chicago_chain_deals',
      description:
        "Find national chain restaurant deals in Chicago: McDonald's, Chipotle, BWW, Portillo's, etc. Example: \"Chipotle app deals\" or \"chain specials near me\".",
      inputSchema: {
        type: 'object',
        properties: {
          chain_name: { type: 'string', description: 'Filter to specific chain' },
          app_only: { type: 'boolean', description: 'Only app-exclusive deals', default: false },
        },
      },
      execute: async function (params) {
        return mcpResponse(await apiFetch('/api/v1/deals/chains?' + toQuery(params)));
      },
    },

    {
      name: 'chicago_neighborhood_deals_summary',
      description:
        'Get a summary of deals in a Chicago neighborhood, venue count, deal count, top deals, cuisine breakdown. Example: \"show me Wicker Park deals overview\".',
      inputSchema: {
        type: 'object',
        properties: {
          neighborhood: { type: 'string', description: 'Neighborhood name, e.g. "Wicker Park"' },
        },
        required: ['neighborhood'],
      },
      execute: async function (params) {
        return mcpResponse(await apiFetch('/api/v1/neighborhoods/summary?' + toQuery(params)));
      },
    },

    {
      name: 'plan_chicago_deal_crawl',
      description:
        'Plan a multi-stop bar/food crawl across Chicago venues with active deals. ' +
        'Optimizes route, timing, and savings. Example: \"4-stop happy hour crawl in West Loop on Thursday\".',
      inputSchema: {
        type: 'object',
        properties: {
          neighborhood: { type: 'string', description: 'Starting neighborhood' },
          day: { type: 'string', description: 'Day for the crawl, e.g. "thursday" or "today"', enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday','today'] },
          budget: { type: 'number', description: 'Budget per person in dollars' },
          group_size: { type: 'integer', description: 'Group size (default: 2)', default: 2 },
          max_stops: { type: 'integer', description: 'Max stops (default: 4)', default: 4 },
        },
        required: ['neighborhood'],
      },
      execute: async function (params) {
        return mcpResponse(await apiFetch('/api/v1/deals/plan-crawl?' + toQuery(params)));
      },
    },

    {
      name: 'submit_chicago_deal',
      description:
        'Submit a new deal tip for verification. Example: \"submit a deal for Big Star, $1 oysters Tuesday 4-6pm\".',
      inputSchema: {
        type: 'object',
        properties: {
          venue_name: { type: 'string', description: 'Venue name' },
          deal_description: { type: 'string', description: 'Deal details' },
          deal_type: { type: 'string', description: 'Deal category, e.g. "happy_hour" or "daily_special"', enum: ['happy_hour','daily_special','brunch_deal','late_night','chain_app_deal','game_day','other'] },
        },
        required: ['venue_name', 'deal_description'],
      },
      execute: async function (params) {
        return mcpResponse(await apiFetch('/api/v1/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venue_name: params.venue_name,
            deal_description: params.deal_description,
            deal_type: params.deal_type || null,
          }),
        }));
      },
    },
  ];

  // Initialize when DOM is ready
  function initWebMCP() {
    if (typeof navigator === 'undefined' || !navigator.modelContext) {
      console.log('[312Deals WebMCP] navigator.modelContext not available, tools not registered');
      return;
    }

    var registered = 0;
    for (var i = 0; i < TOOLS.length; i++) {
      try {
        navigator.modelContext.registerTool({
          name: TOOLS[i].name,
          description: TOOLS[i].description,
          inputSchema: TOOLS[i].inputSchema,
          execute: TOOLS[i].execute,
        });
        registered++;
      } catch (e) {
        console.warn('[312Deals WebMCP] Failed to register ' + TOOLS[i].name + ':', e.message);
      }
    }

    // EMPIRICALLY CONFIRMED (2026-02-19): provideContext() only accepts { tools: [...] }.
    // Native API surface: registerTool, unregisterTool, provideContext, clearContext.
    // NOT available: requestUserInteraction, getTools, listTools, respondWith.

    console.log('[312Deals WebMCP] ' + registered + ' tools registered');
  }

  // Run init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebMCP);
  } else {
    initWebMCP();
  }
})();
