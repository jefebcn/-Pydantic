import anthropic
import base64
import json
import os
from .config import cfg

QC_SYSTEM_PROMPT = """You are a QC specialist for product photography consistency.
Compare image_A (anchor: slide 1 hero) with image_B (generated slide).
Score each criterion from 0 to 100:
  shape_match:    proportions and 3D form fidelity to anchor
  color_match:    hue saturation lightness using LAB delta-E reasoning
  material_match: surface finish reflection type texture accuracy
  branding_match: logo position and relative size
  detail_match:   ports buttons seams micro-features

List any AI artifacts: extra ports, melted edges, impossible geometry,
text hallucinations, inconsistent reflections, impossible shadows.

Output JSON only:
{
  "scores": {"shape": N, "color": N, "material": N, "branding": N, "detail": N},
  "avg": N,
  "artifacts": [],
  "pass": true/false,
  "reason": "one concise line"
}"""

async def qc_check(
    slide_bytes: bytes,
    anchor_bytes: bytes | None,
    model: str = None
) -> dict:
    """
    Controlla qualità di una slide rispetto all'anchor.
    Se anchor è None (slide 1), fa solo artifact check.
    """
    model = model or cfg.HAIKU_MODEL
    import asyncio

    client = anthropic.Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        base_url="https://anthropic.helicone.ai",
        default_headers={"Helicone-Auth": f"Bearer {os.environ.get('HELICONE_API_KEY', '')}"}
    )

    content = []

    if anchor_bytes:
        content.append({"type": "image", "source": {
            "type": "base64", "media_type": "image/png",
            "data": base64.b64encode(anchor_bytes).decode()
        }})
        content.append({"type": "text", "text": "This is image_A (anchor: slide 1 hero)."})

    content.append({"type": "image", "source": {
        "type": "base64", "media_type": "image/png",
        "data": base64.b64encode(slide_bytes).decode()
    }})
    content.append({
        "type": "text",
        "text": "This is image_B (generated slide). Evaluate and output JSON."
        if anchor_bytes else
        "This is the hero anchor image. Check only for AI artifacts and output JSON "
        "(all scores 100 if no artifacts, else flag them)."
    })

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model=model,
            max_tokens=512,
            system=QC_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}]
        )
    )

    raw = response.content[0].text.strip()
    return json.loads(raw)
