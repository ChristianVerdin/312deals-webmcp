"""
312Deals MCP Server — FastMCP Implementation
==============================================
11 tools that expose 312Deals data to any MCP client (Claude Code, Cursor, etc.).
Query logic mirrors deals_api.py — same SQLite DB, same results.

Run standalone:
    python -m src.mcp_server.chideals_mcp

Add to Claude Code:
    claude mcp add chideals -- python -m src.mcp_server.chideals_mcp

Tools (8 core + 3 workflow):
    search_chicago_deals        — Search deals by neighborhood, day, type, cuisine
    deals_near_location         — Geo-proximity deal search
    get_venue_details           — Single venue with all deals
    get_chicago_neighborhoods   — List neighborhoods with deal counts
    submit_deal_tip             — Submit a new deal
    chicago_deal_of_the_day     — Today's featured deal
    chicago_chain_deals         — National chain deals
    plan_chicago_deal_crawl     — Multi-stop deal crawl planner
    find_best_deal_now          — Best deal active right now (time-aware)
    compare_neighborhoods       — Side-by-side neighborhood comparison
    weekly_deals_digest         — Curated weekly summary (top picks, savings, stats)
"""

from __future__ import annotations

import json
import math
import os
import sqlite3
import time
from collections import deque
from datetime import datetime, date
from pathlib import Path
from typing import Optional

from fastmcp import FastMCP

from src.api.sanitize import strip_photo_keys, strip_private_fields
from src.product_stats import STATS

# ============================================================
# CONFIG
# ============================================================

DB_PATH = Path(os.getenv("CHIDEALS_DB_PATH", "data/chideals.db"))
DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

mcp = FastMCP(
    "312Deals",
    instructions=f"Chicago food & drink deals — search happy hours, daily specials, brunch deals, and more across {STATS.neighborhoods} neighborhoods. {STATS.venues} venues, {STATS.deals} deals.",
)


# ============================================================
# SUBMIT GUARDRAILS  (input caps + rate limit for submit_deal_tip)
# ============================================================
# submit_deal_tip is the only WRITE tool and is publicly callable — the REST
# app's slowapi limiter does not cover the MCP layer. These guards cap the
# abuse surface into the `submissions` table. In-memory + per-process (FastMCP
# has no slowapi); a backstop against runaway abuse, not a substitute for auth.

_SUBMIT_MAX_LEN = {"venue_name": 200, "deal_description": 1000, "source": 500}
_SUBMIT_RATE_MAX = 10        # max accepted submissions ...
_SUBMIT_RATE_WINDOW_S = 60   # ... per this sliding window (seconds)
_submit_ts: deque = deque()


class SubmitRejected(ValueError):
    """submit_deal_tip input failed a cap, sanitation, or rate-limit check."""


def _validate_submit(venue_name, deal_description, source):
    """Trim, require non-empty, and length-cap the inputs. Raises SubmitRejected
    on bad input; returns the cleaned (venue_name, deal_description, source)."""
    vn = (venue_name or "").strip()
    dd = (deal_description or "").strip()
    src = (source or "").strip() or None
    if not vn:
        raise SubmitRejected("venue_name is required")
    if not dd:
        raise SubmitRejected("deal_description is required")
    for field, value in (("venue_name", vn), ("deal_description", dd), ("source", src or "")):
        cap = _SUBMIT_MAX_LEN[field]
        if len(value) > cap:
            raise SubmitRejected(f"{field} exceeds the {cap}-character limit")
    return vn, dd, src


def _check_submit_rate(now=None):
    """Sliding-window rate limit. Raises SubmitRejected when the window is full,
    otherwise records the accepted call. `now` is injectable for tests."""
    t = time.monotonic() if now is None else now
    while _submit_ts and t - _submit_ts[0] > _SUBMIT_RATE_WINDOW_S:
        _submit_ts.popleft()
    if len(_submit_ts) >= _SUBMIT_RATE_MAX:
        raise SubmitRejected(
            f"rate limit: max {_SUBMIT_RATE_MAX} submissions per {_SUBMIT_RATE_WINDOW_S}s"
        )
    _submit_ts.append(t)


# ============================================================
# DATABASE HELPERS
# ============================================================

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    for key in ("days_available", "food_items", "drink_items"):
        if key in d and isinstance(d[key], str):
            try:
                d[key] = json.loads(d[key])
            except (json.JSONDecodeError, TypeError):
                pass
    # Internal provenance must not leak through MCP either — this server
    # has its own row_to_dict and also selects v.*.
    return strip_private_fields(strip_photo_keys(d))


def get_today() -> str:
    return DAY_NAMES[date.today().weekday()]


def haversine_miles(lat1, lon1, lat2, lon2) -> float:
    R = 3959
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


# ============================================================
# TOOLS
# ============================================================

@mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False})
def search_chicago_deals(
    neighborhood: Optional[str] = None,
    day: Optional[str] = None,
    deal_type: Optional[str] = None,
    cuisine: Optional[str] = None,
    query: Optional[str] = None,
    zone: Optional[str] = None,
    has_patio: Optional[bool] = None,
    dog_friendly_patio: Optional[bool] = None,
    limit: int = 25,
) -> str:
    """Search food and drink deals across Chicago and 60+ suburbs.

    Covers happy hours, daily specials, brunch deals, late-night food,
    chain app deals, game day specials, and more.

    Args:
        neighborhood: Chicago neighborhood (e.g., "West Loop", "Roscoe Village", "Naperville")
        day: Day of week or "today" (e.g., "monday", "friday", "today")
        deal_type: Filter by type: happy_hour, daily_special, brunch_deal, late_night,
                   chain_app_deal, game_day, seasonal_lto, loyalty_reward
        cuisine: Cuisine filter (e.g., "mexican", "italian", "sushi", "pizza")
        query: Free-text search (e.g., "oysters", "half off wings", "margarita")
        zone: Geographic zone: city, north_shore, northwest_suburbs, western_suburbs, south_suburbs
        has_patio: Filter to venues with patio/outdoor seating
        limit: Max results (default 25)
    """
    sql = """
        SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
               v.latitude, v.longitude, v.address, v.cuisine_type,
               n.name AS neighborhood, n.slug AS neighborhood_slug
        FROM deals d
        JOIN venues v ON d.venue_id = v.id
        LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
        WHERE d.is_active = 1 AND v.is_active = 1
    """
    params = []

    if neighborhood:
        sql += " AND (LOWER(n.name) LIKE ? OR LOWER(n.slug) LIKE ?)"
        pattern = f"%{neighborhood.lower()}%"
        params.extend([pattern, pattern])

    if day:
        if day.lower() == "today":
            day = get_today()
        sql += " AND (d.days_available LIKE ? OR d.is_all_day = 1)"
        params.append(f'%"{day.lower()}"%')

    if deal_type:
        sql += " AND d.deal_type = ?"
        params.append(deal_type.lower())

    if cuisine:
        sql += " AND LOWER(v.cuisine_type) LIKE ?"
        params.append(f"%{cuisine.lower()}%")

    if zone:
        sql += " AND LOWER(n.zone) = ?"
        params.append(zone.lower())

    if has_patio:
        sql += " AND v.has_patio = 1"

    if dog_friendly_patio:
        sql += " AND v.dog_friendly_patio = 1"

    if query:
        sql += " AND (LOWER(d.title) LIKE ? OR LOWER(d.description) LIKE ? OR LOWER(v.name) LIKE ?)"
        pattern = f"%{query.lower()}%"
        params.extend([pattern, pattern, pattern])

    sql += " ORDER BY d.quality_score DESC NULLS LAST LIMIT ?"
    params.append(min(limit, 100))

    conn = get_db()
    try:
        rows = conn.execute(sql, params).fetchall()
        deals = [row_to_dict(r) for r in rows]
        return json.dumps({
            "deals": deals,
            "count": len(deals),
            "filters": {"neighborhood": neighborhood, "day": day, "deal_type": deal_type,
                        "cuisine": cuisine, "query": query, "zone": zone},
        }, default=str)
    finally:
        conn.close()


@mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False})
def deals_near_location(
    address: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_miles: float = 1.5,
    active_now: bool = False,
) -> str:
    """Find deals near a specific location in Chicago.

    Provide lat/lng coordinates for best results. If you only have an address,
    use maps_geocode() first to get coordinates.

    Args:
        address: Street address (requires geocoding — use lat/lng if possible)
        lat: Latitude coordinate
        lng: Longitude coordinate
        radius_miles: Search radius in miles (default 1.5, max 25)
        active_now: Only show deals happening right now
    """
    if lat is None or lng is None:
        return json.dumps({
            "error": "Provide lat/lng coordinates. Use maps_geocode() first if you have an address.",
            "tip": "Example: maps_geocode(address='333 N Michigan Ave, Chicago, IL')",
        })

    conn = get_db()
    try:
        lat_delta = radius_miles / 69.0
        lng_delta = radius_miles / (69.0 * math.cos(math.radians(lat)))

        rows = conn.execute("""
            SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
                   v.latitude, v.longitude, v.address,
                   n.name AS neighborhood
            FROM deals d
            JOIN venues v ON d.venue_id = v.id
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE d.is_active = 1 AND v.is_active = 1
              AND v.latitude BETWEEN ? AND ?
              AND v.longitude BETWEEN ? AND ?
        """, [lat - lat_delta, lat + lat_delta, lng - lng_delta, lng + lng_delta]).fetchall()

        deals = []
        for r in rows:
            d = row_to_dict(r)
            dist = haversine_miles(lat, lng, d["latitude"], d["longitude"])
            if dist <= radius_miles:
                d["distance_miles"] = round(dist, 2)
                deals.append(d)

        deals.sort(key=lambda x: x["distance_miles"])
        return json.dumps({
            "deals": deals[:25],
            "count": len(deals[:25]),
            "center": {"lat": lat, "lng": lng},
            "radius_miles": radius_miles,
        }, default=str)
    finally:
        conn.close()


@mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False})
def get_venue_details(
    venue_name: Optional[str] = None,
    venue_id: Optional[int] = None,
) -> str:
    """Get details for a specific venue including all its active deals.

    Args:
        venue_name: Search by venue name (partial match supported)
        venue_id: Search by exact venue ID
    """
    conn = get_db()
    try:
        if venue_id:
            venue = conn.execute("""
                SELECT v.*, n.name AS neighborhood
                FROM venues v LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
                WHERE v.id = ?
            """, [venue_id]).fetchone()
        elif venue_name:
            venue = conn.execute("""
                SELECT v.*, n.name AS neighborhood
                FROM venues v LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
                WHERE LOWER(v.name) LIKE ? AND v.is_active = 1
                ORDER BY v.google_rating DESC NULLS LAST LIMIT 1
            """, [f"%{venue_name.lower()}%"]).fetchone()
        else:
            return json.dumps({"error": "Provide venue_name or venue_id"})

        if not venue:
            return json.dumps({"error": f"Venue not found: {venue_name or venue_id}"})

        result = row_to_dict(venue)
        deal_rows = conn.execute("""
            SELECT * FROM deals WHERE venue_id = ? AND is_active = 1
            ORDER BY quality_score DESC
        """, [result["id"]]).fetchall()
        result["deals"] = [row_to_dict(dr) for dr in deal_rows]
        return json.dumps(result, default=str)
    finally:
        conn.close()


@mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False})
def get_chicago_neighborhoods(
    zone: Optional[str] = None,
) -> str:
    """List Chicago neighborhoods with deal counts. Use to discover available areas.

    Args:
        zone: Optional filter: "city", "north_shore", "northwest_suburbs",
              "western_suburbs", "south_suburbs"
    """
    conn = get_db()
    try:
        sql = """
            SELECT n.*,
                   (SELECT COUNT(*) FROM deals d
                    JOIN venues v ON d.venue_id = v.id
                    WHERE v.neighborhood_id = n.id AND d.is_active = 1) AS active_deal_count
            FROM neighborhoods n
        """
        params = []
        if zone:
            sql += " WHERE n.zone = ?"
            params.append(zone.lower())
        sql += " ORDER BY active_deal_count DESC, n.name"

        rows = conn.execute(sql, params).fetchall()
        return json.dumps({
            "neighborhoods": [row_to_dict(r) for r in rows],
            "count": len(rows),
        }, default=str)
    finally:
        conn.close()


@mcp.tool(annotations={"destructiveHint": False, "idempotentHint": False, "openWorldHint": False})
def submit_deal_tip(
    venue_name: str,
    deal_description: str,
    source: Optional[str] = None,
) -> str:
    """Submit a new deal tip for review. Works for user-submitted or agent-discovered deals.

    Args:
        venue_name: Name of the restaurant or bar
        deal_description: Description of the deal (e.g., "$1 oysters Mon-Thu 4-6pm")
        source: Where you found it (URL, "instagram", "walked by", etc.)
    """
    try:
        _check_submit_rate()
        venue_name, deal_description, source = _validate_submit(
            venue_name, deal_description, source
        )
    except SubmitRejected as e:
        return json.dumps({"status": "rejected", "error": str(e)})

    conn = get_db()
    try:
        cursor = conn.execute("""
            INSERT INTO submissions (
                venue_name_raw, deal_description_raw, source_url, status
            ) VALUES (?, ?, ?, 'pending')
        """, [venue_name, deal_description, source])
        conn.commit()
        return json.dumps({
            "submission_id": cursor.lastrowid,
            "status": "pending",
            "message": f"Submitted: {venue_name} — {deal_description}",
        })
    finally:
        conn.close()


@mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False})
def chicago_deal_of_the_day() -> str:
    """Get today's featured deal — the highest quality score deal active today.

    No parameters needed. Returns the single best deal for the current day of the week.
    """
    today = get_today()
    conn = get_db()
    try:
        row = conn.execute("""
            SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
                   v.latitude, v.longitude, v.address, v.cuisine_type,
                   n.name AS neighborhood
            FROM deals d
            JOIN venues v ON d.venue_id = v.id
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE d.is_active = 1 AND v.is_active = 1
              AND (d.days_available LIKE ? OR d.is_all_day = 1)
            ORDER BY d.quality_score DESC, d.best_savings_pct DESC NULLS LAST
            LIMIT 1
        """, [f'%"{today}"%']).fetchone()

        if not row:
            return json.dumps({"deal": None, "message": "No featured deal for today"})
        return json.dumps({"deal": row_to_dict(row), "day": today}, default=str)
    finally:
        conn.close()


@mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False})
def chicago_chain_deals(
    brand: Optional[str] = None,
    app_only: bool = False,
    limit: int = 25,
) -> str:
    """Get national chain deals available in Chicago (McDonald's, Chipotle, etc.).

    Args:
        brand: Chain brand slug filter (e.g., "mcdonalds", "chipotle", "starbucks")
        app_only: Only show app-exclusive deals
        limit: Max results (default 25)
    """
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
    params.append(min(limit, 100))

    conn = get_db()
    try:
        rows = conn.execute(sql, params).fetchall()
        return json.dumps({
            "deals": [row_to_dict(r) for r in rows],
            "count": len(rows),
        }, default=str)
    finally:
        conn.close()


@mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False})
def plan_chicago_deal_crawl(
    neighborhood: str,
    budget: Optional[str] = None,
    hours: float = 3.0,
    group_size: int = 2,
    preferences: Optional[str] = None,
) -> str:
    """Plan a multi-stop deal crawl through a Chicago neighborhood.

    Returns an ordered list of stops with deals, estimated savings, and timing.
    Great for planning a night out hitting multiple happy hours.

    Args:
        neighborhood: Starting neighborhood (e.g., "West Loop", "Wicker Park")
        budget: Budget level: "$", "$$", "$$$", "$$$$"
        hours: Hours available for the crawl (1-8, default 3)
        group_size: Number of people (1-20, default 2)
        preferences: Comma-separated preferences (e.g., "cocktails, oysters, tacos")
    """
    hours = max(1.0, min(hours, 8.0))
    group_size = max(1, min(group_size, 20))
    today = get_today()

    # Query deals in this neighborhood for today
    sql = """
        SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
               v.latitude, v.longitude, v.cuisine_type, v.address,
               v.price_level, v.is_chain, v.google_rating,
               n.name AS neighborhood, n.slug AS neighborhood_slug
        FROM deals d
        JOIN venues v ON d.venue_id = v.id
        LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
        WHERE d.is_active = 1 AND v.is_active = 1
          AND (LOWER(n.name) LIKE ? OR LOWER(n.slug) LIKE ?)
          AND (d.days_available LIKE ? OR d.is_all_day = 1)
        ORDER BY d.quality_score DESC NULLS LAST
        LIMIT 20
    """
    pattern = f"%{neighborhood.lower()}%"
    params = [pattern, pattern, f'%"{today}"%']

    conn = get_db()
    try:
        rows = conn.execute(sql, params).fetchall()
        deals = [row_to_dict(r) for r in rows]
    finally:
        conn.close()

    if not deals:
        return json.dumps({
            "crawl": [],
            "message": f"No active deals found in {neighborhood} for today ({today})",
        })

    # Filter by budget
    if budget:
        BUDGET_PRICE_CAPS = {"$": 10, "$$": 20, "$$$": 40, "$$$$": 999}
        BUDGET_TO_PRICE_LEVEL = {"$": 1, "$$": 2, "$$$": 3, "$$$$": 4}
        max_item_price = BUDGET_PRICE_CAPS.get(budget, 999)
        max_price_level = BUDGET_TO_PRICE_LEVEL.get(budget, 4)
        filtered = []
        for d in deals:
            items = (d.get("food_items") or []) + (d.get("drink_items") or [])
            prices = [i.get("deal_price") for i in items if isinstance(i, dict) and i.get("deal_price")]
            if prices:
                if sum(prices) / len(prices) <= max_item_price:
                    filtered.append(d)
            elif d.get("price_level") is not None:
                if d["price_level"] <= max_price_level:
                    filtered.append(d)
            else:
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

    total_savings = sum(
        (d.get("estimated_savings_per_person") or 0) * group_size
        for d in crawl
    )

    return json.dumps({
        "crawl": crawl,
        "stops": len(crawl),
        "neighborhood": neighborhood,
        "estimated_savings": round(total_savings, 2),
        "group_size": group_size,
        "hours": hours,
    }, default=str)


# ============================================================
# WORKFLOW TOOLS (multi-step compound queries)
# ============================================================

@mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False})
def find_best_deal_now(
    category: Optional[str] = None,
    zone: Optional[str] = None,
) -> str:
    """Find the single best deal happening right now based on current day and time.

    Compares quality scores and time windows to recommend the optimal deal.
    Call with no arguments for the overall best, or filter by category/zone.

    Args:
        category: Deal category: "food", "drinks", "both" (default: "both")
        zone: Geographic zone: "city", "north_shore", "northwest_suburbs",
              "western_suburbs", "south_suburbs"
    """
    today = get_today()
    now = datetime.now()
    current_time = now.strftime("%H:%M")

    conn = get_db()
    try:
        sql = """
            SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
                   v.latitude, v.longitude, v.address, v.cuisine_type,
                   v.google_rating, n.name AS neighborhood, n.slug AS neighborhood_slug,
                   n.zone
            FROM deals d
            JOIN venues v ON d.venue_id = v.id
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE d.is_active = 1 AND v.is_active = 1
              AND (d.days_available LIKE ? OR d.is_all_day = 1)
        """
        params = [f'%"{today}"%']

        if zone:
            sql += " AND n.zone = ?"
            params.append(zone.lower())

        sql += " ORDER BY d.quality_score DESC NULLS LAST LIMIT 50"
        rows = conn.execute(sql, params).fetchall()
        deals = [row_to_dict(r) for r in rows]
    finally:
        conn.close()

    # Filter by time window
    active_now = []
    for d in deals:
        start = d.get("start_time")
        end = d.get("end_time")
        if start and end:
            if start <= current_time <= end:
                active_now.append(d)
        elif d.get("is_all_day"):
            active_now.append(d)
        else:
            active_now.append(d)  # No time info = assume available

    # Filter by category
    if category and category != "both":
        filtered = []
        for d in active_now:
            has_food = bool(d.get("food_items"))
            has_drinks = bool(d.get("drink_items"))
            if category == "food" and has_food:
                filtered.append(d)
            elif category == "drinks" and has_drinks:
                filtered.append(d)
        active_now = filtered if filtered else active_now

    best = active_now[0] if active_now else None
    return json.dumps({
        "best_deal": best,
        "alternatives": active_now[1:4],
        "day": today,
        "time": current_time,
        "total_active": len(active_now),
    }, default=str)


@mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False})
def compare_neighborhoods(
    neighborhoods: str,
) -> str:
    """Compare 2-3 Chicago neighborhoods side by side.

    Shows deal counts, top deal types, average savings, venue counts,
    and top-rated venues for each neighborhood.

    Args:
        neighborhoods: Comma-separated neighborhood names (2-3), e.g. "West Loop, Wicker Park, Lincoln Park"
    """
    names = [n.strip() for n in neighborhoods.split(",")][:3]
    if len(names) < 2:
        return json.dumps({"error": "Provide at least 2 neighborhoods separated by commas"})

    conn = get_db()
    try:
        comparisons = []
        for name in names:
            pattern = f"%{name.lower()}%"

            # Get neighborhood info
            nhood = conn.execute("""
                SELECT n.id, n.name, n.slug, n.zone
                FROM neighborhoods n
                WHERE LOWER(n.name) LIKE ? OR LOWER(n.slug) LIKE ?
                LIMIT 1
            """, [pattern, pattern]).fetchone()

            if not nhood:
                comparisons.append({"name": name, "error": "Neighborhood not found"})
                continue

            nid = nhood["id"]

            # Deal stats
            stats = conn.execute("""
                SELECT
                    COUNT(*) AS deal_count,
                    COUNT(DISTINCT d.venue_id) AS venue_count,
                    AVG(d.best_savings_pct) AS avg_savings_pct,
                    GROUP_CONCAT(DISTINCT d.deal_type) AS deal_types
                FROM deals d
                JOIN venues v ON d.venue_id = v.id
                WHERE v.neighborhood_id = ? AND d.is_active = 1
            """, [nid]).fetchone()

            # Top venues by rating
            top_venues = conn.execute("""
                SELECT v.name, v.google_rating, v.cuisine_type,
                       COUNT(d.id) AS deal_count
                FROM venues v
                LEFT JOIN deals d ON d.venue_id = v.id AND d.is_active = 1
                WHERE v.neighborhood_id = ? AND v.is_active = 1
                GROUP BY v.id
                ORDER BY v.google_rating DESC NULLS LAST
                LIMIT 5
            """, [nid]).fetchall()

            comparisons.append({
                "name": nhood["name"],
                "slug": nhood["slug"],
                "zone": nhood["zone"],
                "deal_count": stats["deal_count"],
                "venue_count": stats["venue_count"],
                "avg_savings_pct": round(stats["avg_savings_pct"] or 0, 1),
                "deal_types": (stats["deal_types"] or "").split(","),
                "top_venues": [
                    {"name": v["name"], "rating": v["google_rating"],
                     "cuisine": v["cuisine_type"], "deals": v["deal_count"]}
                    for v in top_venues
                ],
            })

        return json.dumps({"comparisons": comparisons}, default=str)
    finally:
        conn.close()


@mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False})
def weekly_deals_digest() -> str:
    """Get a curated weekly digest of deals — new additions, expiring soon, and top picks.

    No parameters needed. Returns the best deals organized by category for the current week.
    """
    today = get_today()
    conn = get_db()
    try:
        # Top deals by quality score (this week's best)
        top_deals = conn.execute("""
            SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
                   v.cuisine_type, n.name AS neighborhood
            FROM deals d
            JOIN venues v ON d.venue_id = v.id
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE d.is_active = 1 AND v.is_active = 1
            ORDER BY d.quality_score DESC NULLS LAST
            LIMIT 5
        """).fetchall()

        # Today's deals
        todays_deals = conn.execute("""
            SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
                   v.cuisine_type, n.name AS neighborhood
            FROM deals d
            JOIN venues v ON d.venue_id = v.id
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE d.is_active = 1 AND v.is_active = 1
              AND (d.days_available LIKE ? OR d.is_all_day = 1)
            ORDER BY d.quality_score DESC NULLS LAST
            LIMIT 5
        """, [f'%"{today}"%']).fetchall()

        # Highest savings
        best_savings = conn.execute("""
            SELECT d.*, v.name AS venue_name, v.slug AS venue_slug,
                   v.cuisine_type, n.name AS neighborhood
            FROM deals d
            JOIN venues v ON d.venue_id = v.id
            LEFT JOIN neighborhoods n ON v.neighborhood_id = n.id
            WHERE d.is_active = 1 AND v.is_active = 1
              AND d.best_savings_pct IS NOT NULL
            ORDER BY d.best_savings_pct DESC
            LIMIT 5
        """).fetchall()

        # Overall stats
        stats = conn.execute("""
            SELECT
                COUNT(*) AS total_deals,
                COUNT(DISTINCT d.venue_id) AS total_venues,
                ROUND(AVG(d.best_savings_pct), 1) AS avg_savings
            FROM deals d
            JOIN venues v ON d.venue_id = v.id
            WHERE d.is_active = 1 AND v.is_active = 1
        """).fetchone()

        return json.dumps({
            "week_of": str(date.today()),
            "day": today,
            "stats": {
                "total_deals": stats["total_deals"],
                "total_venues": stats["total_venues"],
                "avg_savings_pct": stats["avg_savings"],
            },
            "top_picks": [row_to_dict(r) for r in top_deals],
            "todays_deals": [row_to_dict(r) for r in todays_deals],
            "best_savings": [row_to_dict(r) for r in best_savings],
        }, default=str)
    finally:
        conn.close()


# ============================================================
# ENTRYPOINT
# ============================================================

if __name__ == "__main__":
    mcp.run()
