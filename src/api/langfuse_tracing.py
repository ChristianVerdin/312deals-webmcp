"""Env-gated Langfuse tracing for the AI-chat LLM path.

No-op unless ``LANGFUSE_ENABLED`` is truthy AND the SDK + keys + host are present.
Designed to NEVER raise into the chat path — every entry point swallows its own
errors and degrades to an untraced no-op.

Wiring:
  - ``src/api/deals_api.py`` calls ``init_tracing()`` once at startup.
  - ``src/api/chat.py`` calls ``set_request_context(...)`` before the tool loop
    (session/referrer/intent/turn) and wraps the loop in ``llm_trace_scope(...)``.
    The ``AnthropicInstrumentor`` (OpenTelemetry) auto-captures every Anthropic
    ``messages.create`` as a *generation* (model, token usage incl. cache reads/
    writes, cost, raw I/O, latency); the scope nests those under a named
    ``ai-chat-response`` trace carrying request context.

Mirrors the proven pattern in fanduel_scraping_agent/agent/langfuse_tracing.py.
"""
from __future__ import annotations

import contextlib
import contextvars
import logging
import os
import sys
from typing import Optional

logger = logging.getLogger(__name__)

_TRUTHY = {"1", "true", "yes", "on"}

# Request-scoped context (session / referrer / intent / turn), set by the API
# layer before the tool loop runs. Empty for offline/script calls.
_request_ctx: contextvars.ContextVar[dict] = contextvars.ContextVar(
    "langfuse_chat_ctx", default={}
)

# Module state. _init guards one-time setup; _client is the Langfuse singleton.
_state = {"init": False, "enabled": False, "client": None}


def set_request_context(**kwargs) -> None:
    """Record session/referrer/intent/turn for the next traced LLM call.

    None values are dropped. Never raises. Safe to call when tracing is off.
    """
    try:
        _request_ctx.set({k: v for k, v in kwargs.items() if v is not None})
    except Exception:  # pragma: no cover - defensive
        pass


def _enabled_flag() -> bool:
    return os.environ.get("LANGFUSE_ENABLED", "").strip().lower() in _TRUTHY


def init_tracing() -> bool:
    """Idempotent. Return True if Langfuse tracing is active.

    Safe no-op when the flag is off, keys/host are missing, the SDK isn't
    installed, or any init step fails (auth, network, etc.).
    """
    if _state["init"]:
        return _state["enabled"]
    _state["init"] = True

    if not _enabled_flag():
        logger.info("[langfuse] LANGFUSE_ENABLED not set — tracing disabled")
        return False

    pk = os.environ.get("LANGFUSE_PUBLIC_KEY")
    sk = os.environ.get("LANGFUSE_SECRET_KEY")
    host = os.environ.get("LANGFUSE_BASE_URL") or os.environ.get("LANGFUSE_HOST")
    if not (pk and sk and host):
        logger.warning("[langfuse] enabled but public/secret key or host missing — tracing disabled")
        return False

    try:
        from langfuse import Langfuse
        from opentelemetry.instrumentation.anthropic import AnthropicInstrumentor

        client = Langfuse(
            public_key=pk,
            secret_key=sk,
            host=host,
            environment=os.environ.get("LANGFUSE_ENVIRONMENT", "production"),
        )
        if not client.auth_check():
            logger.warning("[langfuse] auth_check failed — tracing disabled")
            return False

        # OTel instrumentor: auto-captures every Anthropic messages.create as a
        # generation with model, token usage (incl. cache reads/writes), cost,
        # raw input/output, and latency — no manual span needed for the LLM call.
        AnthropicInstrumentor().instrument()

        _state["client"] = client
        _state["enabled"] = True
        logger.info(
            "[langfuse] tracing active (Anthropic instrumented, langfuse %s, host=%s)",
            _lf_version(), host,
        )
        return True
    except Exception as e:
        logger.warning("[langfuse] init failed (%s) — tracing disabled", e)
        return False


def get_client():
    return _state["client"]


def _lf_version() -> str:
    try:
        import importlib.metadata as _m
        return _m.version("langfuse")
    except Exception:  # pragma: no cover - defensive
        return "unknown"


def _open_trace_span(client):
    """Open the wrapping span using whichever API the installed SDK exposes.

    ``start_as_current_observation`` is the canonical v3 method; fall back to the
    ``start_as_current_span`` alias; give up cleanly if neither exists.
    """
    if hasattr(client, "start_as_current_observation"):
        return client.start_as_current_observation(as_type="span", name="ai-chat-response")
    if hasattr(client, "start_as_current_span"):
        return client.start_as_current_span(name="ai-chat-response")
    return None


def _safe_ctx() -> dict:
    try:
        return _request_ctx.get() or {}
    except Exception:  # pragma: no cover - defensive
        return {}


@contextlib.contextmanager
def llm_trace_scope(query: str, model: Optional[str]):
    """Nest the auto-captured Anthropic generation(s) under a named, tagged trace.

    No-op (yields None) when tracing is disabled or span setup fails. Body
    exceptions are recorded on the span and re-raised (the caller's own
    try/except still handles them) — never swallowed here.
    """
    client = _state["client"] if _state["enabled"] else None
    if client is None:
        yield None
        return

    # Enter the wrapping span. If this fails, run the body untraced.
    try:
        cm = _open_trace_span(client)
        if cm is None:
            logger.warning("[langfuse] no span API on client (langfuse %s) — running untraced", _lf_version())
            yield None
            return
        cm.__enter__()
    except Exception as e:
        logger.warning("[langfuse] span setup failed (%s) — running untraced", e)
        yield None
        return

    try:
        ctx = _safe_ctx()
        intent = ctx.get("intent") or "general"
        meta = {"resolved_model": model}
        for k in ("referrer", "turn", "intent"):
            if ctx.get(k) is not None:
                meta[k] = ctx[k]
        try:
            client.update_current_trace(
                name="ai-chat-response",
                input=query,
                session_id=ctx.get("session_id"),
                tags=["ai-chat", f"model:{model}", f"intent:{intent}"],
                metadata=meta,
            )
        except Exception as e:
            logger.warning("[langfuse] trace attribute set failed: %s", e)
        yield client
    finally:
        # Pass current exc info so the span records error status; __exit__ returns
        # falsy so any body exception still propagates to the caller.
        try:
            cm.__exit__(*sys.exc_info())
        except Exception:  # pragma: no cover - defensive
            pass


def flush() -> None:
    """Flush buffered spans. The long-running server flushes on its own interval,
    so per-request flush is unnecessary; exposed for scripts/tests."""
    try:
        if _state["client"] is not None:
            _state["client"].flush()
    except Exception:  # pragma: no cover - defensive
        pass
