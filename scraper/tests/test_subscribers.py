"""Test degli avvisi su misura, dei prodotti seguiti e del riepilogo del giorno."""
import time

import pytest

from scraper import config, digest, notify, subscribers

NOW = 1_800_000_000.0
DEAL = {"asin": "B0TEST0001", "title": "RTX", "category": "Gaming", "used_condition": "Usato - Come nuovo",
        "used_price": 500.0, "your_cost": 390.0, "ref_price": 900.0, "profit_eur": 510.0, "margin_pct": 56.7,
        "new_price": 900.0, "new_price_any": 900.0}


def sub(**kw):
    return {**subscribers._blank(), "on": True, **kw}


@pytest.fixture(autouse=True)
def isolated_file(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "SUBSCRIBERS_FILE", tmp_path / "subs.json")


def test_alert_follows_the_personal_choices():
    assert subscribers.wants_alert(sub(), DEAL, 500.0, 50, NOW)
    assert not subscribers.wants_alert(sub(on=False), DEAL, 500.0, 50, NOW)
    assert not subscribers.wants_alert(sub(margin=60), DEAL, 500.0, 50, NOW)
    assert not subscribers.wants_alert(sub(max=400), DEAL, 500.0, 50, NOW)
    assert subscribers.wants_alert(sub(max=650), DEAL, 500.0, 50, NOW)
    assert not subscribers.wants_alert(sub(cats=["Audio"]), DEAL, 500.0, 50, NOW)
    assert subscribers.wants_alert(sub(cats=["Audio", "Gaming"]), DEAL, 500.0, 50, NOW)
    assert not subscribers.wants_alert(sub(), DEAL, 500.0, 600, NOW)                       # guadagno sotto il minimo


def test_doubtful_prices_never_reach_personal_alerts():
    assert not subscribers.wants_alert(sub(), {**DEAL, "new_price": None}, 500.0, 50, NOW)


def test_no_duplicates_and_daily_limit():
    seen = sub(sent={DEAL["asin"]: {"price": 500.0, "ts": NOW - 3600}})
    assert not subscribers.wants_alert(seen, DEAL, 500.0, 50, NOW)
    assert subscribers.wants_alert(seen, DEAL, 480.0, 50, NOW)                             # è sceso
    busy = sub(sent={f"A{i}": {"price": 1.0, "ts": NOW - 60} for i in range(subscribers.DAILY_MAX)})
    assert not subscribers.wants_alert(busy, DEAL, 500.0, 50, NOW)


def test_followed_product_alerts_even_with_alerts_off_and_doubtful_price():
    subs = {"7": {**sub(on=False), "watch": {DEAL["asin"]: 600.0}}, "8": {**sub(on=False), "watch": {DEAL["asin"]: 500.0}}}
    assert subscribers.targets(subs, {**DEAL, "new_price": None}, 500.0, 50, NOW) == [("7", 600.0)]


def test_skip_only_affects_general_alerts():
    subs = {"7": sub(), "8": sub(watch={DEAL["asin"]: 600.0})}
    assert subscribers.targets(subs, DEAL, 500.0, 50, NOW, skip={"7", "8"}) == [("8", 600.0)]


def test_dispatch_remembers_what_was_sent(monkeypatch):
    sent = []
    monkeypatch.setattr(subscribers, "deal_card", lambda *a: b"jpeg")
    monkeypatch.setattr(subscribers, "send_personal", lambda chat, d, caption, card, rows, silent: sent.append(chat) or True)
    subscribers.update(7, lambda s: s.update(on=True))
    subscribers.toggle_watch(8, DEAL["asin"], 600.0)
    assert subscribers.dispatch(DEAL, 500.0, 22, 50) == 2
    assert sorted(sent) == ["7", "8"]
    assert subscribers.get(8)["watch"][DEAL["asin"]] == 500.0                              # prossimo avviso sotto questo prezzo
    assert subscribers.dispatch(DEAL, 500.0, 22, 50) == 0                                  # niente doppioni


def test_watch_toggle_limit_and_forget():
    assert subscribers.toggle_watch(7, "A", 10) is True
    assert subscribers.toggle_watch(7, "A", 10) is False
    assert subscribers.watch(7, "A", 10) and subscribers.watch(7, "A", 10)
    subscribers.update(7, lambda s: s.update(watch={str(i): 1.0 for i in range(subscribers.WATCH_MAX)}))
    assert subscribers.toggle_watch(7, "B", 10) is None
    subscribers.forget(7)
    assert subscribers.get(7)["watch"] == {}


def test_digest_uses_only_recent_verified_channel_posts(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "-100")
    good = DEAL
    old = {**DEAL, "asin": "OLD"}
    never = {**DEAL, "asin": "NEVER"}
    doubtful = {**DEAL, "asin": "DOUBT", "new_price": None}
    published = {"B0TEST0001": {"price": 1, "ts": NOW - 3600}, "OLD": {"price": 1, "ts": NOW - 90000},
                 "DOUBT": {"price": 1, "ts": NOW - 60}}
    assert digest.pick([old, never, doubtful, good], published, NOW) == [good]


def test_digest_runs_once_a_day_in_the_evening(monkeypatch):
    from datetime import datetime
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "-100")
    assert digest.due({}, datetime(2026, 11, 5, 19, 1))
    assert not digest.due({}, datetime(2026, 11, 5, 18, 59))
    assert not digest.due({"digest_date": "2026-11-05"}, datetime(2026, 11, 5, 21, 0))
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "")
    assert not digest.due({}, datetime(2026, 11, 5, 19, 1))


def test_digest_and_banner_are_jpegs():
    import io

    from PIL import Image

    from scraper.card import H, W, render_banner, render_digest
    photo = io.BytesIO()
    Image.new("RGB", (90, 40), "red").save(photo, "PNG")
    long = {**DEAL, "title": "Titolo molto lungo " * 30, "profit_eur": 99999}
    for out in (render_banner(), render_digest([long, DEAL, {**DEAL, "asin": "NOFOTO"}], {DEAL["asin"]: photo.getvalue()}, "5 novembre")):
        img = Image.open(io.BytesIO(out))
        assert img.format == "JPEG" and img.size == (W, H)
