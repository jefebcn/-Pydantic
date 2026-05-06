GLOBAL_LIGHTING = {
    "HERO_DRAMATIC": (
        "three-point lighting: 4ft octabox key 45° camera-left 30° elevation 5500K, "
        "6ft scrim fill camera-right ratio 0.4, 2ft strip rim light 70° behind product "
        "6200K cool blue separation, soft gradient background vignette"
    ),
    "TECH_CLEAN": (
        "large overhead softbox axial 5500K, symmetric side scrims ratio 0.7 very flat, "
        "neutral gray gradient background #F5F5F5 to #EBEBEB"
    ),
    "LIFESTYLE_NATURAL": (
        "large diffused window light 5200K, natural bounce fill, "
        "real environment context defocused"
    )
}

GLOBAL_SUFFIX = (
    "shot on 85mm prime lens f/4 ISO 100 focus stacked, "
    "subtle teal-orange color grade, photorealistic product photography, "
    "2K resolution PBR-accurate materials, no AI artifacts, "
    "no text in image, no annotations rendered"
)

NEGATIVE_PROMPT = (
    "oversaturated colors, crushed blacks, blown highlights, mixed color temperature, "
    "hard shadow edges, HDR over-processing, cartoonish rendering, "
    "plastic look on metal, text in image, annotations, watermarks"
)

SLIDE_TEMPLATES = {
    1: {
        "name": "HERO",
        "lighting": "HERO_DRAMATIC",
        "ratio": "1:1",
        "prompt": (
            "{mvd}, single hero product shot floating slightly above neutral gradient surface, "
            "{lighting}, cool blue rim light separating silhouette, micro-shadow grounding, "
            "product occupies 55% frame height, absolute center of attention, "
            "museum-display minimal luxury aesthetic, "
            "deliberate negative space top 20% left 30% for headline overlay"
        )
    },
    2: {
        "name": "PROBLEM_SOLUTION",
        "lighting": "HERO_DRAMATIC",
        "ratio": "1:1",
        "prompt": (
            "split-frame 50/50 composition with thin vertical divider line. "
            "LEFT HALF: visual representation of {pain_point}, desaturated cold palette 6500K, "
            "slightly underexposed, mundane setting, no product visible. "
            "RIGHT HALF: {mvd}, {lighting}, warm 5200K, full saturation, "
            "visual sense of resolution and relief. Same camera height both halves."
        )
    },
    3: {
        "name": "KEY_FEATURES",
        "lighting": "TECH_CLEAN",
        "ratio": "1:1",
        "prompt": (
            "{mvd}, product centered, {lighting}, editorial clean composition, "
            "three deliberate empty sectors at 10-oclock 2-oclock and 6-oclock positions "
            "around product for callout overlays in post. "
            "No text in image. Clean geometric whitespace. Product 40% frame area."
        )
    },
    4: {
        "name": "LIFESTYLE",
        "lighting": "LIFESTYLE_NATURAL",
        "ratio": "16:9",
        "prompt": (
            "{mvd}, product placed naturally in {persona_env}, "
            "{lighting}, shallow DOF f/2.0, product lower-third right critical focus, "
            "environment elegantly defocused creamy bokeh, warm ambient atmosphere, "
            "optional partial hand element no face visible, candid editorial style, "
            "negative space top-left quadrant for text overlay"
        )
    },
    5: {
        "name": "TECH_SPECS",
        "lighting": "TECH_CLEAN",
        "ratio": "1:1",
        "prompt": (
            "{mvd}, product centered perfectly neutral seamless background, "
            "{lighting} maximum flat even illumination, camera 10° above center, "
            "absolute focus stacking entire surface, minimal contact shadow only, "
            "clean geometric whitespace all four sides for dimension callouts in post, "
            "blueprint-grade clarity, no text in image"
        )
    },
    6: {
        "name": "SOCIAL_PROOF",
        "lighting": "TECH_CLEAN",
        "ratio": "1:1",
        "prompt": (
            "{mvd}, small-scale product accent element bottom-right 15% area, "
            "reduced contrast muted neutral background {lighting}, "
            "ample negative space dominating frame for typographic overlay, "
            "editorial magazine minimalist, product de-emphasized supporting text-led composition"
        )
    },
    7: {
        "name": "WHY_US",
        "lighting": "HERO_DRAMATIC",
        "ratio": "1:1",
        "prompt": (
            "{mvd}, product elevated top-third as authoritative trophy, "
            "{lighting} intensified rim light for finality, "
            "bottom 60% clean negative space for comparison table overlay, "
            "wide composition conclusive closing aesthetic"
        )
    }
}

def build_prompt(slide_num: int, mvd: str, pts: dict) -> str:
    """Assembla il prompt completo per una slide."""
    tmpl = SLIDE_TEMPLATES[slide_num]
    lighting_desc = GLOBAL_LIGHTING[tmpl["lighting"]]
    pain = pts.get("pain_point", "common problem this product solves")
    env  = pts.get("target_persona_env", "modern minimalist workspace")

    body = tmpl["prompt"].format(
        mvd=mvd,
        lighting=lighting_desc,
        pain_point=pain,
        persona_env=env
    )
    return f"{body}. {GLOBAL_SUFFIX}"
