"""Test del parsing su HTML sintetico che imita la struttura di amazon.it."""
from scraper.amazon import is_captcha, parse_offers, parse_price, parse_search

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


def test_parse_offers_picks_cheapest_seconda_mano_and_amazon_new():
    s = parse_offers(AOD_HTML)
    assert len(s.offers) == 5
    # l'usato di TechShop (899) è più basso ma non è Amazon Seconda Mano → ignorato
    assert s.used_price == 1099.90
    assert s.used_condition == "Usato - Buone condizioni"
    assert s.new_price == 1499.00        # venduto da Amazon
    assert s.new_price_any == 1399.00    # più basso di qualsiasi venditore


def test_captcha_detection():
    assert is_captcha('<form action="/errors/validateCaptcha">')
    assert not is_captcha(SEARCH_HTML)


def test_normalize_supabase_url():
    from scraper.config import _normalize_supabase_url as n
    assert n("https://abcdefghijklmnop.supabase.co/") == "https://abcdefghijklmnop.supabase.co"
    assert n("https://abcdefghijklmnop.supabase.co/rest/v1/") == "https://abcdefghijklmnop.supabase.co"
    assert n("abcdefghijklmnop.supabase.co") == "https://abcdefghijklmnop.supabase.co"
    assert n("https://supabase.com/dashboard/project/abcdefghijklmnop/settings/api") == "https://abcdefghijklmnop.supabase.co"
    assert n("") == ""
