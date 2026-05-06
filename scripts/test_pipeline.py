"""
End-to-end pipeline dry-run (no external API calls).
Uses local mocks to verify data flow through all stages.
Usage: python scripts/test_pipeline.py
"""
import asyncio, base64, json, sys, os
from pathlib import Path
from io import BytesIO

# Set dummy env vars so modules can import
for k, v in {
    "ANTHROPIC_API_KEY": "sk-ant-test",
    "GOOGLE_AI_API_KEY": "AIza-test",
    "OPENAI_API_KEY": "sk-test",
    "RAINFOREST_API_KEY": "rf-test",
    "CLOUDFLARE_R2_ACCOUNT_ID": "test-id",
    "CLOUDFLARE_R2_ACCESS_KEY_ID": "test-key",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY": "test-secret",
    "CLOUDFLARE_R2_BUCKET_NAME": "test-bucket",
    "CLOUDFLARE_R2_PUBLIC_URL": "https://test.r2.dev",
    "NEXT_PUBLIC_SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "eyJ-test",
}.items():
    os.environ.setdefault(k, v)

sys.path.insert(0, str(Path(__file__).parent.parent / "api"))

from _lib.config import cfg
from _lib.prompts import build_prompt, SLIDE_TEMPLATES
from _lib.compositor import _composite_single

print("=== Pipeline dry-run ===\n")

# 1. Config
print(f"[1] Config OK — HAIKU={cfg.HAIKU_MODEL}  NB2={cfg.NB2_MODEL}")

# 2. Prompts
pts = {
    "pain_point": "coffee gets cold too fast",
    "target_persona_env": "home office with minimalist desk setup",
    "canonical_paragraph": "A sample product description with PBR vocabulary.",
}
for i in range(1, 8):
    p = build_prompt(i, pts["canonical_paragraph"], pts)
    print(f"[2] Slide {i} ({SLIDE_TEMPLATES[i]['name']}): prompt {len(p)} chars OK")

# 3. Compositor on all 7 slides
from PIL import Image
img = Image.new("RGB", (800, 800), (30, 30, 30))
buf = BytesIO(); img.save(buf, format="PNG"); img_bytes = buf.getvalue()
pts_full = {**pts, "title": "Test Product", "key_features": ["Feat A", "Feat B", "Feat C"],
            "rating": "4.8", "review_count": "1,200+", "width_mm": "120mm"}
for i in range(1, 8):
    out = _composite_single(i, img_bytes, pts_full)
    print(f"[3] Compositor slide {i}: {len(out)//1024}KB OK")

print("\n=== All checks passed ===")
print("\nRemaining steps requiring real credentials:")
print("  • python scripts/test_scraper.py B08N5WRWNW   (needs RAINFOREST_API_KEY)")
print("  • python scripts/test_mvd.py image.jpg        (needs ANTHROPIC_API_KEY)")
print("  • python scripts/test_r2.py                   (needs CLOUDFLARE_R2_* vars)")
print("  • python scripts/setup_db.py                  (needs SUPABASE_* vars)")
