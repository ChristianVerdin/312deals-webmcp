"""Guard for the read-only R2->local DB sync. No network."""
import sqlite3

import pytest

import fetch_db_from_r2 as f


def _good_db(path):
    c = sqlite3.connect(path)
    for i in range(6):
        c.execute(f"CREATE TABLE t{i} (id INTEGER)")
    c.commit(); c.close()


def test_guard_passes_on_good_db(tmp_path):
    p = tmp_path / "ok.db"
    _good_db(p)
    f.guard_sqlite(p, byte_floor=0)  # no raise


def test_guard_trips_on_truncated_file(tmp_path):
    p = tmp_path / "short.db"
    p.write_bytes(b"not a database")
    with pytest.raises(RuntimeError):
        f.guard_sqlite(p, byte_floor=10_000_000)


def test_guard_trips_on_too_few_tables(tmp_path):
    p = tmp_path / "thin.db"
    c = sqlite3.connect(p); c.execute("CREATE TABLE only (id INTEGER)"); c.commit(); c.close()
    with pytest.raises(RuntimeError):
        f.guard_sqlite(p, byte_floor=0)
