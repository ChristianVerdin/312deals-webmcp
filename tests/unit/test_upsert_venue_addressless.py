"""upsert_venue must be idempotent for venues that have no address.

The venues table constrains UNIQUE(name, address). SQLite treats NULLs as
DISTINCT inside a unique constraint, so ('McDonald's', NULL) never conflicts
with ('McDonald's', NULL) and `ON CONFLICT(name, address)` silently does not
fire. The old fallback lookup used `address = ?`, which is never true when the
parameter is NULL, so that missed too.

The result: the weekly chain refresh calls upsert_venue with a name and a URL
and no address, and minted a brand new venue row on every single run. By
2026-09-01 the live DB carried 60 brands duplicated up to 19 times each
(~900 rows). Each duplicate is an unreachable page — venue lookup resolves on
slug alone — holding real deals.

These tests pin the idempotency so that cannot regress silently.
"""
import sqlite3

import pytest

from src.pipeline.deal_extractor import upsert_venue


@pytest.fixture
def conn():
    """Minimal venues table carrying the real UNIQUE(name, address) constraint."""
    c = sqlite3.connect(":memory:")
    c.execute(
        """CREATE TABLE venues (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             name TEXT, slug TEXT, address TEXT, city TEXT, state TEXT,
             website_url TEXT, instagram_handle TEXT, cuisine_type TEXT,
             google_place_id TEXT UNIQUE, latitude REAL, longitude REAL,
             google_rating REAL, photo_url TEXT, is_chain INTEGER DEFAULT 0,
             is_active INTEGER DEFAULT 1, neighborhood_id INTEGER,
             updated_at TIMESTAMP,
             UNIQUE(name, address)
           )"""
    )
    yield c
    c.close()


def _count(c, name):
    return c.execute("SELECT COUNT(*) FROM venues WHERE name = ?", (name,)).fetchone()[0]


class TestAddresslessVenue:
    def test_repeated_upsert_reuses_the_same_row(self, conn):
        """The exact shape the weekly chain refresh sends: name + url, no address."""
        ids = [
            upsert_venue(conn, {"name": "McDonald's", "website_url": "https://mcdonalds.com/deals"})
            for _ in range(5)
        ]
        assert _count(conn, "McDonald's") == 1, "five weekly runs must not make five venues"
        assert len(set(ids)) == 1, f"must return one stable id, got {ids}"

    def test_it_fills_holes_without_clobbering(self, conn):
        first = upsert_venue(conn, {"name": "Panera Bread", "website_url": "https://panera.com"})
        upsert_venue(conn, {"name": "Panera Bread", "website_url": None, "google_rating": 4.2})
        row = conn.execute(
            "SELECT website_url, google_rating FROM venues WHERE id = ?", (first,)
        ).fetchone()
        assert row[0] == "https://panera.com", "a later NULL must not wipe an existing value"
        assert row[1] == 4.2, "a later value must fill an empty field"

    def test_an_inactive_duplicate_is_not_reused(self, conn):
        """Deactivated rows are the cleanup's output; never resurrect one."""
        dead = upsert_venue(conn, {"name": "Dunkin'"})
        conn.execute("UPDATE venues SET is_active = 0 WHERE id = ?", (dead,))
        fresh = upsert_venue(conn, {"name": "Dunkin'"})
        assert fresh != dead


class TestAddressedVenueUnchanged:
    def test_same_name_different_address_stays_separate(self, conn):
        """Two real locations of one chain must remain distinct venues."""
        a = upsert_venue(conn, {"name": "Lou Malnati's", "address": "439 N Wells St"})
        b = upsert_venue(conn, {"name": "Lou Malnati's", "address": "805 S State St"})
        assert a != b
        assert _count(conn, "Lou Malnati's") == 2

    def test_same_name_same_address_is_one_row(self, conn):
        a = upsert_venue(conn, {"name": "The Berghoff", "address": "17 W Adams St"})
        b = upsert_venue(conn, {"name": "The Berghoff", "address": "17 W Adams St",
                                "website_url": "https://theberghoff.com"})
        assert a == b
        assert _count(conn, "The Berghoff") == 1

    def test_addressed_and_addressless_do_not_collide(self, conn):
        """A brand HQ row and a real location of that brand are different things."""
        hq = upsert_venue(conn, {"name": "Shake Shack"})
        loc = upsert_venue(conn, {"name": "Shake Shack", "address": "12 S Michigan Ave"})
        assert hq != loc
