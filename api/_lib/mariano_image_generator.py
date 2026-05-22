"""
Image generation module for Mariano-style 10-photo sets.
Takes prompts from prompts.json + reference product images → generates actual images.
Uses Gemini (primary) with prompt + reference images as multimodal input.
"""
import asyncio
import base64
import io
import os
from PIL import Image

from .config import cfg

try:
    from google import genai as google_genai
    from google.genai import types as google_genai_types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


def _gemini_client():
    if not GEMINI_AVAILABLE:
        raise RuntimeError("google-genai not installed")
    key = os.environ.get("GOOGLE_AI_API_KEY", "")
    if not key:
        raise RuntimeError("GOOGLE_AI_API_KEY not set")
    return google_genai.Client(api_key=key)


def _pil_from_bytes(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data)).convert("RGB")


async def _generate_gemini(prompt: str, ref_pils: list, slide_num: str) -> bytes:
    """Call Gemini with reference images + prompt, return PNG bytes."""
    loop = asyncio.get_event_loop()

    def _call():
        client = _gemini_client()
        contents = (ref_pils[:2] + [prompt]) if ref_pils else [prompt]
        resp = client.models.generate_content(
            model=cfg.NB2_MODEL,
            contents=contents,
            config=google_genai_types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            ),
        )
        for cand in (resp.candidates or []):
            content = getattr(cand, "content", None)
            for part in (getattr(content, "parts", None) or []):
                inline = getattr(part, "inline_data", None)
                if inline and getattr(inline, "data", None):
                    return inline.data
        raise ValueError(f"Slide {slide_num}: Gemini returned no image")

    last_err: Exception | None = None
    for attempt in range(2):
        try:
            return await loop.run_in_executor(None, _call)
        except Exception as e:
            last_err = e
            if attempt == 0:
                await asyncio.sleep(1.5)
    raise last_err  # type: ignore[misc]


async def _generate_openai(prompt: str, ref_bytes: bytes | None, slide_num: str) -> bytes:
    """Fallback: call OpenAI gpt-image-1 (text-to-image) if no reference needed."""
    if not OPENAI_AVAILABLE:
        raise RuntimeError("openai not installed")
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set")

    loop = asyncio.get_event_loop()

    def _call():
        client = openai.OpenAI(api_key=key)
        model_id = cfg.GPT_IMG_MODEL

        if ref_bytes:
            buf = io.BytesIO(ref_bytes)
            buf.name = "product.png"
            resp = client.images.edit(
                model=model_id,
                image=buf,
                prompt=prompt[:4000],
                n=1,
                size="1024x1024",
            )
        else:
            # gpt-image-1 always returns b64 — `response_format` is rejected
            resp = client.images.generate(
                model=model_id,
                prompt=prompt[:4000],
                n=1,
                size="1024x1024",
            )

        item = resp.data[0]
        b64 = getattr(item, "b64_json", None)
        if b64:
            return base64.b64decode(b64)

        url = getattr(item, "url", None)
        if url:
            import requests
            r = requests.get(url, timeout=30)
            return r.content

        raise ValueError(f"Slide {slide_num}: OpenAI returned no image data")

    return await loop.run_in_executor(None, _call)


async def generate_one(
    img_data: dict,
    ref_pils: list,
    ref_bytes_list: list[bytes],
) -> dict:
    """Generate a single image. Returns dict with number/name/image_b64/error."""
    slide_num = img_data["number"]
    prompt    = img_data["prompt"]
    name      = img_data["name"]

    # Try Gemini first, fall back to OpenAI
    try:
        img_bytes = await _generate_gemini(prompt, ref_pils, slide_num)
        return {
            "number": slide_num, "name": name,
            "image_b64": base64.b64encode(img_bytes).decode(),
            "mime": "image/png", "error": None, "model": "gemini"
        }
    except Exception as gemini_err:
        try:
            ref = ref_bytes_list[0] if ref_bytes_list else None
            img_bytes = await _generate_openai(prompt, ref, slide_num)
            return {
                "number": slide_num, "name": name,
                "image_b64": base64.b64encode(img_bytes).decode(),
                "mime": "image/png", "error": None, "model": "openai"
            }
        except Exception as oai_err:
            return {
                "number": slide_num, "name": name,
                "image_b64": None, "mime": None,
                "error": f"Gemini: {gemini_err} | OpenAI: {oai_err}",
                "model": None
            }


async def generate_all(
    prompts_json: dict,
    ref_pils: list,
    ref_bytes_list: list[bytes],
    parallel: int = 3,
) -> list[dict]:
    """
    Generate all images from prompts_json.
    Runs in batches of `parallel` to avoid rate limits.
    """
    images_data = prompts_json.get("images", [])
    results = []

    for i in range(0, len(images_data), parallel):
        batch = images_data[i:i + parallel]
        batch_results = await asyncio.gather(*[
            generate_one(img, ref_pils, ref_bytes_list)
            for img in batch
        ])
        results.extend(batch_results)

    return results
