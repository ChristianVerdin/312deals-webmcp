"""Shared response sanitization for every public emission path (REST API, MCP server)."""
from __future__ import annotations

import re

PHOTO_URL_KEYS = ("photo_url", "top_venue_photo", "image_url")

# Internal pipeline provenance that must never reach a public surface. The venue
# queries select `v.*`, so every column ships unless it is removed here.
# `data_quality_notes` carries freshness-check closure verdicts, which are
# false-positive-prone review state — it was publishing claims like "The
# California Clipper ... permanently closed in May 2020" about an open bar, on
# 471 active venues. The public signal for a closed venue is is_active=0.
PRIVATE_KEYS = ("data_quality_notes", "notes")


def strip_private_fields(d: dict) -> dict:
    """Drop internal-only columns from a row dict, in place."""
    for k in PRIVATE_KEYS:
        d.pop(k, None)
    return d


def strip_api_key(url: str) -> str:
    """Remove a leaked `key=…` query param from a URL, preserving the rest."""
    url = re.sub(r"([?&])key=[^&]*&", r"\1", url)  # key with trailing params
    url = re.sub(r"[?&]key=[^&]*$", "", url)        # key as last/only param
    return url


def strip_photo_keys(d: dict) -> dict:
    """Strip leaked API keys from the photo-URL fields of a row dict, in place."""
    for k in PHOTO_URL_KEYS:
        v = d.get(k)
        if isinstance(v, str) and "key=" in v:
            d[k] = strip_api_key(v)
    if isinstance(d.get("photo_urls"), list):
        d["photo_urls"] = [
            strip_api_key(u) if isinstance(u, str) and "key=" in u else u
            for u in d["photo_urls"]
        ]
    return d
