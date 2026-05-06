import aiohttp
import os

RAINFOREST_BASE = "https://api.rainforestapi.com/request"

async def scrape_asin(asin: str) -> dict:
    """Fetches product data from Rainforest API. Implemented in Step 4."""
    params = {
        "api_key": os.environ["RAINFOREST_API_KEY"],
        "type": "product",
        "asin": asin,
        "amazon_domain": "amazon.com",
        "include_summarization_attributes": "true"
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(RAINFOREST_BASE, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            data = await resp.json()

    product = data.get("product", {})
    return {
        "title": product.get("title", ""),
        "feature_bullets": product.get("feature_bullets", []),
        "specifications": {s["name"]: s["value"] for s in product.get("specifications", [])},
        "rating": str(product.get("rating", "")),
        "ratings_total": product.get("ratings_total", 0),
        "main_image": product.get("main_image", {}).get("link", ""),
        "images": [img.get("link", "") for img in product.get("images", [])],
    }

async def download_ref_images(asin: str) -> list[str]:
    """Returns list of image URLs for the product. Implemented in Step 4."""
    data = await scrape_asin(asin)
    urls = []
    if data.get("main_image"):
        urls.append(data["main_image"])
    urls.extend(data.get("images", []))
    return urls[:4]
