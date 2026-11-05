"""Ciclo principale: cerca offerte Seconda Mano, salva prezzi, invia avvisi.

Uso (dalla cartella del progetto):
    python -m scraper.main              # gira per sempre, al ritmo di SCAN_SPEED (default lento), una sola istanza
    python -m scraper.main --speed normale     # profilo massimo diverso (lento | normale | veloce)
    python -m scraper.main --once       # un solo ciclo
    python -m scraper.main --telegram-setup    # nome, foto, biografia e comandi del bot, descrizione del canale
    python -m scraper.main --test B0XXXXXXXX   # prova un ASIN, stampa le offerte (non salva nulla)
    python -m scraper.main --search notebook   # prova una ricerca (non salva nulla)
    aggiungi --debug per salvare l'HTML scaricato in scraper/debug/
"""
from __future__ import annotations

import argparse
import json
import logging
import logging.handlers
import os
import socket
import sys
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path

from . import bot, config, digest, pace, subscribers
from .amazon import AmazonClient, CaptchaError, LocationError, SearchItem
from .notify import channel_edit_needed, channel_next, edit_channel_post, is_new_low, parse_chats, send_channel, send_deal, telegram

ALREADY_RUNNING = 3            # codice di uscita: avvia-scanner.bat non riparte
INSTANCE_PORT = 47853          # porta locale tenuta occupata finché lo scanner gira

_file_log = logging.getLogger("scanner")


def setup_log_file() -> None:
    handler = logging.handlers.RotatingFileHandler(config.LOG_FILE, maxBytes=1_000_000, backupCount=1, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", "%Y-%m-%d %H:%M:%S"))
    _file_log.addHandler(handler)
    _file_log.setLevel(logging.INFO)
    _file_log.propagate = False


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)
    _file_log.info(msg)


def hold_single_instance() -> socket.socket | None:
    """Due scanner insieme raddoppierebbero le richieste ad Amazon e litigherebbero per i comandi Telegram.
    Il sistema libera la porta quando il processo finisce, anche se si chiude di colpo."""
    s = socket.socket()
    try:
        s.bind(("127.0.0.1", INSTANCE_PORT))
        return s
    except OSError:
        s.close()
        return None


def write_json(path: Path, data: dict) -> None:
    """Scrittura atomica; un file bloccato (la cartella è su OneDrive) non deve fermare lo scanner."""
    tmp = path.with_suffix(".tmp")
    try:
        tmp.write_text(json.dumps(data))
        os.replace(tmp, path)
    except OSError as e:
        log(f"non riesco a salvare {path.name}: {e!r}")


def load_cache() -> dict:
    try:
        return json.loads(config.CACHE_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_cache(cache: dict) -> None:
    write_json(config.CACHE_FILE, cache)


def load_state() -> dict:
    try:
        return json.loads(config.STATE_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(state: dict, store=None) -> None:
    write_json(config.STATE_FILE, state)
    if store and config.BOT_ONLINE:   # il bot su Vercel non vede i file di questo PC
        try:
            store.set_state("scanner", {**state, "speed": config.SCAN_SPEED})
        except Exception as e:
            log(f"non riesco a salvare lo stato su Supabase: {e!r}")


def load_published() -> dict:
    try:
        return json.loads(config.PUBLISHED_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def publish_to_channel(store, discount: float, min_margin: float, min_profit: float) -> bool:
    """Pubblica la migliore offerta pronta, se il ritmo del canale lo consente, e ricorda cosa è uscito.
    Le altre restano in attesa: alla prossima occasione si riparte dalla migliore."""
    published = load_published()
    now = datetime.now()
    d = channel_next(bot.live_deals(store), published, now.timestamp(), now.hour, min_margin, min_profit)
    if not d:
        return False
    price = float(d["used_price"])
    last = published.get(d["asin"])
    previous = last["price"] if last and price < last["price"] else None
    checked = datetime.fromisoformat(d["checked_at"].replace("Z", "+00:00")).astimezone()
    sent = send_channel(d, discount, previous, f"Controllato alle {checked:%H:%M}")
    if not sent:
        return False
    published[d["asin"]] = {"price": price, "ts": now.timestamp(),
                            **({"message_id": sent} if sent is not True else {})}
    write_json(config.PUBLISHED_FILE, published)
    return True


def refresh_channel_post(d: dict, price: float, discount: float) -> None:
    """Se il prezzo di un'offerta già pubblicata cambia, il post lo dice."""
    published = load_published()
    last = published.get(d["asin"])
    if not last or not last.get("message_id") or not channel_edit_needed(last, price):
        return
    if edit_channel_post(last["message_id"], d, discount, last["price"], price):
        last["shown"] = price
        write_json(config.PUBLISHED_FILE, published)
        log(f"  {d['asin']}: post del canale aggiornato, prezzo {price}€")


def needs_check(item: SearchItem, cache: dict) -> bool:
    c = cache.get(item.asin)
    if not c:
        return True
    if item.price is not None and c.get("price") != item.price:
        return True
    return (time.time() - c.get("ts", 0)) > config.RECHECK_HOURS * 3600


def run_cycle(client: AmazonClient, store, prof: dict, state: dict) -> None:
    settings = store.settings()
    min_margin = float(config.ALERT_MARGIN_PCT or settings.get("alert_margin_pct", 40))
    min_profit = float(config.ALERT_PROFIT_EUR or settings.get("alert_profit_eur", 50))
    discount = float(settings.get("discount_pct", config.DISCOUNT_PCT))
    cache = load_cache()

    # 1) raccogli le offerte dalle ricerche di questo giro (a rotazione)
    found: dict[str, tuple[SearchItem, str]] = {}
    for category, keyword in pace.next_searches(state, config.SEARCHES, prof["searches_per_cycle"]):
        for page in range(1, prof["pages_per_search"] + 1):
            items = client.search_seconda_mano(keyword, page)
            fresh = [i for i in items if i.price is None or i.price >= config.MIN_USED_PRICE]
            log(f"ricerca '{keyword}' p{page}: {len(items)} risultati, {len(fresh)} ≥ {config.MIN_USED_PRICE:.0f}€")
            for it in fresh:
                found.setdefault(it.asin, (it, category))
            if len(items) < 10:
                break

    store.upsert_products([(it.asin, it.title, category, it.image_url) for it, category in found.values()])

    # 2) controlla le offerte: prima i mai visti, poi i prezzi cambiati, poi i vecchi
    todo = [(it, cat) for it, cat in found.values() if needs_check(it, cache)]
    todo.sort(key=lambda x: (x[0].asin in cache, -(x[0].price or 0)))
    todo = todo[:prof["max_offer_fetches"]]
    log(f"{len(found)} prodotti trovati, controllo offerte su {len(todo)}")

    alerts = personal = 0
    linked = {chat for chat, _ in parse_chats(config.TELEGRAM_CHAT_ID)}
    for it, _cat in todo:
        try:
            summary = client.offers(it.asin)
        except CaptchaError:
            raise
        except Exception as e:
            log(f"  {it.asin}: errore lettura offerte ({e!r}), salto")
            continue
        used_price = summary.used_price or it.price
        store.add_snapshot(it.asin, used_price, summary.used_condition,
                           summary.new_price, summary.new_price_any)
        cache[it.asin] = {"price": it.price, "ts": time.time()}
        save_cache(cache)

        d = store.deal(it.asin)
        if not d or d.get("margin_pct") is None:
            continue
        margin, profit = float(d["margin_pct"]), float(d["profit_eur"])
        log(f"  {it.asin} usato {used_price}€ | nuovo {d['ref_price']}€ | margine {margin:.0f}% (+{profit:.0f}€)")
        refresh_channel_post(d, used_price, discount)
        if d.get("triage") in ("ignorato", "acquistato"):
            continue
        above = margin >= min_margin and profit >= min_profit
        if above:
            floor = store.alert_floor(it.asin)
            if is_new_low(used_price, floor) and send_deal(d, discount, previous=floor):  # senza Telegram non segna nulla
                alerts += 1
                store.mark_alerted(it.asin, used_price)
        try:  # chi riceve già tutti gli avvisi sopra soglia non li riceve due volte
            personal += subscribers.dispatch(d, used_price, discount, min_profit, skip=linked if above else ())
        except Exception as e:
            log(f"  {it.asin}: errore negli avvisi su misura ({e!r})")

    posts = publish_to_channel(store, discount, min_margin, min_profit)
    log(f"ciclo finito: {alerts} avvisi inviati, {int(posts)} post nel canale, {personal} avvisi su misura")


def cmd_test(asin: str) -> None:
    s = AmazonClient().offers(asin)
    for o in s.offers:
        tag = "SECONDA MANO" if o.is_seconda_mano else ("AMAZON" if o.is_amazon else "")
        print(f"{o.price:>9.2f} €  {o.condition[:40]:<40} {o.seller[:30]:<30} {tag}")
    print(f"\nSeconda Mano: {s.used_price} ({s.used_condition})\nNuovo Amazon: {s.new_price}\n"
          f"Nuovo (qualsiasi): {s.new_price_any}")
    ref = s.new_price or s.new_price_any
    if s.used_price and ref:
        cost = s.used_price * (1 - config.DISCOUNT_PCT / 100)
        print(f"Tuo costo: {cost:.2f} € → margine {(1 - cost / ref) * 100:.1f}% (+{ref - cost:.2f} €)")


def cmd_search(keyword: str) -> None:
    for it in AmazonClient().search_seconda_mano(keyword):
        print(f"{it.asin}  {it.price or 0:>9.2f} €  {it.title[:80]}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--test", metavar="ASIN")
    ap.add_argument("--search", metavar="KEYWORD")
    ap.add_argument("--debug", action="store_true")
    ap.add_argument("--speed", choices=config.SPEED_ORDER, help="profilo massimo (sovrascrive SCAN_SPEED)")
    ap.add_argument("--telegram-setup", action="store_true",
                    help="imposta nome, foto, biografia e comandi del bot Telegram ed esce")
    ap.add_argument("--bot-online", action="store_true", help="porta il bot su Vercel: risponde anche a PC spento")
    ap.add_argument("--bot-offline", action="store_true", help="riporta il bot su questo PC")
    a = ap.parse_args()
    if a.telegram_setup:
        for label, result in bot.set_profile(config.ROOT / "assets" / "bot_avatar.jpg").items():
            print(f"{label:<15} {'ok' if result is True else result}")
        return
    if a.bot_online or a.bot_offline:
        from .store import Store
        if a.bot_offline:
            bot.go_offline()
            print("Webhook tolto. Togli BOT_ONLINE=1 da scraper/.env e riavvia lo scanner.")
        else:
            config.BOT_ONLINE = True
            print("\n".join(bot.go_online(Store())))
        return
    if a.debug:
        config.DEBUG = True
        config.DEBUG_DIR.mkdir(exist_ok=True)
    if a.speed:
        config.SCAN_SPEED = a.speed

    try:
        if a.test:
            return cmd_test(a.test.upper())
        if a.search:
            return cmd_search(a.search)
    except CaptchaError as e:
        raise SystemExit(f"Bloccato da Amazon: {e}\nRiprova tra un po' (o apri amazon.it nel browser e risolvi il CAPTCHA).")
    except LocationError as e:
        raise SystemExit(f"{e}\nRiprova tra un po'; se continua, rilancia con --debug e controlla scraper/debug/.")

    lock = None
    if not a.once:
        lock = hold_single_instance()
        if lock is None:
            print("Lo scanner è già in esecuzione: non ne avvio un altro.")
            sys.exit(ALREADY_RUNNING)
    setup_log_file()

    from .store import Store
    store = Store()
    if config.BOT_ONLINE:
        log("bot Telegram: gira su Vercel, qui solo avvisi e post")
    elif config.TELEGRAM_BOT_TOKEN:
        threading.Thread(target=bot.run_forever, args=(store,), daemon=True, name="telegram-bot").start()
        log("bot Telegram: comandi " + " ".join(f"/{c}" for c, _ in bot.COMMANDS) + " attivi")
    state = load_state()
    configured = config.SCAN_SPEED
    log(f"avvio — {len(config.SEARCHES)} ricerche, velocità massima '{configured}', "
        f"attuale '{pace.current_level(state, configured)}'")
    client = None  # stessa sessione (cookie + CAP) per più cicli, come un visitatore normale
    while True:
        pending = pace.cycle_wait(state)
        if pending and not a.once:  # anche dopo un riavvio: il giro non si anticipa
            log(f"prossimo ciclo alle {datetime.fromtimestamp(state['next_cycle_at']):%H:%M}")
            time.sleep(pending)
        level = pace.current_level(state, configured)
        prof = config.profile(level)
        if client is None:
            client = AmazonClient()
        client.delay = (prof["delay_min_s"], prof["delay_max_s"])
        wait = pace.wait_seconds(state)
        if wait and not a.once:  # pausa dopo un blocco ancora in corso (anche dopo un riavvio)
            log(f"pausa dopo il blocco di Amazon: riparto alle "
                f"{datetime.fromtimestamp(state['resume_at']):%H:%M}")
            time.sleep(wait)
            continue
        log(f"ciclo '{level}': {prof['searches_per_cycle'] or len(config.SEARCHES)} ricerche, "
            f"max {prof['max_offer_fetches']} pannelli offerte")
        search_pos = state.get("search_pos", 0)
        try:
            run_cycle(client, store, prof, state)
        except CaptchaError as e:
            state["search_pos"] = search_pos  # le ricerche di questo giro si rifanno al prossimo
            pause_min = pace.on_block(state, configured)
            save_state(state, store)
            client = None  # dopo un blocco si riparte con una sessione nuova
            new_level = pace.current_level(state, configured)
            log(f"⚠️  {e} — pausa {pause_min} min, poi velocità '{new_level}'")
            telegram(f"⚠️ Amazon ha chiesto la verifica anti-robot: lo scanner riparte tra {pause_min} minuti "
                     f"a velocità '{new_level}'.")
            if a.once:
                return
            continue
        except Exception as e:  # rete instabile, CAP non impostato ecc.: non fermarti
            log(f"errore: {e!r}")
            client = None
        else:
            reached = pace.on_clean_cycle(state, configured)
            if reached:
                log(f"{config.STEP_UP_AFTER_CYCLES} cicli senza blocchi: velocità '{reached}'")
            if digest.due(state, datetime.now()):
                try:
                    if digest.post_digest(store, load_published()):
                        state["digest_date"] = datetime.now().date().isoformat()
                        log("riepilogo del giorno pubblicato nel canale")
                except Exception as e:  # non deve mai fermare lo scanner
                    log(f"errore nel riepilogo del giorno: {e!r}")
        pace.schedule_next(state, prof["cycle_minutes"])
        save_state(state, store)
        if a.once:
            return


if __name__ == "__main__":
    # i titoli hanno caratteri che alcune console non sanno mostrare: meglio un "?" che un errore
    sys.stdout.reconfigure(errors="replace")
    try:
        main()
    except Exception:
        log("errore fatale:\n" + traceback.format_exc())
        raise
