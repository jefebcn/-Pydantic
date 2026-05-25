"""
POST /api/generate-mariano
Body: { "asin": "B08XYZ123" }
Returns: complete prompts.json in Mariano style
"""
import asyncio
import base64
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

# Add parent dir for local imports
sys.path.insert(0, os.path.dirname(__file__))

from _lib.scraper import scrape_asin
from _lib.mariano_prompts_generator import generate_mariano_prompts, restyle
from _lib.cache import get_mariano as cache_get, set_mariano as cache_set

import aiohttp


async def _download_image_b64(url: str, session: aiohttp.ClientSession) -> dict | None:
    """Download image URL and return base64-encoded dict."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as r:
            if r.status != 200:
                return None
            data = await r.read()
            ct = r.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
            if ct not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
                ct = "image/jpeg"
            return {"data": base64.b64encode(data).decode(), "media_type": ct}
    except Exception:
        return None


async def _run(asin: str, force_refresh: bool = False, style: str = "bold", account: str = "generale") -> dict:
    # 0. Cache hit? (skips Rainforest + Claude entirely → saves ~$0.028).
    #    Only reuse the cache if it was built for the SAME account (Generale vs
    #    Prestige produce different sets). Style is re-applied cheaply on top.
    if not force_refresh:
        cached = cache_get(asin)
        if cached and cached.get("account", "generale") == account:
            cached = restyle(cached, style)
            cached["_cache_hit"] = True
            return cached

    # 1. Scrape Amazon
    amazon_data = await scrape_asin(asin)

    # 2. Download reference images (up to 4)
    image_urls = amazon_data.get("images", [])[:4]
    async with aiohttp.ClientSession() as session:
        tasks = [_download_image_b64(url, session) for url in image_urls]
        results = await asyncio.gather(*tasks)

    images_b64 = [r for r in results if r is not None]

    # 3. Generate the prompts.json for the chosen account preset
    prompts_json = await generate_mariano_prompts(amazon_data, images_b64, style, account)

    # 4. Persist to cache (best-effort, no-op if Supabase not configured)
    cache_set(asin, prompts_json)
    prompts_json["_cache_hit"] = False
    return prompts_json


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        asin = body.get("asin", "").strip().upper()
        force_refresh = bool(body.get("force_refresh", False))
        style = str(body.get("style", "bold")).strip() or "bold"
        account = str(body.get("account", "generale")).strip() or "generale"

        if not asin or len(asin) != 10:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "ASIN non valido (deve essere 10 caratteri)"}).encode())
            return

        try:
            result = asyncio.run(_run(asin, force_refresh=force_refresh, style=style, account=account))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
