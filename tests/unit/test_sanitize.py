"""Unit tests for src/api/sanitize.py — key stripping shared by REST and MCP row_to_dict."""
import sqlite3

from src.api.sanitize import strip_api_key, strip_photo_keys

URL = "https://places.googleapis.com/v1/places/X/photos/Y/media?maxHeightPx=600&maxWidthPx=800&key=AIzaFAKE123"
CLEAN = "https://places.googleapis.com/v1/places/X/photos/Y/media?maxHeightPx=600&maxWidthPx=800"


def test_strip_api_key_last_param():
    assert strip_api_key(URL) == CLEAN


def test_strip_api_key_middle_param():
    assert strip_api_key(
        "https://x.test/p?key=AIzaFAKE&maxHeightPx=600"
    ) == "https://x.test/p?maxHeightPx=600"


def test_strip_api_key_only_param():
    assert strip_api_key("https://x.test/p?key=AIzaFAKE") == "https://x.test/p"


def test_strip_photo_keys_dict_fields():
    d = {"photo_url": URL, "image_url": URL, "top_venue_photo": URL,
         "photo_urls": [URL, "https://x.test/plain.jpg", None],
         "name": "Venue", "quality_score": 90}
    strip_photo_keys(d)
    assert d["photo_url"] == CLEAN
    assert d["image_url"] == CLEAN
    assert d["top_venue_photo"] == CLEAN
    assert d["photo_urls"][0] == CLEAN
    assert d["photo_urls"][1] == "https://x.test/plain.jpg"
    assert d["name"] == "Venue"


def test_mcp_row_to_dict_strips_key():
    from src.mcp_server.chideals_mcp import row_to_dict

    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE v (id INTEGER, photo_url TEXT, days_available TEXT)")
    conn.execute("INSERT INTO v VALUES (1, ?, '[\"monday\"]')", (URL,))
    row = conn.execute("SELECT * FROM v").fetchone()
    d = row_to_dict(row)
    assert d["photo_url"] == CLEAN
    assert d["days_available"] == ["monday"]


# --- Internal provenance must never reach a public surface -------------------
# Regression: the venue endpoints select `v.*`, so data_quality_notes shipped on
# the open REST API and via MCP. It carried freshness closure verdicts such as
# "Gemini flagged PERMANENTLY CLOSED ...: The California Clipper ... permanently
# closed in May 2020" — about an open bar — across 471 active venues.

from src.api.sanitize import PRIVATE_KEYS, strip_private_fields


def test_strip_private_fields_removes_closure_notes():
    d = {"id": 414, "name": "The California Clipper", "is_active": 1,
         "data_quality_notes": "Gemini flagged PERMANENTLY CLOSED 2026-04-09: ...",
         "notes": "operator scratch"}
    strip_private_fields(d)
    assert "data_quality_notes" not in d
    assert "notes" not in d
    assert d["name"] == "The California Clipper"   # public fields survive
    assert d["is_active"] == 1


def test_strip_private_fields_is_safe_when_absent():
    d = {"id": 1, "name": "V"}
    assert strip_private_fields(d) == {"id": 1, "name": "V"}


def test_rest_row_to_dict_redacts_private_keys():
    from src.api.deals_api import row_to_dict
    row = {"id": 1, "name": "V", "data_quality_notes": "PERMANENTLY CLOSED", "notes": "x"}
    out = row_to_dict(row)
    assert not any(k in out for k in PRIVATE_KEYS)


def test_mcp_row_to_dict_redacts_private_keys():
    from src.mcp_server.chideals_mcp import row_to_dict as mcp_row_to_dict
    row = {"id": 1, "name": "V", "data_quality_notes": "PERMANENTLY CLOSED", "notes": "x"}
    out = mcp_row_to_dict(row)
    assert not any(k in out for k in PRIVATE_KEYS)
