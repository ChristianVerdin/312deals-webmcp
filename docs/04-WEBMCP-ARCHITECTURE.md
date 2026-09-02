# ChiDeals — WebMCP Architecture & Implementation Guide

## Executive Summary

WebMCP (Web Model Context Protocol) is a proposed W3C web standard that shipped in Chrome 146 Canary on February 10, 2026. It lets websites expose structured, callable tools directly to AI agents through `navigator.modelContext`. ChiDeals implements WebMCP to become **the canonical deals data layer for every AI agent in Chicago**.

This document covers ChiDeals' dual-strategy implementation:
1. **WebMCP Provider** — Our site exposes deal search tools to any browser agent
2. **WebMCP Consumer** — We use Chrome DevTools MCP to scrape JS-heavy restaurant sites
3. **Traditional MCP Server** — Backend server for non-browser AI integrations

---

## 1. Why WebMCP Is a Category-Defining Opportunity

### The "USB-C of AI Agents" Analogy

Before WebMCP, AI agents interacted with websites by:
- Taking screenshots and "seeing" the page (2,000+ tokens per viewport)
- Scraping DOM elements and guessing what buttons do
- Simulating clicks through fragile CSS selectors

WebMCP replaces all of this with structured tool contracts. A website declares: "Here are my capabilities, here are the inputs I accept, here's what I return." The agent reads the contract, calls the function, gets structured JSON back.

**Performance impact:**
- ~67% reduction in computational overhead vs visual agent-browser interactions
- Up to 89% fewer tokens (20-100 tokens per tool call vs ~2,000 per screenshot)
- No verification screenshots needed — tool responses confirm success directly

### Why ChiDeals Should Be First

Every Chicago deal competitor (HH Revolution, Small Tabs, ChitownHappyHour) is a static website or Instagram account. None have structured APIs. None are thinking about agent-readability.

When a user asks their AI assistant "What are the best happy hours near me in Chicago?" while browsing chideals.com, our WebMCP tools give the agent **structured, real-time, queryable results** — not a screenshot of a webpage.

This is a first-mover advantage that compounds: as more people use AI agents for local discovery, being the structured data source is the moat.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI AGENTS                                 │
│  (Claude, Gemini, ChatGPT, Copilot, Custom)                │
├─────────────────┬───────────────────────────────────────────┤
│                 │                                           │
│  ┌──────────────▼──────────────┐  ┌────────────────────────┐│
│  │    WebMCP (Browser)         │  │  Traditional MCP       ││
│  │    navigator.modelContext   │  │  FastMCP Python Server ││
│  │    (requires open tab)      │  │  (no browser needed)   ││
│  └──────────────┬──────────────┘  └──────────┬─────────────┘│
│                 │                             │              │
│  ┌──────────────▼─────────────────────────────▼─────────────┐│
│  │              ChiDeals API Layer                          ││
│  │              FastAPI @ /api/v1/*                          ││
│  └──────────────────────────┬───────────────────────────────┘│
│                             │                                │
│  ┌──────────────────────────▼───────────────────────────────┐│
│  │              SQLite Database                              ││
│  │              chideals.db                                  ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Three Entry Points, Same Data

| Entry Point | Technology | User Requirement | Use Case |
|---|---|---|---|
| **WebMCP** | `navigator.modelContext` in Chrome 146+ | User has chideals.com open in browser tab | Browser-based agents (Gemini, Claude in Chrome, ChatGPT Browse) |
| **Traditional MCP** | FastMCP Python server via stdio | None — server-to-server | Claude Desktop, Claude Code, custom agent pipelines |
| **REST API** | FastAPI HTTP endpoints | None — standard API | Next.js frontend, mobile apps, third-party integrations |

---

## 3. WebMCP Provider Implementation

### 3.1 Tool Registry (`src/webmcp/webmcp_tools.js`)

Our WebMCP implementation registers 8 tools. The Feb 2026 Chrome blog confirms a **Dual API** approach — Declarative (HTML forms) and Imperative (JavaScript). We use both:

| Tool | Registration | Description | Key Parameters |
|---|---|---|---|
| `search_chicago_deals` | 📋+⚡ Both | Primary deal discovery | neighborhood, day, deal_type, cuisine, query |
| `deals_near_location` | 📋+⚡ Both | Geo-proximity search | address, radius_miles, active_now |
| `get_venue_deals` | 📋+⚡ Both | Single venue + all deals | venue_name or venue_id |
| `chicago_deal_of_the_day` | ⚡ Imperative | Today's top deal | zone (optional) |
| `chicago_chain_deals` | ⚡ Imperative | National chain promotions | chain_name, app_only |
| `chicago_neighborhood_deals_summary` | ⚡ Imperative | Neighborhood overview | neighborhood |
| `plan_chicago_deal_crawl` | ⚡ Imperative | Optimal bar crawl planner | neighborhood, day, budget, group_size |
| `submit_chicago_deal` | 📋+⚡ Both | Community deal submission | venue_name, deal_description |

**📋 = Declarative** (HTML form attributes for fast agent discovery)
**⚡ = Imperative** (navigator.modelContext.registerTool() for complex handlers)

### 3.1.1 Why Both APIs?

- **Declarative (fast path)**: Agents discover form-based tools from HTML attributes alone — no JavaScript execution needed. Ideal for search/lookup tools.
- **Imperative (power path)**: Complex tools requiring multi-step logic, API orchestration, or human-in-the-loop confirmation need JavaScript handlers.
- **Our strategy**: 4 form-based tools get both paths. 4 complex tools stay imperative-only.

### 3.2 Declarative Form Enhancement

For HTML search forms, we add WebMCP Declarative API attributes so agents can discover tools without executing JavaScript:

> ⚠️ **VERIFICATION NOTE**: The exact attribute names (`toolname`, `tooldescription`, `toolparamdescription`, `toolautosubmit`) are NOT confirmed in public Chrome docs. These are the expected pattern based on the Chrome blog's description. Actual names might use `data-*` prefix. Applied programmatically via `enhanceFormsForWebMCP()` so they can be updated in ONE place. Sign up for EPP verification: https://developer.chrome.com/docs/ai/join-epp

```html
<!-- Expected pattern (attribute names pending EPP verification) -->
<form id="deal-search-form"
      toolname="search_chicago_deals_form"
      tooldescription="Search Chicago food and drink deals"
      toolautosubmit="false">
  <input name="neighborhood"
         toolparamdescription="Chicago neighborhood (e.g., West Loop)" />
  <input name="day"
         toolparamdescription="Day of week or 'today'" />
  <select name="deal_type"
          toolparamdescription="Deal type: happy_hour, brunch_deal, etc.">
    <option value="happy_hour">Happy Hour</option>
    <!-- ... -->
  </select>
</form>
```

### 3.2.1 Native vs Polyfill Detection

The `index.js` orchestrator checks for WebMCP availability in this order:

```javascript
// 1. Native API (Chrome 146+ with flag or stable)
if ('modelContext' in navigator && !navigator.modelContext?.__polyfill)
  → source: 'native'

// 2. @mcp-b/global polyfill
if ('modelContext' in navigator)
  → source: 'polyfill'

// 3. Neither available
  → source: 'unavailable' (graceful degradation)
```

This ensures we use the most performant path (native) when available, with automatic fallback.

### 3.3 Agent-Aware Response Handling

When an agent submits a form, the Declarative API signals an agent-driven submission. We use this to return JSON instead of rendering HTML:

> ⚠️ `SubmitEvent.agentInvoked` is NOT confirmed in public Chrome docs. The `isAgentSubmission()` function in `webmcp_tools.js` checks for it but falls back gracefully. Server-side detection via `WebMCPMiddleware` (header-based) is more reliable.

```javascript
form.addEventListener('submit', (e) => {
  if (isAgentSubmission(e)) {
    e.preventDefault();
    const data = new FormData(form);
    fetch('/api/v1/deals/search?' + new URLSearchParams(data))
      .then(r => r.json())
      .then(data => {
        // Agent gets structured JSON response
      });
  }
  // Normal users get the standard form submission
});
```

### 3.4 Context Provider

We provide rich context about ChiDeals so agents understand our capabilities:

```javascript
navigator.modelContext.provideContext({
  description: 'ChiDeals — most comprehensive food and drink deals database in Chicago...',
  capabilities: ['deal_search', 'geo_search', 'chain_deals', ...],
  data_freshness: 'Weekly verification cycle',
  coverage_area: 'Chicago metro — 52 neighborhoods + 5 suburban zones'
});
```

### 3.5 React Integration (`src/webmcp/useWebMCP.js`)

Drop-in hook for Next.js:

```jsx
import { useWebMCP } from '@/webmcp/useWebMCP';

export default function App({ Component, pageProps }) {
  const { available, registered, agentInteractions } = useWebMCP();

  return (
    <>
      <Component {...pageProps} />
      {/* Agent interaction analytics */}
      {available && (
        <script dangerouslySetInnerHTML={{ __html: `
          console.log('WebMCP: ${registered} tools active');
        `}} />
      )}
    </>
  );
}
```

---

## 4. Agent SEO — The New Optimization Frontier

### 4.1 Why Tool Descriptions Are the New Meta Descriptions

When an agent decides which tool to call, it reads the `description` and `inputSchema`. The quality of these descriptions directly determines whether our tools get selected over alternatives.

**Bad tool description:**
```
"Search deals"
```

**Good tool description (what we use):**
```
"Find food and drink deals across 52 Chicago neighborhoods and suburbs.
Covers happy hours, daily specials, taco tuesday, brunch deals, late-night eats,
chain app promotions, game day specials, and seasonal offers at 500+ verified venues.
Data is verified weekly. Returns deal title, venue, address, times, prices, and savings."
```

### 4.2 Agent SEO Best Practices We Follow

1. **Specific coverage claims** — "52 neighborhoods", "500+ venues", "12 deal types"
2. **Enumerated capabilities** — List every deal type the agent might search for
3. **Data quality signals** — "verified weekly", "updated daily"
4. **Return value descriptions** — Tell the agent exactly what they'll get back
5. **Parameter descriptions with examples** — `"e.g., 'Roscoe Village', 'West Loop'"`
6. **Geographic specificity** — "Chicago, IL metro area" not just "local"

### 4.3 Discovery Manifest (`.well-known/webmcp.json`)

When the W3C finalizes the discovery spec (expected mid-2026), agents will crawl `.well-known/webmcp.json` to find tools **before visiting the page**. We have this ready at `public/.well-known/webmcp.json`.

This is the equivalent of `robots.txt` for AI agents — and we'll be Day 1.

---

## 5. WebMCP Consumer — Chrome DevTools MCP for Scraping

### 5.1 The Problem: JS-Heavy Restaurant Sites

Many Chicago restaurants use SPA platforms that load deal content dynamically:
- **Toast** — Full React SPA, menus load via API calls
- **Square** — Client-side rendering, no server-rendered HTML
- **BentoBox** — Single-page sites with tab-based navigation
- **Custom SPAs** — React/Vue/Angular sites where Firecrawl gets empty shells

### 5.2 Chrome DevTools MCP Solution

We add `chrome-devtools-mcp` to our MCP stack to handle these sites:

```json
{
  "chrome-devtools": {
    "command": "npx",
    "args": ["chrome-devtools-mcp@latest"]
  }
}
```

**26 tools across 6 categories:**

| Category | Key Tools | ChiDeals Use |
|---|---|---|
| Navigation | `navigate_page`, `wait_for` | Go to restaurant sites, wait for JS to render |
| User Input | `click`, `fill` | Click "Specials" tabs, handle cookie banners |
| DOM/Visual | `take_screenshot`, `get_dom_snapshot` | Verify deal content visually |
| Runtime | `evaluate_script` | Extract deal data from rendered DOM |
| Network | `list_network_requests`, `get_network_request` | Find API endpoints the site calls for deal data |
| Performance | `performance_analyze_insight` | Identify slow-loading sites |

### 5.3 Scraping Workflow: Chrome DevTools MCP vs Firecrawl

```
Is the restaurant site a static HTML page?
  YES → Use Firecrawl MCP (faster, cheaper, structured extraction)
  NO  → Does it use Toast/Square/BentoBox/custom SPA?
    YES → Use Chrome DevTools MCP:
          1. navigate_page → restaurant URL
          2. wait_for → deal content to render
          3. click → "Specials" or "Happy Hour" tab if needed
          4. evaluate_script → extract deal data from DOM
          5. list_network_requests → find API endpoints for direct access next time
    NO  → Try Firecrawl first, fall back to Chrome DevTools if incomplete
```

### 5.4 Network Request Discovery (Power Move)

Chrome DevTools MCP's `list_network_requests` tool reveals the API calls a restaurant site makes. If we find a Toast/Square API endpoint that returns menu data as JSON, we can call it directly next time — no browser automation needed.

```
Claude Code prompt:
"Navigate to https://example-toast-site.com/menu and list all network requests.
Filter for JSON responses containing price data. Save any API endpoints
that return deal/menu information to our scraper_targets.json."
```

---

## 6. Traditional MCP Server (`src/mcp_server/chideals_mcp.py`)

### 6.1 When to Use

- **Claude Desktop** — Users add ChiDeals as an MCP server for personal use
- **Claude Code** — Developers query the deal database during development
- **Custom pipelines** — Server-to-server integrations with other AI systems
- **ChatGPT plugins** — If/when OpenAI supports MCP natively

### 6.2 Tools Exposed

Same 6 core tools as WebMCP, minus the browser-specific ones:

| Tool | Same as WebMCP? |
|---|---|
| `search_chicago_deals` | ✓ Identical parameters and response |
| `deals_near_location` | ✓ Identical |
| `chicago_deal_of_the_day` | ✓ Identical |
| `chicago_chain_deals` | ✓ Identical |
| `get_database_health` | New — development/monitoring tool |

### 6.3 Resources Exposed

| Resource URI | Content |
|---|---|
| `chideals://deal-types` | All deal type categories with descriptions |
| `chideals://neighborhoods` | All 52 neighborhoods with coordinates |

---

## 7. Implementation Timeline

| Phase | Timeframe | WebMCP Actions |
|---|---|---|
| **Phase 1: MVP** | Weeks 1-4 | Build clean API layer (`/api/v1/*`). Structure all queries as API endpoints. API is the single source of truth for all consumers. |
| **Phase 2: Browser Scraping** | Weeks 5-6 | Add Chrome DevTools MCP to dev stack. Use for Toast/Square/BentoBox sites. Discover hidden API endpoints via network monitoring. |
| **Phase 3: WebMCP Provider** | Weeks 7-8 | Deploy `webmcp_tools.js` on chideals.com. Register all 8 tools. Add declarative form attributes. Test with Chrome 146 Canary. |
| **Phase 4: Traditional MCP** | Weeks 8-10 | Deploy `chideals_mcp.py` as installable MCP server. Publish to MCP server registry. |
| **Phase 5: Discovery** | Month 4+ | Deploy `.well-known/webmcp.json` when spec finalizes. Optimize tool descriptions for agent selection. Monitor agent interaction analytics. |

---

## 8. Analytics & Monitoring

### 8.1 WebMCP Interaction Tracking

The `useWebMCP` hook tracks every agent tool call:

```javascript
window.posthog?.capture('webmcp_tool_call', {
  tool_name: 'search_chicago_deals',
  params: ['neighborhood', 'day'],
  timestamp: '2026-03-15T14:30:00Z',
});
```

### 8.2 Key Metrics

| Metric | Description | Target |
|---|---|---|
| Agent tool calls / week | How many AI agents are using our tools | 100+ by Month 3 |
| Most-called tool | Which tool agents prefer | `search_chicago_deals` |
| Agent-driven deal views | Deals viewed via agent referral | 10% of total views |
| Submission via agent | Community deals submitted by agents | 5+ per week |
| Discovery manifest hits | `.well-known/webmcp.json` requests | Track when spec launches |

### 8.3 API Health Endpoint

`GET /api/v1/health` returns:
```json
{
  "status": "healthy",
  "venues": 523,
  "deals": 1847,
  "neighborhoods": 52,
  "webmcp": "available"
}
```

---

## 9. Security Considerations

### 9.1 WebMCP Security Model

- **Human-in-the-loop** — WebMCP requires user presence (browser tab open)
- **No auto-submit** — Declarative forms default to user confirmation
- **Secure context required** — HTTPS only (localhost exempt for dev)
- **Rate limiting** — API endpoints should rate-limit agent requests

### 9.2 What We Expose vs What We Don't

| Expose | Don't Expose |
|---|---|
| Deal search (public data) | User accounts/sessions |
| Venue details (public data) | Admin/moderation tools |
| Deal submission (rate-limited) | Scraper configurations |
| Neighborhood summaries | Internal analytics |
| Chain deals (public data) | Database health (MCP only, not WebMCP) |

### 9.3 `requestUserInteraction()`

For sensitive actions (like deal submission), WebMCP supports pausing agent execution to get explicit user confirmation:

```javascript
// In the submit_chicago_deal tool handler:
const confirmed = await navigator.modelContext.requestUserInteraction({
  reason: 'Confirm deal submission',
  message: `Submit this deal for ${params.venue_name}?`
});
if (!confirmed) return { content: [{ type: 'text', text: 'Submission cancelled by user.' }] };
```

---

## 10. Competitive Analysis

| Platform | Has API? | Has WebMCP? | Discovery Manifest? | Analytics? | Agent-Accessible? |
|---|---|---|---|---|---|
| **ChiDeals** | ✓ REST + MCP | ✓ 8 tools | ✓ `.well-known/webmcp.json` | ✓ Full telemetry | ✓ Three entry points |
| HH Revolution | ✗ | ✗ | ✗ | ✗ | ✗ Static HTML only |
| Small Tabs | ✗ (shut down) | ✗ | ✗ | ✗ | ✗ |
| ChitownHappyHour | ✗ | ✗ | ✗ | ✗ | ✗ Instagram only |
| Yelp | ✓ (limited) | ✗ | ✗ | N/A | Partial (API deprecated features) |
| Google Maps | ✓ | Unknown | Unknown | N/A | Partial (no deal-specific tools) |

**Competitive moat**: ChiDeals is the only Chicago deals platform designed from Day 1 to be AI-agent accessible, with full-stack WebMCP implementation including client-side tool registration, server-side agent detection, analytics telemetry, and a discovery manifest for future crawler-based tool discovery. When agents become the primary way people discover local deals (projected 2027-2028), we own the data layer.

---

## 11. WebMCP Analytics System

### Client-Side Telemetry (`webmcp_analytics.js`)

Every tool call is instrumented via `wrapWithAnalytics()`, which intercepts handler execution to capture timing, parameters used, and result sizes — without capturing PII or parameter values.

**Soft Navigation Support (Chrome 145+):**
Next.js SPA route changes trigger "soft navigations" — no full page reload. Without handling these, analytics data between routes would be lost. `observeSoftNavigations()` uses `PerformanceObserver` (with pushState fallback for older browsers) to:
1. Flush the analytics buffer before the new "page"
2. Track navigation events for funnel analysis
3. Re-enhance declarative forms on new page content

**Data flow:**
```
Tool Call → wrapWithAnalytics() → In-Memory Buffer
                                       ↓ (30s flush OR soft navigation)
                                  POST /api/v1/analytics/webmcp
                                       ↓
                                  webmcp_analytics SQLite table
                                       ↓
                                  v_webmcp_dashboard view
```

**Key metrics tracked:**
- Tool name and event type (`tool_call`, `tool_registration`, `context_provided`, `soft_navigation`)
- Parameter keys used (not values) and parameter count
- Duration in milliseconds
- Result size and success/failure
- Navigation type (`hard` = full page load, `soft` = SPA route change)
- Session ID (ephemeral, client-generated)
- Page URL and user agent

**Privacy by design:** No user IDs, emails, or parameter values are stored. Session IDs are ephemeral UUIDs generated per browser session. `sendBeacon` ensures analytics flush on page exit without blocking navigation.

### Server-Side Middleware (`webmcp_middleware.py`)

The `WebMCPMiddleware` FastAPI middleware detects agent requests and sets `request.state.is_agent_request` for route handlers:

**Agent detection signals (any one triggers):**
- `X-Agent-Invoked` header (WebMCP standard)
- User-agent matching `WebMCP/`, `ChromeDevTools-MCP`, `ClaudeAgent/`
- `Accept: application/json` preference over HTML

**Routes registered by `setup_webmcp(app)`:**
- `POST /api/v1/analytics/webmcp` — Ingests batched telemetry events
- `GET /api/v1/analytics/webmcp/summary` — Aggregated dashboard data
- `GET /.well-known/webmcp.json` — Discovery manifest with 24h caching

### Analytics Dashboard Queries

```sql
-- Top tools by usage
SELECT * FROM v_webmcp_dashboard;

-- Daily trends
SELECT * FROM v_webmcp_daily;

-- Most popular search neighborhoods
SELECT params_keys, COUNT(*) as cnt
FROM webmcp_analytics
WHERE tool_name = 'search_chicago_deals'
GROUP BY params_keys ORDER BY cnt DESC;
```

---

## 12. Testing & Quality Assurance (`webmcp_inspector.js`)

### Tool Schema Validation

`validateToolSchema()` scores each tool definition for Agent SEO quality:

**Scoring criteria (100-point scale, -15 per issue):**
- Description exists and is 50-500 characters
- Action verbs present (find, search, get, list, show, plan, submit)
- Examples array included
- All parameters have descriptions
- Tool name follows naming convention

### Automated Tool Testing

`runToolTests()` generates test cases from schemas and executes handlers:

```javascript
const report = await generateReport(tools);
// Output:
// ✓ search_chicago_deals — PASS (Quality: 100, Duration: 12ms)
// ✓ deals_near_location — PASS (Quality: 85, Duration: 8ms)
// ⚠ submit_chicago_deal — WARNING: Missing examples (Quality: 70)
```

### Chrome DevTools MCP Testing

### Chrome DevTools MCP Testing

Two options for end-to-end testing, both verified on npm:

**Option A (Recommended): `@mcp-b/chrome-devtools-mcp`** — MCP-B fork with dedicated WebMCP tools

The [WebMCP-org](https://github.com/WebMCP-org) publishes a fork that wraps Google's official server and adds `list_webmcp_tools` + `call_webmcp_tool`:

```bash
# Install in Claude Code
claude mcp add chrome-devtools-webmcp npx @mcp-b/chrome-devtools-mcp@latest

# Then in Claude Code:
# 1. Navigate to ChiDeals
navigate_page('http://localhost:3000')

# 2. Discover registered WebMCP tools (dedicated tool)
list_webmcp_tools
# → Returns: search_chicago_deals, deals_near_location, get_venue_deals, etc.

# 3. Call a WebMCP tool (dedicated tool)
call_webmcp_tool('search_chicago_deals', {neighborhood: 'Roscoe Village', day: 'thursday'})
# → Returns: Structured JSON with deal data

# 4. Verify analytics captured the call
sqlite3 data/chideals.db "SELECT * FROM webmcp_analytics ORDER BY id DESC LIMIT 5;"
```

Architecture: `AI Client → @mcp-b/chrome-devtools-mcp → CDP → Website → @mcp-b/global → navigator.modelContext`

**Option B: Official `chrome-devtools-mcp`** — Use `evaluate_script` as fallback

Google's official server (v0.17.0, [GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp)) can test WebMCP via its general-purpose `evaluate_script` tool:

```bash
# Install in Claude Code
claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest

# Navigate and test via JavaScript evaluation
navigate_page('http://localhost:3000')
evaluate_script('JSON.stringify(navigator.modelContext.getTools().map(t => t.name))')
evaluate_script('navigator.modelContext.callTool("search_chicago_deals", {neighborhood: "Roscoe Village"}).then(r => JSON.stringify(r))')
```

Use `--autoConnect` to attach to an already-running Chrome instance (Chrome 144+, requires `chrome://inspect/#remote-debugging`). Both `--autoConnect` (camelCase) and `--auto-connect` (kebab-case) are accepted; Google's canonical examples use camelCase.

Note: `--autoConnect` is additive to `--browser-url`, not a replacement. Use `--browser-url` for WSL/sandboxed environments.

---

## 13. Integration Guide

### Next.js App Setup

```javascript
// _app.js or layout.js
import { initChiDealsWebMCP, teardownChiDealsWebMCP } from '@/webmcp';

useEffect(() => {
  const result = initChiDealsWebMCP({
    analytics: true,
    declarativeForms: true,
    humanInTheLoop: true,
    debug: process.env.NODE_ENV === 'development'
  });
  console.log(`WebMCP: ${result.registered} tools registered`);
  return () => teardownChiDealsWebMCP();
}, []);
```

### FastAPI Backend Setup

```python
# main.py
from webmcp.webmcp_middleware import setup_webmcp

app = FastAPI(title="ChiDeals API")
setup_webmcp(app, db_path="data/chideals.db")
```

### Admin Status Check

```javascript
import { getWebMCPStatus } from '@/webmcp';

const status = getWebMCPStatus();
// → { available: true, initialized: true, registered_tools: 8,
//     analytics: { totalCalls: 142, uniqueSessions: 23, ... },
//     chrome_version: '146.0.7200.1' }
```

---

## 14. File Reference

| File | Purpose |
|---|---|
| `src/webmcp/index.js` | **Main orchestrator** — native vs polyfill detection, init/teardown, soft navigation |
| `src/webmcp/webmcp_tools.js` | 8 tool definitions with schemas, handlers, Declarative form enhancement |
| `src/webmcp/useWebMCP.js` | React hook for Next.js integration |
| `src/webmcp/webmcp_analytics.js` | Client-side telemetry with soft navigation PerformanceObserver |
| `src/webmcp/webmcp_middleware.py` | FastAPI middleware for agent detection + analytics API |
| `src/webmcp/webmcp_inspector.js` | Schema validation + Declarative form validation + detection testing |
| `src/api/deals_api.py` | FastAPI backend serving all three consumers |
| `src/mcp_server/chideals_mcp.py` | Traditional MCP server for non-browser agents |
| `public/.well-known/webmcp.json` | Discovery manifest (8 tools with registration_type, Dual API) |
| `config/mcp_servers_v5.json` | MCP stack config with --autoConnect for Chrome DevTools |
| `data/schema.sql` | Database schema (webmcp_analytics with navigation_type column) |
| `docs/04-WEBMCP-ARCHITECTURE.md` | This document |
