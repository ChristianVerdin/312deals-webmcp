"""Svix webhook signature verification.

Resend (email open/click/bounce) and AgentMail (newsletter ingestion) both
deliver Svix-signed webhooks carrying `svix-id` / `svix-timestamp` /
`svix-signature` headers. The Resend email webhook uses this helper; keeping the
check here (rather than inline in the route) makes it unit-testable in isolation.
"""
from typing import Mapping


def verify_svix_signature(raw_body: bytes, headers: "Mapping[str, str]", secret: str) -> bool:
    """Return True iff the Svix signature headers verify `raw_body` against `secret`.

    Fails closed: an empty/malformed secret, missing headers, a stale timestamp,
    or a bad signature all return False (never raise), so a caller can safely
    ``return 401`` on a falsy result without risking a 500.
    """
    if not secret:
        return False
    try:
        from svix.webhooks import Webhook

        Webhook(secret).verify(raw_body, dict(headers))
        return True
    except Exception:
        return False
