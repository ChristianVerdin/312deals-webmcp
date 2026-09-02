"""backup_subscribers --from-api: source subscribers+submissions from the prod
admin export (for CI) instead of the local DB. No network — fetch_live mocked."""
import backup_subscribers as bs
import pull_live_user_writes as pl


def test_table_data_from_api_extracts_only_backup_tables(monkeypatch):
    payload = {"tables": {
        "subscribers": [{"id": 1, "email": "a@b.com"}],
        "submissions": [{"id": 5, "text": "deal tip"}],
        "deal_reports": [{"id": 9}],           # present in export, NOT backed up
        "chat_logs": [{"id": 3}],
    }}
    monkeypatch.setattr(pl, "fetch_live", lambda since=None: payload)
    data = bs.table_data_from_api("2026-01-01")
    assert list(data.keys()) == ["subscribers", "submissions"]
    assert data["subscribers"] == [{"id": 1, "email": "a@b.com"}]
    assert data["submissions"] == [{"id": 5, "text": "deal tip"}]


def test_table_data_from_api_missing_tables_default_to_empty(monkeypatch):
    monkeypatch.setattr(pl, "fetch_live", lambda since=None: {"tables": {}})
    data = bs.table_data_from_api()
    assert data == {"subscribers": [], "submissions": []}
