"""Unit tests for scripts/deactivate_venues.py — reviewed closure deactivation. No real DB."""
import sqlite3

import deactivate_venues as dv


def _db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE neighborhoods (id INTEGER PRIMARY KEY, name TEXT, slug TEXT);
        CREATE TABLE venues (id INTEGER PRIMARY KEY, name TEXT, neighborhood_id INTEGER,
            is_active INTEGER DEFAULT 1, data_quality_notes TEXT, updated_at TEXT);
        CREATE TABLE deals (id INTEGER PRIMARY KEY, venue_id INTEGER, title TEXT, deal_type TEXT,
            is_active INTEGER DEFAULT 1, deactivated_reason TEXT, deactivated_at TEXT, updated_at TEXT);
        CREATE TABLE deal_history (id INTEGER PRIMARY KEY AUTOINCREMENT, deal_id INTEGER,
            venue_id INTEGER, action TEXT, field_changed TEXT, old_value TEXT, new_value TEXT,
            change_source TEXT, metadata_json TEXT, created_at TEXT);
        CREATE TRIGGER trg_deal_deactivate AFTER UPDATE OF is_active ON deals
        WHEN OLD.is_active = 1 AND NEW.is_active = 0 BEGIN
            INSERT INTO deal_history (deal_id, venue_id, action, field_changed, old_value,
                new_value, change_source, metadata_json, created_at)
            VALUES (NEW.id, NEW.venue_id, 'deactivated', 'is_active', '1', '0',
                COALESCE(NEW.deactivated_reason, 'unknown'),
                json_object('title', NEW.title, 'deal_type', NEW.deal_type),
                strftime('%Y-%m-%d %H:%M:%S', 'now'));
        END;
        INSERT INTO neighborhoods VALUES (1, 'Lakeview', 'lakeview');
        INSERT INTO venues VALUES
            (10, 'Closed Tavern', 1, 1, 'Gemini flagged PERMANENTLY CLOSED 2026-06-24: replaced by X', NULL),
            (11, 'Busy Bar', 1, 1, 'Gemini flagged PERMANENTLY CLOSED 2026-06-24: maybe', NULL),
            (12, 'Fine Diner', 1, 1, 'Gemini flagged PERMANENTLY CLOSED 2026-06-20: hotel FP', NULL);
        INSERT INTO deals (id, venue_id, title, deal_type, is_active) VALUES
            (100, 11, 'HH', 'happy_hour', 1), (101, 11, 'Old', 'brunch', 0);
    """)
    return conn


def test_deactivate_sets_audit_columns_and_real_change_source():
    db = _db()
    assert dv.deactivate_venue(db, 10, "closed May 2026", write=True, allow_deal_loss=False) == "deactivated"
    v = db.execute("SELECT is_active, data_quality_notes, updated_at FROM venues WHERE id=10").fetchone()
    assert v["is_active"] == 0
    assert "deactivated: closed May 2026" in v["data_quality_notes"]
    assert v["updated_at"] is not None


def test_refuses_deal_bearing_venue_without_flag_and_allows_with_it():
    db = _db()
    assert dv.deactivate_venue(db, 11, "x", write=True, allow_deal_loss=False) == "refused"
    assert db.execute("SELECT is_active FROM venues WHERE id=11").fetchone()[0] == 1

    assert dv.deactivate_venue(db, 11, "confirmed closed", write=True, allow_deal_loss=True) == "deactivated"
    deal = db.execute("SELECT is_active, deactivated_reason, deactivated_at, updated_at FROM deals WHERE id=100").fetchone()
    assert deal["is_active"] == 0
    assert deal["deactivated_reason"] == "venue_deactivated: confirmed closed"
    assert deal["deactivated_at"] is not None and deal["updated_at"] is not None
    hist = db.execute("SELECT change_source FROM deal_history WHERE deal_id=100").fetchone()
    assert hist["change_source"] == "venue_deactivated: confirmed closed"  # not 'unknown'
    # the already-inactive deal is untouched
    assert db.execute("SELECT deactivated_reason FROM deals WHERE id=101").fetchone()[0] is None


def test_keep_clears_from_review_pool_and_stays_active():
    db = _db()
    assert dv.keep_venue(db, 12, "hotel restaurant, open", write=True) == "kept"
    v = db.execute("SELECT is_active, data_quality_notes FROM venues WHERE id=12").fetchone()
    assert v["is_active"] == 1
    assert dv.REVIEWED_OPEN in v["data_quality_notes"]
    pool = dv.flagged_pool(db, since=None, neighborhood=None)
    assert [r["venue_id"] for r in pool] == [10, 11]


def test_dry_run_writes_nothing():
    db = _db()
    dv.deactivate_venue(db, 10, "x", write=False, allow_deal_loss=False)
    dv.keep_venue(db, 12, "x", write=False)
    assert db.execute("SELECT is_active FROM venues WHERE id=10").fetchone()[0] == 1
    assert "verified open" not in (db.execute("SELECT data_quality_notes FROM venues WHERE id=12").fetchone()[0])


def test_flagged_pool_filters_and_parse():
    db = _db()
    pool = dv.flagged_pool(db, since="2026-06-22", neighborhood=None)
    assert [r["venue_id"] for r in pool] == [10, 11]
    assert pool[0]["flag_date"] == "2026-06-24"
    assert pool[0]["evidence"].startswith("replaced by X")
    assert pool[0]["active_deals"] == 0 and pool[1]["active_deals"] == 1
    assert dv.flagged_pool(db, since=None, neighborhood="lakeview")
    assert not dv.flagged_pool(db, since=None, neighborhood="hyde-park")
