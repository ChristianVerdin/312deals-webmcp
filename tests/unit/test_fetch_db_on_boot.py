"""Unit tests for scripts/fetch_db_on_boot.py boot guards. A fake R2 client feeds
crafted gzips into fetch_db(); nothing touches boto3, R2, or the real DB.
Verifies: byte-floor rejects an undersized file, a non-openable DB exits non-zero,
the table-count guard fires, the happy path installs the DB, and user-write replay
applies / no-ops cleanly.
"""
import gzip
import shutil
import sqlite3

import pytest

import fetch_db_on_boot as fdb


def _make_sqlite(path, n_tables):
    conn = sqlite3.connect(path)
    for i in range(n_tables):
        conn.execute(f"CREATE TABLE t{i} (id INTEGER)")
    conn.commit()
    conn.close()


def _gzip(src, dst):
    with open(src, "rb") as fi, gzip.open(dst, "wb") as fo:
        shutil.copyfileobj(fi, fo)


class _FakeClient:
    """Minimal boto3-style client: download_file copies a prepared gzip into place."""
    def __init__(self, gz_path):
        self._gz = gz_path

    def download_file(self, bucket, key, dest):
        shutil.copyfile(self._gz, dest)


def _prep_gz(tmp_path, n_tables, name="db"):
    raw = tmp_path / f"{name}.db"
    _make_sqlite(raw, n_tables)
    gz = tmp_path / f"{name}.gz"
    _gzip(raw, gz)
    return gz


def test_byte_floor_rejects_undersized_db(tmp_path, monkeypatch):
    gz = _prep_gz(tmp_path, n_tables=6)         # valid, but tiny
    target = tmp_path / "data" / "chideals.db"
    monkeypatch.setattr(fdb, "DB_PATH", target)
    monkeypatch.setattr(fdb, "BYTE_FLOOR", 100 * 1024 * 1024)  # 100 MiB floor

    with pytest.raises(SystemExit):
        fdb.fetch_db(_FakeClient(gz))

    assert not target.exists()   # prior DB retained — never overwritten with a bad one


def test_unopenable_db_exits_nonzero(tmp_path, monkeypatch):
    garbage = tmp_path / "garbage.bin"
    garbage.write_bytes(b"this is not a sqlite database" * 100)
    gz = tmp_path / "g.gz"
    _gzip(garbage, gz)
    target = tmp_path / "chideals.db"
    monkeypatch.setattr(fdb, "DB_PATH", target)
    monkeypatch.setattr(fdb, "BYTE_FLOOR", 0)

    with pytest.raises(SystemExit):
        fdb.fetch_db(_FakeClient(gz))

    assert not target.exists()


def test_table_count_guard_rejects_thin_db(tmp_path, monkeypatch):
    gz = _prep_gz(tmp_path, n_tables=1)          # < 5 tables -> suspect corruption
    target = tmp_path / "chideals.db"
    monkeypatch.setattr(fdb, "DB_PATH", target)
    monkeypatch.setattr(fdb, "BYTE_FLOOR", 0)

    with pytest.raises(SystemExit):
        fdb.fetch_db(_FakeClient(gz))

    assert not target.exists()


def test_happy_path_installs_db(tmp_path, monkeypatch):
    gz = _prep_gz(tmp_path, n_tables=6)
    target = tmp_path / "data" / "chideals.db"
    monkeypatch.setattr(fdb, "DB_PATH", target)
    monkeypatch.setattr(fdb, "BYTE_FLOOR", 0)

    fdb.fetch_db(_FakeClient(gz))

    assert target.exists()
    conn = sqlite3.connect(target)
    ntab = conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
    conn.close()
    assert ntab == 6


class _ReplayBody:
    def __init__(self, data):
        self._data = data

    def read(self):
        return self._data


class _ReplayClient:
    class exceptions:
        class NoSuchKey(Exception):
            pass

    def __init__(self, payload=None, missing=False):
        self._payload = payload
        self._missing = missing

    def get_object(self, Bucket, Key):
        if self._missing:
            raise self.exceptions.NoSuchKey()
        import json
        return {"Body": _ReplayBody(json.dumps(self._payload).encode())}


def test_replay_user_writes_applies(tmp_path, monkeypatch):
    db = tmp_path / "chideals.db"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE subscribers (id INTEGER PRIMARY KEY, email TEXT UNIQUE)")
    conn.commit()
    conn.close()
    monkeypatch.setattr(fdb, "DB_PATH", db)

    payload = {"tables": {"subscribers": [{"id": 1, "email": "a@b.com"}]}}
    fdb.replay_user_writes(_ReplayClient(payload=payload))

    conn = sqlite3.connect(db)
    n = conn.execute("SELECT COUNT(*) FROM subscribers").fetchone()[0]
    conn.close()
    assert n == 1


def test_replay_no_delta_is_noop(tmp_path, monkeypatch):
    db = tmp_path / "chideals.db"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE x (id INTEGER)")
    conn.commit()
    conn.close()
    monkeypatch.setattr(fdb, "DB_PATH", db)

    fdb.replay_user_writes(_ReplayClient(missing=True))  # must not raise


def test_replay_creates_and_fills_email_events(tmp_path, monkeypatch):
    """Durability: replay runs before run_migrations(), so it must create
    email_events itself and merge its delta (not drop it on a missing table)."""
    db = tmp_path / "chideals.db"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE subscribers (id INTEGER PRIMARY KEY, email TEXT)")  # no email_events yet
    conn.commit()
    conn.close()
    monkeypatch.setattr(fdb, "DB_PATH", db)

    payload = {"tables": {"email_events": [
        {"id": 1, "email": "a@b.com", "event_type": "opened", "email_id": "m",
         "link_url": None, "created_at": "2026-07-07T00:00:00"},
    ]}}
    fdb.replay_user_writes(_ReplayClient(payload=payload))

    conn = sqlite3.connect(db)
    n = conn.execute("SELECT COUNT(*) FROM email_events WHERE event_type='opened'").fetchone()[0]
    conn.close()
    assert n == 1
