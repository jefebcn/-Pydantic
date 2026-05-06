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
from .config import cfg

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
}

# ── Analysis system prompt ─────────────────────────────────────────────────────
ANALYSIS_SYSTEM_PROMPT = """You are an expert Italian product photographer and Amazon listing specialist.
Analyze the provided product images and Amazon product data.
Your task is to extract everything needed to create a professional 10-image Amazon photo set.

Output JSON only. No markdown fences. No commentary. All text in Italian except hex codes, icon descriptions, and spec values.

Required JSON structure:
{
  "product_name_full": "full product name with model number",
  "product_visual_description": "detailed Italian visual description (120+ words): materials, colors (with LAB/hex), geometry, proportions, surface finishes, visible components. Zero marketing language.",
  "product_category": "audio | electronics | tech | home | fitness | beauty | food | security | clothing | accessories | other",
  "categoria_effetto_01b": "choose: sonic burst (audio), energy burst neutro (compact electronics), radar scan (security/GPS), crystal bloom (beauty/skincare), kinetic burst (fitness/sport), tech grid (smart home/IoT), laser focus (precision tools), nebula glow (ambient/lighting), circuit pulse (networking), prism split (optics/cameras)",
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


def _build_prompts(a: dict, global_rule: str, accent: str, bg: list) -> list:
    """Build the 10 per-image prompt objects from the analysis dict."""
    bg1 = bg[0] if len(bg) > 0 else "#0A0A0F"
    bg2 = bg[1] if len(bg) > 1 else "#0D1B3E"
    bg3 = bg[2] if len(bg) > 2 else "#1A2A5E"
    name = a["product_name_full"]

    def header(num: str) -> str:
        has_logo = num in ("02", "04", "06", "09")
        return _global_header(global_rule, _logo_line(has_logo, num))

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

    # ── 02 Benefit Principale ─────────────────────────────────────────────────
    benefits_text = "\n".join(
        f"✓ {b}" for b in a.get("benefits_5", ["Qualità superiore", "Design premium", "Tecnologia avanzata", "Facile da usare", "Garanzia inclusa"])
    )
    p02 = header("02") + (
        f"IMAGE 02 — BENEFIT PRINCIPALE:\n\n"
        f"Background: dark gradient {bg1} to {bg2}, left-to-right. "
        f"Subtle geometric mesh pattern overlay at 4% opacity in {accent}. No solid color blocks.\n\n"
        f"LEFT 55% of canvas: product cutout (pixel-perfect from reference) of the {name}. "
        f"Position: vertically centered, product occupying ~75% of the left zone height. "
        f"A very subtle drop shadow falls on the background only (NOT on the product): "
        f"soft shadow, 30px blur, 15px offset right-down, 25% opacity.\n\n"
        f"RIGHT 45% of canvas: benefit text block, vertically centered.\n"
        f"TOP of right zone: bold white italic heading (font-size ~52px):\n"
        f"\"{a.get('benefit_headline', 'QUALITÀ SUPERIORE')}\"\n"
        f"Subheading below (font-size 28px, {accent}, light weight): "
        f"\"{a.get('benefit_subheading', '5 motivi per sceglierlo')}\"\n"
        f"Thin horizontal separator line ({accent}, 1px, 80% width of right zone).\n\n"
        f"Then 5 benefit rows, each: checkmark icon (✓, {accent}, bold, 36px) + "
        f"white bold text (font-size 34px), with thin 0.5px {accent} separator between rows:\n"
        f"{benefits_text}\n\n"
        f"BOTTOM of right zone: small accent pill badge ({accent} background, white text, 24px): "
        f"\"{a.get('benefit_pill', 'Qualità certificata · Garanzia inclusa')}\"\n\n"
        f"Fill the entire canvas — no empty corner, no dead space.\n\n"
        f"{LOGO_PLACEMENT}\n\n"
        f"Negative: No redrawn product. No glow ON the product. No effect touching the product. "
        f"No English text. No placeholder."
    )
    images.append({"number": "02", "name": "Benefit Principale", "prompt": p02, "logo_variant": "chiaro"})

    # ── 03 Specifiche 1 ───────────────────────────────────────────────────────
    specs1 = a.get("specs_group_1", [])
    spec_cards_text = "\n".join(
        f"Spec card {i+1}:\nLabel: \"{s.get('label', 'SPEC')}\"\nValue: \"{s.get('value', '—')}\""
        for i, s in enumerate(specs1[:6])
    )
    p03 = header("03") + (
        f"IMAGE 03 — {a.get('specs_group_1_headline', 'SPECIFICHE TECNICHE')} · "
        f"{a.get('specs_group_1_title', 'Connettività e Funzioni').upper()}:\n\n"
        f"Background: very dark charcoal {bg1} with a subtle diagonal texture at 6% opacity. "
        f"Top-left to bottom-right: faint gradient from {bg1} to {bg2}.\n\n"
        f"TOP CENTER: title text (font-size 56px, white bold): "
        f"\"{a.get('specs_group_1_headline', 'SPECIFICHE TECNICHE')}\"\n"
        f"Subtitle below (font-size 30px, {accent}, regular): \"{a.get('specs_group_1_title', 'Connettività · Audio · Batteria')}\"\n"
        f"Thin full-width horizontal rule ({accent}, 1.5px) below the subtitle.\n\n"
        f"CENTER LAYOUT: 2-column spec grid with product cutout.\n\n"
        f"LEFT COLUMN (45% of canvas width, vertically centered):\n"
        f"Product cutout ({name}, pixel-perfect from reference), positioned vertically centered, "
        f"~65% of canvas height. Natural appearance, no effects on product.\n\n"
        f"RIGHT COLUMN (50% of canvas width, top-aligned with 5% padding from top rule):\n"
        f"Spec cards — each card: dark pill {bg2} background, {accent} left border (4px), "
        f"white text. Font-size label 24px {accent} uppercase, value 34px white bold.\n\n"
        f"{spec_cards_text}\n\n"
        f"Gap between cards: 18px. Cards span the right column fully.\n\n"
        f"BOTTOM CENTER: bold white sentence (font-size 32px): "
        f"\"{a.get('specs_group_1_bottom', 'Prestazioni eccellenti, tecnologia superiore.')}\"\n"
        f"Below that: thin {accent} horizontal rule full width.\n\n"
        f"Fill the entire 2000×2000 canvas — no dead space.\n\n"
        f"Negative: No redrawn product. No glow ON the product. No English text. "
        f"No logo placeholder. No empty corners."
    )
    images.append({"number": "03", "name": "Specifiche 1", "prompt": p03, "logo_variant": None})

    # ── 04 Specifiche 2 ───────────────────────────────────────────────────────
    top_cards = a.get("specs_group_2_top_cards", [
        {"icon": "clock", "label": "DURATA", "value": "—", "subtext": "Autonomia massima"},
        {"icon": "lightning", "label": "RICARICA", "value": "—", "subtext": "Ricarica rapida"},
    ])
    bottom_cards = a.get("specs_group_2_bottom_cards", [
        {"icon": "drop", "label": "RESISTENZA", "subtext": "Sport & outdoor"},
        {"icon": "feather", "label": "LEGGEREZZA", "subtext": "Ultra leggero"},
        {"icon": "gear", "label": "FUNZIONE", "subtext": "Versatile"},
    ])
    top_cards_text = "\n".join(
        f"Card {chr(65+i)} — dark bg {bg2}, accent border top 4px {accent}:\n"
        f"  Icon: {c.get('icon','clock')} symbol (simple line, {accent}, 48px)\n"
        f"  Label (24px {accent}): \"{c.get('label','LABEL')}\"\n"
        f"  Value (48px white bold): \"{c.get('value','—')}\"\n"
        f"  Subtext (20px #AAAAAA): \"{c.get('subtext', '')}\""
        for i, c in enumerate(top_cards[:2])
    )
    bottom_cards_text = "\n".join(
        f"Card {chr(67+i)} — dark bg {bg2}, left border 4px {accent}:\n"
        f"  Icon: {c.get('icon','gear')} ({accent}, 36px)\n"
        f"  Label (22px {accent}): \"{c.get('label','LABEL')}\"\n"
        f"  Subtext (20px white): \"{c.get('subtext','')}\""
        for i, c in enumerate(bottom_cards[:3])
    )
    p04 = header("04") + (
        f"IMAGE 04 — {a.get('specs_group_2_title', 'SPECIFICHE 2')} · "
        f"{a.get('specs_group_2_subheading', 'Progettato per le massime prestazioni').upper()}:\n\n"
        f"Background: rich dark gradient, top {bg2} to bottom {bg1}. "
        f"Subtle concentric circle pattern (thin lines, {accent}, 3% opacity) centered at top-center.\n\n"
        f"TOP CENTER: title (font-size 56px, white bold): \"{a.get('specs_group_2_title', 'PRESTAZIONI & COMFORT')}\"\n"
        f"Subtitle (font-size 28px, {accent}): \"{a.get('specs_group_2_subheading', 'Progettato per durare tutto il giorno')}\"\n"
        f"Full-width horizontal rule ({accent}, 1.5px).\n\n"
        f"MAIN AREA: top-to-bottom layout with 2 top blocks + product + 3 bottom blocks.\n\n"
        f"TOP BLOCK (full width, 2 cards side by side, each 46% width, 4% gap):\n"
        f"{top_cards_text}\n\n"
        f"CENTER: product cutout (pixel-perfect, {name}), centered horizontally, "
        f"occupying ~38% of canvas height. Positioned between the top block and bottom block.\n\n"
        f"BOTTOM BLOCK (full width, 3 cards side by side, each 30% width, 3% gap):\n"
        f"{bottom_cards_text}\n\n"
        f"BOTTOM: full-width accent bar ({accent}, 4px) at very bottom, then white text centered (26px): "
        f"\"{a.get('specs_group_2_strip', 'Tecnologia di ultima generazione')}\"\n\n"
        f"Fill every pixel of the 2000×2000 canvas.\n\n"
        f"{LOGO_PLACEMENT}\n\n"
        f"Negative: No redrawn product. No glow ON the product. No English text. No placeholder."
    )
    images.append({"number": "04", "name": "Specifiche 2", "prompt": p04, "logo_variant": "chiaro"})

    # ── 05 Come Si Usa ────────────────────────────────────────────────────────
    steps = a.get("usage_steps", [
        {"step_num": 1, "verb": "PREPARA", "title": "STEP 1", "subtext": "Prepara il prodotto", "icon": "box"},
        {"step_num": 2, "verb": "USA", "title": "STEP 2", "subtext": "Utilizza il prodotto", "icon": "hand"},
        {"step_num": 3, "verb": "GODITI", "title": "STEP 3", "subtext": "Goditi il risultato", "icon": "star"},
    ])
    steps_text = "\n\n".join(
        f"COLUMN {i+1} — STEP {s.get('step_num', i+1)}:\n"
        f"Accent circle at top-center of column: filled circle {accent}, 80px diameter, "
        f"white bold number \"{s.get('step_num', i+1)}\" inside (font-size 44px).\n"
        f"Icon below circle: simple line icon of a {s.get('icon', 'arrow')} "
        f"(#0D1B3E or dark navy, 60px).\n"
        f"Title (font-size 34px, dark navy bold): \"{s.get('verb', 'STEP').upper()}\"\n"
        f"Subtext (font-size 24px, #555555, regular): \"{s.get('subtext', '')}\"\n"
        f"Below subtext: product cutout placed centrally in the lower part of the column, ~35% column height."
        for i, s in enumerate(steps[:3])
    )
    p05 = header("05") + (
        f"IMAGE 05 — {a.get('usage_title', 'COME SI USA')} · 3 STEP:\n\n"
        f"Background: light warm off-white #F5F5F2 with very subtle dot-grid pattern "
        f"(#D0D0D0, 2px dots, 30px spacing, 40% opacity). This is the lightest background — "
        f"provides maximum contrast variety.\n\n"
        f"TOP CENTER:\n"
        f"Title (font-size 60px, color #0D1B3E, bold): \"{a.get('usage_title', 'COME SI USA')}\"\n"
        f"Subtitle (font-size 28px, {accent}): \"Tre semplici passi\"\n"
        f"Full-width thin horizontal rule ({accent}, 1.5px) below.\n\n"
        f"MAIN AREA: 3 equal columns separated by thin vertical dividers ({accent}, 1px, 60% canvas height, vertically centered).\n\n"
        f"{steps_text}\n\n"
        f"BOTTOM CENTER (below the 3 columns, full width):\n"
        f"Dark pill bar (#0D1B3E, 80px tall, full width, 8px rounded corners):\n"
        f"White text (font-size 26px): \"{a.get('usage_bottom_strip', 'Semplicità e qualità in ogni utilizzo')}\"\n\n"
        f"Fill entire 2000×2000 canvas — no dead space.\n\n"
        f"Negative: No redrawn product. No glow ON the product. No English text. No logo. No watermark."
    )
    images.append({"number": "05", "name": "Come Si Usa", "prompt": p05, "logo_variant": None})

    # ── 06 Anatomia ───────────────────────────────────────────────────────────
    parts = a.get("anatomy_parts", [
        {"label": "Componente principale", "location": "center"},
        {"label": "Connettore", "location": "bottom"},
        {"label": "Superficie principale", "location": "top"},
        {"label": "Elemento laterale", "location": "left"},
        {"label": "Dettaglio tecnico", "location": "right"},
    ])
    parts_text = "\n".join(
        f"→ {p.get('location', 'area').upper()} area (pointing to {p.get('location','this area')} of product):\n"
        f"  Label (top/bottom/left/right quadrant accordingly): \"{p.get('label', 'Componente')}\""
        for p in parts[:6]
    )
    p06 = header("06") + (
        f"IMAGE 06 — {a.get('anatomy_title', 'ANATOMIA DEL PRODOTTO')}:\n\n"
        f"Background: very dark technical {bg1} with a subtle blue circuit-board line pattern "
        f"at 5% opacity ({accent} lines, 1px, grid with small junction dots).\n\n"
        f"TOP CENTER:\n"
        f"Title (font-size 62px, white bold): \"{a.get('anatomy_title', 'ANATOMIA')}\"\n"
        f"Subtitle (font-size 30px, {accent}): \"Ogni dettaglio, al suo posto\"\n"
        f"Thin horizontal rule ({accent}, 1.5px, full width).\n\n"
        f"CENTER: large product cutout ({name}, pixel-perfect from reference), "
        f"positioned at center of canvas, occupying ~72% of canvas height and ~55% of canvas width. "
        f"The product is frontal view slightly angled 10° to show main surfaces. The product is the focal point.\n\n"
        f"CALLOUT ARROWS — all callout lines are thin ({accent}, 1.5px) straight lines with a small "
        f"filled circle ({accent}, 6px) at the product contact point and an arrowhead at the label end. "
        f"Labels are white bold text (font-size 30px) on small dark pill backgrounds "
        f"({bg2}, 12px padding, 6px rounded, {accent} border 1px):\n\n"
        f"{parts_text}\n\n"
        f"All callout lines radiate outward from the product to the margins — "
        f"they do NOT cross the product body. Labels placed in the 4 margin quadrants around the product.\n\n"
        f"BOTTOM CENTER:\n"
        f"Full-width accent strip ({accent}, 6px height).\n"
        f"Below strip on dark bg: white text (font-size 26px, centered): "
        f"\"{a.get('anatomy_bottom', 'Precisione e qualità in ogni componente')}\"\n\n"
        f"Fill entire canvas — no dead space.\n\n"
        f"{LOGO_PLACEMENT}\n\n"
        f"Negative: No redrawn product. No glow ON the product. No English text. No placeholder."
    )
    images.append({"number": "06", "name": "Anatomia del Prodotto", "prompt": p06, "logo_variant": "chiaro"})

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

    # ── 08 Dove Usarlo ────────────────────────────────────────────────────────
    scenarios = a.get("usage_scenarios", [
        {"icon": "home", "title": "IN CASA", "subtext": "Uso domestico quotidiano"},
        {"icon": "briefcase", "title": "IN UFFICIO", "subtext": "Produttività professionale"},
        {"icon": "airplane", "title": "IN VIAGGIO", "subtext": "Compagno di viaggio"},
        {"icon": "sport", "title": "SPORT", "subtext": "Attività fisica e outdoor"},
    ])
    scenario_cards = "\n\n".join(
        f"CARD {'TOP-LEFT' if i==0 else 'TOP-RIGHT' if i==1 else 'BOTTOM-LEFT' if i==2 else 'BOTTOM-RIGHT'}:\n"
        f"Icon (top-center of card): {s.get('icon','star')} silhouette, {accent}, 70px.\n"
        f"Title (font-size 38px, white bold): \"{s.get('title','SCENARIO')}\"\n"
        f"Subtext (font-size 24px, #AAAAAA): \"{s.get('subtext','Descrizione breve')}\"\n"
        f"Small accent dot ({accent}, 8px) bottom-right of card."
        for i, s in enumerate(scenarios[:4])
    )
    p08 = header("08") + (
        f"IMAGE 08 — {a.get('usage_scenarios_title', 'DOVE USARLO')}:\n\n"
        f"Background: deep dark blue-black {bg1} with very faint radial gradient center {bg2} "
        f"to edges {bg1}. Four-quadrant grid layout. Subtle thin grid cross lines in the center "
        f"(1px, {accent}, 15% opacity) dividing the 4 quadrants.\n\n"
        f"TOP CENTER (above the 2×2 grid):\n"
        f"Title (font-size 60px, white bold): \"{a.get('usage_scenarios_title', 'USALO OVUNQUE')}\"\n"
        f"Subtitle (font-size 28px, {accent}): \"{a.get('usage_scenarios_subtitle', 'Adatto ad ogni momento della giornata')}\"\n"
        f"Thin rule ({accent}, 1.5px, full width).\n\n"
        f"MAIN AREA: 2×2 grid, 4 scenario cards. Each card occupies one quadrant. "
        f"Cards have background {bg2}, rounded corners 16px, border 1.5px {accent}, internal padding 30px.\n\n"
        f"{scenario_cards}\n\n"
        f"BOTTOM CENTER (below the 2×2 grid): product cutout ({name}, pixel-perfect) "
        f"centered horizontally, occupying ~20% of canvas height. "
        f"On each side of the product: accent text in {accent} (font-size 24px) — "
        f"LEFT: \"{a.get('usage_product_strip_left', 'Qualità garantita')}\" — "
        f"RIGHT: \"{a.get('usage_product_strip_right', 'Sempre con te')}\". "
        f"White centered caption below product (font-size 22px, #AAAAAA): "
        f"\"{a.get('usage_bottom_caption', 'Un prodotto. Infinite possibilità.')}\"\n\n"
        f"Full canvas 2000×2000 filled with content — no dead space.\n\n"
        f"Negative: No redrawn product. No glow ON the product. No English text. No logo. No placeholder."
    )
    images.append({"number": "08", "name": "Dove Usarlo", "prompt": p08, "logo_variant": None})

    # ── 09 Garanzia e Trust ───────────────────────────────────────────────────
    trust_badges = a.get("trust_badges", [
        {"icon": "shield", "title": "GARANZIA 12 MESI", "subtext": "Sostituzione o rimborso garantito"},
        {"icon": "truck", "title": "SPEDIZIONE RAPIDA", "subtext": "Consegna veloce in tutta Italia"},
        {"icon": "certificate", "title": "QUALITÀ TESTATA", "subtext": "Prodotto certificato e approvato"},
        {"icon": "headset", "title": "SUPPORTO CLIENTI", "subtext": "Assistenza dedicata sempre disponibile"},
    ])
    trust_cards_text = "\n\n".join(
        f"CARD {'TOP-LEFT' if i==0 else 'TOP-RIGHT' if i==1 else 'BOTTOM-LEFT' if i==2 else 'BOTTOM-RIGHT'} "
        f"— background {bg2}, border 1.5px {accent}, rounded 20px, padding 40px:\n"
        f"Icon (top-center): {t.get('icon','shield')} with checkmark, {accent}, 80px.\n"
        f"Title (font-size 40px, white bold): \"{t.get('title', 'GARANZIA')}\"\n"
        f"Subtext (font-size 24px, #AAAAAA): \"{t.get('subtext', '')}\""
        for i, t in enumerate(trust_badges[:4])
    )
    p09 = header("09") + (
        f"IMAGE 09 — {a.get('trust_title', 'ACQUISTO PROTETTO')}:\n\n"
        f"Background: very deep midnight {bg1} with a faint repeating diamond/rhombus geometric "
        f"pattern at 4% opacity in {accent}. Outer edge: very subtle vignette darkening to pure "
        f"black at corners. Overall mood: premium, reassuring, serious.\n\n"
        f"OUTER FRAME: thin border 3px {accent} at 80% opacity, inset 20px from all canvas edges.\n\n"
        f"TOP CENTER:\n"
        f"Title (font-size 64px, white bold): \"{a.get('trust_title', 'ACQUISTO PROTETTO')}\"\n"
        f"Subtitle (font-size 28px, {accent}): \"{a.get('trust_subtitle', 'La nostra promessa per te')}\"\n"
        f"Full-width horizontal rule ({accent}, 2px).\n\n"
        f"MAIN AREA: 2×2 grid of 4 trust cards.\n\n"
        f"{trust_cards_text}\n\n"
        f"BOTTOM CENTER (below the 2×2 grid): product cutout ({name}, pixel-perfect), "
        f"centered horizontally, occupying ~18% of canvas height. "
        f"On each side of the product in {accent} text (font-size 22px): "
        f"LEFT: \"{a.get('trust_product_left', 'Prodotto verificato')}\" — "
        f"RIGHT: \"{a.get('trust_product_right', 'Qualità garantita')}\".\n"
        f"Below product: white text centered (font-size 24px): "
        f"\"{a.get('trust_tagline', 'Scelto da chi non scende a compromessi.')}\"\n\n"
        f"Full 2000×2000 canvas filled — no dead space.\n\n"
        f"{LOGO_PLACEMENT}\n\n"
        f"Negative: No redrawn product. No glow ON the product. No English text. No placeholder."
    )
    images.append({"number": "09", "name": "Garanzia e Trust", "prompt": p09, "logo_variant": "chiaro"})

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

    response = client.messages.create(
        model=cfg.HAIKU_MODEL,
        max_tokens=4096,
        system=ANALYSIS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}]
    )

    raw = response.content[0].text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    a = json.loads(raw)

    accent = a.get("accent_color_hex", "#8B5CF6")
    bg = a.get("palette_sfondo_hex", ["#0A0A0F", "#0D1B3E", "#1A2A5E"])
    product_name = a.get("product_name_full", amazon_data.get("title", "Prodotto"))
    global_rule = _build_global_rule(product_name, accent)

    images = _build_prompts(a, global_rule, accent, bg)

    return {
        "product_visual_description": a.get("product_visual_description", ""),
        "categoria_effetto_01b": a.get("categoria_effetto_01b", "energy burst neutro"),
        "accent_color_hex": accent,
        "palette_sfondo_hex": bg,
        "global_rule": global_rule,
        "images": images,
        "negative_prompt": (
            "No redrawn product. No illustrated or cartoon style product. "
            "No product recreated from scratch. No glow or color effect applied directly ON the product. "
            "No shape or proportion alteration of the product. "
            "No background effects touching, overlapping, or bleeding onto the product. "
            "No text in English (except brand names if inevitable). "
            "No supplier brand names or logos. "
            "No placeholder text like 'LOGO HERE', '[BRAND]', 'LOGO CLIENTE', 'YOUR LOGO', 'BRAND HERE'. "
            "No empty rectangular or circular space intentionally left blank for a logo. "
            "No watermarks, no signatures, no trademark symbols. "
            "Do not write the word 'LOGO' anywhere in the image."
        ),
        "_analysis": a,
    }
