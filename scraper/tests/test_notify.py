"""Test del formato degli avvisi Telegram (scraper/notify.py)."""
from scraper import config
from scraper import notify
from scraper.notify import (CAPTION_MAX, big_image, deal_buttons, eur, format_deal, is_new_low, margin_bar,
                            ref_warning, send_deal)

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
    assert "Usato Come nuovo · Smartphone" in text
    assert "Tuo costo -22%" in text and "1.239,44 €" in text and "1.739,00 €" in text
    assert "<a " not in text                    # niente link nel testo: niente anteprima in fondo
    assert len(text) <= CAPTION_MAX
    assert format_deal({**DEAL, "margin_pct": 61}, 22).startswith("🚀")


def test_buttons_and_helpers(monkeypatch):
    monkeypatch.setattr(config, "DASHBOARD_URL", "https://pydantic.vercel.app/")
    [[amazon, dash]] = deal_buttons(DEAL)
    assert amazon["url"] == "https://www.amazon.it/dp/B0TEST0001"
    assert dash["url"] == "https://pydantic.vercel.app/offerte"
    assert eur(1234.5) == "1.234,50 €" and eur(None) == "—"
    assert margin_bar(61) == "▰▰▰▰▰▰▱▱▱▱"


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
    assert "📉 <b>Prezzo sceso</b> da 1.700,00 €" in text


def test_group_gets_no_triage_buttons_and_photo_falls_back_to_text(monkeypatch):
    calls = []

    def fake_post(method, chat, payload, topic=None):
        calls.append((method, chat, payload, topic))
        return method == "sendMessage"             # la foto fallisce, il testo passa

    monkeypatch.setattr(notify, "post", fake_post)
    monkeypatch.setattr(config, "TELEGRAM_CHAT_ID", "111,-1009:7")
    assert send_deal({**DEAL, "image_url": "https://x/a.jpg"}, 22)
    assert [(c[0], c[1]) for c in calls] == [("sendPhoto", "111"), ("sendMessage", "111"),
                                             ("sendPhoto", "-1009"), ("sendMessage", "-1009")]
    private, group = calls[1][2]["reply_markup"]["inline_keyboard"], calls[3][2]["reply_markup"]["inline_keyboard"]
    assert private[1][0]["callback_data"] == "t:interessante:B0TEST0001" and len(group) == 1
    assert calls[3][3] == 7
