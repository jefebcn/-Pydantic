"""
Smoke-test Cloudflare R2 upload/download.
Usage: python scripts/test_r2.py

Requires R2 credentials in .env.local
"""
import os, sys
from pathlib import Path

env_file = Path(__file__).parent.parent / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, str(Path(__file__).parent.parent / "api"))
from _lib.storage import upload_image

test_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100   # minimal fake PNG header
try:
    url = upload_image(test_png, "TEST0000001", 0)
    print(f"R2 upload OK: {url}")
except Exception as e:
    print(f"R2 upload FAILED: {e}")
    print("Check CLOUDFLARE_R2_* vars in .env.local and bucket public-access settings.")
