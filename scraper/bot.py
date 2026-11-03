"""Comandi del bot Telegram e benvenuto nei gruppi. Gira in un thread accanto allo scanner (main.py).

/start, /help  cosa fa il bot e come si usa
/chatid        ID di questa chat (e del topic): serve per collegare un gruppo in TELEGRAM_CHAT_ID
/stato         ultimo controllo, velocità, offerte attive e sopra soglia
/top           le 5 offerte attive con più guadagno

/stato e /top rispondono solo nelle chat collegate, così chi trova il bot non vede le offerte.
"""
from __future__ import annotations

import html
import json
import time
from datetime import datetime, timezone

import requests

from . import config, pace
from .notify import eur, parse_chats, post

COMMANDS = [
    ("top", "Le 5 offerte migliori del momento"),
    ("stato", "Stato dello scanner e offerte attive"),
    ("chatid", "ID di questa chat, per collegarla agli avvisi"),
    ("help", "Cosa fa il bot e come si usa"),
]

NAME = "Seconda Mano Hunter"
SHORT_DESCRIPTION = "🔥 Le offerte Amazon Seconda Mano con il margine più alto, appena compaiono."
DESCRIPTION = (
    "🛒 Seconda Mano Hunter controlla di continuo Amazon Seconda Mano (da 100 € in su) e confronta ogni "
    "offerta con il prezzo del nuovo.\n\n"
    "Quando trova un margine sopra soglia ti manda subito un avviso con foto, prezzi e link diretto ad Amazon.\n\n"
    "Comandi: /top le offerte migliori · /stato lo scanner · /chatid per collegare un gruppo.\n\n"
    "Bot privato di Sander Chill House."
)
HELP = (
    f"<b>{NAME}</b>\n"
    "Cerco su Amazon Seconda Mano le offerte con il margine più alto rispetto al nuovo e le mando qui.\n\n"
    + "\n".join(f"/{c} — {d}" for c, d in COMMANDS)
    + "\n\n<b>Collegare un gruppo</b>\n"
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


def status_text(store) -> str:
    deals = store._req("GET", "deals_v?select=margin_pct,profit_eur,active,triage&margin_pct=not.is.null")
    last = store._req("GET", "price_snapshots?select=checked_at&order=checked_at.desc&limit=1")
    s = store.settings()
    live = [d for d in deals if d["active"] and d["triage"] not in ("ignorato", "acquistato")]
    hot = [d for d in live if float(d["margin_pct"]) >= float(s.get("alert_margin_pct", 40))
           and float(d["profit_eur"]) >= float(s.get("alert_profit_eur", 50))]
    when = "mai"
    if last:
        mins = int((datetime.now(timezone.utc) - datetime.fromisoformat(last[0]["checked_at"])).total_seconds() // 60)
        when = "adesso" if mins < 1 else f"{mins} min fa"
    try:
        state = json.loads(config.STATE_FILE.read_text())
    except (FileNotFoundError, ValueError):
        state = {}
    best = max((float(d["margin_pct"]) for d in live), default=0)
    return (
        "📡 <b>Stato scanner</b>\n"
        f"Ultimo controllo: <b>{when}</b>\n"
        f"Velocità: <b>{pace.current_level(state, config.SCAN_SPEED)}</b> (massima {config.SCAN_SPEED})\n"
        f"Offerte attive: <b>{len(live)}</b> · sopra soglia: <b>{len(hot)}</b>\n"
        f"Miglior margine: <b>{best:.0f}%</b>\n"
        f"Soglie avviso: margine ≥ {float(s.get('alert_margin_pct', 40)):.0f}% e guadagno ≥ "
        f"{eur(s.get('alert_profit_eur', 50), 0)}"
    )


def top_text(store, n: int = 5) -> str:
    deals = store._req("GET", "deals_v?select=asin,title,used_price,profit_eur,margin_pct,active,triage"
                              "&margin_pct=not.is.null&order=profit_eur.desc&limit=50")
    live = [d for d in deals if d["active"] and d["triage"] not in ("ignorato", "acquistato")][:n]
    if not live:
        return "Nessuna offerta attiva in questo momento."
    lines = ["🏆 <b>Le offerte migliori adesso</b>", ""]
    for i, d in enumerate(live, 1):
        title = html.escape((d["title"] or d["asin"])[:70])
        lines.append(f"{i}. <b>{float(d['margin_pct']):.0f}%</b> · +{eur(d['profit_eur'], 0)} · {eur(d['used_price'])}\n"
                     f"<a href=\"{config.BASE_URL}/dp/{d['asin']}\">{title}</a>")
    return "\n".join(lines)


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
    if cmd in ("stato", "top"):
        if not is_linked(chat):
            return chat, "🔒 Questa chat non è collegata. Usa /chatid e chiedi di aggiungerla.", topic
        return chat, status_text(store) if cmd == "stato" else top_text(store), topic
    return None


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


def run_forever(store) -> None:
    """Long polling dei comandi; ignora i messaggi arrivati più di 2 minuti prima dell'avvio."""
    started, offset = time.time(), None
    url = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/getUpdates"
    while True:
        try:
            r = requests.get(url, params={"timeout": 50, "offset": offset,
                                          "allowed_updates": json.dumps(["message", "channel_post", "my_chat_member"])},
                             timeout=65).json()
            for u in r.get("result", []):
                offset = u["update_id"] + 1
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
