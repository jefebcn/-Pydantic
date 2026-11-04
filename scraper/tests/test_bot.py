"""Test dei comandi del bot (scraper/bot.py) e del parsing delle chat (scraper/notify.py)."""
from datetime import datetime, timedelta, timezone

import pytest

from scraper import bot, config
from scraper.notify import parse_chats


def hours_ago(h):
    return (datetime.now(timezone.utc) - timedelta(hours=h)).isoformat()


def deal(asin, title, price, profit, margin, triage="da_valutare", seen=0, first=1, new_price=1500.0, new_any=1500.0):
    return {"asin": asin, "title": title, "used_price": price, "profit_eur": profit, "margin_pct": margin,
            "triage": triage, "last_seen_at": hours_ago(seen), "first_seen_at": hours_ago(first),
            "new_price": new_price, "new_price_any": new_any}


class FakeStore:
    def __init__(self):
        self.triage = {}
        self.deals = [  # come deals_v con order=profit_eur.desc
            deal("B0B", "Ignorata", 500.0, 900.0, 70.0, triage="ignorato"),
            deal("B0A", "Scheda video RTX", 900.0, 300.0, 45.0),
            deal("B0C", "Notebook terzi", 1200.0, 200.0, 41.0, first=100, new_price=None),
            deal("B0D", "Vista troppo tempo fa", 150.0, 100.0, 42.0, seen=8),
        ]

    def _req(self, method, path):
        if path.startswith("price_snapshots"):
            return [{"checked_at": hours_ago(1)}]
        return self.deals

    def set_triage(self, asin, triage):
        self.triage[asin] = triage

    def settings(self):
        return {"alert_margin_pct": 40, "alert_profit_eur": 50}


@pytest.fixture(autouse=True)
def linked_chat(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_CHAT_ID", "111, -1009:7")


def msg(text, chat=111, chat_type="private", topic=None):
    m = {"text": text, "chat": {"id": chat, "type": chat_type}, "date": 0}
    if topic:
        m.update(message_thread_id=topic, is_topic_message=True)
    return {"message": m}


def test_parse_chats():
    assert parse_chats("8498296680, -1001234567890:42,") == [("8498296680", None), ("-1001234567890", 42)]
    assert parse_chats("") == []


def test_command_of():
    assert bot.command_of("/top@SecondHandHunter_Bot ciao") == "top"
    assert bot.command_of("ciao") is None


def test_help_and_chatid_answer_everywhere():
    chat, text, _ = bot.handle_update(msg("/start", chat=555), FakeStore())
    assert chat == "555" and "/top" in text
    chat, text, topic = bot.handle_update(msg("/chatid", chat=-1009, chat_type="supergroup", topic=7), FakeStore())
    assert "<code>-1009:7</code>" in text and "già collegata" in text and topic == 7


def test_top_and_stato_only_in_linked_chats():
    _, text, _ = bot.handle_update(msg("/top", chat=555), FakeStore())
    assert "non è collegata" in text
    _, text, _ = bot.handle_update(msg("/top"), FakeStore())
    assert "Scheda video" in text and "Ignorata" not in text and "+300 €" in text
    assert "Vista troppo tempo fa" not in text            # fuori dalla finestra dell'ultimo giro
    _, text, _ = bot.handle_update(msg("/stato"), FakeStore())
    assert "Offerte attive: <b>2</b>" in text and "sopra soglia: <b>2</b>" in text and "1 da verificare" in text
    assert "Ultimo giro: <b>adesso</b>" in text


def test_offers_stay_live_when_the_scanner_is_off():
    store = FakeStore()
    store.deals = [deal("B0A", "Scheda video", 900.0, 300.0, 45.0, seen=20)]  # PC spento da 20 ore
    _, text, _ = bot.handle_update(msg("/top"), store)
    assert "Scheda video" in text


def test_top_limit_and_warning_flag():
    _, text, _ = bot.handle_update(msg("/top 1"), FakeStore())
    assert "Scheda video" in text and "Notebook" not in text
    _, text, _ = bot.handle_update(msg("/top 99"), FakeStore())
    assert "Notebook terzi" in text and "⚠️" in text      # riferimento solo da altri venditori
    store = FakeStore()
    store.deals = [deal("B0C", "Notebook terzi", 1200.0, 900.0, 41.0, new_price=None), deal("B0A", "Scheda video", 900.0, 300.0, 45.0)]
    _, text, _ = bot.handle_update(msg("/top 1"), store)
    assert "Scheda video" in text and "Notebook" not in text   # i prezzi verificati vengono prima


def test_nuove_cerca_fasce():
    _, text, _ = bot.handle_update(msg("/nuove"), FakeStore())
    assert "1 nuove" in text and "Scheda video" in text and "Notebook" not in text
    _, text, _ = bot.handle_update(msg("/cerca rtx SCHEDA"), FakeStore())
    assert "Scheda video" in text and "Notebook" not in text
    _, text, _ = bot.handle_update(msg("/cerca <niente>"), FakeStore())
    assert "&lt;niente&gt;" in text
    _, text, _ = bot.handle_update(msg("/cerca"), FakeStore())
    assert "/cerca rtx 5070" in text
    _, text, _ = bot.handle_update(msg("/fasce"), FakeStore())
    assert "650 – 999 €</b>: 1" in text and "1.000 – 1.599 €</b>: 1" in text and "100 – 399" not in text
    _, text, _ = bot.handle_update(msg("/nuove", chat=555), FakeStore())
    assert "non è collegata" in text


def callback(data, chat=111, chat_type="private"):
    return {"id": "1", "data": data, "message": {
        "message_id": 9, "chat": {"id": chat, "type": chat_type},
        "reply_markup": {"inline_keyboard": [[{"text": "Apri", "url": "https://x"}], [{"text": "vecchio"}]]}}}


def test_triage_buttons_only_in_linked_private_chats():
    store = FakeStore()
    notice, rows = bot.handle_callback(callback("t:interessante:B0TEST0001"), store)
    assert store.triage == {"B0TEST0001": "interessante"} and "interessante" in notice
    assert rows[0][0]["text"] == "Apri" and rows[1][0]["callback_data"] == "t:da_valutare:B0TEST0001"

    other = FakeStore()
    assert bot.handle_callback(callback("t:ignorato:B0TEST0001", chat=555), other)[1] is None
    assert bot.handle_callback(callback("t:ignorato:B0TEST0001", chat=-1009, chat_type="supergroup"), other)[1] is None
    assert bot.handle_callback(callback("t:acquistato:B0TEST0001"), other)[1] is None
    assert bot.handle_callback(callback("t:ignorato:../settings"), other)[1] is None
    assert other.triage == {}


def test_welcome_when_added_to_group():
    upd = {"my_chat_member": {"chat": {"id": -100555, "type": "supergroup"},
                              "new_chat_member": {"status": "member"}, "date": 0}}
    chat, text, _ = bot.handle_update(upd, FakeStore())
    assert chat == "-100555" and "<code>-100555</code>" in text
    upd["my_chat_member"]["new_chat_member"]["status"] = "left"
    assert bot.handle_update(upd, FakeStore()) is None


def test_public_channel_gets_no_setup_instructions(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_CHAT_ID", "111")
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "-100777")
    chat = {"id": -100777, "type": "channel"}
    added = {"my_chat_member": {"chat": chat, "new_chat_member": {"status": "administrator"}, "date": 0}}
    assert bot.handle_update(added, FakeStore()) is None
    assert bot.handle_update({"channel_post": {"chat": chat, "text": "/start"}}, FakeStore()) is None
    assert bot.is_linked(-100777) and bot.is_linked(111) and not bot.is_linked(555)
