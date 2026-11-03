"""Ritmo adattivo dello scanner: rallenta quando Amazon blocca, risale dopo cicli puliti.

Funzioni pure sullo stato (un dict salvato in config.STATE_FILE), testabili offline.
"""
from __future__ import annotations

from . import config


def current_level(state: dict, configured: str) -> str:
    """Profilo attuale: quello raggiunto dall'adattamento, mai più veloce di SCAN_SPEED."""
    order = config.SPEED_ORDER
    level = state.get("level", configured)
    if level not in order:
        level = configured
    return order[min(order.index(level), order.index(configured))]


def on_block(state: dict, configured: str) -> int:
    """Amazon ha bloccato: scende di un profilo e restituisce la pausa in minuti (raddoppia a ogni blocco)."""
    order = config.SPEED_ORDER
    strikes = state.get("strikes", 0) + 1
    state["strikes"] = strikes
    state["clean_cycles"] = 0
    state["level"] = order[max(0, order.index(current_level(state, configured)) - 1)]
    return min(config.CAPTCHA_PAUSE_MIN * 2 ** (strikes - 1), config.CAPTCHA_PAUSE_MAX_MIN)


def on_clean_cycle(state: dict, configured: str) -> bool:
    """Ciclo senza blocchi: dopo STEP_UP_AFTER_CYCLES cicli puliti risale di un profilo. True se è risalito."""
    order = config.SPEED_ORDER
    state["strikes"] = 0
    state["clean_cycles"] = state.get("clean_cycles", 0) + 1
    level = current_level(state, configured)
    if order.index(level) < order.index(configured) and state["clean_cycles"] >= config.STEP_UP_AFTER_CYCLES:
        state["level"] = order[order.index(level) + 1]
        state["clean_cycles"] = 0
        if state["level"] == configured:
            del state["level"]  # rallentamento finito: si segue di nuovo SCAN_SPEED
        return True
    return False


def next_searches(state: dict, searches: list, per_cycle: int) -> list:
    """Le prossime per_cycle ricerche a rotazione (0 = tutte), così ogni ciclo pesa poco ma le copre tutte."""
    if not searches:
        return []
    n = len(searches) if per_cycle <= 0 else min(per_cycle, len(searches))
    pos = state.get("search_pos", 0) % len(searches)
    state["search_pos"] = (pos + n) % len(searches)
    return [searches[(pos + i) % len(searches)] for i in range(n)]
