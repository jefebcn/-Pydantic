"""
POST /api/regenerate-slide
Body: { "asin", "prompts_json", "slide_number", "user_id"? }
Regenerates a SINGLE slide image and returns it.
Returns: { "image": { number, name, image_b64, mime, model, error } }
"""
import asyncio
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))

import aiohttp
from _lib.scraper import scrape_asin
from _lib.mariano_image_generator import generate_one
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


async def _run(asin: str, prompts_json: dict, slide_number: str, composite: bool = False) -> dict:
    img_data = next(
        (im for im in prompts_json.get("images", []) if im.get("number") == slide_number),
        None,
    )
    if not img_data:
        raise ValueError(f"slide_number {slide_number} non trovato nel prompts_json")

    if composite:
        img_data = dict(img_data)
        if str(slide_number) == "01a":
            img_data["prompt"] += (
                "\n\nCOMPOSITE MODE — OVERRIDE: ignore any product instruction above. "
                "Output a PURE WHITE background (RGB 255,255,255), completely EMPTY. No product."
            )
        else:
            img_data["prompt"] += (
                "\n\nCOMPOSITE MODE — CRITICAL OVERRIDE: do NOT draw the product/bottle. "
                "Render only background, podium, glow, props and text; leave the product spot "
                "(podium top, centred) COMPLETELY EMPTY for compositing."
            )

    amazon_data = await scrape_asin(asin)
    image_urls = amazon_data.get("images", [])[:3]

    ref_bytes_list: list[bytes] = []
    ref_pils: list = []
    if not composite:
        async with aiohttp.ClientSession() as session:
            results = await asyncio.gather(*[_download_bytes(u, session) for u in image_urls])
        for data in results:
            if data:
                ref_bytes_list.append(data)
                try:
                    ref_pils.append(Image.open(io.BytesIO(data)).convert("RGB"))
                except Exception:
                    pass

    result = await generate_one(img_data, ref_pils, ref_bytes_list)
    return {"image": result}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        asin = body.get("asin", "").strip().upper()
        prompts_json = body.get("prompts_json")
        slide_number = str(body.get("slide_number", "")).strip()
        composite = bool(body.get("composite", False))

        if not asin or len(asin) != 10:
            self._json(400, {"error": "ASIN non valido"})
            return
        if not prompts_json or "images" not in prompts_json:
            self._json(400, {"error": "prompts_json mancante o non valido"})
            return
        if not slide_number:
            self._json(400, {"error": "slide_number mancante"})
            return

        try:
            result = asyncio.run(_run(asin, prompts_json, slide_number, composite))
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
