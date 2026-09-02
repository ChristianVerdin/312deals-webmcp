"""
Deterministic title-based deal classification.

The Gemini freshness harvester writes every discovered special with a hardcoded
deal_type='daily_special', days_available='[]' and quality_score=40. These tests
pin the shared classifier that replaces those three constants, for both the
writer and the one-time backfill.

Precision over recall throughout: a wrong deal_type mislabels a page, but a
wrong `days_available` makes a deal show up on the wrong weekday page, which is
worse. When the title is ambiguous we return nothing and leave the row alone.
"""

import pytest

from src.pipeline.deal_classify import classify_deal_type, parse_days, score_quality


# --------------------------------------------------------------------------
# deal_type
# --------------------------------------------------------------------------

class TestClassifyDealType:
    @pytest.mark.parametrize("title", [
        "Happy Hour: Tuesday-Friday 4pm-7pm & Saturday 5pm-7pm",
        "Happy Hour Drink Specials: $5 Beers, $8 Margaritas",
        "HAPPY-HOUR food specials: $7 Elote",
    ])
    def test_happy_hour(self, title):
        assert classify_deal_type(title) == "happy_hour"

    @pytest.mark.parametrize("title", [
        "Late Night Menu: half-price apps after 10pm",
        "Late-Night Happy Hour: discounted wings and draft beers",
        "Reverse Happy Hour Sun & Mon 10pm-12am: $3 Domestics",
        "Night owl special until 2am",
    ])
    def test_late_night_outranks_happy_hour(self, title):
        """'Late-Night Happy Hour' is a late_night deal, not a happy_hour deal.

        /deals/late-night has strong CTR and tiny inventory, so the more
        specific type wins. This matches the precedence already encoded in
        reclassify_thin_types.py, where late_night lists happy_hour as a
        source type it may claim from.
        """
        assert classify_deal_type(title) == "late_night"

    @pytest.mark.parametrize("title", [
        "Weekend Brunch: $15 Bottomless Mimosas (11:00 AM - 3:00 PM)",
        "Brunch Drink Specials: House Bloody Mary ($8.00)",
    ])
    def test_brunch(self, title):
        assert classify_deal_type(title) == "brunch_deal"

    def test_brunch_outranks_happy_hour(self):
        assert classify_deal_type("Brunch Happy Hour, Sundays 10am-2pm") == "brunch_deal"

    @pytest.mark.parametrize("title", [
        "$3.50 mystery shot",
        "$12.95 New York steak sandwich",
        "Lunch Specials: Weekdays 11:30 AM - 3:30 PM",
    ])
    def test_unclassifiable_returns_none(self, title):
        """No signal means no change — the caller keeps the existing type."""
        assert classify_deal_type(title) is None

    def test_bottomless_alone_is_not_brunch(self):
        """'Bottomless' also appears on wings and apps; only mimosas imply brunch."""
        assert classify_deal_type("Bottomless wings $15") is None

    def test_empty_and_none_are_safe(self):
        assert classify_deal_type("") is None
        assert classify_deal_type(None) is None


# --------------------------------------------------------------------------
# days_available
# --------------------------------------------------------------------------

class TestParseDays:
    def test_single_day(self):
        assert parse_days("Taco Tuesday: $1 tacos") == ["tuesday"]

    def test_plural_day(self):
        assert parse_days("Wing Wednesdays") == ["wednesday"]

    def test_explicit_range(self):
        assert parse_days("Happy Hour: Tuesday-Friday 4pm-7pm") == [
            "tuesday", "wednesday", "thursday", "friday"
        ]

    def test_range_plus_extra_day(self):
        assert parse_days("Happy Hour: Tuesday-Friday 4pm-7pm & Saturday 5pm-7pm") == [
            "tuesday", "wednesday", "thursday", "friday", "saturday"
        ]

    def test_abbreviated_range(self):
        assert parse_days("Sat-Sun 10 AM - 3 PM") == ["saturday", "sunday"]

    def test_wrapping_range(self):
        """Sun-Tue wraps past the end of the week, then sorts Monday-first.

        Output order is always canonical week order, never mention order —
        days_available is set-semantics and the API matches it with LIKE on
        individual day names, so a stable order is what matters.
        """
        assert parse_days("Sun-Tue specials") == ["monday", "tuesday", "sunday"]

    def test_ampersand_list(self):
        assert parse_days("Reverse Happy Hour Sun & Mon 10pm-12am") == ["monday", "sunday"]

    def test_comma_list(self):
        assert parse_days("Mon, Wed, Fri only") == ["monday", "wednesday", "friday"]

    def test_weekdays_keyword(self):
        assert parse_days("Weekdays 4:00 PM - 6:00 PM") == [
            "monday", "tuesday", "wednesday", "thursday", "friday"
        ]

    def test_weekend_keyword(self):
        assert parse_days("Weekend Brunch menu") == ["saturday", "sunday"]

    def test_daily_keyword(self):
        assert parse_days("$4.99 Chicken Tenders (Daily 8PM-Close)") == [
            "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
        ]

    def test_every_day_keyword(self):
        assert len(parse_days("Half-price apps every day")) == 7

    def test_result_is_week_ordered_and_deduped(self):
        """Order is Monday-first regardless of mention order, with no repeats."""
        assert parse_days("Friday and Monday and Friday") == ["monday", "friday"]

    def test_no_day_signal_returns_empty(self):
        assert parse_days("$3.50 mystery shot") == []

    def test_explicit_day_beats_generic_keyword(self):
        """"Daily Drink Special - Cape Cod (Monday 11 AM - 9 PM)" is a MONDAY deal.

        "Daily"/"Weekday" is often the series name and the parenthesised day is
        the real signal. Expanding these to the full week put single-day deals
        on every weekday page — the cannibalization `dayStrict` exists to stop.
        Measured 2026-08-18: 2,946 titles carry both signals.
        """
        assert parse_days("Daily Drink Special - Cape Cod (Monday 11 AM - 9 PM)") == ["monday"]
        assert parse_days("Weekday Specials: Wednesday - Pizza - $12") == ["wednesday"]

    def test_explicit_range_beats_generic_keyword(self):
        assert parse_days("Daily Lunch Specials (Monday-Friday All Day - $19.95)") == [
            "monday", "tuesday", "wednesday", "thursday", "friday"
        ]

    def test_generic_keyword_still_applies_when_no_explicit_day(self):
        assert parse_days("Weekday Lunch Special, one free side") == [
            "monday", "tuesday", "wednesday", "thursday", "friday"
        ]
        assert len(parse_days("Late Night Menu 10 PM to 1 AM everyday")) == 7

    def test_empty_and_none_are_safe(self):
        assert parse_days("") == []
        assert parse_days(None) == []

    def test_sundae_does_not_match_sunday(self):
        """Word-boundary matching: substrings inside other words must not count.

        This is the failure mode that produced 'California-iNFLuenced' matching
        an NFL filter, recorded in feedback_sql_substring_matcher_word_boundary.
        """
        assert parse_days("$5 hot fudge sundae") == []

    def test_monday_inside_a_word_does_not_match(self):
        assert parse_days("Mondayish vibes") == []

    def test_march_is_not_a_day(self):
        assert parse_days("March Madness viewing party") == []


# --------------------------------------------------------------------------
# quality_score
# --------------------------------------------------------------------------

class TestScoreQuality:
    def test_richer_titles_score_higher(self):
        bare = score_quality("Specials", None, [])
        rich = score_quality(
            "Happy Hour: Tuesday-Friday 4pm-7pm, $5 drafts and $8 margaritas",
            "happy_hour",
            ["tuesday", "wednesday", "thursday", "friday"],
        )
        assert rich > bare

    def test_price_signal_adds_score(self):
        assert score_quality("$5 drafts", None, []) > score_quality("drafts", None, [])

    def test_time_window_adds_score(self):
        assert score_quality("Specials 4pm-7pm", None, []) > score_quality("Specials", None, [])

    def test_known_type_adds_score(self):
        assert score_quality("Happy Hour", "happy_hour", []) > score_quality("Happy Hour", None, [])

    def test_days_add_score(self):
        assert score_quality("Deal", None, ["monday"]) > score_quality("Deal", None, [])

    def test_stays_in_range(self):
        for title in ["", "x", "$5 Happy Hour Mon-Fri 4pm-7pm with $8 wine and $10 cocktails"]:
            assert 0 <= score_quality(title, "happy_hour", ["monday"]) <= 100

    def test_never_returns_the_old_hardcoded_default_by_accident(self):
        """A real signal must move the score off 40, or the backfill is pointless."""
        assert score_quality("Happy Hour: Mon-Fri 4pm-7pm, $5 drafts", "happy_hour",
                             ["monday", "friday"]) != 40
