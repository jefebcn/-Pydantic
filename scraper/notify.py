"""Avvisi Telegram: foto del prodotto con didascalia e pulsanti, niente anteprima del link."""
from __future__ import annotations

import html
import re
import time

import requests

from . import config

CAPTION_MAX = 1024   # limite Telegram per la didascalia di una foto
RETRY_MAX_S = 60     # attesa massima quando Telegram chiede di rallentare (HTTP 429)
NEW_LOW_DROP = 0.01  # entro 24 ore si riavvisa solo se il prezzo scende almeno dell'1%
CHEAPER_NEW = 0.95   # un nuovo di altri venditori sotto il 95% del prezzo Amazon rende il riferimento dubbio


def parse_chats(raw: str) -> list[tuple[str, int | None]]:
    """TELEGRAM_CHAT_ID: una o più chat separate da virgola; "id:topic" per un topic di un gruppo con argomenti.
    Es. "8498296680, -1001234567890:42" → [("8498296680", None), ("-1001234567890", 42)]."""
    out = []
    for part in (p.strip() for p in raw.split(",")):
        chat, _, topic = part.partition(":")
        if chat.strip():
            out.append((chat.strip(), int(topic) if topic.strip().isdigit() else None))
    return out


def call(method: str, body: dict) -> bool:
    """Una chiamata alla Bot API. Se Telegram chiede di rallentare aspetta il tempo indicato e riprova una volta."""
    if not config.TELEGRAM_BOT_TOKEN:
        return False
    url = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/{method}"
    try:
        r = requests.post(url, json=body, timeout=20)
        if r.status_code == 429:
            wait = r.json().get("parameters", {}).get("retry_after", 5)
            time.sleep(min(wait, RETRY_MAX_S))
            r = requests.post(url, json=body, timeout=20)
        return r.ok
    except (requests.RequestException, ValueError):
        return False


def post(method: str, chat: str, payload: dict, topic: int | None = None) -> bool:
    """Una chiamata alla Bot API verso una chat."""
    body = {"chat_id": chat, "parse_mode": "HTML", **payload}
    if topic:
        body["message_thread_id"] = topic
    return call(method, body)


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


def send_deal(d: dict, discount_pct: float, previous: float | None = None) -> bool:
    """Avviso offerta: foto grande del prodotto + didascalia + pulsanti; se la foto non va, solo testo.
    `previous` è il prezzo già avvisato, se questa è una discesa. True se almeno una chat l'ha ricevuto."""
    caption = format_deal(d, discount_pct, previous)
    photo = big_image(d.get("image_url"))
    sent = False
    for chat, topic in parse_chats(config.TELEGRAM_CHAT_ID):
        # in un gruppo chiunque potrebbe premere: ★ e ✕ si danno solo nelle chat private collegate
        markup = {"inline_keyboard": deal_buttons(d, triage=not chat.startswith("-"))}
        ok = bool(photo) and post("sendPhoto", chat, {"photo": photo, "caption": caption[:CAPTION_MAX],
                                                      "reply_markup": markup}, topic)
        ok = ok or post("sendMessage", chat, {"text": caption, "link_preview_options": {"is_disabled": True},
                                              "reply_markup": markup}, topic)
        sent = sent or ok
    return sent


def is_new_low(price: float, floor: float | None) -> bool:
    """Vale un avviso? Sì se nelle ultime 24 ore non è stato avvisato, o se il prezzo è sceso davvero."""
    return floor is None or price <= floor * (1 - NEW_LOW_DROP)


def ref_warning(d: dict) -> str | None:
    """Perché il prezzo del nuovo potrebbe essere gonfiato, o None se viene da Amazon ed è in linea col mercato."""
    amazon, any_new = d.get("new_price"), d.get("new_price_any")
    if amazon is None:
        return "Nuovo solo da altri venditori: verifica il prezzo"
    if any_new is not None and float(any_new) < float(amazon) * CHEAPER_NEW:
        return f"C'è un nuovo più economico a {eur(any_new, 0)}: verifica il margine"
    return None


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


def format_deal(d: dict, discount_pct: float, previous: float | None = None) -> str:
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
    warning = ref_warning(d)
    return "\n".join([
        f"{head} <b>MARGINE {margin:.0f}%</b>  ·  <b>+{eur(d.get('profit_eur'), 0)}</b>",
        f"{margin_bar(margin)}",
        *([f"📉 <b>Prezzo sceso</b> da {eur(previous)}"] if previous else []),
        "",
        f"<b>{title}</b>",
        f"<i>{details}</i>",
        "",
        f"<pre>{html.escape(table)}</pre>",
        *([f"⚠️ {html.escape(warning)}"] if warning else []),
    ])


def deal_buttons(d: dict, triage: bool = False) -> list:
    row = [{"text": "🛒 Apri su Amazon", "url": f"{config.BASE_URL}/dp/{d['asin']}"}]
    if config.DASHBOARD_URL:
        row.append({"text": "📊 Gestionale", "url": f"{config.DASHBOARD_URL.rstrip('/')}/offerte"})
    return [row, triage_row(d["asin"])] if triage else [row]


def triage_row(asin: str, current: str = "da_valutare") -> list:
    """Pulsanti ☆ e ✕ di un avviso; dopo la scelta resta solo quello per annullarla."""
    if current == "interessante":
        return [{"text": "★ Interessante · annulla", "callback_data": f"t:da_valutare:{asin}"}]
    if current == "ignorato":
        return [{"text": "✕ Ignorata · annulla", "callback_data": f"t:da_valutare:{asin}"}]
    return [{"text": "☆ Interessante", "callback_data": f"t:interessante:{asin}"},
            {"text": "✕ Ignora", "callback_data": f"t:ignorato:{asin}"}]
