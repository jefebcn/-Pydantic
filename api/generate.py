"""
POST /api/generate
Body: { "asin": "B08XYZ123" }
Returns: { "job_id": "uuid", "cached": bool }
"""
import asyncio
import base64
import json
import os
import time
import traceback
from http.server import BaseHTTPRequestHandler
from supabase import create_client

from _lib.scraper import scrape_asin, download_ref_images
from _lib.mvd_generator import generate_mvd
from _lib.image_generator import generate_slide_1, generate_slides_2_to_7
from _lib.qc_checker import qc_check
from _lib.compositor import composite_all_slides
from _lib.storage import upload_all
from _lib.config import cfg


def _supabase():
    return create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )

def _update_job(db, job_id: str, **kwargs):
    db.table("jobs").update(kwargs).eq("id", job_id).execute()


async def run_pipeline(asin: str, job_id: str):
    """Pipeline principale. Aggiorna stato job in Supabase."""
    db = _supabase()
    t0 = time.time()
    total_cost = 0.0

    try:
        # ── Step 1: Cache check ────────────────────────────────────────
        _update_job(db, job_id, status="scraping", progress=5, current_step="Verifica cache")
        cached = db.table("products").select("*").eq("asin", asin).execute()

        if cached.data:
            pts       = cached.data[0]["pts_json"]
            mvd       = cached.data[0]["mvd_text"]
            ref_urls  = cached.data[0]["ref_image_urls"]
            cache_hit = True
        else:
            # ── Step 2: Scraping ────────────────────────────────────────
            _update_job(db, job_id, status="scraping", progress=10, current_step="Scraping Amazon")
            amazon_data, ref_urls = await asyncio.gather(
                scrape_asin(asin),
                download_ref_images(asin)
            )
            cache_hit = False

            # ── Step 3: MVD Generation ──────────────────────────────────
            _update_job(db, job_id, status="mvd", progress=20, current_step="Analisi prodotto (AI)")
            images_b64 = []
            for url in ref_urls[:4]:
                import aiohttp
                async with aiohttp.ClientSession() as s:
                    async with s.get(url) as r:
                        data = await r.read()
                        images_b64.append({
                            "data": base64.b64encode(data).decode(),
                            "media_type": "image/jpeg"
                        })

            pts = await generate_mvd(images_b64, amazon_data)
            mvd = pts["canonical_paragraph"]

            # Salva in cache
            db.table("products").upsert({
                "asin": asin,
                "title": amazon_data.get("title", ""),
                "pts_json": pts,
                "mvd_text": mvd,
                "ref_image_urls": ref_urls
            }).execute()

        # ── Step 4: Carica reference images ────────────────────────────
        from PIL import Image
        from io import BytesIO
        import requests

        ref_pils = []
        for url in ref_urls[:4]:
            r = requests.get(url, timeout=15)
            ref_pils.append(Image.open(BytesIO(r.content)))

        # ── Step 5: Slide 1 anchor ──────────────────────────────────────
        _update_job(db, job_id, status="generating", progress=30, current_step="Generazione slide 1 (anchor)")
        use_pro = pts.get("is_high_value", False)
        slide1_bytes = None
        for attempt in range(cfg.MAX_RETRIES):
            slide1_bytes = await generate_slide_1(mvd, pts, ref_pils, use_pro)
            qc1 = await qc_check(slide1_bytes, anchor_bytes=None)
            if qc1["pass"] or attempt == cfg.MAX_RETRIES - 1:
                break

        # ── Step 6: Slide 2–7 parallele ────────────────────────────────
        _update_job(db, job_id, status="generating", progress=45, current_step="Generazione slide 2-7 (parallele)")
        ref_pils_full = ref_pils + [Image.open(BytesIO(slide1_bytes))]
        slides_2_7 = await generate_slides_2_to_7(mvd, pts, ref_pils_full)

        # ── Step 7: QC parallelo ───────────────────────────────────────
        _update_job(db, job_id, status="qc", progress=65, current_step="Quality check")
        qc_tasks = [qc_check(s, slide1_bytes) for s in slides_2_7 if s]
        qc_results = await asyncio.gather(*qc_tasks)

        # Retry slide fallite
        final_slides = [slide1_bytes]
        qc_all = [qc1]
        for i, (slide, qc) in enumerate(zip(slides_2_7, qc_results)):
            if qc["pass"]:
                final_slides.append(slide)
                qc_all.append(qc)
            else:
                from _lib.image_generator import _generate_one
                from _lib.prompts import build_prompt
                model = cfg.OPUS_MODEL if qc["avg"] < cfg.QC_OPUS_THRESHOLD else None
                prompt = build_prompt(i + 2, mvd, pts)
                retried = await _generate_one(i + 2, prompt, ref_pils_full, model)
                final_slides.append(retried)
                qc_retry = await qc_check(retried, slide1_bytes)
                qc_all.append(qc_retry)

        # ── Step 8: Compositing ────────────────────────────────────────
        _update_job(db, job_id, status="compositing", progress=80, current_step="Compositing testo e layout")
        composited = composite_all_slides(final_slides, pts)

        # ── Step 9: Upload R2 ──────────────────────────────────────────
        _update_job(db, job_id, status="compositing", progress=90, current_step="Upload immagini")
        urls = upload_all(composited, asin)

        # ── Step 10: Completa ──────────────────────────────────────────
        duration_ms = int((time.time() - t0) * 1000)
        avg_score = sum(q["avg"] for q in qc_all) / len(qc_all)
        _update_job(db, job_id,
            status="done", progress=100, current_step="Completato",
            slide_urls=urls,
            qc_scores={f"slide_{i+1}": q for i, q in enumerate(qc_all)},
            duration_ms=duration_ms,
            cost_usd=total_cost
        )

        # Log run
        db.table("runs").insert({
            "job_id": job_id, "asin": asin,
            "cache_hit": cache_hit,
            "duration_ms": duration_ms,
            "avg_qc_score": avg_score,
            "slide_urls": urls
        }).execute()

    except Exception as e:
        _update_job(db, job_id, status="error", error_message=str(e))
        print(traceback.format_exc())


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length))
        asin   = body.get("asin", "").strip().upper()

        if not asin or len(asin) != 10:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "ASIN non valido"}).encode())
            return

        # Crea job in Supabase
        db  = _supabase()
        res = db.table("jobs").insert({"asin": asin}).execute()
        job_id = res.data[0]["id"]

        # Lancia pipeline in background (asyncio)
        asyncio.run(run_pipeline(asin, job_id))

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"job_id": job_id, "asin": asin}).encode())
