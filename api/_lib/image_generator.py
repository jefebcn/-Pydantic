import asyncio
import base64
import os
import google.generativeai as genai
from PIL import Image
from io import BytesIO
from .config import cfg
from .prompts import build_prompt, NEGATIVE_PROMPT

genai.configure(api_key=os.environ["GOOGLE_AI_API_KEY"])

def _bytes_to_pil(data: bytes) -> Image.Image:
    return Image.open(BytesIO(data))

def _url_to_pil(url: str) -> Image.Image:
    import requests
    r = requests.get(url, timeout=15)
    return Image.open(BytesIO(r.content))

async def _generate_one(
    slide_num: int,
    prompt: str,
    ref_images_pil: list,
    model: str = None
) -> bytes:
    """Genera una singola slide con NB2. Ritorna bytes PNG."""
    model = model or cfg.NB2_MODEL
    nb2 = genai.GenerativeModel(model)

    content = ref_images_pil + [prompt]  # reference prima del prompt

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: nb2.generate_content(
            content,
            generation_config=genai.GenerationConfig(
                response_modalities=["image", "text"]
            )
        )
    )

    for part in response.parts:
        if hasattr(part, "inline_data") and part.inline_data:
            return part.inline_data.data

    raise ValueError(f"Slide {slide_num}: nessuna immagine nella risposta NB2")

async def generate_slide_1(
    mvd: str,
    pts: dict,
    ref_image_pils: list,
    use_pro: bool = False
) -> bytes:
    """Genera slide 1 (anchor). Sequenziale, può fare retry."""
    model = cfg.NB_PRO_MODEL if use_pro else cfg.NB2_MODEL
    prompt = build_prompt(1, mvd, pts)
    return await _generate_one(1, prompt, ref_image_pils, model)

async def generate_slides_2_to_7(
    mvd: str,
    pts: dict,
    ref_image_pils: list,      # include slide 1 come ultimo elemento
) -> list[bytes]:
    """Genera slide 2–7 in parallelo con asyncio.gather."""
    tasks = [
        _generate_one(n, build_prompt(n, mvd, pts), ref_image_pils)
        for n in range(2, 8)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Gestisci eccezioni parziali (una slide fallisce, le altre continuano)
    slides = []
    for i, r in enumerate(results, 2):
        if isinstance(r, Exception):
            print(f"[WARN] Slide {i} fallita: {r}")
            slides.append(None)   # verrà rilevata da QC e retried
        else:
            slides.append(r)
    return slides
