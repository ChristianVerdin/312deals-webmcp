"""Unit tests for the submit_deal_tip MCP guardrails (Task 4).

Pure-logic tests — no DB, no network, no external calls. Runnable standalone:
    .venv/bin/python3 tests/unit/test_submit_deal_tip.py
and pytest-compatible once the pytest infra lands (Task 2).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.mcp_server.chideals_mcp import (  # noqa: E402
    _validate_submit,
    _check_submit_rate,
    SubmitRejected,
    _SUBMIT_MAX_LEN,
    _SUBMIT_RATE_MAX,
    _SUBMIT_RATE_WINDOW_S,
    _submit_ts,
)


def test_valid_input_is_trimmed():
    vn, dd, src = _validate_submit("  Kaiser Tiger  ", "  $5 drafts 4-6pm  ", "  instagram  ")
    assert vn == "Kaiser Tiger"
    assert dd == "$5 drafts 4-6pm"
    assert src == "instagram"


def test_blank_or_missing_source_becomes_none():
    assert _validate_submit("V", "D", "   ")[2] is None
    assert _validate_submit("V", "D", None)[2] is None


def test_empty_required_fields_rejected():
    for bad in ("", "   ", None):
        try:
            _validate_submit(bad, "D", None)
            assert False, "empty venue_name should reject"
        except SubmitRejected:
            pass
        try:
            _validate_submit("V", bad, None)
            assert False, "empty deal_description should reject"
        except SubmitRejected:
            pass


def test_length_caps_reject_overlong():
    cases = {
        "venue_name": ("x" * (_SUBMIT_MAX_LEN["venue_name"] + 1), "D", None),
        "deal_description": ("V", "x" * (_SUBMIT_MAX_LEN["deal_description"] + 1), None),
        "source": ("V", "D", "x" * (_SUBMIT_MAX_LEN["source"] + 1)),
    }
    for field, args in cases.items():
        try:
            _validate_submit(*args)
            assert False, f"over-long {field} should reject"
        except SubmitRejected as e:
            assert field in str(e)


def test_exactly_at_cap_is_allowed():
    _validate_submit("x" * _SUBMIT_MAX_LEN["venue_name"], "D", None)  # no raise


def test_rate_limit_blocks_after_max():
    _submit_ts.clear()
    base = 1000.0
    for i in range(_SUBMIT_RATE_MAX):
        _check_submit_rate(now=base + i * 0.1)  # N accepted inside the window
    try:
        _check_submit_rate(now=base + _SUBMIT_RATE_MAX * 0.1)
        assert False, "the (max+1)th submission should be rate-limited"
    except SubmitRejected as e:
        assert "rate limit" in str(e)


def test_rate_limit_window_slides():
    _submit_ts.clear()
    _check_submit_rate(now=0.0)
    _check_submit_rate(now=_SUBMIT_RATE_WINDOW_S + 1.0)  # old entry ages out
    assert len(_submit_ts) == 1


def _run_standalone():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for t in tests:
        _submit_ts.clear()
        t()
        print(f"  PASS  {t.__name__}")
    print(f"\n{len(tests)}/{len(tests)} tests passed")


if __name__ == "__main__":
    _run_standalone()
