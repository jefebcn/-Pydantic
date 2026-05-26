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


def _to_square_png(data: bytes, size: int = 2000) -> bytes:
    """Force the output to an exact `size`×`size` 1:1 PNG.

    Models occasionally return a non-square image. We never distort or crop
    content: if it isn't square we pad the shorter side (centered) with the
    image's corner colour — invisible on the solid/gradient backgrounds these
    plates use — then resize to size×size."""
    try:
        im = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        return data
    w, h = im.size
    if w != h:
        side = max(w, h)
        try:
            fill = im.getpixel((0, 0))
        except Exception:
            fill = (10, 10, 15)
        canvas = Image.new("RGB", (side, side), fill)
        canvas.paste(im, ((side - w) // 2, (side - h) // 2))
        im = canvas
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, format="PNG", optimize=True)
    return out.getvalue()


def _gen_config():
    """Build the generation config, natively forcing a 1:1 square output when the
    installed google-genai SDK supports it (ImageConfig.aspect_ratio). Falls back
    gracefully on older SDKs — `_to_square_png` is still the hard 1:1 guarantee."""
    kwargs = {"response_modalities": ["IMAGE", "TEXT"]}
    ic_cls = getattr(google_genai_types, "ImageConfig", None)
    if ic_cls is not None:
        try:
            return google_genai_types.GenerateContentConfig(
                image_config=ic_cls(aspect_ratio="1:1"), **kwargs
            )
        except Exception:
            pass
    return google_genai_types.GenerateContentConfig(**kwargs)


async def _generate_gemini(prompt: str, ref_pils: list, slide_num: str, model_id: str) -> bytes:
    """Call Gemini (specified model) with reference images + prompt, return PNG bytes."""
    loop = asyncio.get_event_loop()

    def _call():
        client = _gemini_client()
        # Pass up to 3 reference photos so the model keeps the SAME product
        # across every slide (more references = better product consistency).
        contents = (ref_pils[:3] + [prompt]) if ref_pils else [prompt]
        resp = client.models.generate_content(
            model=model_id,
            contents=contents,
            config=_gen_config(),
        )
        for cand in (resp.candidates or []):
            content = getattr(cand, "content", None)
            for part in (getattr(content, "parts", None) or []):
                inline = getattr(part, "inline_data", None)
                if inline and getattr(inline, "data", None):
                    return inline.data
        raise ValueError(f"Slide {slide_num}: {model_id} returned no image")

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


# Slides with significant in-image text need the Pro model (better text fidelity).
# Slides without text (01a, 01b hero shots, 07 lifestyle editorial) can use the faster
# / cheaper Flash model directly — saves ~25% on Gemini cost per run.
_TEXT_HEAVY_SLIDES = {"02", "03", "04", "05", "06", "08", "09"}


def _is_text_heavy(slide_num: str) -> bool:
    return str(slide_num).strip().lower() in _TEXT_HEAVY_SLIDES


async def generate_one(
    img_data: dict,
    ref_pils: list,
    ref_bytes_list: list[bytes],
    quality: str = "quality",
) -> dict:
    """Generate a single image. Returns dict with number/name/image_b64/error.

    quality:
      - "quality" (default): text-heavy slides use Pro first (best text), others
        Flash first. Best fidelity, higher cost.
      - "fast": every slide uses Flash first (Pro only as fallback). ~Half the
        cost; text rendering slightly weaker.
    """
    slide_num = img_data["number"]
    prompt    = img_data["prompt"]
    name      = img_data["name"]

    # Cascade strategy depends on quality mode + text-density of the slide.
    errors: list[str] = []
    if quality == "fast":
        cascade = [
            ("gemini-flash", cfg.NB_FALLBACK_MODEL),  # cheap first, everywhere
            ("gemini-pro",   cfg.NB2_MODEL),
        ]
    elif _is_text_heavy(slide_num):
        cascade = [
            ("gemini-pro",   cfg.NB2_MODEL),          # default: gemini-3-pro-image-preview
            ("gemini-flash", cfg.NB_FALLBACK_MODEL),  # default: gemini-2.5-flash-image
        ]
    else:
        cascade = [
            ("gemini-flash", cfg.NB_FALLBACK_MODEL),  # default: gemini-2.5-flash-image
            ("gemini-pro",   cfg.NB2_MODEL),          # default: gemini-3-pro-image-preview
        ]
    # Avoid duplicate calls if user override made Pro == Flash
    seen: set[str] = set()
    for label, model_id in cascade:
        if model_id in seen:
            continue
        seen.add(model_id)
        try:
            img_bytes = await _generate_gemini(prompt, ref_pils, slide_num, model_id)
            return {
                "number": slide_num, "name": name,
                "image_b64": base64.b64encode(_to_square_png(img_bytes)).decode(),
                "mime": "image/png", "error": None, "model": label,
            }
        except Exception as e:
            errors.append(f"{label} ({model_id}): {e}")

    # Final fallback: OpenAI
    try:
        ref = ref_bytes_list[0] if ref_bytes_list else None
        img_bytes = await _generate_openai(prompt, ref, slide_num)
        return {
            "number": slide_num, "name": name,
            "image_b64": base64.b64encode(_to_square_png(img_bytes)).decode(),
            "mime": "image/png", "error": None, "model": "openai",
        }
    except Exception as oai_err:
        errors.append(f"openai: {oai_err}")
        return {
            "number": slide_num, "name": name,
            "image_b64": None, "mime": None,
            "error": " | ".join(errors),
            "model": None,
        }


async def generate_all(
    prompts_json: dict,
    ref_pils: list,
    ref_bytes_list: list[bytes],
    parallel: int = 3,
    quality: str = "quality",
    slide_numbers: list[str] | None = None,
) -> list[dict]:
    """
    Generate images from prompts_json.
    - `slide_numbers`: if given, only these slide numbers are generated.
    - `quality`: "quality" (Pro on text slides) or "fast" (all Flash).
    Runs in batches of `parallel` to avoid rate limits.

    Product-consistency anchor: if the white-background hero (01a) is among the
    slides to generate, it is produced FIRST and then fed as an extra reference
    image to the other slides — so every slide anchors to the same freshly
    generated product "portrait", keeping the product identical across the set.
    No extra cost: 01a is a slide we were generating anyway.
    """
    images_data = prompts_json.get("images", [])
    if slide_numbers:
        wanted = {str(n) for n in slide_numbers}
        images_data = [im for im in images_data if str(im.get("number")) in wanted]

    results: list[dict] = []
    extra_refs: list = []
    rest = images_data

    anchor_idx = next((i for i, im in enumerate(images_data) if str(im.get("number")) == "01a"), -1)
    if anchor_idx != -1:
        main_res = await generate_one(images_data[anchor_idx], ref_pils, ref_bytes_list, quality)
        results.append(main_res)
        if main_res.get("image_b64"):
            try:
                extra_refs = [_pil_from_bytes(base64.b64decode(main_res["image_b64"]))]
            except Exception:
                extra_refs = []
        rest = [im for j, im in enumerate(images_data) if j != anchor_idx]

    # The freshly generated MAIN goes FIRST in the reference list so the model
    # leans on it for product identity (background still comes from each prompt).
    aug_refs = (extra_refs + ref_pils) if extra_refs else ref_pils

    for i in range(0, len(rest), parallel):
        batch = rest[i:i + parallel]
        batch_results = await asyncio.gather(*[
            generate_one(img, aug_refs, ref_bytes_list, quality)
            for img in batch
        ])
        results.extend(batch_results)

    return results
