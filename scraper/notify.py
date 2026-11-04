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
QUIET_HOURS = (23, 8)       # di notte il canale non pubblica e gli avvisi personali arrivano senza suono
# Il canale deve restare una selezione: un post alla volta, il migliore disponibile
CHANNEL_MIN_SCORE = 60      # Voto Hunter minimo
CHANNEL_DAILY_MAX = 12      # post in 24 ore
CHANNEL_GAP_MIN = 45        # minuti fra un post e l'altro…
CHANNEL_URGENT_SCORE = 90   # …che non valgono per un affare eccezionale: si esaurisce in fretta
CHANNEL_FRESH_HOURS = 6     # oltre questo tempo dall'ultimo controllo il prezzo non è più affidabile
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


def call(method: str, body: dict) -> dict | None:
    return api(method, json=body)


def post(method: str, chat: str, payload: dict, topic: int | None = None) -> dict | None:
    """Una chiamata alla Bot API verso una chat."""
    body = {"chat_id": chat, "parse_mode": "HTML", **payload}
    if topic:
        body["message_thread_id"] = topic
    return call(method, body)


def upload_photo(chat: str, jpeg: bytes, payload: dict, topic: int | None = None) -> dict | None:
    """sendPhoto con un'immagine generata qui invece di un link."""
    data = {"chat_id": chat, "parse_mode": "HTML", **payload}
    if topic:
        data["message_thread_id"] = topic
    data = {k: json.dumps(v) if isinstance(v, (dict, bool)) else v for k, v in data.items()}
    return api("sendPhoto", data=data, files={"photo": ("offerta.jpg", jpeg, "image/jpeg")})


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


def _deliver(chat: str, topic: int | None, d: dict, caption: str, card: bytes | None, extra: dict):
    """Prima la card, poi la foto Amazon, infine solo il testo. La risposta di Telegram, o None se non è partito."""
    photo = big_image(d.get("image_url"))
    return (
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
        sent = bool(_deliver(chat, topic, d, caption, card, {"reply_markup": markup})) or sent
    return sent


def send_personal(chat: str, d: dict, caption: str, card: bytes | None, rows: list, silent: bool) -> bool:
    """Avviso su misura a una persona che usa il bot."""
    return bool(_deliver(chat, None, d, caption, card, {"reply_markup": {"inline_keyboard": rows}, "disable_notification": silent}))


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


def channel_next(deals: list[dict], published: dict, now: float, hour: int, min_margin: float, min_profit: float) -> dict | None:
    """La prossima offerta da pubblicare: la migliore fra quelle pronte, nel rispetto del ritmo del canale."""
    if is_quiet_hour(hour):
        return None
    recent = [v["ts"] for v in published.values() if now - v["ts"] < 86400]
    if len(recent) >= CHANNEL_DAILY_MAX:
        return None
    ready = [d for d in deals
             if hunter_score(d) >= CHANNEL_MIN_SCORE
             and float(d["margin_pct"]) >= min_margin and float(d["profit_eur"]) >= min_profit
             and now - datetime.fromisoformat(d["checked_at"].replace("Z", "+00:00")).timestamp() < CHANNEL_FRESH_HOURS * 3600
             and channel_wants(d, float(d["used_price"]), published.get(d["asin"]), now)]
    best = max(ready, key=hunter_score, default=None)
    if best and hunter_score(best) < CHANNEL_URGENT_SCORE and now - max(recent, default=0) < CHANNEL_GAP_MIN * 60:
        return None
    return best


def channel_edit_needed(last: dict, price: float) -> bool:
    """Il post già uscito va corretto? Sì se il prezzo è salito rispetto al post o se torna al suo posto.
    Se scende sotto il prezzo del post non serve: si ripubblica."""
    shown = last.get("shown", last["price"])
    if abs(price - shown) < shown * NEW_LOW_DROP:
        return False
    return price > last["price"] or shown > last["price"]


def edit_channel_post(message_id: int, d: dict, discount_pct: float, posted: float, price: float) -> bool:
    """Chi apre il canale dopo non deve trovare un prezzo che non vale più."""
    note = f"⚠️ <b>Prezzo salito</b>: nel post era {eur(posted)}, ora {eur(price)}\n\n" if price > posted else ""
    caption = note + format_deal(d, discount_pct)
    return bool(call("editMessageCaption", {"chat_id": config.TELEGRAM_CHANNEL_ID, "message_id": message_id, "parse_mode": "HTML",
                                            "caption": caption[:CAPTION_MAX], "reply_markup": {"inline_keyboard": _channel_rows(d)}}))


def is_quiet_hour(hour: int) -> bool:
    start, end = QUIET_HOURS
    return hour >= start or hour < end


def _channel_rows(d: dict) -> list:
    return deal_buttons(d, source="canale") + [[{"text": "🔔 Avvisami se il prezzo scende", "url": bot_link(f"w_{d['asin']}")}]]


def send_channel(d: dict, discount_pct: float, previous: float | None = None, checked: str | None = None) -> int | bool:
    """Post nel canale pubblico TELEGRAM_CHANNEL_ID: card, didascalia e pulsanti, senza ☆ e ✕.
    Il numero del messaggio, per poterlo correggere dopo; False se non è partito."""
    extra = {"reply_markup": {"inline_keyboard": _channel_rows(d)}}
    res = _deliver(config.TELEGRAM_CHANNEL_ID, None, d, format_deal(d, discount_pct, previous, checked),
                   deal_card(d, discount_pct, previous), extra)
    if not res:
        return False
    result = res.get("result") if isinstance(res, dict) else None
    return result["message_id"] if isinstance(result, dict) and "message_id" in result else True


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


def out_url(asin: str, source: str) -> str:
    """Link ad Amazon. Passa dal sito, che conta il clic e la sua provenienza; senza sito va diretto."""
    if config.DASHBOARD_URL:
        return f"{config.DASHBOARD_URL.rstrip('/')}/vai/{asin}?da={source}"
    return f"{config.BASE_URL}/dp/{asin}"


def deal_buttons(d: dict, triage: bool = False, source: str = "avviso") -> list:
    row = [{"text": "🛒 Apri su Amazon", "url": out_url(d["asin"], source)}]
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
