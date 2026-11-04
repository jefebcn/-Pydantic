"""Grafica dei post Telegram: una card JPEG con foto del prodotto, prezzi e guadagno. Colori del sito (app/globals.css)."""
from __future__ import annotations

import io
import re
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from . import config
from .notify import eur, hunter_score, ref_warning

S = 2                # si disegna al doppio e si riduce: bordi e testi vengono puliti
W, H = 1280, 720     # misura massima che Telegram mantiene nitida
BG = "#141418"
AMBER = "#f5a623"
WHITE = "#ffffff"
MUTED = "#a4a7b2"
INK = "#17171c"
INK_SOFT = "#5c5f6b"
SKY, LILAC, MINT, GAIN = "#dceafb", "#e3dcf6", "#d6efdc", "#2f9e63"
BRAND = "SECOND HAND HUNTER"
KEEP_CHARS = "€–—‘’“”…°²³×"

FONT_DIRS = [Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/dejavu")]
FONTS = {  # il primo trovato; DejaVu per chi fa girare lo scanner su Linux
    "regular": ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"],
    "semibold": ["seguisb.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"],
    "bold": ["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"],
    "black": ["seguibl.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"],
}


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    for name in FONTS[weight]:
        for folder in FONT_DIRS:
            if (folder / name).exists():
                return ImageFont.truetype(str(folder / name), size * S)
    return ImageFont.load_default(size * S)


def clean_title(text: str) -> str:
    """Via simboli ed emoji dei titoli Amazon che il font non ha (comparirebbero come quadratini)."""
    text = unicodedata.normalize("NFKC", text)
    return " ".join("".join(c for c in text if ord(c) <= 0x24F or c in KEEP_CHARS).split())


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, width: int, max_lines: int) -> list[str]:
    """A capo per parole dentro `width`; se non ci sta tutto, l'ultima riga finisce con …"""
    lines: list[str] = []
    words = text.split()
    while words and len(lines) < max_lines:
        line = words.pop(0)
        while words and draw.textlength(f"{line} {words[0]}", font=fnt) <= width * S:
            line += f" {words.pop(0)}"
        lines.append(line)
    if words:
        last = lines[-1]
        while last and draw.textlength(f"{last}…", font=fnt) > width * S:
            last = last[:-1].rstrip()
        lines[-1] = f"{last.rstrip(' ,-–|(')}…"
    return lines


def fit(draw: ImageDraw.ImageDraw, text: str, weight: str, size: int, width: int):
    """Il font più grande (fino a `size`) con cui il testo sta in `width`."""
    while size > 16 and draw.textlength(text, font=font(weight, size)) > width * S:
        size -= 2
    return font(weight, size)


def _text(draw, xy, text, fnt, fill, anchor="la") -> None:
    draw.text((xy[0] * S, xy[1] * S), text, font=fnt, fill=fill, anchor=anchor)


def _box(draw, x, y, w, h, radius, fill) -> None:
    draw.rounded_rectangle((x * S, y * S, (x + w) * S, (y + h) * S), radius * S, fill=fill)


def base_canvas() -> Image.Image:
    """Fondo scuro con un alone ambra, come l'immagine del bot."""
    img = Image.new("RGB", (W * S, H * S), BG)
    glow = Image.new("RGB", img.size, BG)
    ImageDraw.Draw(glow).ellipse(((W - 260) * S, -240 * S, (W + 240) * S, 260 * S), fill="#5a3a0c")
    return Image.blend(img, glow.filter(ImageFilter.GaussianBlur(130 * S)), 0.75)


def _product_panel(img: Image.Image, draw, photo: bytes, condition: str, previous: str | None, score: int | None = None) -> None:
    x, y, w, h = 28, 28, 520, 664
    _box(draw, x, y, w, h, 34, WHITE)
    product = Image.open(io.BytesIO(photo)).convert("RGBA")
    product.thumbnail(((w - 64) * S, (h - 170) * S), Image.Resampling.LANCZOS)
    if product.width < (w - 64) * S * 0.6 and product.height < (h - 170) * S * 0.6:  # foto piccola: meglio più grande
        ratio = min((w - 64) * S / product.width, (h - 170) * S / product.height)
        product = product.resize((round(product.width * ratio), round(product.height * ratio)), Image.Resampling.LANCZOS)
    img.paste(product, ((x * S) + ((w * S - product.width) // 2), ((y + 70) * S) + (((h - 170) * S - product.height) // 2)), product)
    if previous:
        fnt = font("bold", 24)
        label = f"SCESO da {previous}"
        _box(draw, x + 20, y + 20, draw.textlength(label, font=fnt) / S + 36, 48, 24, AMBER)
        _text(draw, (x + 38, y + 44), label, fnt, INK, "lm")
    if score is not None:
        fnt = font("black", 24)
        label = f"VOTO {score}"
        width = draw.textlength(label, font=fnt) / S + 36
        _box(draw, x + w - 20 - width, y + 20, width, 48, 24, INK)
        _text(draw, (x + w - 20 - width / 2, y + 44), label, fnt, WHITE, "mm")
    fnt = fit(draw, condition, "semibold", 26, w - 96)
    label_w = draw.textlength(condition, font=fnt) / S + 44
    _box(draw, x + (w - label_w) / 2, y + h - 72, label_w, 50, 25, "#f0f1f5")
    _text(draw, (x + w / 2, y + h - 47), condition, fnt, INK, "mm")


def _price_card(draw, x, y, w, h, fill, label, value) -> None:
    _box(draw, x, y, w, h, 28, fill)
    _text(draw, (x + 26, y + 26), label, font("semibold", 25), INK_SOFT)
    _text(draw, (x + 26, y + h - 26), value, fit(draw, value, "black", 50, w - 52), INK, "ls")


def _profit_card(draw, x, y, w, h, profit: str, cost_note: str, margin: float) -> None:
    _box(draw, x, y, w, h, 28, MINT)
    _text(draw, (x + 30, y + 26), "Guadagno potenziale", font("semibold", 27), INK_SOFT)
    _text(draw, (x + 28, y + 150), profit, fit(draw, profit, "black", 84, w - 240), INK, "ls")
    _text(draw, (x + 30, y + h - 28), cost_note, fit(draw, cost_note, "semibold", 27, w - 240), INK_SOFT, "ls")
    # anello del margine
    size, cx, cy = 156, x + w - 110, y + h / 2
    box = ((cx - size / 2) * S, (cy - size / 2) * S, (cx + size / 2) * S, (cy + size / 2) * S)
    draw.arc(box, 0, 360, fill="#b9e0c4", width=18 * S)
    draw.arc(box, -90, -90 + 360 * max(0.0, min(margin, 100.0)) / 100, fill=GAIN, width=18 * S)
    _text(draw, (cx, cy - 8), f"{margin:.0f}%", font("black", 42), INK, "mm")
    _text(draw, (cx, cy + 30), "margine", font("semibold", 19), INK_SOFT, "mm")


def render_card(d: dict, discount_pct: float, photo: bytes, previous: float | None = None) -> bytes:
    """Card dell'offerta in JPEG; `photo` è l'immagine del prodotto già scaricata."""
    img = base_canvas()
    draw = ImageDraw.Draw(img)
    condition = re.sub(r"^usato\s*[-–]\s*", "", d.get("used_condition") or "", flags=re.I)
    _product_panel(img, draw, photo, f"Usato · {condition}" if condition else "Usato", eur(previous) if previous else None,
                   None if ref_warning(d) else hunter_score(d))

    x, right = 580, W - 28
    width = right - x
    _text(draw, (x, 40), BRAND, font("black", 25), AMBER)
    if d.get("category"):
        _text(draw, (right, 40), str(d["category"]).upper(), font("semibold", 24), MUTED, "ra")

    title_font = font("bold", 42)
    for i, line in enumerate(wrap(draw, clean_title(d.get("title") or d["asin"]), title_font, width, 3)):
        _text(draw, (x, 86 + i * 56), line, title_font, WHITE)

    gap = 16
    half = (width - gap) // 2
    _price_card(draw, x, 276, half, 164, SKY, "Seconda Mano", eur(d.get("used_price")))
    _price_card(draw, x + half + gap, 276, half, 164, LILAC, "Prezzo del nuovo", eur(d.get("ref_price")))
    _profit_card(draw, x, 456, width, 236, f"+{eur(d.get('profit_eur'), 0)}",
                 f"Con sconto {discount_pct:.0f}% paghi {eur(d.get('your_cost'))}", float(d["margin_pct"]))

    return _jpeg(img)


def _jpeg(img: Image.Image) -> bytes:
    out = io.BytesIO()
    img.resize((W, H), Image.Resampling.LANCZOS).save(out, "JPEG", quality=92, optimize=True)
    return out.getvalue()


def _rounded_paste(img: Image.Image, source: Image.Image, x: int, y: int, size: int, radius: int) -> None:
    source = source.convert("RGB").resize((size * S, size * S), Image.Resampling.LANCZOS)
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, source.width - 1, source.height - 1), radius * S, fill=255)
    img.paste(source, (x * S, y * S), mask)


def render_banner() -> bytes:
    """Copertina del bot: compare in tutte le schermate che non mostrano un'offerta."""
    img = base_canvas()
    draw = ImageDraw.Draw(img)
    _rounded_paste(img, Image.open(config.ROOT / "assets" / "bot_avatar.jpg"), 64, 60, 132, 34)
    _text(draw, (222, 62), "Second Hand Hunter", font("black", 66), WHITE)
    _text(draw, (224, 150), "Il tuo cacciatore di affari su Amazon", font("semibold", 34), AMBER)
    _text(draw, (64, 236), "Dimmi cosa cerchi e quanto vuoi spendere: al resto penso io.", font("regular", 36), MUTED)
    items = [(SKY, "Sfoglia", "Le migliori", "offerte di adesso"),
             (LILAC, "Segui", "I prezzi", "ti avviso se calano"),
             (MINT, "Su misura", "I tuoi avvisi", "budget e categorie")]
    gap, x, y, h = 22, 64, 318, 340
    w = (W - 2 * x - 2 * gap) // 3
    for i, (fill, label, big, small) in enumerate(items):
        cx = x + i * (w + gap)
        _box(draw, cx, y, w, h, 34, fill)
        _text(draw, (cx + 34, y + 36), label, fit(draw, label, "semibold", 30, w - 68), INK_SOFT)
        _text(draw, (cx + 34, y + 176), big, fit(draw, big, "black", 52, w - 68), INK, "ls")
        _text(draw, (cx + 34, y + 236), small, fit(draw, small, "semibold", 30, w - 68), INK, "ls")
    return _jpeg(img)


def render_digest(deals: list[dict], photos: dict[str, bytes], day: str) -> bytes:
    """Il meglio del giorno per il canale: fino a tre offerte una sotto l'altra. `photos` ha le foto già scaricate."""
    img = base_canvas()
    draw = ImageDraw.Draw(img)
    _text(draw, (40, 34), BRAND, font("black", 25), AMBER)
    _text(draw, (W - 40, 34), day.upper(), font("semibold", 24), MUTED, "ra")
    _text(draw, (40, 68), "Il meglio di oggi", font("black", 62), WHITE)
    x, y, w, h, gap = 28, 166, W - 56, 170, 16
    for i, d in enumerate(deals[:3]):
        top = y + i * (h + gap)
        _box(draw, x, top, w, h, 30, WHITE)
        photo = photos.get(d["asin"])
        if photo:
            product = Image.open(io.BytesIO(photo)).convert("RGBA")
            product.thumbnail(((h - 32) * S, (h - 32) * S), Image.Resampling.LANCZOS)
            img.paste(product, ((x + 20) * S + ((h - 32) * S - product.width) // 2,
                                (top + 16) * S + ((h - 32) * S - product.height) // 2), product)
        text_x = x + h + 8
        title_font = font("bold", 31)
        for j, line in enumerate(wrap(draw, clean_title(d.get("title") or d["asin"]), title_font, 620, 2)):
            _text(draw, (text_x, top + 24 + j * 42), line, title_font, INK)
        condition = re.sub(r"^usato\s*[-–]\s*", "", d.get("used_condition") or "", flags=re.I)
        note = f"Seconda Mano {eur(d.get('used_price'))}" + (f" · {condition}" if condition else "")
        _text(draw, (text_x, top + h - 28), note, fit(draw, note, "semibold", 24, 620), INK_SOFT, "ls")
        side = x + w - 244
        _box(draw, side, top + 16, 228, h - 32, 24, MINT)
        profit = f"+{eur(d.get('profit_eur'), 0)}"
        _text(draw, (side + 114, top + 66), profit, fit(draw, profit, "black", 46, 200), INK, "mm")
        _text(draw, (side + 114, top + 116), f"margine {float(d['margin_pct']):.0f}%", font("semibold", 24), INK_SOFT, "mm")
    return _jpeg(img)
