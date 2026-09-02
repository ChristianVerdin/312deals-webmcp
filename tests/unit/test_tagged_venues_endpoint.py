"""Endpoint tests for the generic /api/v1/venues/tagged/{tag} roster.

Read-only against the local DB (no writes, no network). world_cup_2026 has an
existing tagged population (~520 venues); bears_2026 may be empty before its
first tagging run — both must return the full response shape.
"""
from fastapi.testclient import TestClient

from src.api import deals_api

client = TestClient(deals_api.app)

SHAPE_KEYS = {"tag", "venues", "count", "neighborhoods", "neighborhood_count", "deal_count"}


def test_unknown_tag_is_404():
    r = client.get("/api/v1/venues/tagged/definitely-not-a-roster")
    assert r.status_code == 404


def test_world_cup_tag_returns_roster_shape():
    r = client.get("/api/v1/venues/tagged/world_cup_2026")
    assert r.status_code == 200
    body = r.json()
    assert SHAPE_KEYS <= set(body)
    assert body["tag"] == "world_cup_2026"
    assert body["count"] == len(body["venues"])
    if body["venues"]:
        v = body["venues"][0]
        assert {"id", "name", "slug", "has_deal", "deal_count", "top_deal"} <= set(v)


def test_bears_tag_is_allowlisted():
    r = client.get("/api/v1/venues/tagged/bears_2026")
    assert r.status_code == 200
    assert r.json()["tag"] == "bears_2026"


def test_neighborhood_filter_narrows():
    full = client.get("/api/v1/venues/tagged/world_cup_2026").json()
    filtered = client.get("/api/v1/venues/tagged/world_cup_2026?neighborhood=lakeview").json()
    assert filtered["count"] <= full["count"]
    for v in filtered["venues"]:
        assert v["neighborhood_slug"] == "lakeview"


def test_bears_matcher_excludes_other_sports():
    sql = deals_api._bears_deal_sql("t")
    # Short tokens are word-bounded, longer ones stay substrings.
    assert "NOT LIKE '% cubs %'" in sql
    for phrase in ("soccer", "college"):
        assert f"NOT LIKE '%{phrase}%'" in sql
    assert "'%bears%'" in sql


def test_short_tokens_match_on_word_boundaries():
    """'nfl' must not match 'California-iNFLuenced' (it did, and a brunch spot
    surfaced as a top Bears bar)."""
    import sqlite3

    sql = deals_api._bears_deal_sql("txt")
    con = sqlite3.connect(":memory:")
    con.execute("CREATE TABLE t (txt TEXT)")
    con.executemany("INSERT INTO t VALUES (?)", [
        ("California-influenced American restaurant with a patio",),  # must NOT match
        ("Bears game day: $5 drafts and half-off wings",),            # must match
        ("NFL Sunday ticket, bucket specials all day",),              # must match
    ])
    hits = [r[0] for r in con.execute(f"SELECT txt FROM t WHERE {sql}")]
    assert len(hits) == 2
    assert not any("influenced" in h for h in hits)
