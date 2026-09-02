# ChiDeals — Chicago Food & Drink Deals

Find the best happy hours, daily specials, and food deals across 150+ Chicago-area neighborhoods (city + suburbs). AI-native architecture with three data channels: REST API, MCP server, and WebMCP (browser-native AI tools).

> **Current scale (Aug 2026):** **{{deals}} live deals** across **{{venues}} venues** and **{{neighborhoods}} neighborhoods** (~70% coverage), including a live day-of-week surface at [`/today`](https://www.312deals.com/today). Deal collection runs on a free **Gemini-grounded freshness engine** (`scripts/check_venue_freshness.py`); the Apify social scrapers were **retired Jul 13 2026** (Firecrawl also hard-blocks instagram.com), so IG-active venues are now refreshed via Gemini (`--has-source instagram`). **Agent-ready:** Mintlify Agent Score **96/100 (Grade A)** — machine-readable `llms.txt` + `.md` variants of every content page. See [`CLAUDE.md`](CLAUDE.md) for the pipeline; cost-per-deal figures + validated yields now live in `docs/reference/operational-context.md`.

## Quick Start

```bash
# 1. Setup
bash scripts/setup.sh

# 2. Fill in API keys
vim .env   # At minimum: ANTHROPIC_API_KEY

# 3. Start backend
source .venv/bin/activate
uvicorn src.api.deals_api:app --reload --port 8000

# 4. Start frontend (separate terminal)
npm install && npm run dev

# 5. Open http://localhost:3000
```

## Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Next.js UI  │  │  Claude Code  │  │  AI Agents   │
│ :3000        │  │  (MCP client) │  │  (Chrome)    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
       │ REST API        │ FastMCP          │ WebMCP
       ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ FastAPI      │  │ chideals_mcp │  │ index.js     │
│ deals_api.py │  │    .py       │  │ webmcp_tools │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
       └────────────────┼──────────────────┘
                        │
                 ┌──────▼───────┐
                 │   SQLite DB  │
                 │ chideals.db  │
                 └──────────────┘
```

**Three channels, one database:**

| Channel | Use Case | Entry Point |
|---------|----------|-------------|
| REST API | Frontend, curl, integrations | `uvicorn src.api.deals_api:app` |
| MCP Server | Claude Code, Cursor, any MCP client | `python -m src.mcp_server.chideals_mcp` |
| WebMCP | AI agents visiting chideals.com in Chrome | Registered via `src/webmcp/index.js` |

## Deployment & Database Storage

- **Frontend** → Vercel (`www.312deals.com`). **Backend** → Railway (`chideals-production.up.railway.app`).
- **The SQLite DB is not in the git repo.** `data/chideals.db` (~100 MB) exceeds GitHub's 100 MiB hard per-file limit, so it is `.gitignore`d/untracked and **distributed via Cloudflare R2**. Railway fetches it at boot:
  - `railway.toml` start command runs `python scripts/fetch_db_on_boot.py` before `uvicorn`. That script downloads R2 `live/chideals.db.gz`, gunzips, verifies (byte floor + `PRAGMA integrity_check` + table count, **exit-1 on failure** so a bad DB fails the deploy and Railway keeps the last good one), then replays the latest user-write delta (`user_writes/latest.json`).
  - **Publishing data:** after a local gather, run `scripts/pull_live_user_writes.py` (merge live user writes) → `scripts/upload_db_to_r2.py` (sole writer of `live/chideals.db.gz`) → `git push` code only.
  - **Push-back:** `.github/workflows/user-writes-snapshot.yml` (6-hourly) exports live user-write tables to R2 so a redeploy between gathers replays them on boot.
  - R2 creds (`BACKUP_S3_*` / `AWS_*`) live in `.env`, Railway service vars, and GitHub secrets; shared client in `scripts/r2_util.py`. The frontend is API-only and never reads the DB file, so untracking it does not affect the Vercel build.

## Key Commands

```bash
# API
uvicorn src.api.deals_api:app --reload --port 8000
curl "http://localhost:8000/api/v1/deals/search?neighborhood=west+loop&day=today"
curl "http://localhost:8000/api/v1/health"

# MCP Server
python -m src.mcp_server.chideals_mcp
claude mcp add chideals -- python -m src.mcp_server.chideals_mcp

# Scraping
python -m src.scrapers.batch_scraper              # Full pipeline
python -m src.scrapers.batch_scraper --chains      # Chain deals only
python -m src.scrapers.batch_scraper --verify      # Verify stale deals

# Tests (mocked — no external/paid calls; temp SQLite only)
.venv/bin/python3 -m pytest                         # backend unit tests (33)

# Database
sqlite3 data/chideals.db "SELECT COUNT(*) FROM deals WHERE is_active = 1"
```

## Project Structure

```
chideals/
├── CLAUDE.md                    # ← Lean agent context (read this first; history/detail → docs/reference/)
├── config/mcp_servers_v5.json   # MCP client configs (Google Maps, Chrome DevTools, etc.)
├── data/
│   ├── schema.sql               # 14 tables, 6 views
│   └── seed/                    # neighborhoods.json, scraper_targets.json
├── docs/reference/              # Session history + operational context (moved out of CLAUDE.md 2026-08-07)
├── src/
│   ├── api/deals_api.py         # FastAPI (11 endpoints)
│   ├── mcp_server/chideals_mcp.py # FastMCP (5 tools)
│   ├── models/models.py         # Pydantic models, enums, Claude prompts
│   ├── pipeline/deal_extractor.py # Claude API extraction pipeline
│   ├── scrapers/                # batch, website, chain, verify
│   ├── webmcp/                  # Browser-native AI tool registration
│   └── app/                     # Next.js App Router pages
├── scripts/setup.sh             # One-time project setup
├── package.json                 # Next.js + @mcp-b/global
├── requirements.txt             # Python deps (FastAPI, FastMCP, Anthropic)
└── next.config.js               # API proxy rewrites (:3000 → :8000)
```

## Documentation map

> Documentation restructured 2026-08-07 12:47 PM CT — see CLAUDE.md "Reference docs (load on demand)" for the index.

| Doc | What it covers |
|---|---|
| `docs/reference/session-history.md` | Full session-by-session record (Sessions 44–57 + the July 22–28 master-plan block), May-12 priority list, cleanup queue, and March traffic baseline — moved verbatim out of CLAUDE.md |
| `docs/reference/operational-context.md` | Corpus/product facts, Apify allowlist history, validated per-source yields, the affluent-suburb play, and the monetization priority order — moved verbatim out of CLAUDE.md |

CLAUDE.md itself is now the lean always-loaded context: session protocols, live data contracts (R2 DB flow, newsletter/AgentMail), durable gotchas and decisions, and the load-on-demand reference index.

## WebMCP (Experimental)

ChiDeals implements the W3C Web Model Context API, letting AI agents discover and call deal-search tools directly in the browser. Uses Dual API architecture: Declarative (HTML forms) + Imperative (`navigator.modelContext.registerTool()`).

See the "WebMCP (Browser-Native Agent Tools)" section of `CLAUDE.md` for the summary; full details in `docs/04-WEBMCP-ARCHITECTURE.md` and `docs/05-WEBMCP-IMPLEMENTATION-GUIDE.md`.

## Coverage Atlas

Single regenerable source of truth for venue / source / social / deal coverage across all {{neighborhoods}} neighborhoods. Generated as **one high-level Atlas + {{neighborhoods}} per-hood drilldown pages** in the Obsidian vault.

- **High-level Atlas:** `vault://312Deals/Pipeline/Coverage-Atlas.md` — corpus stats, channel health, city/suburb/county roll-ups (Cook/Lake/DuPage/Will/Kane/Kendall), worst-covered tables, 6-tier action playbook
- **Per-hood drilldown:** `vault://312Deals/Neighborhoods/<Hood>.md` — one file per active neighborhood, with dataview-queryable frontmatter (zone, county, venue/deal counts, coverage %, dark, IG/FB/web/OT, HV-dark, last venue/deal dates) and Snapshot / Channel coverage / Source health / Top-10 HV-dark venues / Suggested moves sections. Human-authored Notes/History sections are preserved across regenerations.
- **Refresh both:** `python3 scripts/build_coverage_atlas.py` (idempotent, ~3 seconds)
- **Daily-driver slash command: `/coverage`** — inside Claude Code, type `/coverage` to refresh the Atlas, pull 24h delta from the DB, and get today's single top action with a paste-ready command. Pass a hood name (e.g. `/coverage glenview`) for a per-hood drilldown. Defined at `.claude/commands/coverage.md`.

Read or refresh before any coverage work — don't write ad-hoc DB queries.

## Environment

Requires: Python 3.11+, Node.js 20+, SQLite 3.35+

See `.env.template` for all configuration options.
