"""Test del formato degli avvisi Telegram (scraper/notify.py)."""
from scraper import config
from scraper.notify import CAPTION_MAX, big_image, deal_buttons, eur, format_deal, margin_bar

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
