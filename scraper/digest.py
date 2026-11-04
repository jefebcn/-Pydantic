"""Il meglio del giorno: un post serale nel canale con le offerte uscite nelle ultime 24 ore e ancora attive."""
from __future__ import annotations

import html
import time
from datetime import datetime

import requests

from . import config
from .bot import live_deals
from .notify import big_image, bot_link, eur, hunter_score, post, ref_warning, upload_photo, is_quiet_hour

DIGEST_HOUR = 19     # dalle 19 in poi, al primo giro finito
MIN_DEALS = 2        # con una sola offerta non è un riepilogo
TOP_DEALS = 5        # nella didascalia; le prime 3 anche nell'immagine
MONTHS = ("gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre",
          "novembre", "dicembre")


def due(state: dict, now: datetime) -> bool:
    return bool(config.TELEGRAM_CHANNEL_ID) and now.hour >= DIGEST_HOUR and state.get("digest_date") != now.date().isoformat()


def pick(live: list[dict], published: dict, now: float) -> list[dict]:
    """Solo ciò che il canale ha già pubblicato di recente: il riepilogo non anticipa nulla e non ha prezzi dubbi."""
    recent = [d for d in live if not ref_warning(d) and now - published.get(d["asin"], {}).get("ts", 0) < 86400]
    return sorted(recent, key=hunter_score, reverse=True)[:TOP_DEALS]


def caption(deals: list[dict], discount: float) -> str:
    medals = ("🥇", "🥈", "🥉", "4.", "5.")
    lines = ["🏆 <b>Il meglio di oggi</b>", ""]
    for medal, d in zip(medals, deals):
        title = html.escape((d.get("title") or d["asin"])[:60])
        lines.append(f"{medal} <a href=\"{config.BASE_URL}/dp/{d['asin']}\">{title}</a>\n"
                     f"    <b>+{eur(d['profit_eur'], 0)}</b> · {float(d['margin_pct']):.0f}% · Voto {hunter_score(d)}")
    lines += ["", f"Guadagni calcolati con sconto {discount:.0f}%. I prezzi cambiano: controlla su Amazon prima di comprare."]
    return "\n".join(lines)


def post_digest(store, published: dict) -> bool:
    """Pubblica il riepilogo. True se è uscito: da quel momento fino a domani non serve altro."""
    from .card import render_digest
    deals = pick(live_deals(store), published, time.time())
    if len(deals) < MIN_DEALS:
        return False
    photos = {}
    for d in deals[:3]:
        try:
            r = requests.get(big_image(d.get("image_url")) or "", timeout=20)
            r.raise_for_status()
            photos[d["asin"]] = r.content
        except requests.RequestException:
            pass  # la riga resta, senza foto
    now = datetime.now()
    rows = [[{"text": "🤖 I tuoi avvisi su misura", "url": bot_link("avvisi")}]]
    if config.DASHBOARD_URL:
        rows.insert(0, [{"text": "📊 Tutte le offerte", "url": f"{config.DASHBOARD_URL.rstrip('/')}/offerte"}])
    discount = float(store.settings().get("discount_pct", config.DISCOUNT_PCT))
    extra = {"caption": caption(deals, discount),"reply_markup": {"inline_keyboard": rows},
             "disable_notification": is_quiet_hour(now.hour)}
    image = render_digest(deals, photos, f"{now.day} {MONTHS[now.month - 1]}")
    return upload_photo(config.TELEGRAM_CHANNEL_ID, image, extra) or post(
        "sendMessage", config.TELEGRAM_CHANNEL_ID,
        {"text": extra["caption"], "reply_markup": extra["reply_markup"], "link_preview_options": {"is_disabled": True}})
