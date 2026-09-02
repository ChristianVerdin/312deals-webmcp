"""Endpoint-level tests for the Stripe featured-listing webhook.

These call the real route. `test_stripe_featured_scoping.py` covers the same
scoping rules against a LOCAL MIRROR of the guard (`_accepted`), which cannot
catch the handler drifting away from it — the mirror stays green while the real
endpoint changes. This file closes that gap: every assertion goes through
`POST /api/v1/webhooks/stripe` with a genuine HMAC signature.

Each guard here returns HTTP 200 by design, because Stripe must not retry a
deliberate skip. That makes a silent skip indistinguishable from a captured
payment that vanished, so the handler logs every one and these tests pin the
machine-readable `reason` string.

No DB writes: every case asserted below is rejected before the INSERT. The one
case that WOULD write (a valid live paid session) is deliberately not exercised
here — it needs a real venue name and would mutate featured_listings.
"""
import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient

from src.api import deals_api

client = TestClient(deals_api.app)

SECRET = "whsec_test_secret_for_guard_tests"
ENDPOINT = "/api/v1/webhooks/stripe"


def _signed(body: dict) -> tuple[bytes, dict]:
    """Serialise and sign exactly the way Stripe does: `<ts>.<raw body>`."""
    raw = json.dumps(body).encode()
    ts = str(int(time.time()))
    sig = hmac.new(SECRET.encode(), ts.encode() + b"." + raw, hashlib.sha256).hexdigest()
    return raw, {"stripe-signature": f"t={ts},v1={sig}", "content-type": "application/json"}


def _session(**over) -> dict:
    """A session that passes every guard, so each test changes exactly one thing."""
    sess = {
        "id": "cs_live_guardtest",
        "mode": "payment",
        "payment_status": "paid",
        "livemode": True,
        "amount_total": 3900,
        "currency": "usd",
        "metadata": {"project": "312deals"},
        "customer_details": {"email": "owner@example.com", "name": "Jane Owner"},
        "custom_fields": [],
    }
    sess.update(over)
    return sess


def _post(sess: dict, monkeypatch) -> dict:
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", SECRET)
    monkeypatch.delenv("STRIPE_ALLOW_TEST_MODE", raising=False)
    body = {"type": "checkout.session.completed", "data": {"object": sess}}
    raw, headers = _signed(body)
    r = client.post(ENDPOINT, content=raw, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


class TestSignature:
    def test_unsigned_request_is_rejected(self, monkeypatch):
        monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", SECRET)
        r = client.post(ENDPOINT, json={"type": "checkout.session.completed"})
        assert r.status_code == 401

    def test_wrong_secret_is_rejected(self, monkeypatch):
        monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_a_different_secret")
        raw, headers = _signed({"type": "checkout.session.completed"})
        r = client.post(ENDPOINT, content=raw, headers=headers)
        assert r.status_code == 401

    def test_stale_timestamp_is_rejected(self, monkeypatch):
        """Replay protection: the signature is valid but six minutes old."""
        monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", SECRET)
        raw = json.dumps({"type": "checkout.session.completed"}).encode()
        ts = str(int(time.time()) - 360)
        sig = hmac.new(SECRET.encode(), ts.encode() + b"." + raw, hashlib.sha256).hexdigest()
        r = client.post(ENDPOINT, content=raw,
                        headers={"stripe-signature": f"t={ts},v1={sig}"})
        assert r.status_code == 401


class TestGuards:
    def test_unhandled_event_type_is_skipped(self, monkeypatch):
        monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", SECRET)
        raw, headers = _signed({"type": "invoice.paid", "data": {"object": {}}})
        body = client.post(ENDPOINT, content=raw, headers=headers).json()
        assert body["skipped"] is True
        assert body["reason"].startswith("unhandled:")

    def test_sibling_project_is_skipped(self, monkeypatch):
        body = _post(_session(metadata={"project": "dailylocks"}), monkeypatch)
        assert body["reason"] == "other_project:dailylocks"

    def test_subscription_is_skipped(self, monkeypatch):
        body = _post(_session(mode="subscription"), monkeypatch)
        assert body["reason"].startswith("not_a_featured_purchase:")

    def test_unpaid_session_is_skipped(self, monkeypatch):
        """A delayed payment method completes the session before it settles."""
        body = _post(_session(payment_status="unpaid"), monkeypatch)
        assert body["reason"] == "not_paid:payment_status=unpaid"

    def test_test_mode_session_is_skipped(self, monkeypatch):
        """A test-mode session must never feature a real venue."""
        body = _post(_session(livemode=False), monkeypatch)
        assert body["reason"] == "test_mode_session"

    def test_test_mode_allowed_when_explicitly_opted_in(self, monkeypatch):
        monkeypatch.setenv("STRIPE_ALLOW_TEST_MODE", "1")
        monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", SECRET)
        body_in = {"type": "checkout.session.completed",
                   "data": {"object": _session(livemode=False, amount_total=0)}}
        raw, headers = _signed(body_in)
        body = client.post(ENDPOINT, content=raw, headers=headers).json()
        # Passes the livemode gate, then stops at the amount floor instead.
        assert body["reason"].startswith("amount_below_floor:")

    @pytest.mark.parametrize("amount", [0, None, 99])
    def test_amount_below_floor_is_skipped(self, amount, monkeypatch):
        """featured_listings row 3 is a $0 session recorded 'active' on 2026-08-20."""
        body = _post(_session(amount_total=amount), monkeypatch)
        assert body["reason"].startswith("amount_below_floor:")

    def test_the_actual_leaked_daily_locks_session_is_skipped(self, monkeypatch):
        """Replay of cs_live_b1JUzRr... — $14.99 Daily Locks Starter, Aug 4 2026."""
        leaked = _session(
            mode="subscription",
            amount_total=1499,
            metadata={"tier": "starter", "user_id": "84ca0609-f617-4e70-a2cb-9fbab8efd9c0"},
            customer_details={"email": "buyer@example.com", "name": "Test Buyer"},
        )
        body = _post(leaked, monkeypatch)
        assert body["skipped"] is True, "must never reach featured_listings"

    def test_missing_secret_does_not_process(self, monkeypatch):
        """No secret configured is the one truly silent failure mode — pin it."""
        monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "")
        r = client.post(ENDPOINT, json={"type": "checkout.session.completed"})
        assert r.status_code == 200
        assert r.json()["processed"] is False
