# ChiDeals — WebMCP Implementation Guide

## Who This Is For

This guide walks through setting up the WebMCP module in a local development environment.

**Time estimate:** 2–3 hours for full integration + testing. About 45 minutes if you just want to see tools registering in Chrome Canary.

---

## Table of Contents

1. [Prerequisites & Environment Check](#1-prerequisites--environment-check)
2. [Install Chrome Canary & Enable WebMCP Flag](#2-install-chrome-canary--enable-webmcp-flag)
3. [Install Project Dependencies](#3-install-project-dependencies)
4. [Wire Up the FastAPI Backend](#4-wire-up-the-fastapi-backend)
5. [Wire Up the Next.js Frontend](#5-wire-up-the-nextjs-frontend)
6. [Initialize the SQLite Database](#6-initialize-the-sqlite-database)
7. [Run the App Locally](#7-run-the-app-locally)
8. [Verify WebMCP Tools in Chrome](#8-verify-webmcp-tools-in-chrome)
9. [Test with Chrome DevTools MCP](#9-test-with-chrome-devtools-mcp)
10. [Run the Inspector & Quality Checks](#10-run-the-inspector--quality-checks)
11. [Verify Analytics Pipeline](#11-verify-analytics-pipeline)
12. [Deploy Checklist](#12-deploy-checklist)
13. [Troubleshooting](#13-troubleshooting)
14. [What's Next](#14-whats-next)

---

## 1. Prerequisites & Environment Check

Before starting, confirm you have everything in place. Run this from the chideals project root:

```bash
# From ~/chideals or wherever your project lives
echo "=== Environment Check ==="
echo "Node: $(node --version)"           # Need 18+
echo "npm: $(npm --version)"             # Need 9+
echo "Python: $(python3 --version)"      # Need 3.10+
echo "SQLite: $(sqlite3 --version)"      # Need 3.35+
echo "uvicorn: $(uvicorn --version 2>/dev/null || echo 'NOT INSTALLED')"
echo ""
echo "=== Project Check ==="
ls -la src/webmcp/                        # Should show 6 files
ls -la public/.well-known/webmcp.json     # Discovery manifest
ls -la config/mcp_servers_v5.json         # Updated MCP config
ls -la data/schema.sql                    # Schema with webmcp_analytics table
```

**Expected output:** You should see all 7 WebMCP module files:
- `index.js` — Orchestrator (native vs polyfill detection, soft navigation)
- `webmcp_tools.js` — 8 tool definitions with Declarative form enhancement
- `useWebMCP.js` — React hook
- `webmcp_analytics.js` — Client telemetry with soft navigation support
- `webmcp_middleware.py` — FastAPI middleware
- `webmcp_inspector.js` — Testing/validation (schema + Declarative forms + detection)

**If any files are missing:** Go back to the previous conversation outputs and download/copy them into the correct paths.

### FAQ: Do I need a Google Chrome Canary install on WSL?

**Short answer:** You need Chrome Canary (146+) running on **Windows**, not inside WSL. WSL doesn't have a native GUI browser. You'll run the Next.js dev server and FastAPI server inside WSL, then open `http://localhost:3000` in Chrome Canary on Windows. WSL's localhost forwarding makes this seamless.

### FAQ: Does WebMCP work in any browser besides Chrome?

**Not yet natively.** As of February 2026, native `navigator.modelContext` only ships in Chrome 146 Canary behind a flag. However, the `@mcp-b/global` polyfill provides the API in any modern browser. Our `index.js` orchestrator detects native vs polyfill automatically:
- **Chrome 146+ with flag**: Native API (best performance)
- **Any browser with `@mcp-b/global` loaded**: Polyfill (full functionality)
- **Neither**: Graceful degradation — `initChiDealsWebMCP()` returns `{ available: false }`

The `getWebMCPStatus()` function reports `detection_source: 'native' | 'polyfill' | 'unavailable'`.

---

## 2. Install Chrome Canary & Enable WebMCP Flag

This is the most important step. Without Chrome Canary 146+ and the flag enabled, `navigator.modelContext` doesn't exist and none of the tools register.

### Step 2a: Install Chrome Canary on Windows

1. Open your Windows browser (Edge, Chrome Stable, whatever)
2. Go to: **https://www.google.com/chrome/canary/**
3. Download and install Chrome Canary
4. Open it once to let it finish setup

### Step 2b: Enable the WebMCP Flag

1. In Chrome Canary's address bar, type: **`chrome://flags`**
2. Search for: **`WebMCP`** (or `Model Context Protocol`)
3. Find the flag labeled something like **"WebMCP for testing"** or **"Model Context Protocol"**
4. Set it to **Enabled**
5. Click **Relaunch** at the bottom

### Step 2c: Verify the Flag Works

1. Open Chrome Canary's DevTools (F12)
2. Go to the **Console** tab
3. Type: `navigator.modelContext`
4. You should see an object (not `undefined`)

If you see `undefined`, the flag isn't enabled or you're on the wrong Chrome version. Check `chrome://version` — the version should be 146.x.x.x or higher.

### FAQ: What exact flag name am I looking for?

The flag name has changed across Canary builds. Search for any of these terms in `chrome://flags`:
- "WebMCP"
- "Model Context"
- "model-context-protocol"
- "navigator.modelContext"

If you can't find it, your Canary build might be too old. Update Chrome Canary to the latest version.

### FAQ: I'm on a Mac. Does this work?

Yes. Chrome Canary is available for macOS too. Same flag process. The only difference is that you won't have WSL — you'd run everything natively.

---

## 3. Install Project Dependencies

### Step 3a: Node.js Dependencies

From the chideals project root:

```bash
npm install
```

The `package.json` includes `@mcp-b/global` in devDependencies for TypeScript types for `navigator.modelContext`. This is just for IDE autocomplete — it doesn't add runtime code. If this package isn't available on npm, you can safely remove it; the code works without it.

### Step 3b: Python Dependencies

```bash
# If you have a venv, activate it first
source .venv/bin/activate  # or however you manage your venv

pip install -r requirements.txt
```

Key packages for WebMCP:
- `fastapi` — API server
- `uvicorn` — ASGI server to run FastAPI
- `pydantic` — Request/response models

If you don't have a venv yet:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Step 3c: Playwright (Optional — for scraping, not WebMCP itself)

```bash
playwright install chromium
```

You only need this if you're running the scraping pipeline. The WebMCP module itself doesn't use Playwright.

---

## 4. Wire Up the FastAPI Backend

The WebMCP middleware module (`webmcp_middleware.py`) needs to be connected to the existing FastAPI app. This adds three things:
1. **Agent detection middleware** — Sets `request.state.is_agent_request` on every request
2. **Analytics ingestion endpoint** — `POST /api/v1/analytics/webmcp`
3. **Discovery manifest route** — `GET /.well-known/webmcp.json`

### Step 4a: Add the import and setup call to deals_api.py

Open `src/api/deals_api.py` and make these changes:

**1. Add the import near the top (after the existing imports, around line 24):**

```python
# WebMCP middleware — agent detection + analytics
from src.webmcp.webmcp_middleware import setup_webmcp
```

**2. Add the setup call after the app is created and CORS is configured (after line 43):**

```python
# Initialize WebMCP: agent detection middleware, analytics API, discovery manifest
setup_webmcp(app, db_path=str(DB_PATH))
```

**3. You can optionally remove the old basic middleware** (lines 82–92) since `setup_webmcp()` installs a more capable version. The old one just added response headers:

```python
# DELETE or comment out this block — setup_webmcp() replaces it:
# @app.middleware("http")
# async def agent_aware_middleware(request: Request, call_next):
#     response = await call_next(request)
#     response.headers["X-ChiDeals-WebMCP"] = "available"
#     response.headers["X-ChiDeals-Version"] = "1.0.0"
#     return response
```

### Step 4b: Make sure the Python import path resolves

The import `from src.webmcp.webmcp_middleware import setup_webmcp` assumes you're running uvicorn from the project root. Verify there's an `__init__.py` in `src/webmcp/`:

```bash
# Check if it exists
ls src/webmcp/__init__.py 2>/dev/null || echo "MISSING"

# If missing, create it
touch src/webmcp/__init__.py
```

Also make sure `src/__init__.py` exists (it should already):

```bash
ls src/__init__.py
```

### FAQ: Why is there a Python file in src/webmcp/ alongside JavaScript files?

The `src/webmcp/` directory is a polyglot module. The `.js` files run client-side (in the browser, registered via `navigator.modelContext`). The `.py` file runs server-side (in FastAPI, detecting agent requests and ingesting analytics). They work together:

```
Browser (JS)                          Server (Python)
─────────────                         ───────────────
webmcp_tools.js → tool call           → deals_api.py handles request
webmcp_analytics.js → POST batch      → webmcp_middleware.py ingests
index.js → orchestrates client        → setup_webmcp() orchestrates server
```

### FAQ: Does setup_webmcp() create the database table automatically?

Yes. The `register_analytics_routes()` function inside `setup_webmcp()` runs a `CREATE TABLE IF NOT EXISTS webmcp_analytics` statement at startup. You don't need to manually run the schema migration for the analytics table — but you should run the full schema.sql anyway to make sure all other tables exist (see Step 6).

---

## 5. Wire Up the Next.js Frontend

The WebMCP tools register client-side when the page loads. You need to call `initChiDealsWebMCP()` from your app's root component.

### Step 5a: Determine your app entry point

Check which routing system your Next.js app uses:

```bash
# App Router (Next.js 14 default)
ls src/app/layout.tsx src/app/layout.jsx src/app/layout.js 2>/dev/null

# Pages Router (older style)
ls src/pages/_app.tsx src/pages/_app.jsx src/pages/_app.js pages/_app.tsx pages/_app.jsx pages/_app.js 2>/dev/null
```

### Step 5b: Add WebMCP initialization

**If using App Router** (you have `src/app/layout.js` or `src/app/layout.tsx`):

You need a client component wrapper since `useEffect` doesn't work in server components. Create a new file:

```bash
# Create the WebMCP provider component
cat > src/app/WebMCPProvider.jsx << 'EOF'
'use client';

import { useEffect } from 'react';
import { initChiDealsWebMCP, teardownChiDealsWebMCP } from '@/webmcp';

export default function WebMCPProvider({ children }) {
  useEffect(() => {
    const result = initChiDealsWebMCP({
      analytics: true,
      declarativeForms: true,
      humanInTheLoop: true,
      debug: process.env.NODE_ENV === 'development',
    });

    if (result.available) {
      console.log(`[ChiDeals WebMCP] ${result.registered} tools registered`);
    } else {
      console.log('[ChiDeals WebMCP] Not available (Chrome 146+ with flag required)');
    }

    return () => teardownChiDealsWebMCP();
  }, []);

  return children;
}
EOF
```

Then wrap your layout with it. Open `src/app/layout.js` (or `.tsx`) and add:

```jsx
import WebMCPProvider from './WebMCPProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WebMCPProvider>
          {children}
        </WebMCPProvider>
      </body>
    </html>
  );
}
```

**If using Pages Router** (you have `pages/_app.js` or `src/pages/_app.js`):

```jsx
import { useEffect } from 'react';
import { initChiDealsWebMCP, teardownChiDealsWebMCP } from '@/webmcp';

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    const result = initChiDealsWebMCP({
      analytics: true,
      declarativeForms: true,
      humanInTheLoop: true,
      debug: process.env.NODE_ENV === 'development',
    });
    console.log(`[ChiDeals WebMCP] Registered: ${result.registered} tools`);
    return () => teardownChiDealsWebMCP();
  }, []);

  return <Component {...pageProps} />;
}
```

### Step 5c: Verify the `@/webmcp` import alias resolves

Next.js uses `@/` as an alias for `src/`. Check your `jsconfig.json` or `tsconfig.json`:

```bash
cat jsconfig.json 2>/dev/null || cat tsconfig.json 2>/dev/null
```

You should see something like:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

If this file doesn't exist, create `jsconfig.json` in the project root:

```bash
cat > jsconfig.json << 'EOF'
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"]
}
EOF
```

### FAQ: What if I haven't built any Next.js pages yet?

That's fine. You can create a minimal test page. The WebMCP tools will still register in the background as long as the layout/app wrapper calls `initChiDealsWebMCP()`. Create a basic homepage:

```bash
mkdir -p src/app

cat > src/app/page.jsx << 'EOF'
export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>ChiDeals</h1>
      <p>Every food and drink deal in Chicago.</p>
      <p style={{ color: '#666', fontSize: '14px' }}>
        Open DevTools console to see WebMCP tool registration.
      </p>
    </main>
  );
}
EOF
```

### FAQ: Can I use the React hook (useWebMCP) instead of the index.js orchestrator?

Yes. `useWebMCP.js` is an alternative that provides the same functionality as a React hook with state management. It's useful if you want to show WebMCP status in your UI (e.g., a badge showing "8 AI tools active"). But for basic setup, the `initChiDealsWebMCP()` approach in the layout is simpler and sufficient.

---

## 6. Initialize the SQLite Database

The schema needs to be applied to create all tables, including the new `webmcp_analytics` table and its views.

### Step 6a: Create/update the database

```bash
# From project root
sqlite3 data/chideals.db < data/schema.sql
```

If you get errors about tables already existing, that's fine — the schema uses `CREATE TABLE IF NOT EXISTS` throughout.

### Step 6b: Verify the analytics table was created

```bash
sqlite3 data/chideals.db ".tables" | tr ' ' '\n' | grep -i webmcp
```

Expected output:
```
webmcp_analytics
```

Also verify the views:

```bash
sqlite3 data/chideals.db ".tables" | tr ' ' '\n' | grep -i v_webmcp
```

Expected:
```
v_webmcp_daily
v_webmcp_dashboard
```

### Step 6c: Seed data (if you haven't already)

The WebMCP tools query the deals database. If your database is empty, the tools will return empty results. At minimum, seed the neighborhoods:

```bash
# Check if neighborhoods are seeded
sqlite3 data/chideals.db "SELECT COUNT(*) FROM neighborhoods;"
# Should return 52 (Chicago neighborhoods)

# If 0, seed them:
sqlite3 data/chideals.db < data/seed/neighborhoods.sql
# Or if it's a JSON seed:
python3 scripts/seed_neighborhoods.py
```

If you want test deals to query against, you can insert a few manually:

```sql
-- Quick test deals (run in sqlite3 data/chideals.db)
INSERT OR IGNORE INTO venues (name, slug, neighborhood_id, address, latitude, longitude)
VALUES ('Test Bar', 'test-bar', 1, '123 N Clark St', 41.8842, -87.6324);

INSERT OR IGNORE INTO deals (venue_id, title, deal_type, day_of_week, description, start_time, end_time)
VALUES (1, 'Half-Price Apps', 'happy_hour', 'thursday', '$5 appetizers and $3 drafts', '16:00', '18:00');
```

---

## 7. Run the App Locally

You need two servers running: the FastAPI backend and the Next.js frontend.

### Step 7a: Start the FastAPI backend

Open a terminal in WSL:

```bash
cd ~/chideals  # or wherever your project is
source .venv/bin/activate

# Start on port 8000
uvicorn src.api.deals_api:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

**Verify it's working:**

```bash
# In another terminal
curl http://localhost:8000/api/v1/health
# Should return JSON health check

curl http://localhost:8000/.well-known/webmcp.json
# Should return the discovery manifest JSON
```

### Step 7b: Start the Next.js dev server

Open another terminal:

```bash
cd ~/chideals
npm run dev
```

You should see:
```
  ▲ Next.js 14.x.x
  - Local:    http://localhost:3000
```

### Step 7c: Configure Next.js to proxy API calls to FastAPI

The WebMCP tools call `/api/v1/*` endpoints. In dev, Next.js runs on :3000 and FastAPI on :8000, so you need to proxy. Add this to `next.config.js` (or `next.config.mjs`):

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8000/api/v1/:path*',
      },
      {
        source: '/.well-known/:path*',
        destination: 'http://localhost:8000/.well-known/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
```

**Restart the Next.js dev server** after changing `next.config.js`.

### FAQ: Why two servers? Can I use Next.js API routes instead?

You could, but the FastAPI backend serves three consumers (WebMCP tools, traditional MCP server, and the frontend). Keeping it as a standalone Python server means you can also run it independently for the MCP server integration, run the scraping pipeline against it, and eventually deploy it separately. The Next.js rewrites make it transparent to the browser — all requests go to `:3000` and get proxied.

### FAQ: What if I want to use a single server in production?

In production on Vercel, you'd deploy the FastAPI backend to Railway/Render/Fly.io and update the rewrites to point there:

```javascript
destination: 'https://api.chideals.com/api/v1/:path*',
```

Or you could convert the Python endpoints to Next.js API routes if you want a single deployment. But for development, two servers is cleaner.

---

## 8. Verify WebMCP Tools in Chrome

This is the moment of truth. You're going to open Chrome Canary, visit your local ChiDeals site, and confirm the tools are registered.

### Step 8a: Open Chrome Canary on Windows

1. Launch **Chrome Canary** (not Chrome Stable — the flag only exists in Canary)
2. Navigate to: **`http://localhost:3000`**

### Step 8b: Check the Console

1. Open DevTools: **F12** or **Ctrl+Shift+I**
2. Go to the **Console** tab
3. Look for the log message: `[ChiDeals WebMCP] 8 tools registered`

If you see this, the tools are registered and WebMCP is working.

### Step 8c: Inspect registered tools

In the DevTools Console, run:

```javascript
// List all registered tools
navigator.modelContext.tools
// or
navigator.modelContext.getTools()
```

You should see an array of 8 tool objects. Each has a `name`, `description`, `schema`, and `handler`.

### Step 8d: Manually call a tool

You can test a tool directly from the Console:

```javascript
// Search for Thursday deals in Roscoe Village
const result = await navigator.modelContext.callTool('search_chicago_deals', {
  neighborhood: 'Roscoe Village',
  day: 'thursday'
});
console.log(JSON.parse(result.content[0].text));
```

If you seeded test data, you should see deal results. If the database is empty, you'll get an empty array (which is correct behavior, not an error).

### FAQ: I see "navigator.modelContext is undefined"

Three possible causes:
1. **Wrong browser.** You're in Chrome Stable, not Chrome Canary. Check `chrome://version`.
2. **Flag not enabled.** Go to `chrome://flags`, search "WebMCP", enable it, relaunch.
3. **Chrome version too old.** You need 146+. Check `chrome://version`.

### FAQ: I see "0 tools registered" in the console

This means `navigator.modelContext` exists but `registerTool` calls failed. Check the Console for errors. Common causes:
- The tool handler threw an error (usually because the FastAPI backend isn't running or the proxy isn't configured)
- A tool schema is malformed (the inspector in Step 10 can diagnose this)

---

## 9. Test with Chrome DevTools MCP

This step lets you test WebMCP tools from Claude Code using Chrome DevTools MCP. There are two verified options:

### Step 9a: Option A (Recommended) — `@mcp-b/chrome-devtools-mcp`

The [WebMCP-org](https://github.com/WebMCP-org) publishes `@mcp-b/chrome-devtools-mcp` on npm — a fork of Google's official server that adds dedicated `list_webmcp_tools` and `call_webmcp_tool` tools. This is the cleanest way to test.

```bash
# Add the server to Claude Code
claude mcp add chrome-devtools-webmcp npx @mcp-b/chrome-devtools-mcp@latest
```

Or add manually to your `.claude.json`:

```json
{
  "mcpServers": {
    "chrome-devtools-webmcp": {
      "command": "npx",
      "args": ["-y", "@mcp-b/chrome-devtools-mcp@latest"]
    }
  }
}
```

The server auto-launches Chrome when a tool is first invoked. Then in Claude Code:

```
# 1. Navigate to ChiDeals
navigate_page('http://localhost:3000')

# 2. Discover all registered WebMCP tools
list_webmcp_tools
# → Returns: search_chicago_deals, deals_near_location, get_venue_deals, etc.

# 3. Call a tool
call_webmcp_tool('search_chicago_deals', {neighborhood: 'Roscoe Village', day: 'thursday'})
# → Returns structured JSON with deal data
```

Or just ask in natural language:

> "Navigate to localhost:3000 and list all WebMCP tools on the page"

> "Call search_chicago_deals with neighborhood Wicker Park and day friday"

**How it works:** `AI Client → @mcp-b/chrome-devtools-mcp → CDP → Website → @mcp-b/global polyfill → navigator.modelContext`

The `@mcp-b/global` package (already in your `package.json`) provides the `navigator.modelContext` polyfill, so this works even in Chrome stable — you don't necessarily need Chrome Canary with native WebMCP flag enabled.

### Step 9b: Option B (Fallback) — Official `chrome-devtools-mcp` + `evaluate_script`

Google's official server ([v0.17.0](https://github.com/ChromeDevTools/chrome-devtools-mcp), 26 tools) doesn't have dedicated WebMCP tools, but you can use `evaluate_script` to run JavaScript against the page:

```bash
claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest
```

Key flags:
- `--channel=canary` — Launch/attach to Chrome Canary instead of stable
- `--autoConnect` — Attach to an already-running Chrome (144+, enable at `chrome://inspect/#remote-debugging`)
- `--browser-url=http://127.0.0.1:9222` — Connect via remote debugging port (useful from WSL)

Then in Claude Code:

```
navigate_page('http://localhost:3000')

# Discover tools
evaluate_script('JSON.stringify(navigator.modelContext.getTools().map(t => ({name: t.name, description: t.description})))')

# Call a tool
evaluate_script('navigator.modelContext.callTool("search_chicago_deals", {neighborhood: "Wicker Park", day: "friday"}).then(r => JSON.stringify(r))')
```

### FAQ: Can I use WSL's localhost:9222 to connect to Chrome on Windows?

If using `--browser-url`, you might need the Windows host IP instead of `127.0.0.1`. From WSL:

```bash
cat /etc/resolv.conf | grep nameserver | awk '{print $2}'
```

Then use `--browser-url=http://<that-ip>:9222`.

### FAQ: Do I need Chrome Canary for Option A?

No. The `@mcp-b/global` polyfill implements `navigator.modelContext` in any browser. Chrome Canary with the WebMCP flag gives you the *native* API, but the polyfill works in Chrome stable, Edge, and others. For development and testing, the polyfill is sufficient.

### FAQ: Do I need this step? Can I skip it?

Yes, you can skip it. Steps 8 (Console verification) and 10 (Inspector) are sufficient to confirm everything works. The Chrome DevTools MCP testing is a bonus for validating the full agent-to-tool pipeline.

---

## 10. Run the Inspector & Quality Checks

The `webmcp_inspector.js` module validates your tool schemas and runs automated tests. You can run it from Node.js (no browser needed).

### Step 10a: Run the inspector

```bash
cd ~/chideals

# Run with Node.js
node -e "
  const { validateToolSchema, MockModelContext, runToolTests, generateReport } = require('./src/webmcp/webmcp_inspector.js');
  const { TOOLS } = require('./src/webmcp/webmcp_tools.js');

  // Validate all tool schemas
  TOOLS.forEach(tool => {
    const result = validateToolSchema(tool);
    const status = result.score >= 85 ? '✅' : result.score >= 70 ? '⚠️' : '❌';
    console.log(\`\${status} \${tool.name} — Score: \${result.score}/100\`);
    if (result.issues.length > 0) {
      result.issues.forEach(i => console.log(\`   ↳ \${i}\`));
    }
  });
"
```

**Expected output (all tools should score 85+):**

```
✅ search_chicago_deals — Score: 100/100
✅ deals_near_location — Score: 100/100
✅ get_venue_deals — Score: 100/100
✅ chicago_deal_of_the_day — Score: 100/100
✅ chicago_chain_deals — Score: 100/100
✅ chicago_neighborhoods — Score: 100/100
✅ plan_chicago_deal_crawl — Score: 85/100
✅ submit_chicago_deal — Score: 85/100
```

### Step 10b: Run automated tool tests (requires FastAPI running)

```bash
# Make sure FastAPI is running on port 8000 first, then:
node -e "
  const { MockModelContext, runToolTests, generateReport } = require('./src/webmcp/webmcp_inspector.js');
  const { TOOLS } = require('./src/webmcp/webmcp_tools.js');

  const mock = new MockModelContext();
  TOOLS.forEach(tool => mock.registerTool(tool));

  runToolTests(mock).then(results => {
    const report = generateReport(results);
    console.log(report);
  });
"
```

This calls each tool with auto-generated test parameters and reports pass/fail with timing.

### FAQ: I'm getting "require is not defined" errors

The WebMCP files use ES module `export` syntax. If Node.js complains, either:

1. Add `"type": "module"` to package.json (might affect other things), or
2. Run with the `--experimental-modules` flag, or
3. Create a quick CommonJS wrapper script:

```bash
cat > test_inspector.mjs << 'EOF'
import { validateToolSchema } from './src/webmcp/webmcp_inspector.js';
import { TOOLS } from './src/webmcp/webmcp_tools.js';

TOOLS.forEach(tool => {
  const result = validateToolSchema(tool);
  console.log(`${tool.name}: ${result.score}/100`);
});
EOF

node test_inspector.mjs
```

### FAQ: What does a low quality score mean?

The scores reflect "Agent SEO" — how discoverable and usable your tool is for AI agents. Low scores mean:
- **Missing descriptions** → Agents can't understand what the tool does
- **No examples** → Agents are less likely to select this tool
- **No action verbs** → "Chicago neighborhoods" is worse than "List all Chicago neighborhoods"
- **Sparse parameters** → Agents don't know what inputs are valid

Fix these in `webmcp_tools.js` by improving descriptions, adding examples to the schema, and documenting all parameters.

---

## 11. Verify Analytics Pipeline

The analytics system captures every WebMCP tool call. Let's verify the full pipeline: client → API → database.

### Step 11a: Trigger some tool calls

In Chrome Canary DevTools Console on `localhost:3000`:

```javascript
// Call a few tools to generate analytics events
await navigator.modelContext.callTool('search_chicago_deals', { day: 'monday' });
await navigator.modelContext.callTool('chicago_deal_of_the_day', {});
await navigator.modelContext.callTool('chicago_neighborhoods', {});
```

### Step 11b: Force an analytics flush

The analytics buffer flushes every 30 seconds. To flush immediately:

```javascript
// In Chrome DevTools Console
// The analytics module exposes a flush function if you imported it
// Or just wait 30 seconds, or navigate away from the page (triggers sendBeacon)
```

Or just wait 30 seconds and proceed.

### Step 11c: Check the database

```bash
sqlite3 data/chideals.db "SELECT * FROM webmcp_analytics ORDER BY id DESC LIMIT 10;"
```

You should see rows with your tool calls. If the table is empty after 30+ seconds:

1. Check FastAPI logs for POST requests to `/api/v1/analytics/webmcp`
2. Check Chrome DevTools Network tab for the analytics POST request
3. Check Console for any errors from `webmcp_analytics.js`

### Step 11d: Check the dashboard views

```bash
# Tool usage summary
sqlite3 data/chideals.db "SELECT * FROM v_webmcp_dashboard;"

# Daily trends
sqlite3 data/chideals.db "SELECT * FROM v_webmcp_daily;"
```

### Step 11e: Check the API summary endpoint

```bash
curl http://localhost:8000/api/v1/analytics/webmcp/summary | python3 -m json.tool
```

This returns aggregated analytics data — tool call counts, average durations, hourly trends.

### FAQ: Analytics aren't showing up in the database

Most common causes:
1. **CORS blocking the POST.** Check the FastAPI CORS config allows `localhost:3000`.
2. **Wrong API URL.** The analytics module POSTs to `/api/v1/analytics/webmcp`. Make sure the Next.js rewrite proxies this path to FastAPI.
3. **setup_webmcp() wasn't called.** The analytics ingestion endpoint only exists if you completed Step 4.
4. **Buffer hasn't flushed.** Wait 30 seconds or navigate away from the page.

---

## 12. Deploy Checklist

When you're ready to deploy ChiDeals to production:

### Frontend (Vercel)

- [ ] Push code to GitHub
- [ ] Connect repo to Vercel
- [ ] Set environment variables in Vercel dashboard
- [ ] Update `next.config.js` rewrites to point to production API URL
- [ ] Verify `public/.well-known/webmcp.json` is served at `https://chideals.com/.well-known/webmcp.json`

### Backend (Railway / Render / Fly.io)

- [ ] Deploy FastAPI with `uvicorn src.api.deals_api:app --host 0.0.0.0 --port 8000`
- [ ] Set `DATABASE_PATH` environment variable
- [ ] Verify CORS allows your production domain
- [ ] Test `GET /.well-known/webmcp.json` returns discovery manifest
- [ ] Test `POST /api/v1/analytics/webmcp` accepts events

### Security (Before Going Live)

- [ ] Lock down CORS: replace `allow_origins=["*"]` with `["https://chideals.com"]`
- [ ] Add rate limiting to analytics endpoint (prevent abuse)
- [ ] Review `webmcp_middleware.py` — agent detection headers can be spoofed; don't use for auth
- [ ] Ensure SQLite WAL mode is enabled for concurrent reads
- [ ] Add API key or token for analytics endpoint if needed

### Discovery Manifest

- [ ] Verify `/.well-known/webmcp.json` is accessible at your production URL
- [ ] Update the `"base_url"` field from `localhost` to your production domain
- [ ] Update `"contact"` email
- [ ] Review rate limits — adjust based on actual traffic patterns

---

## 13. Troubleshooting

### "navigator.modelContext is undefined"

| Check | Fix |
|-------|-----|
| Chrome version | Must be Canary 146+. Check `chrome://version` |
| Flag enabled? | `chrome://flags` → search "WebMCP" → Enabled → Relaunch |
| Right browser? | Canary has a gold icon. Stable has a multi-color icon |

### "0 tools registered"

| Check | Fix |
|-------|-----|
| Console errors? | Look for red errors in DevTools Console |
| API running? | `curl localhost:8000/api/v1/health` — must return 200 |
| Proxy working? | `curl localhost:3000/api/v1/health` — must return 200 (proxied) |

### "Failed to fetch" errors from tool calls

| Check | Fix |
|-------|-----|
| FastAPI running? | Check terminal — uvicorn should show request logs |
| Port conflict? | Another service on 8000? Try `lsof -i :8000` |
| Next.js rewrite? | Verify `next.config.js` has the `/api/v1/*` rewrite |

### Analytics not recording

| Check | Fix |
|-------|-----|
| POST endpoint exists? | `curl -X POST localhost:8000/api/v1/analytics/webmcp -H "Content-Type: application/json" -d '{"events":[]}'` |
| setup_webmcp called? | Check FastAPI startup logs for WebMCP middleware init |
| Table exists? | `sqlite3 data/chideals.db ".schema webmcp_analytics"` |
| CORS issue? | Check Network tab in DevTools for blocked requests |

### Import errors in Python

| Error | Fix |
|-------|-----|
| `ModuleNotFoundError: src.webmcp` | Run uvicorn from project root: `cd ~/chideals && uvicorn src.api.deals_api:app` |
| `No module named 'fastapi'` | Activate venv: `source .venv/bin/activate` |
| `__init__.py missing` | `touch src/webmcp/__init__.py` |

### Import errors in JavaScript

| Error | Fix |
|-------|-----|
| `Cannot find module '@/webmcp'` | Check `jsconfig.json` has `"@/*": ["src/*"]` path alias |
| `SyntaxError: Cannot use import` | Next.js handles ES imports. If testing in Node.js, use `.mjs` extension |

---

## 14. What's Next

Once WebMCP is running locally, here's the priority order for building out ChiDeals:

### Immediate (This Week)
1. **Seed real deal data.** Run the scraping pipeline against your target venues (HH Revolution, Lettuce Entertain You, etc.). Empty tools aren't useful to agents.
2. **Build the frontend.** Even a basic search page that calls the same `/api/v1/deals/search` endpoint gives users a reason to visit the site (and keeps a tab open where agents can discover tools).
3. **Test with a real AI agent.** Once Chrome Canary ships WebMCP in stable, try asking Claude (or any browser-based agent) to find deals while you have ChiDeals open.

### Short-Term (Next 2 Weeks)
4. **Deploy to production.** Vercel (frontend) + Railway (backend). Get the `.well-known/webmcp.json` manifest live at your domain.
5. **Monitor analytics.** Build a simple admin page that queries `v_webmcp_dashboard` and `v_webmcp_daily`. Understand which tools agents use most.
6. **Iterate on Agent SEO.** Improve tool descriptions, add more examples, optimize for the queries agents actually send.

### Medium-Term (Next Month)
7. **Traditional MCP server.** The `src/mcp_server/chideals_mcp.py` file provides the same tools for non-browser agents (Claude Desktop, Claude Code, server-to-server). Wire it up and test.
8. **PostHog integration.** Connect the analytics module to PostHog for richer dashboards and user journey tracking.
9. **Content + SEO.** Auto-generated neighborhood landing pages, Instagram content pipeline, email digests.

### Long-Term
10. **Watch the WebMCP spec evolve.** The `.well-known/webmcp.json` discovery manifest is speculative — when Google finalizes the spec, update accordingly. You're already ahead of every competitor by having the infrastructure ready.
11. **Revenue layer.** Affiliate links, promoted listings, premium subscriptions. The agent analytics data tells you exactly which deals and venues get the most AI-driven traffic.

---

## Quick Reference Card

| What | Command |
|------|---------|
| Start FastAPI | `uvicorn src.api.deals_api:app --reload --port 8000` |
| Start Next.js | `npm run dev` |
| Check tools | Console: `navigator.modelContext.tools` |
| Call a tool | Console: `navigator.modelContext.callTool('search_chicago_deals', {day: 'monday'})` |
| Check analytics | `sqlite3 data/chideals.db "SELECT * FROM v_webmcp_dashboard;"` |
| Run inspector | `node test_inspector.mjs` |
| Discovery manifest | `curl localhost:3000/.well-known/webmcp.json` |
| Analytics summary | `curl localhost:8000/api/v1/analytics/webmcp/summary` |
