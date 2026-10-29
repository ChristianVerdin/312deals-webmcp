# 312Deals: Tonight, planned together

**Live:** https://www.312deals.com · **Challenge entry:** OpenAI WebMCP Challenge, Sep 2026 · **License:** MIT

312Deals is a live, free database of food and drink deals across Chicagoland: 83,000+ active deals at 12,000+ venues in 149 neighborhoods, as of Oct 28, 2026. This repo is the site's source, exported for the WebMCP Challenge with the pre-existing baseline and the challenge work in separate, dated commits.

## What people and their agents do together here

Open the site in ChatGPT's desktop browser (or Chrome 149+ with WebMCP enabled) and the page registers **17 tools** on `document.modelContext`:

- **10 data tools** over the live corpus: search deals by neighborhood, day, type or cuisine, deals near an address, a venue's deals, deal of the day, chain deals, a neighborhood summary, a multi-stop crawl planner, order and reservation links, and a moderated community deal tip.
- **7 "Tonight" tools** over a plan that lives *in the page*, in the **Tonight panel** at the bottom right of every page. The agent reads the plan, sets constraints (budget, hours, group size, max stops, neighborhood), adds stops from real deals, moves them, reorders them by deal time window, removes them and clears the plan. Every agent change shows up in the panel with an "agent" chip and a toast.
- **The person** adds any deal from its card, moves stops, vetoes them, and **locks** the ones that must stay. Locked stops are constraints, not suggestions. An agent call against a locked stop returns a structured refusal (`"locked by the user … plan around it"`), so the agent re-plans instead of overriding.

Since the challenge, the live site has added an 18th tool, `tonight_add_stops`, which adds several stops in one all-or-nothing call. This repo stays at the 17 tools from the challenge entry.

What was hard before: a person can't rank 83,000 time-windowed deals, and an agent shouldn't decide where you drink. The shared plan splits the work. The agent optimizes against live inventory and the person keeps taste and veto, on one surface both can see.

Try it in ChatGPT's desktop browser, on the live site. Start with "using this site's tools", because a bare question can send the model to general web search instead of the page's tools:

1. "Using this site's tools, find me a happy hour in West Loop tonight."
2. "Using this site's tools, find three happy hours in Wicker Park on tonight and add them to my Tonight plan in the order I should visit them, starting at 6." The stops land in the Tonight panel marked *agent*.
3. Lock stop 1 in the panel, then: "Using the site tools, reorder my Tonight plan by deal windows." The locked stop stays put.
4. "Using the site tools, remove stop 1 from my Tonight plan." The agent is refused. Only the padlock in the panel unlocks the stop.
5. Click the Moon icon on any deal card to add a stop yourself, then: "Using the site tools, get me the reservation link for Big Star tonight at 6pm for 4." OpenTable opens on that date, time and party size.
6. Click the arrow in the address bar, then "Recently used", to see every tool call the browser made.

## How WebMCP is implemented

- `src/webmcp/index.js` feature-detects `document.modelContext` (the current spec, in ChatGPT desktop and Chrome 149+) and falls back to `navigator.modelContext` (Chrome 146 to 148 Canary). It registers every tool with `readOnlyHint` / `destructiveHint` annotations and an `AbortSignal`, and tears down through both paths.
- `src/webmcp/webmcp_tools.js` holds the 10 data tools. Each one proxies the public REST API and **shapes the result for an agent**: the API's ~60 deal columns and ~92 venue columns are trimmed to what a person acts on, with a link to the page and a note when results were left out.
- `src/webmcp/tonight_tools.js` holds the 7 Tonight tools over the shared plan (`src/store/use-store.ts`, zustand, saved per browser). Locked-stop refusals come back as data.
- `src/components/tonight-panel.tsx` and `tonight-button.tsx` are the person's side of the same state.
- `src/components/webmcp-provider.tsx` mounts registration across the whole app, and the tools re-register on client navigations.
- `public/.well-known/webmcp.json` is an informational catalog of all 17 tools. Discovery itself happens in the page, as the spec describes.
- `src/webmcp/webmcp_middleware.py` handles server-side agent detection and WebMCP analytics ingest (FastAPI).

## Prior work vs. challenge work

| Commit | Date | Status |
|---|---|---|
| `Baseline: 312deals.com as of Sep 2, 2026` | 2026-09-02 | **Pre-existing.** The whole site, including the original 10-tool WebMCP layer on the legacy `navigator.modelContext` surface. Not part of the judged work. |
| `feat(webmcp): register on document.modelContext …` | 2026-09-03 | **Challenge work.** Spec-surface migration, annotations, AbortSignal teardown, agent-shaped results, address support, manifest and header fixes. |
| `feat(tonight): a shared night-out plan …` | 2026-09-03 | **Challenge work.** The Tonight panel, the 7 collaborative tools, the lock and veto contract. |
| `docs: …` | 2026-09-03 | This README and the manifest listing. |

Both challenge commits were deployed to production at www.312deals.com on Sep 3, 2026. This README was brought up to date on Oct 29, 2026, and the code is unchanged since the challenge.

## What is not in this repo

The deal-collection pipeline (scrapers, extraction prompts and quality scoring) and the database are deliberately left out. The web app and its tools talk to the live API, which is what judges and agents use. One consequence: the newsletter-ingestion webhook in `src/api/deals_api.py` imports the extractor lazily and will not run here. Every other endpoint does.

## Running it

The web app is Next.js 14 and the API is FastAPI. The deal corpus is not in this repo, so the app talks to the live API, which is what judges and agents use.

```bash
npm install
API_URL=https://chideals-production.up.railway.app npm run dev   # frontend on :3000, tools proxy to the live API
```

To test WebMCP, open http://localhost:3000 (or the live site) in ChatGPT's desktop browser, or in Chrome 149+ with `chrome://flags/#enable-webmcp-testing` turned on. The **Site tools** panel in the address bar lists the registered tools.

Backend (optional, needs a SQLite copy of the corpus at `data/chideals.db`). Run it from the repo root with uvicorn as shown, not with `npm run api`, which changes to the parent folder first:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn src.api.deals_api:app --reload --port 8000
```

## Data and third parties

Deal data comes from venues' own web pages, newsletters and submissions. Deals are quality-scored, with re-verification in progress. The live API serves the data under the site's terms, and it is not redistributed in this repo. Reservation and ordering links point to the venues' own OpenTable, Resy or ordering pages.
