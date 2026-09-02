"""Single source of truth for the public corpus figures, Python side.

This module READS `public/product-stats.json` at import time. It does not
query the database and it does not recompute anything: the one computation
lives in `scripts/generate_product_stats.py`, and the TypeScript side
(`src/lib/product-stats.ts`) reads the very same file. That is what keeps the
REST API, the MCP tool descriptions, the newsletter, and the frontend from
drifting apart.

    from src.product_stats import STATS

    STATS.deals          # "78,000+"   display string, floored DOWN
    STATS.neighborhoods  # "149"       exact, not floored
    STATS.raw["deals"]   # 78118       for arithmetic only

Rounding is always DOWN. An overstated figure fails the moment a reviewer
checks the open API, which is exactly how hoynelabs' "14,000+ venues" broke
against a real 13,279 on 2026-08-10.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote

STATS_PATH = Path(__file__).resolve().parent.parent / "public" / "product-stats.json"


def floor_to_thousand(n: int) -> str:
    """Floor to the nearest thousand and suffix "+": 78118 -> "78,000+".

    The one rounding helper, mirroring `floorToThousand` in
    `src/lib/product-stats.ts`. Only meaningful at 1,000 and above; a smaller
    number would render "0+", so it raises instead of publishing a zero.
    """
    if n < 1000:
        raise ValueError(
            f"floor_to_thousand({n}): below 1,000 would render '0+'. "
            "Use exact() for small counts."
        )
    return f"{n // 1000 * 1000:,}+"


def floor_to_thousand_plain(n: int) -> str:
    """Floor to the nearest thousand WITHOUT the '+' suffix: 78118 -> '78,000'.

    For prose that already carries the approximation ("over 78,000 deals"),
    where a "+" would read as "over 78,000+".
    """
    if n < 1000:
        raise ValueError(
            f"floor_to_thousand_plain({n}): below 1,000 would render '0'. "
            "Use exact() for small counts."
        )
    return f"{n // 1000 * 1000:,}"


def exact(n: int) -> str:
    """Render an exact count with thousands separators and no '+' suffix."""
    return f"{n:,}"


@dataclass(frozen=True)
class ProductStats:
    """Display-ready figures, plus the raw counts they came from."""

    deals: str
    venues: str
    neighborhoods: str
    sources: str
    generated_at: str
    raw: dict[str, Any]

    @property
    def plain(self) -> dict[str, str]:
        """Floored figures without the '+', for prose that says "over"."""
        return {
            "deals": floor_to_thousand_plain(self.raw["deals"]),
            "venues": floor_to_thousand_plain(self.raw["venues"]),
            "neighborhoods": exact(self.raw["neighborhoods"]),
            "sources": floor_to_thousand_plain(self.raw["sources"]),
        }

    @property
    def encoded(self) -> dict[str, str]:
        """URL-encoded copies, for `/api/og` share-card query strings."""
        return {
            "deals": quote(self.deals),
            "venues": quote(self.venues),
            "neighborhoods": quote(self.neighborhoods),
            "sources": quote(self.sources),
        }


def load(path: Path | None = None) -> ProductStats:
    """Parse the stats JSON into display strings.

    `neighborhoods` is exact rather than floored: it is a small, stable,
    individually enumerable set (the API returns all of them), so a "+" would
    be both wrong and trivially falsifiable.
    """
    raw = json.loads((path or STATS_PATH).read_text())
    return ProductStats(
        deals=floor_to_thousand(raw["deals"]),
        venues=floor_to_thousand(raw["venues"]),
        neighborhoods=exact(raw["neighborhoods"]),
        sources=floor_to_thousand(raw["sources"]),
        generated_at=raw["generated_at"],
        raw=raw,
    )


STATS = load()
