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
from _lib.mariano_prompts_generator import generate_mariano_prompts

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


async def _run(asin: str) -> dict:
    # 1. Scrape Amazon
    amazon_data = await scrape_asin(asin)

    # 2. Download reference images (up to 4)
    image_urls = amazon_data.get("images", [])[:4]
    async with aiohttp.ClientSession() as session:
        tasks = [_download_image_b64(url, session) for url in image_urls]
        results = await asyncio.gather(*tasks)

    images_b64 = [r for r in results if r is not None]

    # 3. Generate Mariano-style prompts.json
    prompts_json = await generate_mariano_prompts(amazon_data, images_b64)
    return prompts_json


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        asin = body.get("asin", "").strip().upper()

        if not asin or len(asin) != 10:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "ASIN non valido (deve essere 10 caratteri)"}).encode())
            return

        try:
            result = asyncio.run(_run(asin))
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
