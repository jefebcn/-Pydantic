import os
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from concurrent.futures import ProcessPoolExecutor
from .config import cfg

FONT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "public", "fonts")

def _load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    path = os.path.join(FONT_DIR, name)
    return ImageFont.truetype(path, size)

def _composite_single(slide_num: int, img_bytes: bytes, pts: dict) -> bytes:
    """
    Worker per un singolo slide compositing.
    Aggiunge overlay di testo e icone. Eseguito in ProcessPoolExecutor.
    """
    img = Image.open(BytesIO(img_bytes)).convert("RGBA")
    W, H = img.size
    draw = ImageDraw.Draw(img)

    # Font
    font_bold   = _load_font("Inter-Bold.ttf", int(H * 0.04))
    font_reg    = _load_font("Inter-Regular.ttf", int(H * 0.025))
    font_display = _load_font("Manrope-Bold.ttf", int(H * 0.09))

    # Colori (coerenti con design system Minimal Luxury)
    WHITE     = (255, 255, 255, 230)
    GOLD      = (201, 169, 97, 255)   # #C9A961
    DARK      = (26, 26, 26, 220)

    # Testo dinamico dal PTS
    product_name  = pts.get("title", "")[:60]
    key_features  = pts.get("key_features", ["Feature 1", "Feature 2", "Feature 3"])
    rating        = pts.get("rating", "4.8")
    review_count  = pts.get("review_count", "1,000+")

    if slide_num == 1:
        # Headline top-left
        draw.text((int(W * 0.06), int(H * 0.07)), product_name,
                  font=font_bold, fill=WHITE)

    elif slide_num == 2:
        # Divider line verticale oro
        x = W // 2
        draw.line([(x, int(H * 0.05)), (x, int(H * 0.95))], fill=GOLD, width=2)
        draw.text((int(W * 0.06), int(H * 0.08)), "PROBLEMA",
                  font=font_reg, fill=(150, 150, 150, 200))
        draw.text((int(W * 0.56), int(H * 0.08)), "SOLUZIONE",
                  font=font_reg, fill=GOLD)

    elif slide_num == 3:
        # 3 callout a 10, 2, 6 del prodotto
        callout_positions = [
            (int(W * 0.08), int(H * 0.20)),
            (int(W * 0.62), int(H * 0.20)),
            (int(W * 0.35), int(H * 0.76))
        ]
        for i, (cx, cy) in enumerate(callout_positions):
            if i < len(key_features):
                draw.text((cx, cy), key_features[i],
                          font=font_bold, fill=WHITE)

    elif slide_num == 5:
        # Dimension lines (semplici linee orizzontali/verticali)
        draw.line([(int(W*0.1), int(H*0.12)), (int(W*0.9), int(H*0.12))],
                  fill=DARK, width=1)
        draw.text((int(W * 0.38), int(H * 0.07)), pts.get("width_mm", ""),
                  font=font_reg, fill=DARK)

    elif slide_num == 6:
        # Rating e review count prominenti
        draw.text((int(W * 0.08), int(H * 0.30)), f"{rating}★",
                  font=font_display, fill=DARK)
        draw.text((int(W * 0.08), int(H * 0.52)), f"{review_count} recensioni",
                  font=font_bold, fill=(100, 100, 100, 220))

    elif slide_num == 7:
        # Header tabella comparativa
        draw.text((int(W * 0.25), int(H * 0.46)), "QUESTO PRODOTTO",
                  font=font_bold, fill=GOLD)
        draw.text((int(W * 0.62), int(H * 0.46)), "CONCORRENZA",
                  font=font_bold, fill=(150, 150, 150, 200))

    # Converti in RGB per output PNG
    final = img.convert("RGB")
    final = final.resize(cfg.OUTPUT_SIZE, Image.LANCZOS)

    out = BytesIO()
    final.save(out, format="PNG", optimize=True, quality=95)
    return out.getvalue()


def composite_all_slides(
    slides_bytes: list[bytes],
    pts: dict
) -> list[bytes]:
    """
    Processa tutte le slide in parallelo con ProcessPoolExecutor.
    """
    args = [(i + 1, b, pts) for i, b in enumerate(slides_bytes) if b is not None]

    with ProcessPoolExecutor(max_workers=7) as executor:
        results = list(executor.map(lambda a: _composite_single(*a), args))

    return results
