import aiohttp
import asyncio
import os
from typing import Any

RAINFOREST_BASE = "https://api.rainforestapi.com/request"
_RETRY_STATUS = {429, 500, 502, 503, 504}


async def scrape_asin(asin: str) -> dict[str, Any]:
    """Fetch product data from Rainforest API with retries on 429/5xx."""
    params = {
        "api_key": os.environ["RAINFOREST_API_KEY"],
        "type": "product",
        "asin": asin,
        "amazon_domain": "amazon.com",
        "include_summarization_attributes": "true",
    }

    data: dict[str, Any] | None = None
    last_err: str = ""
    async with aiohttp.ClientSession() as session:
        for attempt in range(3):
            try:
                async with session.get(
                    RAINFOREST_BASE,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        break
                    last_err = f"{resp.status}: {(await resp.text())[:200]}"
                    if resp.status not in _RETRY_STATUS:
                        raise RuntimeError(f"Rainforest API {last_err}")
            except aiohttp.ClientError as e:
                last_err = f"network: {e}"
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)

    if data is None:
        raise RuntimeError(f"Rainforest API failed after 3 attempts — {last_err}")

    if "product" not in data:
        raise RuntimeError(f"No product in Rainforest response for ASIN {asin}")

    p = data["product"]

    # Flatten specifications list → dict
    specs: dict[str, str] = {}
    for s in p.get("specifications", []) or []:
        if isinstance(s, dict) and "name" in s and "value" in s:
            specs[s["name"]] = s["value"]

    # Extract all image URLs
    images: list[str] = []
    main_img = (p.get("main_image") or {}).get("link", "")
    if main_img:
        images.append(main_img)
    for img in p.get("images", []) or []:
        url = (img or {}).get("link", "")
        if url and url not in images:
            images.append(url)

    if not images:
        raise RuntimeError(
            f"Rainforest returned no images for ASIN {asin}; cannot proceed."
        )

    return {
        "title": p.get("title", ""),
        "feature_bullets": p.get("feature_bullets", []) or [],
        "specifications": specs,
        "rating": str(p.get("rating", "")),
        "ratings_total": p.get("ratings_total", 0),
        "price": (p.get("buybox_winner") or {}).get("price", {}).get("value"),
        "brand": p.get("brand", ""),
        "main_image": main_img,
        "images": images,
    }


async def download_ref_images(asin: str) -> list[str]:
    """Return up to 4 product image URLs for the ASIN."""
    data = await scrape_asin(asin)
    return data["images"][:4]
