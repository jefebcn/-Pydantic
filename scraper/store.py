"""Scrittura/lettura su Supabase via REST (PostgREST), senza SDK."""
from __future__ import annotations

from datetime import datetime, timezone

import requests

from . import config


class Store:
    def __init__(self) -> None:
        if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
            raise SystemExit("Mancano SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in scraper/.env")
        self.base = f"{config.SUPABASE_URL}/rest/v1"
        self.h = {
            "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        }

    def _req(self, method: str, path: str, **kw):
        r = requests.request(method, f"{self.base}/{path}", headers={**self.h, **kw.pop("headers", {})},
                             timeout=20, **kw)
        if r.status_code >= 400:
            raise RuntimeError(f"Supabase {method} {path}: {r.status_code} {r.text[:300]}")
        return r.json() if r.text else None

    def upsert_product(self, asin: str, title: str, category: str, image_url: str | None) -> None:
        row = {"asin": asin, "title": title[:500], "category": category,
               "last_seen_at": datetime.now(timezone.utc).isoformat()}
        if image_url:
            row["image_url"] = image_url
        self._req("POST", "products?on_conflict=asin", json=row,
                  headers={"Prefer": "resolution=merge-duplicates,return=minimal"})

    def add_snapshot(self, asin: str, used_price, used_condition, new_price, new_price_any) -> None:
        self._req("POST", "price_snapshots", json={
            "asin": asin, "used_price": used_price, "used_condition": used_condition,
            "new_price": new_price, "new_price_any": new_price_any,
        }, headers={"Prefer": "return=minimal"})

    def deal(self, asin: str) -> dict | None:
        rows = self._req("GET", f"deals_v?asin=eq.{asin}&select=*")
        return rows[0] if rows else None

    def settings(self) -> dict:
        rows = self._req("GET", "settings?id=eq.1&select=*")
        return rows[0] if rows else {}

    def already_alerted(self, asin: str, used_price: float) -> bool:
        rows = self._req("GET", f"alerts?asin=eq.{asin}&used_price=eq.{used_price}"
                                f"&sent_at=gt.{_hours_ago(24)}&select=id&limit=1")
        return bool(rows)

    def mark_alerted(self, asin: str, used_price: float) -> None:
        self._req("POST", "alerts", json={"asin": asin, "used_price": used_price},
                  headers={"Prefer": "return=minimal"})


def _hours_ago(h: float) -> str:
    from datetime import timedelta
    return (datetime.now(timezone.utc) - timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ")
