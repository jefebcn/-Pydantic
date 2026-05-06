"""
Smoke-test: renders a 400x400 composite image using the downloaded fonts.
Usage: python scripts/test_compositor.py
Output: /tmp/compositor_test.png
"""
import sys, os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "api"))
from _lib.compositor import _composite_single

# Create a plain white 400x400 PNG in memory
from PIL import Image
from io import BytesIO

img = Image.new("RGB", (400, 400), (240, 240, 240))
buf = BytesIO()
img.save(buf, format="PNG")
img_bytes = buf.getvalue()

pts = {
    "title": "Test Product — Smoke Test",
    "key_features": ["Feature A", "Feature B", "Feature C"],
    "rating": "4.9",
    "review_count": "2,500+",
    "width_mm": "150mm",
}

for slide_num in range(1, 8):
    try:
        out = _composite_single(slide_num, img_bytes, pts)
        size_kb = len(out) // 1024
        print(f"Slide {slide_num}: OK ({size_kb}KB)")
    except Exception as e:
        print(f"Slide {slide_num}: FAILED — {e}")

# Save slide 1 for visual inspection
out = _composite_single(1, img_bytes, pts)
Path("/tmp/compositor_test.png").write_bytes(out)
print("\nSlide 1 saved to /tmp/compositor_test.png")
