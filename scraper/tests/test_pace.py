"""Test del ritmo adattivo (scraper/pace.py) e dei profili di velocità."""
from scraper import config, pace


def test_block_slows_down_and_doubles_pause():
    state: dict = {}
    assert pace.current_level(state, "veloce") == "veloce"
    assert pace.on_block(state, "veloce") == 30
    assert pace.current_level(state, "veloce") == "normale"
    assert pace.on_block(state, "veloce") == 60
    assert pace.current_level(state, "veloce") == "lento"
    assert pace.on_block(state, "veloce") == 120          # già al minimo: resta lento
    assert pace.current_level(state, "veloce") == "lento"
    for _ in range(5):
        pace.on_block(state, "veloce")
    assert pace.on_block(state, "veloce") == config.CAPTCHA_PAUSE_MAX_MIN


def test_clean_cycles_step_back_up_but_not_above_configured():
    state = {"level": "lento", "strikes": 3}
    for _ in range(config.STEP_UP_AFTER_CYCLES - 1):
        assert not pace.on_clean_cycle(state, "normale")
    assert state["strikes"] == 0
    assert pace.on_clean_cycle(state, "normale")
    assert pace.current_level(state, "normale") == "normale"
    for _ in range(config.STEP_UP_AFTER_CYCLES * 2):
        assert not pace.on_clean_cycle(state, "normale")
    assert pace.current_level(state, "normale") == "normale"


def test_raising_scan_speed_applies_at_once_without_blocks():
    state: dict = {}
    pace.on_clean_cycle(state, "lento")
    assert pace.current_level(state, "normale") == "normale"


def test_lowering_scan_speed_wins_over_saved_level():
    assert pace.current_level({"level": "veloce"}, "lento") == "lento"
    assert pace.current_level({"level": "boh"}, "normale") == "normale"


def test_next_searches_rotates_over_all():
    searches = list("abcdefghij")
    state: dict = {}
    seen = []
    for _ in range(4):
        seen += pace.next_searches(state, searches, 3)
    assert seen[:10] == searches            # in 4 giri da 3 le copre tutte, in ordine
    assert pace.next_searches({}, searches, 0) == searches


def test_profiles_are_progressively_lighter():
    lento, normale, veloce = (config.profile(n) for n in config.SPEED_ORDER)
    assert lento["cycle_minutes"] >= normale["cycle_minutes"] >= veloce["cycle_minutes"]
    assert lento["max_offer_fetches"] <= normale["max_offer_fetches"] <= veloce["max_offer_fetches"]
    assert lento["delay_min_s"] >= normale["delay_min_s"] >= veloce["delay_min_s"]
