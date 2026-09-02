"""ETag state + HEAD helpers for the R2 conditional-write flow. No network."""
import importlib
from unittest.mock import MagicMock

import botocore.exceptions


def _fresh_r2_util(tmp_path, monkeypatch):
    monkeypatch.setenv("R2_ETAG_STATE_PATH", str(tmp_path / ".r2_db_etag"))
    import r2_util
    return importlib.reload(r2_util)


def test_read_missing_etag_is_none(tmp_path, monkeypatch):
    r2 = _fresh_r2_util(tmp_path, monkeypatch)
    assert r2.read_base_etag() is None


def test_write_then_read_roundtrips(tmp_path, monkeypatch):
    r2 = _fresh_r2_util(tmp_path, monkeypatch)
    r2.write_base_etag('"abc123"')
    assert r2.read_base_etag() == '"abc123"'


def test_head_live_etag_returns_etag(tmp_path, monkeypatch):
    r2 = _fresh_r2_util(tmp_path, monkeypatch)
    client = MagicMock()
    client.head_object.return_value = {"ETag": '"live-etag"'}
    assert r2.head_live_etag(client) == '"live-etag"'
    client.head_object.assert_called_once_with(Bucket=r2.R2_BUCKET, Key=r2.LIVE_DB_KEY)


def test_head_live_etag_missing_object_is_none(tmp_path, monkeypatch):
    r2 = _fresh_r2_util(tmp_path, monkeypatch)
    client = MagicMock()
    client.head_object.side_effect = botocore.exceptions.ClientError(
        {"Error": {"Code": "404"}, "ResponseMetadata": {"HTTPStatusCode": 404}}, "HeadObject"
    )
    assert r2.head_live_etag(client) is None
