"""Unit tests for scripts/email_events.py — newsletter open/click recording from
mocked Resend webhook payloads. No network, no real DB, no email sent.
"""
import sqlite3

import email_events as ee


def _db(tmp_path):
    conn = sqlite3.connect(tmp_path / "t.db")
    conn.execute("CREATE TABLE subscribers (id INTEGER PRIMARY KEY, email TEXT UNIQUE, is_active INTEGER DEFAULT 1)")
    conn.execute("INSERT INTO subscribers (id, email, is_active) VALUES (1,'a@b.com',1), (2,'c@d.com',1)")
    conn.commit()
    return conn


def test_records_open_and_links_subscriber(tmp_path):
    conn = _db(tmp_path)
    n = ee.record_engagement_event(conn, "email.opened", {"to": ["a@b.com"], "email_id": "msg1"})
    assert n == 1
    row = conn.execute(
        "SELECT email, event_type, email_id, subscriber_id, link_url FROM email_events"
    ).fetchone()
    assert row == ("a@b.com", "opened", "msg1", 1, None)


def test_records_click_with_link(tmp_path):
    conn = _db(tmp_path)
    n = ee.record_engagement_event(
        conn, "email.clicked",
        {"to": ["a@b.com"], "email_id": "msg1", "click": {"link": "https://312deals.com/deals"}},
    )
    assert n == 1
    link = conn.execute("SELECT link_url FROM email_events WHERE event_type='clicked'").fetchone()[0]
    assert link == "https://312deals.com/deals"


def test_repeat_open_is_deduped(tmp_path):
    conn = _db(tmp_path)
    ee.record_engagement_event(conn, "email.opened", {"to": ["a@b.com"], "email_id": "m"})
    n2 = ee.record_engagement_event(conn, "email.opened", {"to": ["a@b.com"], "email_id": "m"})
    assert n2 == 0  # duplicate open ignored
    assert conn.execute("SELECT COUNT(*) FROM email_events").fetchone()[0] == 1


def test_distinct_links_each_count(tmp_path):
    conn = _db(tmp_path)
    ee.record_engagement_event(conn, "email.clicked", {"to": ["a@b.com"], "email_id": "m", "click": {"link": "https://x/1"}})
    ee.record_engagement_event(conn, "email.clicked", {"to": ["a@b.com"], "email_id": "m", "click": {"link": "https://x/2"}})
    assert conn.execute("SELECT COUNT(*) FROM email_events WHERE event_type='clicked'").fetchone()[0] == 2


def test_non_engagement_event_ignored(tmp_path):
    conn = _db(tmp_path)
    ee.ensure_email_events_table(conn)   # table exists; a bounce still records nothing
    n = ee.record_engagement_event(conn, "email.bounced", {"to": ["a@b.com"]})
    assert n == 0
    assert conn.execute("SELECT COUNT(*) FROM email_events").fetchone()[0] == 0


def test_recipient_email_is_normalized(tmp_path):
    conn = _db(tmp_path)
    ee.record_engagement_event(conn, "email.opened", {"to": ["  A@B.com "], "email_id": "m"})
    email, sid = conn.execute("SELECT email, subscriber_id FROM email_events").fetchone()
    assert email == "a@b.com"   # lowercased + trimmed
    assert sid == 1              # matched existing subscriber


def test_engagement_rates(tmp_path):
    conn = _db(tmp_path)
    ee.record_engagement_event(conn, "email.opened", {"to": ["a@b.com"], "email_id": "m"})
    ee.record_engagement_event(conn, "email.opened", {"to": ["c@d.com"], "email_id": "m"})
    ee.record_engagement_event(conn, "email.clicked", {"to": ["a@b.com"], "email_id": "m", "click": {"link": "https://x"}})
    r = ee.engagement_rates(conn, email_id="m")
    assert r["unique_opens"] == 2
    assert r["unique_clicks"] == 1
    assert r["active_subscribers"] == 2
    assert r["open_rate"] == 1.0    # 2 / 2
    assert r["click_rate"] == 0.5   # 1 / 2


def test_is_our_send_true_for_312deals_from():
    assert ee.is_our_send({"from": "The Deal Sheet <deals@312deals.com>"}) is True


def test_is_our_send_false_for_other_project():
    # Shared Resend account — a sibling product's email must be ignored.
    assert ee.is_our_send({"from": '"Daily Locks AI" <noreply@dailylocks.ai>'}) is False


def test_is_our_send_false_when_from_missing():
    assert ee.is_our_send({}) is False
