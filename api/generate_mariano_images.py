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
import time
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))

import aiohttp
from _lib.scraper import scrape_asin
from _lib.mariano_image_generator import generate_all
from _lib.cache import log_mariano_run
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


async def _run(asin: str, prompts_json: dict, cache_hit: bool, user_id: str | None = None,
               quality: str = "quality", slide_numbers: list | None = None,
               composite: bool = False) -> dict:
    t0 = time.time()

    # Composite mode: the real product cutout is pasted client-side afterward,
    # so the model must NOT draw the product — it produces clean background
    # plates with the product area left empty.
    if composite:
        import copy
        prompts_json = copy.deepcopy(prompts_json)
        for im in prompts_json.get("images", []):
            num = str(im.get("number"))
            if num == "01a":
                im["prompt"] += (
                    "\n\nCOMPOSITE MODE — OVERRIDE: ignore any product instruction above. "
                    "Output a PURE WHITE background (RGB 255,255,255), completely EMPTY. "
                    "Do NOT draw the product or anything else. Just clean white."
                )
            else:
                im["prompt"] += (
                    "\n\nCOMPOSITE MODE — CRITICAL OVERRIDE: do NOT draw the product/bottle at all. "
                    "Render only the background, podium, glow, props and text. Leave the product "
                    "spot (the podium top, centred) COMPLETELY EMPTY/CLEAR — the real product photo "
                    "is composited there afterward. No bottle, no jar, no placeholder shape."
                )

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

    # In composite mode the product isn't drawn, so reference photos would only
    # confuse the background — skip them.
    gen_refs_pils = [] if composite else ref_pils
    gen_refs_bytes = [] if composite else ref_bytes_list

    # Generate the requested slides (parallel=5). quality "fast" forces Flash.
    images = await generate_all(
        prompts_json, gen_refs_pils, gen_refs_bytes,
        parallel=5, quality=quality, slide_numbers=slide_numbers,
    )

    duration_ms = int((time.time() - t0) * 1000)

    # Best-effort logging (silent fallback if Supabase isn't configured).
    log_mariano_run(
        asin=asin,
        images=images,
        cache_hit=cache_hit,
        duration_ms=duration_ms,
        accent_color=prompts_json.get("accent_color_hex"),
        palette_hex=prompts_json.get("palette_sfondo_hex") or [],
        categoria_effetto=prompts_json.get("categoria_effetto_01b"),
        user_id=user_id,
    )

    return {"images": images, "asin": asin, "duration_ms": duration_ms}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        asin = body.get("asin", "").strip().upper()
        prompts_json = body.get("prompts_json")
        # The client tells us if the prompts.json came from cache so we can
        # log the run accurately. Defaults to False if not provided.
        cache_hit = bool(prompts_json.get("_cache_hit", False)) if isinstance(prompts_json, dict) else False
        # Optional: the client passes the logged-in user's id so we can
        # attribute the run (and its estimated cost) to their account.
        user_id = (body.get("user_id") or "").strip() or None
        quality = "fast" if str(body.get("quality", "quality")) == "fast" else "quality"
        slide_numbers = body.get("slide_numbers") or None
        if slide_numbers is not None and not isinstance(slide_numbers, list):
            slide_numbers = None
        composite = bool(body.get("composite", False))

        if not asin or len(asin) != 10:
            self._json(400, {"error": "ASIN non valido"})
            return
        if not prompts_json or "images" not in prompts_json:
            self._json(400, {"error": "prompts_json mancante o non valido"})
            return

        try:
            result = asyncio.run(_run(asin, prompts_json, cache_hit, user_id, quality, slide_numbers, composite))
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
