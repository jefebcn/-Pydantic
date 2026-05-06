"""
Test MVD generator on a local image file.
Usage: python scripts/test_mvd.py path/to/image.jpg [ASIN]
"""
import asyncio, base64, json, os, sys
from pathlib import Path

env_file = Path(__file__).parent.parent / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, str(Path(__file__).parent.parent / "api"))
from _lib.mvd_generator import generate_mvd

img_path = sys.argv[1] if len(sys.argv) > 1 else None

async def main():
    if img_path:
        data = Path(img_path).read_bytes()
        images_b64 = [{"data": base64.b64encode(data).decode(), "media_type": "image/jpeg"}]
    else:
        # Minimal 1x1 white JPEG for smoke test
        import struct
        images_b64 = []
        print("No image provided — using empty image list (will test prompt flow only)")

    amazon_data = {
        "title": "Test Product",
        "feature_bullets": ["Feature A", "Feature B"],
        "specifications": {"Weight": "100g", "Color": "Black"},
    }
    pts = await generate_mvd(images_b64, amazon_data)
    print(json.dumps(pts, indent=2, ensure_ascii=False))

asyncio.run(main())
