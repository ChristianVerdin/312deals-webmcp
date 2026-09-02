"""Endpoint tests for /api/v1/email/webhook Svix signature gating.

Uses the "email.delivered" event type on the happy path so the request returns
without touching the database (only bounce/complaint/open/click hit the DB). No
network, no real webhook.
"""
import base64
import json
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from svix.webhooks import Webhook

from src.api import deals_api

client = TestClient(deals_api.app)


def _secret() -> str:
    return "whsec_" + base64.b64encode(b"0123456789abcdef0123").decode()


def _signed_headers(payload: str, secret: str) -> dict:
    msg_id = "msg_ep123"
    ts = datetime.now(tz=timezone.utc)
    sig = Webhook(secret).sign(msg_id, ts, payload)
    return {
        "svix-id": msg_id,
        "svix-timestamp": str(int(ts.timestamp())),
        "svix-signature": sig,
        "content-type": "application/json",
    }


def test_bad_signature_is_rejected(monkeypatch):
    monkeypatch.setenv("RESEND_WEBHOOK_SECRET", _secret())
    r = client.post(
        "/api/v1/email/webhook",
        content=json.dumps({"type": "email.delivered"}),
        headers={
            "svix-id": "x", "svix-timestamp": "1", "svix-signature": "v1,deadbeef",
            "content-type": "application/json",
        },
    )
    assert r.status_code == 401


def test_valid_signature_is_accepted(monkeypatch):
    secret = _secret()
    monkeypatch.setenv("RESEND_WEBHOOK_SECRET", secret)
    payload = json.dumps({"type": "email.delivered", "data": {}})
    r = client.post("/api/v1/email/webhook", content=payload,
                    headers=_signed_headers(payload, secret))
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_missing_secret_accepts_unverified(monkeypatch):
    # Graceful degradation: before the secret is wired, tracking still works.
    monkeypatch.delenv("RESEND_WEBHOOK_SECRET", raising=False)
    r = client.post(
        "/api/v1/email/webhook",
        content=json.dumps({"type": "email.delivered"}),
        headers={"content-type": "application/json"},
    )
    assert r.status_code == 200
