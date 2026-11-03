"""Avvisi Telegram: foto del prodotto con didascalia e pulsanti, niente anteprima del link."""
from __future__ import annotations

import html
import re

import requests

from . import config

CAPTION_MAX = 1024   # limite Telegram per la didascalia di una foto


def parse_chats(raw: str) -> list[tuple[str, int | None]]:
    """TELEGRAM_CHAT_ID: una o più chat separate da virgola; "id:topic" per un topic di un gruppo con argomenti.
    Es. "8498296680, -1001234567890:42" → [("8498296680", None), ("-1001234567890", 42)]."""
    out = []
    for part in (p.strip() for p in raw.split(",")):
        chat, _, topic = part.partition(":")
        if chat.strip():
            out.append((chat.strip(), int(topic) if topic.strip().isdigit() else None))
    return out


def post(method: str, chat: str, payload: dict, topic: int | None = None) -> bool:
    """Una chiamata alla Bot API verso una chat."""
    if not config.TELEGRAM_BOT_TOKEN:
        return False
    body = {"chat_id": chat, "parse_mode": "HTML", **payload}
    if topic:
        body["message_thread_id"] = topic
    try:
        r = requests.post(f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/{method}", json=body, timeout=20)
        return r.ok
    except requests.RequestException:
        return False


def _api(method: str, payload: dict) -> bool:
    """Manda a tutte le chat configurate; True se almeno una l'ha ricevuto."""
    sent = [post(method, chat, payload, topic) for chat, topic in parse_chats(config.TELEGRAM_CHAT_ID)]
    return any(sent)


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
