"""fetch_live retries transient prod-API failures (e.g. Railway mid-redeploy).
No network, no sleeping (both mocked)."""
from unittest.mock import MagicMock

import httpx
import pytest

import pull_live_user_writes as pl


def _client(get_side_effect):
    """A mock httpx.Client usable as a context manager, with get() scripted."""
    c = MagicMock()
    c.__enter__ = MagicMock(return_value=c)
    c.__exit__ = MagicMock(return_value=False)
    c.get = MagicMock(side_effect=get_side_effect)
    return c


def _ok_response():
    r = MagicMock()
    r.raise_for_status = MagicMock()
    r.json = MagicMock(return_value={"tables": {}, "counts": {}})
    return r


def test_fetch_live_retries_transient_then_succeeds(monkeypatch):
    monkeypatch.setattr(pl, "ADMIN_KEY", "test-key")
    monkeypatch.setattr(pl.time, "sleep", lambda *_: None)
    client = _client([httpx.ConnectError("boom"), httpx.ReadTimeout("slow"), _ok_response()])
    monkeypatch.setattr(pl.httpx, "Client", lambda **kw: client)
    assert pl.fetch_live() == {"tables": {}, "counts": {}}
    assert client.get.call_count == 3


def test_fetch_live_gives_up_after_attempts(monkeypatch):
    monkeypatch.setattr(pl, "ADMIN_KEY", "test-key")
    monkeypatch.setattr(pl.time, "sleep", lambda *_: None)
    client = _client(httpx.ConnectError("down"))  # always fails
    monkeypatch.setattr(pl.httpx, "Client", lambda **kw: client)
    with pytest.raises(httpx.TransportError):
        pl.fetch_live(attempts=2)
    assert client.get.call_count == 2


def test_fetch_live_does_not_retry_4xx(monkeypatch):
    monkeypatch.setattr(pl, "ADMIN_KEY", "test-key")
    monkeypatch.setattr(pl.time, "sleep", lambda *_: None)
    resp = MagicMock(); resp.status_code = 401
    bad = MagicMock()
    bad.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("unauthorized", request=MagicMock(), response=resp))
    client = _client([bad])
    monkeypatch.setattr(pl.httpx, "Client", lambda **kw: client)
    with pytest.raises(httpx.HTTPStatusError):
        pl.fetch_live()
    assert client.get.call_count == 1  # no retry on 4xx
