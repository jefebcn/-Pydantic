"""Test del formato degli avvisi Telegram (scraper/notify.py)."""
from scraper import config
from scraper import notify
from scraper.notify import (CAPTION_MAX, big_image, channel_wants, deal_buttons, eur, format_deal, is_new_low,
                            is_quiet_hour, ref_warning, send_channel, send_deal)

DEAL = {
    "asin": "B0TEST0001", "title": "Apple iPhone 18 Pro 512 GB <Titanio>", "category": "Smartphone",
    "used_condition": "Usato - Come nuovo", "used_price": 1589.02, "your_cost": 1239.44,
    "ref_price": 1739.0, "profit_eur": 499.56, "margin_pct": 28.7,
}


def test_big_image_asks_amazon_for_1000px():
    assert big_image("https://m.media-amazon.com/images/I/71abc._AC_UY218_.jpg") == \
        "https://m.media-amazon.com/images/I/71abc._AC_SL1000_.jpg"
    assert big_image("https://m.media-amazon.com/images/I/71abc.jpg") == "https://m.media-amazon.com/images/I/71abc.jpg"
    assert big_image(None) is None


def test_format_deal_caption():
    text = format_deal(DEAL, 22)
    assert text.startswith("💡 <b>MARGINE 29%</b>")
    assert "+500 €" in text
    assert "&lt;Titanio&gt;" in text            # titolo con caratteri HTML escapati
    assert "📦 Usato: Come nuovo" in text and "#Smartphone" in text
    assert "Con sconto 22%: <b>1.239,44 €</b>" in text and "<s>1.739,00 €</s>" in text
    assert "<a " not in text                    # niente link nel testo: niente anteprima in fondo
    assert len(text) <= CAPTION_MAX
    assert format_deal({**DEAL, "margin_pct": 61}, 22).startswith("🚀")


def test_buttons_and_helpers(monkeypatch):
    monkeypatch.setattr(config, "DASHBOARD_URL", "https://pydantic.vercel.app/")
    [[amazon, dash]] = deal_buttons(DEAL)
    assert amazon["url"] == "https://pydantic.vercel.app/vai/B0TEST0001?da=avviso"
    assert dash["url"] == "https://pydantic.vercel.app/offerte/B0TEST0001"
    assert eur(1234.5) == "1.234,50 €" and eur(None) == "—"


def test_reference_warning():
    assert ref_warning({"new_price": 1000.0, "new_price_any": 1000.0}) is None
    assert ref_warning({"new_price": 1000.0, "new_price_any": 960.0}) is None      # differenza normale
    assert ref_warning({"new_price": None, "new_price_any": 1000.0}).startswith("Nuovo solo")
    assert "1.800 €" in ref_warning({"new_price": 2211.57, "new_price_any": 1800.0})
    assert "⚠️ Nuovo solo" in format_deal({**DEAL, "new_price": None, "new_price_any": 1739.0}, 22)
    assert "⚠️" not in format_deal({**DEAL, "new_price": 1739.0, "new_price_any": 1739.0}, 22)


def test_alert_again_only_when_price_really_drops():
    assert is_new_low(100.0, None)
    assert not is_new_low(100.0, 100.0)
    assert not is_new_low(120.0, 100.0)          # è risalito: già avvisato a meno
    assert not is_new_low(99.5, 100.0)           # pochi centesimi: non vale un altro messaggio
    assert is_new_low(99.0, 100.0)
    text = format_deal(DEAL, 22, previous=1700.0)
    assert "📉 <b>Prezzo sceso</b> da <s>1.700,00 €</s>" in text


VERIFIED = {**DEAL, "new_price": 1739.0, "new_price_any": 1739.0}


def test_channel_publishes_only_verified_deals_without_repeats(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "-100777")
    now, day = 1_000_000_000.0, 86400
    assert channel_wants(VERIFIED, 1589.0, None, now)
    assert not channel_wants({**VERIFIED, "new_price": None}, 1589.0, None, now)     # riferimento dubbio
    recent = {"price": 1589.0, "ts": now - day}
    assert not channel_wants(VERIFIED, 1589.0, recent, now)                          # già uscita
    assert not channel_wants(VERIFIED, 1700.0, recent, now)                          # è risalita
    assert channel_wants(VERIFIED, 1500.0, recent, now)                              # è scesa davvero
    assert channel_wants(VERIFIED, 1589.0, {"price": 1589.0, "ts": now - 8 * day}, now)  # dopo una settimana
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "")
    assert not channel_wants(VERIFIED, 1589.0, None, now)                            # canale non configurato


def test_channel_post_has_card_and_no_triage_buttons(monkeypatch):
    uploads = []
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "-100777")
    monkeypatch.setattr(config, "DASHBOARD_URL", "https://pydantic.vercel.app")
    monkeypatch.setattr(notify, "deal_card", lambda *a: b"jpeg")
    monkeypatch.setattr(notify, "upload_photo", lambda chat, jpeg, payload, topic=None: uploads.append((chat, jpeg, payload)) or True)
    assert send_channel(VERIFIED, 22)
    (chat, jpeg, payload), = uploads
    assert chat == "-100777" and jpeg == b"jpeg" and "MARGINE" in payload["caption"]
    [[amazon, site], [follow]] = payload["reply_markup"]["inline_keyboard"]
    assert amazon["url"].endswith("/vai/B0TEST0001?da=canale") and site["url"].endswith("/offerte/B0TEST0001")
    assert follow["url"].endswith("?start=w_B0TEST0001")


def test_service_messages_never_reach_the_channel(monkeypatch):
    chats = []
    monkeypatch.setattr(config, "TELEGRAM_CHAT_ID", "111")
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "-100777")
    monkeypatch.setattr(notify, "post", lambda method, chat, payload, topic=None: chats.append(chat) or True)
    assert notify.telegram("⚠️ Amazon ha chiesto la verifica")
    assert chats == ["111"]


def test_quiet_hours():
    assert is_quiet_hour(23) and is_quiet_hour(3) and not is_quiet_hour(8) and not is_quiet_hour(22)


def test_card_is_a_jpeg_and_long_titles_stay_inside():
    import io

    from PIL import Image

    from scraper.card import H, W, clean_title, render_card
    assert clean_title("Drone ＜249 g 🚀  con Gimbal") == "Drone <249 g con Gimbal"
    photo = io.BytesIO()
    Image.new("RGB", (40, 90), "red").save(photo, "PNG")
    long = {**DEAL, "title": "Titolo molto lungo " * 30, "used_price": 123456.78, "ref_price": 234567.89, "profit_eur": 99999}
    out = render_card(long, 22, photo.getvalue(), previous=130000.0)
    img = Image.open(io.BytesIO(out))
    assert img.format == "JPEG" and img.size == (W, H)


def test_card_problem_does_not_lose_the_alert(monkeypatch):
    def broken(*a, **k):
        raise OSError("rete giù")

    monkeypatch.setattr(notify.requests, "get", broken)
    assert notify.deal_card({**DEAL, "image_url": "https://x/a.jpg"}, 22) is None
    assert notify.deal_card(DEAL, 22) is None                                        # prodotto senza foto


def test_group_gets_no_triage_buttons_and_photo_falls_back_to_text(monkeypatch):
    calls = []

    def fake_post(method, chat, payload, topic=None):
        calls.append((method, chat, payload, topic))
        return method == "sendMessage"             # la foto fallisce, il testo passa

    monkeypatch.setattr(notify, "post", fake_post)
    monkeypatch.setattr(notify, "deal_card", lambda *a: None)
    monkeypatch.setattr(config, "TELEGRAM_CHAT_ID", "111,-1009:7")
    assert send_deal({**DEAL, "image_url": "https://x/a.jpg"}, 22)
    assert [(c[0], c[1]) for c in calls] == [("sendPhoto", "111"), ("sendMessage", "111"),
                                             ("sendPhoto", "-1009"), ("sendMessage", "-1009")]
    private, group = calls[1][2]["reply_markup"]["inline_keyboard"], calls[3][2]["reply_markup"]["inline_keyboard"]
    assert private[1][0]["callback_data"] == "t:interessante:B0TEST0001" and len(group) == 1
    assert calls[3][3] == 7


def test_hunter_score():
    """Gli stessi casi valgono per hunterScore in lib/format.ts."""
    from scraper.notify import hunter_score, score_label
    verified = {"new_price": 1000.0, "new_price_any": 1000.0}
    top = {**verified, "margin_pct": 61, "profit_eur": 428, "used_condition": "Usato - Condizioni accettabili"}
    assert hunter_score(top) == 85 and score_label(top) == "Affare top"
    sony = {**verified, "margin_pct": 44, "profit_eur": 353, "used_condition": "Usato - Come nuovo"}
    assert hunter_score(sony) == 87
    low = {**verified, "margin_pct": 24, "profit_eur": 97, "used_condition": "Usato - Buone condizioni"}
    assert hunter_score(low) == 40 and score_label(low) == "Buono"
    assert hunter_score({**verified, "margin_pct": -5, "profit_eur": -20}) == 8                # senza condizioni né guadagno
    doubtful = {**top, "new_price": None}
    assert hunter_score(doubtful) == 40 and score_label(doubtful) == "Da verificare"


def ready_deal(asin, score_margin=60, profit=300, checked_hours=1, **kw):
    from datetime import datetime, timedelta, timezone
    checked = datetime.now(timezone.utc) - timedelta(hours=checked_hours)
    return {"asin": asin, "used_price": 500.0, "margin_pct": score_margin, "profit_eur": profit, "used_condition": "Usato - Buone condizioni",
            "new_price": 900.0, "new_price_any": 900.0, "checked_at": checked.isoformat(), **kw}


def test_channel_posts_the_best_one_at_its_own_pace(monkeypatch):
    import time

    from scraper.notify import CHANNEL_DAILY_MAX, channel_next
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "-100")
    now = time.time()
    best, good, weak = ready_deal("BEST"), ready_deal("GOOD", 45, 150), ready_deal("WEAK", 41, 60)
    assert channel_next([weak, good, best], {}, now, 12, 40, 50)["asin"] == "BEST"
    assert channel_next([weak], {}, now, 12, 40, 50) is None                                   # voto troppo basso
    assert channel_next([best], {}, now, 3, 40, 50) is None                                    # di notte aspetta
    stale = ready_deal("OLD", checked_hours=9)
    assert channel_next([stale], {}, now, 12, 40, 50) is None                                  # prezzo troppo vecchio
    assert channel_next([ready_deal("NOPE", new_price=None)], {}, now, 12, 40, 50) is None     # prezzo dubbio
    just_posted = {"X": {"price": 1.0, "ts": now - 600}}
    ordinary = ready_deal("ORD", 50, 200)
    assert channel_next([ordinary], just_posted, now, 12, 40, 50) is None                      # troppo presto
    assert channel_next([best], just_posted, now, 12, 40, 50)["asin"] == "BEST"                # affare eccezionale: subito
    assert channel_next([ordinary], {"X": {"price": 1.0, "ts": now - 3600}}, now, 12, 40, 50)["asin"] == "ORD"
    full = {str(i): {"price": 1.0, "ts": now - 3600 - i} for i in range(CHANNEL_DAILY_MAX)}
    assert channel_next([best], full, now, 12, 40, 50) is None                                 # limite del giorno
    assert channel_next([best], {"BEST": {"price": 500.0, "ts": now - 3600}}, now, 12, 40, 50) is None   # già uscita


def test_channel_post_is_corrected_when_the_price_changes():
    from scraper.notify import channel_edit_needed
    last = {"price": 100.0, "ts": 0}
    assert channel_edit_needed(last, 110.0)                         # è salito
    assert not channel_edit_needed(last, 100.5)                     # variazione minima
    assert not channel_edit_needed(last, 90.0)                      # è sceso: si ripubblica
    risen = {**last, "shown": 110.0}
    assert not channel_edit_needed(risen, 110.0)                    # già corretto
    assert channel_edit_needed(risen, 120.0)                        # sale ancora
    assert channel_edit_needed(risen, 100.0)                        # è tornato: via l'avviso


def test_edit_keeps_buttons_and_warns(monkeypatch):
    calls = []
    monkeypatch.setattr(config, "TELEGRAM_CHANNEL_ID", "-100")
    monkeypatch.setattr(notify, "call", lambda method, body: calls.append((method, body)) or {"ok": True})
    assert notify.edit_channel_post(7, DEAL, 22, 1500.0, 1589.02)
    method, body = calls[0]
    assert method == "editMessageCaption" and body["message_id"] == 7 and "Prezzo salito" in body["caption"]
    assert body["reply_markup"]["inline_keyboard"]
    assert notify.edit_channel_post(7, DEAL, 22, 1589.02, 1589.02)
    assert "Prezzo salito" not in calls[1][1]["caption"]


def test_links_to_amazon_are_counted_only_with_a_site(monkeypatch):
    monkeypatch.setattr(config, "DASHBOARD_URL", "https://x.app/")
    assert notify.out_url("B0TEST0001", "bot") == "https://x.app/vai/B0TEST0001?da=bot"
    monkeypatch.setattr(config, "DASHBOARD_URL", "")
    assert notify.out_url("B0TEST0001", "bot") == "https://www.amazon.it/dp/B0TEST0001"
