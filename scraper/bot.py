"""Il bot Telegram: in chat privata è una piccola app con un solo messaggio che cambia (menu, carosello di card,
avvisi su misura, prodotti seguiti); nei gruppi risponde con elenchi di testo. Gira in un thread accanto allo scanner.

/start, /help      menu e spiegazione; /start accetta avvisi, w_ASIN (segui) e d_ASIN (apri un'offerta) dai link
/top /nuove /cerca sfogliano le offerte, /budget e /categorie le filtrano
/avvisi /seguiti   preferenze personali (scraper/subscribers.py)
/chatid /stato     per chi gestisce il bot; /stato e i pulsanti ☆ e ✕ solo nelle chat collegate

Le offerte sono le stesse del sito pubblico: ignorate e già acquistate restano escluse.
"""
from __future__ import annotations

import html
import json
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Callable

import requests

from . import config, pace, subscribers
from .notify import (api, bot_link, call, deal_card, deal_url, eur, format_deal, hunter_score, parse_chats, post,
                     ref_warning, triage_row)

COMMANDS = [
    ("start", "Apri il menu"),
    ("top", "Le offerte migliori del momento"),
    ("nuove", "Le offerte comparse nelle ultime 24 ore"),
    ("budget", "Offerte per fascia di prezzo"),
    ("categorie", "Offerte per categoria"),
    ("cerca", "Cerca un prodotto, es. /cerca rtx 5070"),
    ("avvisi", "I tuoi avvisi su misura"),
    ("seguiti", "I prodotti di cui segui il prezzo"),
    ("help", "Come funziona"),
]
GROUP_COMMANDS = [("top", "Le offerte migliori del momento"), ("nuove", "Le offerte delle ultime 24 ore"),
                  ("fasce", "Offerte per fascia di prezzo"), ("cerca", "Cerca un prodotto, es. /cerca rtx 5070"),
                  ("chatid", "ID di questa chat"), ("help", "Come funziona")]
OWNER_COMMANDS = COMMANDS + [("stato", "Stato dello scanner"), ("chatid", "ID di questa chat")]

# Un'offerta è attiva se vista entro LIVE_HOURS dall'ultimo giro dello scanner: con le ricerche a rotazione
# (a velocità lenta il giro completo dura 4 ore) e a PC spento non sparisce tutto. Come in app/api/deals/route.ts.
LIVE_HOURS = 6
LIVE_CACHE_S = 30        # ogni pulsante rilegge le offerte: bastano dati di pochi secondi fa
# Le stesse fasce del sito (lib/format.ts): estremo superiore escluso.
BANDS = [("100 – 399 €", 0, 400), ("400 – 649 €", 400, 650), ("650 – 999 €", 650, 1000),
         ("1.000 – 1.599 €", 1000, 1600), ("1.600 – 3.000 €", 1600, 3000.01), ("Oltre 3.000 €", 3000.01, float("inf"))]
LIST_MAX = 10
TOP_MAX = 20             # schede sfogliabili in "Le migliori"
CALLBACK_ARG_MAX = 40    # Telegram accetta 64 byte in un pulsante: il resto serve per il comando e la posizione
FILE_IDS_MAX = 500
TRIAGE_NOTICE = {"interessante": "★ Segnata come interessante", "ignorato": "✕ Ignorata: niente più avvisi",
                 "da_valutare": "↺ Scelta annullata"}

NAME = "Seconda Mano Hunter"
SHORT_DESCRIPTION = "🔥 Il tuo cacciatore di affari su Amazon Seconda Mano: sfoglia, segui i prezzi, avvisi su misura."
DESCRIPTION = (
    "🛒 Controllo di continuo Amazon Seconda Mano e confronto ogni offerta col prezzo del nuovo.\n\n"
    "🏆 Sfoglia le migliori con foto, prezzi e Voto Hunter\n"
    "🔔 Segui un prodotto: ti scrivo se il prezzo scende\n"
    "🎯 Scegli budget e categorie: ricevi solo ciò che ti interessa\n\n"
    "Premi Avvia, è gratis."
)
HELP = (
    "❓ <b>Come funziona</b>\n"
    "Controllo Amazon Seconda Mano e confronto ogni offerta col prezzo del nuovo.\n\n"
    "⭐ <b>Voto Hunter</b> (0-100): margine fino a 50 punti, guadagno fino a 30, condizioni fino a 20. "
    "Con un prezzo del nuovo da verificare non supera 40.\n"
    "🎟 <b>Guadagno e margine</b>: rivendendo al prezzo del nuovo e comprando con lo sconto 22%. "
    "Senza quello sconto e dopo le spese di rivendita sono più bassi.\n"
    "⚠️ <b>Da verificare</b>: il nuovo viene da altri venditori o ne esiste uno più economico.\n\n"
    "⏱ I prezzi cambiano in fretta: controlla sempre su Amazon prima di comprare.\n"
    "🔎 Per cercare, scrivimi semplicemente il nome di un prodotto."
)
GROUP_HELP = (
    f"<b>{NAME}</b>\n"
    "Controllo Amazon Seconda Mano e confronto ogni offerta col prezzo del nuovo.\n\n"
    + "\n".join(f"/{c} — {d}" for c, d in GROUP_COMMANDS)
    + "\n\n⚠️ accanto a un'offerta vuol dire che il prezzo del nuovo va verificato.\n"
    f"Per sfogliarle con le foto e ricevere avvisi su misura: {bot_link()}"
)
CHANNEL_DESCRIPTION = (
    "🔥 Le offerte Amazon Seconda Mano con il margine più alto, appena compaiono.\n"
    "Margini calcolati con sconto del 22%. I prezzi cambiano: controlla sempre su Amazon prima di comprare.\n"
    f"🤖 Avvisi su misura: @{config.TELEGRAM_BOT_USERNAME}"
)
BACK_HOME = {"text": "🏠 Menu", "callback_data": "h"}
EMPTY_TEXT = {"new": "Nessuna offerta nuova nelle ultime 24 ore.",
              "w": "Non segui ancora nessun prodotto.\nApri un'offerta e premi 🔔: ti scrivo se il prezzo scende."}
NO_DEALS = "Nessuna offerta attiva in questo momento."


@dataclass
class Screen:
    """Una schermata del bot: foto, didascalia e pulsanti. `key` evita di rifare e ricaricare la stessa immagine."""
    caption: str
    rows: list
    key: str = "banner"
    image: Callable[[], bytes | None] | None = None


def chat_ref(msg: dict) -> str:
    """ID da scrivere in TELEGRAM_CHAT_ID per questa chat (con :topic se il messaggio è in un topic)."""
    chat = str(msg["chat"]["id"])
    topic = msg.get("message_thread_id") if msg.get("is_topic_message") else None
    return f"{chat}:{topic}" if topic else chat


def is_linked(chat_id) -> bool:
    return str(chat_id) in {c for c, _ in parse_chats(config.TELEGRAM_CHAT_ID)} | {config.TELEGRAM_CHANNEL_ID}


def command_of(text: str) -> str | None:
    """'/top@SecondHandHunter_Bot extra' → 'top'."""
    if not text.startswith("/"):
        return None
    return text.split()[0][1:].split("@")[0].lower()


def args_of(text: str) -> str:
    """'/cerca rtx 5070' → 'rtx 5070'."""
    return " ".join(text.split()[1:])


def _when(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


_live_cache: tuple = (None, 0.0, [])


def live_deals(store) -> list[dict]:
    """Offerte attive da proporre, dalla più redditizia; ignorate e già acquistate escluse."""
    global _live_cache
    if _live_cache[0] is store and time.monotonic() - _live_cache[1] < LIVE_CACHE_S:
        return _live_cache[2]
    rows = store._req("GET", "deals_v?select=asin,title,category,image_url,used_price,used_condition,new_price,new_price_any,"
                             "ref_price,your_cost,profit_eur,margin_pct,triage,first_seen_at,last_seen_at,checked_at"
                             "&margin_pct=not.is.null&order=profit_eur.desc&limit=1000")
    live: list[dict] = []
    if rows:
        since = max(_when(d["last_seen_at"]) for d in rows) - timedelta(hours=LIVE_HOURS)
        live = [d for d in rows if _when(d["last_seen_at"]) > since and d["triage"] not in ("ignorato", "acquistato")]
    _live_cache = (store, time.monotonic(), live)
    return live


def deal_line(i: int, d: dict) -> str:
    title = html.escape((d["title"] or d["asin"])[:70])
    flag = " ⚠️" if ref_warning(d) else ""
    return (f"{i}. <b>{float(d['margin_pct']):.0f}%</b> · +{eur(d['profit_eur'], 0)} · {eur(d['used_price'])}{flag}\n"
            f"<a href=\"{config.BASE_URL}/dp/{d['asin']}\">{title}</a>")


def _deal_list(head: str, deals: list[dict]) -> str:
    return "\n".join([head, "", *(deal_line(i, d) for i, d in enumerate(deals, 1))])


def ago_text(when: datetime) -> str:
    mins = int((datetime.now(timezone.utc) - when).total_seconds() // 60)
    if mins < 1:
        return "adesso"
    return f"{mins} min fa" if mins < 90 else f"{round(mins / 60)} ore fa"


def status_text(store) -> str:
    live = live_deals(store)
    last = store._req("GET", "price_snapshots?select=checked_at&order=checked_at.desc&limit=1")
    s = store.settings()
    margin_min, profit_min = float(s.get("alert_margin_pct", 40)), float(s.get("alert_profit_eur", 50))
    hot = [d for d in live if float(d["margin_pct"]) >= margin_min and float(d["profit_eur"]) >= profit_min]
    doubtful = sum(1 for d in hot if ref_warning(d))
    seen = [_when(d["last_seen_at"]) for d in live] + ([_when(last[0]["checked_at"])] if last else [])
    try:
        state = json.loads(config.STATE_FILE.read_text())
    except (FileNotFoundError, ValueError):
        state = {}
    pause = ""
    if pace.wait_seconds(state):
        pause = f"⏸ In pausa dopo un blocco di Amazon: riparte alle <b>{datetime.fromtimestamp(state['resume_at']):%H:%M}</b>\n"
    best = max((float(d["margin_pct"]) for d in live), default=0)
    return (
        "📡 <b>Stato scanner</b>\n"
        f"{pause}"
        f"Ultimo giro: <b>{ago_text(max(seen)) if seen else 'mai'}</b>\n"
        f"Velocità: <b>{pace.current_level(state, config.SCAN_SPEED)}</b> (massima {config.SCAN_SPEED})\n"
        f"Offerte attive: <b>{len(live)}</b> · sopra soglia: <b>{len(hot)}</b>"
        f"{f' (⚠️ {doubtful} da verificare)' if doubtful else ''}\n"
        f"Miglior margine: <b>{best:.0f}%</b>\n"
        f"Soglie avviso: margine ≥ {margin_min:.0f}% e guadagno ≥ {eur(profit_min, 0)}"
    )


# ── Elenchi di testo per i gruppi ───────────────────────────────────

def top_text(store, arg: str = "") -> str:
    n = min(int(arg), LIST_MAX) if arg.isdigit() and int(arg) > 0 else 5
    # prima i prezzi verificati, come le card del sito: un riferimento gonfiato non deve stare in cima
    live = sorted(live_deals(store), key=lambda d: bool(ref_warning(d)))[:n]
    if not live:
        return NO_DEALS
    return _deal_list("🏆 <b>Le offerte migliori adesso</b>", live)


def new_text(store) -> str:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    fresh = [d for d in live_deals(store) if _when(d["first_seen_at"]) > since]
    if not fresh:
        return "Nessuna offerta nuova nelle ultime 24 ore."
    more = f" (le prime {LIST_MAX})" if len(fresh) > LIST_MAX else ""
    return _deal_list(f"🆕 <b>{len(fresh)} nuove in 24 ore</b>{more}", fresh[:LIST_MAX])


def bands_text(store) -> str:
    live = live_deals(store)
    lines = ["💶 <b>Offerte per fascia di prezzo</b>", ""]
    for label, low, high in BANDS:
        group = [d for d in live if low <= float(d["used_price"]) < high]  # già in ordine di guadagno
        if group:
            best = group[0]
            lines.append(f"<b>{label}</b>: {len(group)} · la migliore +{eur(best['profit_eur'], 0)} "
                         f"({float(best['margin_pct']):.0f}%)")
    return "\n".join(lines) if len(lines) > 2 else NO_DEALS


def search_text(store, query: str) -> str:
    words = query.casefold().split()
    if not words:
        return "Scrivi cosa cercare, per esempio <code>/cerca rtx 5070</code>."
    found = [d for d in live_deals(store) if all(w in (d["title"] or "").casefold() for w in words)]
    if not found:
        return f"Nessuna offerta attiva per «{html.escape(query)}»."
    return _deal_list(f"🔎 <b>{len(found)} per «{html.escape(query)}»</b>", found[:LIST_MAX])


def category_counts(store) -> list[tuple[str, int]]:
    counts: dict[str, int] = {}
    for d in live_deals(store):
        if d.get("category"):
            counts[d["category"]] = counts.get(d["category"], 0) + 1
    return sorted(counts.items(), key=lambda kv: -kv[1])


def categories_text(store) -> str:
    counts = category_counts(store)
    if not counts:
        return NO_DEALS
    return "\n".join(["🗂 <b>Offerte per categoria</b>", "", *(f"<b>{c}</b>: {n}" for c, n in counts)])


def group_command(cmd: str, arg: str, store) -> str:
    return {
        "top": lambda: top_text(store, arg),
        "nuove": lambda: new_text(store),
        "fasce": lambda: bands_text(store),
        "budget": lambda: bands_text(store),
        "categorie": lambda: categories_text(store),
        "cerca": lambda: search_text(store, arg),
    }[cmd]()


# ── Schermate della chat privata ────────────────────────────────────

def ranked(store) -> list[dict]:
    return sorted(live_deals(store), key=hunter_score, reverse=True)


def home_screen(store, first_name: str = "") -> Screen:
    live = live_deals(store)
    verified = [d for d in live if not ref_warning(d)]
    hello = f"👋 Ciao <b>{html.escape(first_name)}</b>!" if first_name else "👋 <b>Ciao!</b>"
    if verified:
        best = max(float(d["profit_eur"]) for d in verified)
        last = max(_when(d["last_seen_at"]) for d in live)
        stats = (f"🔥 <b>{len(verified)}</b> offerte col prezzo verificato · la migliore <b>+{eur(best, 0)}</b>\n"
                 f"📡 Ultimo controllo: {ago_text(last)}")
    else:
        stats = "Le offerte stanno arrivando: riprova tra poco."
    rows = [
        [{"text": "🏆 Le migliori", "callback_data": "d:top:0:"}, {"text": "🆕 Nuove", "callback_data": "d:new:0:"}],
        [{"text": "💶 Per budget", "callback_data": "m:b"}, {"text": "🗂 Categorie", "callback_data": "m:c"}],
        [{"text": "🎯 I miei avvisi", "callback_data": "a"}, {"text": "🔔 Seguiti", "callback_data": "d:w:0:"}],
        [{"text": "❓ Come funziona", "callback_data": "m:h"}],
    ]
    links = [{"text": "📣 Canale", "url": config.TELEGRAM_CHANNEL_URL}]
    if config.DASHBOARD_URL:
        links.append({"text": "🌐 Sito", "url": config.DASHBOARD_URL})
    rows.append(links)
    return Screen(f"{hello}\nCaccio per te gli affari su Amazon Seconda Mano.\n\n{stats}\n\n"
                  "Scegli da dove iniziare, oppure scrivimi cosa cerchi.", rows)


def help_screen() -> Screen:
    return Screen(HELP, [[BACK_HOME]])


def budget_screen(store) -> Screen:
    live = live_deals(store)
    rows = []
    for i, (label, low, high) in enumerate(BANDS):
        n = sum(1 for d in live if low <= float(d["used_price"]) < high)
        if n:
            rows.append([{"text": f"{label} · {n}", "callback_data": f"d:b:0:{i}"}])
    return Screen("💶 <b>Quanto vuoi spendere?</b>\nPrezzo Seconda Mano, prima dello sconto." if rows else NO_DEALS,
                  rows + [[BACK_HOME]])


def categories_screen(store) -> Screen:
    rows = [[{"text": f"{c} · {n}", "callback_data": f"d:c:0:{c}"}] for c, n in category_counts(store)]
    return Screen("🗂 <b>Cosa ti interessa?</b>" if rows else NO_DEALS, rows + [[BACK_HOME]])


def deals_for(store, chat, kind: str, arg: str) -> tuple[str, list[dict]]:
    """Titolo e offerte di un elenco da sfogliare, dalla migliore."""
    if kind == "top":
        return "🏆 Le migliori", ranked(store)[:TOP_MAX]
    if kind == "new":
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        return "🆕 Nuove", [d for d in ranked(store) if _when(d["first_seen_at"]) > since]
    if kind == "b" and arg.isdigit() and int(arg) < len(BANDS):
        label, low, high = BANDS[int(arg)]
        return f"💶 {label}", [d for d in ranked(store) if low <= float(d["used_price"]) < high]
    if kind == "c":
        return f"🗂 {arg}", [d for d in ranked(store) if d.get("category") == arg]
    if kind == "s":
        words = arg.casefold().split()
        return f"🔎 {arg}", [d for d in ranked(store) if words and all(w in (d["title"] or "").casefold() for w in words)]
    asins = list(subscribers.get(chat)["watch"]) if kind == "w" else [arg] if kind == "a" else []
    found = [store.deal(a) for a in asins]
    return "🔔 Seguiti" if kind == "w" else "🛒 Offerta", [d for d in found if d and d.get("margin_pct") is not None]


def _short_arg(arg: str) -> str:
    """Taglia il testo perché stia in un pulsante, senza spezzare una lettera accentata."""
    return arg.encode()[:CALLBACK_ARG_MAX].decode(errors="ignore")


def _deal_rows(d: dict, kind: str, i: int, n: int, arg: str, watched: bool) -> list:
    rows = []
    if n > 1:
        rows.append([{"text": "◀️", "callback_data": f"d:{kind}:{(i - 1) % n}:{arg}"},
                     {"text": f"{i + 1} di {n}", "callback_data": "n"},
                     {"text": "▶️", "callback_data": f"d:{kind}:{(i + 1) % n}:{arg}"}])
    links = [{"text": "🛒 Apri su Amazon", "url": f"{config.BASE_URL}/dp/{d['asin']}"}]
    if config.DASHBOARD_URL:
        links.append({"text": "📊 Analisi", "url": deal_url(d["asin"])})
    rows.append(links)
    rows.append([{"text": "🔕 Smetti di seguire" if watched else "🔔 Avvisami se scende",
                  "callback_data": f"w:{d['asin']}|{kind}:{i}:{arg}"}])
    back = {"b": ("💶 Budget", "m:b"), "c": ("🗂 Categorie", "m:c")}.get(kind)
    rows.append(([{"text": back[0], "callback_data": back[1]}] if back else []) + [BACK_HOME])
    return rows


def deal_screen(store, chat, kind: str, i: int = 0, arg: str = "", note: str = "") -> Screen:
    arg = _short_arg(arg)
    title, deals = deals_for(store, chat, kind, arg)
    if not deals:
        text = EMPTY_TEXT.get(kind) or (f"Nessuna offerta attiva per «{html.escape(arg)}»." if kind == "s" else NO_DEALS)
        return Screen(text, [[BACK_HOME]])
    i %= len(deals)
    d = deals[i]
    discount = float(store.settings().get("discount_pct", config.DISCOUNT_PCT))
    checked = f"Controllato {ago_text(_when(d['checked_at']))}" if d.get("checked_at") else None
    head = f"<b>{html.escape(title)}</b> · {i + 1} di {len(deals)}\n\n" if len(deals) > 1 else ""
    watched = d["asin"] in subscribers.get(chat)["watch"]
    return Screen(f"{note}{head}{format_deal(d, discount, checked=checked)}",
                  _deal_rows(d, kind, i, len(deals), arg, watched),
                  key=f"{d['asin']}:{d.get('used_price')}:{d.get('ref_price')}:{discount}",
                  image=lambda: deal_card(d, discount))


def alerts_screen(chat) -> Screen:
    sub = subscribers.get(chat)
    cats = ", ".join(sub["cats"]) or "tutte"
    budget = f"fino a {eur(sub['max'], 0)}" if sub["max"] else "nessun limite"
    state = "✅ <b>accesi</b>" if sub["on"] else "⏸ <b>spenti</b>"
    return Screen(
        f"🎯 <b>I tuoi avvisi su misura</b>: {state}\n\n"
        f"🗂 Categorie: <b>{html.escape(cats)}</b>\n💶 Budget: <b>{budget}</b>\n📈 Margine minimo: <b>{sub['margin']}%</b>\n\n"
        f"Ti scrivo solo se un'offerta col prezzo verificato rientra nelle tue scelte: al massimo {subscribers.DAILY_MAX} "
        "al giorno e, di notte, senza suono.",
        [[{"text": "⏸ Spegni gli avvisi", "callback_data": "a:off"} if sub["on"]
          else {"text": "✅ Accendi gli avvisi", "callback_data": "a:on"}],
         [{"text": "🗂 Categorie", "callback_data": "a:c"}, {"text": "💶 Budget", "callback_data": "a:b"}],
         [{"text": "📈 Margine minimo", "callback_data": "a:m"}],
         [BACK_HOME]])


BACK_ALERTS = {"text": "⬅️ Indietro", "callback_data": "a"}


def alert_categories_screen(chat) -> Screen:
    chosen = subscribers.get(chat)["cats"]
    names = sorted({c for c, _ in config.SEARCHES})
    rows = [[{"text": f"{'✅ ' if c in chosen else ''}{c}", "callback_data": f"a:c:{c}"} for c in names[i:i + 2]]
            for i in range(0, len(names), 2)]
    return Screen("🗂 <b>Quali categorie ti interessano?</b>\nSe non ne scegli nessuna le ricevi tutte.", rows + [[BACK_ALERTS]])


def alert_budget_screen(chat) -> Screen:
    current = subscribers.get(chat)["max"]
    rows = [[{"text": f"{'✅ ' if current == b else ''}Fino a {eur(b, 0)}", "callback_data": f"a:b:{b}"}]
            for b in subscribers.BUDGET_CHOICES]
    rows.append([{"text": f"{'✅ ' if not current else ''}Nessun limite", "callback_data": "a:b:0"}])
    return Screen("💶 <b>Qual è il tuo budget?</b>\nPrezzo Seconda Mano, prima dello sconto.", rows + [[BACK_ALERTS]])


def alert_margin_screen(chat) -> Screen:
    current = subscribers.get(chat)["margin"]
    rows = [[{"text": f"{'✅ ' if current == m else ''}{m}%", "callback_data": f"a:m:{m}"} for m in subscribers.MARGIN_CHOICES]]
    return Screen("📈 <b>Da quale margine vuoi essere avvisato?</b>\nPiù è basso, più avvisi ricevi.", rows + [[BACK_ALERTS]])


def deep_link(store, chat, start: str, first_name: str) -> Screen:
    """/start con un argomento: arriva dai pulsanti del canale e del sito."""
    if start == "avvisi":
        return alerts_screen(chat)
    match = re.fullmatch(r"([wd])_([A-Z0-9]{10})", start)
    if match:
        kind, asin = match.groups()
        d = store.deal(asin)
        if d and d.get("margin_pct") is not None:
            note = ""
            if kind == "w":
                note = ("🔔 <b>Ora lo segui</b>: ti scrivo se il prezzo scende.\n\n"
                        if subscribers.watch(chat, asin, d["used_price"])
                        else f"Segui già {subscribers.WATCH_MAX} prodotti: togline uno per aggiungerne altri.\n\n")
            return deal_screen(store, chat, "a", 0, asin, note)
    return home_screen(store, first_name)


def private_command(cmd: str, arg: str, store, chat, first_name: str) -> Screen | str | None:
    if cmd == "start":
        return deep_link(store, chat, arg, first_name)
    if cmd in ("help", "aiuto"):
        return help_screen()
    if cmd == "top":
        return deal_screen(store, chat, "top")
    if cmd == "nuove":
        return deal_screen(store, chat, "new")
    if cmd in ("budget", "fasce"):
        return budget_screen(store)
    if cmd == "categorie":
        return categories_screen(store)
    if cmd == "cerca":
        return deal_screen(store, chat, "s", 0, arg) if arg else "🔎 Scrivimi pure il nome del prodotto, per esempio <code>rtx 5070</code>."
    if cmd == "avvisi":
        return alerts_screen(chat)
    if cmd == "seguiti":
        return deal_screen(store, chat, "w")
    return None


def handle_update(update: dict, store) -> tuple[str, str | Screen, int | None] | None:
    """Risposta (chat, testo o schermata, topic) a un aggiornamento di Telegram, o None."""
    member = update.get("my_chat_member")
    if member:
        chat = member["chat"]
        status = member["new_chat_member"]["status"]
        if chat["type"] == "private":
            if status == "kicked":   # ha bloccato il bot
                subscribers.forget(chat["id"])
            return None
        if status in ("member", "administrator") and chat["type"] in ("group", "supergroup"):  # in un canale lo leggerebbero tutti
            linked = is_linked(chat["id"])
            return (str(chat["id"]),
                    f"👋 Ciao! Sono <b>{NAME}</b>. Prova /top per le offerte migliori.\n"
                    + ("Questo gruppo è già collegato: qui arriveranno gli avvisi." if linked else
                       f"Chi gestisce il bot può collegare questo gruppo agli avvisi con l'ID <code>{chat['id']}</code>."),
                    None)
        return None

    msg = update.get("message") or update.get("channel_post")
    if not msg or not msg.get("text") or msg["chat"].get("type") == "channel":  # il canale è pubblico: solo offerte
        return None
    text = msg["text"]
    cmd = command_of(text)
    chat, topic = str(msg["chat"]["id"]), msg.get("message_thread_id") if msg.get("is_topic_message") else None
    private = msg["chat"].get("type") == "private"
    if cmd == "chatid":
        ref = chat_ref(msg)
        state = "✅ già collegata agli avvisi" if is_linked(chat) else "non ancora collegata"
        return chat, (f"🆔 ID di questa chat: <code>{ref}</code> ({state})\n"
                      "Per gli avvisi qui: aggiungilo a <code>TELEGRAM_CHAT_ID</code> in <code>scraper/.env</code> "
                      "(più chat separate da virgola) e riavvia lo scanner."), topic
    if cmd == "stato":
        return chat, (status_text(store) if is_linked(chat) else "🔒 Questo comando è per chi gestisce il bot. Prova /start."), topic
    if private:
        if cmd is None:      # scrivere un nome equivale a cercarlo
            return chat, deal_screen(store, chat, "s", 0, text), None
        out = private_command(cmd, args_of(text), store, chat, (msg.get("from") or {}).get("first_name", ""))
        return (chat, out, None) if out else None
    if cmd in ("start", "help", "aiuto"):
        return chat, GROUP_HELP, topic
    if cmd in ("top", "nuove", "fasce", "budget", "categorie", "cerca"):
        return chat, group_command(cmd, args_of(text), store), topic
    if cmd in ("avvisi", "seguiti"):
        return chat, f"Questo si fa in privato: {bot_link('avvisi')}", topic
    return None


def handle_callback(cb: dict, store) -> tuple[str, list | None]:
    """Pulsanti ☆ e ✕ di un avviso: (avviso breve da mostrare, nuovi pulsanti del messaggio o None)."""
    msg = cb.get("message") or {}
    chat = msg.get("chat") or {}
    match = re.fullmatch(r"t:(interessante|ignorato|da_valutare):([A-Z0-9]{10})", cb.get("data") or "")
    if not match:
        return "Pulsante non valido", None
    if chat.get("type") != "private" or not is_linked(chat.get("id")):
        return "🔒 Disponibile solo nella chat privata collegata", None
    triage, asin = match.groups()
    store.set_triage(asin, triage)
    rows = (msg.get("reply_markup") or {}).get("inline_keyboard") or []
    return TRIAGE_NOTICE[triage], rows[:1] + [triage_row(asin, triage)]


def handle_nav(cb: dict, store) -> tuple[str | None, Screen | None]:
    """Pulsanti delle schermate: (avviso breve da mostrare, nuova schermata o None)."""
    msg = cb.get("message") or {}
    chat = (msg.get("chat") or {}).get("id")
    data = cb.get("data") or ""
    if (msg.get("chat") or {}).get("type") != "private":
        return "Scrivimi in privato per usare questo pulsante", None
    if data == "n":
        return None, None
    if data == "h":
        return None, home_screen(store, (cb.get("from") or {}).get("first_name", ""))
    if data == "m:b":
        return None, budget_screen(store)
    if data == "m:c":
        return None, categories_screen(store)
    if data == "m:h":
        return None, help_screen()
    if data.startswith("d:"):
        parts = data.split(":", 3)
        if len(parts) == 4 and parts[2].isdigit():
            return None, deal_screen(store, chat, parts[1], int(parts[2]), parts[3])
    match = re.fullmatch(r"w:([A-Z0-9]{10})\|(\w+):(\d+):(.*)", data, flags=re.S)
    if match:
        asin, kind, i, arg = match.groups()
        d = store.deal(asin)
        now_on = subscribers.toggle_watch(chat, asin, (d or {}).get("used_price") or 0)
        notice = ("🔔 Ti avviso se il prezzo scende" if now_on else "🔕 Non lo segui più" if now_on is False
                  else f"Segui già {subscribers.WATCH_MAX} prodotti")
        return notice, deal_screen(store, chat, kind, int(i), arg)
    if data == "a":
        return None, alerts_screen(chat)
    if data in ("a:on", "a:off"):
        subscribers.update(chat, lambda sub: sub.update(on=data == "a:on"))
        return ("🎯 Avvisi accesi" if data == "a:on" else "⏸ Avvisi spenti"), alerts_screen(chat)
    if data == "a:c":
        return None, alert_categories_screen(chat)
    if data.startswith("a:c:"):
        name = data[4:]

        def toggle(sub: dict) -> None:
            sub["cats"] = [c for c in sub["cats"] if c != name] if name in sub["cats"] else [*sub["cats"], name]

        subscribers.update(chat, toggle)
        return None, alert_categories_screen(chat)
    if data == "a:b":
        return None, alert_budget_screen(chat)
    if re.fullmatch(r"a:b:\d+", data):
        subscribers.update(chat, lambda sub: sub.update(max=int(data[4:]) or None))
        return "💶 Budget salvato", alerts_screen(chat)
    if data == "a:m":
        return None, alert_margin_screen(chat)
    if re.fullmatch(r"a:m:\d+", data):
        subscribers.update(chat, lambda sub: sub.update(margin=int(data[4:])))
        return "📈 Margine salvato", alerts_screen(chat)
    return "Pulsante non valido", None


def set_profile(photo_path=None) -> dict:
    """Nome, biografia, descrizione e comandi del bot (e la foto, se la Bot API lo consente). Esito per voce."""
    base = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}"

    def listed(items: list) -> list:
        return [{"command": c, "description": d} for c, d in items]

    calls = {
        "nome": ("setMyName", {"name": NAME}),
        "biografia": ("setMyShortDescription", {"short_description": SHORT_DESCRIPTION}),
        "descrizione": ("setMyDescription", {"description": DESCRIPTION}),
        "comandi": ("setMyCommands", {"commands": listed(COMMANDS)}),
        "comandi gruppi": ("setMyCommands", {"commands": listed(GROUP_COMMANDS), "scope": {"type": "all_group_chats"}}),
    }
    for chat, _topic in parse_chats(config.TELEGRAM_CHAT_ID):
        if not chat.startswith("-"):   # chi gestisce il bot vede anche /stato e /chatid
            calls["comandi gestore"] = ("setMyCommands", {"commands": listed(OWNER_COMMANDS),
                                                          "scope": {"type": "chat", "chat_id": chat}})
    if config.TELEGRAM_CHANNEL_ID:
        calls["descrizione canale"] = ("setChatDescription", {"chat_id": config.TELEGRAM_CHANNEL_ID,
                                                              "description": CHANNEL_DESCRIPTION})
    out = {}
    for label, (method, body) in calls.items():
        r = requests.post(f"{base}/{method}", json=body, timeout=20).json()
        out[label] = r.get("ok") or r.get("description")
    if photo_path:
        with open(photo_path, "rb") as f:
            r = requests.post(f"{base}/setMyProfilePhoto",
                              data={"photo": json.dumps({"type": "static", "photo": "attach://avatar"})},
                              files={"avatar": f}, timeout=30).json()
        out["foto"] = r.get("ok") or r.get("description")
    return out


# ── Invio ───────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def banner() -> bytes:
    from .card import render_banner
    return render_banner()


_file_ids: dict[str, str] = {}   # immagini già caricate su Telegram: riusarle rende istantanei i pulsanti


def _remember(key: str, response: dict | None) -> None:
    result = (response or {}).get("result")
    photo = result.get("photo") if isinstance(result, dict) else None
    if photo:
        if len(_file_ids) >= FILE_IDS_MAX:
            _file_ids.clear()
        _file_ids[key] = photo[-1]["file_id"]


def show(chat, screen: Screen, message_id: int | None = None) -> bool:
    """Manda la schermata come nuovo messaggio, o la mette al posto di `message_id`."""
    key, file_id = screen.key, _file_ids.get(screen.key)
    jpeg = None
    if not file_id:
        jpeg = screen.image() if screen.image else None
        if jpeg is None:         # foto del prodotto non disponibile, o schermata senza offerta
            key, file_id = "banner", _file_ids.get("banner")
            jpeg = None if file_id else banner()
    markup = json.dumps({"inline_keyboard": screen.rows})
    if message_id:
        media = {"type": "photo", "media": file_id or "attach://img", "caption": screen.caption, "parse_mode": "HTML"}
        body = {"chat_id": chat, "message_id": message_id, "media": json.dumps(media), "reply_markup": markup}
        res = api("editMessageMedia", data=body, files={"img": ("schermata.jpg", jpeg, "image/jpeg")} if jpeg else None)
    else:
        body = {"chat_id": chat, "caption": screen.caption, "parse_mode": "HTML", "reply_markup": markup}
        res = (api("sendPhoto", data=body, files={"photo": ("schermata.jpg", jpeg, "image/jpeg")}) if jpeg
               else api("sendPhoto", data={**body, "photo": file_id}))
    _remember(key, res)
    return res is not None


def _answer_nav(cb: dict, store) -> None:
    try:
        notice, screen = handle_nav(cb, store)
    except Exception as e:  # es. database non raggiungibile: lo si dice sul pulsante premuto
        notice, screen = f"⚠️ Errore: {str(e)[:150]}", None
    # si risponde prima di preparare l'immagine: il pulsante smette subito di girare
    call("answerCallbackQuery", {"callback_query_id": cb["id"], **({"text": notice} if notice else {})})
    if screen:
        msg = cb["message"]
        # un vecchio messaggio di solo testo non può diventare una foto: si manda una schermata nuova
        show(msg["chat"]["id"], screen, msg["message_id"] if msg.get("photo") else None)


def _answer_callback(cb: dict, store) -> None:
    if not (cb.get("data") or "").startswith("t:"):
        return _answer_nav(cb, store)
    try:
        notice, rows = handle_callback(cb, store)
    except Exception as e:  # es. database non raggiungibile: lo si dice sul pulsante premuto
        notice, rows = f"⚠️ Errore: {str(e)[:150]}", None
    call("answerCallbackQuery", {"callback_query_id": cb["id"], "text": notice})
    if rows:
        msg = cb["message"]
        call("editMessageReplyMarkup", {"chat_id": msg["chat"]["id"], "message_id": msg["message_id"],
                                        "reply_markup": {"inline_keyboard": rows}})


def run_forever(store) -> None:
    """Long polling dei comandi; ignora i messaggi arrivati più di 2 minuti prima dell'avvio."""
    started, offset = time.time(), None
    url = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/getUpdates"
    allowed = json.dumps(["message", "channel_post", "my_chat_member", "callback_query"])
    while True:
        try:
            r = requests.get(url, params={"timeout": 50, "offset": offset, "allowed_updates": allowed}, timeout=65).json()
            for u in r.get("result", []):
                offset = u["update_id"] + 1
                if u.get("callback_query"):
                    _answer_callback(u["callback_query"], store)
                    continue
                body = u.get("message") or u.get("channel_post") or u.get("my_chat_member") or {}
                if body.get("date", started) < started - 120:
                    continue
                try:
                    out = handle_update(u, store)
                except Exception as e:  # un errore su un comando non deve fermare il bot
                    out = (str(body.get("chat", {}).get("id")), f"⚠️ Errore: {html.escape(str(e))[:200]}", None)
                if out and isinstance(out[1], Screen):
                    show(out[0], out[1])
                elif out:
                    post("sendMessage", out[0], {"text": out[1], "link_preview_options": {"is_disabled": True}}, out[2])
        except Exception:
            time.sleep(15)
