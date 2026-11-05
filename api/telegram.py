"""Il bot Telegram su Vercel: risponde anche con il PC spento. Telegram manda qui ogni messaggio e pulsante (webhook).
Tutta la logica sta in scraper/bot.py. Si attiva con: python -m scraper.main --bot-online
"""
import hmac
import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scraper import bot, config  # noqa: E402
from scraper.store import Store  # noqa: E402

_store = None   # resta fra una richiesta e l'altra: serve alla memoria breve delle offerte


def get_store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store


class handler(BaseHTTPRequestHandler):
    def _answer(self, code: int, body: dict) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def do_GET(self):
        """Controllo prima di attivare il bot: dice solo cosa c'è, nessun valore."""
        parts = {"token": bool(config.TELEGRAM_BOT_TOKEN), "database": bool(config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY),
                 "online": config.BOT_ONLINE, "chat": bool(config.TELEGRAM_CHAT_ID), "site": bool(config.DASHBOARD_URL)}
        self._answer(200, {"ready": all(parts.values()), **parts})

    def do_POST(self):
        secret = self.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not config.TELEGRAM_BOT_TOKEN or not hmac.compare_digest(secret, bot.webhook_secret()):
            return self._answer(401, {"error": "non autorizzato"})
        update = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        try:
            bot.process_update(update, get_store())
        except Exception as e:  # con un errore Telegram riproverebbe all'infinito: si registra e si va avanti
            print(f"errore nell'aggiornamento {update.get('update_id')}: {e!r}", flush=True)
        self._answer(200, {"ok": True})
