"""Lettura pagine pubbliche di amazon.it: ricerca Seconda Mano + offerte per ASIN.

Le funzioni parse_* sono pure (HTML → dati) e testabili offline.
"""
from __future__ import annotations

import json
import random
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

from . import config

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
]


class CaptchaError(Exception):
    """Amazon ha chiesto il CAPTCHA: bisogna fermarsi per un po'."""


class LocationError(Exception):
    """Il CAP di consegna non si è impostato: prezzi e offerte sarebbero quelli di un'altra zona."""


# ───────────────────────────── modelli ─────────────────────────────

@dataclass
class SearchItem:
    asin: str
    title: str
    price: float | None
    image_url: str | None


@dataclass
class Offer:
    price: float
    condition: str          # testo originale, es. "Usato - Come nuovo"
    seller: str
    is_new: bool
    is_seconda_mano: bool   # venduto da Amazon Seconda Mano
    is_amazon: bool         # venduto da Amazon (nuovo)


@dataclass
class OfferSummary:
    used_price: float | None = None
    used_condition: str | None = None
    new_price: float | None = None       # nuovo venduto da Amazon
    new_price_any: float | None = None   # nuovo più basso, qualsiasi venditore
    offers: list[Offer] = field(default_factory=list)


# ───────────────────────────── parsing ─────────────────────────────

_PRICE_RE = re.compile(r"(\d{1,3}(?:[.\s ]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)")


def parse_price(text: str | None) -> float | None:
    """'1.299,99 €' / '€ 89,00' / '1299' → float."""
    if not text:
        return None
    m = _PRICE_RE.search(text.replace(" ", " "))
    if not m:
        return None
    raw = re.sub(r"[.\s ]", "", m.group(1)).replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def _price_from(node) -> float | None:
    if node is None:
        return None
    off = node.select_one(".a-price:not(.a-text-price) .a-offscreen") or node.select_one(".a-offscreen")
    if off and parse_price(off.get_text()):
        return parse_price(off.get_text())
    whole = node.select_one(".a-price-whole")
    if whole:
        frac = node.select_one(".a-price-fraction")
        txt = whole.get_text().strip().rstrip(",.") + "," + (frac.get_text().strip() if frac else "00")
        return parse_price(txt)
    return None


def is_captcha(html: str) -> bool:
    low = html[:20000].lower()
    return ("validatecaptcha" in low or "inserisci i caratteri" in low
            or "type the characters" in low or "api-services-support@amazon" in low
            # verifica anti-robot AWS WAF (HTTP 202, pagina JS "verify that you're not a robot")
            or "awswafintegration" in low or "token.awswaf.com" in low
            # verifica Akamai Bot Manager (pagina "bm-verify" che chiede un calcolo al browser)
            or "bm-verify" in low or "/_sec/verify" in low)


def _used_price_from(node) -> float | None:
    """Riga 'Ulteriori opzioni di acquisto 1.598,22 € (1 offerta prodotto usato)' (layout 2026)."""
    for row in node.select("div.a-row"):
        price = row.select_one(".a-color-base")
        if price and "opzioni di acquisto" in row.get_text(" ", strip=True).lower():
            p = parse_price(price.get_text())
            if p:
                return p
    return None


def parse_search(html: str) -> list[SearchItem]:
    soup = BeautifulSoup(html, "html.parser")
    items: list[SearchItem] = []
    for div in soup.select('div[data-component-type="s-search-result"][data-asin]'):
        asin = (div.get("data-asin") or "").strip()
        if not re.fullmatch(r"[A-Z0-9]{10}", asin):
            continue
        h2 = div.select_one("h2")
        title = (h2.get("aria-label") or h2.get_text(" ", strip=True)) if h2 else ""
        img = div.select_one("img.s-image")
        items.append(SearchItem(
            asin=asin,
            title=title.strip(),
            price=_price_from(div) or _used_price_from(div),
            image_url=img.get("src") if img else None,
        ))
    return items


def _classify(condition: str, seller: str) -> tuple[bool, bool, bool]:
    c, s = condition.lower(), seller.lower().strip()
    is_new = "nuovo" in c and "usato" not in c and "ricondizionato" not in c
    is_sm = "seconda mano" in s or "warehouse" in s
    is_amz = (not is_sm) and bool(re.fullmatch(r"amazon(\.it)?|amazon eu.*|amazon italia.*", s))
    return is_new, is_sm, is_amz


def _offer_text(node, selectors: list[str]) -> str:
    for sel in selectors:
        el = node.select_one(sel)
        if el:
            txt = " ".join(el.get_text(" ", strip=True).split())
            if txt:
                return txt
    return ""


def parse_offers(html: str) -> OfferSummary:
    """Parsa il pannello 'Tutte le offerte' (AOD) di un prodotto."""
    soup = BeautifulSoup(html, "html.parser")
    containers = soup.select("#aod-pinned-offer, #aod-offer")
    offers: list[Offer] = []
    for node in containers:
        price = _price_from(node.select_one("#aod-offer-price, .aod-offer-price") or node)
        if not price:
            continue
        condition = _offer_text(node, ["#aod-offer-heading", ".aod-offer-heading", "h5"])
        seller = _offer_text(node, [
            "#aod-offer-soldBy a", "#aod-offer-soldBy .a-col-right span",
            "#aod-offer-soldBy .a-col-right", "#aod-offer-soldBy",
        ])
        seller = re.sub(r"^(venduto da|sold by)\s*", "", seller, flags=re.I).strip()
        is_new, is_sm, is_amz = _classify(condition, seller)
        offers.append(Offer(price, condition, seller, is_new, is_sm, is_amz))
    return summarize(offers)


def summarize(offers: list[Offer]) -> OfferSummary:
    s = OfferSummary(offers=offers)
    sm = sorted((o for o in offers if o.is_seconda_mano and not o.is_new), key=lambda o: o.price)
    if sm:
        s.used_price, s.used_condition = sm[0].price, sm[0].condition
    amz_new = [o.price for o in offers if o.is_amazon and o.is_new]
    any_new = [o.price for o in offers if o.is_new]
    s.new_price = min(amz_new) if amz_new else None
    s.new_price_any = min(any_new) if any_new else None
    return s


def parse_location_modal(html: str) -> tuple[str, str] | None:
    """Popup 'Seleziona la tua posizione' di una pagina: (url del popup, token anti-CSRF)."""
    el = BeautifulSoup(html, "html.parser").select_one("#nav-global-location-data-modal-action")
    try:
        data = json.loads(el["data-a-modal"])
        return data["url"], data["ajaxHeaders"]["anti-csrftoken-a2z"]
    except (TypeError, KeyError, ValueError):
        return None


def parse_glow_csrf(html: str) -> str | None:
    """Token per salvare il CAP, dentro l'HTML del popup posizione."""
    m = re.search(r'CSRF_TOKEN\s*:\s*"([^"]+)"', html)
    return m.group(1) if m else None


def parse_product_page_price(html: str) -> float | None:
    """Fallback: prezzo principale della pagina prodotto (buybox)."""
    soup = BeautifulSoup(html, "html.parser")
    if soup.select_one("#usedBuySection") and not soup.select_one("[id^=newAccordionRow]"):
        return None  # il riquadro è solo "Acquista Usato": il prezzo mostrato non è del nuovo
    for sel in ["#corePrice_feature_div", "#corePriceDisplay_desktop_feature_div",
                "#apex_desktop", "#price_inside_buybox"]:
        p = _price_from(soup.select_one(sel))
        if p:
            return p
    return None


# ───────────────────────────── rete ─────────────────────────────

class AmazonClient:
    def __init__(self, delay: tuple[float, float] | None = None) -> None:
        p = config.profile(config.SCAN_SPEED)
        self.delay = delay or (p["delay_min_s"], p["delay_max_s"])
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "it-IT,it;q=0.9,en;q=0.6",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        })
        self.s.cookies.set("i18n-prefs", "EUR", domain=".amazon.it")
        self.s.cookies.set("lc-acbit", "it_IT", domain=".amazon.it")
        self._warm = False
        self.location_error = ""

    def _sleep(self) -> None:
        time.sleep(random.uniform(*self.delay))

    def _fetch(self, url: str, referer: str | None = None, debug_name: str | None = None) -> str:
        headers = {"Referer": referer} if referer else {}
        r = self.s.get(url, headers=headers, timeout=25)
        html = r.text
        if debug_name and config.DEBUG:
            (config.DEBUG_DIR / f"{datetime.now():%H%M%S}_{debug_name}.html").write_text(html, encoding="utf-8")
        if r.status_code == 503 or is_captcha(html):
            raise CaptchaError(f"CAPTCHA/blocco su {url} (HTTP {r.status_code})")
        r.raise_for_status()
        self._sleep()
        return html

    def set_location(self, zip_code: str) -> bool:
        """Imposta il CAP di consegna come il popup 'Seleziona la tua posizione' del sito."""
        page_url = f"{config.BASE_URL}/s?k=seconda+mano&i=warehouse-deals"
        modal = parse_location_modal(self._fetch(page_url, referer=config.BASE_URL + "/", debug_name="glow_page"))
        if not modal:
            self.location_error = "popup posizione assente nella pagina"
            return False
        url, token = modal
        headers = {"anti-csrftoken-a2z": token, "Referer": page_url, "X-Requested-With": "XMLHttpRequest"}
        r = self.s.get(url if url.startswith("http") else config.BASE_URL + url, headers=headers, timeout=20)
        if is_captcha(r.text):
            raise CaptchaError("CAPTCHA/blocco sul popup posizione")
        csrf = parse_glow_csrf(r.text)
        self._sleep()
        r = self.s.post(f"{config.BASE_URL}/portal-migration/hz/glow/address-change?actionSource=glow",
                        json={"locationType": "LOCATION_INPUT", "zipCode": zip_code, "deviceType": "web",
                              "storeContext": "generic", "pageType": "Search", "actionSource": "glow"},
                        headers={**headers, "anti-csrftoken-a2z": csrf or token}, timeout=20)
        self._sleep()
        try:
            ok = bool(r.json().get("isAddressUpdated"))
        except ValueError:
            ok = False
        if not ok:
            self.location_error = (f"salvataggio CAP rifiutato (HTTP {r.status_code}, "
                                   f"token popup {'sì' if csrf else 'no'}): {r.text[:120]}")
        return ok

    def get(self, url: str, referer: str | None = None, debug_name: str | None = None) -> str:
        if not self._warm:
            # a volte il popup arriva nella versione "accedi" senza campo CAP: si riprova
            if not any(self.set_location(config.DELIVERY_ZIP) for _ in range(3)):
                raise LocationError(f"CAP {config.DELIVERY_ZIP} non impostato ({self.location_error}), "
                                    "Amazon nasconderebbe prezzi e offerte")
            self._warm = True
        return self._fetch(url, referer, debug_name)

    def search_seconda_mano(self, keyword: str, page: int = 1) -> list[SearchItem]:
        min_cents = int(config.MIN_USED_PRICE * 100)
        url = (f"{config.BASE_URL}/s?k={quote_plus(keyword)}&i=warehouse-deals"
               f"&rh=p_36%3A{min_cents}-&page={page}")
        html = self.get(url, referer=config.BASE_URL + "/", debug_name=f"search_{keyword[:12]}_{page}")
        return parse_search(html)

    def offers(self, asin: str) -> OfferSummary:
        url = (f"{config.BASE_URL}/gp/product/ajax/aodAjaxMain/?asin={asin}"
               f"&pc=dp&experienceId=aodAjaxMain")
        html = self.get(url, referer=f"{config.BASE_URL}/dp/{asin}", debug_name=f"aod_{asin}")
        summary = parse_offers(html)
        if not summary.offers:
            # pannello offerte vuoto o cambiato: prova la pagina prodotto (pesante, solo se serve)
            page = self.get(f"{config.BASE_URL}/dp/{asin}", debug_name=f"dp_{asin}")
            summary.new_price_any = parse_product_page_price(page)
        return summary
