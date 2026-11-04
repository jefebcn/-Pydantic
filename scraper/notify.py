"""Avvisi Telegram: card grafica del prodotto con didascalia e pulsanti, niente anteprima del link."""
from __future__ import annotations

import html
import json
import re
import time
from datetime import datetime

import requests

from . import config

CAPTION_MAX = 1024   # limite Telegram per la didascalia di una foto
RETRY_MAX_S = 60     # attesa massima quando Telegram chiede di rallentare (HTTP 429)
NEW_LOW_DROP = 0.01  # entro 24 ore si riavvisa solo se il prezzo scende almeno dell'1%
CHEAPER_NEW = 0.95   # un nuovo di altri venditori sotto il 95% del prezzo Amazon rende il riferimento dubbio
CHANNEL_REPOST_DAYS = 7     # il canale ripropone un'offerta già pubblicata solo dopo una settimana o se cala
QUIET_HOURS = (23, 8)       # di notte i post del canale arrivano senza suono
# Voto Hunter, 0-100 (come hunterScore in lib/format.ts): margine fino a 50 punti, guadagno fino a 30, condizioni fino a 20
SCORE_MARGIN_FULL = 60      # margine % che vale tutti i punti
SCORE_PROFIT_FULL = 300     # guadagno in € che vale tutti i punti
SCORE_CONDITIONS = (("come nuovo", 20), ("ottime", 15), ("buone", 10), ("accettabil", 5))
SCORE_CONDITION_UNKNOWN = 8
SCORE_DOUBTFUL_MAX = 40     # con un prezzo del nuovo da verificare il voto non sale oltre


def parse_chats(raw: str) -> list[tuple[str, int | None]]:
    """TELEGRAM_CHAT_ID: una o più chat separate da virgola; "id:topic" per un topic di un gruppo con argomenti.
    Es. "8498296680, -1001234567890:42" → [("8498296680", None), ("-1001234567890", 42)]."""
    out = []
    for part in (p.strip() for p in raw.split(",")):
        chat, _, topic = part.partition(":")
        if chat.strip():
            out.append((chat.strip(), int(topic) if topic.strip().isdigit() else None))
    return out


def api(method: str, **kw) -> dict | None:
    """Una chiamata alla Bot API: la risposta se Telegram accetta, altrimenti None.
    Se Telegram chiede di rallentare aspetta il tempo indicato e riprova una volta."""
    if not config.TELEGRAM_BOT_TOKEN:
        return None
    url = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/{method}"
    try:
        r = requests.post(url, timeout=30, **kw)
        if r.status_code == 429:
            wait = r.json().get("parameters", {}).get("retry_after", 5)
            time.sleep(min(wait, RETRY_MAX_S))
            r = requests.post(url, timeout=30, **kw)
        return r.json() if r.ok else None
    except (requests.RequestException, ValueError):
        return None


def _request(method: str, **kw) -> bool:
    return api(method, **kw) is not None


def call(method: str, body: dict) -> bool:
    return _request(method, json=body)


def post(method: str, chat: str, payload: dict, topic: int | None = None) -> bool:
    """Una chiamata alla Bot API verso una chat."""
    body = {"chat_id": chat, "parse_mode": "HTML", **payload}
    if topic:
        body["message_thread_id"] = topic
    return call(method, body)


def upload_photo(chat: str, jpeg: bytes, payload: dict, topic: int | None = None) -> bool:
    """sendPhoto con un'immagine generata qui invece di un link."""
    data = {"chat_id": chat, "parse_mode": "HTML", **payload}
    if topic:
        data["message_thread_id"] = topic
    data = {k: json.dumps(v) if isinstance(v, (dict, bool)) else v for k, v in data.items()}
    return _request("sendPhoto", data=data, files={"photo": ("offerta.jpg", jpeg, "image/jpeg")})


def telegram(text: str, buttons: list | None = None) -> bool:
    """Messaggio di servizio (stato dello scanner ecc.) alle chat private: nel canale vanno solo le offerte."""
    payload = {"text": text, "link_preview_options": {"is_disabled": True}}
    if buttons:
        payload["reply_markup"] = {"inline_keyboard": buttons}
    sent = [post("sendMessage", chat, payload, topic) for chat, topic in parse_chats(config.TELEGRAM_CHAT_ID)]
    return any(sent)


def deal_card(d: dict, discount_pct: float, previous: float | None = None) -> bytes | None:
    """La card grafica dell'offerta, o None: un problema con foto o Pillow non deve far perdere l'avviso."""
    url = big_image(d.get("image_url"))
    if not url:
        return None
    try:
        from .card import render_card
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        return render_card(d, discount_pct, r.content, previous)
    except Exception:
        return None


def _deliver(chat: str, topic: int | None, d: dict, caption: str, card: bytes | None, extra: dict) -> bool:
    """Prima la card, poi la foto Amazon, infine solo il testo."""
    photo = big_image(d.get("image_url"))
    return bool(
        (card and upload_photo(chat, card, {"caption": caption[:CAPTION_MAX], **extra}, topic))
        or (photo and post("sendPhoto", chat, {"photo": photo, "caption": caption[:CAPTION_MAX], **extra}, topic))
        or post("sendMessage", chat, {"text": caption, "link_preview_options": {"is_disabled": True}, **extra}, topic)
    )


def send_deal(d: dict, discount_pct: float, previous: float | None = None) -> bool:
    """Avviso offerta alle chat di TELEGRAM_CHAT_ID. `previous` è il prezzo già avvisato, se questa è una discesa.
    True se almeno una chat l'ha ricevuto."""
    caption = format_deal(d, discount_pct, previous)
    card = deal_card(d, discount_pct, previous)
    sent = False
    for chat, topic in parse_chats(config.TELEGRAM_CHAT_ID):
        # in un gruppo chiunque potrebbe premere: ★ e ✕ si danno solo nelle chat private collegate
        markup = {"inline_keyboard": deal_buttons(d, triage=not chat.startswith("-"))}
        sent = _deliver(chat, topic, d, caption, card, {"reply_markup": markup}) or sent
    return sent


def send_personal(chat: str, d: dict, caption: str, card: bytes | None, rows: list, silent: bool) -> bool:
    """Avviso su misura a una persona che usa il bot."""
    return _deliver(chat, None, d, caption, card, {"reply_markup": {"inline_keyboard": rows}, "disable_notification": silent})


def fresh_or_lower(price: float, last: dict | None, now: float) -> bool:
    """Niente doppioni: `last` è l'ultima uscita di questo prodotto ({"price", "ts"}).
    Si ripropone se il prezzo cala o dopo CHANNEL_REPOST_DAYS."""
    if not last or now - last["ts"] > CHANNEL_REPOST_DAYS * 86400:
        return True
    return is_new_low(price, last["price"])


def channel_wants(d: dict, price: float, published: dict | None, now: float) -> bool:
    """Il canale è pubblico: solo prezzi verificati e niente doppioni."""
    if not config.TELEGRAM_CHANNEL_ID or ref_warning(d):
        return False
    return fresh_or_lower(price, published, now)


def is_quiet_hour(hour: int) -> bool:
    start, end = QUIET_HOURS
    return hour >= start or hour < end


def send_channel(d: dict, discount_pct: float, previous: float | None = None) -> bool:
    """Post nel canale pubblico TELEGRAM_CHANNEL_ID: card, didascalia e pulsanti, senza ☆ e ✕."""
    rows = deal_buttons(d) + [[{"text": "🔔 Avvisami se il prezzo scende", "url": bot_link(f"w_{d['asin']}")}]]
    extra = {"reply_markup": {"inline_keyboard": rows}, "disable_notification": is_quiet_hour(datetime.now().hour)}
    return _deliver(config.TELEGRAM_CHANNEL_ID, None, d, format_deal(d, discount_pct, previous),
                    deal_card(d, discount_pct, previous), extra)


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


def hunter_score(d: dict) -> int:
    """Un solo numero per confrontare le offerte. Legge il margine di deals_v, non lo ricalcola."""
    margin = max(0.0, min(float(d.get("margin_pct") or 0), SCORE_MARGIN_FULL))
    profit = max(0.0, min(float(d.get("profit_eur") or 0), SCORE_PROFIT_FULL))
    state = (d.get("used_condition") or "").lower()
    condition = next((p for word, p in SCORE_CONDITIONS if word in state), SCORE_CONDITION_UNKNOWN)
    score = int(margin / SCORE_MARGIN_FULL * 50 + profit / SCORE_PROFIT_FULL * 30 + condition + 0.5)
    return min(score, SCORE_DOUBTFUL_MAX) if ref_warning(d) else score


def score_label(d: dict) -> str:
    if ref_warning(d):
        return "Da verificare"
    score = hunter_score(d)
    return "Affare top" if score >= 80 else "Ottimo" if score >= 60 else "Buono" if score >= 40 else "Discreto"


def bot_link(start: str = "") -> str:
    """Link che apre il bot; `start` porta direttamente a una schermata (vedi bot.deep_link)."""
    return f"https://t.me/{config.TELEGRAM_BOT_USERNAME}" + (f"?start={start}" if start else "")


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


def format_deal(d: dict, discount_pct: float, previous: float | None = None, checked: str | None = None) -> str:
    """Didascalia di un'offerta. `checked` sostituisce "Controllato alle…" quando il controllo non è di adesso."""
    margin = float(d["margin_pct"])
    head = "🚀" if margin >= 50 else "🔥" if margin >= 40 else "💡"
    title = html.escape((d.get("title") or d["asin"])[:150])
    condition = re.sub(r"^usato\s*[-–]\s*", "", d.get("used_condition") or "", flags=re.I)
    tag = re.sub(r"\W", "", d.get("category") or "")
    warning = ref_warning(d)
    return "\n".join([
        f"{head} <b>MARGINE {margin:.0f}%</b>  ·  <b>+{eur(d.get('profit_eur'), 0)}</b>",
        f"<b>{title}</b>",
        f"⭐ Voto Hunter <b>{hunter_score(d)}</b>/100 · {score_label(d)}",
        "",
        *([f"📉 <b>Prezzo sceso</b> da <s>{eur(previous)}</s>"] if previous else []),
        f"💰 Seconda Mano: <b>{eur(d.get('used_price'))}</b>",
        f"🏷 Prezzo del nuovo: <s>{eur(d.get('ref_price'))}</s>",
        f"🎟 Con sconto {discount_pct:.0f}%: <b>{eur(d.get('your_cost'))}</b>",
        *([f"📦 Usato: {html.escape(condition)}"] if condition else []),
        *([f"⚠️ {html.escape(warning)}"] if warning else []),
        "",
        f"{f'#{tag} · ' if tag else ''}🕒 {checked or f'Controllato alle {datetime.now():%H:%M}'}",
    ])


def deal_url(asin: str) -> str:
    return f"{config.DASHBOARD_URL.rstrip('/')}/offerte/{asin}"


def deal_buttons(d: dict, triage: bool = False) -> list:
    row = [{"text": "🛒 Apri su Amazon", "url": f"{config.BASE_URL}/dp/{d['asin']}"}]
    if config.DASHBOARD_URL:
        row.append({"text": "📊 Analisi completa", "url": deal_url(d["asin"])})
    return [row, triage_row(d["asin"])] if triage else [row]


def triage_row(asin: str, current: str = "da_valutare") -> list:
    """Pulsanti ☆ e ✕ di un avviso; dopo la scelta resta solo quello per annullarla."""
    if current == "interessante":
        return [{"text": "★ Interessante · annulla", "callback_data": f"t:da_valutare:{asin}"}]
    if current == "ignorato":
        return [{"text": "✕ Ignorata · annulla", "callback_data": f"t:da_valutare:{asin}"}]
    return [{"text": "☆ Interessante", "callback_data": f"t:interessante:{asin}"},
            {"text": "✕ Ignora", "callback_data": f"t:ignorato:{asin}"}]
