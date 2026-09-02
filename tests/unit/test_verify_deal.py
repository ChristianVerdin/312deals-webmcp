"""Unit tests for src/scrapers/verify_deal.py — the Gemini-first / Claude-fallback
verification path. All network + AI calls are mocked; nothing hits httpx, Gemini,
or Anthropic.
"""
import src.scrapers.verify_deal as vd


def _must_not_call(*args, **kwargs):
    raise AssertionError("this path must not be called")


def test_hash_match_short_circuits_without_ai(monkeypatch):
    """Unchanged page (hash match) returns immediately — no Gemini, no Claude."""
    monkeypatch.setattr(vd, "fetch_content_hash", lambda url: ("page text", "HASH_A"))
    monkeypatch.setattr(vd, "_gemini_verify", _must_not_call, raising=False)
    monkeypatch.setattr(vd.client.messages, "create", _must_not_call)

    r = vd.verify_deal("https://bar.com/hh", "Half-off drinks", existing_hash="HASH_A")

    assert r["hash_match"] is True
    assert r["found"] is True and r["confidence"] == 1.0
    assert r["deal_may_have_changed"] is False and r["changes_detected"] is None
    assert r["content_hash"] == "HASH_A"


def test_gemini_high_confidence_returns_without_claude(monkeypatch):
    """Gemini >= 0.8 confidence short-circuits before the Claude call."""
    monkeypatch.setattr(vd, "fetch_content_hash", lambda url: ("page text", "HASH_B"))
    monkeypatch.setattr(vd, "GEMINI_AVAILABLE", True)
    monkeypatch.setattr(
        vd, "_gemini_verify",
        lambda title, text: {"found": True, "confidence": 0.9, "match_details": "still listed"},
        raising=False,
    )
    monkeypatch.setattr(vd.client.messages, "create", _must_not_call)

    r = vd.verify_deal("https://bar.com/hh", "Half-off drinks")

    assert r["verified_by"] == "gemini"
    assert r["found"] is True
    assert r["deal_may_have_changed"] is False   # not found(True) -> False
    assert r["changes_detected"] is None
    assert r["content_hash"] == "HASH_B"


def test_low_gemini_confidence_falls_back_to_claude(monkeypatch):
    """Gemini below the 0.8 threshold -> Claude is called and wins."""
    monkeypatch.setattr(vd, "fetch_content_hash", lambda url: ("page text", "HASH_C"))
    monkeypatch.setattr(vd, "GEMINI_AVAILABLE", True)
    monkeypatch.setattr(
        vd, "_gemini_verify",
        lambda title, text: {"found": True, "confidence": 0.5},  # below 0.8
        raising=False,
    )

    class _Block:
        text = ('{"found": true, "confidence": 0.95, "match_details": "matched", '
                '"deal_may_have_changed": false, "changes_detected": null}')

    class _Resp:
        content = [_Block()]

    monkeypatch.setattr(vd.client.messages, "create", lambda **k: _Resp())

    r = vd.verify_deal("https://bar.com/hh", "Half-off drinks")

    assert r["verified_by"] == "claude"
    assert r["found"] is True and r["confidence"] == 0.95
    assert r["content_hash"] == "HASH_C"


def test_gemini_unavailable_uses_claude_and_strips_code_fences(monkeypatch):
    """No Gemini -> Claude; and a ```json fenced reply is parsed correctly."""
    monkeypatch.setattr(vd, "fetch_content_hash", lambda url: ("page text", "HASH_D"))
    monkeypatch.setattr(vd, "GEMINI_AVAILABLE", False)

    class _Block:
        text = '```json\n{"found": false, "confidence": 0.8, "match_details": "gone"}\n```'

    class _Resp:
        content = [_Block()]

    monkeypatch.setattr(vd.client.messages, "create", lambda **k: _Resp())

    r = vd.verify_deal("https://bar.com/hh", "Half-off drinks")

    assert r["verified_by"] == "claude"
    assert r["found"] is False
    assert r["content_hash"] == "HASH_D"
