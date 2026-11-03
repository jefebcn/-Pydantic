"""Ciclo principale: cerca offerte Seconda Mano, salva prezzi, invia avvisi.

Uso (dalla cartella del progetto):
    python -m scraper.main              # gira per sempre, al ritmo di SCAN_SPEED (default lento)
    python -m scraper.main --speed normale     # profilo massimo diverso (lento | normale | veloce)
    python -m scraper.main --once       # un solo ciclo
    python -m scraper.main --test B0XXXXXXXX   # prova un ASIN, stampa le offerte (non salva nulla)
    python -m scraper.main --search notebook   # prova una ricerca (non salva nulla)
    aggiungi --debug per salvare l'HTML scaricato in scraper/debug/
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime

from . import config, pace
from .amazon import AmazonClient, CaptchaError, LocationError, SearchItem
from .notify import format_deal, telegram


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def load_cache() -> dict:
    try:
        return json.loads(config.CACHE_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_cache(cache: dict) -> None:
    config.CACHE_FILE.write_text(json.dumps(cache))


def load_state() -> dict:
    try:
        return json.loads(config.STATE_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(state: dict) -> None:
    config.STATE_FILE.write_text(json.dumps(state))


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

    alerts = 0
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
        if d.get("triage") in ("ignorato", "acquistato"):
            continue
        if margin >= min_margin and profit >= min_profit and not store.already_alerted(it.asin, used_price):
            if telegram(format_deal(d, discount)):  # senza Telegram configurato non segna nulla
                alerts += 1
                store.mark_alerted(it.asin, used_price)

    log(f"ciclo finito: {alerts} avvisi inviati")


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
    a = ap.parse_args()
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

    from .store import Store
    store = Store()
    state = load_state()
    configured = config.SCAN_SPEED
    log(f"avvio — {len(config.SEARCHES)} ricerche, velocità massima '{configured}', "
        f"attuale '{pace.current_level(state, configured)}'")
    client = None  # stessa sessione (cookie + CAP) per più cicli, come un visitatore normale
    while True:
        level = pace.current_level(state, configured)
        prof = config.profile(level)
        if client is None:
            client = AmazonClient()
        client.delay = (prof["delay_min_s"], prof["delay_max_s"])
        log(f"ciclo '{level}': {prof['searches_per_cycle'] or len(config.SEARCHES)} ricerche, "
            f"max {prof['max_offer_fetches']} pannelli offerte")
        try:
            run_cycle(client, store, prof, state)
        except CaptchaError as e:
            pause_min = pace.on_block(state, configured)
            save_state(state)
            client = None  # dopo un blocco si riparte con una sessione nuova
            new_level = pace.current_level(state, configured)
            log(f"⚠️  {e} — pausa {pause_min} min, poi velocità '{new_level}'")
            telegram(f"⚠️ Amazon ha chiesto la verifica anti-robot: lo scanner riparte tra {pause_min} minuti "
                     f"a velocità '{new_level}'.")
            if a.once:
                return
            time.sleep(pause_min * 60)
            continue
        except Exception as e:  # rete instabile, CAP non impostato ecc.: non fermarti
            log(f"errore: {e!r}")
            client = None
        else:
            if pace.on_clean_cycle(state, configured):
                log(f"{config.STEP_UP_AFTER_CYCLES} cicli senza blocchi: velocità '{state['level']}'")
        save_state(state)
        if a.once:
            return
        log(f"prossimo ciclo tra {prof['cycle_minutes']} min")
        time.sleep(prof["cycle_minutes"] * 60)


if __name__ == "__main__":
    main()
