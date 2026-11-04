"""Configurazione dello scraper. Modifica qui categorie, ritmi e soglie."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

BASE_URL = "https://www.amazon.it"
# CAP di consegna italiano: senza, da un IP non italiano (es. San Marino) Amazon nasconde prezzi e offerte.
DELIVERY_ZIP = os.getenv("DELIVERY_ZIP", "20121")

# Ricerche dentro Amazon Seconda Mano (search index "warehouse-deals").
# Ogni voce = (etichetta categoria, parola chiave). Aggiungi/togli liberamente.
SEARCHES: list[tuple[str, str]] = [
    ("Informatica", "notebook"),
    ("Informatica", "macbook"),
    ("Informatica", "monitor"),
    ("Informatica", "tablet"),
    ("Informatica", "ipad"),
    ("Informatica", "scheda video"),
    ("Informatica", "ssd"),
    ("Informatica", "processore"),
    ("Informatica", "stampante"),
    ("Informatica", "router wifi"),
    ("Informatica", "mini pc"),
    ("Smartphone", "smartphone"),
    ("Smartphone", "iphone"),
    ("Smartwatch", "smartwatch"),
    ("Gaming", "playstation"),
    ("Gaming", "nintendo switch"),
    ("Gaming", "xbox"),
    ("Gaming", "monitor gaming"),
    ("Gaming", "notebook gaming"),
    ("Gaming", "sedia gaming"),
    ("Audio", "cuffie"),
    ("Audio", "soundbar"),
    ("Audio", "airpods"),
    ("Foto", "fotocamera"),
    ("Foto", "obiettivo"),
    ("Foto", "drone"),
    ("TV", "smart tv"),
    ("Casa", "robot aspirapolvere"),
    ("Casa", "aspirapolvere senza fili"),
    ("Casa", "macchina caffè"),
    ("Casa", "friggitrice ad aria"),
]

MIN_USED_PRICE = float(os.getenv("MIN_USED_PRICE", "100"))
DISCOUNT_PCT = float(os.getenv("DISCOUNT_PCT", "22"))

# Ritmo: pochi e lenti = niente blocchi. SCAN_SPEED sceglie il profilo massimo (lento | normale | veloce).
# Se Amazon chiede la verifica anti-robot lo scanner scende da solo al profilo più lento e
# risale di un gradino dopo STEP_UP_AFTER_CYCLES cicli puliti, mai sopra SCAN_SPEED.
# "searches_per_cycle": quante ricerche di SEARCHES per ciclo, a rotazione (0 = tutte).
SPEED_PROFILES: dict[str, dict] = {
    "lento":   {"cycle_minutes": 60, "searches_per_cycle": 8, "pages_per_search": 1,
                "delay_min_s": 10.0, "delay_max_s": 25.0, "max_offer_fetches": 15},
    "normale": {"cycle_minutes": 30, "searches_per_cycle": 16, "pages_per_search": 1,
                "delay_min_s": 6.0, "delay_max_s": 14.0, "max_offer_fetches": 40},
    "veloce":  {"cycle_minutes": 20, "searches_per_cycle": 0, "pages_per_search": 2,
                "delay_min_s": 4.0, "delay_max_s": 9.0, "max_offer_fetches": 150},
}
SPEED_ORDER = ["lento", "normale", "veloce"]
SCAN_SPEED = os.getenv("SCAN_SPEED", "lento").strip().lower()
if SCAN_SPEED not in SPEED_PROFILES:
    raise SystemExit(f"SCAN_SPEED={SCAN_SPEED!r} non valido: usa lento, normale o veloce")
STEP_UP_AFTER_CYCLES = int(os.getenv("STEP_UP_AFTER_CYCLES", "6"))


def profile(name: str) -> dict:
    """Profilo di velocità; le variabili d'ambiente omonime in maiuscolo (es. CYCLE_MINUTES) lo sovrascrivono."""
    p = dict(SPEED_PROFILES[name])
    for key, val in p.items():
        env = os.getenv(key.upper())
        if env:
            p[key] = type(val)(float(env))
    return p


# Ricontrolla le offerte di un prodotto solo se il prezzo è cambiato o dopo N ore.
RECHECK_HOURS = float(os.getenv("RECHECK_HOURS", "6"))
# Se Amazon mostra il CAPTCHA o la verifica anti-robot: pausa (minuti) che raddoppia a ogni
# blocco consecutivo fino a CAPTCHA_PAUSE_MAX_MIN.
CAPTCHA_PAUSE_MIN = int(os.getenv("CAPTCHA_PAUSE_MIN", "30"))
CAPTCHA_PAUSE_MAX_MIN = int(os.getenv("CAPTCHA_PAUSE_MAX_MIN", "360"))

# Soglie avviso (se non impostate qui vengono lette da Supabase → tabella settings)
ALERT_MARGIN_PCT = os.getenv("ALERT_MARGIN_PCT")
ALERT_PROFIT_EUR = os.getenv("ALERT_PROFIT_EUR")

# Servizi
def _normalize_supabase_url(raw: str) -> str:
    """https://<ref>.supabase.co anche se incollato con /rest/v1/ o come link della dashboard."""
    import re
    from urllib.parse import urlparse
    s = raw.strip().strip("'\"")
    m = re.search(r"supabase\.com/dashboard/project/([a-z0-9]{10,})", s, re.I)
    if m:
        return f"https://{m.group(1)}.supabase.co"
    if s and not re.match(r"https?://", s, re.I):
        s = "https://" + s
    u = urlparse(s)
    return f"{u.scheme}://{u.netloc}" if u.netloc else s.rstrip("/")


SUPABASE_URL = _normalize_supabase_url(os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "")
SUPABASE_SERVICE_ROLE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY") or "").strip()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_CHANNEL_ID = os.getenv("TELEGRAM_CHANNEL_ID", "").strip()  # canale pubblico: solo offerte con prezzo verificato
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "SecondHandHunter_Bot")
TELEGRAM_CHANNEL_URL = os.getenv("TELEGRAM_CHANNEL_URL", "https://t.me/secondhandhunters")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "")

CACHE_FILE = ROOT / ".cache.json"
STATE_FILE = ROOT / ".state.json"   # ritmo attuale, blocchi, posizione nella rotazione delle ricerche
PUBLISHED_FILE = ROOT / ".published.json"  # cosa è già uscito nel canale: {asin: {"price", "ts"}}
SUBSCRIBERS_FILE = ROOT / ".subscribers.json"  # chi usa il bot: avvisi su misura e prodotti seguiti
LOG_FILE = ROOT / "scanner.log"    # ultimi log dello scanner (ruota a 1 MB), per capire perché si è fermato
DEBUG_DIR = ROOT / "debug"
DEBUG = False   # True con --debug: salva in DEBUG_DIR l'HTML di ogni pagina scaricata
