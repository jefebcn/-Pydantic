"""
Supabase-backed cache for the Mariano pipeline.

Cache key: ASIN.
Stored: the full prompts.json dict from generate_mariano_prompts.

All operations fail SILENTLY (return None / no-op) when Supabase credentials are
missing or the table doesn't exist — the pipeline must keep working without cache.
"""
import json
import os
from typing import Any

try:
    from supabase import create_client, Client as SupabaseClient
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False


# Cache table name (matches schema.sql `products`)
_TABLE = "mariano_cache"

# In-process memoized client (per warm function instance)
_client: Any = None


def _get_client():
    """Return a Supabase client if creds are present, else None. Idempotent."""
    global _client
    if _client is not None:
        return _client
    if not SUPABASE_AVAILABLE:
        return None
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key or url.startswith("https://test."):
        return None
    try:
        _client = create_client(url, key)
        return _client
    except Exception:
        return None


def get_mariano(asin: str) -> dict | None:
    """Return cached prompts.json for the ASIN, or None on miss/error."""
    client = _get_client()
    if not client or not asin:
        return None
    try:
        res = client.table(_TABLE).select("prompts_json").eq("asin", asin).limit(1).execute()
        if res.data:
            payload = res.data[0].get("prompts_json")
            if isinstance(payload, str):
                return json.loads(payload)
            if isinstance(payload, dict):
                return payload
    except Exception:
        # Table missing / network glitch / RLS — pipeline must continue.
        return None
    return None


def set_mariano(asin: str, prompts_json: dict) -> bool:
    """Upsert the prompts.json for the ASIN. Returns True on success."""
    client = _get_client()
    if not client or not asin or not isinstance(prompts_json, dict):
        return False
    try:
        # Strip the heavy _analysis debug payload before caching (we only need the
        # public fields used by /api/generate-mariano-images).
        clean = {k: v for k, v in prompts_json.items() if k != "_analysis"}
        client.table(_TABLE).upsert({
            "asin": asin,
            "prompts_json": clean,
        }).execute()
        return True
    except Exception:
        return False
