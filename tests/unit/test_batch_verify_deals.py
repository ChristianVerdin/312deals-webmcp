"""Unit tests for scripts/batch_verify_deals.py rule logic, run as an integration
test against a temp SQLite DB with verify_deal() mocked. Confirms:
  - is_active is set to 0 ONLY when the new quality_score <= 20
  - a "found" result bumps score + keeps active + marks verified
  - a content-hash match short-circuits (timestamps only, no score change)
No network, no real DB, no sleeps.
"""
import sqlite3
import sys

import batch_verify_deals as bvd

_DDL = """
CREATE TABLE venues (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE deals (
  id INTEGER PRIMARY KEY, venue_id INTEGER, title TEXT, source_url TEXT,
  quality_score INTEGER, content_hash TEXT,
  check_count INTEGER DEFAULT 0, hash_changed_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1, is_verified INTEGER DEFAULT 0,
  last_checked_at TEXT, next_check_at TEXT, verified_at TEXT,
  deactivated_reason TEXT, deactivated_at TEXT, updated_at TEXT
);
INSERT INTO venues (id, name) VALUES (1, 'Test Bar');
"""


def _make_db(tmp_path, score, content_hash=None):
    db = tmp_path / "t.db"
    conn = sqlite3.connect(db)
    conn.executescript(_DDL)
    conn.execute(
        "INSERT INTO deals (id, venue_id, title, source_url, quality_score, content_hash) "
        "VALUES (1, 1, 'Deal', 'https://x.com/hh', ?, ?)",
        [score, content_hash],
    )
    conn.commit()
    conn.close()
    return db


def _run(monkeypatch, db, result):
    monkeypatch.setattr(bvd, "DB_PATH", db)
    monkeypatch.setattr(bvd, "verify_deal", lambda *a, **k: result)
    monkeypatch.setattr(bvd, "compute_next_check_at", lambda *a, **k: "2026-08-01T00:00:00+00:00")
    monkeypatch.setattr(bvd.time, "sleep", lambda *a, **k: None)
    monkeypatch.setattr(sys, "argv", ["batch_verify_deals.py", "--limit", "50"])
    bvd.main()


def _row(db):
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    row = dict(conn.execute("SELECT * FROM deals WHERE id = 1").fetchone())
    conn.close()
    return row


def test_not_found_low_score_deactivates(tmp_path, monkeypatch):
    db = _make_db(tmp_path, score=40)
    _run(monkeypatch, db, {"found": False, "content_hash": "h", "confidence": 0.9})
    row = _row(db)
    assert row["quality_score"] == 10   # 40 - 30
    assert row["is_active"] == 0         # 10 <= 20 -> deactivate
    assert row["deactivated_reason"] == "verification_failed"


def test_not_found_exactly_at_threshold_deactivates(tmp_path, monkeypatch):
    """Boundary: score lands on exactly 20 -> is_active 0 (the rule is <= 20)."""
    db = _make_db(tmp_path, score=50)
    _run(monkeypatch, db, {"found": False, "content_hash": "h", "confidence": 0.9})
    row = _row(db)
    assert row["quality_score"] == 20   # 50 - 30
    assert row["is_active"] == 0         # 20 <= 20 -> deactivate


def test_not_found_above_threshold_stays_active(tmp_path, monkeypatch):
    db = _make_db(tmp_path, score=60)
    _run(monkeypatch, db, {"found": False, "content_hash": "h", "confidence": 0.9})
    row = _row(db)
    assert row["quality_score"] == 30   # 60 - 30
    assert row["is_active"] == 1         # 30 > 20 -> stays active


def test_found_bumps_score_and_marks_verified(tmp_path, monkeypatch):
    db = _make_db(tmp_path, score=50)
    _run(monkeypatch, db, {"found": True, "content_hash": "h", "confidence": 0.95})
    row = _row(db)
    assert row["quality_score"] == 60   # 50 + 10
    assert row["is_active"] == 1
    assert row["is_verified"] == 1       # found + confidence >= 0.8


def test_hash_match_short_circuits_no_score_change(tmp_path, monkeypatch):
    db = _make_db(tmp_path, score=50, content_hash="SAME")
    _run(monkeypatch, db, {"hash_match": True, "content_hash": "SAME", "found": True, "confidence": 1.0})
    row = _row(db)
    assert row["quality_score"] == 50    # unchanged
    assert row["is_active"] == 1
    assert row["check_count"] == 1        # incremented
    assert row["last_checked_at"] is not None
