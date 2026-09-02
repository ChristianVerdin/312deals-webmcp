"""Homepage freshness surfaces need a quality floor, not just recency.

Three homepage components sort by `recently_updated`, which orders on
`d.updated_at DESC` — so the newest deal wins regardless of how usable it is.
That was harmless while 70% of the corpus sat at the hardcoded quality_score 40
(the score carried no information). Now that scores are real, the fresh pool
splits sharply:

    70+   "$7 glasses of select wines Mon-Fri 4-7pm"      <- actionable
    <35   "Crazy Puffs(R) Crave Combo"                    <- chain merch noise
          "Taco Bell Rewards: App-exclusive deals"

Measured 2026-08-19, 543 of 2,062 deals added in 48h scored under 35 — a quarter
of the fresh pool competing for homepage slots on equal footing with priced,
timed, day-scoped offers.

`min_quality` gates the pool so recency still RANKS within it. That ordering
matters: gating on recency instead would bury the evergreen corpus, which is the
trap recorded in feedback_freshness_deals_lack_quality_score.
"""

import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api.deals_api import app

client = TestClient(app)

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "chideals.db"


def _deals(**params):
    r = client.get("/api/v1/deals/search", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def _scores(deals):
    """Look scores up in the DB — the API redacts quality_score from responses.

    `row_to_dict` pops it (deals_api.py:138) because it is an internal ranking
    signal, so asserting on the response body would pass vacuously against None.
    """
    ids = [d["id"] for d in deals]
    if not ids:
        return []
    con = sqlite3.connect(DB_PATH)
    rows = con.execute(
        f"SELECT quality_score FROM deals WHERE id IN ({','.join('?' * len(ids))})",
        ids,
    ).fetchall()
    con.close()
    return [r[0] for r in rows]


class TestMinQualityFilter:
    def test_absent_by_default(self):
        """Every existing caller must be untouched when the param is omitted."""
        assert _deals(limit=5)["total"] >= _deals(limit=5, min_quality=70)["total"]

    def test_filters_out_low_quality(self):
        floor = 60
        scores = _scores(_deals(limit=50, min_quality=floor)["deals"])
        assert scores, "no deals returned; cannot assert the floor holds"
        assert all(s >= floor for s in scores), f"below floor: {[s for s in scores if s < floor]}"

    def test_higher_floor_actually_narrows_the_pool(self):
        totals = [_deals(limit=1, min_quality=q)["total"] for q in (0, 35, 60, 85)]
        assert totals == sorted(totals, reverse=True), totals
        assert totals[0] > totals[-1], "floor had no effect at all"

    def test_composes_with_sort_and_other_filters(self):
        """The floor must narrow the pool without breaking ordering or filters."""
        body = _deals(limit=10, min_quality=50, sort="recently_updated",
                      deal_type="happy_hour")
        assert body["deals"], "no happy_hour deals above the floor"
        for d in body["deals"]:
            assert d["deal_type"] == "happy_hour"
        assert all(s >= 50 for s in _scores(body["deals"]))

    @pytest.mark.parametrize("bad", [-1, 101])
    def test_out_of_range_is_rejected(self, bad):
        assert client.get("/api/v1/deals/search",
                          params={"min_quality": bad}).status_code == 422

    def test_zero_floor_is_a_noop(self):
        """0 must mean 'no floor', not 'exclude NULLs'."""
        assert _deals(limit=1, min_quality=0)["total"] == _deals(limit=1)["total"]
