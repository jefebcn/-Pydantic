"""Chi usa il bot in privato: avvisi su misura e prodotti seguiti. Su Supabase (tabella bot_users) con il bot online,
altrimenti solo su questo PC, in scraper/.subscribers.json.

{chat: {"on": bool, "cats": [categorie, vuoto = tutte], "max": budget o None, "margin": min %,
        "sent": {asin: {"price", "ts"}}, "watch": {asin: prezzo a cui avvisare sotto},
        "first", "last": prima e ultima volta che ha usato il bot, "premium": risposta alla domanda sul prezzo}}
"""
from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime

from . import config
from .notify import (deal_buttons, deal_card, fresh_or_lower, format_deal, is_new_low, is_quiet_hour, ref_warning,
                     send_personal)

DEFAULT_MARGIN = 40
MARGIN_CHOICES = (30, 40, 50, 60)
BUDGET_CHOICES = (400, 650, 1000, 1600)
DAILY_MAX = 15       # avvisi su misura al giorno per persona: oltre diventano rumore
WATCH_MAX = 30       # prodotti seguiti per persona
PREMIUM_CHOICES = (5, 15, 0)   # quanto pagherebbe al mese, 0 = niente: si chiede prima di costruire qualcosa
KEEP_SENT_DAYS = 8   # oltre la finestra di ripubblicazione non servono più

_lock = threading.RLock()


def _blank() -> dict:
    return {"on": False, "cats": [], "max": None, "margin": DEFAULT_MARGIN, "sent": {}, "watch": {}}


_store = None


def _db():
    global _store
    if _store is None:
        from .store import Store
        _store = Store()
    return _store


def _load() -> dict:
    """Tutte le persone: {chat: preferenze}."""
    if config.BOT_ONLINE:
        return {r["chat_id"]: r["prefs"] for r in _db()._req("GET", "bot_users?select=chat_id,prefs&limit=10000") or []}
    return _load_file()


def _load_file() -> dict:
    try:
        return json.loads(config.SUBSCRIBERS_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _one(chat) -> dict:
    if config.BOT_ONLINE:
        rows = _db()._req("GET", f"bot_users?chat_id=eq.{chat}&select=prefs")
        return rows[0]["prefs"] if rows else {}
    return _load_file().get(str(chat), {})


def _put(chat, sub: dict) -> None:
    if config.BOT_ONLINE:
        _db()._req("POST", "bot_users?on_conflict=chat_id", json={"chat_id": str(chat), "prefs": sub},
                   headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
        return
    data = _load_file()
    data[str(chat)] = sub
    _save(data)


def _drop(chat) -> None:
    if config.BOT_ONLINE:
        _db()._req("DELETE", f"bot_users?chat_id=eq.{chat}", headers={"Prefer": "return=minimal"})
        return
    data = _load_file()
    if data.pop(str(chat), None) is not None:
        _save(data)


def migrate_file() -> int:
    """Una volta sola, passando al bot online: porta su Supabase le scelte salvate su questo PC."""
    people = _load_file()
    for chat, sub in people.items():
        _db()._req("POST", "bot_users?on_conflict=chat_id", json={"chat_id": chat, "prefs": sub},
                   headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
    return len(people)


def _save(data: dict) -> None:
    """Scrittura atomica; un file bloccato (la cartella è su OneDrive) non deve fermare né il bot né lo scanner."""
    tmp = config.SUBSCRIBERS_FILE.with_suffix(".tmp")
    try:
        tmp.write_text(json.dumps(data))
        os.replace(tmp, config.SUBSCRIBERS_FILE)
    except OSError:
        pass


def get(chat) -> dict:
    with _lock:
        return {**_blank(), **_one(chat)}


def update(chat, change) -> dict:
    """Applica `change(sub)` alle preferenze della chat e le salva."""
    with _lock:
        sub = {**_blank(), **_one(chat)}
        change(sub)
        _put(chat, sub)
        return sub


def touch(chat) -> None:
    """Ricorda che la persona usa il bot (per contare chi è attivo). Una scrittura all'ora basta."""
    now = time.time()
    if now - get(chat).get("last", 0) > 3600:
        update(chat, lambda sub: sub.update(first=sub.get("first", now), last=now))


def usage(now: float) -> dict:
    """I numeri che servono per capire se il bot piace, senza dati personali."""
    with _lock:
        subs = [{**_blank(), **s} for s in _load().values()]
    answers = [s["premium"] for s in subs if s.get("premium") is not None]
    return {"people": len(subs),
            "active": sum(1 for s in subs if now - s.get("last", 0) < 7 * 86400),
            "alerts_on": sum(1 for s in subs if s["on"]),
            "watching": sum(len(s["watch"]) for s in subs),
            "premium": {price: answers.count(price) for price in PREMIUM_CHOICES}}


def forget(chat) -> None:
    """La persona ha bloccato il bot: non le si scrive più e non si tiene nulla."""
    with _lock:
        _drop(chat)


def toggle_watch(chat, asin: str, price) -> bool | None:
    """Segue o smette di seguire un prodotto. True se ora lo segue, None se ne segue già troppi."""
    result: list[bool | None] = [None]

    def change(sub: dict) -> None:
        if asin in sub["watch"]:
            del sub["watch"][asin]
            result[0] = False
        elif len(sub["watch"]) < WATCH_MAX:
            sub["watch"][asin] = float(price)
            result[0] = True

    update(chat, change)
    return result[0]


def watch(chat, asin: str, price) -> bool:
    """Come toggle_watch, ma non smette mai di seguire (link dei post nel canale premuto due volte)."""
    return asin in get(chat)["watch"] or bool(toggle_watch(chat, asin, price))


def wants_alert(sub: dict, d: dict, price: float, min_profit: float, now: float) -> bool:
    """Questa offerta rientra nelle scelte della persona? Solo prezzi verificati, come il canale."""
    if not sub["on"] or ref_warning(d):
        return False
    if float(d["margin_pct"]) < sub["margin"] or float(d["profit_eur"]) < min_profit:
        return False
    if (sub["cats"] and d.get("category") not in sub["cats"]) or (sub["max"] and price > sub["max"]):
        return False
    if sum(1 for s in sub["sent"].values() if now - s["ts"] < 86400) >= DAILY_MAX:
        return False
    return fresh_or_lower(price, sub["sent"].get(d["asin"]), now)


def targets(subs: dict, d: dict, price: float, min_profit: float, now: float, skip=()) -> list[tuple[str, float | None]]:
    """A chi scrivere per questa offerta: (chat, prezzo seguito se è una discesa di un prodotto seguito)."""
    out = []
    for chat, raw in subs.items():
        sub = {**_blank(), **raw}
        followed = sub["watch"].get(d["asin"])
        if followed is not None and is_new_low(price, followed):
            out.append((chat, followed))
        elif chat not in skip and wants_alert(sub, d, price, min_profit, now):
            last = sub["sent"].get(d["asin"])
            out.append((chat, last["price"] if last and price < last["price"] else None))
    return out


def dispatch(d: dict, price: float, discount: float, min_profit: float, skip=()) -> int:
    """Manda l'offerta a chi la vuole e ricorda cosa ha ricevuto. Quante persone l'hanno ricevuta."""
    now = time.time()
    with _lock:
        subs = _load()
    picked = targets(subs, d, price, min_profit, now, skip)
    cards: dict[float | None, bytes | None] = {}
    sent = 0
    silent = is_quiet_hour(datetime.now().hour)
    for chat, previous in picked:
        if previous not in cards:
            cards[previous] = deal_card(d, discount, previous)
        if not send_personal(chat, d, format_deal(d, discount, previous), cards[previous], deal_buttons(d), silent):
            continue
        sent += 1

        def change(sub: dict) -> None:
            if d["asin"] in sub["watch"]:
                sub["watch"][d["asin"]] = min(price, sub["watch"][d["asin"]])
            sub["sent"] = {k: v for k, v in sub["sent"].items() if now - v["ts"] < KEEP_SENT_DAYS * 86400}
            sub["sent"][d["asin"]] = {"price": price, "ts": now}

        update(chat, change)
    return sent
