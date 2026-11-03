"""Avvisi Telegram: foto del prodotto con didascalia e pulsanti, niente anteprima del link."""
from __future__ import annotations

import html
import re

import requests

from . import config

CAPTION_MAX = 1024   # limite Telegram per la didascalia di una foto


def _api(method: str, payload: dict) -> bool:
    if not config.TELEGRAM_BOT_TOKEN or not config.TELEGRAM_CHAT_ID:
        return False
    try:
        r = requests.post(f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/{method}",
                          json={"chat_id": config.TELEGRAM_CHAT_ID, "parse_mode": "HTML", **payload}, timeout=20)
        return r.ok
    except requests.RequestException:
        return False


def telegram(text: str, buttons: list | None = None) -> bool:
    """Messaggio di testo semplice (stato dello scanner ecc.), senza anteprima dei link."""
    payload = {"text": text, "link_preview_options": {"is_disabled": True}}
    if buttons:
        payload["reply_markup"] = {"inline_keyboard": buttons}
    return _api("sendMessage", payload)


def send_deal(d: dict, discount_pct: float) -> bool:
    """Avviso offerta: foto grande del prodotto + didascalia + pulsanti; se la foto non va, solo testo."""
    caption, buttons = format_deal(d, discount_pct), deal_buttons(d)
    photo = big_image(d.get("image_url"))
    if photo and _api("sendPhoto", {"photo": photo, "caption": caption[:CAPTION_MAX],
                                    "reply_markup": {"inline_keyboard": buttons}}):
        return True
    return telegram(caption, buttons)


def big_image(url: str | None) -> str | None:
    """Miniatura Amazon (es. ..._AC_UY218_.jpg) → versione da 1000 px."""
    if not url:
        return None
    return re.sub(r"\._[^/]*_\.(jpg|jpeg|png|webp)$", r"._AC_SL1000_.\1", url, flags=re.I)


def eur(v, digits: int = 2) -> str:
    if v is None:
        return "—"
    s = f"{float(v):,.{digits}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} €"


def margin_bar(margin: float, cells: int = 10) -> str:
    full = max(0, min(cells, round(margin / 100 * cells)))
    return "▰" * full + "▱" * (cells - full)


def format_deal(d: dict, discount_pct: float) -> str:
    margin = float(d["margin_pct"])
    head = "🚀" if margin >= 50 else "🔥" if margin >= 40 else "💡"
    title = html.escape((d.get("title") or d["asin"])[:150])
    condition = re.sub(r"^usato\s*[-–]\s*", "", d.get("used_condition") or "", flags=re.I) or "?"
    details = " · ".join(html.escape(x) for x in [f"Usato {condition}", d.get("category") or ""] if x)
    rows = [
        ("Seconda Mano", eur(d.get("used_price"))),
        (f"Tuo costo -{discount_pct:.0f}%", eur(d.get("your_cost"))),
        ("Nuovo rif.", eur(d.get("ref_price"))),
    ]
    table = "\n".join(f"{k:<16}{v:>12}" for k, v in rows)
    return "\n".join([
        f"{head} <b>MARGINE {margin:.0f}%</b>  ·  <b>+{eur(d.get('profit_eur'), 0)}</b>",
        f"{margin_bar(margin)}",
        "",
        f"<b>{title}</b>",
        f"<i>{details}</i>",
        "",
        f"<pre>{html.escape(table)}</pre>",
    ])


def deal_buttons(d: dict) -> list:
    row = [{"text": "🛒 Apri su Amazon", "url": f"{config.BASE_URL}/dp/{d['asin']}"}]
    if config.DASHBOARD_URL:
        row.append({"text": "📊 Gestionale", "url": f"{config.DASHBOARD_URL.rstrip('/')}/offerte"})
    return [row]
