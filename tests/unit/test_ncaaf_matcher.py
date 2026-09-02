"""Relevance tests for the college-football deal matcher.

Runs the generated SQL against a tiny in-memory table rather than the live DB,
so the cases stay deterministic as the corpus changes.

Every rejected case below is a REAL false positive found in the Aug 2026 corpus
while sizing this guide. The bare tokens that produced them are the whole reason
this matcher is phrase-scoped:

  "boilermakers"  -> 19 hits, all the DRINK (a shot dropped in a beer)
  "northwestern"  -> 23 hits, mostly "northwestern suburbs" (Chicago geography)
  "notre dame"    ->  5 hits, street and venue names
  "big ten"       -> also matches "Big Ten Tournament", which is basketball

Same class of bug as LIKE '%nfl%' matching "California-iNFLuenced".
"""
import sqlite3

import pytest

from src.api.deals_api import _ncaaf_deal_sql

ACCEPT = [
    ("College Football Game Night Specials", ""),
    ("Illinois Football Gameday Specials", ""),
    ("College Gameday Saturday's: Signature steak sandwich", ""),
    ("Saturday Specials", "College football Saturdays: $9 bombs, $2 sliders"),
    ("Michigan Football Season Kickoff Event", ""),
    ("Watch Party", "Every Notre Dame football game on the big screen"),
    ("Wildcat Saturdays", "Northwestern Wildcats watch party, $5 drafts"),
    ("Hawkeyes Happy Hour", "Every Iowa game, 4PM-7PM"),
    ("Bowl Game Specials", "All bowl games on 12 TVs"),
    ("Purdue Watch Party", "Every Purdue game with $4 drafts"),
]

REJECT = [
    # the drink, not the team
    ("Sip Happens Tuesdays", "$6 boilermakers all night"),
    ("Whiskey Wednesday", "Boilermakers and a shot of Malort"),
    # Chicago geography, not the school
    ("Happy Hour", "Serving the northwestern suburbs since 1994"),
    ("Thursday Specials", "Our northwestern location only"),
    # street / venue names
    ("Italian Community Reception", "Held near Notre Dame Ave"),
    # other sports and other teams
    ("Bears Game Day Specials", "Every Sunday during Bears season"),
    ("Big Ten Tournament Specials", "March basketball, all games on"),
    ("March Madness Party", "Every NCAA basketball game"),
    ("Cubs Day Game Deal", "Wrigleyville tailgate"),
    ("World Cup Watch Party", "Every FIFA match live"),
    ("Blackhawks Hockey Night", "$5 drafts all game"),
    # Found by eyeballing live output, not by the tests above: the basketball
    # final names two schools and never says "basketball", so a nickname
    # include admits it.
    ("National Championship Game Day Specials",
     "Michigan Wolverines vs UConn Huskies National Championship game"),
    ("Final Four Watch Party", "Every Spartans game on the big screen"),
]


@pytest.fixture()
def conn():
    c = sqlite3.connect(":memory:")
    c.execute("CREATE TABLE deals (title TEXT, description TEXT)")
    return c


def _matches(conn, title, description):
    expr = _ncaaf_deal_sql("title || ' ' || COALESCE(description, '')")
    conn.execute("DELETE FROM deals")
    conn.execute("INSERT INTO deals VALUES (?, ?)", (title, description))
    return conn.execute(f"SELECT COUNT(*) FROM deals WHERE {expr}").fetchone()[0] == 1


@pytest.mark.parametrize("title,description", ACCEPT)
def test_accepts_real_college_football(conn, title, description):
    assert _matches(conn, title, description), f"should match: {title!r} / {description!r}"


@pytest.mark.parametrize("title,description", REJECT)
def test_rejects_false_positives(conn, title, description):
    assert not _matches(conn, title, description), f"should NOT match: {title!r} / {description!r}"


def test_matcher_is_registered_for_the_guide():
    """The guide's deals rail calls this; a rename must break loudly."""
    from src.api import deals_api

    assert callable(getattr(deals_api, "_ncaaf_deal_sql", None))


# ── Alumni-card deal ordering ────────────────────────────────────────────────
#
# /venues/college-bars used to order deals `BY d.deal_type, d.title` — both
# columns alphabetical. `daily_special` sorts first and A-Z picks the rest, so
# every alumni card on the football guide rendered "(Daily Special)" and led
# with whatever the alphabet handed back. The three titles below are the real
# rows that shipped on 2026-09-02.

ORDER_COLUMNS = (
    "id INTEGER, venue_id INTEGER, title TEXT, description TEXT, deal_type TEXT, "
    "days_available TEXT, start_time TEXT, end_time TEXT, is_all_day INT, "
    "affiliated_team TEXT, affiliated_league TEXT, quality_score INT, is_verified INT"
)


@pytest.fixture()
def order_conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.execute(f"CREATE TABLE deals ({ORDER_COLUMNS})")
    return c


def _ranked(conn, rows, sport):
    from src.api.deals_api import _college_bar_deal_order

    conn.execute("DELETE FROM deals")
    for i, (title, deal_type, score) in enumerate(rows):
        conn.execute(
            "INSERT INTO deals (id, venue_id, title, description, deal_type, quality_score)"
            " VALUES (?, 1, ?, '', ?, ?)",
            (i, title, deal_type, score),
        )
    order = _college_bar_deal_order(sport)
    return [r["title"] for r in conn.execute(f"SELECT title FROM deals d ORDER BY {order}")]


def test_football_deal_outranks_alphabetically_earlier_junk(order_conn):
    """The live bug: 'Chalk Art Challenge' beat a real gameday special."""
    rows = [
        ("Chalk Art Challenge", "event_driven", 50),
        ("College football Saturdays: $25 domestic buckets", "game_day", 90),
        ("$3 Old Style", "daily_special", 40),
    ]
    assert _ranked(order_conn, rows, "football")[0].startswith("College football Saturdays")


def test_stale_month_lto_is_deranked(order_conn):
    """'May Sandwich of the Month' still rendered in September, because
    season_end is set on 3 of 2,887 active seasonal deals."""
    rows = [
        ("May Sandwich of the Month - The El Jefe", "seasonal_lto", 50),
        ("Happy Hour Mon-Fri 4-6pm, $4 drafts", "happy_hour", 60),
    ]
    assert _ranked(order_conn, rows, "football")[0].startswith("Happy Hour")


def test_stale_lto_still_shows_when_it_is_all_a_venue_has(order_conn):
    """Deranking must not become filtering — a bar with one deal still shows it."""
    rows = [("May Sandwich of the Month - The El Jefe", "seasonal_lto", 50)]
    assert _ranked(order_conn, rows, "football") == ["May Sandwich of the Month - The El Jefe"]


def test_basketball_does_not_promote_football(order_conn):
    """March Madness guide shares this endpoint; sport must steer it."""
    rows = [
        ("College football Saturdays: $25 buckets", "game_day", 90),
        ("March Madness watch party, $5 drafts", "game_day", 90),
    ]
    assert _ranked(order_conn, rows, "basketball")[0].startswith("March Madness")


def test_no_sport_keeps_a_deterministic_order(order_conn):
    """Other callers pass no sport and must still get a stable, sane list."""
    rows = [
        ("Zebra Night", "daily_special", 10),
        ("Happy Hour", "happy_hour", 90),
    ]
    assert _ranked(order_conn, rows, None) == ["Happy Hour", "Zebra Night"]


def test_stale_month_matcher_respects_word_boundaries(order_conn):
    """'Marching Band Night' is not a stale March promo, and 'Mayor's Special'
    is not a stale May one. LIKE '%march%' would call both stale."""
    rows = [
        ("Marching Band Night", "event_driven", 50),
        ("College football Saturdays: $25 buckets", "game_day", 60),
    ]
    # The football deal still wins on relevance, but the band night must not be
    # deranked as stale — assert the matcher itself, not just the ordering.
    from src.api.deals_api import _stale_month_sql

    expr = _stale_month_sql("d.title || ' ' || COALESCE(d.description, '')")
    order_conn.execute("DELETE FROM deals")
    for i, (title, dt, sc) in enumerate(rows):
        order_conn.execute(
            "INSERT INTO deals (id, venue_id, title, description, deal_type, quality_score)"
            " VALUES (?, 1, ?, '', ?, ?)", (i, title, dt, sc))
    flagged = [r["title"] for r in
               order_conn.execute(f"SELECT title FROM deals d WHERE {expr}")]
    assert flagged == [], f"falsely flagged as stale: {flagged}"
