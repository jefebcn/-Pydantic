"""Test del parsing su HTML sintetico che imita la struttura di amazon.it, più fixture reali."""
from pathlib import Path

from scraper.amazon import (is_captcha, parse_glow_csrf, parse_location_modal, parse_offers, parse_price,
                            parse_product_page_price, parse_search)

FIXTURES = Path(__file__).parent / "fixtures"

SEARCH_HTML = """
<div data-component-type="s-search-result" data-asin="B0TEST0001">
  <img class="s-image" src="https://m.media-amazon.com/images/I/x.jpg">
  <h2 aria-label="Notebook Pro 16 pollici"><span>Notebook Pro 16 pollici</span></h2>
  <span class="a-price"><span class="a-offscreen">1.099,90 €</span></span>
</div>
<div data-component-type="s-search-result" data-asin="B0TEST0002">
  <h2><span>Monitor 27</span></h2>
  <span class="a-price"><span class="a-price-whole">189,</span><span class="a-price-fraction">50</span></span>
</div>
<div data-component-type="s-search-result" data-asin="">sponsor</div>
"""

AOD_HTML = """
<div id="aod-pinned-offer">
  <div id="aod-offer-heading"><h5>Nuovo</h5></div>
  <div id="aod-offer-price"><span class="a-price"><span class="a-offscreen">1.499,00 €</span></span></div>
  <div id="aod-offer-soldBy"><span>Venduto da</span><div class="a-col-right"><span>Amazon.it</span></div></div>
</div>
<div id="aod-offer-list">
  <div id="aod-offer">
    <div id="aod-offer-heading"><h5>Usato - Come nuovo</h5></div>
    <div id="aod-offer-price"><span class="a-price"><span class="a-offscreen">1.150,00 €</span></span></div>
    <div id="aod-offer-soldBy"><div class="a-col-right"><a>Amazon Seconda Mano</a></div></div>
  </div>
  <div id="aod-offer">
    <div id="aod-offer-heading"><h5>Usato - Buone condizioni</h5></div>
    <div id="aod-offer-price"><span class="a-price"><span class="a-offscreen">1.099,90 €</span></span></div>
    <div id="aod-offer-soldBy"><div class="a-col-right"><a>Amazon Seconda Mano</a></div></div>
  </div>
  <div id="aod-offer">
    <div id="aod-offer-heading"><h5>Usato - Ottime condizioni</h5></div>
    <div id="aod-offer-price"><span class="a-price"><span class="a-offscreen">899,00 €</span></span></div>
    <div id="aod-offer-soldBy"><div class="a-col-right"><a>TechShop Srl</a></div></div>
  </div>
  <div id="aod-offer">
    <div id="aod-offer-heading"><h5>Nuovo</h5></div>
    <div id="aod-offer-price"><span class="a-price"><span class="a-offscreen">1.399,00 €</span></span></div>
    <div id="aod-offer-soldBy"><div class="a-col-right"><a>ElettroStore</a></div></div>
  </div>
</div>
"""


def test_parse_price():
    assert parse_price("1.299,99 €") == 1299.99
    assert parse_price("€ 89,00") == 89.0
    assert parse_price("189,") == 189.0
    assert parse_price("12.345") == 12345.0
    assert parse_price("") is None


def test_parse_search():
    items = parse_search(SEARCH_HTML)
    assert [i.asin for i in items] == ["B0TEST0001", "B0TEST0002"]
    assert items[0].price == 1099.90
    assert items[0].title == "Notebook Pro 16 pollici"
    assert items[0].image_url.endswith("x.jpg")
    assert items[1].price == 189.50


def test_parse_search_real_2026_layout():
    """HTML reale: il prezzo usato sta nella riga 'Ulteriori opzioni di acquisto', senza .a-price."""
    html = (FIXTURES / "search_warehouse_2026-11.html").read_text(encoding="utf-8")
    items = {i.asin: i for i in parse_search(html)}
    assert len(items) == 11
    assert items["B0GMQHW2WC"].price == 1598.22
    assert items["B0GMQ65L5B"].price == 2892.75
    assert items["B0DS5N6MWW"].price == 841.22
    assert items["B0GMQHW2WC"].title.startswith("Lenovo IdeaPad Pro 5")
    assert items["B0GMQHW2WC"].image_url
    # risultati senza prezzo in pagina: restano None (lo legge poi il pannello offerte)
    assert items["B0CH162WZW"].price is None
    assert sum(i.price is not None for i in items.values()) == 8


def test_parse_offers_picks_cheapest_seconda_mano_and_amazon_new():
    s = parse_offers(AOD_HTML)
    assert len(s.offers) == 5
    # l'usato di TechShop (899) è più basso ma non è Amazon Seconda Mano → ignorato
    assert s.used_price == 1099.90
    assert s.used_condition == "Usato - Buone condizioni"
    assert s.new_price == 1499.00        # venduto da Amazon
    assert s.new_price_any == 1399.00    # più basso di qualsiasi venditore


def test_parse_offers_real_2026_layout():
    """HTML reale del pannello offerte con CAP italiano: due offerte Amazon Seconda Mano, nessun nuovo."""
    s = parse_offers((FIXTURES / "aod_seconda_mano_2026-11.html").read_text(encoding="utf-8"))
    assert [(o.price, o.condition, o.seller) for o in s.offers] == [
        (953.14, "Usato - Ottime condizioni", "Amazon Seconda mano"),
        (973.20, "Usato - Come nuovo", "Amazon Seconda mano"),
    ]
    assert all(o.is_seconda_mano and not o.is_new for o in s.offers)
    assert s.used_price == 953.14
    assert s.used_condition == "Usato - Ottime condizioni"
    assert s.new_price is None and s.new_price_any is None


def test_product_page_price_ignores_used_only_buybox():
    """Pagina reale con solo 'Acquista Usato 953,14 €': non è il prezzo del nuovo."""
    html = (FIXTURES / "dp_solo_usato_2026-11.html").read_text(encoding="utf-8")
    assert parse_product_page_price(html) is None
    new_html = ('<div id="corePriceDisplay_desktop_feature_div"><span class="a-price">'
                '<span class="a-offscreen">749,00 €</span></span></div>')
    assert parse_product_page_price(new_html) == 749.0


def test_parse_location_modal():
    # stessa struttura del tag nella barra di amazon.it (token finti)
    html = ('<span id="nav-global-location-data-modal-action" class="a-declarative" '
            'data-a-modal=\'{"width":375, "closeButton":"true","popoverLabel":"Seleziona la tua posizione", '
            '"ajaxHeaders":{"anti-csrftoken-a2z":"tok-AAA"}, "name":"glow-modal", '
            '"url":"/portal-migration/hz/glow/get-rendered-address-selections?deviceType=desktop&amp;pageType=Search", '
            '"header":"Seleziona la tua posizione"}\'></span>')
    url, token = parse_location_modal(html)
    assert url == "/portal-migration/hz/glow/get-rendered-address-selections?deviceType=desktop&pageType=Search"
    assert token == "tok-AAA"
    assert parse_location_modal("<div>niente</div>") is None
    assert parse_glow_csrf('<script>P.declare("GLUXConfig", {CSRF_TOKEN : "tok-BBB", IDs: {}})</script>') == "tok-BBB"
    assert parse_glow_csrf("<div></div>") is None


def test_captcha_detection():
    assert is_captcha('<form action="/errors/validateCaptcha">')
    assert not is_captcha(SEARCH_HTML)
    assert is_captcha((FIXTURES / "aws_waf_challenge_2026-11.html").read_text(encoding="utf-8"))
    assert is_captcha((FIXTURES / "akamai_bm_verify_2026-11.html").read_text(encoding="utf-8"))
    assert not is_captcha((FIXTURES / "aod_seconda_mano_2026-11.html").read_text(encoding="utf-8"))
    assert not is_captcha((FIXTURES / "search_warehouse_2026-11.html").read_text(encoding="utf-8"))


def test_normalize_supabase_url():
    from scraper.config import _normalize_supabase_url as n
    assert n("https://abcdefghijklmnop.supabase.co/") == "https://abcdefghijklmnop.supabase.co"
    assert n("https://abcdefghijklmnop.supabase.co/rest/v1/") == "https://abcdefghijklmnop.supabase.co"
    assert n("abcdefghijklmnop.supabase.co") == "https://abcdefghijklmnop.supabase.co"
    assert n("https://supabase.com/dashboard/project/abcdefghijklmnop/settings/api") == "https://abcdefghijklmnop.supabase.co"
    assert n("") == ""
