"""Conditional-write logic for the canonical DB upload. No network, no real R2."""
from unittest.mock import MagicMock

import botocore.exceptions
import pytest

import upload_db_to_r2 as up


def _gz(tmp_path):
    p = tmp_path / "snap.db.gz"
    p.write_bytes(b"\x1f\x8b\x08gzipbytes")
    return p


def test_conditional_put_uses_if_match_and_returns_new_etag(tmp_path):
    client = MagicMock()
    client.put_object.return_value = {"ETag": '"new-etag"'}
    etag = up.upload_snapshot(client, _gz(tmp_path), '"old-etag"')
    assert etag == '"new-etag"'
    _, kwargs = client.put_object.call_args
    assert kwargs["IfMatch"] == '"old-etag"'
    assert kwargs["Key"] == up.LIVE_DB_KEY


def test_412_raises_R2Conflict(tmp_path):
    client = MagicMock()
    client.put_object.side_effect = botocore.exceptions.ClientError(
        {"Error": {"Code": "PreconditionFailed"}, "ResponseMetadata": {"HTTPStatusCode": 412}},
        "PutObject",
    )
    with pytest.raises(up.R2Conflict):
        up.upload_snapshot(client, _gz(tmp_path), '"old-etag"')


def test_create_only_when_no_base(tmp_path):
    client = MagicMock()
    client.put_object.return_value = {"ETag": '"first"'}
    up.upload_snapshot(client, _gz(tmp_path), None)
    _, kwargs = client.put_object.call_args
    assert kwargs["IfNoneMatch"] == "*"
    assert "IfMatch" not in kwargs


def test_force_does_blind_upload(tmp_path):
    client = MagicMock()
    client.head_object.return_value = {"ETag": '"after-force"'}
    etag = up.upload_snapshot(client, _gz(tmp_path), '"old"', force=True)
    client.upload_file.assert_called_once()
    client.put_object.assert_not_called()
    assert etag == '"after-force"'


def test_archive_current_copies_live_to_history():
    client = MagicMock()
    client.head_object.return_value = {"ETag": '"x"'}
    dest = up.archive_current(client, stamp="20260707T120000Z")
    assert dest == "live/history/chideals.db.20260707T120000Z.gz"
    _, kwargs = client.copy_object.call_args
    assert kwargs["Key"] == dest
    assert kwargs["CopySource"] == {"Bucket": up.R2_BUCKET, "Key": up.LIVE_DB_KEY}


def test_archive_current_noop_when_no_live():
    client = MagicMock()
    client.head_object.side_effect = botocore.exceptions.ClientError(
        {"Error": {"Code": "404"}, "ResponseMetadata": {"HTTPStatusCode": 404}}, "HeadObject")
    assert up.archive_current(client) is None
    client.copy_object.assert_not_called()


def test_prune_history_keeps_newest():
    client = MagicMock()
    keys = [f"live/history/chideals.db.2026070{i}T000000Z.gz" for i in range(1, 8)]  # 7, ascending
    client.list_objects_v2.return_value = {"Contents": [{"Key": k} for k in keys]}
    n = up.prune_history(client, keep=5)
    assert n == 2
    deleted = [c.kwargs["Key"] for c in client.delete_object.call_args_list]
    assert deleted == keys[:2]  # two oldest


def test_prune_history_noop_when_under_keep():
    client = MagicMock()
    client.list_objects_v2.return_value = {"Contents": [{"Key": "live/history/a.gz"}]}
    assert up.prune_history(client, keep=5) == 0
    client.delete_object.assert_not_called()
