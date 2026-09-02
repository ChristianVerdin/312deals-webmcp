"""AI chat endpoint — Claude-powered Chicago deals assistant.

Uses Anthropic tool-use to query the 312Deals database and provide
personalized deal recommendations. Reuses MCP tool functions via the
hybrid approach: import existing logic, expose slim tool schemas, trim
output for chat context.

Endpoint:
    POST /api/v1/chat
"""

from __future__ import annotations

import asyncio
import contextvars
import hashlib
import json
import logging
import os
import re
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import anthropic
from fastapi import APIRouter, BackgroundTasks, Body, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from src.mcp_server.chideals_mcp import (
    deals_near_location as _deals_near_location,
    find_best_deal_now as _find_best_deal_now,
    get_venue_details as _get_venue_details,
    search_chicago_deals as _search_chicago_deals,
)
from src.api.langfuse_tracing import llm_trace_scope, set_request_context
from src.product_stats import STATS

# Resolve DB path relative to project root, matching the rest of the API.
_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "chideals.db"

router = APIRouter(prefix="/api/v1", tags=["chat"])
limiter = Limiter(key_func=get_remote_address)
log = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 5
# Model is env-configurable so Haiku/Sonnet can be A/B'd without a redeploy.
# Default stays Sonnet 4.6 (conservative); flip CHAT_MODEL only after the eval
# harness (scripts/eval_chat_models.py) confirms no time-window regression.
MODEL = os.environ.get("CHAT_MODEL", "claude-sonnet-4-6")
CHICAGO_TZ = ZoneInfo("America/Chicago")
_TRUTHY = {"1", "true", "yes", "on"}


# ── Request / Response models ─────────────────────────────

class ChatRequest(BaseModel):
    message: str
    conversation_history: list[dict[str, str]] = []
    # Optional fields for analytics — client generates a stable session_id
    # (UUID) and passes the entry-page referrer so we can attribute usage.
    session_id: str | None = None
    referrer: str | None = None


class DealReference(BaseModel):
    deal_id: int
    venue_name: str
    title: str
    neighborhood: str | None = None


class ChatResponse(BaseModel):
    response: str
    deals_referenced: list[DealReference] = []
    follow_up_suggestions: list[str] = []


# ── System prompt ─────────────────────────────────────────

def _current_time_line() -> str:
    """Volatile time context — kept OUT of the cached system block."""
    now = datetime.now(CHICAGO_TZ)
    return f"Current time: {now.strftime('%I:%M %p')} on {now.strftime('%A')} (Chicago time)"


# Large, static system instructions — cached via a cache_control breakpoint on
# every messages.create. The volatile time line is appended as a separate,
# uncached block (see _current_time_line / the chat() endpoint).
_STATIC_SYSTEM = f"""You are 312Deals' Chicago food & drink deals expert — a friendly, knowledgeable local who knows every happy hour, daily special, and brunch deal across the city and suburbs.

QUESTIONS ABOUT 312DEALS ITSELF — answer ONLY from the two lines below, and never
improvise beyond them. This surface is public and unattended, and on 2026-07-28 a
visitor arriving from a Twitter link asked how the deals were collected. With no
approved answer available the model invented one, claiming 312Deals scrapes
"Google Business profiles". The visitor correctly pointed out that this violates
Google's terms, and the model conceded. That was a fabricated admission of a
terms-of-service violation, about its own company, to a hostile questioner.

- HOW DEALS ARE SOURCED (the ONLY sourcing answer you may give): "Deals come from
  venues' own public channels — their websites and deals pages, email newsletters
  they publish, and deals submitted by venues and readers. Everything is
  re-checked on a schedule, and each deal shows when it was last verified."
  Do NOT name any vendor, scraper, API, platform or third-party service. Do NOT
  speculate about methods. If pressed for more detail than that paragraph, say it
  is not something you have and point them to the 312Deals team.
- ANY OTHER COMPANY QUESTION — staffing, traffic, revenue, funding, costs, tooling,
  roadmap, who runs it — you do not have it. Say so plainly and point them at the
  team. Never guess, never estimate, never reason aloud about what it might be.

What you know:
- {STATS.deals} active deals across {STATS.venues} venues in {STATS.neighborhoods} neighborhoods (52 city + 60+ active suburban)
- Deal types: happy hour, daily specials, brunch, late night, game day, chain app deals, loyalty rewards, seasonal/LTOs
- You can filter by patio/outdoor seating — use has_patio=true when users ask about patios, outdoor dining, rooftops, or al fresco
- You cover the city AND suburbs equally — Naperville, Evanston, Oak Park, etc. are not afterthoughts

GEOGRAPHIC CONTEXT — Use this to map user queries to the right neighborhoods/zones:

Chicago City Sides (informal regions — use multiple neighborhood searches or zone="city"):
- NORTH SIDE: Andersonville, Edgewater, Lakeview, Lincoln Park, Lincoln Square, North Center, Old Town, Ravenswood, Rogers Park, Roscoe Village, Uptown, Wrigleyville, Albany Park
- NORTHWEST SIDE: Avondale, Belmont Cragin, Edison Park, Portage Park
- WEST SIDE: Bucktown, Humboldt Park, Logan Square, Ukrainian Village, West Town, Wicker Park, Garfield Park, North Lawndale, Austin, Near West Side
- SOUTH SIDE: Bridgeport, Bronzeville, Chinatown, Hyde Park, Pilsen, South Loop, University Village, Pullman, Roseland, South Chicago, South Deering, East Side, Hegewisch, Chatham, Auburn Gresham, Woodlawn, Washington Park, Gage Park, Beverly, Mount Greenwood
- DOWNTOWN: The Loop, River North, Gold Coast, Streeterville, West Loop

Suburban Zones (use zone filter):
- NORTH SHORE (zone="north_shore"): Evanston, Highland Park, Lake Forest, Wilmette, Winnetka
- NORTHWEST SUBURBS (zone="northwest_suburbs"): Arlington Heights, Des Plaines, Mt. Prospect, Palatine, Park Ridge, Schaumburg
- WESTERN SUBURBS (zone="western_suburbs"): Naperville, Oak Park, Downers Grove, Elmhurst, Hinsdale, La Grange
- SOUTH SUBURBS (zone="south_suburbs"): Orland Park, Tinley Park, Homewood, Frankfort

County Mapping:
- Cook County: all city neighborhoods + Evanston, Wilmette, Winnetka, Arlington Heights, Des Plaines, Mt. Prospect, Palatine, Park Ridge, Schaumburg, Oak Park, Elmhurst, La Grange, Orland Park, Tinley Park, Homewood
- DuPage County: Naperville, Downers Grove, Hinsdale, Elmhurst (split)
- Lake County: Highland Park, Lake Forest
- Will County: Frankfort

Landmark & Venue Area Mapping:
- Wrigley Field / Cubs: Wrigleyville, Lakeview
- United Center / Bulls / Blackhawks: Near West Side, West Loop
- Soldier Field / Bears: South Loop
- Guaranteed Rate Field / White Sox: Bridgeport
- Magnificent Mile / Michigan Ave: Streeterville, Gold Coast, River North
- O'Hare Airport: Edison Park, Park Ridge, Des Plaines
- Midway Airport: Gage Park, Beverly
- Navy Pier: Streeterville
- University of Chicago: Hyde Park
- Northwestern University: Evanston
- Loyola University: Rogers Park, Edgewater
- DePaul University: Lincoln Park, The Loop
- UIC: University Village, Pilsen
- Illinois Institute of Technology: Bronzeville
- Millennium Park / Grant Park: The Loop
- Restaurant Row (Randolph St): West Loop
- Argyle Street (Little Saigon): Uptown
- Devon Avenue (Indian/Pakistani): Rogers Park, Edgewater
- 26th Street (Little Village/Mexican): Gage Park, Pilsen
- Chinatown: Chinatown

City vs Suburbs:
- "The city" / "in the city" / "Chicago proper" = zone "city" (56 neighborhoods)
- "The suburbs" / "suburban" = zones north_shore, northwest_suburbs, western_suburbs, south_suburbs (17 areas)

SEARCH STRATEGY for regional queries:
- For "south side" → ONE search_deals call with neighborhoods=["Bridgeport","Hyde Park","Pilsen","Bronzeville"] (use the neighborhoods array — never fire separate calls)
- For "north side" → ONE call with neighborhoods=["Lincoln Park","Lakeview","Andersonville","Lincoln Square"]
- For "suburbs" or a suburban zone → use the zone filter (e.g., zone="western_suburbs")
- For "near [landmark]" → pass the mapped neighborhoods above in the neighborhoods array
- For county queries (e.g., "Lake County") → one call with the neighborhoods array set to that county's neighborhoods

Rules:
- ALWAYS use search_deals before answering deal questions. Never make up deals.
- For regional queries (side/zone/county), pass all relevant neighborhoods together in the neighborhoods array (ONE call) — don't fire separate searches or pick just one.
- Reference specific deals with venue name, price, and times.
- Keep responses concise, 2-3 short paragraphs max. People are on their phones.
- Be enthusiastic about Chicago's food scene: deep dish, Italian beef, tacos, craft cocktails, neighborhood gems.
- NEVER use em dashes (—) anywhere in your responses. Use commas, colons, or periods instead. Em dashes read as AI-written and people dislike them.
- When mentioning a venue, include the neighborhood so people know where it is.
- Do NOT emit markdown links like `[Name](/url)` in your prose — the chat surface auto-renders a "MENTIONED · TAP TO VIEW VENUE" chip below your answer (built from the deals you reference), which gives the user a clickable path to the venue page. Inline markdown links would render as ugly raw brackets. Just bold the venue name with `**Name**` and let the chip handle the click.
- For "near me" or location-based questions, ask for a neighborhood or cross streets if no location is given.
- End with a brief follow-up nudge (don't list options, just hint at what else you can help with).

TIME WINDOW IS A HARD FILTER (read this every turn — production data shows you violate it):

The current time is at the top of this prompt. EVERY deal in your tool results includes a pre-computed `window` field — one of: "open now", "opens 5:00pm", "closed today", or "not today". USE IT — do not do the time math yourself. For any "tonight" / "right now" / "today" / "Active Now" query, recommend ONLY deals whose window is "open now" (or "opens …" within the next hour, which you may surface as "starts soon"). NEVER recommend a deal whose window is "closed today" or "not today" for these queries. For today/now queries those have ALREADY been removed from your results server-side — so if a deal isn't in your results, it genuinely isn't available now; don't invent or recall one.

Examples (assume current time = 7:45pm Wednesday):
- Deal: "Mon-Fri 5-7pm" → CLOSED at 7pm. NEVER recommend it as a current pick. You may mention it as "tomorrow's HH starts at 5pm at X" if relevant.
- Deal: "Wed-Sun 8-11pm" → starts in 15 min. Lead with it: "starts in 15 minutes at X."
- Deal: "Until 7pm tonight" → CLOSED. Same rule.
- Deal: "All day Wednesday" → ACTIVE. OK to recommend.
- Deal: "Mon-Fri 4-6pm" at 7:45pm Wednesday → CLOSED. Do not recommend.

This is non-negotiable. Recommending a happy hour that ended an hour ago is the single most damaging failure mode for this product — users walk into a bar expecting the deal and get full-price drinks. Treat closed-window deals like they don't exist for "tonight" queries.

For "tonight" / "right now" queries: if you'd otherwise recommend 3 venues but only 1 has an active window, only recommend that 1, and say so ("Only one happy hour still active at this hour — here's the pick"). Don't pad the response.

USER CONSTRAINTS ARE LAW — read this carefully:

When a user specifies any of these in their question, treat them as HARD filters that must be reflected in your search_deals call:
- A neighborhood / area / "I'm in X" → set neighborhood= or zone= accordingly
- A day or "today" / "tonight" / "right now" / "tomorrow" → set day=
- "Patio" / "outdoor" / "rooftop" / "al fresco" → set has_patio=true
- "Dog-friendly" / "bring my dog" / "pet-friendly patio" / "dogs allowed" → set dog_friendly_patio=true (and mention /guides/dog-friendly-patios-chicago)
- A deal type ("happy hour", "brunch", "late night") → set deal_type=
- A cuisine ("tacos", "sushi", "pizza") → set cuisine= OR query=
- A price ceiling ("under $10", "cheap", "$5 or less") → use this when filtering your final picks (the API doesn't filter on price, but you must drop venues whose only matching item exceeds the user's cap)

ALWAYS run your FIRST search_deals call with ALL user-specified constraints intact. Never silently drop a constraint to "broaden" the search.

If the strict search returns 0 deals, RELAX ONE filter at a time in this priority order (least-important first), and SAY OUT LOUD what you relaxed and why so the user knows:
1. price ceiling (e.g., "under $10" — relax first because users are flexible on price)
2. deal_type (e.g., "happy hour" → drop type filter — sometimes a daily special hits the same need)
3. day (e.g., "tonight" → check tomorrow's options if today's are weak)
4. has_patio (e.g., "patio" — only relax if the user said something like "or indoor is fine")
5. neighborhood (this is the LAST one to relax — when a user says "I'm in Wicker Park", they don't want results in River North without you saying "I couldn't find any in Wicker Park, but here are the closest neighborhoods…")

When you relax a constraint, OPEN your reply with one short sentence telling the user what you relaxed. Examples:
- "Nothing strict-fit in Wicker Park tonight under $10, but here are 3 patio happy hours nearby in Logan Square and Bucktown."
- "No Wednesday-night brunch (brunch is mostly weekends), but here are 3 strong weekend brunch picks in Lincoln Park."

NEVER return cross-neighborhood results without acknowledging the relaxation. NEVER drop the day filter for a "tonight" / "today" query without telling the user you're showing alternatives.

When the user gives a price ceiling, post-filter your picks: only recommend venues whose drink_items or food_items contain at least one entry priced ≤ ceiling. If no venue qualifies, say so explicitly and offer the cheapest you found instead.

Response shape — keep it tight and scannable:
- START WITH THE ANSWER. Never open with a preamble about the tool results or
  your own plan. Banned openers: "Great data.", "Great results!", "Great haul!",
  "Perfect, now let me...", "Now let me focus on...", "Let me identify...",
  "From the results:". The user sees only your reply, not your reasoning, so a
  planning paragraph reads as the bot talking to itself.
- Write TO the user, never ABOUT them. Never say "the user is asking", "the user
  wants", "I should recommend". Say "you".
- NEVER name internal data fields in prose. The user does not know what
  drink_items, food_items, deal_type, days_available or quality_score are. Say
  "the listing doesn't show food specials", not "food_items is empty".
- DEFAULT: 3 venue picks per response. If user explicitly asks for "top 5" / "5 best", do exactly 5.
- ABSOLUTE MAX: 5 venues. Never list more.
- ALWAYS lead with a single bolded top recommendation — the ONE place you'd send a friend if they could only go to one. Match the label to WHEN the user is asking about, and never claim "tonight" for a day that is not today:
  - asking about today / right now → "**Tonight's pick:**" or "**Right now:**"
  - asking about a future day → name it: "**Thursday's pick:**", "**Saturday's pick:**"
  - no day implied → "**Top pick:**"
- After the lead pick, list 2-4 alternatives as separate paragraphs (not numbered lists, not bulleted lists). Each alt: bold venue name, then the deal in plain prose, then any time/price detail.
- ONE deal per venue. If a venue has multiple deals, pick the most relevant ONE and mention it. Never list two deals from the same venue in the same response.
- NO emoji-section-headers like "🆕 MOST RECENTLY UPDATED" / "🔥 GREAT OPTIONS TODAY" / "✅ FRESH & VERIFIED" — they're noisy. Keep it conversational.
- NO category labels in ALL CAPS. Keep typography clean.

Formatting markers — REQUIRED for proper rendering:
- BETWEEN each recommendation paragraph, put a separator line consisting of three dashes on its own line:

    Right now: **Big Star** in Wicker Park has $2.95 tacos...

    ---

    **Bloom** in Wicker Park does creative bundles...

    ---

    **Seoul Ta** in Lakeview offers $1.50 tacos...

  The frontend renders "---" as a thin divider line between picks. DO NOT use any other separator (no "***", no "===", no blank-line-only).
- DO NOT add a divider before your closing follow-up nudge or after the last recommendation.

At the END of your response, on its own line, output a SUGGESTED_FOLLOWUPS block with 1-3 questions tailored to YOUR specific recommendations. Format:

    SUGGESTED_FOLLOWUPS:
    - Want late-night options near Wicker Park?
    - Looking for food pairings with those drinks?
    - Show me tomorrow's Tuesday-specific specials?

Rules for follow-ups:
- 1-3 questions only (3 is the max — don't pad).
- Reference SPECIFICS from your response (a neighborhood you mentioned, a deal-type you cited, a logical next step like "tomorrow's deals" if today's are passed).
- Phrase them as the user would ask them (first-person from user's POV, ending in "?").
- Don't repeat the closing nudge in your prose. The closing nudge in prose is for friendliness; the SUGGESTED_FOLLOWUPS block is for the UI buttons.
- Make them DIFFERENT from each other — three angles, not three rewordings.

Length guideline: a good response is ~80-150 words for the prose part (excluding the followups block). Anything longer is overwhelming on mobile.

Time-of-day awareness — never recommend a deal whose window has already passed today:
- The current time is provided at the top of this prompt. Compare against deal start_time / end_time / days_available.
- If a deal's window has CLOSED for today (e.g., Mon-Fri 4-6pm and it's now 7pm Mon), do NOT include it in your top picks. Mention it only as "tomorrow's pick" if relevant.
- If a deal is "Active Now" — always lead with it.
- If a deal starts within the next 60 minutes — call that out: "starts in 35 minutes at..."
- For "tonight" or "right now" queries, hard-filter expired-today deals out of your response entirely.

De-duplicate within a session:
- If you've already recommended a venue earlier in this conversation, don't surface the same venue's deal again unless the user explicitly asks for the same thing. Vary the options.
- For chain venues with multiple locations (Taco Bell, Domino's, etc.), recommend at most ONE location per response. Pick the one closest to the user's neighborhood interest.

Freshness — use these fields when users ask about "recent", "latest", "updated", "still active", or "fresh" deals:
- updated_at: when the deal row was last modified (e.g., "3d ago", "2w ago", "yesterday")
- last_checked_at: when we last re-scraped the source page to confirm the deal is still posted
- verified_at: when the deal was last AI-verified as still active

Sorting/answering rules:
- "Most recent" or "latest" deals → sort by updated_at (most recent first)
- "Still active" or "is this current" → check last_checked_at; anything within 14d is fresh, 14-90d is stale-but-likely-valid, >90d should be flagged as "double-check before going"
- When the user asks "what date" or "exact date" or "specifically when", use the real timestamp, not just relative ("Roost — updated April 13, 2026"). When they just ask "when", relative ("2w ago") is fine.
- Default trust: if updated_at is within 30 days, treat as current. Beyond that, mention "may want to confirm" but still recommend.
- NEVER claim "I don't have access to update dates" — you do, in the updated_at and last_checked_at fields on every deal."""


# ── Anthropic tool schemas (slim) ─────────────────────────

TOOLS = [
    {
        "name": "search_deals",
        "description": (
            "Search the Chicago deals database. Returns food & drink deals "
            "matching filters. Always try this first. Use broad searches if "
            "specific filters return no results."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "neighborhood": {
                    "type": "string",
                    "description": "Single neighborhood name (e.g., 'West Loop', 'Lincoln Park', 'Naperville')",
                },
                "neighborhoods": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Multiple neighborhoods searched together in ONE call. Use this for regional queries instead of separate searches — e.g. for 'south side' pass [\"Bridgeport\",\"Pilsen\",\"Hyde Park\",\"Bronzeville\"]; for 'north side' pass [\"Lincoln Park\",\"Lakeview\",\"Andersonville\"]. Results are merged and de-duplicated.",
                },
                "day": {
                    "type": "string",
                    "enum": ["today", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                    "description": "Day of week to check. Use 'today' for current day.",
                },
                "deal_type": {
                    "type": "string",
                    "enum": ["happy_hour", "daily_special", "brunch_deal", "late_night", "game_day", "chain_app_deal", "loyalty_reward", "seasonal_lto"],
                    "description": "Type of deal",
                },
                "cuisine": {
                    "type": "string",
                    "description": "Cuisine filter (e.g., 'mexican', 'italian', 'sushi', 'pizza')",
                },
                "query": {
                    "type": "string",
                    "description": "Free-text search (e.g., 'oysters', 'half off wings', 'margarita')",
                },
                "zone": {
                    "type": "string",
                    "enum": ["city", "north_shore", "northwest_suburbs", "western_suburbs", "south_suburbs"],
                    "description": "Geographic zone filter. Use for suburban zones or to limit to city-only results.",
                },
                "has_patio": {
                    "type": "boolean",
                    "description": "Filter to venues with patio/outdoor seating. Use when user asks about patios, outdoor dining, al fresco, rooftop, etc.",
                },
                "dog_friendly_patio": {
                    "type": "boolean",
                    "description": "Filter to venues with a dog-friendly patio. Use when the user asks about bringing a dog, dog-friendly, pet-friendly, or 'patio I can bring my dog to'.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 10)",
                    "default": 10,
                },
            },
            "required": [],
        },
    },
    {
        "name": "deals_nearby",
        "description": (
            "Find deals near a specific location using coordinates. "
            "Use when the user mentions a specific address or intersection."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "lat": {
                    "type": "number",
                    "description": "Latitude coordinate",
                },
                "lng": {
                    "type": "number",
                    "description": "Longitude coordinate",
                },
                "radius_miles": {
                    "type": "number",
                    "description": "Search radius in miles (default 1.5)",
                    "default": 1.5,
                },
            },
            "required": ["lat", "lng"],
        },
    },
    {
        "name": "venue_details",
        "description": "Get full details for a specific venue including all its active deals. Use when a user asks about a particular restaurant or bar.",
        "input_schema": {
            "type": "object",
            "properties": {
                "venue_name": {
                    "type": "string",
                    "description": "Name of the venue to look up (partial match supported)",
                },
            },
            "required": ["venue_name"],
        },
    },
    {
        "name": "best_deal_now",
        "description": "Find the single best deal happening right now based on current day and time. Good for 'what should I get right now?' questions.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["food", "drinks", "both"],
                    "description": "Filter by food, drinks, or both (default: both)",
                },
                "zone": {
                    "type": "string",
                    "enum": ["city", "north_shore", "northwest_suburbs", "western_suburbs", "south_suburbs"],
                    "description": "Geographic zone filter",
                },
            },
            "required": [],
        },
        # cache_control on the LAST tool caches the whole tools array prefix.
        "cache_control": {"type": "ephemeral"},
    },
]


# ── Time-window status (the #1 quality fix) ───────────────
#
# Every deal returned to the model is annotated with a pre-computed `window` so the
# model never has to do error-prone time math (its documented failure mode). For
# today/now queries we ALSO hard-drop already-closed and not-today deals server-side,
# so a closed deal can't be recommended at all. The active-now signal is per-request
# via a contextvar (set in the endpoints, propagates into asyncio.to_thread).

_active_now_ctx: contextvars.ContextVar[bool] = contextvars.ContextVar("chat_active_now", default=False)

_TODAY_SIGNALS = (
    " right now", "active now", "open now", "still open", "happening now",
    "currently", " now ", " now?", " now.", "tonight", " today", "this evening",
    "what's open", "whats open", "going on now", "open right now",
)


def _is_today_query(text: str) -> bool:
    t = f" {text.lower().strip()} "
    return any(s in t for s in _TODAY_SIGNALS)


def _fmt_min(mins: int) -> str:
    h, m = divmod(mins, 60)
    ap = "am" if h < 12 else "pm"
    hh = h % 12 or 12
    return f"{hh}:{m:02d}{ap}" if m else f"{hh}{ap}"


def _compute_window(deal: dict) -> str:
    """Open/closed status for THIS deal at the current Chicago time.

    Returns one of: "open now", "opens H:MMpm", "closed today", "not today".
    """
    now = datetime.now(CHICAGO_TZ)
    today = now.strftime("%A").lower()
    days = deal.get("days_available")
    days_l = [str(d).lower() for d in days] if isinstance(days, list) else []
    all_day = bool(deal.get("is_all_day"))
    available_today = all_day or (not days_l) or (today in days_l)
    if not available_today:
        return "not today"
    if all_day or (not deal.get("start_time") and not deal.get("end_time")):
        return "open now"

    def _to_min(t):
        try:
            parts = str(t).split(":")
            return int(parts[0]) * 60 + int(parts[1])
        except Exception:
            return None

    cur = now.hour * 60 + now.minute
    s = _to_min(deal.get("start_time"))
    e = _to_min(deal.get("end_time"))
    if s is not None and cur < s:
        return f"opens {_fmt_min(s)}"
    if e is not None and cur > e:
        return "closed today"
    return "open now"


# ── Trim tool results for chat context ────────────────────

_DEAL_KEEP_FIELDS = {
    "venue_name", "venue_slug", "title", "description", "deal_type", "address",
    "neighborhood", "days_available", "start_time", "end_time",
    "is_all_day", "best_deal_item", "best_savings_pct",
    "food_items", "drink_items", "quality_score", "distance_miles",
    "google_rating", "cuisine_type", "id",
    # Freshness — let Claude answer "when was this updated?" honestly
    "updated_at", "last_checked_at", "verified_at",
}


def _format_relative_age(iso_str: str | None) -> str | None:
    """Convert an ISO timestamp to a compact relative-age string.

    Saves tokens vs. raw timestamps and lets Claude answer freshness
    questions naturally ("verified 3 days ago" instead of parsing dates).
    """
    if not iso_str:
        return None
    try:
        # Handle SQLite's "YYYY-MM-DD HH:MM:SS" and ISO formats
        ts = datetime.fromisoformat(iso_str.replace("Z", "+00:00").replace(" ", "T"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=CHICAGO_TZ)
        delta = datetime.now(CHICAGO_TZ) - ts
        days = delta.days
        if days < 0:
            return "just now"
        if days == 0:
            hours = delta.seconds // 3600
            if hours == 0:
                return f"{delta.seconds // 60}m ago"
            return f"{hours}h ago"
        if days == 1:
            return "yesterday"
        if days < 7:
            return f"{days}d ago"
        if days < 30:
            return f"{days // 7}w ago"
        if days < 365:
            return f"{days // 30}mo ago"
        return f"{days // 365}y ago"
    except (ValueError, TypeError):
        return None


def _trim_deal(deal: dict) -> dict:
    """Keep only chat-relevant fields from a deal dict."""
    trimmed = {k: v for k, v in deal.items() if k in _DEAL_KEEP_FIELDS}
    trimmed["window"] = _compute_window(deal)  # pre-computed open/closed status

    # Slim down food/drink items to just name + deal_price
    for key in ("food_items", "drink_items"):
        items = trimmed.get(key)
        if isinstance(items, list):
            trimmed[key] = [
                {"name": i["name"], "deal_price": i.get("deal_price")}
                for i in items
                if isinstance(i, dict) and i.get("name")
            ]

    # Replace raw timestamps with "{relative} ({YYYY-MM-DD})" so Claude
    # can answer both "when" (relative) and "what date" (absolute) without
    # needing the full ISO string.
    for key in ("updated_at", "last_checked_at", "verified_at"):
        raw = trimmed.get(key)
        if not raw:
            trimmed.pop(key, None)
            continue
        relative = _format_relative_age(raw)
        if not relative:
            trimmed.pop(key, None)
            continue
        # Extract YYYY-MM-DD from "2026-04-13 14:23:01" or ISO format
        date_part = str(raw)[:10] if str(raw)[:10].count("-") == 2 else None
        trimmed[key] = f"{relative} ({date_part})" if date_part else relative

    return trimmed


def _trim_for_chat(tool_name: str, raw_json: str) -> str:
    """Parse MCP tool output and strip fields Claude doesn't need for chat."""
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        return raw_json

    if tool_name == "search_deals":
        deals = [_trim_deal(d) for d in data.get("deals", [])]
        if _active_now_ctx.get():
            deals = [d for d in deals if d.get("window") not in ("closed today", "not today")]
        return json.dumps({"deals": deals, "count": len(deals)})

    if tool_name == "deals_nearby":
        deals = [_trim_deal(d) for d in data.get("deals", [])]
        if _active_now_ctx.get():
            deals = [d for d in deals if d.get("window") not in ("closed today", "not today")]
        return json.dumps({
            "deals": deals,
            "count": len(deals),
            "radius_miles": data.get("radius_miles"),
        })

    if tool_name == "venue_details":
        if "error" in data:
            return raw_json
        venue_fields = {
            "name", "slug", "address", "neighborhood", "cuisine_type",
            "google_rating", "phone", "website_url",
        }
        trimmed = {k: v for k, v in data.items() if k in venue_fields}
        trimmed["deals"] = [_trim_deal(d) for d in data.get("deals", [])]
        return json.dumps(trimmed)

    if tool_name == "best_deal_now":
        best = data.get("best_deal")
        alts = data.get("alternatives", [])
        return json.dumps({
            "best_deal": _trim_deal(best) if best else None,
            "alternatives": [_trim_deal(d) for d in alts],
            "day": data.get("day"),
            "time": data.get("time"),
        })

    return raw_json


# ── Tool dispatch ─────────────────────────────────────────

def _run_tool(tool_name: str, tool_input: dict) -> str:
    """Call the MCP function and return trimmed JSON."""
    if tool_name == "search_deals":
        # Multi-neighborhood: one regional query instead of N sequential rounds.
        hoods = tool_input.get("neighborhoods")
        if isinstance(hoods, list) and hoods:
            merged: dict = {}
            per = max(4, int(tool_input.get("limit", 10) or 10))
            for h in hoods[:6]:
                try:
                    sub = json.loads(_search_chicago_deals(
                        neighborhood=h, day=tool_input.get("day"),
                        deal_type=tool_input.get("deal_type"), cuisine=tool_input.get("cuisine"),
                        query=tool_input.get("query"), has_patio=tool_input.get("has_patio"),
                        dog_friendly_patio=tool_input.get("dog_friendly_patio"), limit=per,
                    ))
                except Exception:
                    continue
                for d in sub.get("deals", []):
                    if d.get("id") not in merged:
                        merged[d["id"]] = d
            return _trim_for_chat(
                "search_deals",
                json.dumps({"deals": list(merged.values()), "count": len(merged)}),
            )
        raw = _search_chicago_deals(
            neighborhood=tool_input.get("neighborhood"),
            day=tool_input.get("day"),
            deal_type=tool_input.get("deal_type"),
            cuisine=tool_input.get("cuisine"),
            query=tool_input.get("query"),
            zone=tool_input.get("zone"),
            has_patio=tool_input.get("has_patio"),
            dog_friendly_patio=tool_input.get("dog_friendly_patio"),
            limit=tool_input.get("limit", 10),
        )
        return _trim_for_chat("search_deals", raw)

    if tool_name == "deals_nearby":
        raw = _deals_near_location(
            lat=tool_input.get("lat"),
            lng=tool_input.get("lng"),
            radius_miles=tool_input.get("radius_miles", 1.5),
        )
        return _trim_for_chat("deals_nearby", raw)

    if tool_name == "venue_details":
        raw = _get_venue_details(venue_name=tool_input.get("venue_name"))
        return _trim_for_chat("venue_details", raw)

    if tool_name == "best_deal_now":
        raw = _find_best_deal_now(
            category=tool_input.get("category"),
            zone=tool_input.get("zone"),
        )
        return _trim_for_chat("best_deal_now", raw)

    return json.dumps({"error": f"Unknown tool: {tool_name}"})


# ── Deal reference extraction ─────────────────────────────

# Visual cap on deal cards rendered below the AI message. Tool results
# can return 20-50 deals; users only need the AI's actual picks.
_MAX_DEAL_REFS = 5


def _extract_deal_references(tool_calls: list[dict], reply_text: str = "") -> list[DealReference]:
    """Pull deal info from tool results, dedupe BY VENUE, cap at 5.

    Strategy:
    1. Collect every unique deal across all tool calls
    2. Group by venue_name — multiple deals at the same venue collapse
       into the single most-relevant deal (highest quality_score, then
       freshest updated_at)
    3. Prefer venues the AI actually mentioned in its reply text
    4. Cap to _MAX_DEAL_REFS total
    """
    # Step 1: collect unique deals by deal_id
    by_id: dict[int, dict] = {}
    for call in tool_calls:
        try:
            data = json.loads(call["result"])
        except (json.JSONDecodeError, KeyError):
            continue

        deals: list[dict] = []
        deals.extend(data.get("deals", []))
        if data.get("best_deal"):
            deals.append(data["best_deal"])
        deals.extend(data.get("alternatives", []))

        for deal in deals:
            did = deal.get("id")
            if did and did not in by_id:
                by_id[did] = deal

    if not by_id:
        return []

    # Step 2: group by venue_name (case-insensitive)
    by_venue: dict[str, list[dict]] = {}
    for deal in by_id.values():
        venue_key = (deal.get("venue_name") or "").strip().lower()
        if not venue_key:
            continue
        by_venue.setdefault(venue_key, []).append(deal)

    # Step 3: pick the single best deal per venue
    def _deal_rank(d: dict) -> tuple[int, str]:
        """Higher quality first, then freshest updated_at."""
        return (
            -int(d.get("quality_score") or 0),
            # _trim_deal already rewrote updated_at to "{relative} ({YYYY-MM-DD})"
            # The date suffix sorts naturally alphabetically (YYYY-MM-DD desc → newest first)
            "9" * 20 if not d.get("updated_at") else d["updated_at"],
        )

    best_per_venue: list[dict] = []
    for venue_deals in by_venue.values():
        venue_deals.sort(key=_deal_rank)
        best_per_venue.append(venue_deals[0])

    # Step 4: ONLY include venues the AI text actually cites.
    # (Earlier behavior padded with unmentioned deals up to _MAX_DEAL_REFS,
    # which surfaced wrong-day deals — e.g., a Friday-only deal showing up
    # on a Wednesday "tonight" query.)
    reply_lower = reply_text.lower() if reply_text else ""

    def _ai_mentioned(d: dict) -> bool:
        venue = (d.get("venue_name") or "").lower().strip()
        return bool(venue) and venue in reply_lower

    mentioned = [d for d in best_per_venue if _ai_mentioned(d)]
    mentioned.sort(key=_deal_rank)

    refs: list[DealReference] = []
    for deal in mentioned[:_MAX_DEAL_REFS]:
        did = deal.get("id")
        if not did:
            continue
        refs.append(DealReference(
            deal_id=did,
            venue_name=deal.get("venue_name", ""),
            title=deal.get("title", ""),
            neighborhood=deal.get("neighborhood"),
        ))

    return refs


# ── Follow-up suggestions ─────────────────────────────────

import re as _re

_FOLLOWUPS_RE = _re.compile(
    r"\n*SUGGESTED[_ ]?FOLLOWUPS\s*:\s*\n((?:[-•*]\s*.+\n?)+)",
    _re.IGNORECASE,
)


def _parse_followups_from_reply(reply_text: str) -> tuple[str, list[str]]:
    """Extract Claude's SUGGESTED_FOLLOWUPS block from the reply.

    Returns (cleaned_reply_text, suggestions). If no block is present,
    suggestions is an empty list and the original text is returned.
    """
    if not reply_text:
        return reply_text, []
    match = _FOLLOWUPS_RE.search(reply_text)
    if not match:
        return reply_text.strip(), []
    block = match.group(1)
    suggestions: list[str] = []
    for line in block.splitlines():
        clean = _re.sub(r"^[-•*]\s*", "", line.strip())
        if clean:
            suggestions.append(clean)
    cleaned_text = _FOLLOWUPS_RE.sub("", reply_text).strip()
    return cleaned_text, suggestions[:3]


_DEFAULT_SUGGESTIONS = [
    "What are the best happy hours today?",
    "Any good brunch deals this weekend?",
    "Show me deals in the West Loop",
]


def _generate_follow_ups(message: str, deals_found: bool) -> list[str]:
    """Generate contextual follow-up suggestions."""
    suggestions: list[str] = []
    msg = message.lower()

    if "happy hour" in msg or "drink" in msg:
        suggestions.append("Any food deals to pair with those drinks?")
    if "brunch" in msg:
        suggestions.append("What about late-night spots for after dinner?")
    if "group" in msg or "friends" in msg:
        suggestions.append("Want deals that work well for larger groups?")
    if any(w in msg for w in ("cheap", "budget", "under")):
        suggestions.append("Want to see chain app deals? They're usually the cheapest.")
    if "italian" in msg or "pizza" in msg or "pasta" in msg:
        suggestions.append("Want to try Mexican or Asian spots in that area too?")
    if any(w in msg for w in ("downtown", "loop", "river north")):
        suggestions.append("Want to check nearby neighborhoods like West Loop or Old Town?")
    if "suburb" in msg or "naperville" in msg or "evanston" in msg:
        suggestions.append("Want to compare deals across a few suburban areas?")
    if any(w in msg for w in ("south side", "south loop", "bridgeport", "hyde park", "pilsen", "bronzeville")):
        suggestions.append("Want to explore more South Side neighborhoods?")
    if any(w in msg for w in ("north side", "lakeview", "andersonville", "lincoln square")):
        suggestions.append("Want to see deals in other North Side spots?")
    if any(w in msg for w in ("west side", "logan square", "humboldt", "bucktown")):
        suggestions.append("Want to check out more West Side neighborhoods?")
    if any(w in msg for w in ("wrigley", "cubs", "united center", "bulls", "blackhawks", "bears", "soldier field", "sox", "guaranteed rate")):
        suggestions.append("Want pre-game or post-game specials nearby?")

    if not suggestions:
        if deals_found:
            suggestions = [
                "Want to explore a different neighborhood?",
                "Looking for a specific type of food?",
            ]
        else:
            suggestions = _DEFAULT_SUGGESTIONS[:2]

    return suggestions[:3]


# ── Main endpoint ─────────────────────────────────────────

_CLIENT: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    """Module singleton — reuse the httpx connection pool / TLS across requests."""
    global _CLIENT
    if _CLIENT is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        _CLIENT = anthropic.Anthropic(api_key=api_key)
    return _CLIENT


def _detect_deal_type(text: str) -> str:
    """Mirror of the client-side detectDealType() — same canonical buckets."""
    if not text:
        return "general"
    t = text.lower()
    if any(w in t for w in ("taco", "$1 taco")):
        return "taco_tuesday"
    if "wing" in t:
        return "wing_deals"
    if any(w in t for w in ("happy hour", "after-work", "after work", "drink special", "cocktail")):
        return "happy_hour"
    if any(w in t for w in ("brunch", "mimosa", "bottomless")):
        return "brunch_deals"
    if any(w in t for w in ("late night", "after hours", "2am", "3am", "4am")):
        return "late_night"
    if any(w in t for w in ("game day", "cubs", "sox", "bears", "bulls", "wrigley", "united center", "soldier field", "blackhawks")):
        return "game_day"
    if any(w in t for w in ("patio", "outdoor", "rooftop")):
        return "patio"
    if any(w in t for w in ("chain", "drive-thru", "drive thru", "app deal", "fast food")):
        return "chain_deals"
    return "general"


# ── Single-shot pre-fetch (Phase 3A) ──────────────────────
#
# For simple, unambiguous queries we run ONE search server-side and inject it as a
# completed tool turn before the first Claude call, so the model answers in a single
# (streamed) call instead of spending a round on a tool request. Tools stay available,
# so if the pre-fetch guessed wrong the model just searches again — strictly ≤ the
# current latency, never worse. Gated by CHAT_PREFETCH (default on) and skipped for
# regional/landmark/relative queries where the model's richer geo-mapping wins.

_HOODS_CACHE: list[str] | None = None


def _known_hoods() -> list[str]:
    """Distinct neighborhood names (lowercased, longest-first), loaded once."""
    global _HOODS_CACHE
    if _HOODS_CACHE is None:
        out: list[str] = []
        try:
            with sqlite3.connect(_DB_PATH, timeout=2.0) as conn:
                for (name,) in conn.execute("SELECT DISTINCT name FROM neighborhoods WHERE name IS NOT NULL"):
                    if name and len(name) >= 4:
                        out.append(name.lower())
        except Exception:
            out = []
        out.sort(key=len, reverse=True)
        _HOODS_CACHE = out
    return _HOODS_CACHE


# detect_deal_type bucket → search_deals param. taco/wing have no deal_type enum,
# so they map to a free-text query; patio maps to the has_patio flag.
_DEALTYPE_TO_PARAM: dict[str, tuple[str, object]] = {
    "happy_hour": ("deal_type", "happy_hour"),
    "brunch_deals": ("deal_type", "brunch_deal"),
    "late_night": ("deal_type", "late_night"),
    "game_day": ("deal_type", "game_day"),
    "chain_deals": ("deal_type", "chain_app_deal"),
    "taco_tuesday": ("query", "tacos"),
    "wing_deals": ("query", "wings"),
    "patio": ("has_patio", True),
}

# Signals that the query needs the model's geo reasoning (multi-hood regions,
# landmarks, relative location) — skip the single-hood pre-fetch for these.
_PREFETCH_SKIP = (
    "south side", "north side", "west side", "east side", "north shore",
    " near ", " around ", " by ", "nearby", "close to", "walking distance",
    "suburb", "downtown", "the city", "county", "airport", "wrigley",
    "united center", "soldier field", "navy pier", "magnificent mile", "mag mile",
    "university", "loyola", "depaul", " uic", "northwestern", " near me",
)


def _extract_search_params(text: str) -> dict | None:
    """Confident, conservative constraint extraction for the pre-fetch. None = skip."""
    t = f" {text.lower().strip()} "
    if any(s in t for s in _PREFETCH_SKIP):
        return None

    params: dict = {}
    for h in _known_hoods():
        if f" {h} " in t or f" {h}?" in t or f" {h}," in t or f" {h}." in t:
            params["neighborhood"] = h
            break

    bucket = _detect_deal_type(text)
    if bucket in _DEALTYPE_TO_PARAM:
        k, v = _DEALTYPE_TO_PARAM[bucket]
        params[k] = v

    if any(w in t for w in (" tonight ", " today ", " right now ", " now ")):
        params["day"] = "today"
    else:
        for d in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"):
            if f" {d} " in t:
                params["day"] = d
                break

    if any(w in t for w in (" patio ", " outdoor ", " rooftop ", " outside ", " al fresco ")):
        params["has_patio"] = True

    if not (params.get("neighborhood") or params.get("deal_type") or params.get("query") or params.get("has_patio")):
        return None
    params["limit"] = 12
    return params


def _prime_messages(messages: list[dict], text: str) -> tuple[list[dict], dict | None]:
    """Inject a completed search turn for simple queries. Returns (messages, prefetch_call)."""
    if os.environ.get("CHAT_PREFETCH", "true").strip().lower() not in _TRUTHY:
        return messages, None
    params = _extract_search_params(text)
    if not params:
        return messages, None
    try:
        raw = _run_tool("search_deals", params)
        if not json.loads(raw).get("deals"):
            return messages, None  # nothing found — let the model search its own way
    except Exception:
        return messages, None
    primed = messages + [
        {"role": "assistant", "content": [
            {"type": "tool_use", "id": "prefetch_0", "name": "search_deals", "input": params}]},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "prefetch_0", "content": raw}]},
    ]
    return primed, {"name": "search_deals", "input": params, "result": raw}


# ── Result cache (Phase 4) ────────────────────────────────
#
# In-process TTL cache of final responses for repeated single-turn queries
# ("happy hours today", "taco tuesday near me"). Key = normalized query + Chicago
# day+HOUR bucket, so time-sensitive answers naturally expire each hour (a 4pm and
# 5pm "tonight" answer never collide) and the TTL caps staleness from deal changes.
# Only single-turn queries are cached (multi-turn answers depend on prior context).
# Gated by CHAT_CACHE (default on). On a hit the LLM is skipped entirely (~50ms).

_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = float(os.environ.get("CHAT_CACHE_TTL", "1800"))  # 30 min
_CACHE_MAX = 500


def _cache_enabled() -> bool:
    return os.environ.get("CHAT_CACHE", "true").strip().lower() in _TRUTHY


def _normalize_q(text: str) -> str:
    t = re.sub(r"[^\w\s$]", " ", text.lower())  # keep $ (prices); drop other punctuation
    return re.sub(r"\s+", " ", t).strip()


def _cache_key(req: ChatRequest) -> str | None:
    if req.conversation_history:  # only cache stateless, single-turn queries
        return None
    norm = _normalize_q(req.message)
    if not norm:
        return None
    bucket = datetime.now(CHICAGO_TZ).strftime("%Y%m%d%H")  # day + hour
    return hashlib.sha1(f"{bucket}|{norm}".encode()).hexdigest()


def _cache_get(key: str | None) -> dict | None:
    if not key or not _cache_enabled():
        return None
    entry = _CACHE.get(key)
    if not entry:
        return None
    exp, val = entry
    if time.time() > exp:
        _CACHE.pop(key, None)
        return None
    return val


def _cache_put(key: str | None, value: dict) -> None:
    if not key or not _cache_enabled() or not value.get("response"):
        return
    if len(_CACHE) >= _CACHE_MAX:  # evict the soonest-to-expire fifth
        for k in sorted(_CACHE, key=lambda k: _CACHE[k][0])[: _CACHE_MAX // 5]:
            _CACHE.pop(k, None)
    _CACHE[key] = (time.time() + _CACHE_TTL, value)


def _log_chat_turn(
    *,
    session_id: str | None,
    turn: int,
    role: str,
    content: str,
    deal_type_detected: str | None = None,
    tools_used: list[str] | None = None,
    deals_referenced: int = 0,
    response_time_ms: int | None = None,
    error: str | None = None,
    referrer: str | None = None,
) -> None:
    """Insert a single chat-turn row. Best-effort — never blocks the response."""
    try:
        with sqlite3.connect(_DB_PATH, timeout=2.0) as conn:
            conn.execute(
                """
                INSERT INTO chat_logs (
                    session_id, turn, role, content,
                    deal_type_detected, tools_used,
                    deals_referenced, response_time_ms, error, referrer
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id or "anon",
                    turn,
                    role,
                    content[:8000],  # cap content size; chat replies stay well under this
                    deal_type_detected,
                    json.dumps(tools_used) if tools_used else None,
                    deals_referenced,
                    response_time_ms,
                    error,
                    referrer,
                ),
            )
    except Exception as e:
        # Logging must never break the user-facing chat. Swallow + log.
        log.warning("Failed to write chat_log: %s", e)


_FALLBACK_RESPONSE = ChatResponse(
    response=(
        "I'm having trouble connecting right now, but you can still find deals! "
        "Try searching by neighborhood — West Loop, Lincoln Park, and Wicker Park "
        "have the most options. Or check out today's Deal of the Day on the homepage."
    ),
    deals_referenced=[],
    follow_up_suggestions=[
        "Browse deals in the West Loop",
        "Show me today's best deals",
        "What neighborhoods have the most deals?",
    ],
)


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, background_tasks: BackgroundTasks, req: ChatRequest = Body(...)):
    """AI-powered deal recommendations using Claude with tool use."""

    # Build conversation messages
    messages: list[dict] = []
    for msg in req.conversation_history:
        role = msg.get("role", "user")
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": msg.get("content", "")})
    messages.append({"role": "user", "content": req.message})
    _active_now_ctx.set(_is_today_query(req.message))

    # Phase 4: serve repeated single-turn queries from cache (skips the LLM pipeline).
    cache_key = _cache_key(req)
    _cached = _cache_get(cache_key)
    if _cached is not None:
        _ut = sum(1 for m in req.conversation_history if m.get("role") == "user") + 1
        _dt = _detect_deal_type(req.message)
        background_tasks.add_task(_log_chat_turn, session_id=req.session_id, turn=_ut, role="user",
                                  content=req.message, deal_type_detected=_dt, referrer=req.referrer)
        background_tasks.add_task(_log_chat_turn, session_id=req.session_id, turn=_ut, role="assistant",
                                  content=_cached["response"], deal_type_detected=_dt, tools_used=["cache_hit"],
                                  deals_referenced=len(_cached.get("deals_referenced", [])),
                                  response_time_ms=0, referrer=req.referrer)
        return ChatResponse(**_cached)

    # System prompt as cacheable blocks: the large static instructions carry a
    # cache_control breakpoint; the volatile time line stays uncached after it.
    system_prompt = [
        {"type": "text", "text": _STATIC_SYSTEM, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": _current_time_line()},
    ]
    all_tool_calls: list[dict] = []

    # Phase 3A: pre-fetch a likely search so simple queries answer in one call
    # (tools stay available, so a wrong guess just falls back to the agentic loop).
    messages, _prefetch = _prime_messages(messages, req.message)
    if _prefetch:
        all_tool_calls.append(_prefetch)

    # Turn count = (existing user messages in history) + 1 for this incoming
    user_turn = sum(1 for m in req.conversation_history if m.get("role") == "user") + 1
    deal_type_detected = _detect_deal_type(req.message)

    # Attribute the auto-instrumented LLM generations to this request/session.
    set_request_context(
        session_id=req.session_id,
        referrer=req.referrer,
        intent=deal_type_detected,
        turn=user_turn,
    )

    # Log the user message off the hot path (best-effort; never blocks the reply).
    background_tasks.add_task(
        _log_chat_turn,
        session_id=req.session_id,
        turn=user_turn,
        role="user",
        content=req.message,
        deal_type_detected=deal_type_detected,
        referrer=req.referrer,
    )

    started_at = time.perf_counter()
    try:
        with llm_trace_scope(req.message, MODEL):
            client = _get_client()

            # Tool-use loop: Claude calls tools, we execute, feed results back
            response = None
            for _round in range(MAX_TOOL_ROUNDS):
                response = client.messages.create(
                    model=MODEL,
                    max_tokens=1024,
                    system=system_prompt,
                    tools=TOOLS,
                    messages=messages,
                    timeout=30.0,
                )

                if response.stop_reason != "tool_use":
                    break

                # Append assistant message with all content blocks
                messages.append({"role": "assistant", "content": response.content})

                # Execute each tool call
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result_str = _run_tool(block.name, block.input)
                        all_tool_calls.append({
                            "name": block.name,
                            "input": block.input,
                            "result": result_str,
                        })
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result_str,
                        })

                messages.append({"role": "user", "content": tool_results})

            # If we exhausted rounds and Claude still wants tools, force a text response
            if response and response.stop_reason == "tool_use":
                messages.append({"role": "assistant", "content": response.content})
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result_str = _run_tool(block.name, block.input)
                        all_tool_calls.append({
                            "name": block.name,
                            "input": block.input,
                            "result": result_str,
                        })
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result_str,
                        })
                messages.append({"role": "user", "content": tool_results})

                response = client.messages.create(
                    model=MODEL,
                    max_tokens=1024,
                    system=system_prompt,
                    messages=messages,
                    timeout=30.0,
                    # No tools — forces text
                )

            # Extract final text — if the last response has no text (Claude put
            # its answer in an earlier tool_use turn), scan backwards through
            # assistant messages in the conversation to find it.
            reply_text = ""
            if response:
                for block in response.content:
                    if hasattr(block, "text"):
                        reply_text += block.text

            if not reply_text.strip() and all_tool_calls:
                # The final response was empty — Claude's text was in an
                # intermediate turn. Ask for a summary with no tools available.
                response = client.messages.create(
                    model=MODEL,
                    max_tokens=1024,
                    system=system_prompt,
                    messages=messages,
                    timeout=30.0,
                )
                reply_text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        reply_text += block.text

            # Parse Claude-generated follow-ups from the reply BEFORE extracting
            # deal references (so the dedup logic doesn't get confused by the
            # SUGGESTED_FOLLOWUPS block as text).
            reply_text, ai_follow_ups = _parse_followups_from_reply(reply_text)

            deal_refs = _extract_deal_references(all_tool_calls, reply_text=reply_text)
            # Prefer Claude's tailored follow-ups; fall back to keyword-based
            # generator only if Claude didn't include them.
            follow_ups = ai_follow_ups or _generate_follow_ups(req.message, bool(deal_refs))

            background_tasks.add_task(
                _log_chat_turn,
                session_id=req.session_id,
                turn=user_turn,
                role="assistant",
                content=reply_text,
                deal_type_detected=deal_type_detected,
                tools_used=[c["name"] for c in all_tool_calls],
                deals_referenced=len(deal_refs),
                response_time_ms=int((time.perf_counter() - started_at) * 1000),
                referrer=req.referrer,
            )

            _cache_put(cache_key, {
                "response": reply_text,
                "deals_referenced": [d.model_dump() for d in deal_refs],
                "follow_up_suggestions": follow_ups,
            })
            return ChatResponse(
                response=reply_text,
                deals_referenced=deal_refs,
                follow_up_suggestions=follow_ups,
            )

    except RuntimeError as e:
        log.warning("Chat unavailable: %s", e)
        _log_chat_turn(
            session_id=req.session_id, turn=user_turn, role="assistant",
            content=_FALLBACK_RESPONSE.response, deal_type_detected=deal_type_detected,
            response_time_ms=int((time.perf_counter() - started_at) * 1000),
            error=f"runtime: {e}", referrer=req.referrer,
        )
        return _FALLBACK_RESPONSE

    except anthropic.APITimeoutError:
        log.warning("Claude API timeout on chat request")
        _log_chat_turn(
            session_id=req.session_id, turn=user_turn, role="assistant",
            content="", deal_type_detected=deal_type_detected,
            response_time_ms=int((time.perf_counter() - started_at) * 1000),
            error="timeout", referrer=req.referrer,
        )
        return ChatResponse(
            response=(
                "That took a bit too long — let me try again! In the meantime, "
                "the West Loop and Lincoln Park have tons of happy hour deals today. "
                "Try browsing by neighborhood while I warm up."
            ),
            deals_referenced=[],
            follow_up_suggestions=["Browse West Loop deals", "Show today's specials"],
        )

    except anthropic.APIError as e:
        log.error("Claude API error: %s", e)
        _log_chat_turn(
            session_id=req.session_id, turn=user_turn, role="assistant",
            content=_FALLBACK_RESPONSE.response, deal_type_detected=deal_type_detected,
            response_time_ms=int((time.perf_counter() - started_at) * 1000),
            error=f"api: {e}", referrer=req.referrer,
        )
        return _FALLBACK_RESPONSE

    except Exception as e:
        log.exception("Unexpected error in chat endpoint")
        _log_chat_turn(
            session_id=req.session_id, turn=user_turn, role="assistant",
            content=_FALLBACK_RESPONSE.response, deal_type_detected=deal_type_detected,
            response_time_ms=int((time.perf_counter() - started_at) * 1000),
            error=f"unexpected: {e}"[:500], referrer=req.referrer,
        )
        return _FALLBACK_RESPONSE


# ── Streaming endpoint (SSE) ──────────────────────────────
#
# Same tool-use pipeline as POST /chat, but streamed over Server-Sent Events so
# the user sees motion immediately instead of a ~10s blank spinner:
#   - {"type":"status","text":...}  during the tool loop ("Searching West Loop…")
#   - {"type":"delta","text":...}   the final answer, token-by-token
#   - {"type":"done", deals_referenced, follow_up_suggestions}  terminal payload
#   - {"type":"error"}              → client falls back to POST /chat
# The non-streaming /chat endpoint above stays the canonical API + fallback.

_ACLIENT: anthropic.AsyncAnthropic | None = None


def _aget_client() -> anthropic.AsyncAnthropic:
    """Async singleton — non-blocking streaming without stalling the event loop."""
    global _ACLIENT
    if _ACLIENT is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        _ACLIENT = anthropic.AsyncAnthropic(api_key=api_key)
    return _ACLIENT


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _status_for_tool(name: str, tool_input: dict) -> str:
    """Human-friendly progress line for a tool call (shown during the loop)."""
    if name == "search_deals":
        if tool_input.get("neighborhood"):
            return f"Searching {tool_input['neighborhood']}…"
        if tool_input.get("zone"):
            return f"Searching the {str(tool_input['zone']).replace('_', ' ')}…"
        if tool_input.get("query"):
            return f"Searching for {tool_input['query']}…"
        if tool_input.get("cuisine"):
            return f"Finding {tool_input['cuisine']} spots…"
        return "Searching deals…"
    if name == "deals_nearby":
        return "Finding deals nearby…"
    if name == "venue_details":
        return f"Looking up {tool_input.get('venue_name', 'that spot')}…"
    if name == "best_deal_now":
        return "Finding the best deal right now…"
    return "Checking…"


_FOLLOWUPS_MARKER = "SUGGESTED_FOLLOWUPS"


async def _chat_stream_gen(req: ChatRequest):
    """Async SSE generator mirroring chat()'s tool loop, streaming the final text."""
    messages: list[dict] = []
    for msg in req.conversation_history:
        role = msg.get("role", "user")
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": msg.get("content", "")})
    messages.append({"role": "user", "content": req.message})
    _active_now_ctx.set(_is_today_query(req.message))

    system_prompt = [
        {"type": "text", "text": _STATIC_SYSTEM, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": _current_time_line()},
    ]
    all_tool_calls: list[dict] = []
    user_turn = sum(1 for m in req.conversation_history if m.get("role") == "user") + 1
    deal_type_detected = _detect_deal_type(req.message)

    # Phase 4 cache — serve repeats instantly, skip the pipeline entirely.
    cache_key = _cache_key(req)
    _cached = _cache_get(cache_key)
    if _cached is not None:
        asyncio.create_task(asyncio.to_thread(
            _log_chat_turn, session_id=req.session_id, turn=user_turn, role="user",
            content=req.message, deal_type_detected=deal_type_detected, referrer=req.referrer))
        asyncio.create_task(asyncio.to_thread(
            _log_chat_turn, session_id=req.session_id, turn=user_turn, role="assistant",
            content=_cached["response"], deal_type_detected=deal_type_detected,
            tools_used=["cache_hit"], deals_referenced=len(_cached.get("deals_referenced", [])),
            response_time_ms=0, referrer=req.referrer))
        yield _sse({"type": "delta", "text": _cached["response"]})
        yield _sse({"type": "done", "deals_referenced": _cached.get("deals_referenced", []),
                    "follow_up_suggestions": _cached.get("follow_up_suggestions", [])})
        return

    # Phase 3A pre-fetch (off the event loop — _prime_messages does blocking DB I/O).
    messages, prefetch_call = await asyncio.to_thread(_prime_messages, messages, req.message)
    if prefetch_call:
        all_tool_calls.append(prefetch_call)

    set_request_context(
        session_id=req.session_id, referrer=req.referrer,
        intent=deal_type_detected, turn=user_turn,
    )
    # User-message log — fire-and-forget on a worker thread.
    asyncio.create_task(asyncio.to_thread(
        _log_chat_turn, session_id=req.session_id, turn=user_turn, role="user",
        content=req.message, deal_type_detected=deal_type_detected, referrer=req.referrer,
    ))

    started_at = time.perf_counter()
    clean_text = ""   # final answer text forwarded to the client (pre-followups)
    full_text = ""    # full final-answer text incl. the followups block

    try:
        client = _aget_client()
        with llm_trace_scope(req.message, MODEL):
            yield _sse({"type": "status", "text": "Thinking…"})
            if prefetch_call:
                yield _sse({"type": "status", "text": _status_for_tool("search_deals", prefetch_call["input"])})

            for _round in range(MAX_TOOL_ROUNDS):
                # Per-round text accumulation: only the FINAL (no-tool) round's
                # text is the answer; tool-round preamble (rare) is reset away.
                full_text = ""
                clean_text = ""
                cut = False
                async with client.messages.stream(
                    model=MODEL, max_tokens=1024, system=system_prompt,
                    tools=TOOLS, messages=messages,
                ) as stream:
                    async for event in stream:
                        if (event.type == "content_block_delta"
                                and getattr(event.delta, "type", "") == "text_delta"):
                            full_text += event.delta.text
                            if cut:
                                continue
                            idx = full_text.find(_FOLLOWUPS_MARKER)
                            visible = full_text[:idx] if idx != -1 else full_text
                            if idx != -1:
                                cut = True
                            new = visible[len(clean_text):]
                            if new:
                                clean_text = visible
                                yield _sse({"type": "delta", "text": new})
                    final = await stream.get_final_message()

                if final.stop_reason != "tool_use":
                    break

                messages.append({"role": "assistant", "content": final.content})
                tool_results = []
                for block in final.content:
                    if block.type == "tool_use":
                        yield _sse({"type": "status", "text": _status_for_tool(block.name, block.input)})
                        result_str = await asyncio.to_thread(_run_tool, block.name, block.input)
                        all_tool_calls.append({"name": block.name, "input": block.input, "result": result_str})
                        tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": result_str})
                messages.append({"role": "user", "content": tool_results})

            # Recovery: model ended on tools or produced no text — force a plain
            # synthesis (no tools) and emit it as one delta.
            if not full_text.strip():
                recover = await client.messages.create(
                    model=MODEL, max_tokens=1024, system=system_prompt, messages=messages,
                )
                full_text = "".join(getattr(b, "text", "") for b in recover.content)
                vis, _ = _parse_followups_from_reply(full_text)
                if vis and not clean_text:
                    clean_text = vis
                    yield _sse({"type": "delta", "text": vis})

        clean_reply, ai_follow_ups = _parse_followups_from_reply(full_text)
        deal_refs = _extract_deal_references(all_tool_calls, reply_text=clean_reply)
        follow_ups = ai_follow_ups or _generate_follow_ups(req.message, bool(deal_refs))

        _deal_dicts = [d.model_dump() for d in deal_refs]
        _cache_put(cache_key, {"response": clean_reply, "deals_referenced": _deal_dicts,
                               "follow_up_suggestions": follow_ups})

        yield _sse({
            "type": "done",
            "deals_referenced": _deal_dicts,
            "follow_up_suggestions": follow_ups,
        })

        asyncio.create_task(asyncio.to_thread(
            _log_chat_turn,
            session_id=req.session_id, turn=user_turn, role="assistant",
            content=clean_reply, deal_type_detected=deal_type_detected,
            tools_used=[c["name"] for c in all_tool_calls], deals_referenced=len(deal_refs),
            response_time_ms=int((time.perf_counter() - started_at) * 1000),
            referrer=req.referrer,
        ))

    except Exception as e:
        log.warning("chat stream error: %s", e)
        asyncio.create_task(asyncio.to_thread(
            _log_chat_turn,
            session_id=req.session_id, turn=user_turn, role="assistant", content=clean_text,
            deal_type_detected=deal_type_detected,
            response_time_ms=int((time.perf_counter() - started_at) * 1000),
            error=f"stream: {e}"[:500], referrer=req.referrer,
        ))
        # Tell the client to fall back to the non-streaming endpoint.
        yield _sse({"type": "error"})


@router.post("/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(request: Request, req: ChatRequest = Body(...)):
    """Streaming (SSE) variant of /chat. Falls back client-side to /chat on error."""
    return StreamingResponse(
        _chat_stream_gen(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
