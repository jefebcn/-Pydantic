"""Test dei comandi del bot (scraper/bot.py) e del parsing delle chat (scraper/notify.py)."""
from datetime import datetime, timedelta, timezone

import pytest

from scraper import bot, config, subscribers
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
        if path.startswith("clicks"):
            return [{"source": "canale"}, {"source": "canale"}, {"source": "bot"}]
        return self.deals

    def deal(self, asin):
        return next((d for d in self.deals if d["asin"] == asin), None)

    def set_triage(self, asin, triage):
        self.triage[asin] = triage

    def settings(self):
        return {"alert_margin_pct": 40, "alert_profit_eur": 50}


@pytest.fixture(autouse=True)
def linked_chat(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "TELEGRAM_CHAT_ID", "111, -1009:7")
    monkeypatch.setattr(config, "SUBSCRIBERS_FILE", tmp_path / "subs.json")


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


def group(text, chat=-1009):
    return msg(text, chat=chat, chat_type="supergroup")


def test_help_and_chatid_answer_everywhere():
    chat, screen, _ = bot.handle_update(msg("/start", chat=555), FakeStore())
    assert chat == "555" and isinstance(screen, bot.Screen) and "Ciao" in screen.caption
    _, text, _ = bot.handle_update(group("/start", chat=-555), FakeStore())
    assert "/top" in text
    chat, text, topic = bot.handle_update(msg("/chatid", chat=-1009, chat_type="supergroup", topic=7), FakeStore())
    assert "<code>-1009:7</code>" in text and "già collegata" in text and topic == 7


def test_offers_are_public_and_stato_is_only_for_linked_chats():
    _, text, _ = bot.handle_update(group("/top", chat=-555), FakeStore())
    assert "Scheda video" in text and "Ignorata" not in text and "+300 €" in text
    assert "Vista troppo tempo fa" not in text            # fuori dalla finestra dell'ultimo giro
    _, text, _ = bot.handle_update(msg("/stato", chat=555), FakeStore())
    assert "chi gestisce il bot" in text
    _, text, _ = bot.handle_update(msg("/stato"), FakeStore())
    assert "Offerte attive: <b>2</b>" in text and "sopra soglia: <b>2</b>" in text and "1 da verificare" in text
    assert "Ultimo giro: <b>adesso</b>" in text


def test_offers_stay_live_when_the_scanner_is_off():
    store = FakeStore()
    store.deals = [deal("B0A", "Scheda video", 900.0, 300.0, 45.0, seen=20)]  # PC spento da 20 ore
    _, text, _ = bot.handle_update(group("/top"), store)
    assert "Scheda video" in text


def test_top_limit_and_warning_flag():
    _, text, _ = bot.handle_update(group("/top 1"), FakeStore())
    assert "Scheda video" in text and "Notebook" not in text
    _, text, _ = bot.handle_update(group("/top 99"), FakeStore())
    assert "Notebook terzi" in text and "⚠️" in text      # riferimento solo da altri venditori
    store = FakeStore()
    store.deals = [deal("B0C", "Notebook terzi", 1200.0, 900.0, 41.0, new_price=None), deal("B0A", "Scheda video", 900.0, 300.0, 45.0)]
    _, text, _ = bot.handle_update(group("/top 1"), store)
    assert "Scheda video" in text and "Notebook" not in text   # i prezzi verificati vengono prima


def test_nuove_cerca_fasce():
    _, text, _ = bot.handle_update(group("/nuove"), FakeStore())
    assert "1 nuove" in text and "Scheda video" in text and "Notebook" not in text
    _, text, _ = bot.handle_update(group("/cerca rtx SCHEDA"), FakeStore())
    assert "Scheda video" in text and "Notebook" not in text
    _, text, _ = bot.handle_update(group("/cerca <niente>"), FakeStore())
    assert "&lt;niente&gt;" in text
    _, text, _ = bot.handle_update(group("/cerca"), FakeStore())
    assert "/cerca rtx 5070" in text
    _, text, _ = bot.handle_update(group("/fasce"), FakeStore())
    assert "650 – 999 €</b>: 1" in text and "1.000 – 1.599 €</b>: 1" in text and "100 – 399" not in text


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


def press(data, store, chat=555, chat_type="private"):
    return bot.handle_nav({"id": "1", "data": data, "from": {"first_name": "Ada"},
                           "message": {"message_id": 9, "chat": {"id": chat, "type": chat_type}}}, store)


def buttons(screen):
    return [b for row in screen.rows for b in row]


def test_every_button_fits_in_telegram_limits():
    long = "è" * 200
    store = FakeStore()
    store.deals = [deal("B0AAAAAAAA", long, 900.0, 300.0, 45.0), deal("B0BBBBBBBB", long, 800.0, 200.0, 45.0)]
    screen = bot.deal_screen(store, 555, "s", 0, long)
    assert all(len(b["callback_data"].encode()) <= 64 for b in buttons(screen) if "callback_data" in b)
    assert len(screen.caption) <= 1024


def test_private_chat_browses_with_a_carousel():
    store = FakeStore()
    _, screen, _ = bot.handle_update(msg("/top", chat=555), store)
    assert "1 di 2" in screen.caption and "Scheda video" in screen.caption and "Ignorata" not in screen.caption
    assert "Voto Hunter" in screen.caption
    arrows = screen.rows[0]
    assert arrows[0]["callback_data"] == "d:top:1:" and arrows[2]["callback_data"] == "d:top:1:"     # gira in tondo
    _, second = press(arrows[2]["callback_data"], store)
    assert "2 di 2" in second.caption and "Notebook terzi" in second.caption and "⚠️" in second.caption


def test_writing_a_name_searches():
    _, screen, _ = bot.handle_update(msg("scheda video", chat=555), FakeStore())
    assert "Scheda video" in screen.caption
    _, screen, _ = bot.handle_update(msg("<niente>", chat=555), FakeStore())
    assert "&lt;niente&gt;" in screen.caption


def test_budget_and_categories_lead_to_filtered_cards():
    store = FakeStore()
    store.deals[1]["category"] = "Gaming"
    _, budget = press("m:b", store)
    target = next(b for b in buttons(budget) if b["text"].startswith("650"))
    _, screen = press(target["callback_data"], store)
    assert "Scheda video" in screen.caption and "1 di" not in screen.caption
    _, categories = press("m:c", store)
    _, screen = press(buttons(categories)[0]["callback_data"], store)
    assert "Scheda video" in screen.caption


def test_follow_a_price_from_the_card_and_see_it_in_the_list():
    store = FakeStore()
    store.deals = [deal("B0AAAAAAAA", "Scheda video", 900.0, 300.0, 45.0)]
    _, screen, _ = bot.handle_update(msg("/seguiti", chat=555), store)
    assert "Non segui ancora" in screen.caption
    _, top = press("d:top:0:", store)
    follow = next(b for b in buttons(top) if b["text"].startswith("🔔"))
    notice, after = press(follow["callback_data"], store)
    assert "scende" in notice and any(b["text"].startswith("🔕") for b in buttons(after))
    assert subscribers.get(555)["watch"] == {"B0AAAAAAAA": 900.0}
    _, screen, _ = bot.handle_update(msg("/seguiti", chat=555), store)
    assert "Scheda video" in screen.caption


def test_alert_settings():
    store = FakeStore()
    _, screen = press("a", store)
    assert "spenti" in screen.caption
    press("a:on", store)
    press("a:c:Audio", store)
    press("a:b:650", store)
    _, screen = press("a:m:50", store)
    assert "accesi" in screen.caption and "Audio" in screen.caption and "650 €" in screen.caption and "50%" in screen.caption
    press("a:c:Audio", store)
    press("a:b:0", store)
    assert subscribers.get(555)["cats"] == [] and subscribers.get(555)["max"] is None


def test_links_from_channel_and_site():
    store = FakeStore()
    store.deals = [deal("B0AAAAAAAA", "Scheda video", 900.0, 300.0, 45.0)]
    _, screen, _ = bot.handle_update(msg("/start w_B0AAAAAAAA", chat=555), store)
    assert "Ora lo segui" in screen.caption and "Scheda video" in screen.caption
    assert subscribers.get(555)["watch"] == {"B0AAAAAAAA": 900.0}
    _, screen, _ = bot.handle_update(msg("/start w_B0AAAAAAAA", chat=555), store)   # secondo clic: lo segue ancora
    assert subscribers.get(555)["watch"] == {"B0AAAAAAAA": 900.0}
    _, screen, _ = bot.handle_update(msg("/start avvisi", chat=555), store)
    assert "avvisi su misura" in screen.caption
    _, screen, _ = bot.handle_update(msg("/start boh", chat=555), store)
    assert "Ciao" in screen.caption


def test_buttons_do_not_work_in_groups_and_bad_data_is_refused():
    store = FakeStore()
    assert press("a:on", store, chat=-1009, chat_type="supergroup")[1] is None
    assert press("x:niente", store)[1] is None
    assert subscribers.get(-1009)["on"] is False


def test_blocking_the_bot_forgets_the_person():
    subscribers.update(555, lambda s: s.update(on=True))
    upd = {"my_chat_member": {"chat": {"id": 555, "type": "private"}, "new_chat_member": {"status": "kicked"}, "date": 0}}
    assert bot.handle_update(upd, FakeStore()) is None
    assert subscribers.get(555)["on"] is False


def test_show_reuses_the_uploaded_image(monkeypatch):
    calls = []

    def fake_api(method, **kw):
        calls.append((method, kw))
        return {"result": {"photo": [{"file_id": "piccola"}, {"file_id": "GRANDE"}]}}

    monkeypatch.setattr(bot, "api", fake_api)
    monkeypatch.setattr(bot, "_file_ids", {})
    screen = bot.Screen("testo", [], key="k", image=lambda: b"jpeg")
    assert bot.show(1, screen)
    assert calls[0][0] == "sendPhoto" and "files" in calls[0][1]
    assert bot.show(1, screen, message_id=5)
    assert calls[1][0] == "editMessageMedia" and calls[1][1]["files"] is None
    assert '"media": "GRANDE"' in calls[1][1]["data"]["media"]


def test_show_falls_back_to_the_banner_without_a_photo(monkeypatch):
    calls = []
    monkeypatch.setattr(bot, "api", lambda method, **kw: calls.append(kw) or {"result": {}})
    monkeypatch.setattr(bot, "_file_ids", {})
    monkeypatch.setattr(bot, "banner", lambda: b"banner")
    assert bot.show(1, bot.Screen("testo", [], key="k", image=lambda: None))
    assert calls[0]["files"]["photo"][1] == b"banner"


def test_premium_question_and_audience_numbers(monkeypatch):
    monkeypatch.setattr(bot, "api", lambda method, **kw: {"result": 42})
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "-100")
    store = FakeStore()
    _, screen = press("p", store)
    assert "non ti impegna" in screen.caption
    notice, screen = press("p:15", store)
    assert "Grazie" in notice and any(b["text"].startswith("✅ Fino a 15") for b in buttons(screen))
    assert press("p:99", store)[1] is None
    _, text, _ = bot.handle_update(msg("/stato"), store)
    assert "Bot: <b>1</b> persone, 1 attive" in text and "15 € <b>1</b>" in text
    assert "Canale: <b>42</b> iscritti" in text and "<b>3</b> (canale 2 · bot 1)" in text


def test_stato_survives_a_missing_clicks_table(monkeypatch):
    monkeypatch.setattr(bot, "api", lambda method, **kw: None)
    store = FakeStore()
    real = store._req

    def broken(method, path):
        if path.startswith("clicks"):
            raise RuntimeError("relation does not exist")
        return real(method, path)

    store._req = broken
    _, text, _ = bot.handle_update(msg("/stato"), store)
    assert "da attivare" in text and "Offerte attive" in text


def test_process_update_answers_and_skips_old_messages(monkeypatch):
    sent = []
    monkeypatch.setattr(bot, "post", lambda method, chat, payload, topic=None: sent.append(payload["text"]) or True)
    monkeypatch.setattr(bot, "show", lambda chat, screen, message_id=None: sent.append(screen.caption) or True)
    now = int(__import__("time").time())
    fresh = group("/top")
    fresh["message"]["date"] = now
    bot.process_update(fresh, FakeStore())
    assert "Scheda video" in sent[-1]
    stale = msg("/start", chat=555)
    stale["message"]["date"] = now - bot.OLD_UPDATE_S - 5
    bot.process_update(stale, FakeStore())
    assert len(sent) == 1
    new = msg("/start", chat=555)
    new["message"]["date"] = now
    bot.process_update(new, FakeStore())
    assert "Ciao" in sent[-1]


def test_a_broken_command_still_gets_an_answer(monkeypatch):
    sent = []
    monkeypatch.setattr(bot, "post", lambda method, chat, payload, topic=None: sent.append((chat, payload["text"])) or True)
    monkeypatch.setattr(bot, "handle_update", lambda u, s: 1 / 0)
    update = group("/top")
    update["message"]["date"] = int(__import__("time").time())
    bot.process_update(update, FakeStore())
    assert sent[0][0] == "-1009" and "Errore" in sent[0][1]


def test_home_warns_when_prices_are_old():
    store = FakeStore()
    store.deals = [deal("B0AAAAAAAA", "Scheda video", 900.0, 300.0, 45.0, seen=3)]
    assert "verificali su Amazon" in bot.home_screen(store).caption
    fresh = FakeStore()
    fresh.deals = [deal("B0AAAAAAAA", "Scheda video", 900.0, 300.0, 45.0)]
    assert "verificali" not in bot.home_screen(fresh).caption


def test_online_status_reads_the_state_from_the_database(monkeypatch):
    monkeypatch.setattr(config, "BOT_ONLINE", True)
    monkeypatch.setattr(bot, "api", lambda method, **kw: None)
    monkeypatch.setattr(subscribers, "_store", type("R", (), {"_req": lambda self, *a, **k: []})())
    store = FakeStore()
    future = __import__("time").time() + 1800
    store.get_state = lambda key: {"level": "lento", "speed": "normale", "resume_at": future}
    _, text, _ = bot.handle_update(msg("/stato"), store)
    assert "riparte tra <b>30 min</b>" in text and "massima normale" in text


def test_webhook_secret_comes_from_the_token_and_is_valid_for_telegram(monkeypatch):
    import re
    monkeypatch.setattr(config, "TELEGRAM_BOT_TOKEN", "123:abc")
    first = bot.webhook_secret()
    assert re.fullmatch(r"[A-Za-z0-9_-]{1,256}", first) and "abc" not in first
    monkeypatch.setattr(config, "TELEGRAM_BOT_TOKEN", "123:def")
    assert bot.webhook_secret() != first
