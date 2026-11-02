"""Configurazione dello scraper. Modifica qui categorie, ritmi e soglie."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

BASE_URL = "https://www.amazon.it"

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

PAGES_PER_SEARCH = int(os.getenv("PAGES_PER_SEARCH", "2"))
MIN_USED_PRICE = float(os.getenv("MIN_USED_PRICE", "100"))
DISCOUNT_PCT = float(os.getenv("DISCOUNT_PCT", "22"))

# Ritmo: pochi e lenti = niente blocchi.
CYCLE_MINUTES = int(os.getenv("CYCLE_MINUTES", "20"))
DELAY_MIN_S = float(os.getenv("DELAY_MIN_S", "4"))
DELAY_MAX_S = float(os.getenv("DELAY_MAX_S", "9"))
# Ricontrolla le offerte di un prodotto solo se il prezzo è cambiato o dopo N ore.
RECHECK_HOURS = float(os.getenv("RECHECK_HOURS", "6"))
# Se Amazon mostra il CAPTCHA: pausa (minuti) prima di riprovare.
CAPTCHA_PAUSE_MIN = int(os.getenv("CAPTCHA_PAUSE_MIN", "30"))

# Soglie avviso (se non impostate qui vengono lette da Supabase → tabella settings)
ALERT_MARGIN_PCT = os.getenv("ALERT_MARGIN_PCT")
ALERT_PROFIT_EUR = os.getenv("ALERT_PROFIT_EUR")

# Servizi
SUPABASE_URL = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY") or ""
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "")

CACHE_FILE = ROOT / ".cache.json"
DEBUG_DIR = ROOT / "debug"
