"""
Test Rainforest API scraper on a real ASIN.
Usage: python scripts/test_scraper.py [ASIN]
Default ASIN: B08N5WRWNW (Echo Dot 4th Gen)
"""
import asyncio, sys, json, os
from pathlib import Path

env_file = Path(__file__).parent.parent / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, str(Path(__file__).parent.parent / "api"))
from _lib.scraper import scrape_asin

asin = sys.argv[1] if len(sys.argv) > 1 else "B08N5WRWNW"

async def main():
    print(f"Scraping ASIN: {asin}")
    data = await scrape_asin(asin)
    print(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"\nImages found: {len(data['images'])}")

asyncio.run(main())
