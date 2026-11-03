"""Test dei comandi del bot (scraper/bot.py) e del parsing delle chat (scraper/notify.py)."""
import pytest

from scraper import bot, config
from scraper.notify import parse_chats


class FakeStore:
    def __init__(self):
        self.deals = [
            {"asin": "B0A", "title": "Scheda video", "used_price": 900.0, "profit_eur": 300.0, "margin_pct": 45.0,
             "active": True, "triage": "da_valutare"},
            {"asin": "B0B", "title": "Ignorata", "used_price": 500.0, "profit_eur": 900.0, "margin_pct": 70.0,
             "active": True, "triage": "ignorato"},
        ]

    def _req(self, method, path):
        if path.startswith("price_snapshots"):
            return [{"checked_at": "2026-11-03T10:00:00+00:00"}]
        return self.deals

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
    _, text, _ = bot.handle_update(msg("/stato"), FakeStore())
    assert "Offerte attive: <b>1</b>" in text and "sopra soglia: <b>1</b>" in text


def test_welcome_when_added_to_group():
    upd = {"my_chat_member": {"chat": {"id": -100555, "type": "supergroup"},
                              "new_chat_member": {"status": "member"}, "date": 0}}
    chat, text, _ = bot.handle_update(upd, FakeStore())
    assert chat == "-100555" and "<code>-100555</code>" in text
    upd["my_chat_member"]["new_chat_member"]["status"] = "left"
    assert bot.handle_update(upd, FakeStore()) is None
