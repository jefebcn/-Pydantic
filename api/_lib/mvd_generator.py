import anthropic
import base64
import json
import os
from .config import cfg

MVD_SYSTEM_PROMPT = """You are a senior product designer and PBR rendering specialist.
Analyze the provided product images and Amazon metadata.
Output a Product Technical Sheet (PTS) as strict JSON with these fields:

{
  "surfaces": [ array of surface objects ],
  "geometry": { geometric specs object },
  "canonical_paragraph": "string of 180-220 words",
  "pain_point": "one sentence: the problem this product solves",
  "target_persona_env": "one sentence: environment where target user uses this product",
  "has_text_on_surface": boolean
}

canonical_paragraph rules:
- name every visible material with PBR vocabulary (roughness, metallic, IOR values)
- describe geometry with CAD vocabulary (chamfer/fillet/curvature/bilateral_Y)
- specify color in premium terms AND approximate LAB values
- describe branding placement and proportional size
- describe surface micro-details: logos, ports, buttons, seams
- zero marketing language, zero quality adjectives
- deterministic: two readings produce the same mental image

Output JSON only. No commentary, no markdown fences."""

async def generate_mvd(images_b64: list[dict], amazon_data: dict) -> dict:
    """
    Genera PTS + MVD usando Claude Haiku 4.5 vision.
    images_b64: lista di {"data": base64_str, "media_type": "image/jpeg"}
    amazon_data: dict con title, bullets, specs da Rainforest
    """
    client = anthropic.Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        base_url="https://anthropic.helicone.ai",  # proxy Helicone
        default_headers={"Helicone-Auth": f"Bearer {os.environ.get('HELICONE_API_KEY', '')}"}
    )

    # Costruisci content: prima le immagini, poi il testo
    content = []
    for img in images_b64[:4]:  # max 4 immagini
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": img["media_type"], "data": img["data"]}
        })

    content.append({
        "type": "text",
        "text": f"Product title: {amazon_data.get('title', '')}\n"
                f"Bullets: {json.dumps(amazon_data.get('feature_bullets', []))}\n"
                f"Specs: {json.dumps(amazon_data.get('specifications', {}))}"
    })

    response = client.messages.create(
        model=cfg.HAIKU_MODEL,
        max_tokens=2048,
        system=MVD_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}]
    )

    raw = response.content[0].text.strip()
    pts = json.loads(raw)
    return pts
