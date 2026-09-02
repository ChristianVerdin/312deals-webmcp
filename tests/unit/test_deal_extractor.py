"""Unit tests for src/pipeline/deal_extractor.py::extract_deals_from_text.
Claude is fully mocked via get_claude_client(); given canned JSON, the function
must produce the expected structured ExtractionResult / Deal fields.
"""
import src.pipeline.deal_extractor as de


def _fake_client(json_text):
    class _Block:
        text = json_text

    class _Resp:
        content = [_Block()]

    class _Messages:
        def create(self, **kwargs):
            return _Resp()

    class _Client:
        messages = _Messages()

    return _Client()


def test_extracts_structured_deal_fields(monkeypatch):
    payload = (
        '{"venue_name": "Test Tavern", "confidence": 0.9, "deals": ['
        '{"title": "Half-Price Apps", "description": "All apps 50% off", '
        '"days": ["monday", "tuesday"], "start_time": "16:00", "end_time": "18:00", '
        '"food_items": [{"name": "Nachos", "deal_price": 5}], '
        '"drink_items": [{"name": "Draft Beer", "deal_price": 3}]}]}'
    )
    monkeypatch.setattr(de, "get_claude_client", lambda: _fake_client(payload))

    result = de.extract_deals_from_text(
        "raw scraped markdown", "https://tavern.com", venue_name_hint="Test Tavern"
    )

    assert result.confidence == 0.9
    assert len(result.deals) == 1
    deal = result.deals[0]
    assert deal.title == "Half-Price Apps"
    assert deal.venue_name == "Test Tavern"
    assert deal.source_url == "https://tavern.com"
    assert len(deal.food_items) == 1
    assert len(deal.drink_items) == 1


def test_parses_code_fenced_json(monkeypatch):
    payload = '```json\n{"venue_name": "X", "confidence": 0.7, "deals": [{"title": "BOGO Wings"}]}\n```'
    monkeypatch.setattr(de, "get_claude_client", lambda: _fake_client(payload))

    result = de.extract_deals_from_text("txt", "https://x.com")

    assert len(result.deals) == 1
    assert result.deals[0].title == "BOGO Wings"
    assert result.confidence == 0.7


def test_all_attempts_fail_returns_empty(monkeypatch):
    monkeypatch.setattr(de, "get_claude_client", lambda: _fake_client("not json at all"))
    monkeypatch.setattr(de.time, "sleep", lambda *a, **k: None)  # skip retry backoff

    result = de.extract_deals_from_text("txt", "https://x.com")

    assert result.deals == []
    assert result.confidence == 0.0
