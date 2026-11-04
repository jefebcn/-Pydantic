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

    def upsert_products(self, items: list[tuple[str, str, str, str | None]]) -> None:
        """Come upsert_product ma per molti (asin, titolo, categoria, immagine) in una sola richiesta."""
        now = datetime.now(timezone.utc).isoformat()
        rows = [{"asin": a, "title": t[:500], "category": c, "last_seen_at": now, "image_url": i}
                for a, t, c, i in items]
        # PostgREST vuole le stesse chiavi in ogni riga: chi non ha immagine va a parte per non cancellarla
        for batch in ([r for r in rows if r["image_url"]],
                      [{k: v for k, v in r.items() if k != "image_url"} for r in rows if not r["image_url"]]):
            if batch:
                self._req("POST", "products?on_conflict=asin", json=batch,
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

    def alert_floor(self, asin: str) -> float | None:
        """Il prezzo più basso già avvisato per questo prodotto nelle ultime 24 ore."""
        rows = self._req("GET", f"alerts?asin=eq.{asin}&sent_at=gt.{_hours_ago(24)}"
                                f"&select=used_price&order=used_price.asc&limit=1")
        return float(rows[0]["used_price"]) if rows else None

    def set_triage(self, asin: str, triage: str) -> None:
        self._req("PATCH", f"products?asin=eq.{asin}", json={"triage": triage}, headers={"Prefer": "return=minimal"})

    def mark_alerted(self, asin: str, used_price: float) -> None:
        self._req("POST", "alerts", json={"asin": asin, "used_price": used_price},
                  headers={"Prefer": "return=minimal"})


def _hours_ago(h: float) -> str:
    from datetime import timedelta
    return (datetime.now(timezone.utc) - timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ")
