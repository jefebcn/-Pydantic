"""
Generates a complete prompts.json in "Mariano style" (10 PHOTO EDITING images)
for any ASIN product.

Usage:
    pts = await generate_mariano_prompts(amazon_data, images_b64)
    # pts is the complete prompts.json dict
"""

import anthropic
import json
import os
import re
from .config import cfg


def _parse_claude_json(raw: str) -> dict:
    """Robust JSON extraction from Claude responses.

    Handles three common shapes:
      - bare JSON object
      - fenced ```json ... ``` (or plain ``` ... ```)
      - JSON object surrounded by prose
    Raises ValueError with the raw payload on failure so the caller can log it.
    """
    s = raw.strip()

    # 1. Strip markdown fences if present (any language tag)
    if s.startswith("```"):
        # remove first fence line
        s = s.split("\n", 1)[1] if "\n" in s else s[3:]
        # remove trailing fence
        if "```" in s:
            s = s.rsplit("```", 1)[0]
        s = s.strip()

    # 2. Try direct parse
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass

    # 3. Extract first balanced {...} block via regex
    match = re.search(r"\{.*\}", s, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from Claude response. Raw:\n{raw[:2000]}")

# ── Effect library for 01b based on product category ──────────────────────────
EFFECT_LIBRARY = {
    "sonic burst": (
        "SONIC BURST: explosive concentric audio wave arcs radiating from the center "
        "of the canvas. Arc lines in {accent} and cyan-white (#7DF9FF), varying thickness "
        "2px-6px, fading from 90% opacity near origin to 5% at edges. 5-7 main arcs at "
        "irregular radii (120px, 240px, 380px, 500px, 640px, 780px, 900px). Between arcs: "
        "scattered tiny dots/particles ({accent}, 1-3px, 20-60% opacity). Prismatic light "
        "streaks: 3-4 thin diagonal rays (#FFFFFF, 1px, 15% opacity) crossing behind product. "
        "Category ghost watermark: faint headphone/speaker icon ({accent}, 4% opacity, 300px) "
        "behind product body. Corner lens flares ({accent}, 8% opacity, 60px radius)."
    ),
    "energy burst neutro": (
        "ENERGY BURST: explosive radial rays of {accent} and electric white #FFFFFF exploding "
        "outward from center, like a star burst. Ray intensity 80% at core, fading to 0% at "
        "canvas edges. Over this: floating geometric micro-particles (tiny hexagons, dots) in "
        "{accent} at 25% opacity scattered organically. Subtle outer ring glow of {accent} at "
        "15% opacity at 800px radius from center. All strictly BEHIND the product."
    ),
    "radar scan": (
        "RADAR SCAN: 6-8 expanding circular arcs in electric blue {accent} at 15-40% opacity, "
        "centered behind the product. Arc line width 1-2px. Fine orthogonal grid lines {accent} "
        "at 6% opacity across full background. A single bright radar sweep wedge ({accent}, "
        "30-degree angle, 60% opacity) emanating from behind product center. Scattered data "
        "particles ({accent}, #FFFFFF, 2-6px, 40-80% opacity). Faint GSM signal wave arcs "
        "behind and beside the product. All effects hard-masked at the product silhouette edge."
    ),
    "crystal bloom": (
        "CRYSTAL BLOOM: soft radial burst of crystal/ice shard shapes in light {accent} and "
        "pearl white (#F8F0FF), exploding outward behind the product. Each crystal: thin "
        "elongated diamond, 20-120px long, subtle inner glow, 30-70% opacity. Between crystals: "
        "fine sparkle dots (#FFFFFF, 2px, 80% opacity) like dust particles. Dreamy bokeh circles "
        "({accent}, 20-60px, 10-25% opacity) floating across background. Iridescent gradient "
        "shimmer behind product: pastel {accent} to soft pink (#FFD0E8), radial, center bright."
    ),
    "kinetic burst": (
        "KINETIC BURST: dynamic motion lines radiating from center in {accent} and warm white, "
        "suggesting speed and energy. Lines are thin (1-2px), varying lengths (50-400px), "
        "fading from solid at center to transparent at edges. Over this: scattered small "
        "triangular energy particles in {accent} at 25-60% opacity. A circular vortex "
        "pattern in faint {accent} (3% opacity) covers the full background, suggesting "
        "rotation. Bold chromatic aberration strips (thin colored lines) add kinetic feel."
    ),
    "tech grid": (
        "TECH GRID: precise orthogonal grid of thin lines ({accent}, 1px, 5% opacity) with "
        "perspective depth converging at the product center. Glowing node points at grid "
        "intersections ({accent}, 4-6px, 40% opacity near product, fading to 5% at edges). "
        "Circuit trace patterns meandering between nodes. Data stream particles flowing along "
        "grid lines. Holographic scan line overlay (thin horizontal bands, 2% opacity) adds "
        "high-tech display aesthetic. All strictly behind the product silhouette."
    ),
    "laser focus": (
        "LASER FOCUS: single intense laser beam line originating from product, crossing the "
        "background diagonally. Beam: {accent}, 3px core with 20px soft bloom glow. Around "
        "beam: scattered prismatic light refraction triangles ({accent} + complementary color). "
        "Precision cross-hair reticle faintly visible behind product ({accent}, 3% opacity, "
        "800px diameter). Fine specular dots scattered across background. Clean, surgical aesthetic."
    ),
    "nebula glow": (
        "NEBULA GLOW: deep space nebula effect with soft organic clouds of {accent} and "
        "purple-violet (#9B59B6), spreading from behind the product. Clouds have soft feathered "
        "edges, 30-60% opacity. Embedded in clouds: tiny star dots (#FFFFFF, 1px, 80% opacity) "
        "creating a night sky feel. Distant galaxy smear ({accent} at 5% opacity) crossing the "
        "background diagonally. Warm-cool color temperature split: {accent} on left, cool blue "
        "on right. Strictly behind the product — hard mask at silhouette."
    ),
    "circuit pulse": (
        "CIRCUIT PULSE: animated-look circuit board traces in {accent} (1px, 15% opacity) "
        "covering the background with a realistic PCB pattern. Data flow visualization: "
        "bright pulse dots moving along circuit traces ({accent}, 6px, 90% opacity). "
        "Glowing component nodes at circuit junctions. Binary data rain (0s and 1s, {accent}, "
        "6px font, 3% opacity) falling vertically in background. Holographic blue scan overlay "
        "at 4% opacity. Hard mask at product edge."
    ),
    "prism split": (
        "PRISM SPLIT: white light entering product area and refracting into a full visible "
        "spectrum rainbow fan ({accent} dominant). Refracted rays are thin (1-2px), spread "
        "90° fan angle. Between rays: prismatic interference patterns (thin iridescent bands). "
        "Glass-lens flare element behind product: circular rainbow ring (600px, 15% opacity). "
        "Bokeh chromatic circles ({accent}, soft, 20-80px, 8-20% opacity) scattered across "
        "background. Clean, optical precision aesthetic."
    ),
    "warm halo": (
        "WARM HALO: soft circular radial gradient halo of warm {accent} tones behind the "
        "product, fading from 60% opacity at center to 0% at canvas edges. NO tech grids, NO "
        "circuit lines, NO digital particles. Subtle organic bokeh circles in warm amber and "
        "{accent} (40-120px, 8-18% opacity) scattered naturally across background. Hint of warm "
        "ambient light leak from upper corners (cream/honey tone, 20% opacity). Atmosphere is "
        "domestic, refined, lifestyle-premium — like a magazine product shot in a real home."
    ),
    "natural bokeh": (
        "NATURAL BOKEH: soft defocused indoor/outdoor environment behind product — large creamy "
        "bokeh circles in warm neutrals and {accent} (60-180px, 15-30% opacity), suggesting a "
        "real space (room, kitchen, garden) without identifying it. NO tech elements, NO grid "
        "lines, NO digital effects. Warm natural daylight ambience, slight haze. Background "
        "color: muted neutral with subtle {accent} tint. Editorial lifestyle photography feel."
    ),
    "metallic shine": (
        "METALLIC SHINE: refined backdrop with subtle metallic gradient sweep in {accent} and "
        "warm gold/bronze tones. Soft directional specular highlights crossing diagonally (15% "
        "opacity). NO grids, NO digital particles. Polished surface reflection hint at the "
        "bottom (vertical mirror gradient, 20% opacity). Subtle brushed-metal texture overlay "
        "(3% opacity). Premium hardware/luxury aesthetic — like a product shot for a high-end "
        "furniture or fixtures catalog."
    ),
    "minimal studio": (
        "MINIMAL STUDIO: clean seamless studio background, gentle radial vignette toward {accent} "
        "at corners (5-10% opacity). Single soft drop shadow under product (60% opacity, blurred "
        "30px). NO patterns, NO grids, NO particles, NO digital effects of any kind. Background "
        "color: solid warm neutral (#F5F0EA to #E8E0D6 gradient) with a barely-visible {accent} "
        "tint. Mariano-style minimal premium product photography — empty, refined, focus on "
        "product geometry."
    ),
}

# ── Analysis system prompt ─────────────────────────────────────────────────────
ANALYSIS_SYSTEM_PROMPT = """You are an expert Italian product photographer and Amazon listing specialist.
Analyze the provided product images and Amazon product data.
Your task is to extract everything needed to create a professional 10-image Amazon photo set.

CRITICAL RULES — read before producing JSON:
1. Identify the REAL product category from images + title. Do not infer "tech" from the brand
   name alone. A brass door handle is "home/hardware", NOT smart-home.
2. The visual effect (`categoria_effetto_01b`) MUST match the product category — pick from the
   strict mapping table below. Wrong category = wrong infographic.
3. All Italian text fields will be RENDERED LITERALLY by an image model. Keep them short,
   unambiguous, and free of accented characters that the model may garble (avoid à/è/ì/ò/ù
   when a clean alternative exists: prefer "perche" over "perché", "piu" over "più", etc.).
4. ALL CAPS fields must be UPPER-CASE only — no mixed case.
5. Hex colors must be exactly 7 chars: #RRGGBB.

Output JSON only. No markdown fences. No commentary. All text in Italian except hex codes, icon descriptions, and spec values.

STRICT CATEGORY → EFFECT MAPPING (use exactly the right-hand string in `categoria_effetto_01b`):
  audio (cuffie, speaker, microfoni)              → "sonic burst"
  electronics (gadget, caricabatterie, hub USB)   → "energy burst neutro"
  security (allarmi, telecamere, GPS, lucchetti smart) → "radar scan"
  beauty / skincare / cosmesi                     → "crystal bloom"
  fitness / sport / outdoor attivo                → "kinetic burst"
  smart-home (IoT, app-connected, voice assistant) → "tech grid"
  precision tools (utensili, misuratori, laser)   → "laser focus"
  ambient / lighting (lampade, LED, candele)      → "nebula glow"
  networking (router, switch, NAS)                → "circuit pulse"
  optics / cameras / binoculars                   → "prism split"
  home / hardware / ferramenta / arredo / maniglie / serrature passive / pomelli → "metallic shine"
  furniture / accessori casa / decor / kitchen non-elettrico → "warm halo"
  clothing / textile / lifestyle / outdoor passivo → "natural bokeh"
  food / beverage / kitchen consumables           → "warm halo"
  unknown / other                                 → "minimal studio"

If unsure between two, pick the LESS tech-looking option. "minimal studio" is always safe.

Required JSON structure:
{
  "product_name_full": "full product name with model number",
  "product_visual_description": "detailed Italian visual description (120+ words): materials, colors (with LAB/hex), geometry, proportions, surface finishes, visible components. Zero marketing language.",
  "product_category": "audio | electronics | tech | home | hardware | furniture | fitness | beauty | food | security | clothing | accessories | lighting | optics | networking | other",
  "categoria_effetto_01b": "one of: sonic burst | energy burst neutro | radar scan | crystal bloom | kinetic burst | tech grid | laser focus | nebula glow | circuit pulse | prism split | warm halo | natural bokeh | metallic shine | minimal studio (follow the strict mapping above)",
  "accent_color_hex": "#XXXXXX",
  "palette_sfondo_hex": ["#050505–#1A1A2E range dark1", "dark2", "dark3"],
  "benefit_headline": "MAIN SELLING HEADLINE — ALL CAPS Italian, max 4 words",
  "benefit_subheading": "Italian subheading for benefit slide, max 6 words",
  "benefits_5": ["benefit 1 Italian max 6 words", "benefit 2", "benefit 3", "benefit 4", "benefit 5"],
  "benefit_pill": "Italian pill badge text, 2-3 features with · separators, max 8 words",
  "specs_group_1_title": "Italian subtitle (e.g. 'Connettività · Audio · Batteria')",
  "specs_group_1_headline": "Italian main title for spec slide 1 (ALL CAPS, max 3 words, e.g. 'SPECIFICHE TECNICHE')",
  "specs_group_1_bottom": "Italian sentence for bottom of spec slide 1",
  "specs_group_1": [
    {"label": "LABEL ALL CAPS", "value": "value"},
    {"label": "...", "value": "..."},
    {"label": "...", "value": "..."},
    {"label": "...", "value": "..."},
    {"label": "...", "value": "..."},
    {"label": "...", "value": "..."}
  ],
  "specs_group_2_title": "Italian title for spec slide 2 (ALL CAPS, max 4 words)",
  "specs_group_2_subheading": "Italian subheading for spec slide 2",
  "specs_group_2_top_cards": [
    {"icon": "clock", "label": "LABEL", "value": "VALUE", "subtext": "Italian subtext"},
    {"icon": "lightning", "label": "LABEL", "value": "VALUE", "subtext": "Italian subtext"}
  ],
  "specs_group_2_bottom_cards": [
    {"icon": "drop", "label": "LABEL Italian ALL CAPS", "subtext": "Italian"},
    {"icon": "feather", "label": "LABEL Italian ALL CAPS", "subtext": "Italian"},
    {"icon": "gear", "label": "LABEL Italian ALL CAPS", "subtext": "Italian"}
  ],
  "specs_group_2_strip": "Italian strip text, key specs with · separators, max 10 words",
  "usage_title": "Italian title ALL CAPS for usage slide",
  "usage_steps": [
    {"step_num": 1, "verb": "VERB", "title": "TITLE ALL CAPS", "subtext": "Italian instruction, max 10 words", "icon": "icon type"},
    {"step_num": 2, "verb": "VERB", "title": "TITLE", "subtext": "...", "icon": "..."},
    {"step_num": 3, "verb": "VERB", "title": "TITLE", "subtext": "...", "icon": "..."}
  ],
  "usage_bottom_strip": "Italian bottom strip for usage slide, tech specs, max 10 words",
  "anatomy_title": "Italian ALL CAPS title for anatomy slide",
  "anatomy_parts": [
    {"label": "Italian part name", "location": "top/bottom/left/right/center hint"},
    {"label": "...", "location": "..."},
    {"label": "...", "location": "..."},
    {"label": "...", "location": "..."},
    {"label": "...", "location": "..."},
    {"label": "...", "location": "..."}
  ],
  "anatomy_bottom": "Italian caption for anatomy slide bottom strip",
  "lifestyle_scene": "4-6 sentences Italian: person description (age/gender/style/expression), setting/environment, what they do with product, lighting mood, bokeh background, editorial feel",
  "usage_scenarios_title": "Italian ALL CAPS headline for dove-usarlo slide",
  "usage_scenarios_subtitle": "Italian subtitle for dove-usarlo, max 6 words",
  "usage_scenarios": [
    {"icon": "icon", "title": "TITLE ALL CAPS Italian", "subtext": "Italian max 5 words"},
    {"icon": "icon", "title": "...", "subtext": "..."},
    {"icon": "icon", "title": "...", "subtext": "..."},
    {"icon": "icon", "title": "...", "subtext": "..."}
  ],
  "usage_product_strip_left": "Italian short text left of product in dove-usarlo",
  "usage_product_strip_right": "Italian short text right of product in dove-usarlo",
  "usage_bottom_caption": "Italian caption below product in dove-usarlo",
  "trust_title": "Italian ALL CAPS headline for garanzia slide, max 4 words",
  "trust_subtitle": "Italian subtitle for garanzia slide",
  "trust_badges": [
    {"icon": "shield", "title": "ITALIAN TRUST TITLE ALL CAPS", "subtext": "Italian max 6 words"},
    {"icon": "truck", "title": "...", "subtext": "..."},
    {"icon": "certificate", "title": "...", "subtext": "..."},
    {"icon": "headset", "title": "...", "subtext": "..."}
  ],
  "trust_product_left": "Italian small text left of product in garanzia",
  "trust_product_right": "Italian small text right of product in garanzia",
  "trust_tagline": "Italian bold italic closing tagline, max 10 words"
}"""


def _build_global_rule(product_name: str, accent: str) -> str:
    return (
        f"GLOBAL RULE — APPLIES TO ALL 10 IMAGES:\n"
        f"This is a PHOTO EDITING task, not a product generation task.\n"
        f"You are working with the uploaded reference photo of the {product_name}.\n"
        f"THE PRODUCT MUST BE TAKEN PIXEL-PERFECT FROM THE REFERENCE PHOTO.\n"
        f"Do not redraw it. Do not reinterpret it. Do not simplify it.\n"
        f"Treat it as a photographic cutout — only backgrounds and surrounding graphic elements change.\n"
        f"\n"
        f"THE PRODUCT IS UNTOUCHABLE.\n"
        f"Do NOT alter its shape. Do NOT change its proportions.\n"
        f"Do NOT modify its colors. Do NOT add glow or effects ON it.\n"
        f"Do NOT blend it with the background.\n"
        f"If any effect touches the product — that is a FAILURE.\n"
        f"\n"
        f"IGNORE ANY BRAND NAME OR LOGO IN THE REFERENCE PRODUCT PHOTO.\n"
        f"LOGO MODE FOR THIS JOB: LOGO_PROVIDED\n"
        f"- Images 02, 04, 06, 09: integrate the brand logo (SECOND image_input) in the "
        f"BOTTOM-RIGHT corner following LOGO INTEGRATION RULES.\n"
        f"- Images 01a, 01b, 03, 05, 07, 08: NO logo, NO empty space reserved, "
        f"fill the full composition.\n"
        f"NEVER write the text 'LOGO', 'BRAND', 'PLACEHOLDER', or similar AS TEXT in the image.\n"
        f"\n"
        f"ALL TEXT IN IMAGES MUST BE IN ITALIAN.\n"
        f"\n"
        f"TEXT RENDERING RULES — CRITICAL:\n"
        f"1. Render text EXACTLY as specified in the prompt — character by character, "
        f"no autocomplete, no synonym substitution, no language drift.\n"
        f"2. NEVER invent words. If a label is not in the prompt, do not add one.\n"
        f"3. Spell every Italian word correctly. Double-check letters before rendering.\n"
        f"4. If you cannot render a string clearly and legibly at full resolution, "
        f"OMIT IT rather than render a garbled version.\n"
        f"5. NO Lorem Ipsum. NO placeholder text. NO duplicated words.\n"
        f"6. NO text touching or overlapping the product.\n"
        f"7. Use ONE font family across the whole image: modern bold sans-serif "
        f"(geometric, similar to Inter / Manrope / Helvetica Now).\n"
        f"8. Kerning must be tight and consistent. No floating letters.\n"
        f"\n"
        f"Output: 2000x2000px | 1:1 | JPEG.\n"
        f"Font: modern bold sans-serif."
    )


LOGO_PLACEMENT = (
    "LOGO PLACEMENT: Integrate the brand logo (provided as the SECOND reference image) in the "
    "BOTTOM-RIGHT corner of the final image. Logo width: approximately 12-15% of the image width. "
    "Padding: about 4% from the right edge and 4% from the bottom edge. The logo must be clearly "
    "visible and legible. If the background behind the logo has a similar tone to the logo colors, "
    "add a subtle contrast enhancement (soft drop shadow OR a very faint white backdrop card at "
    "10-20% opacity) to ensure readability. The logo is a brand marker: do NOT distort it, do NOT "
    "tilt it, do NOT let other elements cover it. Preserve the EXACT colors and proportions of the "
    "original logo. Do NOT add any text label next to the logo. This logo is the CLIENT brand "
    "identity (distinct from 'No supplier brand names or logos' in the negative prompt, which "
    "refers only to manufacturer marks visible on the product)."
)


def _logo_line(has_logo: bool, image_num: str) -> str:
    if has_logo:
        return (
            f"LOGO MODE: LOGO_PROVIDED — integrate logo (SECOND image_input) in bottom-right "
            f"corner per LOGO INTEGRATION RULES."
        )
    return (
        f"LOGO MODE: NO_LOGO for this image. DO NOT ADD ANY LOGO, BRAND NAME, WATERMARK, "
        f"OR PLACEHOLDER. Fill the full composition."
    )


def _global_header(global_rule: str, logo_line: str) -> str:
    return global_rule + "\n" + logo_line + "\nALL TEXT IN IMAGES MUST BE IN ITALIAN.\nOutput: 2000x2000px | 1:1 | JPEG.\nFont: modern bold sans-serif.\n\n"


def _no_text_bg_rule() -> str:
    """Shared instruction block: the AI must produce a CLEAN branded background
    with the product placed, and render ABSOLUTELY NO text/cards/icons/charts —
    those are added client-side as an editable overlay layer."""
    return (
        "TEXT-FREE BACKGROUND MODE — CRITICAL:\n"
        "This image is a BACKGROUND PLATE. Do NOT render ANY text, words, letters, "
        "numbers, labels, badges, pills, UI cards, callout lines, icons, charts, "
        "checkmarks, rating stars or graphic widgets of any kind. "
        "All textual/graphic content is added later as a separate overlay layer. "
        "Produce ONLY: the product cutout (pixel-perfect from the reference) placed "
        "in the indicated region, plus a clean branded background. Leave the "
        "indicated text zone as CLEAN, UNOBSTRUCTED background (gradient/pattern only, "
        "no busy elements there) so overlay text stays readable.\n\n"
    )


def _build_prompts(a: dict, global_rule: str, accent: str, bg: list) -> list:
    """Build the 10 per-image prompt objects from the analysis dict.

    Text-heavy slides (02,03,04,05,06,08,09) are generated as CLEAN background
    plates (no AI-rendered text) and carry an `overlay` object with the
    structured copy; the frontend renders that copy as an editable HTML layer.
    Slides 01a, 01b, 07 are pure imagery and have no overlay.
    """
    bg1 = bg[0] if len(bg) > 0 else "#0A0A0F"
    bg2 = bg[1] if len(bg) > 1 else "#0D1B3E"
    bg3 = bg[2] if len(bg) > 2 else "#1A2A5E"
    name = a["product_name_full"]
    no_text = _no_text_bg_rule()

    def header(num: str) -> str:
        # No baked logo anymore: the logo is part of the overlay layer too.
        return _global_header(global_rule, _logo_line(False, num))

    images = []

    # ── 01a Hero Sfondo Bianco ────────────────────────────────────────────────
    p01a = header("01a") + (
        f"IMAGE 01A — HERO SFONDO BIANCO:\n\n"
        f"STEP 1 — PLACE THE PRODUCT:\n"
        f"Extract the {name} from the reference photo as a pixel-perfect photographic cutout.\n"
        f"{a['product_visual_description'][:300].strip()}\n"
        f"Position the product centered in the frame, slightly above center "
        f"(product occupying approximately 65% of the canvas height). "
        f"Angle: slight 15° clockwise tilt. The product occupies the full visual focus.\n\n"
        f"STEP 2 — BACKGROUND:\n"
        f"Pure white background: RGB(255, 255, 255). Absolutely no gradient, no shadow, "
        f"no texture, no vignette, no border.\n"
        f"Zero text. Zero logo. Zero graphic elements. Zero effects.\n"
        f"The product must appear as a clean commercial Amazon main image — nothing else in the frame.\n\n"
        f"Negative: No redrawn product. No illustrated style. No glow ON the product. "
        f"No effects touching the product. No text. No logo. No watermark. "
        f"No background color other than pure white."
    )
    images.append({"number": "01a", "name": "Hero Sfondo Bianco", "prompt": p01a, "logo_variant": None})

    # ── 01b Hero Con Effetto ──────────────────────────────────────────────────
    effect_cat = a.get("categoria_effetto_01b", "energy burst neutro")
    effect_desc = EFFECT_LIBRARY.get(effect_cat, EFFECT_LIBRARY["energy burst neutro"])
    effect_desc = effect_desc.replace("{accent}", accent)
    effect_name = effect_cat.upper()

    p01b = header("01b") + (
        f"IMAGE 01B — HERO CON EFFETTO {effect_name}:\n\n"
        f"STEP 1 — RENDER THE PRODUCT EXACTLY AS IN THE REFERENCE PHOTO:\n"
        f"Extract the {name} as a PIXEL-PERFECT photographic cutout.\n"
        f"{a['product_visual_description'][:250].strip()}\n"
        f"Position: centered in the canvas, occupying ~70% of the canvas height. "
        f"The product is on a SEPARATE LAYER — it is the TOP layer, untouchable.\n"
        f"THE PRODUCT IS UNTOUCHABLE. Maintain as a separate layer always.\n"
        f"If any background effect bleeds onto the product — FAILURE.\n\n"
        f"STEP 2 — ADD BACKGROUND EFFECT ONLY BEHIND THE PRODUCT:\n"
        f"Background base: deep dark radial gradient, center {bg2}, edges {bg1}.\n"
        f"ONLY in the area BEHIND and AROUND the product — NOT touching, NOT overlapping the product cutout:\n"
        f"{effect_desc}\n"
        f"The entire effect exists ONLY behind the product. Zero bleed onto the product silhouette.\n"
        f"NO text. NO logos. NO watermarks. NO empty reserved space.\n\n"
        f"Negative: No redrawn product. No glow ON the product. No effect touching the product. "
        f"No text. No logo. No English text."
    )
    images.append({"number": "01b", "name": f"Hero Con Effetto {effect_cat.title()}", "prompt": p01b, "logo_variant": None})

    # ── 02 Benefit Principale (clean plate: product LEFT, text zone RIGHT) ─────
    p02 = header("02") + no_text + (
        f"IMAGE 02 — BENEFIT (background plate):\n\n"
        f"Background: smooth dark gradient {bg1} → {bg2}, left-to-right, with a very subtle "
        f"geometric mesh in {accent} at 4% opacity.\n"
        f"LEFT HALF (0–50% width): product cutout ({name}, pixel-perfect from reference), "
        f"vertically centered, ~78% of the left-zone height, soft drop shadow on the background only.\n"
        f"RIGHT HALF (50–100% width): keep it as CLEAN dark gradient — this is the reserved text "
        f"zone for the overlay. No elements here.\n\n"
        f"Negative: No redrawn product. No glow ON the product. No text. No icons. No cards."
    )
    images.append({
        "number": "02", "name": "Benefit Principale", "prompt": p02, "logo_variant": "chiaro",
        "overlay": {
            "type": "benefit",
            "headline": a.get("benefit_headline", "QUALITÀ SUPERIORE"),
            "subheading": a.get("benefit_subheading", "5 motivi per sceglierlo"),
            "benefits": a.get("benefits_5", ["Qualità superiore", "Design premium", "Tecnologia avanzata", "Facile da usare", "Garanzia inclusa"])[:5],
            "pill": a.get("benefit_pill", "Qualità certificata · Garanzia inclusa"),
        },
    })

    # ── 03 Specifiche 1 (clean plate: product LEFT, specs zone RIGHT) ──────────
    p03 = header("03") + no_text + (
        f"IMAGE 03 — SPECS (background plate):\n\n"
        f"Background: very dark charcoal, faint diagonal gradient {bg1} → {bg2}.\n"
        f"LEFT 45% width: product cutout ({name}, pixel-perfect), vertically centered, ~68% canvas height.\n"
        f"TOP band (0–18% height) and RIGHT 55% width: keep CLEAN (gradient only) — reserved text zone "
        f"for title + spec cards overlay. No elements there.\n\n"
        f"Negative: No redrawn product. No text. No spec cards. No icons. No rules."
    )
    images.append({
        "number": "03", "name": "Specifiche 1", "prompt": p03, "logo_variant": None,
        "overlay": {
            "type": "specs",
            "headline": a.get("specs_group_1_headline", "SPECIFICHE TECNICHE"),
            "title": a.get("specs_group_1_title", "Connettività · Audio · Batteria"),
            "rows": [{"label": s.get("label", "SPEC"), "value": s.get("value", "—")} for s in a.get("specs_group_1", [])[:6]],
            "bottom": a.get("specs_group_1_bottom", "Prestazioni eccellenti, tecnologia superiore."),
        },
    })

    # ── 04 Specifiche 2 (clean plate: product CENTER band, text top+bottom) ────
    p04 = header("04") + no_text + (
        f"IMAGE 04 — SPECS 2 (background plate):\n\n"
        f"Background: rich dark vertical gradient {bg2} (top) → {bg1} (bottom), faint concentric "
        f"circles in {accent} at 3% opacity centered.\n"
        f"CENTER band (35–65% height): product cutout ({name}, pixel-perfect), centered, ~38% canvas height.\n"
        f"TOP band (0–32% height) and BOTTOM band (68–100% height): keep CLEAN — reserved for overlay "
        f"cards. No elements there.\n\n"
        f"Negative: No redrawn product. No text. No cards. No icons."
    )
    images.append({
        "number": "04", "name": "Specifiche 2", "prompt": p04, "logo_variant": "chiaro",
        "overlay": {
            "type": "specs2",
            "title": a.get("specs_group_2_title", "PRESTAZIONI & COMFORT"),
            "subheading": a.get("specs_group_2_subheading", "Progettato per durare tutto il giorno"),
            "topCards": a.get("specs_group_2_top_cards", [
                {"icon": "clock", "label": "DURATA", "value": "—", "subtext": "Autonomia massima"},
                {"icon": "lightning", "label": "RICARICA", "value": "—", "subtext": "Ricarica rapida"},
            ])[:2],
            "bottomCards": a.get("specs_group_2_bottom_cards", [
                {"icon": "drop", "label": "RESISTENZA", "subtext": "Sport & outdoor"},
                {"icon": "feather", "label": "LEGGEREZZA", "subtext": "Ultra leggero"},
                {"icon": "gear", "label": "FUNZIONE", "subtext": "Versatile"},
            ])[:3],
            "strip": a.get("specs_group_2_strip", "Tecnologia di ultima generazione"),
        },
    })

    # ── 05 Come Si Usa (clean LIGHT plate: product small bottom-center) ────────
    p05 = header("05") + no_text + (
        f"IMAGE 05 — USAGE (background plate):\n\n"
        f"Background: light warm off-white #F5F5F2 with a very subtle dot-grid "
        f"(#D9D9D9, 2px dots, 34px spacing, 35% opacity). Lightest plate of the set.\n"
        f"BOTTOM-CENTER: product cutout ({name}, pixel-perfect), centered horizontally, "
        f"~30% canvas height, sitting in the lower third.\n"
        f"TOP 70% of the canvas: keep CLEAN light background — reserved for title + 3 step columns overlay.\n\n"
        f"Negative: No redrawn product. No text. No step circles. No icons. No dividers."
    )
    images.append({
        "number": "05", "name": "Come Si Usa", "prompt": p05, "logo_variant": None,
        "overlay": {
            "type": "usage",
            "title": a.get("usage_title", "COME SI USA"),
            "subtitle": "Tre semplici passi",
            "steps": [
                {"num": s.get("step_num", i + 1), "verb": s.get("verb", "STEP"), "subtext": s.get("subtext", ""), "icon": s.get("icon", "arrow")}
                for i, s in enumerate(a.get("usage_steps", [
                    {"step_num": 1, "verb": "PREPARA", "subtext": "Prepara il prodotto", "icon": "box"},
                    {"step_num": 2, "verb": "USA", "subtext": "Utilizza il prodotto", "icon": "hand"},
                    {"step_num": 3, "verb": "GODITI", "subtext": "Goditi il risultato", "icon": "star"},
                ])[:3])
            ],
            "strip": a.get("usage_bottom_strip", "Semplicità e qualità in ogni utilizzo"),
            "light": True,
        },
    })

    # ── 06 Anatomia (clean plate: product CENTER large, margins clean) ─────────
    p06 = header("06") + no_text + (
        f"IMAGE 06 — ANATOMY (background plate):\n\n"
        f"Background: very dark technical {bg1} with a faint circuit-board line pattern in {accent} "
        f"at 5% opacity (1px lines, junction dots).\n"
        f"CENTER: large product cutout ({name}, pixel-perfect), centered, ~70% canvas height, "
        f"frontal view angled ~10°.\n"
        f"TOP band (0–16% height) and the LEFT/RIGHT margins: keep CLEAN — reserved for the title and "
        f"the part labels overlay. No callout lines, no labels drawn.\n\n"
        f"Negative: No redrawn product. No text. No callout lines. No labels. No pills."
    )
    images.append({
        "number": "06", "name": "Anatomia del Prodotto", "prompt": p06, "logo_variant": "chiaro",
        "overlay": {
            "type": "anatomy",
            "title": a.get("anatomy_title", "ANATOMIA"),
            "subtitle": "Ogni dettaglio, al suo posto",
            "parts": [{"label": p.get("label", "Componente"), "location": p.get("location", "right")} for p in a.get("anatomy_parts", [])[:6]],
            "bottom": a.get("anatomy_bottom", "Precisione e qualità in ogni componente"),
        },
    })

    # ── 07 Lifestyle ──────────────────────────────────────────────────────────
    lifestyle = a.get("lifestyle_scene",
        f"Una persona di 30-35 anni in un ambiente moderno e luminoso utilizza il {name}. "
        f"L'espressione è rilassata e soddisfatta. Lo sfondo è bokeh sfumato in tonalità calde. "
        f"Luce naturale diffusa, look editoriale e autentico.")
    p07 = header("07") + (
        f"IMAGE 07 — LIFESTYLE:\n\n"
        f"{lifestyle}\n\n"
        f"The product — pixel-perfect cutout from the reference photo of {name} — "
        f"is composited realistically in the scene, consistent with its actual proportions. "
        f"Correct lighting match to scene (highlights and shadows matching the environment). "
        f"THE PRODUCT SURFACE IS UNTOUCHABLE — no color grading applied directly onto it, "
        f"no glow overlaid on it.\n\n"
        f"NO text overlays. NO logo space. NO graphic elements. NO watermarks. "
        f"Pure lifestyle photography feel.\n"
        f"Fill the entire 2000×2000px canvas with the photographic scene.\n\n"
        f"Negative: No redrawn product. No illustrated style. No effect on the product. "
        f"No text in image. No logo. No English text. No flat graphic elements."
    )
    images.append({"number": "07", "name": "Lifestyle", "prompt": p07, "logo_variant": None})

    # ── 08 Dove Usarlo (clean plate: product small bottom, 2×2 zone clean) ─────
    p08 = header("08") + no_text + (
        f"IMAGE 08 — SCENARIOS (background plate):\n\n"
        f"Background: deep dark blue-black {bg1}, faint radial gradient center {bg2} → edges {bg1}.\n"
        f"BOTTOM-CENTER: product cutout ({name}, pixel-perfect), centered horizontally, "
        f"~20% canvas height, in the lower area.\n"
        f"TOP 75% of the canvas: keep CLEAN — reserved for the title + a 2×2 grid of scenario cards "
        f"overlay. No cards, no icons, no grid lines drawn.\n\n"
        f"Negative: No redrawn product. No text. No cards. No icons."
    )
    images.append({
        "number": "08", "name": "Dove Usarlo", "prompt": p08, "logo_variant": None,
        "overlay": {
            "type": "scenarios",
            "title": a.get("usage_scenarios_title", "USALO OVUNQUE"),
            "subtitle": a.get("usage_scenarios_subtitle", "Adatto ad ogni momento della giornata"),
            "scenarios": a.get("usage_scenarios", [
                {"icon": "home", "title": "IN CASA", "subtext": "Uso domestico quotidiano"},
                {"icon": "briefcase", "title": "IN UFFICIO", "subtext": "Produttività professionale"},
                {"icon": "airplane", "title": "IN VIAGGIO", "subtext": "Compagno di viaggio"},
                {"icon": "sport", "title": "SPORT", "subtext": "Attività fisica e outdoor"},
            ])[:4],
            "left": a.get("usage_product_strip_left", "Qualità garantita"),
            "right": a.get("usage_product_strip_right", "Sempre con te"),
            "caption": a.get("usage_bottom_caption", "Un prodotto. Infinite possibilità."),
        },
    })

    # ── 09 Garanzia e Trust (clean plate: product small bottom, 2×2 zone clean)─
    p09 = header("09") + no_text + (
        f"IMAGE 09 — TRUST (background plate):\n\n"
        f"Background: very deep midnight {bg1} with a faint diamond/rhombus pattern in {accent} at "
        f"4% opacity, subtle corner vignette. Premium, reassuring mood.\n"
        f"BOTTOM-CENTER: product cutout ({name}, pixel-perfect), centered horizontally, "
        f"~18% canvas height, in the lower area.\n"
        f"TOP 75% of the canvas: keep CLEAN — reserved for the title + a 2×2 grid of trust badges "
        f"overlay. No cards, no badges, no icons drawn.\n\n"
        f"Negative: No redrawn product. No text. No cards. No icons. No frame."
    )
    images.append({
        "number": "09", "name": "Garanzia e Trust", "prompt": p09, "logo_variant": "chiaro",
        "overlay": {
            "type": "trust",
            "title": a.get("trust_title", "ACQUISTO PROTETTO"),
            "subtitle": a.get("trust_subtitle", "La nostra promessa per te"),
            "badges": a.get("trust_badges", [
                {"icon": "shield", "title": "GARANZIA 12 MESI", "subtext": "Sostituzione o rimborso garantito"},
                {"icon": "truck", "title": "SPEDIZIONE RAPIDA", "subtext": "Consegna veloce in tutta Italia"},
                {"icon": "certificate", "title": "QUALITÀ TESTATA", "subtext": "Prodotto certificato e approvato"},
                {"icon": "headset", "title": "SUPPORTO CLIENTI", "subtext": "Assistenza dedicata sempre disponibile"},
            ])[:4],
            "left": a.get("trust_product_left", "Prodotto verificato"),
            "right": a.get("trust_product_right", "Qualità garantita"),
            "tagline": a.get("trust_tagline", "Scelto da chi non scende a compromessi."),
        },
    })

    return images


async def generate_mariano_prompts(
    amazon_data: dict,
    images_b64: list[dict]
) -> dict:
    """
    Main entry point. Takes Amazon product data + reference images.
    Returns complete prompts.json dict in Mariano style.

    Args:
        amazon_data: dict from scraper.scrape_asin()
        images_b64: list of {"data": base64_str, "media_type": "image/jpeg"}
    """
    if not images_b64:
        raise RuntimeError(
            "generate_mariano_prompts: nessuna immagine reference disponibile "
            "(images_b64 vuoto). Lo scraper non ha restituito immagini valide."
        )

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # Build Claude message content
    content = []
    for img in images_b64[:4]:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": img.get("media_type", "image/jpeg"),
                "data": img["data"]
            }
        })

    product_text = (
        f"Product title: {amazon_data.get('title', '')}\n"
        f"Brand: {amazon_data.get('brand', '')}\n"
        f"Bullets: {json.dumps(amazon_data.get('feature_bullets', []), ensure_ascii=False)}\n"
        f"Specs: {json.dumps(amazon_data.get('specifications', {}), ensure_ascii=False)}\n"
        f"Rating: {amazon_data.get('rating', '')} ({amazon_data.get('ratings_total', 0)} reviews)"
    )
    content.append({"type": "text", "text": product_text})

    # Prompt caching: ANALYSIS_SYSTEM_PROMPT is ~1.7K tokens and identical for every
    # call. Marking it as ephemeral cache makes subsequent reads cost ~10% of normal
    # input. Costs ~25% more on the FIRST write; break-even after 2 calls.
    response = client.messages.create(
        model=cfg.HAIKU_MODEL,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": ANALYSIS_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": content}],
    )

    raw = response.content[0].text.strip()
    a = _parse_claude_json(raw)

    accent = a.get("accent_color_hex", "#8B5CF6")
    bg = a.get("palette_sfondo_hex", ["#0A0A0F", "#0D1B3E", "#1A2A5E"])
    product_name = a.get("product_name_full", amazon_data.get("title", "Prodotto"))
    global_rule = _build_global_rule(product_name, accent)

    images = _build_prompts(a, global_rule, accent, bg)

    # Bullet points reali del listing Amazon (NON inventati): vengono presi
    # tal quali da Rainforest. Garantiamo SEMPRE almeno 5 elementi: se Amazon
    # ne fornisce di meno, completiamo con i `benefits_5` di Claude (che sono
    # comunque estratti dalla descrizione del prodotto, non inventati ex novo).
    raw_bullets = [b for b in (amazon_data.get("feature_bullets") or []) if isinstance(b, str) and b.strip()]
    if len(raw_bullets) < 5:
        ai_bullets = [b for b in (a.get("benefits_5") or []) if isinstance(b, str) and b.strip()]
        for b in ai_bullets:
            if b not in raw_bullets:
                raw_bullets.append(b)
            if len(raw_bullets) >= 5:
                break
    product_bullets = raw_bullets[:8]   # cap at 8 to keep the UI compact

    return {
        "product_title":             amazon_data.get("title", ""),
        "product_brand":             amazon_data.get("brand", ""),
        "product_bullets":           product_bullets,
        "product_visual_description": a.get("product_visual_description", ""),
        "categoria_effetto_01b":     a.get("categoria_effetto_01b", "energy burst neutro"),
        "accent_color_hex":          accent,
        "palette_sfondo_hex":        bg,
        "global_rule":               global_rule,
        "images":                    images,
        "negative_prompt": (
            "ABSOLUTELY NO TEXT of any kind: no words, no letters, no numbers, no labels, "
            "no titles, no captions, no badges, no pills, no UI cards, no callout lines, "
            "no icons, no charts, no rating stars, no checkmarks — all text/graphics are "
            "added later as a separate overlay layer. "
            "No redrawn product. No illustrated or cartoon style product. "
            "No product recreated from scratch. No glow or color effect applied directly ON the product. "
            "No shape or proportion alteration of the product. "
            "No background effects touching, overlapping, or bleeding onto the product. "
            "No text in English (except brand names if inevitable). "
            "No supplier brand names or logos. "
            "No placeholder text like 'LOGO HERE', '[BRAND]', 'LOGO CLIENTE', 'YOUR LOGO', 'BRAND HERE'. "
            "No empty rectangular or circular space intentionally left blank for a logo. "
            "No watermarks, no signatures, no trademark symbols. "
            "Do not write the word 'LOGO' anywhere in the image. "
            "No misspelled words. No garbled or duplicated letters. No nonsense or invented words. "
            "No Lorem Ipsum. No filler text. No partially-rendered or cut-off text. "
            "No mixed-font typography — only one modern bold sans-serif family across the image. "
            "No tech-grid or circuit-pattern visual effects on products that are not consumer electronics. "
            "No smart-home or IoT aesthetic on furniture, hardware, decor, food, or fashion items."
        ),
        "_analysis": a,
    }
