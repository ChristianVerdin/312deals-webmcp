"""
312Deals WebMCP Server-Side Middleware
======================================
Handles agent-aware request routing, analytics ingestion,
and dual-format responses (JSON for AI agents, HTML for humans).

Also serves the .well-known/webmcp.json discovery manifest.

Dual API Support (Feb 2026):
    - Declarative API: Agents discover tools via HTML form attributes
    - Imperative API: Tools registered via navigator.modelContext.registerTool()
    - Server-side: This middleware detects agent requests regardless of API type

Usage:
    from webmcp.webmcp_middleware import setup_webmcp

    app = FastAPI()
    setup_webmcp(app, db_path="data/chideals.db")
"""

import json
import sqlite3
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# ============================================================
# AGENT DETECTION
# ============================================================

AGENT_HEADERS = {
    'x-agent-invoked',      # WebMCP standard header
    'x-webmcp-agent',       # Alternative convention
    'x-mcp-client',         # MCP ecosystem header
}

AGENT_UA_PATTERNS = [
    'WebMCP/',              # WebMCP-aware agents
    'ChromeDevTools-MCP',   # Chrome DevTools MCP
    'ClaudeAgent/',         # Claude browser agent
    'GeminiAgent/',         # Gemini browser agent
    'CopilotAgent/',        # Microsoft Copilot
    'GPTAgent/',            # ChatGPT browser agent
]


def is_agent_request(request: Request) -> bool:
    """Detect if a request was triggered by an AI agent."""
    for header in AGENT_HEADERS:
        if request.headers.get(header):
            return True
    ua = request.headers.get('user-agent', '')
    for pattern in AGENT_UA_PATTERNS:
        if pattern in ua:
            return True
    accept = request.headers.get('accept', '')
    if 'application/json' in accept and 'text/html' not in accept:
        return True
    return False


def get_agent_info(request: Request) -> dict:
    """Extract agent identification info from request headers."""
    return {
        'is_agent': is_agent_request(request),
        'agent_name': request.headers.get('x-webmcp-agent', 'unknown'),
        'agent_version': request.headers.get('x-webmcp-version', 'unknown'),
        'tool_name': request.headers.get('x-webmcp-tool', None),
        'user_agent': request.headers.get('user-agent', ''),
    }


# ============================================================
# FASTAPI MIDDLEWARE
# ============================================================

class WebMCPMiddleware(BaseHTTPMiddleware):
    """
    Middleware that:
    1. Detects agent vs human requests
    2. Sets request.state.is_agent_request
    3. Adds WebMCP headers to all responses
    """

    async def dispatch(self, request: Request, call_next):
        request.state.is_agent_request = is_agent_request(request)
        request.state.agent_info = get_agent_info(request)

        response = await call_next(request)

        # WebMCP headers
        response.headers['X-WebMCP-Available'] = 'true'
        response.headers['X-WebMCP-Tools'] = '10'
        response.headers['X-WebMCP-Discovery'] = '/.well-known/webmcp.json'
        response.headers['X-WebMCP-Spec'] = 'WebML-CG-2026;document.modelContext;navigator-fallback'
        response.headers['X-WebMCP-API'] = 'declarative+imperative'

        if request.state.is_agent_request:
            response.headers['X-WebMCP-Response'] = 'true'

        return response


# ============================================================
# ANALYTICS ENDPOINT
# ============================================================

def create_analytics_table(db_path: str):
    """Create the WebMCP analytics table with soft navigation support."""
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS webmcp_analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            event_type TEXT NOT NULL,
            tool_name TEXT,
            params_keys TEXT,
            param_count INTEGER DEFAULT 0,
            has_result INTEGER DEFAULT 0,
            result_size INTEGER DEFAULT 0,
            duration_ms INTEGER,
            page_url TEXT,
            user_agent TEXT,
            navigation_type TEXT DEFAULT 'hard',
            timestamp TEXT,
            received_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_analytics_session ON webmcp_analytics(session_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_analytics_tool ON webmcp_analytics(tool_name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_analytics_time ON webmcp_analytics(timestamp)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_analytics_type ON webmcp_analytics(event_type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_analytics_nav ON webmcp_analytics(navigation_type)")
    conn.commit()
    conn.close()


def register_analytics_routes(app: FastAPI, db_path: str):
    """Register WebMCP analytics endpoints."""

    create_analytics_table(db_path)

    @app.post("/api/v1/analytics/webmcp")
    async def ingest_analytics(request: Request):
        """Receive batched WebMCP analytics events from the client."""
        try:
            body = await request.json()
            events = body.get('events', [])
            session_id = body.get('session_id', 'unknown')

            if not events:
                return JSONResponse({'status': 'ok', 'ingested': 0})

            conn = sqlite3.connect(db_path)
            ingested = 0

            for event in events[:200]:
                try:
                    conn.execute("""
                        INSERT INTO webmcp_analytics
                        (session_id, event_type, tool_name, params_keys, param_count,
                         has_result, result_size, duration_ms, page_url, user_agent,
                         navigation_type, timestamp)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        session_id,
                        event.get('type', 'unknown'),
                        event.get('tool_name'),
                        json.dumps(event.get('params_keys', [])),
                        event.get('param_count', 0),
                        1 if event.get('has_result') else 0,
                        event.get('result_size', 0),
                        event.get('duration_ms'),
                        event.get('page_url'),
                        event.get('user_agent'),
                        event.get('navigation_type', 'hard'),
                        event.get('timestamp'),
                    ))
                    ingested += 1
                except Exception:
                    continue

            conn.commit()
            conn.close()

            return JSONResponse({'status': 'ok', 'ingested': ingested})

        except Exception as e:
            return JSONResponse({'status': 'error', 'message': str(e)}, status_code=400)

    @app.get("/api/v1/analytics/webmcp/summary")
    async def analytics_summary():
        """Get WebMCP analytics summary for admin dashboard."""
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        summary = {}

        row = conn.execute("SELECT COUNT(*) as cnt FROM webmcp_analytics WHERE event_type = 'tool_call'").fetchone()
        summary['total_tool_calls'] = row['cnt']

        rows = conn.execute("""
            SELECT tool_name, COUNT(*) as cnt, AVG(duration_ms) as avg_ms
            FROM webmcp_analytics WHERE event_type = 'tool_call' AND tool_name IS NOT NULL
            GROUP BY tool_name ORDER BY cnt DESC
        """).fetchall()
        summary['by_tool'] = [{'tool': r['tool_name'], 'calls': r['cnt'], 'avg_ms': round(r['avg_ms'] or 0)} for r in rows]

        row = conn.execute("SELECT COUNT(DISTINCT session_id) as cnt FROM webmcp_analytics").fetchone()
        summary['unique_sessions'] = row['cnt']

        # Soft navigation stats
        row = conn.execute("SELECT COUNT(*) as cnt FROM webmcp_analytics WHERE event_type = 'soft_navigation'").fetchone()
        summary['soft_navigations'] = row['cnt']

        rows = conn.execute("""
            SELECT strftime('%H', timestamp) as hour, COUNT(*) as cnt
            FROM webmcp_analytics
            WHERE timestamp > datetime('now', '-1 day') AND event_type = 'tool_call'
            GROUP BY hour ORDER BY hour
        """).fetchall()
        summary['hourly_trend_24h'] = [{'hour': r['hour'], 'calls': r['cnt']} for r in rows]

        rows = conn.execute("""
            SELECT params_keys, COUNT(*) as cnt
            FROM webmcp_analytics
            WHERE event_type = 'tool_call' AND tool_name = 'search_chicago_deals'
            GROUP BY params_keys ORDER BY cnt DESC LIMIT 10
        """).fetchall()
        summary['popular_search_patterns'] = [{'params': r['params_keys'], 'count': r['cnt']} for r in rows]

        conn.close()
        return JSONResponse(summary)


# ============================================================
# DISCOVERY MANIFEST ROUTE
# ============================================================

def register_discovery_route(app: FastAPI, manifest_path: str = None):
    """Serve the .well-known/webmcp.json discovery manifest."""

    if manifest_path is None:
        manifest_path = str(
            Path(__file__).parent.parent.parent / 'public' / '.well-known' / 'webmcp.json'
        )

    @app.get("/.well-known/webmcp.json")
    async def webmcp_discovery():
        try:
            with open(manifest_path) as f:
                manifest = json.load(f)
            return JSONResponse(
                manifest,
                headers={
                    'Cache-Control': 'public, max-age=3600',
                    'Content-Type': 'application/json',
                    'X-WebMCP-Version': '1.0',
                    'X-WebMCP-API': 'declarative+imperative',
                }
            )
        except FileNotFoundError:
            return JSONResponse({'error': 'WebMCP manifest not found'}, status_code=404)


# ============================================================
# CONVENIENCE
# ============================================================

def setup_webmcp(app: FastAPI, db_path: str, manifest_path: str = None):
    """
    One-liner to set up all WebMCP server-side functionality.

    Usage:
        from webmcp.webmcp_middleware import setup_webmcp
        app = FastAPI()
        setup_webmcp(app, db_path="data/chideals.db")
    """
    app.add_middleware(WebMCPMiddleware)
    register_analytics_routes(app, db_path)
    register_discovery_route(app, manifest_path)
