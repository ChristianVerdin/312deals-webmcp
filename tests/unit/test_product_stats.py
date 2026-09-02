"""The corpus figures must be one number, computed once, everywhere.

Covers the rounding contract, the Python/TypeScript parity that keeps the API
and the frontend from drifting, the template render, and a regression test for
the 2026-08 drift that a spelling-based sweeper missed for months.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.product_stats import (  # noqa: E402
    ProductStats,
    STATS,
    exact,
    floor_to_thousand,
    floor_to_thousand_plain,
    load,
)


# --------------------------------------------------------------- rounding ---

@pytest.mark.parametrize(
    "raw,expected",
    [
        (78118, "78,000+"),
        (13275, "13,000+"),
        (18158, "18,000+"),
        (1000, "1,000+"),
        (1999, "1,000+"),
        (1_000_000, "1,000,000+"),
    ],
)
def test_floor_to_thousand_rounds_down(raw, expected):
    assert floor_to_thousand(raw) == expected


@pytest.mark.parametrize("raw", [0, 1, 999])
def test_floor_to_thousand_refuses_to_publish_zero(raw):
    """Below 1,000 the helper would render "0+" — a public claim of nothing."""
    with pytest.raises(ValueError):
        floor_to_thousand(raw)


def test_floor_to_thousand_never_rounds_up():
    """An overstated figure is falsifiable against the open API. Never round up."""
    for raw in range(10_000, 10_010):
        assert int(floor_to_thousand(raw).rstrip("+").replace(",", "")) <= raw


def test_plain_variant_drops_the_plus():
    assert floor_to_thousand_plain(78118) == "78,000"
    with pytest.raises(ValueError):
        floor_to_thousand_plain(999)


def test_exact_keeps_small_counts_intact():
    assert exact(149) == "149"
    assert exact(1234) == "1,234"


# ------------------------------------------------------------------ load ----

def test_load_parses_a_written_payload(tmp_path):
    p = tmp_path / "product-stats.json"
    p.write_text(json.dumps({
        "deals": 78118, "venues": 13275, "neighborhoods": 149,
        "sources": 18158, "generated_at": "2026-08-26T00:00:00+00:00",
    }))
    s = load(p)
    assert (s.deals, s.venues, s.neighborhoods, s.sources) == (
        "78,000+", "13,000+", "149", "18,000+")


def test_neighborhoods_is_exact_not_floored():
    """149 floored to a thousand would be "0+". It must stay exact."""
    assert STATS.neighborhoods == str(STATS.raw["neighborhoods"])
    assert "+" not in STATS.neighborhoods


def test_encoded_is_url_safe():
    assert STATS.encoded["deals"] == STATS.deals.replace(",", "%2C").replace("+", "%2B")


def test_python_side_does_not_query_the_database():
    """The one computation lives in the generator; this module only reads JSON."""
    src = (ROOT / "src" / "product_stats.py").read_text()
    assert "sqlite3" not in src
    assert "product-stats.json" in src


# ---------------------------------------------------------------- parity ----

@pytest.mark.skipif(shutil.which("npx") is None, reason="npx not available")
def test_typescript_and_python_agree():
    """Both sides read the same JSON; they must render the same strings.

    Compiles `src/lib/product-stats.ts` standalone and executes it, rather than
    re-implementing the rounding in the test, so a change to only one side
    fails here.
    """
    with tempfile.TemporaryDirectory() as out:
        r = subprocess.run(
            ["npx", "tsc", "src/lib/product-stats.ts", "--outDir", out,
             "--module", "commonjs", "--resolveJsonModule", "--esModuleInterop",
             "--target", "es2019", "--skipLibCheck"],
            cwd=ROOT, capture_output=True, text=True,
        )
        assert r.returncode == 0, r.stdout + r.stderr
        js = Path(out) / "src" / "lib" / "product-stats.js"
        r = subprocess.run(
            ["node", "-e",
             f"const m=require({str(js)!r});"
             "process.stdout.write(JSON.stringify({stats:m.stats,plain:m.statsPlain}))"],
            cwd=ROOT, capture_output=True, text=True,
        )
        assert r.returncode == 0, r.stdout + r.stderr
        ts = json.loads(r.stdout)

    assert ts["stats"] == {
        "deals": STATS.deals, "venues": STATS.venues,
        "neighborhoods": STATS.neighborhoods, "sources": STATS.sources,
    }
    assert ts["plain"] == STATS.plain


# ---------------------------------------------------------------- render ----

def _run(script: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(ROOT / "scripts" / script), *args],
        cwd=ROOT, capture_output=True, text=True,
    )


def test_rendered_surfaces_match_their_templates():
    r = _run("render_public_stats.py", "--check")
    assert r.returncode == 0, r.stdout + r.stderr


def test_no_hard_coded_figures_anywhere():
    r = _run("check_public_stats.py")
    assert r.returncode == 0, r.stdout + r.stderr


def test_every_agent_surface_carries_the_canonical_figures():
    """The files AWS Activate and Google Play actually crawl."""
    surfaces = [
        "public/llms.txt", "public/llms-full.txt", "public/skill.md",
        "public/.well-known/skill.md", "public/.well-known/mcp.json",
        "public/.well-known/webmcp.json", "public/openapi-gpt.json",
        "public/manifest.json", "public/ai.txt", "public/js/webmcp.js",
    ]
    for rel in surfaces:
        text = (ROOT / rel).read_text()
        assert STATS.neighborhoods in text, f"{rel} lost the neighborhood count"
        # Retired figures must not survive anywhere.
        for stale in ("60,000+", "65,000+", "70,000+", "14,000+", "145+"):
            assert stale not in text, f"{rel} still publishes {stale}"


def test_regression_detector_catches_the_2026_08_drift(tmp_path):
    """`130 Chicago neighborhoods` shipped for months because the old sweeper
    matched the literal string "130 neighborhood". The detector must catch the
    spelling it missed."""
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "check_public_stats", ROOT / "scripts" / "check_public_stats.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    missed_spellings = [
        "Find food and drink deals across 130 Chicago neighborhoods and suburbs.",
        "deals across 130 Chicagoland neighborhoods. Updated weekly",
        "chain app deals across 130 city + suburban neighborhoods.",
        "subtitle=70%2C000%2B+deals+across+145%2B+neighborhoods",
        "subtitle=deals+across+128+neighborhoods",
    ]
    for line in missed_spellings:
        hit = any(rx.search(line) for _, rx in mod.DETECTORS)
        assert hit, f"detector missed: {line}"

    # And it must NOT fire on legitimate sub-scope counts or subset claims.
    for line in [
        "Top 10 Chicago neighborhoods ranked by number of food deals",
        "About 50,000 runners loop through 29 neighborhoods",
        "Best+specials+across+73+neighborhoods",
        'zone "city" (56 neighborhoods)',
    ]:
        for label, rx in mod.DETECTORS:
            assert not rx.search(line), f"false positive [{label}]: {line}"


# ------------------------------------------------------- publish plumbing ---

def _generator():
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "generate_product_stats", ROOT / "scripts" / "generate_product_stats.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_generator_rewrites_only_when_a_count_moves():
    """`upload_db_to_r2.py` reads "product-stats.json is dirty" as "the figures
    changed, commit them". A generated_at bump on every run would make that
    signal fire constantly and mean nothing."""
    g = _generator()
    counts = {"deals": 78118, "venues": 13275, "neighborhoods": 149, "sources": 18158}

    assert g.needs_write(None, counts) is True
    assert g.needs_write({**counts, "generated_at": "2026-01-01T00:00:00+00:00"}, counts) is False
    assert g.needs_write({**counts, "deals": 78117}, counts) is True
    assert g.needs_write({"deals": 78118}, counts) is True  # missing keys


def test_upload_regenerates_stats_before_publishing():
    """The published figures must describe the DB being published, so the
    regeneration hangs off the upload rather than off operator memory."""
    src = (ROOT / "scripts" / "upload_db_to_r2.py").read_text()
    assert "def refresh_public_stats()" in src
    assert "generate_product_stats.py" in src
    assert "render_public_stats.py" in src
    # It must run BEFORE the bytes go to R2. Compare call sites inside main(),
    # not raw file offsets -- `def upload_snapshot` is defined further up.
    body = src[src.index("def main()"):]
    assert body.index("refresh_public_stats()") < body.index("upload_snapshot(")


def test_ci_workflows_commit_the_refreshed_figures():
    """Both scheduled publishers push an empty commit to trigger a redeploy;
    that same commit has to carry whatever the regeneration changed."""
    for wf in ("freshness-refresh.yml", "newsletter-ingestion.yml"):
        text = (ROOT / ".github" / "workflows" / wf).read_text()
        assert "scripts/upload_db_to_r2.py" in text, wf
        assert "git add -u -- public templates README.md" in text, wf
        assert "--allow-empty" in text, wf
