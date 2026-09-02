"""Weekday landing pages must not be copies of one another.

`?day=monday` intentionally also returns deals with no day data — right for a
"what's on today" view, wrong for a landing page. Measured 2026-08-10, the five
generic weekday pages (/deals/monday-deals, wednesday-, thursday-, friday-,
saturday-) were **97.5% identical**, so Google collapsed them into /deals: it
ranked /deals 13.3 for "monday food deals" (442 impressions) while
/deals/monday-deals sat at 13.2 with 4. The purpose-built page ranked as well —
it was just almost never shown.

`day_strict` drops the undated fallback and `max_days` keeps only day-SPECIFIC
deals; together they take the overlap to ~1%, matching /deals/taco-tuesday
(2.5% similar to the others, position 6.2, 721 clicks) — the one weekday page
that already works, because its `query: "taco"` differentiates it.

Both params default off, so every existing caller is untouched.
"""
import itertools

from fastapi.testclient import TestClient

from src.api import deals_api

client = TestClient(deals_api.app)
DAYS = ["monday", "wednesday", "thursday", "friday", "saturday"]


def _ids(**params) -> set:
    params.setdefault("limit", 200)
    r = client.get("/api/v1/deals/search", params=params)
    assert r.status_code == 200, r.text
    return {d["id"] for d in r.json()["deals"]}


def _avg_overlap(sets: dict) -> float:
    js = [
        len(sets[a] & sets[b]) / max(1, len(sets[a] | sets[b]))
        for a, b in itertools.combinations(sets, 2)
    ]
    return sum(js) / len(js)


class TestDefaultsUnchanged:
    """day_strict/max_days are opt-in; omitting them must change nothing."""

    def test_day_filter_still_admits_undated_deals(self):
        loose = client.get("/api/v1/deals/search", params={"day": "monday", "limit": 1}).json()["total"]
        strict = client.get(
            "/api/v1/deals/search", params={"day": "monday", "day_strict": "true", "limit": 1}
        ).json()["total"]
        assert loose > strict, "default day filter must remain the permissive one"

    def test_search_without_day_is_unaffected(self):
        r = client.get("/api/v1/deals/search", params={"deal_type": "happy_hour", "limit": 5})
        assert r.status_code == 200 and r.json()["total"] > 0

    def test_day_today_still_works(self):
        r = client.get("/api/v1/deals/search", params={"day": "today", "limit": 5})
        assert r.status_code == 200 and r.json()["total"] > 0


class TestDayStrict:
    def test_every_returned_deal_names_the_day(self):
        r = client.get(
            "/api/v1/deals/search",
            params={"day": "monday", "day_strict": "true", "limit": 100},
        )
        deals = r.json()["deals"]
        assert deals, "expected some strictly-matched Monday deals"
        for d in deals:
            days = d.get("days_available") or []
            # The API returns a parsed list; tolerate a raw JSON string too.
            if isinstance(days, str):
                days = [days]
            assert any("monday" in str(x).lower() for x in days), d.get("days_available")

    def test_max_days_bounds_are_enforced(self):
        assert client.get("/api/v1/deals/search", params={"max_days": 0}).status_code == 422
        assert client.get("/api/v1/deals/search", params={"max_days": 8}).status_code == 422


class TestWeekdayPagesAreDistinct:
    """The regression this exists to prevent."""

    def test_default_filter_produces_near_duplicate_pages(self):
        sets = {d: _ids(day=d, deal_type="daily_special") for d in DAYS}
        assert _avg_overlap(sets) > 0.4, (
            "baseline changed — if the default day filter no longer over-matches, "
            "revisit whether dayStrict is still needed"
        )

    def test_strict_filter_makes_pages_distinct(self):
        sets = {
            d: _ids(day=d, deal_type="daily_special", day_strict="true", max_days=3)
            for d in DAYS
        }
        assert _avg_overlap(sets) < 0.10, f"weekday pages still overlap: {_avg_overlap(sets):.1%}"

    def test_each_weekday_page_keeps_usable_inventory(self):
        """Distinct is worthless if a page ends up empty."""
        for d in DAYS:
            total = client.get(
                "/api/v1/deals/search",
                params={"day": d, "deal_type": "daily_special",
                        "day_strict": "true", "max_days": 3, "limit": 1},
            ).json()["total"]
            assert total >= 100, f"{d} has only {total} day-specific deals"
