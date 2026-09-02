"""Root conftest (loaded first, always) — put the repo root and scripts/ on
sys.path so tests can import package modules (src.pipeline.*, src.scrapers.*)
and the standalone scripts (batch_verify_deals, fetch_db_on_boot, email_events)
the same way the app does.
"""
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
for _p in (ROOT, os.path.join(ROOT, "scripts")):
    if _p not in sys.path:
        sys.path.insert(0, _p)
