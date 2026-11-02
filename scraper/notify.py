"""Avvisi Telegram."""
from __future__ import annotations

import html

import requests

from . import config


def telegram(text: str) -> bool:
    if not config.TELEGRAM_BOT_TOKEN or not config.TELEGRAM_CHAT_ID:
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": config.TELEGRAM_CHAT_ID, "text": text,
                  "parse_mode": "HTML", "disable_web_page_preview": False},
            timeout=15,
        )
        return r.ok
    except requests.RequestException:
        return False


def format_deal(d: dict, discount_pct: float) -> str:
    def eur(v):
        return "—" if v is None else f"{float(v):,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")

    title = html.escape((d.get("title") or d["asin"])[:120])
    url = f"{config.BASE_URL}/dp/{d['asin']}"
    lines = [
        f"🔥 <b>{float(d['margin_pct']):.0f}% di margine</b> · +{eur(d['profit_eur'])}",
        f"<a href=\"{url}\">{title}</a>",
        "",
        f"Seconda Mano: <b>{eur(d['used_price'])}</b> ({html.escape(d.get('used_condition') or '?')})",
        f"Tuo costo (-{discount_pct:.0f}%): <b>{eur(d['your_cost'])}</b>",
        f"Nuovo (rif. media 90gg): {eur(d['ref_price'])}",
    ]
    if config.DASHBOARD_URL:
        lines.append(f"\n<a href=\"{config.DASHBOARD_URL}\">Apri dashboard</a>")
    return "\n".join(lines)
