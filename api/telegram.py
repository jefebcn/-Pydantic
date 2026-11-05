"""Prova temporanea: Vercel fa girare Python accanto al sito? Pillow, scraper e foto Amazon sono disponibili?"""
import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def check() -> dict:
    out = {"python": sys.version.split()[0]}
    try:
        import PIL
        out["pillow"] = PIL.__version__
    except Exception as e:
        out["pillow"] = repr(e)[:120]
    try:
        from scraper import config
        out["scraper"] = bool(config.ROOT.exists())
        out["avatar"] = (config.ROOT / "assets" / "bot_avatar.jpg").exists()
    except Exception as e:
        out["scraper"] = repr(e)[:200]
    try:
        import requests
        r = requests.get("https://m.media-amazon.com/images/I/71+E9IumwyL._AC_SL1000_.jpg", timeout=10)
        out["foto"] = [r.status_code, len(r.content)]
    except Exception as e:
        out["foto"] = repr(e)[:120]
    out["font"] = [str(p) for p in Path("/usr/share/fonts").rglob("*.ttf")][:3] if Path("/usr/share/fonts").exists() else []
    return out


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps(check()).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)
