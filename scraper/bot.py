"""Comandi del bot Telegram, pulsanti degli avvisi e benvenuto nei gruppi. Gira in un thread accanto allo scanner (main.py).

/start, /help  cosa fa il bot e come si usa
/chatid        ID di questa chat (e del topic): serve per collegare un gruppo in TELEGRAM_CHAT_ID
/stato         ultimo giro, velocità, pausa dopo un blocco, offerte attive e sopra soglia
/top [n]       le offerte attive con più guadagno (5, massimo 10)
/nuove         le offerte comparse nelle ultime 24 ore
/fasce         quante offerte per fascia di prezzo e la migliore di ognuna
/cerca parole  cerca fra le offerte attive

Tutto tranne /start, /help e /chatid risponde solo nelle chat collegate, così chi trova il bot non vede le offerte.
I pulsanti ☆ e ✕ degli avvisi funzionano solo nelle chat private collegate.
"""
from __future__ import annotations

import html
import json
import re
import time
from datetime import datetime, timedelta, timezone

import requests

from . import config, pace
from .notify import call, eur, parse_chats, post, ref_warning, triage_row

COMMANDS = [
    ("top", "Le offerte migliori del momento"),
    ("nuove", "Le offerte comparse nelle ultime 24 ore"),
    ("fasce", "Offerte per fascia di prezzo"),
    ("cerca", "Cerca un prodotto, es. /cerca rtx 5070"),
    ("stato", "Stato dello scanner e offerte attive"),
    ("chatid", "ID di questa chat, per collegarla agli avvisi"),
    ("help", "Cosa fa il bot e come si usa"),
]
LINKED_ONLY = ("top", "nuove", "fasce", "cerca", "stato")

# Un'offerta è attiva se vista entro LIVE_HOURS dall'ultimo giro dello scanner: con le ricerche a rotazione
# (a velocità lenta il giro completo dura 4 ore) e a PC spento non sparisce tutto. Come in app/api/deals/route.ts.
LIVE_HOURS = 6
# Le stesse fasce del sito (lib/format.ts): estremo superiore escluso.
BANDS = [("100 – 399 €", 0, 400), ("400 – 649 €", 400, 650), ("650 – 999 €", 650, 1000),
         ("1.000 – 1.599 €", 1000, 1600), ("1.600 – 3.000 €", 1600, 3000.01), ("Oltre 3.000 €", 3000.01, float("inf"))]
LIST_MAX = 10
TRIAGE_NOTICE = {"interessante": "★ Segnata come interessante", "ignorato": "✕ Ignorata: niente più avvisi",
                 "da_valutare": "↺ Scelta annullata"}

NAME = "Seconda Mano Hunter"
SHORT_DESCRIPTION = "🔥 Le offerte Amazon Seconda Mano con il margine più alto, appena compaiono."
DESCRIPTION = (
    "🛒 Seconda Mano Hunter controlla di continuo Amazon Seconda Mano (da 100 € in su) e confronta ogni "
    "offerta con il prezzo del nuovo.\n\n"
    "Quando trova un margine sopra soglia ti manda subito un avviso con foto, prezzi e link diretto ad Amazon.\n\n"
    "Comandi: /top le migliori · /nuove di oggi · /fasce per prezzo · /cerca un prodotto · /stato lo scanner.\n\n"
    "Bot privato di Sander Chill House."
)
HELP = (
    f"<b>{NAME}</b>\n"
    "Cerco su Amazon Seconda Mano le offerte con il margine più alto rispetto al nuovo e le mando qui.\n\n"
    + "\n".join(f"/{c} — {d}" for c, d in COMMANDS)
    + "\n\n⚠️ accanto a un'offerta vuol dire che il prezzo del nuovo va verificato: viene da altri venditori "
    "o ne esiste uno più economico, quindi il margine reale può essere più basso.\n"
    "\n<b>Collegare un gruppo</b>\n"
    "1. Aggiungimi al gruppo (anche come amministratore, se è un canale).\n"
    "2. Ti scrivo l'ID del gruppo; se no, scrivi /chatid nel gruppo.\n"
    "3. Metti l'ID in <code>TELEGRAM_CHAT_ID</code> in <code>scraper/.env</code> "
    "(più chat separate da virgola) e riavvia lo scanner."
)


def chat_ref(msg: dict) -> str:
    """ID da scrivere in TELEGRAM_CHAT_ID per questa chat (con :topic se il messaggio è in un topic)."""
    chat = str(msg["chat"]["id"])
    topic = msg.get("message_thread_id") if msg.get("is_topic_message") else None
    return f"{chat}:{topic}" if topic else chat


def is_linked(chat_id) -> bool:
    return str(chat_id) in {c for c, _ in parse_chats(config.TELEGRAM_CHAT_ID)}


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


def live_deals(store) -> list[dict]:
    """Offerte attive da proporre, dalla più redditizia; ignorate e già acquistate escluse."""
    rows = store._req("GET", "deals_v?select=asin,title,used_price,new_price,new_price_any,profit_eur,margin_pct,"
                             "triage,first_seen_at,last_seen_at&margin_pct=not.is.null&order=profit_eur.desc&limit=1000")
    if not rows:
        return []
    latest = max(_when(d["last_seen_at"]) for d in rows)
    since = latest - timedelta(hours=LIVE_HOURS)
    return [d for d in rows if _when(d["last_seen_at"]) > since and d["triage"] not in ("ignorato", "acquistato")]


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


def top_text(store, arg: str = "") -> str:
    n = min(int(arg), LIST_MAX) if arg.isdigit() and int(arg) > 0 else 5
    # prima i prezzi verificati, come le card del sito: un riferimento gonfiato non deve stare in cima
    live = sorted(live_deals(store), key=lambda d: bool(ref_warning(d)))[:n]
    if not live:
        return "Nessuna offerta attiva in questo momento."
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
    return "\n".join(lines) if len(lines) > 2 else "Nessuna offerta attiva in questo momento."


def search_text(store, query: str) -> str:
    words = query.casefold().split()
    if not words:
        return "Scrivi cosa cercare, per esempio <code>/cerca rtx 5070</code>."
    found = [d for d in live_deals(store) if all(w in (d["title"] or "").casefold() for w in words)]
    if not found:
        return f"Nessuna offerta attiva per «{html.escape(query)}»."
    return _deal_list(f"🔎 <b>{len(found)} per «{html.escape(query)}»</b>", found[:LIST_MAX])


def linked_command(cmd: str, arg: str, store) -> str:
    return {
        "stato": lambda: status_text(store),
        "top": lambda: top_text(store, arg),
        "nuove": lambda: new_text(store),
        "fasce": lambda: bands_text(store),
        "cerca": lambda: search_text(store, arg),
    }[cmd]()


def handle_update(update: dict, store) -> tuple[str, str, int | None] | None:
    """Risposta (chat, testo, topic) a un aggiornamento di Telegram, o None."""
    member = update.get("my_chat_member")
    if member:
        chat = member["chat"]
        added = member["new_chat_member"]["status"] in ("member", "administrator")
        if added and chat["type"] in ("group", "supergroup", "channel"):
            linked = is_linked(chat["id"])
            return (str(chat["id"]),
                    f"👋 Ciao! Sono <b>{NAME}</b>.\n"
                    + ("Questo gruppo è già collegato: qui arriveranno gli avvisi." if linked else
                       f"Per ricevere gli avvisi qui, metti <code>{chat['id']}</code> in "
                       "<code>TELEGRAM_CHAT_ID</code> (in <code>scraper/.env</code>) e riavvia lo scanner."),
                    None)
        return None

    msg = update.get("message") or update.get("channel_post")
    if not msg or not msg.get("text"):
        return None
    cmd = command_of(msg["text"])
    chat, topic = str(msg["chat"]["id"]), msg.get("message_thread_id") if msg.get("is_topic_message") else None
    if cmd in ("start", "help"):
        return chat, HELP, topic
    if cmd == "chatid":
        ref = chat_ref(msg)
        state = "✅ già collegata agli avvisi" if is_linked(chat) else "non ancora collegata"
        return chat, (f"🆔 ID di questa chat: <code>{ref}</code> ({state})\n"
                      "Per gli avvisi qui: aggiungilo a <code>TELEGRAM_CHAT_ID</code> in <code>scraper/.env</code> "
                      "(più chat separate da virgola) e riavvia lo scanner."), topic
    if cmd in LINKED_ONLY:
        if not is_linked(chat):
            return chat, "🔒 Questa chat non è collegata. Usa /chatid e chiedi di aggiungerla.", topic
        return chat, linked_command(cmd, args_of(msg["text"]), store), topic
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


def set_profile(photo_path=None) -> dict:
    """Nome, biografia, descrizione e comandi del bot (e la foto, se la Bot API lo consente). Esito per voce."""
    base = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}"
    cmds = [{"command": c, "description": d} for c, d in COMMANDS]
    calls = {
        "nome": ("setMyName", {"name": NAME}),
        "biografia": ("setMyShortDescription", {"short_description": SHORT_DESCRIPTION}),
        "descrizione": ("setMyDescription", {"description": DESCRIPTION}),
        "comandi": ("setMyCommands", {"commands": cmds}),
        "comandi gruppi": ("setMyCommands", {"commands": cmds, "scope": {"type": "all_group_chats"}}),
    }
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


def _answer_callback(cb: dict, store) -> None:
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
                if out:
                    post("sendMessage", out[0], {"text": out[1], "link_preview_options": {"is_disabled": True}}, out[2])
        except Exception:
            time.sleep(15)
