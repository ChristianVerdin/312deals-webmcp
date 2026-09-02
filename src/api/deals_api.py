"""
312Deals REST API — FastAPI Application
========================================
21 endpoints serving deal data from SQLite.
Corpus figures come from public/product-stats.json via src/product_stats.py.
Mirrors the MCP server's query logic so both channels return identical results.

Run:
    uvicorn src.api.deals_api:app --reload --port 8000

Endpoints:
    GET  /api/v1/deals/search          — Search deals by neighborhood, day, type, cuisine, query
    GET  /api/v1/deals/nearby           — Geo-proximity deal search
    GET  /api/v1/deals/deal-of-the-day  — Today's featured deal
    GET  /api/v1/deals/chains           — National chain deals
    GET  /api/v1/deals/world-cup        — Deals near Soldier Field for FIFA World Cup 2026
    GET  /api/v1/deals/plan-crawl       — Multi-stop bar crawl planner
    GET  /api/v1/search/suggest         — Autocomplete suggestions
    GET  /api/v1/venues/search          — Search venues (returns deals too)
    GET  /api/v1/venues/{slug}          — Single venue with all deals
    GET  /api/v1/neighborhoods          — List neighborhoods with deal counts
    GET  /api/v1/neighborhoods/summary  — Neighborhood stats for agents
    GET  /api/v1/neighborhoods/deal-types — Neighborhood × deal type combos for sitemap
    POST /api/v1/submissions            — Submit a deal tip
    POST /api/v1/deals/{id}/report      — Community deal report (outdated/confirm)
    POST /api/v1/email/subscribe        — Newsletter subscription
    GET  /api/v1/email/unsubscribe      — One-click unsubscribe
    POST /api/v1/email/webhook          — Resend delivery webhooks
    GET  /api/v1/admin/submissions      — List submissions by status (auth required)
    POST /api/v1/admin/submissions/{id}/approve — Approve submission → create deal (auth required)
    POST /api/v1/admin/submissions/{id}/reject  — Reject submission (auth required)
    GET  /api/v1/health                 — Health check
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import Optional

import traceback

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from src.api.sanitize import strip_api_key, strip_photo_keys, strip_private_fields
from src.product_stats import STATS

# ============================================================
# CONFIG
# ============================================================

DB_PATH = Path(os.getenv("CHIDEALS_DB_PATH", "data/chideals.db"))
API_VERSION = "v1"
DEFAULT_LIMIT = 25
MAX_LIMIT = 200
# Anti-bulk-extraction: cap how deep the public deals feed can be paginated.
# The UI never pages past a few hundred (default page size 25); this stops a
# script from walking offset to the end and vacuuming the full deal corpus.
# Venues are intentionally NOT capped here — the sitemap deep-paginates them.
MAX_DEAL_OFFSET = 1000

# Rate limiting — uses X-Forwarded-For behind Vercel/Railway proxies
limiter = Limiter(key_func=get_remote_address)

# Day name mapping
DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

CHICAGO_TZ = ZoneInfo("America/Chicago")

def get_today_day() -> str:
    """Get today's day name lowercase in Chicago time."""
    return DAY_NAMES[datetime.now(CHICAGO_TZ).weekday()]

def get_current_time() -> str:
    """Get current time as HH:MM string in Chicago time."""
    return datetime.now(CHICAGO_TZ).strftime("%H:%M")


# ============================================================
# DATABASE
# ============================================================

def get_db() -> sqlite3.Connection:
    """Get a SQLite connection with row_factory."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def db_connection():
    """Context manager for database connections."""
    conn = get_db()
    try:
        yield conn
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row) -> dict:
    """Convert a sqlite3.Row to a dict, parsing JSON fields."""
    d = dict(row)
    for key in ("days_available", "food_items", "drink_items", "preferences",
                "notification_settings", "google_popular_times", "photo_urls"):
        if key in d and isinstance(d[key], str):
            try:
                parsed = json.loads(d[key])
                # Ensure array fields are actually arrays
                d[key] = parsed if isinstance(parsed, list) else None
            except (json.JSONDecodeError, TypeError):
                # Plain text that isn't valid JSON — null it out so the
                # frontend never receives a string where it expects an array
                d[key] = None
    # Strip any leaked Google API key from photo URLs before returning. Venue
    # photo_url values were stored with `&key=AIza…` from past enrichment; the
    # frontend extracts only the photo ref (proxyPhotoUrl), so dropping the key
    # here closes a public key-leak on /deals/search, /venues, etc.
    strip_photo_keys(d)
    # quality_score is an internal 0-100 ranking signal — used server-side in
    # ORDER BY (best_match etc.) but never exposed publicly. The API already
    # returns deals quality-sorted by default, so the frontend's client-side
    # re-sorts degrade to no-ops that preserve server order.
    d.pop("quality_score", None)
    # Internal provenance (data_quality_notes, notes) — see sanitize.PRIVATE_KEYS.
    # Shared with the MCP server so both public surfaces redact identically.
    strip_private_fields(d)
    return d


_strip_api_key = strip_api_key


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in miles."""
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="312Deals API",
    description=f"Chicago food & drink deals — REST API backed by SQLite. {STATS.deals} deals across {STATS.venues} venues in {STATS.neighborhoods} Chicago neighborhoods. Covers happy hours, daily specials, brunch deals, late-night food, and chain promotions.",
    version="1.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/v1/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow Next.js frontend (localhost:3000) and any origin in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://312deals.com",
        "https://www.312deals.com",
        "https://chideals.vercel.app",
        "https://chat.openai.com",
        "https://chatgpt.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Content-Signal header — opt-in for AI training and search (contentsignals.org)
@app.middleware("http")
async def add_content_signal(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Signal"] = "ai-train=yes, search=yes, ai-input=yes"
    return response

# Wire up WebMCP middleware (agent detection, analytics ingestion, discovery)
try:
    from src.webmcp.webmcp_middleware import setup_webmcp
    setup_webmcp(app, db_path=str(DB_PATH))
except ImportError:
    # WebMCP middleware not available — API still works without it
    pass

# Wire up AI chat endpoint
try:
    from src.api.chat import router as chat_router
    app.include_router(chat_router)
except ImportError:
    # Chat endpoint not available (anthropic SDK not installed) — API still works
    pass


# ============================================================
# STANDARDIZED ERROR HANDLING
# ============================================================

class APIError(BaseModel):
    """Standardized error response used across all endpoints."""
    error: str
    message: str
    status: int
    path: Optional[str] = None

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Return consistent error JSON for all HTTP errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.status_code,
                "message": exc.detail,
                "path": str(request.url.path),
            }
        },
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch unhandled errors (DB failures, etc.) and return 500 with consistent format."""
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": 500,
                "message": "Internal server error",
                "path": str(request.url.path),
            }
        },
    )


# ============================================================
# RESPONSE MODELS
# ============================================================

class PaginationMeta(BaseModel):
    """Pagination metadata included in list responses."""
    page: int
    page_size: int
    total: int
    pages: int

class DealResponse(BaseModel):
    id: int
    venue_name: str
    venue_slug: str
    neighborhood: Optional[str] = None
    deal_type: str
    title: str
    description: Optional[str] = None
    days_available: Optional[list] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_all_day: bool = False
    food_items: Optional[list] = None
    drink_items: Optional[list] = None
    best_deal_item: Optional[str] = None
    best_savings_pct: Optional[float] = None
    restrictions: Optional[str] = None
    source_url: Optional[str] = None
    is_verified: bool = False
    verified_at: Optional[str] = None
    last_checked_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_at: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance_miles: Optional[float] = None


class SubmissionRequest(BaseModel):
    venue_name: str = Field(..., min_length=1, max_length=200)
    deal_description: str = Field(..., min_length=5, max_length=2000)
    venue_address: Optional[str] = None
    deal_type: Optional[str] = None
    days: Optional[str] = None
    times: Optional[str] = None
    submitter_email: Optional[str] = None
    source_url: Optional[str] = None


# ============================================================
# SHARED QUERY BUILDER
# ============================================================

# How many weekdays a deal names. `days_available` is a JSON array of lowercase
# day names, so a LIKE per day is both index-friendly enough and dialect-safe.
DAY_COUNT_SQL = " + ".join(
    f"(CASE WHEN d.days_available LIKE '%\"{d}\"%' THEN 1 ELSE 0 END)"
    for d in ("monday", "tuesday", "wednesday", "thursday",
              "friday", "saturday", "sunday")
)


def build_deal_query(
    neighborhood: Optional[str] = None,
    day: Optional[str] = None,
    day_strict: bool = False,
    max_days: Optional[int] = None,
    deal_type: Optional[str] = None,
    cuisine: Optional[str] = None,
    query: Optional[str] = None,
    active_now: bool = False,
    chain_filter: Optional[str] = None,
    gluten_free: Optional[bool] = None,
    has_patio: Optional[bool] = None,
    dog_friendly_patio: Optional[bool] = None,
    price_range: Optional[str] = None,
    min_rating: Optional[float] = None,
    min_quality: Optional[int] = None,
    time_filter: Optional[str] = None,
    zone: Optional[str] = None,
    exclude_venue_ids: Optional[list[int]] = None,
    sort: Optional[str] = None,
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
) -> tuple[str, list, str, list]:
    """Build parameterized SQL for deal search. Returns (sql, params)."""

    sql = """
        SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
               v.latitude, v.longitude, v.cuisine_type, v.address,
               v.price_level, v.is_chain, v.google_rating, v.google_review_count,
               v.opentable_url, v.resy_url,
               v.is_featured, v.featured_until,
               n.name AS neighborhood, n.slug AS neighborhood_slug
        FROM deals d
        JOIN venues v ON d.venue_id = v.id
        LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
        WHERE d.is_active = 1 AND v.is_active = 1
    """
    params = []

    if neighborhood:
        nh_list = [n.strip().lower() for n in neighborhood.split(",") if n.strip()]
        if len(nh_list) == 1:
            sql += " AND (LOWER(n.name) LIKE ? OR LOWER(n.slug) LIKE ?)"
            pattern = f"%{nh_list[0]}%"
            params.extend([pattern, pattern])
        else:
            placeholders = " OR ".join(
                "(LOWER(n.name) LIKE ? OR LOWER(n.slug) LIKE ?)" for _ in nh_list
            )
            sql += f" AND ({placeholders})"
            for nh in nh_list:
                pattern = f"%{nh}%"
                params.extend([pattern, pattern])

    if day:
        if day.lower() == "today":
            day = get_today_day()
        if day_strict:
            # Only deals that explicitly name this day. The default below also
            # admits undated deals, which is right for "what's on today" but
            # makes every weekday landing page a near-copy of the others: the
            # five generic weekday pages measured 97.5% identical, so Google
            # collapsed them into /deals. Compare taco-tuesday, which carries a
            # text filter, is 2.5% similar to them, and ranks at position 6.
            sql += " AND d.days_available LIKE ?"
        else:
            sql += " AND (d.days_available LIKE ? OR d.days_available IS NULL OR d.days_available = '[]' OR d.days_available = '')"
        params.append(f'%"{day.lower()}"%')

    if max_days:
        # Deals running on at most N days are the day-SPECIFIC ones. Without
        # this, the 8,132 all-week deals still land on all seven pages and keep
        # them ~50% identical even under day_strict. At max_days=3 the weekday
        # pages drop to 1.2% overlap while keeping 289-822 deals each.
        sql += f" AND ({DAY_COUNT_SQL}) BETWEEN 1 AND ?"
        params.append(int(max_days))

    if deal_type:
        dt_list = [t.strip().lower() for t in deal_type.split(",") if t.strip()]
        if len(dt_list) == 1:
            sql += " AND d.deal_type = ?"
            params.append(dt_list[0])
        else:
            placeholders = ",".join("?" for _ in dt_list)
            sql += f" AND d.deal_type IN ({placeholders})"
            params.extend(dt_list)

    if cuisine:
        cu_list = [c.strip().lower() for c in cuisine.split(",") if c.strip()]
        if len(cu_list) == 1:
            sql += " AND LOWER(v.cuisine_type) LIKE ?"
            params.append(f"%{cu_list[0]}%")
        else:
            cu_clauses = " OR ".join("LOWER(v.cuisine_type) LIKE ?" for _ in cu_list)
            sql += f" AND ({cu_clauses})"
            params.extend(f"%{c}%" for c in cu_list)

    if query:
        # Also try hyphenated variant for cuisine matching (e.g. "gluten free" -> "gluten-free")
        hyphenated = query.lower().replace(" ", "-")
        sql += """ AND (
            LOWER(d.title) LIKE ? OR LOWER(d.description) LIKE ?
            OR LOWER(d.best_deal_item) LIKE ? OR LOWER(v.name) LIKE ?
            OR LOWER(v.cuisine_type) LIKE ? OR LOWER(v.cuisine_type) LIKE ?
        )"""
        pattern = f"%{query.lower()}%"
        params.extend([pattern, pattern, pattern, pattern, pattern, f"%{hyphenated}%"])

    if chain_filter == "chain":
        sql += " AND (d.deal_type = 'chain_app_deal' OR v.is_chain = 1)"
    elif chain_filter == "local":
        sql += " AND d.deal_type != 'chain_app_deal' AND v.is_chain = 0"

    if gluten_free:
        sql += " AND d.is_gluten_free = 1"

    if has_patio:
        sql += " AND v.has_patio = 1"

    if dog_friendly_patio:
        sql += " AND v.dog_friendly_patio = 1"

    if min_rating is not None:
        sql += " AND v.google_rating >= ?"
        params.append(min_rating)

    if min_quality:
        # Quality floor for surfaces that sort by recency. `recently_updated`
        # orders on updated_at, so without a floor the newest row wins however
        # thin it is — and a quarter of the freshness harvester's output is
        # chain merch ("Crazy Puffs Crave Combo", "Taco Bell Rewards") that
        # scores under 35 while priced, timed offers score 70+.
        #
        # Gates on QUALITY so recency can still rank inside the pool. Gating on
        # recency instead would bury the evergreen corpus.
        #
        # Falsy (0/None) is deliberately a no-op rather than a NULL filter:
        # 5,326 legacy deals have quality_score NULL and a floor of 0 must not
        # silently drop them.
        sql += " AND d.quality_score >= ?"
        params.append(int(min_quality))

    if price_range:
        # "Deals where at least one item costs no more than N" — the way people
        # actually ask for it ("beers under $5", "cocktails under $10" are the
        # single most common qualifier in the chat logs).
        #
        # Two bugs lived here until 2026-08-22:
        #
        # 1. json_each() is a table-valued function: it evaluates its argument
        #    BEFORE any WHERE clause can filter rows out. 53 rows hold plain
        #    prose rather than JSON ("Guinness $13, Green Beer $12, ..."), so a
        #    single bad row raised "malformed JSON" and the whole endpoint
        #    returned HTTP 500. price_range=under5 was a hard 500 in production.
        #    The json_valid() guard therefore has to wrap the ARGUMENT, not sit
        #    in the subquery's WHERE.
        #
        # 2. The leading OR clauses ("no food items OR no drink items") were
        #    meant to be generous toward deals with no price data. Because few
        #    deals carry both lists, that escape hatch matched 73,863 of 77,392
        #    active deals on its own — the filter was a ~95% no-op whenever it
        #    did not crash. A price filter that returns unpriced deals is not a
        #    price filter, so unpriced deals are now excluded. Only ~21% of the
        #    corpus carries an item price; callers should say so rather than
        #    imply the result is the whole corpus.
        PRICE_CAPS = {"under5": 5, "under10": 10, "under15": 15, "under20": 20}
        if price_range in PRICE_CAPS:
            cap = PRICE_CAPS[price_range]
            sql += """ AND EXISTS (
                SELECT 1 FROM json_each(
                    CASE WHEN json_valid(d.food_items) THEN d.food_items ELSE '[]' END)
                 WHERE json_extract(value, '$.deal_price') IS NOT NULL
                   AND json_extract(value, '$.deal_price') <= ?
                UNION ALL
                SELECT 1 FROM json_each(
                    CASE WHEN json_valid(d.drink_items) THEN d.drink_items ELSE '[]' END)
                 WHERE json_extract(value, '$.deal_price') IS NOT NULL
                   AND json_extract(value, '$.deal_price') <= ?
            )"""
            params.extend([cap, cap])

    if time_filter:
        TIME_RANGES = {
            "lunch": ("11:00", "14:00"),
            "happy_hour": ("15:00", "19:00"),
            "dinner": ("17:00", "21:00"),
            "late_night": ("21:00", "23:59"),
        }
        if time_filter in TIME_RANGES:
            start, end = TIME_RANGES[time_filter]
            sql += """ AND (d.is_all_day = 1 OR (
                d.start_time IS NOT NULL AND d.start_time <= ? AND d.end_time >= ?
            ))"""
            params.extend([end, start])

    if active_now:
        current_time = get_current_time()
        today = get_today_day()
        sql += """ AND (d.is_all_day = 1 OR (
            d.start_time <= ? AND d.end_time >= ?
            AND (d.days_available LIKE ? OR d.days_available IS NULL OR d.days_available = '[]' OR d.days_available = '')
        ))"""
        params.extend([current_time, current_time, f'%"{today}"%'])

    if zone:
        if zone == "suburbs":
            sql += " AND n.zone != 'city'"
        else:
            sql += " AND n.zone = ?"
            params.append(zone)

    if exclude_venue_ids:
        placeholders = ",".join("?" for _ in exclude_venue_ids)
        sql += f" AND v.id NOT IN ({placeholders})"
        params.extend(exclude_venue_ids)

    # Sort options. Active, non-expired featured venues are boosted to the top of
    # every sort (the B2B "Featured listing" mechanic) before the normal ordering.
    featured_rank = (
        "CASE WHEN v.is_featured = 1 AND "
        "(v.featured_until IS NULL OR v.featured_until > date('now')) THEN 0 ELSE 1 END"
    )
    sort_map = {
        "best_match": f"{featured_rank}, d.quality_score DESC NULLS LAST, d.view_count DESC",
        "highest_rated": f"{featured_rank}, v.google_rating DESC NULLS LAST, d.quality_score DESC",
        "recently_updated": f"{featured_rank}, d.updated_at DESC NULLS LAST, d.quality_score DESC",
        "most_deals": f"{featured_rank}, d.quality_score DESC NULLS LAST",  # grouping handled client-side
        # Popularity = rating x review volume, so well-known high-traffic venues
        # lead over tiny-sample 5.0s. Used by curated guides (e.g. dog-friendly patios).
        "popular": f"{featured_rank}, (COALESCE(v.google_rating, 0) * COALESCE(v.google_review_count, 0)) DESC, v.google_review_count DESC NULLS LAST, d.quality_score DESC",
    }
    order_clause = sort_map.get(sort, sort_map["best_match"])
    sql += f" ORDER BY {order_clause}"

    # Build count query before adding LIMIT/OFFSET
    count_sql = f"SELECT COUNT(*) as total FROM ({sql})"
    count_params = list(params)

    sql += " LIMIT ? OFFSET ?"
    params.extend([min(limit, MAX_LIMIT), offset])

    return sql, params, count_sql, count_params


# ============================================================
# ENDPOINTS
# ============================================================

# ============================================================
# RATE LIMITS
# ============================================================

RATE_SEARCH = "200/minute"   # search, nearby, crawl, venues, chains — homepage fires ~8 calls per visitor
RATE_SUGGEST = "300/minute"  # autocomplete fires on keystrokes
RATE_SUBMIT = "5/minute"     # prevent spam submissions
RATE_REPORT = "10/minute"    # community deal reports
RATE_HEALTH = "60/minute"    # monitoring tools


# ============================================================
# CACHE HELPERS
# ============================================================

def cache(response: Response, max_age: int, stale_while_revalidate: int = 0):
    """Set Cache-Control header. max_age and stale_while_revalidate in seconds."""
    parts = [f"public", f"max-age={max_age}"]
    if stale_while_revalidate:
        parts.append(f"stale-while-revalidate={stale_while_revalidate}")
    response.headers["Cache-Control"] = ", ".join(parts)


def pagination_meta(total: int, limit: int, offset: int) -> dict:
    """Build standardized pagination metadata."""
    page_size = min(limit, MAX_LIMIT)
    page = (offset // page_size) + 1 if page_size > 0 else 1
    pages = math.ceil(total / page_size) if page_size > 0 else 1
    return {"page": page, "page_size": page_size, "total": total, "pages": pages}


@app.get("/api/v1/health")
@limiter.limit(RATE_HEALTH)
async def health_check(request: Request):
    """Health check — verifies DB connectivity."""
    try:
        with db_connection() as conn:
            row = conn.execute("SELECT COUNT(*) as cnt FROM deals WHERE is_active = 1").fetchone()
            return {
                "status": "healthy",
                "active_deals": row["cnt"],
                "db_path": str(DB_PATH),
                "version": "1.1.0",
                "timestamp": datetime.now().isoformat(),
            }
    except Exception:
        raise HTTPException(503, "Database unavailable")


@app.get("/api/v1/deals/type-counts")
@limiter.limit(RATE_SEARCH)
async def deal_type_counts(
    request: Request,
    response: Response,
    day: Optional[str] = Query(None, description="Day of week or 'today'"),
    zone: Optional[str] = Query(None, description="Filter by zone: 'city', 'suburbs', or a zone slug"),
):
    """Accurate per-deal-type counts for a given day (default: all days).

    Powers the homepage Browse-by-Type tab badges with TRUE totals instead of a
    sampled page. Reuses build_deal_query's exact WHERE/JOIN semantics, then
    GROUP BY deal_type. `weekend` counts deals available Sat or Sun (any day).
    """
    cache(response, max_age=300, stale_while_revalidate=600)
    # build_deal_query always appends " LIMIT ? OFFSET ?"; strip it for grouping.
    sql, _p, _c, count_params = build_deal_query(day=day, zone=zone)
    base = sql[: sql.rfind(" LIMIT ")]
    grouped = f"SELECT deal_type, COUNT(*) AS cnt FROM ({base}) GROUP BY deal_type"

    wsql, _wp, _wc, weekend_params = build_deal_query(zone=zone)
    wbase = wsql[: wsql.rfind(" LIMIT ")]
    weekend_sql = (
        f"SELECT COUNT(*) AS cnt FROM ({wbase}) "
        "WHERE days_available LIKE '%\"saturday\"%' OR days_available LIKE '%\"sunday\"%'"
    )

    with db_connection() as conn:
        counts = {r["deal_type"]: r["cnt"] for r in conn.execute(grouped, count_params).fetchall()}
        weekend = conn.execute(weekend_sql, weekend_params).fetchone()["cnt"]
    return {
        "day": day,
        "zone": zone,
        "counts": counts,
        "total": sum(counts.values()),
        "weekend": weekend,
    }


@app.get("/api/v1/deals/search")
@limiter.limit(RATE_SEARCH)
async def search_deals(
    request: Request,
    response: Response,
    neighborhood: Optional[str] = Query(None, description="Chicago neighborhood name or slug"),
    day: Optional[str] = Query(None, description="Day of week or 'today'"),
    day_strict: bool = Query(False, description="Require an explicit day match; exclude deals with no day data"),
    max_days: Optional[int] = Query(None, ge=1, le=7, description="Only deals running on at most N days (day-specific deals)"),
    deal_type: Optional[str] = Query(None, description="Deal type filter"),
    cuisine: Optional[str] = Query(None, description="Cuisine filter"),
    query: Optional[str] = Query(None, alias="q", description="Free-text search"),
    active_now: bool = Query(False, description="Only show currently active deals"),
    chain_filter: Optional[str] = Query(None, description="'chain' for chains only, 'local' for local spots only"),
    gluten_free: Optional[bool] = Query(None, description="Filter to gluten-free deals only"),
    has_patio: Optional[bool] = Query(None, description="Filter to venues with patio/outdoor seating"),
    dog_friendly_patio: Optional[bool] = Query(None, description="Filter to venues with a dog-friendly patio"),
    price_range: Optional[str] = Query(None, description="Price filter: under5, under10, under15, under20, any"),
    min_rating: Optional[float] = Query(None, ge=1.0, le=5.0, description="Minimum venue Google rating"),
    min_quality: Optional[int] = Query(None, ge=0, le=100, description="Minimum deal quality score (0-100). Use on recency-sorted surfaces so thin listings do not outrank priced, timed offers."),
    time_filter: Optional[str] = Query(None, description="Time window: lunch, happy_hour, dinner, late_night"),
    ids: Optional[str] = Query(None, description="Comma-separated deal IDs to fetch specific deals"),
    zone: Optional[str] = Query(None, description="Filter by zone: 'city', 'suburbs', or specific zone slug"),
    exclude_venue_ids: Optional[str] = Query(None, description="Comma-separated venue IDs to exclude"),
    sort: Optional[str] = Query(None, description="Sort order: best_match, highest_rated, recently_updated, most_deals"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
):
    """Search deals across all Chicago neighborhoods."""
    cache(response, max_age=300, stale_while_revalidate=60)  # 5 min

    # Direct ID lookup — used by the Saved Deals page
    if ids:
        id_list = [int(i.strip()) for i in ids.split(",") if i.strip().isdigit()]
        if not id_list:
            return {"deals": [], "count": 0, "total": 0, "filters": {}}
        placeholders = ",".join("?" for _ in id_list)
        with db_connection() as conn:
            rows = conn.execute(f"""
                SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
                       v.latitude, v.longitude, v.cuisine_type, v.address,
                       v.price_level, v.is_chain, v.google_rating,
                       n.name AS neighborhood, n.slug AS neighborhood_slug
                FROM deals d
                JOIN venues v ON d.venue_id = v.id
                LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
                WHERE d.id IN ({placeholders}) AND d.is_active = 1
            """, id_list).fetchall()
            deals = [row_to_dict(r) for r in rows]
            return {"deals": deals, "count": len(deals), "total": len(deals), "filters": {}}

    # Anti-bulk-extraction guardrail: deep pagination is how a script would
    # vacuum the whole corpus. The UI never pages this far, so past the cap we
    # return an empty page (infinite-scroll ends gracefully) instead of data.
    if offset > MAX_DEAL_OFFSET:
        return {
            "deals": [], "count": 0, "total": 0,
            "pagination": pagination_meta(0, limit, offset),
            "capped": True,
            "message": f"Pagination is limited to offset {MAX_DEAL_OFFSET}. Narrow your search with filters, or contact us for bulk/API access.",
            "filters": {},
        }

    parsed_exclude = (
        [int(i.strip()) for i in exclude_venue_ids.split(",") if i.strip().isdigit()]
        if exclude_venue_ids else None
    )
    sql, params, count_sql, count_params = build_deal_query(
        neighborhood=neighborhood, day=day, day_strict=day_strict, max_days=max_days,
        deal_type=deal_type,
        cuisine=cuisine, query=query, active_now=active_now,
        chain_filter=chain_filter, gluten_free=gluten_free, has_patio=has_patio,
        dog_friendly_patio=dog_friendly_patio,
        price_range=price_range, min_rating=min_rating, min_quality=min_quality,
        time_filter=time_filter, zone=zone,
        exclude_venue_ids=parsed_exclude,
        sort=sort,
        limit=limit, offset=offset,
    )
    with db_connection() as conn:
        total = conn.execute(count_sql, count_params).fetchone()["total"]
        rows = conn.execute(sql, params).fetchall()
        deals = [row_to_dict(r) for r in rows]
        return {
            "deals": deals,
            "count": len(deals),
            "total": total,
            "pagination": pagination_meta(total, limit, offset),
            "filters": {
                "neighborhood": neighborhood, "day": day, "deal_type": deal_type,
                "cuisine": cuisine, "query": query, "active_now": active_now,
                "chain_filter": chain_filter, "gluten_free": gluten_free,
            },
        }


@app.get("/api/v1/deals/nearby")
@limiter.limit(RATE_SEARCH)
async def deals_nearby(
    request: Request,
    response: Response,
    address: Optional[str] = Query(None, description="Address or place name to geocode"),
    lat: Optional[float] = Query(None, description="Latitude"),
    lng: Optional[float] = Query(None, description="Longitude"),
    radius_miles: float = Query(1.5, ge=0.1, le=25.0, description="Search radius in miles"),
    active_now: bool = Query(False),
    gluten_free: Optional[bool] = Query(None, description="Filter to gluten-free deals only"),
    has_patio: Optional[bool] = Query(None, description="Filter to venues with patio/outdoor seating"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
):
    """Find deals near a location. Provide lat/lng or address (geocoding requires Google Maps MCP)."""
    cache(response, max_age=300, stale_while_revalidate=60)  # 5 min
    if lat is None or lng is None:
        if not address:
            raise HTTPException(400, "Provide lat/lng or address")
        # For MVP, return error — geocoding requires Google Maps MCP or API call
        raise HTTPException(
            400,
            "Address geocoding not yet implemented. Use lat/lng directly, or "
            "geocode via Google Maps MCP first: maps_geocode(address='...')"
        )

    with db_connection() as conn:
        # Bounding box pre-filter for performance
        lat_delta = radius_miles / 69.0
        lng_delta = radius_miles / (69.0 * math.cos(math.radians(lat)))

        sql_nearby = """
            SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
                   v.latitude, v.longitude, v.address,
                   n.name AS neighborhood
            FROM deals d
            JOIN venues v ON d.venue_id = v.id
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE d.is_active = 1 AND v.is_active = 1
              AND v.latitude BETWEEN ? AND ?
              AND v.longitude BETWEEN ? AND ?
        """
        nearby_params: list = [lat - lat_delta, lat + lat_delta, lng - lng_delta, lng + lng_delta]

        if gluten_free:
            sql_nearby += " AND d.is_gluten_free = 1"

        if has_patio:
            sql_nearby += " AND v.has_patio = 1"

        sql_nearby += " ORDER BY d.quality_score DESC NULLS LAST"

        rows = conn.execute(sql_nearby, nearby_params).fetchall()

        deals = []
        for r in rows:
            d = row_to_dict(r)
            dist = haversine_miles(lat, lng, d["latitude"], d["longitude"])
            if dist <= radius_miles:
                d["distance_miles"] = round(dist, 2)
                deals.append(d)

        deals.sort(key=lambda x: x["distance_miles"])
        return {
            "deals": deals[:limit],
            "count": len(deals[:limit]),
            "center": {"lat": lat, "lng": lng},
            "radius_miles": radius_miles,
        }


@app.get("/api/v1/deals/deal-of-the-day")
@limiter.limit(RATE_SEARCH)
async def deal_of_the_day(request: Request, response: Response):
    """Get today's featured deal — highest quality score deal active today."""
    cache(response, max_age=1800, stale_while_revalidate=300)  # 30 min
    today = get_today_day()
    with db_connection() as conn:
        row = conn.execute("""
            SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
                   v.latitude, v.longitude, v.address, v.cuisine_type,
                   n.name AS neighborhood
            FROM deals d
            JOIN venues v ON d.venue_id = v.id
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE d.is_active = 1 AND v.is_active = 1
              AND (d.days_available LIKE ? OR d.days_available IS NULL OR d.days_available = '[]' OR d.days_available = '')
            ORDER BY d.quality_score DESC, d.best_savings_pct DESC NULLS LAST
            LIMIT 1
        """, [f'%"{today}"%']).fetchone()

        if not row:
            return {"deal": None, "message": "No featured deal for today"}
        return {"deal": row_to_dict(row), "day": today}


@app.get("/api/v1/deals/chains")
@limiter.limit(RATE_SEARCH)
async def chain_deals(
    request: Request,
    response: Response,
    brand: Optional[str] = Query(None, description="Chain brand slug filter"),
    app_only: bool = Query(False, description="Only app-exclusive deals"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
):
    """Get national chain deals available in Chicago."""
    cache(response, max_age=3600, stale_while_revalidate=600)  # 1 hour
    sql = """
        SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
               v.latitude, v.longitude, v.address,
               cb.name AS chain_name, cb.slug AS chain_slug,
               cb.app_url_ios, cb.app_url_android
        FROM deals d
        JOIN venues v ON d.venue_id = v.id
        LEFT JOIN chain_brands cb ON v.chain_brand_id = cb.id
        WHERE d.is_active = 1 AND v.is_chain = 1
    """
    params = []

    if brand:
        sql += " AND cb.slug = ?"
        params.append(brand.lower())

    if app_only:
        sql += " AND d.deal_type = 'chain_app_deal'"

    sql += " ORDER BY cb.name, d.quality_score DESC LIMIT ?"
    params.append(min(limit, MAX_LIMIT))

    with db_connection() as conn:
        rows = conn.execute(sql, params).fetchall()
        return {
            "deals": [row_to_dict(r) for r in rows],
            "count": len(rows),
        }


@app.get("/api/v1/deals/plan-crawl")
@limiter.limit(RATE_SEARCH)
async def plan_crawl(
    request: Request,
    response: Response,
    neighborhood: str = Query(..., description="Starting neighborhood"),
    budget: Optional[str] = Query(None, description="Budget level: $, $$, $$$, $$$$"),
    hours: float = Query(3.0, ge=1.0, le=8.0, description="Hours available"),
    group_size: int = Query(2, ge=1, le=20),
    preferences: Optional[str] = Query(None, description="Comma-separated: cocktails, oysters, tacos"),
    gluten_free: Optional[bool] = Query(None, description="Filter to gluten-free deals only"),
):
    """Plan a multi-stop deal crawl through a neighborhood."""
    cache(response, max_age=300, stale_while_revalidate=60)  # 5 min
    # Budget maps to max per-item deal price AND venue price_level
    BUDGET_PRICE_CAPS = {"$": 10, "$$": 20, "$$$": 40, "$$$$": 999}
    BUDGET_TO_PRICE_LEVEL = {"$": 1, "$$": 2, "$$$": 3, "$$$$": 4}

    sql, params, _, _ = build_deal_query(
        neighborhood=neighborhood, day="today", gluten_free=gluten_free, limit=20,
    )
    with db_connection() as conn:
        rows = conn.execute(sql, params).fetchall()
        deals = [row_to_dict(r) for r in rows]

    if not deals:
        return {
            "crawl": [],
            "message": f"No active deals found in {neighborhood} for today",
        }

    # Filter by budget using deal prices where available, venue price_level as fallback
    if budget and budget in BUDGET_PRICE_CAPS:
        max_item_price = BUDGET_PRICE_CAPS[budget]
        max_price_level = BUDGET_TO_PRICE_LEVEL[budget]
        filtered = []
        for d in deals:
            # Check deal-level prices first
            items = (d.get("food_items") or []) + (d.get("drink_items") or [])
            prices = [i.get("deal_price") for i in items if isinstance(i, dict) and i.get("deal_price")]
            if prices:
                # Deal has price data — use the average item price
                if sum(prices) / len(prices) <= max_item_price:
                    filtered.append(d)
            elif d.get("price_level") is not None:
                # Fall back to venue price_level from Google Places
                if d["price_level"] <= max_price_level:
                    filtered.append(d)
            else:
                # No price info at all — include for $ and $$, exclude for $$$ and $$$$
                # (assume unknown = budget-friendly)
                if max_price_level >= 2:
                    filtered.append(d)
        deals = filtered

    # Filter by preferences
    if preferences:
        pref_list = [p.strip().lower() for p in preferences.split(",")]
        scored = []
        for d in deals:
            text = f"{d.get('title', '')} {d.get('description', '')} {d.get('best_deal_item', '')}".lower()
            score = sum(1 for p in pref_list if p in text)
            scored.append((score, d))
        scored.sort(key=lambda x: -x[0])
        deals = [d for _, d in scored]

    # Estimate stops based on hours (45 min per stop)
    max_stops = min(int(hours / 0.75), len(deals))
    crawl = deals[:max_stops]

    # Calculate estimated savings
    total_savings = sum(
        (d.get("estimated_savings_per_person") or 0) * group_size
        for d in crawl
    )

    return {
        "crawl": crawl,
        "stops": len(crawl),
        "neighborhood": neighborhood,
        "estimated_savings": round(total_savings, 2),
        "group_size": group_size,
        "hours": hours,
    }


@app.get("/api/v1/deals/world-cup")
@limiter.limit(RATE_SEARCH)
async def world_cup_deals(
    request: Request,
    response: Response,
    radius_miles: float = Query(2.0, ge=0.5, le=10.0, description="Search radius from Soldier Field in miles"),
    day: Optional[str] = Query(None, description="Day of week or 'today'"),
    deal_type: Optional[str] = Query(None, description="Deal type filter"),
    active_now: bool = Query(False, description="Only show currently active deals"),
    limit: int = Query(50, ge=1, le=MAX_LIMIT),
):
    """Find deals near Soldier Field for FIFA World Cup 2026.

    Chicago hosts World Cup matches at Soldier Field (June 11 - July 19, 2026).
    This endpoint returns deals sorted by distance from the stadium, with venue
    coordinates and distance included for map display.
    """
    cache(response, max_age=300, stale_while_revalidate=60)  # 5 min
    # Soldier Field coordinates
    SOLDIER_FIELD_LAT = 41.8623
    SOLDIER_FIELD_LNG = -87.6167

    if day and day.lower() == "today":
        day = get_today_day()

    with db_connection() as conn:
        lat_delta = radius_miles / 69.0
        lng_delta = radius_miles / (69.0 * math.cos(math.radians(SOLDIER_FIELD_LAT)))

        sql = """
            SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
                   v.latitude, v.longitude, v.address, v.cuisine_type,
                   v.price_level, v.google_rating,
                   n.name AS neighborhood, n.slug AS neighborhood_slug
            FROM deals d
            JOIN venues v ON d.venue_id = v.id
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE d.is_active = 1 AND v.is_active = 1
              AND v.latitude BETWEEN ? AND ?
              AND v.longitude BETWEEN ? AND ?
        """
        params: list = [
            SOLDIER_FIELD_LAT - lat_delta, SOLDIER_FIELD_LAT + lat_delta,
            SOLDIER_FIELD_LNG - lng_delta, SOLDIER_FIELD_LNG + lng_delta,
        ]

        if day:
            sql += " AND (d.days_available LIKE ? OR d.days_available IS NULL OR d.days_available = '[]' OR d.days_available = '')"
            params.append(f'%"{day.lower()}"%')

        if deal_type:
            sql += " AND d.deal_type = ?"
            params.append(deal_type.lower())

        if active_now:
            current_time = get_current_time()
            today = get_today_day()
            sql += """ AND (d.is_all_day = 1 OR (
                d.start_time <= ? AND d.end_time >= ?
                AND (d.days_available LIKE ? OR d.days_available IS NULL OR d.days_available = '[]' OR d.days_available = '')
            ))"""
            params.extend([current_time, current_time, f'%"{today}"%'])

        sql += " ORDER BY d.quality_score DESC NULLS LAST"

        rows = conn.execute(sql, params).fetchall()

        deals = []
        for r in rows:
            d = row_to_dict(r)
            dist = haversine_miles(SOLDIER_FIELD_LAT, SOLDIER_FIELD_LNG, d["latitude"], d["longitude"])
            if dist <= radius_miles:
                d["distance_miles"] = round(dist, 2)
                deals.append(d)

        deals.sort(key=lambda x: x["distance_miles"])
        deals = deals[:limit]

        # Count unique venues
        venue_ids = set(d["venue_id"] for d in deals)

        return {
            "deals": deals,
            "count": len(deals),
            "unique_venues": len(venue_ids),
            "center": {
                "name": "Soldier Field",
                "lat": SOLDIER_FIELD_LAT,
                "lng": SOLDIER_FIELD_LNG,
            },
            "radius_miles": radius_miles,
            "event": {
                "name": "FIFA World Cup 2026",
                "dates": "June 11 - July 19, 2026",
                "venue": "Soldier Field, Chicago",
            },
        }


@app.get("/api/v1/search/suggest")
@limiter.limit(RATE_SUGGEST)
async def search_suggest(
    request: Request,
    response: Response,
    q: str = Query(..., min_length=1, max_length=100, description="Search query prefix"),
    limit: int = Query(5, ge=1, le=10),
):
    """Autocomplete suggestions for search — returns matching neighborhoods, venues, and popular terms."""
    cache(response, max_age=300, stale_while_revalidate=60)  # 5 min
    pattern = f"%{q.lower()}%"
    with db_connection() as conn:
        # Matching neighborhoods
        nh_rows = conn.execute("""
            SELECT n.name, n.slug,
                   (SELECT COUNT(*) FROM deals d JOIN venues v ON d.venue_id = v.id
                    WHERE v.neighborhood_id = n.id AND d.is_active = 1) AS deal_count
            FROM neighborhoods n
            WHERE LOWER(n.name) LIKE ?
            ORDER BY deal_count DESC
            LIMIT ?
        """, [pattern, limit]).fetchall()

        # Matching venues (with deals)
        v_rows = conn.execute("""
            SELECT v.name, v.slug, n.name AS neighborhood,
                   (SELECT COUNT(*) FROM deals d WHERE d.venue_id = v.id AND d.is_active = 1) AS deal_count
            FROM venues v
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE LOWER(v.name) LIKE ? AND v.is_active = 1
            ORDER BY deal_count DESC, v.google_rating DESC NULLS LAST
            LIMIT ?
        """, [pattern, limit]).fetchall()

        # Popular search terms that match
        POPULAR_TERMS = [
            "wings", "tacos", "margaritas", "rooftop", "oysters",
            "brunch", "late night", "pizza", "sushi", "burgers",
            "wine wednesday", "taco tuesday", "half off",
            "craft beer", "cocktails", "appetizers",
            "gluten free", "gluten free pizza", "gluten free chinese",
            "gluten free mexican", "gluten free italian", "gluten free brunch",
            "gluten free bakery", "gluten free pasta", "gluten free sushi",
            "vegan", "vegetarian", "dairy free",
            "mexican", "italian", "japanese", "chinese", "thai",
            "indian", "korean", "mediterranean", "seafood", "bbq",
            "steakhouse", "ramen", "pho", "dim sum",
        ]
        matching_terms = [t for t in POPULAR_TERMS if q.lower() in t][:limit]

        # Cuisine type suggestions — find matching cuisine types from venues
        cuisine_rows = conn.execute("""
            SELECT DISTINCT v.cuisine_type
            FROM venues v
            WHERE v.is_active = 1 AND v.cuisine_type IS NOT NULL
              AND LOWER(v.cuisine_type) LIKE ?
            LIMIT 20
        """, [pattern]).fetchall()

        # Extract individual cuisine tags that match the query
        cuisine_tags = set()
        for row in cuisine_rows:
            if row["cuisine_type"]:
                for tag in row["cuisine_type"].split(","):
                    tag = tag.strip()
                    if tag and q.lower() in tag.lower():
                        cuisine_tags.add(tag)
        cuisine_list = sorted(cuisine_tags)[:limit]

        return {
            "neighborhoods": [{"name": r["name"], "slug": r["slug"], "deal_count": r["deal_count"]} for r in nh_rows],
            "venues": [{"name": r["name"], "slug": r["slug"], "neighborhood": r["neighborhood"], "deal_count": r["deal_count"]} for r in v_rows],
            "cuisines": cuisine_list,
            "terms": matching_terms,
        }


@app.get("/api/v1/venues/search")
@limiter.limit(RATE_SEARCH)
async def search_venues(
    request: Request,
    response: Response,
    name: Optional[str] = Query(None, description="Venue name search"),
    neighborhood: Optional[str] = Query(None),
    cuisine: Optional[str] = Query(None),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    fields: Optional[str] = Query(None, description="Comma-separated fields to return (e.g. 'slug' for sitemap)"),
    has_deals: Optional[bool] = Query(None, description="Filter to venues with active deals (for sitemap)"),
):
    """Search venues with their deals."""
    cache(response, max_age=300, stale_while_revalidate=60)  # 5 min

    # Lightweight mode: return only requested fields (for sitemap generation)
    slugs_only = fields and fields.strip() == "slug"

    if slugs_only:
        sql = "SELECT v.slug FROM venues v WHERE v.is_active = 1"
        if has_deals:
            sql += " AND EXISTS (SELECT 1 FROM deals d WHERE d.venue_id = v.id AND d.is_active = 1)"
    else:
        sql = """
            SELECT v.*, n.name AS neighborhood, n.slug AS neighborhood_slug,
                   (SELECT COUNT(*) FROM deals d WHERE d.venue_id = v.id AND d.is_active = 1) AS active_deal_count
            FROM venues v
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE v.is_active = 1
        """
        if has_deals:
            sql += " AND EXISTS (SELECT 1 FROM deals d WHERE d.venue_id = v.id AND d.is_active = 1)"
    params = []

    if name:
        if not slugs_only:
            sql += " AND LOWER(v.name) LIKE ?"
        else:
            sql += " AND LOWER(v.name) LIKE ?"
        params.append(f"%{name.lower()}%")
    if neighborhood:
        if slugs_only:
            sql += " AND v.neighborhood_id IN (SELECT id FROM neighborhoods WHERE LOWER(name) LIKE ? OR LOWER(slug) LIKE ?)"
        else:
            sql += " AND (LOWER(n.name) LIKE ? OR LOWER(n.slug) LIKE ?)"
        pattern = f"%{neighborhood.lower()}%"
        params.extend([pattern, pattern])
    if cuisine:
        sql += " AND LOWER(v.cuisine_type) LIKE ?"
        params.append(f"%{cuisine.lower()}%")

    sql += " ORDER BY v.slug LIMIT ? OFFSET ?" if slugs_only else " ORDER BY v.google_rating DESC NULLS LAST LIMIT ? OFFSET ?"
    params.extend([min(limit, MAX_LIMIT), offset])

    with db_connection() as conn:
        # Build a count query (strip ORDER/LIMIT/OFFSET for total)
        count_sql = sql.split(" ORDER BY")[0]
        count_sql = f"SELECT COUNT(*) AS total FROM ({count_sql})"
        count_params = params[:-2]  # exclude limit/offset
        total_count = conn.execute(count_sql, count_params).fetchone()["total"]

        rows = conn.execute(sql, params).fetchall()

        if slugs_only:
            venues = [{"slug": r["slug"]} for r in rows]
            return {"venues": venues, "count": len(venues), "total_count": total_count}

        venues = [row_to_dict(r) for r in rows]

        # Attach deals to each venue
        for venue in venues:
            deal_rows = conn.execute("""
                SELECT * FROM deals WHERE venue_id = ? AND is_active = 1
                ORDER BY quality_score DESC
            """, [venue["id"]]).fetchall()
            venue["deals"] = [row_to_dict(dr) for dr in deal_rows]

        return {"venues": venues, "count": len(venues), "total_count": total_count}


# ── College bars / team affiliations ──────────────────────────

@app.get("/api/v1/venues/college-bars")
@limiter.limit("30/minute")
async def get_college_bars(
    request: Request,
    response: Response,
    team: Optional[str] = Query(None, description="Filter by team name (partial match)"),
    neighborhood: Optional[str] = Query(None, description="Filter by neighborhood slug"),
    include_deals: bool = Query(True, description="Include active deals for each venue"),
    sport: Optional[str] = Query(None, pattern="^(football|basketball)$",
                                 description="Rank each venue's deals by relevance to this sport"),
):
    """Returns venues with college team affiliations, optionally filtered by team or neighborhood."""
    cache(response, max_age=3600, stale_while_revalidate=300)

    with db_connection() as conn:
        sql = """
            SELECT v.id, v.name, v.slug, v.address, v.latitude, v.longitude,
                   v.cuisine_type, v.vibe_tags, v.google_rating, v.google_review_count,
                   v.phone, v.website_url, v.photo_url, v.sports_affiliations,
                   v.is_sports_bar, v.price_level,
                   n.name AS neighborhood, n.slug AS neighborhood_slug
            FROM venues v
            JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE v.is_active = 1
              AND v.sports_affiliations IS NOT NULL
              AND v.sports_affiliations != '[]'
              AND v.sports_affiliations != ''
        """
        params: list = []

        if team:
            sql += " AND v.sports_affiliations LIKE ?"
            params.append(f"%{team}%")

        if neighborhood:
            sql += " AND n.slug = ?"
            params.append(neighborhood)

        sql += " ORDER BY n.name, v.name"

        rows = conn.execute(sql, params).fetchall()

        venues = []
        for row in rows:
            venue = dict(row)
            try:
                venue["sports_affiliations"] = json.loads(venue["sports_affiliations"])
            except (json.JSONDecodeError, TypeError):
                venue["sports_affiliations"] = []

            if include_deals:
                deal_rows = conn.execute(f"""
                    SELECT d.id, d.title, d.description, d.deal_type,
                           d.days_available, d.start_time, d.end_time, d.is_all_day,
                           d.affiliated_team, d.affiliated_league,
                           d.quality_score, d.is_verified
                    FROM deals d
                    WHERE d.venue_id = ? AND d.is_active = 1
                    AND (d.deal_type IN ('game_day', 'seasonal_lto', 'happy_hour', 'daily_special')
                         OR d.affiliated_team IS NOT NULL)
                    ORDER BY {_college_bar_deal_order(sport)}
                    LIMIT 10
                """, [venue["id"]]).fetchall()
                venue["deals"] = [row_to_dict(dict(r)) for r in deal_rows]
            else:
                venue["deals"] = []

            venues.append(venue)

        team_map: dict = {}
        for v in venues:
            for aff in v["sports_affiliations"]:
                t = aff.get("team", "Unknown")
                if t not in team_map:
                    team_map[t] = {"team": t, "league": aff.get("league", "NCAA"),
                                   "sport": aff.get("sport", ""), "venue_count": 0}
                team_map[t]["venue_count"] += 1

        return {
            "venues": venues,
            "count": len(venues),
            "teams": sorted(team_map.values(), key=lambda x: (-x["venue_count"], x["team"])),
            "team_count": len(team_map),
        }


@app.get("/api/v1/venues/world-cup")
@limiter.limit("60/minute")
async def get_world_cup_venues(
    request: Request,
    response: Response,
    neighborhood: Optional[str] = Query(None, description="Filter by neighborhood slug"),
):
    """Venues tagged world_cup_2026 (showing 2026 World Cup matches), grouped by
    neighborhood. Sourced from the WatchPartyRadar roster + Crain's reporting.
    has_wc_deal flags venues running an actual match-day special."""
    cache(response, max_age=3600, stale_while_revalidate=300)

    # True World Cup signal: WC/FIFA/national-team, or a generic soccer "watch
    # party". Excludes other-sport/show "watch parties" (Love Island, NHL, UFC,
    # rugby, Cubs...) so ⚽ and the surfaced deal stay accurate. `t` = a SQL text
    # expression (title [+ description]) to test.
    def wc_sql(t: str) -> str:
        L = f"LOWER({t})"
        incl = (
            f"({L} LIKE '%world cup%' OR {L} LIKE '%fifa%' OR {L} LIKE '%el tri%' "
            f"OR {L} LIKE '%usmnt%' OR {L} LIKE '%knockout%' "
            f"OR ({L} LIKE '%watch part%' AND ({L} LIKE '%soccer%' OR {L} LIKE '%futbol%' "
            f"OR {L} LIKE '%fútbol%' OR {L} LIKE '% vs %' OR {L} LIKE '% vs. %')))"
        )
        # Exclude other sports/shows AND club soccer / non-WC tournaments so a
        # "X vs Y watch party" for a club game (or Club World Cup / Stanley Cup)
        # never reads as the 2026 national-team World Cup.
        bad = [
            "love island", "nhl", "nba", "ufc", "mma", "rugby", "cubs", "white sox",
            "blackhawks", "bulls", "bears", "nfl", "mlb", "masters", "nascar",
            "stanley cup", "club world cup", "big ten", "ncaa", "six nations",
            "premier league", "champions league", "europa league", "la liga",
            "serie a", "bundesliga", "arsenal", "chelsea", "liverpool", "manchester",
            "tottenham", "real madrid", "barcelona", "bayern", "juventus", "psg",
        ]
        excl = " ".join(f"AND {L} NOT LIKE '%{b}%'" for b in bad)
        return f"({incl} {excl})"

    with db_connection() as conn:
        wc_exists = wc_sql("d.title || ' ' || COALESCE(d.description, '')")
        sql = f"""
            SELECT v.id, v.name, v.slug, v.address, v.google_rating,
                   v.google_review_count, v.is_sports_bar, v.cuisine_type,
                   n.name AS neighborhood, n.slug AS neighborhood_slug, n.zone,
                   EXISTS(
                       SELECT 1 FROM deals d
                       WHERE d.venue_id = v.id AND d.is_active = 1 AND {wc_exists}
                   ) AS has_wc_deal
            FROM venues v
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE v.is_active = 1
              AND (',' || COALESCE(v.tags, '') || ',') LIKE '%,world_cup_2026,%'
        """
        params: list = []
        if neighborhood:
            sql += " AND n.slug = ?"
            params.append(neighborhood)
        sql += " ORDER BY (v.google_rating IS NULL), v.google_rating DESC, v.name"
        rows = [dict(r) for r in conn.execute(sql, params).fetchall()]

        # Attach each venue's top deal (prefer a World Cup deal, then one with a
        # price, then highest quality) so the guide can show deals + prices inline.
        def _lowest_price(deal: dict):
            low = None
            for key in ("drink_items", "food_items"):
                items = deal.get(key) or []
                if isinstance(items, list):
                    for it in items:
                        p = it.get("deal_price") if isinstance(it, dict) else None
                        if isinstance(p, (int, float)) and p > 0 and (low is None or p < low):
                            low = p
            return low

        ids = [v["id"] for v in rows]
        deals_by_v: dict = {}
        if ids:
            qmarks = ",".join("?" * len(ids))
            wc_case = wc_sql("title || ' ' || COALESCE(description, '')")
            drows = conn.execute(f"""
                SELECT venue_id, title, description, deal_type, days_available,
                       start_time, end_time, is_all_day, food_items, drink_items,
                       best_deal_item, quality_score,
                       (CASE WHEN {wc_case} THEN 1 ELSE 0 END) AS is_wc
                FROM deals
                WHERE is_active = 1 AND venue_id IN ({qmarks})
                ORDER BY venue_id, is_wc DESC, quality_score DESC
            """, ids).fetchall()
            for r in drows:
                deals_by_v.setdefault(r["venue_id"], []).append(row_to_dict(r))

        # A World Cup deal always wins (even price-less) so ⚽ venues never show a
        # stale non-WC deal. For non-WC venues, recurring deal types rank above
        # one-off/seasonal events so a June roster doesn't surface "Halloween Party".
        recur_rank = {"happy_hour": 0, "daily_special": 1, "game_day": 2,
                      "brunch_deal": 3, "brunch": 3, "lunch_special": 3}

        def _pick_priced(group):
            return next((d for d in group if _lowest_price(d) is not None),
                        group[0] if group else None)

        for v in rows:
            dl = deals_by_v.get(v["id"], [])
            v["deal_count"] = len(dl)
            wc = [d for d in dl if d.get("is_wc")]
            non = sorted(
                [d for d in dl if not d.get("is_wc")],
                key=lambda d: (recur_rank.get(d.get("deal_type"), 4),
                               0 if _lowest_price(d) is not None else 1,
                               -(d.get("quality_score") or 0)),
            )
            top = _pick_priced(wc) or (non[0] if non else None)
            if top:
                v["top_deal"] = {
                    "title": top["title"],
                    "deal_type": top.get("deal_type"),
                    "days_available": top.get("days_available"),
                    "start_time": top.get("start_time"),
                    "end_time": top.get("end_time"),
                    "price": _lowest_price(top),
                    "is_wc": bool(top.get("is_wc")),
                }
            else:
                v["top_deal"] = None

        groups: dict = {}
        for v in rows:
            key = v.get("neighborhood_slug") or "_other"
            g = groups.setdefault(key, {
                "name": v.get("neighborhood") or "Other / Suburbs",
                "slug": v.get("neighborhood_slug"),
                "zone": v.get("zone"),
                "venues": [],
            })
            g["venues"].append(v)
        neighborhoods = sorted(
            groups.values(),
            key=lambda g: (g["slug"] is None, -len(g["venues"]), g["name"]),
        )
        return {
            "venues": rows,
            "count": len(rows),
            "neighborhoods": neighborhoods,
            "neighborhood_count": len(neighborhoods),
            "deal_count": sum(1 for v in rows if v["has_wc_deal"]),
        }


# ── Generic tagged-venue rosters ─────────────────────────────
# One endpoint serves every event roster driven by a venues.tags value
# (the pattern world_cup_2026 proved). Adding a fall event = one registry
# entry here + tagging venues; no new route, no frontend API change.

def _normalized_sql(t: str) -> str:
    """Lowercase text with punctuation flattened to spaces and space-padded.

    Lets short tokens be matched on word boundaries. Without this, LIKE '%nfl%'
    matches "California-iNFLuenced" and a brunch restaurant reads as a Bears bar.
    """
    expr = f"LOWER({t})"
    for ch in (".", ",", "!", "?", ";", ":", "(", ")", "/", "-", "–", '"', "'", "\n", "\t"):
        lit = ch.replace("'", "''")  # SQL literal escaping for the apostrophe
        expr = f"REPLACE({expr}, '{lit}', ' ')"
    return f"(' ' || {expr} || ' ')"


def _sql_matcher(t: str, include: list, exclude: list) -> str:
    """Build a deal-text relevance test: any include phrase, none of the excludes.

    Tokens shorter than 5 chars are matched as whole words; longer phrases are
    matched as substrings (they are specific enough not to collide).
    """
    N = _normalized_sql(t)

    def test(p: str) -> str:
        return f"{N} LIKE '% {p} %'" if len(p) < 5 else f"{N} LIKE '%{p}%'"

    incl = " OR ".join(test(p) for p in include)
    excl = " ".join(
        f"AND {N} NOT LIKE '% {b} %'" if len(b) < 5 else f"AND {N} NOT LIKE '%{b}%'"
        for b in exclude
    )
    return f"(({incl}) {excl})"


def _bears_deal_sql(t: str) -> str:
    # NFL/Bears game-day signal; excludes other sports, other Chicago teams,
    # and soccer/college football so "Cubs game day" or "college football
    # Saturdays" never reads as a Bears special.
    return _sql_matcher(
        t,
        include=["bears", "nfl", "football", "game day", "gameday", "tailgate", "touchdown"],
        exclude=["soccer", "futbol", "fútbol", "world cup", "fifa", "premier league",
                 "champions league", "liga mx", "usmnt", "el tri", "rugby", "ncaa",
                 "college", "big ten", "high school", "cubs", "white sox", "blackhawks",
                 "bulls", "chicago sky", "chicago fire", "basketball", "hockey", "baseball"],
    )


def _soccer_deal_sql(t: str) -> str:
    # Evergreen soccer (club + national team), the broadened successor to the
    # tournament-only wc_sql above.
    return _sql_matcher(
        t,
        include=["world cup", "fifa", "el tri", "usmnt", "soccer", "futbol", "fútbol",
                 "premier league", "champions league", "liga mx", "mls", "chicago fire"],
        exclude=["nfl", "bears", "packers", "ncaa", "college", "nba", "bulls", "nhl",
                 "blackhawks", "mlb", "cubs", "white sox", "ufc", "mma", "boxing",
                 "rugby", "nascar", "love island"],
    )


def _ncaaf_deal_sql(t: str) -> str:
    # College football. Every include here is PHRASE-scoped rather than a bare
    # team word, because the bare words are all taken in this corpus:
    #   "boilermakers" -> 19 hits, every one the DRINK (shot dropped in a beer)
    #   "northwestern" -> 23 hits, mostly "northwestern suburbs" (geography)
    #   "notre dame"   ->  5 hits, street and venue names
    # So Purdue is matched on "purdue", Northwestern on "northwestern wildcats",
    # and Notre Dame on "notre dame football"/"fighting irish". Do not shorten
    # these back to the plain nickname — see tests/unit/test_ncaaf_matcher.py.
    #
    # "big ten tournament" is excluded because it is always the basketball
    # tournament; football has bowls and a playoff, never a "tournament".
    return _sql_matcher(
        t,
        include=[
            "college football", "ncaa football", "ncaaf", "big ten",
            "college gameday", "college game day", "saturday football", "bowl game",
            # unambiguous nicknames
            "fighting irish", "fighting illini", "hawkeyes", "wolverines", "buckeyes",
            "badgers", "cornhuskers", "nittany lions", "spartans", "purdue",
            "northwestern wildcats",
            # school + football, for deals that name the program not the mascot
            "notre dame football", "northwestern football", "michigan football",
            "illinois football", "iowa football", "wisconsin football",
            "ohio state football", "purdue football",
        ],
        exclude=["bears", "nfl", "cubs", "white sox", "blackhawks", "bulls",
                 "chicago sky", "chicago fire", "soccer", "futbol", "fútbol",
                 "world cup", "fifa", "premier league", "champions league", "liga mx",
                 "march madness", "big ten tournament", "basketball", "hockey",
                 "baseball", "high school",
                 # "Michigan Wolverines vs UConn Huskies National Championship" is
                 # the basketball final and never says "basketball" in its text, so
                 # the nickname include admits it. UConn has no football program of
                 # note; excluding it is the narrowest correct fix.
                 "uconn", "final four"],
    )


_BBALL_INCLUDE = [
    "march madness", "college basketball", "ncaa tournament", "final four",
    "sweet sixteen", "elite eight", "selection sunday", "big ten tournament",
]

_MONTHS = ["january", "february", "march", "april", "may", "june",
           "july", "august", "september", "october", "november", "december"]


def _stale_month_sql(t: str) -> str:
    """True for a limited-time deal whose title names a month that has passed.

    `season_end` is set on 3 of 2,887 active seasonal deals, so the corpus has
    no usable expiry date — a "May Sandwich of the Month" and a crawfish boil
    dated last July both still render in September. Matching the month NAME in
    the title is the only signal that actually exists. Current and next month
    are kept so a legitimately-running promo is never buried.

    This DERANKS, never filters: a venue whose only deal is a stale LTO still
    shows it rather than showing nothing.
    """
    now = datetime.now()
    keep = {_MONTHS[now.month - 1], _MONTHS[now.month % 12]}
    stale = [m for m in _MONTHS if m not in keep]
    # WHOLE WORD, always — not the length rule _sql_matcher uses. "march" is 5
    # chars, so that rule would match it as a substring and "Marching Band
    # Night" would read as a stale March promo. Same shape as LIKE '%nfl%'
    # matching "California-iNFLuenced".
    N = _normalized_sql(t)
    hits = " OR ".join(f"{N} LIKE '% {m} %'" for m in stale)
    return f"(d.deal_type IN ('seasonal_lto', 'event_driven') AND ({hits}))"


def _college_bar_deal_order(sport: Optional[str]) -> str:
    """ORDER BY for a college bar's deal list.

    Was `ORDER BY d.deal_type, d.title` — alphabetical on both columns, which
    is why every alumni card on the football guide read "(Daily Special)" and
    led with things like "Chalk Art Challenge": `daily_special` sorts first,
    then A-Z picks whatever the alphabet hands back. Nothing about the ordering
    knew what sport the reader came for.
    """
    text = "d.title || ' ' || COALESCE(d.description, '')"
    clauses = []
    if sport == "football":
        clauses.append(f"(CASE WHEN {_ncaaf_deal_sql(text)} THEN 0 ELSE 1 END)")
    elif sport == "basketball":
        clauses.append(f"(CASE WHEN {_sql_matcher(text, _BBALL_INCLUDE, [])} THEN 0 ELSE 1 END)")
    clauses.append(f"(CASE WHEN {_stale_month_sql(text)} THEN 1 ELSE 0 END)")
    # Recurring offers beat one-off events: a weekly happy hour is true next
    # Saturday, a single crawfish boil is not.
    clauses.append("(CASE WHEN d.deal_type IN ('happy_hour', 'daily_special', 'game_day')"
                   " THEN 0 ELSE 1 END)")
    clauses.append("COALESCE(d.quality_score, 0) DESC")
    clauses.append("d.title")
    return ", ".join(clauses)


TAGGED_ROSTERS: dict = {
    "bears_2026": {"deal_sql": _bears_deal_sql},
    "world_cup_2026": {"deal_sql": _soccer_deal_sql},
    "ncaaf_2026": {"deal_sql": _ncaaf_deal_sql},
}


@app.get("/api/v1/venues/tagged/{tag}")
@limiter.limit("60/minute")
async def get_tagged_venues(
    tag: str,
    request: Request,
    response: Response,
    neighborhood: Optional[str] = Query(None, description="Filter by neighborhood slug"),
    day: Optional[str] = Query(None, pattern="^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$",
                               description="Only attach deals valid on this weekday, and drop venues left with none"),
):
    """Venues carrying an allowlisted venues.tags value, grouped by neighborhood,
    each with its most relevant deal attached. Generic successor to /venues/world-cup."""
    roster = TAGGED_ROSTERS.get(tag)
    if roster is None:
        raise HTTPException(404, f"Unknown roster tag: {tag}")
    cache(response, max_age=3600, stale_while_revalidate=300)
    deal_sql = roster["deal_sql"]

    with db_connection() as conn:
        tag_exists = deal_sql("d.title || ' ' || COALESCE(d.description, '')")
        sql = f"""
            SELECT v.id, v.name, v.slug, v.address, v.google_rating,
                   v.google_review_count, v.is_sports_bar, v.cuisine_type,
                   n.name AS neighborhood, n.slug AS neighborhood_slug, n.zone,
                   EXISTS(
                       SELECT 1 FROM deals d
                       WHERE d.venue_id = v.id AND d.is_active = 1 AND {tag_exists}
                   ) AS has_deal
            FROM venues v
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE v.is_active = 1
              AND (',' || COALESCE(v.tags, '') || ',') LIKE '%,{tag},%'
        """
        params: list = []
        if neighborhood:
            sql += " AND n.slug = ?"
            params.append(neighborhood)
        sql += " ORDER BY (v.google_rating IS NULL), v.google_rating DESC, v.name"
        rows = [dict(r) for r in conn.execute(sql, params).fetchall()]

        def _lowest_price(deal: dict):
            low = None
            for key in ("drink_items", "food_items"):
                items = deal.get(key) or []
                if isinstance(items, list):
                    for it in items:
                        p = it.get("deal_price") if isinstance(it, dict) else None
                        if isinstance(p, (int, float)) and p > 0 and (low is None or p < low):
                            low = p
            return low

        # Strict day match: names the weekday explicitly, so undated and
        # unknown-schedule deals are excluded rather than assumed. A page that
        # prints "Saturday specials" has to mean it — the generic `?day=` filter
        # elsewhere also passes undated deals, which is what made the five
        # weekday deal pages 97.5% identical.
        day_clause = f" AND LOWER(COALESCE(days_available, '')) LIKE '%{day}%'" if day else ""

        ids = [v["id"] for v in rows]
        deals_by_v: dict = {}
        if ids:
            qmarks = ",".join("?" * len(ids))
            tag_case = deal_sql("title || ' ' || COALESCE(description, '')")
            drows = conn.execute(f"""
                SELECT venue_id, title, description, deal_type, days_available,
                       start_time, end_time, is_all_day, food_items, drink_items,
                       best_deal_item, quality_score,
                       (CASE WHEN {tag_case} THEN 1 ELSE 0 END) AS is_tagged
                FROM deals
                WHERE is_active = 1 AND venue_id IN ({qmarks}){day_clause}
                ORDER BY venue_id, is_tagged DESC, quality_score DESC
            """, ids).fetchall()
            for r in drows:
                deals_by_v.setdefault(r["venue_id"], []).append(row_to_dict(r))

        # Tag-relevant deal wins; otherwise recurring types beat one-off events
        # (same ranking rationale as the world-cup roster above).
        recur_rank = {"happy_hour": 0, "daily_special": 1, "game_day": 2,
                      "brunch_deal": 3, "brunch": 3, "lunch_special": 3}

        def _pick_priced(group):
            return next((d for d in group if _lowest_price(d) is not None),
                        group[0] if group else None)

        for v in rows:
            dl = deals_by_v.get(v["id"], [])
            v["deal_count"] = len(dl)
            tagged = [d for d in dl if d.get("is_tagged")]
            non = sorted(
                [d for d in dl if not d.get("is_tagged")],
                key=lambda d: (recur_rank.get(d.get("deal_type"), 4),
                               0 if _lowest_price(d) is not None else 1,
                               -(d.get("quality_score") or 0)),
            )
            top = _pick_priced(tagged) or (non[0] if non else None)
            if top:
                v["top_deal"] = {
                    "title": top["title"],
                    "deal_type": top.get("deal_type"),
                    "days_available": top.get("days_available"),
                    "start_time": top.get("start_time"),
                    "end_time": top.get("end_time"),
                    "price": _lowest_price(top),
                    "is_tagged": bool(top.get("is_tagged")),
                }
            else:
                v["top_deal"] = None

        # With a day filter the roster is a claim about that day, so a venue with
        # nothing running is not part of it. Without one, every tagged venue is
        # returned as before.
        if day:
            rows = [v for v in rows if v["top_deal"] is not None]

        groups: dict = {}
        for v in rows:
            key = v.get("neighborhood_slug") or "_other"
            g = groups.setdefault(key, {
                "name": v.get("neighborhood") or "Other / Suburbs",
                "slug": v.get("neighborhood_slug"),
                "zone": v.get("zone"),
                "venues": [],
            })
            g["venues"].append(v)
        neighborhoods = sorted(
            groups.values(),
            key=lambda g: (g["slug"] is None, -len(g["venues"]), g["name"]),
        )
        return {
            "tag": tag,
            "venues": rows,
            "count": len(rows),
            "neighborhoods": neighborhoods,
            "neighborhood_count": len(neighborhoods),
            "deal_count": sum(1 for v in rows if v["has_deal"]),
        }


@app.get("/api/v1/venues/{slug}")
@limiter.limit(RATE_SEARCH)
async def get_venue(slug: str, request: Request, response: Response):
    """Get a single venue with all its deals."""
    cache(response, max_age=600, stale_while_revalidate=120)  # 10 min
    with db_connection() as conn:
        venue = conn.execute("""
            SELECT v.*, n.name AS neighborhood, n.slug AS neighborhood_slug,
                   cb.name AS chain_name, cb.slug AS chain_slug,
                   cb.app_url_ios, cb.app_url_android
            FROM venues v
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            LEFT JOIN chain_brands cb ON v.chain_brand_id = cb.id
            WHERE v.slug = ?
        """, [slug]).fetchone()

        if not venue:
            raise HTTPException(404, f"Venue not found: {slug}")

        result = row_to_dict(venue)
        deal_rows = conn.execute("""
            SELECT * FROM deals WHERE venue_id = ? AND is_active = 1
            ORDER BY quality_score DESC
        """, [result["id"]]).fetchall()
        result["deals"] = [row_to_dict(dr) for dr in deal_rows]

        # Increment view count
        conn.execute("UPDATE venues SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [result["id"]])
        conn.commit()

        return result


@app.get("/api/v1/neighborhoods")
@limiter.limit(RATE_SEARCH)
async def list_neighborhoods(
    request: Request,
    response: Response,
    zone: Optional[str] = Query(None, description="Filter by zone: city, north_shore, etc."),
):
    """List all neighborhoods with deal counts."""
    cache(response, max_age=3600, stale_while_revalidate=600)  # 1 hour
    current_time = get_current_time()
    today = get_today_day()

    sql = """
        SELECT n.*,
               (SELECT COUNT(*) FROM deals d
                JOIN venues v ON d.venue_id = v.id
                WHERE v.neighborhood_id = n.id AND d.is_active = 1) AS active_deal_count,
               (SELECT COUNT(DISTINCT v2.id) FROM venues v2
                WHERE v2.neighborhood_id = n.id AND v2.is_active = 1) AS venue_count,
               COALESCE(n.image_url,
                 (SELECT v3.photo_url FROM venues v3
                  WHERE v3.neighborhood_id = n.id AND v3.is_active = 1
                    AND v3.photo_url IS NOT NULL AND v3.google_rating IS NOT NULL
                  ORDER BY v3.google_rating DESC LIMIT 1)
               ) AS top_venue_photo,
               (SELECT v4.name FROM venues v4
                WHERE v4.neighborhood_id = n.id AND v4.is_active = 1
                  AND v4.google_rating IS NOT NULL
                ORDER BY v4.google_rating DESC LIMIT 1) AS top_venue_name,
               (SELECT COUNT(*) FROM deals d2
                JOIN venues v5 ON d2.venue_id = v5.id
                WHERE v5.neighborhood_id = n.id AND d2.is_active = 1
                  AND (d2.is_all_day = 1 OR (
                    d2.start_time <= ? AND d2.end_time >= ?
                    AND (d2.days_available LIKE ? OR d2.days_available IS NULL OR d2.days_available = '[]' OR d2.days_available = '')
                  ))) AS active_now_count
        FROM neighborhoods n
    """
    params: list = [current_time, current_time, f'%"{today}"%']
    if zone:
        sql += " WHERE n.zone = ?"
        params.append(zone.lower())
    sql += " ORDER BY active_deal_count DESC, n.name"

    with db_connection() as conn:
        rows = conn.execute(sql, params).fetchall()
        return {
            "neighborhoods": [row_to_dict(r) for r in rows],
            "count": len(rows),
        }


@app.get("/api/v1/neighborhoods/summary")
@limiter.limit(RATE_SEARCH)
async def neighborhood_summary(
    request: Request,
    response: Response,
    neighborhood: Optional[str] = Query(None, description="Specific neighborhood, or all"),
    deal_type: Optional[str] = Query(None, description="Filter all counts to a single deal_type (e.g. 'happy_hour') — powers type-specific guides"),
):
    """Get deal summary stats per neighborhood — designed for AI agent consumption."""
    cache(response, max_age=3600, stale_while_revalidate=600)  # 1 hour
    # When deal_type is set, the join filter makes deal_count / venues_with_deal /
    # avg_savings_pct reflect ONLY that type, so a guide can rank neighborhoods by
    # true per-type counts instead of a sampled page. venues_with_deal = distinct
    # venues that actually have a matching deal (vs. venue_count = all active venues).
    deal_filter = " AND d.deal_type = ?" if deal_type else ""
    sql = f"""
        SELECT n.name, n.slug, n.zone, n.latitude, n.longitude,
               COUNT(DISTINCT v.id) AS venue_count,
               COUNT(DISTINCT d.venue_id) AS venues_with_deal,
               COUNT(DISTINCT d.id) AS deal_count,
               GROUP_CONCAT(DISTINCT d.deal_type) AS deal_types,
               ROUND(AVG(d.best_savings_pct), 1) AS avg_savings_pct
        FROM neighborhoods n
        LEFT JOIN venues v ON v.neighborhood_id = n.id AND v.is_active = 1
        LEFT JOIN deals d ON d.venue_id = v.id AND d.is_active = 1{deal_filter}
    """
    params = []
    if deal_type:
        params.append(deal_type)
    if neighborhood:
        sql += " WHERE LOWER(n.name) LIKE ? OR LOWER(n.slug) LIKE ?"
        pattern = f"%{neighborhood.lower()}%"
        params.extend([pattern, pattern])

    sql += " GROUP BY n.id ORDER BY deal_count DESC"

    with db_connection() as conn:
        rows = conn.execute(sql, params).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["deal_types"] = d["deal_types"].split(",") if d["deal_types"] else []
            results.append(d)
        return {"neighborhoods": results, "count": len(results)}


@app.get("/api/v1/neighborhoods/deal-types")
@limiter.limit(RATE_SEARCH)
async def neighborhood_deal_types(request: Request, response: Response):
    """Return all neighborhood × deal_type combos with 2+ active deals. Used for sitemap generation."""
    cache(response, max_age=86400, stale_while_revalidate=3600)  # 24 hours
    sql = """
        SELECT n.slug AS neighborhood_slug, d.deal_type, COUNT(*) AS deal_count
        FROM deals d
        JOIN venues v ON d.venue_id = v.id
        JOIN neighborhoods n ON v.neighborhood_id = n.id
        WHERE d.is_active = 1
        GROUP BY n.slug, d.deal_type
        HAVING deal_count >= 2
        ORDER BY deal_count DESC
    """
    with db_connection() as conn:
        rows = conn.execute(sql).fetchall()
        combos = [{"neighborhood_slug": r["neighborhood_slug"], "deal_type": r["deal_type"], "deal_count": r["deal_count"]} for r in rows]
        return {"combos": combos, "count": len(combos)}


@app.post("/api/v1/submissions")
@limiter.limit(RATE_SUBMIT)
async def submit_deal(submission: SubmissionRequest, request: Request):
    """Submit a deal tip from a user or AI agent."""
    # Store a hash, never the raw IP — same treatment subscribers and
    # deal_reports already give it. Spam/abuse triage only needs to compare
    # submissions to each other, which a stable hash does just as well.
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]

    with db_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO submissions (
                venue_name_raw, deal_description_raw, venue_address_raw,
                deal_type_raw, days_raw, times_raw,
                submitted_by_email, submitted_by_ip, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        """, [
            submission.venue_name,
            submission.deal_description,
            submission.venue_address,
            submission.deal_type,
            submission.days,
            submission.times,
            submission.submitter_email,
            ip_hash,
        ])
        conn.commit()

        # Send confirmation email if they provided an email
        if submission.submitter_email:
            from src.emails.sender import send_submission_confirmation
            send_submission_confirmation(submission.submitter_email, submission.venue_name)

        return {
            "submission_id": cursor.lastrowid,
            "status": "pending",
            "message": "Thanks! Your deal tip has been submitted for review.",
        }


class DealReportRequest(BaseModel):
    action: str = Field(..., pattern=r"^(report_outdated|confirm_active)$")
    reason: Optional[str] = Field(None, max_length=500)


@app.post("/api/v1/deals/{deal_id}/report")
@limiter.limit(RATE_REPORT)
async def report_deal(deal_id: int, body: DealReportRequest, request: Request):
    """Report a deal as outdated or confirm it's still active. No login required."""
    # Hash client IP for spam prevention — no full IP stored
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]

    with db_connection() as conn:
        # Validate deal exists
        deal = conn.execute("SELECT id FROM deals WHERE id = ?", [deal_id]).fetchone()
        if not deal:
            raise HTTPException(404, f"Deal not found: {deal_id}")

        conn.execute(
            "INSERT INTO deal_reports (deal_id, action, reason, ip_hash) VALUES (?, ?, ?, ?)",
            [deal_id, body.action, body.reason, ip_hash],
        )
        conn.commit()

        # Return current counts
        counts = conn.execute("""
            SELECT
                SUM(CASE WHEN action='report_outdated' THEN 1 ELSE 0 END) as outdated_count,
                SUM(CASE WHEN action='confirm_active' THEN 1 ELSE 0 END) as confirm_count
            FROM deal_reports
            WHERE deal_id = ? AND created_at > datetime('now','-30 days')
        """, [deal_id]).fetchone()

        return {
            "success": True,
            "deal_id": deal_id,
            "action": body.action,
            "outdated_count": counts["outdated_count"] or 0,
            "confirm_count": counts["confirm_count"] or 0,
        }


# ============================================================
# ADMIN: SUBMISSION MANAGEMENT
# ============================================================

ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
RATE_ADMIN = "30/minute"


def require_admin(x_admin_key: str = Header(...)):
    """Validate admin API key from X-Admin-Key header."""
    if not ADMIN_API_KEY or x_admin_key != ADMIN_API_KEY:
        raise HTTPException(401, "Invalid or missing admin key")


@app.get("/api/v1/admin/submissions")
@limiter.limit(RATE_ADMIN)
async def list_submissions(
    request: Request,
    status: Optional[str] = Query("pending", description="Filter: pending, approved, rejected, all"),
    limit: int = Query(50, ge=1, le=200),
    _: str = Depends(require_admin),
):
    """List deal submissions by status."""
    with db_connection() as conn:
        if status == "all":
            rows = conn.execute(
                "SELECT * FROM submissions ORDER BY created_at DESC LIMIT ?", [limit]
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC LIMIT ?",
                [status, limit],
            ).fetchall()
        return {"submissions": [dict(r) for r in rows], "count": len(rows)}


@app.post("/api/v1/admin/submissions/{submission_id}/approve")
@limiter.limit(RATE_ADMIN)
async def approve_submission(submission_id: int, request: Request, _: str = Depends(require_admin)):
    """Approve a submission: match/create venue, create deal, update status."""
    with db_connection() as conn:
        sub = conn.execute("SELECT * FROM submissions WHERE id = ?", [submission_id]).fetchone()
        if not sub:
            raise HTTPException(404, f"Submission not found: {submission_id}")
        sub = dict(sub)
        if sub["status"] != "pending":
            raise HTTPException(400, f"Submission already {sub['status']}")

        # Match venue: exact name match, then LIKE fallback
        venue_name = sub["venue_name_raw"]
        venue = conn.execute(
            "SELECT id, name FROM venues WHERE LOWER(name) = LOWER(?)", [venue_name]
        ).fetchone()
        if not venue:
            venue = conn.execute(
                "SELECT id, name FROM venues WHERE LOWER(name) LIKE ?",
                [f"%{venue_name.lower()}%"],
            ).fetchone()

        if venue:
            venue_id = venue["id"]
        else:
            # Create minimal venue record
            import re
            slug = re.sub(r"[^\w\s-]", "", venue_name.lower().strip())
            slug = re.sub(r"[\s_]+", "-", slug).strip("-")
            cursor = conn.execute(
                "INSERT INTO venues (name, slug, address, is_active) VALUES (?, ?, ?, 1)",
                [venue_name, slug, sub.get("venue_address_raw")],
            )
            venue_id = cursor.lastrowid

        # Parse deal type
        deal_type = sub.get("deal_type_raw") or "daily_special"
        valid_types = [
            "happy_hour", "daily_special", "brunch_deal", "late_night",
            "seasonal_lto", "chain_app_deal", "loyalty_reward",
            "game_day", "event_driven", "new_opening",
            "restaurant_week", "group_package", "other",
        ]
        if deal_type not in valid_types:
            deal_type = "other"

        # Parse days
        days_json = "[]"
        if sub.get("days_raw"):
            days = [d.strip().lower() for d in sub["days_raw"].split(",")]
            days_json = json.dumps(days)

        # Create deal
        cursor = conn.execute("""
            INSERT INTO deals (venue_id, deal_type, title, description, days_available,
                source_type, quality_score, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 'user_submitted', 50, 1, CURRENT_TIMESTAMP)
        """, [
            venue_id,
            deal_type,
            f"{venue_name} Deal",
            sub["deal_description_raw"],
            days_json,
        ])
        deal_id = cursor.lastrowid

        # Update submission
        conn.execute("""
            UPDATE submissions
            SET status = 'approved', linked_venue_id = ?, linked_deal_id = ?,
                moderated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, [venue_id, deal_id, submission_id])
        conn.commit()

        return {
            "success": True,
            "submission_id": submission_id,
            "venue_id": venue_id,
            "deal_id": deal_id,
            "status": "approved",
        }


class RejectRequest(BaseModel):
    reason: Optional[str] = None


@app.post("/api/v1/admin/submissions/{submission_id}/reject")
@limiter.limit(RATE_ADMIN)
async def reject_submission(
    submission_id: int, body: RejectRequest, request: Request, _: str = Depends(require_admin),
):
    """Reject a submission with optional reason."""
    with db_connection() as conn:
        sub = conn.execute("SELECT * FROM submissions WHERE id = ?", [submission_id]).fetchone()
        if not sub:
            raise HTTPException(404, f"Submission not found: {submission_id}")
        if dict(sub)["status"] != "pending":
            raise HTTPException(400, f"Submission already {dict(sub)['status']}")

        conn.execute("""
            UPDATE submissions
            SET status = 'rejected', moderator_notes = ?,
                moderated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, [body.reason, submission_id])
        conn.commit()

        return {"success": True, "submission_id": submission_id, "status": "rejected"}


# Tables that USERS write directly through the public API. Single source of truth
# for the export endpoint, the in-process R2 write-through, and the boot replay.
USER_WRITE_TABLES = (
    "submissions",
    "subscribers",
    "deal_reports",
    "chat_logs",
    "user_saved_deals",
    "user_deal_views",
    "webmcp_analytics",
    "featured_listings",  # B2B paid features — must survive Railway redeploys
    "email_events",       # newsletter open/click engagement — same reason
)


def _collect_user_writes(conn, cutoff: str) -> dict:
    """Build the user-write delta payload (same shape the boot-replay expects)."""
    out = {"cutoff": cutoff, "tables": {}}
    for table in USER_WRITE_TABLES:
        try:
            rows = conn.execute(
                f"SELECT * FROM {table} WHERE created_at >= ? ORDER BY created_at ASC",
                [cutoff],
            ).fetchall()
            out["tables"][table] = [dict(r) for r in rows]
        except sqlite3.OperationalError:
            # Table may lack created_at (saved/views/webmcp) or not exist — skip
            out["tables"][table] = []
    out["counts"] = {t: len(rows) for t, rows in out["tables"].items()}
    return out


def _snapshot_user_writes_to_r2() -> None:
    """Best-effort write-through: push current user-write tables to R2
    (user_writes/latest.json) so a Railway redeploy BEFORE the next scheduled
    snapshot still replays them on boot — closing the gap that silently dropped
    subscribers committed to the ephemeral container DB between snapshots.

    Runs as a FastAPI BackgroundTask (after the response) and never raises.
    """
    try:
        import sys as _sys
        scripts_dir = str(Path(__file__).resolve().parents[2] / "scripts")
        if scripts_dir not in _sys.path:
            _sys.path.insert(0, scripts_dir)
        from r2_util import R2_BUCKET, USER_WRITES_KEY, r2_client

        with db_connection() as conn:
            payload = _collect_user_writes(conn, "2026-01-01")
        body = json.dumps(payload, default=str).encode("utf-8")
        r2_client().put_object(
            Bucket=R2_BUCKET, Key=USER_WRITES_KEY, Body=body,
            ContentType="application/json",
        )
        print(f"[snapshot_user_writes] pushed {len(body):,}B counts={payload.get('counts')}", flush=True)
    except BaseException as e:  # never let a snapshot failure affect the request
        print(f"[snapshot_user_writes] WARN skipped: {e}", flush=True)


@app.get("/api/v1/admin/_export_user_writes")
@limiter.limit(RATE_ADMIN)
async def export_user_writes(
    request: Request,
    since: Optional[str] = Query(None, description="ISO timestamp; default = last 60 days"),
    _: str = Depends(require_admin),
):
    """
    Dump rows from tables that LIVE on prod (form submissions, subscribers, deal reports,
    chat sessions, saved deals, WebMCP usage).
    Used by `scripts/pull_live_user_writes.py` to merge into the local DB before
    every canonical R2 upload so we never overwrite real user data.
    """
    cutoff = since or (datetime.now() - timedelta(days=60)).isoformat()
    with db_connection() as conn:
        return _collect_user_writes(conn, cutoff)


# ============================================================
# EMAIL SUBSCRIPTIONS
# ============================================================

class EmailSubscribeRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    # Accept any short slug-like source (lowercase letters, digits, hyphens, underscores).
    # Was previously a closed enum which silently 422'd signups from /search,
    # all /guides/* pages, /blog/*, and /chat — the most engaged surfaces.
    # Apr 28 2026 fix: widened to slug regex, kept length-bounded to avoid abuse.
    source: str = Field("website", pattern=r"^[a-z0-9_-]{1,40}$")

RATE_SUBSCRIBE = "3/minute"

@app.post("/api/v1/email/subscribe")
@limiter.limit(RATE_SUBSCRIBE)
async def email_subscribe(body: EmailSubscribeRequest, request: Request, background_tasks: BackgroundTasks):
    """Subscribe an email to The Deal Sheet newsletter."""
    import re
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", body.email):
        raise HTTPException(400, "Invalid email address")

    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]

    with db_connection() as conn:
        existing = conn.execute(
            "SELECT id, is_active FROM subscribers WHERE email = ?",
            [body.email.lower().strip()],
        ).fetchone()

        if existing:
            if existing["is_active"]:
                return {"success": True, "message": "You're already subscribed!", "already_subscribed": True}
            # Re-activate
            conn.execute(
                "UPDATE subscribers SET is_active = 1, unsubscribed_at = NULL, source = ? WHERE id = ?",
                [body.source, existing["id"]],
            )
            conn.commit()
            background_tasks.add_task(_snapshot_user_writes_to_r2)
            return {"success": True, "message": "Welcome back! You've been re-subscribed."}

        conn.execute(
            "INSERT INTO subscribers (email, source, ip_hash) VALUES (?, ?, ?)",
            [body.email.lower().strip(), body.source, ip_hash],
        )
        conn.commit()

    # Send welcome email (no-ops if Resend not configured)
    from src.emails.sender import send_welcome
    send_welcome(body.email.lower().strip())

    # Write-through: snapshot user-writes to R2 immediately so a redeploy before the
    # next scheduled snapshot can't drop this signup (the bug that lost 3 subscribers).
    background_tasks.add_task(_snapshot_user_writes_to_r2)

    return {"success": True, "message": "You're in! Watch for The Deal Sheet in your inbox."}


async def _do_unsubscribe(email: str, token: str):
    """Shared unsubscribe logic for GET (browser click) and POST (RFC 8058 one-click)."""
    from src.emails.sender import verify_unsubscribe_token

    if not verify_unsubscribe_token(email, token):
        raise HTTPException(403, "Invalid unsubscribe link")

    normalized = email.lower().strip()
    with db_connection() as conn:
        conn.execute(
            "UPDATE subscribers SET is_active = 0, unsubscribed_at = CURRENT_TIMESTAMP WHERE email = ?",
            [normalized],
        )
        conn.commit()

    return HTMLResponse(
        content="""<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#333">
<h1>You've been unsubscribed</h1>
<p>You won't receive any more emails from The Deal Sheet.</p>
<p><a href="https://www.312deals.com" style="color:#2563eb">Back to 312Deals</a></p>
</body></html>""",
        status_code=200,
    )


@app.get("/api/v1/email/unsubscribe")
async def email_unsubscribe(
    request: Request,
    email: str = Query(...),
    token: str = Query(...),
):
    """Unsubscribe via browser link click."""
    return await _do_unsubscribe(email, token)


@app.post("/api/v1/email/unsubscribe")
async def email_unsubscribe_post(
    request: Request,
    email: str = Query(...),
    token: str = Query(...),
):
    """RFC 8058 one-click unsubscribe (Gmail/Apple Mail send POST)."""
    return await _do_unsubscribe(email, token)


@app.post("/api/v1/email/webhook")
async def email_webhook(request: Request):
    """Handle Resend webhook events: bounce/complaint → suppress subscriber;
    opened/clicked → record newsletter engagement (email_events).

    Verifies the Svix signature with RESEND_WEBHOOK_SECRET (Resend sends
    Svix-signed webhooks: svix-id / svix-timestamp / svix-signature). If the
    secret is unset the endpoint accepts unverified requests (warning once) so
    tracking keeps working before the secret is wired — the same graceful
    degradation as the AgentMail webhook.
    """
    raw_body = await request.body()

    secret = os.getenv("RESEND_WEBHOOK_SECRET")
    if secret:
        from src.api.webhook_security import verify_svix_signature
        if not verify_svix_signature(raw_body, dict(request.headers), secret):
            return JSONResponse(status_code=401, content={"ok": False, "error": "bad_signature"})
    elif not getattr(email_webhook, "_warned_no_secret", False):
        print("⚠ RESEND_WEBHOOK_SECRET not set — email webhook accepting unverified requests")
        email_webhook._warned_no_secret = True

    try:
        body = json.loads(raw_body)
    except Exception:
        return JSONResponse(status_code=400, content={"ok": False, "error": "invalid_json"})
    event_type = body.get("type")

    # Shared Resend account (sibling products): ignore events for emails we didn't send.
    if not _import_email_events().is_our_send(body.get("data", {})):
        return {"ok": True}

    # Newsletter engagement (open/click tracking). Requires open/click tracking
    # enabled in Resend + these event types subscribed on the webhook endpoint.
    if event_type in ("email.opened", "email.clicked"):
        try:
            with db_connection() as conn:
                _import_email_events().record_engagement_event(conn, event_type, body.get("data", {}))
        except Exception as e:  # never fail the webhook on a tracking error
            print(f"⚠️  email engagement record skipped: {e}")
        return {"ok": True}

    if event_type not in ("email.bounced", "email.complained"):
        return {"ok": True}

    data = body.get("data", {})
    recipients = data.get("to", [])

    with db_connection() as conn:
        for email in recipients:
            normalized = email.lower().strip()
            if event_type == "email.bounced":
                # Resend flags permanent (hard) vs transient (soft) bounces. A
                # permanent bounce means Resend has suppressed the address and
                # will never attempt it again, so waiting for a "second strike"
                # that can never arrive leaves the row is_active=1 forever while
                # the person is unreachable.
                #
                # The previous statement did exactly that for EVERY bounce: in a
                # single UPDATE the right-hand sides all read the PRE-update row,
                # so `COALESCE(bounce_count,0) >= 1` tested the old value and the
                # first bounce never deactivated anyone. It took two.
                bounce_type = str(
                    (data.get("bounce") or {}).get("type")
                    or data.get("bounce_type")
                    or ""
                ).lower()
                permanent = bounce_type.startswith("perm") or bounce_type == "hard"
                # Soft bounces keep the two-strike tolerance, but compare against
                # the incremented value so the threshold means what it says.
                threshold = 1 if permanent else 2
                conn.execute(
                    """UPDATE subscribers SET bounce_count = COALESCE(bounce_count, 0) + 1,
                       is_active = CASE WHEN COALESCE(bounce_count, 0) + 1 >= ?
                                        THEN 0 ELSE is_active END
                       WHERE email = ?""",
                    [threshold, normalized],
                )
            elif event_type == "email.complained":
                conn.execute(
                    "UPDATE subscribers SET is_active = 0, unsubscribed_at = CURRENT_TIMESTAMP WHERE email = ?",
                    [normalized],
                )
        conn.commit()

    return {"ok": True}


# ============================================================
# NEWSLETTER INGESTION WEBHOOK (AgentMail)
# ============================================================

@app.post("/api/v1/webhooks/agentmail")
async def agentmail_webhook(request: Request):
    """Handle incoming newsletter emails from AgentMail.

    When a newsletter arrives at 312deals-newsletters@agentmail.to,
    AgentMail fires this webhook with the full email content.
    We extract deals via Claude and upsert them into the database.

    Verifies Svix signature using AGENTMAIL_WEBHOOK_SECRET. AgentMail uses
    Svix-signed webhooks (svix-id / svix-timestamp / svix-signature headers).
    Set AGENTMAIL_WEBHOOK_SECRET in env (Railway) to enable verification.
    Without the secret set, webhook accepts all requests (dev mode) — log warns.
    """
    import hashlib as _hashlib
    import re as _re

    # Signature verification — Svix-signed webhooks per AgentMail docs
    raw_body = await request.body()
    webhook_secret = os.getenv("AGENTMAIL_WEBHOOK_SECRET")
    if webhook_secret:
        try:
            from svix.webhooks import Webhook, WebhookVerificationError
            wh = Webhook(webhook_secret)
            wh.verify(raw_body, dict(request.headers))
        except (WebhookVerificationError, Exception) as e:
            return JSONResponse(status_code=401, content={"ok": False, "error": f"signature: {type(e).__name__}"})
    else:
        # Dev mode — log once per cold start
        if not getattr(agentmail_webhook, "_warned_no_secret", False):
            print("⚠ AGENTMAIL_WEBHOOK_SECRET not set — webhook accepting unverified requests")
            agentmail_webhook._warned_no_secret = True

    try:
        body = json.loads(raw_body)
    except Exception:
        return JSONResponse(status_code=400, content={"ok": False, "error": "invalid_json"})

    event_type = body.get("event_type")

    # Diagnostic events (subscribed Apr 28+) — log + ack, no extraction needed.
    # message.received.blocked: confirms our block-list working
    # message.received.spam: flags spam-classified emails (review periodically)
    # message.received.unauthenticated: SPF/DKIM/DMARC failures (potential spoofing)
    DIAG_EVENTS = {"message.received.blocked", "message.received.spam",
                   "message.received.unauthenticated"}
    if event_type in DIAG_EVENTS:
        msg = body.get("message", {})
        sender = msg.get("from", "unknown")
        subject = msg.get("subject", "")[:80]
        print(f"📩 {event_type}: from={sender} subject={subject!r}")
        # Future: persist to a `webhook_diagnostics` table for analytics
        return {"ok": True, "diagnostic": event_type}

    if event_type != "message.received":
        return {"ok": True, "skipped": True, "reason": f"Unhandled event: {event_type}"}

    message = body.get("message", {})
    msg_id = message.get("message_id", "")
    sender_email = message.get("from", "unknown")
    sender_name = ""
    subject = message.get("subject", "")
    html_body = message.get("html", "")
    text_body = message.get("text", "")
    received_at = message.get("timestamp")
    thread_id = message.get("thread_id")

    # Parse sender display name
    if isinstance(sender_email, str) and "<" in sender_email:
        parts = sender_email.split("<")
        sender_name = parts[0].strip().strip('"')
        sender_email = parts[1].rstrip(">").strip()

    with db_connection() as conn:
        # Dedup: skip if already processed
        existing = conn.execute(
            "SELECT id FROM newsletter_emails WHERE message_id = ?", [msg_id]
        ).fetchone()
        if existing:
            return {"ok": True, "skipped": True, "reason": "already_processed"}

        # Clean HTML to text
        raw_text = text_body
        if html_body:
            try:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(html_body, "html.parser")
                for tag in soup.find_all(["script", "style", "img", "iframe"]):
                    tag.decompose()
                raw_text = soup.get_text(separator="\n", strip=True)
            except Exception:
                raw_text = text_body or html_body

        if not raw_text:
            conn.execute("""
                INSERT INTO newsletter_emails (message_id, thread_id, sender_email, subject, received_at, status, extraction_notes)
                VALUES (?, ?, ?, ?, ?, 'ignored', 'Empty email body')
            """, [msg_id, thread_id, sender_email, subject, received_at])
            conn.commit()
            return {"ok": True, "skipped": True, "reason": "empty_body"}

        content_hash = _hashlib.md5(raw_text.encode()).hexdigest()

        # Match venue
        venue_id = None
        venue_name_hint = sender_name or None

        # Check newsletter_sources for pre-linked venue
        source = conn.execute(
            "SELECT venue_id FROM newsletter_sources WHERE sender_email = ? AND venue_id IS NOT NULL",
            [sender_email],
        ).fetchone()
        if source:
            venue_id = source["venue_id"]
            venue_row = conn.execute("SELECT name FROM venues WHERE id = ?", [venue_id]).fetchone()
            if venue_row:
                venue_name_hint = venue_row["name"]
        else:
            # Try domain match (works for senders with own-domain emails)
            domain_match = _re.search(r"@(.+)$", sender_email)
            if domain_match:
                domain = domain_match.group(1).lower()
                for prefix in ("mail.", "email.", "news.", "newsletter.", "e.", "marketing."):
                    if domain.startswith(prefix):
                        domain = domain[len(prefix):]
                # Skip generic provider domains so we don't false-match
                generic_providers = {
                    "list-manage.com", "mailchimpapp.com", "wixemails.com",
                    "mandrillapp.com", "mail-zr.com", "campaign-preferences.com",
                    "lettuce.com",  # LEYE uses lettuce.com for ALL brands; need name match instead
                    "rsgsv.net", "mc.us17.list-manage.com",
                }
                domain_is_generic = any(g in domain for g in generic_providers)
                if not domain_is_generic:
                    venue_row = conn.execute(
                        "SELECT id, name FROM venues WHERE website_url LIKE ? AND is_active = 1 LIMIT 1",
                        [f"%{domain}%"],
                    ).fetchone()
                    if venue_row:
                        venue_id = venue_row["id"]
                        venue_name_hint = venue_row["name"]

            # Fuzzy name match fallback — strip punctuation/spacing, match ≥80% of chars.
            # Prevents the AHJOOMAH'S APRON dupe pattern: webhook can't match
            # "ahjoomahchicago@pb07.wixemails.com" via domain, but the sender
            # display name "AHJOOMAH'S APRON" matches venue "Ahjoomah' S Apron".
            if not venue_id and sender_name:
                normalized = _re.sub(r"[^a-z0-9]+", "", sender_name.lower())
                if len(normalized) >= 5:
                    rows = conn.execute("""
                        SELECT id, name FROM venues
                        WHERE is_active = 1 AND LENGTH(name) BETWEEN ? AND ?
                    """, [max(len(sender_name) - 5, 3), len(sender_name) + 15]).fetchall()
                    for row in rows:
                        cand = _re.sub(r"[^a-z0-9]+", "", row["name"].lower())
                        if cand and (cand in normalized or normalized in cand):
                            venue_id = row["id"]
                            venue_name_hint = row["name"]
                            break

        # Extract deals
        try:
            sys.path.insert(0, str(Path(__file__).parent.parent))
            from pipeline.deal_extractor import extract_deals_from_text, upsert_venue, upsert_deal

            source_url = f"newsletter:{sender_email}"
            result = extract_deals_from_text(raw_text, source_url, venue_name_hint)

            deals_stored = 0
            if result.deals:
                if not venue_id:
                    venue_data = {"name": result.deals[0].venue_name, "website_url": None}
                    venue_id = upsert_venue(conn, venue_data)

                for deal in result.deals:
                    deal_id = upsert_deal(conn, venue_id, deal, source_type="imported")
                    if deal_id and deal_id > 0:
                        deals_stored += 1

            # Track source
            conn.execute("""
                INSERT INTO newsletter_sources (sender_email, sender_name, venue_id, emails_received, deals_extracted, last_email_at)
                VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(sender_email) DO UPDATE SET
                    sender_name = COALESCE(excluded.sender_name, newsletter_sources.sender_name),
                    venue_id = COALESCE(excluded.venue_id, newsletter_sources.venue_id),
                    emails_received = newsletter_sources.emails_received + 1,
                    deals_extracted = newsletter_sources.deals_extracted + excluded.deals_extracted,
                    last_email_at = CURRENT_TIMESTAMP
            """, [sender_email, sender_name, venue_id, deals_stored])

            # Record email
            conn.execute("""
                INSERT INTO newsletter_emails (message_id, thread_id, sender_email, subject, received_at,
                    status, deals_extracted, content_hash, processed_at)
                VALUES (?, ?, ?, ?, ?, 'processed', ?, ?, CURRENT_TIMESTAMP)
            """, [msg_id, thread_id, sender_email, subject, received_at, deals_stored, content_hash])
            conn.commit()

            # Label in AgentMail
            try:
                agentmail_key = os.getenv("AGENTMAIL_API_KEY")
                if agentmail_key:
                    from agentmail import AgentMail as _AgentMail
                    am_client = _AgentMail(api_key=agentmail_key)
                    am_client.inboxes.messages.update(
                        inbox_id="312deals-newsletters@agentmail.to",
                        message_id=msg_id,
                        add_labels=["processed"],
                        remove_labels=["received"],
                    )
            except Exception:
                pass  # Non-critical

            return {
                "ok": True,
                "deals_found": len(result.deals),
                "deals_stored": deals_stored,
                "venue_id": venue_id,
                "confidence": result.confidence,
            }

        except Exception as e:
            # Record the failure
            conn.execute("""
                INSERT INTO newsletter_emails (message_id, thread_id, sender_email, subject, received_at,
                    status, content_hash, extraction_notes, processed_at)
                VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
            """, [msg_id, thread_id, sender_email, subject, received_at, content_hash, str(e)])
            conn.commit()
            return {"ok": False, "error": str(e)}


# ============================================================
# STRIPE WEBHOOK — durable B2B featured-listing fulfillment
# ============================================================

def _import_featured_listings():
    """Import the shared featured_listings module from scripts/ (lazy path insert)."""
    import sys as _sys
    scripts_dir = str(Path(__file__).resolve().parents[2] / "scripts")
    if scripts_dir not in _sys.path:
        _sys.path.insert(0, scripts_dir)
    import featured_listings as _fl
    return _fl


def _import_email_events():
    """Import the shared email_events module from scripts/ (lazy path insert)."""
    import sys as _sys
    scripts_dir = str(Path(__file__).resolve().parents[2] / "scripts")
    if scripts_dir not in _sys.path:
        _sys.path.insert(0, scripts_dir)
    import email_events as _ee
    return _ee


def _verify_stripe_signature(payload: bytes, sig_header: str, secret: str,
                             tolerance: int = 300) -> bool:
    """Verify a Stripe webhook signature with stdlib HMAC (no stripe SDK dep).

    Header format: `t=<ts>,v1=<sig>[,v1=<sig>...]`. signed_payload = `<ts>.<body>`.
    """
    import hmac as _hmac
    import hashlib as _hashlib
    import time as _time
    try:
        items = [p.split("=", 1) for p in sig_header.split(",") if "=" in p]
        ts = next((v for k, v in items if k == "t"), None)
        v1s = [v for k, v in items if k == "v1"]
        if not ts or not v1s:
            return False
        try:
            if abs(_time.time() - int(ts)) > tolerance:
                return False
        except ValueError:
            return False
        signed = ts.encode() + b"." + payload
        expected = _hmac.new(secret.encode(), signed, _hashlib.sha256).hexdigest()
        return any(_hmac.compare_digest(expected, v) for v in v1s)
    except Exception:
        return False


def _extract_venue_name(sess: dict) -> tuple[str, bool]:
    """Pull the venue name from a Stripe Checkout session.

    Returns `(name, declared)`. `declared` is True only when the name came from a
    Payment Link custom field that actually asks for a venue/business — i.e. the
    buyer told us which venue they are paying for.

    The customer's own name is a *fallback label only* and is never trustworthy
    for matching: "Hunter fogarty" is a person, and a buyer whose personal name
    happens to be a unique substring of some venue ("Gene", "Lou") would
    otherwise silently feature a restaurant that never paid.
    """
    for f in (sess.get("custom_fields") or []):
        key = (f.get("key") or "").lower()
        label_obj = f.get("label") or {}
        label = (label_obj.get("custom") if isinstance(label_obj, dict) else str(label_obj) or "").lower()
        blob = f"{key} {label}"
        if any(w in blob for w in ("venue", "business", "restaurant", "company")):
            txt = f.get("text") or {}
            val = txt.get("value") if isinstance(txt, dict) else None
            if val:
                return val.strip(), True
    return ((sess.get("customer_details") or {}).get("name") or "").strip(), False


@app.post("/api/v1/webhooks/stripe")
async def stripe_webhook(request: Request, background_tasks: BackgroundTasks):
    """Stripe checkout webhook → durable featured-listing fulfillment.

    On `checkout.session.completed` we record a row in `featured_listings` (a
    user-write table that survives Railway redeploys via the R2 snapshot/replay)
    and, when the paid venue matches by name, flip venues.is_featured so it sorts
    to the top right away. Every boot, reconcile_featured re-applies these onto
    venues.is_featured (which the R2 DB fetch otherwise resets).

    Set STRIPE_WEBHOOK_SECRET (Stripe Dashboard → Developers → Webhooks) to enable
    signature verification. Without it the endpoint acknowledges but does NOT
    process — safe to deploy before the secret is configured.
    """
    raw_body = await request.body()
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
    if not secret:
        if not getattr(stripe_webhook, "_warned_no_secret", False):
            print("⚠ STRIPE_WEBHOOK_SECRET not set — Stripe webhook acknowledging without processing")
            stripe_webhook._warned_no_secret = True
        return {"ok": True, "processed": False, "reason": "secret_not_configured"}

    if not _verify_stripe_signature(raw_body, request.headers.get("stripe-signature", ""), secret):
        return JSONResponse(status_code=401, content={"ok": False, "error": "bad_signature"})

    try:
        event = json.loads(raw_body)
    except Exception:
        return JSONResponse(status_code=400, content={"ok": False, "error": "invalid_json"})

    if event.get("type") != "checkout.session.completed":
        return {"ok": True, "skipped": True, "reason": f"unhandled:{event.get('type')}"}

    sess = (event.get("data") or {}).get("object") or {}
    session_id = sess.get("id")

    # This Stripe account is shared with dailylocks.ai and lakeshoreiq.com, so
    # this endpoint sees THEIR checkouts too. Without a guard, a Daily Locks
    # signup lands in featured_listings as a phantom sale (as happened on
    # 2026-08-04). Two layers, because neither is sufficient alone:
    #
    #   1. metadata.project — the Sponsored Listing Payment Link stamps
    #      "312deals" on every session it creates. Authoritative when present,
    #      but absent on legacy links and on any future link built without it.
    #   2. mode — 312Deals featured listings are one-time; every sibling product
    #      today is a subscription. Catches unstamped foreign sessions, but would
    #      fail open if a sibling ever sold a one-time product.
    def _skip(reason: str):
        """Skip, but say so. Every guard below returns HTTP 200 because Stripe
        must not retry a deliberate skip — which means a silent return is
        indistinguishable from a captured payment that vanished. Log all of them."""
        print(f"💳 Stripe skipped: session={session_id} reason={reason}", flush=True)
        return {"ok": True, "skipped": True, "reason": reason}

    project = (sess.get("metadata") or {}).get("project")
    if project and project != "312deals":
        return _skip(f"other_project:{project}")

    if sess.get("mode") != "payment":
        return _skip(f"not_a_featured_purchase:mode={sess.get('mode')}")

    # A completed session is not necessarily a PAID one. Delayed payment methods
    # fire checkout.session.completed with payment_status "unpaid" and settle
    # later via checkout.session.async_payment_succeeded, which this endpoint
    # does not subscribe to. Featuring on unpaid would hand out the product for
    # free; the loud log is so an unpaid session is never mistaken for a lost one.
    payment_status = sess.get("payment_status")
    if payment_status not in ("paid", "no_payment_required"):
        return _skip(f"not_paid:payment_status={payment_status}")

    # Test-mode sessions hitting the live endpoint would feature a real venue on
    # a fake payment. Opt in explicitly rather than trusting the caller.
    if not sess.get("livemode") and os.getenv("STRIPE_ALLOW_TEST_MODE", "").strip() != "1":
        return _skip("test_mode_session")

    email = ((sess.get("customer_details") or {}).get("email")) or sess.get("customer_email")
    amount_cents = sess.get("amount_total")
    currency = sess.get("currency")

    # There was no amount check at all, and featured_listings row 3 is the proof:
    # a $0 session recorded as 'active' on 2026-08-20. Floor is deliberately low
    # rather than pinned to 3900 so a discount does not silently stop working.
    min_cents = int(os.getenv("FEATURED_MIN_CENTS", "100"))
    if amount_cents is None or amount_cents < min_cents:
        return _skip(f"amount_below_floor:{amount_cents}<{min_cents}")
    venue_name, venue_declared = _extract_venue_name(sess)

    days = int(os.getenv("FEATURED_DEFAULT_DAYS", "30"))
    featured_until = (date.today() + timedelta(days=days)).isoformat()

    fl = _import_featured_listings()
    with db_connection() as conn:
        fl.ensure_featured_table(conn)
        if session_id and conn.execute(
            "SELECT 1 FROM featured_listings WHERE stripe_session_id = ?", [session_id]
        ).fetchone():
            return {"ok": True, "duplicate": True}

        # Only auto-match when the buyer actually named a venue. A personal name
        # stays pending_match for manual resolution via scripts/feature_venue.py.
        matched = fl.match_venue_id(conn, venue_name) if venue_declared else None
        conn.execute(
            """
            INSERT INTO featured_listings
                (venue_id, venue_name, email, amount_cents, currency,
                 stripe_session_id, status, featured_until, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stripe')
            """,
            [matched, venue_name, email, amount_cents, currency, session_id,
             "active" if matched else "pending_match", featured_until],
        )
        conn.commit()
        if matched:
            fl.reconcile_featured(conn)

    # Write-through to R2 so the feature survives a redeploy before the next snapshot.
    background_tasks.add_task(_snapshot_user_writes_to_r2)
    print(f"💳 Stripe featured: session={session_id} venue={venue_name!r} "
          f"matched_id={matched} until={featured_until}", flush=True)
    return {
        "ok": True,
        "matched_venue_id": matched,
        "status": "active" if matched else "pending_match",
        "featured_until": featured_until,
    }


@app.get("/api/v1/admin/featured_listings")
@limiter.limit(RATE_ADMIN)
async def list_featured_listings(request: Request, _: str = Depends(require_admin)):
    """List recorded featured listings (incl. unmatched 'pending_match' ones)."""
    fl = _import_featured_listings()
    with db_connection() as conn:
        fl.ensure_featured_table(conn)
        rows = conn.execute(
            "SELECT * FROM featured_listings ORDER BY created_at DESC LIMIT 200"
        ).fetchall()
        return {"featured_listings": [dict(r) for r in rows]}


@app.post("/api/v1/admin/venues/{venue_id}/unfeature")
@limiter.limit(RATE_ADMIN)
async def unfeature_venue(venue_id: int, request: Request,
                         background_tasks: BackgroundTasks,
                         _: str = Depends(require_admin)):
    """Remove a venue's featured status + mark its active featured_listings refunded.

    Use for refunds, cancellations, or removing a mistaken/test feature. Durable:
    the R2 write-through means it survives the next redeploy (otherwise the boot
    reconcile would re-apply an 'active' listing).
    """
    fl = _import_featured_listings()
    with db_connection() as conn:
        fl.ensure_featured_table(conn)
        conn.execute(
            "UPDATE venues SET is_featured = 0, featured_until = NULL WHERE id = ?",
            [venue_id],
        )
        cur = conn.execute(
            "UPDATE featured_listings SET status = 'refunded' WHERE venue_id = ? AND status = 'active'",
            [venue_id],
        )
        refunded = cur.rowcount
        conn.commit()
    background_tasks.add_task(_snapshot_user_writes_to_r2)
    return {"ok": True, "venue_id": venue_id, "listings_refunded": refunded}


# ============================================================
# STARTUP
# ============================================================

def run_migrations():
    """Apply any pending SQL migration files from data/migrations/."""
    migrations_dir = Path("data/migrations")
    if not migrations_dir.exists():
        return
    with db_connection() as conn:
        # Create migrations tracking table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                filename TEXT PRIMARY KEY,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        applied = {r["filename"] for r in conn.execute("SELECT filename FROM _migrations").fetchall()}
        for sql_file in sorted(migrations_dir.glob("*.sql")):
            if sql_file.name in applied:
                continue
            print(f"  Applying migration: {sql_file.name}")
            sql = sql_file.read_text()
            for statement in sql.split(";"):
                statement = statement.strip()
                if statement and not statement.startswith("--"):
                    try:
                        conn.execute(statement)
                    except Exception as e:
                        print(f"    ⚠️  {e}")
            conn.execute("INSERT INTO _migrations (filename) VALUES (?)", [sql_file.name])
            conn.commit()
            print(f"    ✓ Applied")


@app.on_event("startup")
async def startup():
    """Verify database exists and is readable."""
    # Env-gated Langfuse tracing for the AI-chat path. No-op unless
    # LANGFUSE_ENABLED is truthy and keys/host are present; never raises.
    try:
        from src.api.langfuse_tracing import init_tracing
        init_tracing()
    except Exception as e:  # pragma: no cover - defensive
        print(f"⚠️  Langfuse init skipped: {e}")
    if not DB_PATH.exists():
        print(f"⚠️  Database not found at {DB_PATH}")
        print("   Run: sqlite3 data/chideals.db < data/schema.sql")
        print("   Or: bash scripts/setup.sh")
    else:
        with db_connection() as conn:
            tables = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            ).fetchall()
            print(f"✓ Database: {DB_PATH} ({len(tables)} tables)")
            # Guarantee the B2B featured-listings table exists on the running API.
            try:
                _import_featured_listings().ensure_featured_table(conn)
            except Exception as e:  # pragma: no cover - defensive
                print(f"⚠️  ensure featured_listings skipped: {e}")
        run_migrations()
