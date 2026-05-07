"""
POST /api/generate-mariano-images
Body: { "asin": "B08XYZ123", "prompts_json": { ...the full prompts.json dict... } }
Returns: { "images": [ { number, name, image_b64, mime, model, error } ] }
"""
import asyncio
import base64
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))

import aiohttp
from _lib.scraper import scrape_asin
from _lib.mariano_image_generator import generate_all
from PIL import Image
import io


async def _download_bytes(url: str, session: aiohttp.ClientSession) -> bytes | None:
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as r:
            if r.status == 200:
                return await r.read()
    except Exception:
        pass
    return None


async def _run(asin: str, prompts_json: dict) -> dict:
    # Download up to 3 reference images from Amazon
    amazon_data = await scrape_asin(asin)
    image_urls = amazon_data.get("images", [])[:3]

    ref_bytes_list = []
    ref_pils = []
    async with aiohttp.ClientSession() as session:
        tasks = [_download_bytes(url, session) for url in image_urls]
        results = await asyncio.gather(*tasks)

    for data in results:
        if data:
            ref_bytes_list.append(data)
            try:
                pil = Image.open(io.BytesIO(data)).convert("RGB")
                ref_pils.append(pil)
            except Exception:
                pass

    # Generate all 10 images
    images = await generate_all(prompts_json, ref_pils, ref_bytes_list, parallel=3)
    return {"images": images, "asin": asin}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        asin = body.get("asin", "").strip().upper()
        prompts_json = body.get("prompts_json")

        if not asin or len(asin) != 10:
            self._json(400, {"error": "ASIN non valido"})
            return
        if not prompts_json or "images" not in prompts_json:
            self._json(400, {"error": "prompts_json mancante o non valido"})
            return

        try:
            result = asyncio.run(_run(asin, prompts_json))
            self._json(200, result)
        except Exception as e:
            self._json(500, {"error": str(e)})

    def _json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
