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


# ── Run log: one row per completed 10-image generation ────────────────────────
_RUNS_TABLE = "mariano_runs"


def _estimate_cost_usd(models_used: list[str], cache_hit: bool) -> float:
    """Rough USD cost estimate from the actual model labels returned by the
    cascade. See app/page.tsx (costEstimate memo) for the matching front-end
    numbers; keep them in sync if pricing changes."""
    per_model = {"gemini-pro": 0.10, "gemini-flash": 0.04, "openai": 0.08}
    gemini = sum(per_model.get(m, 0.05) for m in models_used)
    rainforest_plus_claude = 0.0 if cache_hit else 0.028
    return round(gemini + rainforest_plus_claude, 4)


def log_mariano_run(
    asin: str,
    images: list[dict],
    *,
    cache_hit: bool = False,
    duration_ms: int | None = None,
    accent_color: str | None = None,
    palette_hex: list[str] | None = None,
    categoria_effetto: str | None = None,
) -> bool:
    """Persist one row in mariano_runs. Returns True on success, False if
    Supabase isn't configured or the insert failed (silent — pipeline never
    blocks on this)."""
    client = _get_client()
    if not client or not asin:
        return False
    try:
        ok       = [i for i in images if i.get("image_b64")]
        failed   = [i for i in images if not i.get("image_b64")]
        models   = [i.get("model") for i in ok if i.get("model")]
        cost_usd = _estimate_cost_usd(models, cache_hit)

        client.table(_RUNS_TABLE).insert({
            "asin": asin,
            "cache_hit": bool(cache_hit),
            "num_images_ok": len(ok),
            "num_images_failed": len(failed),
            "duration_ms": duration_ms,
            "cost_usd": cost_usd,
            "accent_color": accent_color,
            "palette_hex": palette_hex or [],
            "categoria_effetto": categoria_effetto,
            "models_used": models,
        }).execute()
        return True
    except Exception:
        return False


def list_mariano_runs(limit: int = 50, asin: str | None = None) -> list[dict]:
    """Return recent Mariano runs, most recent first. Empty list on error."""
    client = _get_client()
    if not client:
        return []
    try:
        q = (client.table(_RUNS_TABLE)
             .select("*")
             .order("created_at", desc=True)
             .limit(min(max(1, limit), 200)))
        if asin:
            q = q.ilike("asin", f"%{asin.upper()}%")
        res = q.execute()
        return res.data or []
    except Exception:
        return []
