"""Unit tests for Svix webhook signature verification (Resend email webhook +
AgentMail use the same scheme). Real Svix signatures, no mocks, no network.
"""
import base64
import json
from datetime import datetime, timezone

from svix.webhooks import Webhook

from src.api.webhook_security import verify_svix_signature


def _secret() -> str:
    return "whsec_" + base64.b64encode(b"0123456789abcdef0123").decode()


def _signed_headers(payload: str, secret: str) -> dict:
    """Valid Svix headers for `payload` signed with `secret`."""
    msg_id = "msg_abc123"
    ts = datetime.now(tz=timezone.utc)
    sig = Webhook(secret).sign(msg_id, ts, payload)
    return {
        "svix-id": msg_id,
        "svix-timestamp": str(int(ts.timestamp())),
        "svix-signature": sig,
    }


def test_valid_signature_passes():
    secret = _secret()
    payload = json.dumps({"type": "email.clicked"})
    headers = _signed_headers(payload, secret)
    assert verify_svix_signature(payload.encode(), headers, secret) is True


def test_tampered_body_fails():
    secret = _secret()
    payload = json.dumps({"type": "email.clicked"})
    headers = _signed_headers(payload, secret)
    assert verify_svix_signature((payload + " ").encode(), headers, secret) is False


def test_wrong_secret_fails():
    payload = json.dumps({"type": "email.clicked"})
    headers = _signed_headers(payload, _secret())
    other = "whsec_" + base64.b64encode(b"ffffffffffffffffffff").decode()
    assert verify_svix_signature(payload.encode(), headers, other) is False


def test_missing_headers_fails():
    payload = json.dumps({"type": "email.clicked"})
    assert verify_svix_signature(payload.encode(), {}, _secret()) is False


def test_empty_secret_fails():
    payload = json.dumps({"type": "email.clicked"})
    headers = _signed_headers(payload, _secret())
    assert verify_svix_signature(payload.encode(), headers, "") is False


def test_malformed_secret_returns_false_not_raises():
    # A misconfigured secret must fail closed (return False), never bubble an
    # exception that would 500 the webhook endpoint.
    payload = json.dumps({"type": "email.clicked"})
    headers = _signed_headers(payload, _secret())
    assert verify_svix_signature(payload.encode(), headers, "not-valid-base64!!") is False
