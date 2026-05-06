import boto3
import os
import uuid
from botocore.config import Config as BotoConfig

def _r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['CLOUDFLARE_R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
        config=BotoConfig(signature_version="s3v4"),
        region_name="auto"
    )

def upload_image(img_bytes: bytes, asin: str, slide_num: int) -> str:
    """Carica PNG su R2, ritorna URL pubblico."""
    client = _r2_client()
    bucket = os.environ["CLOUDFLARE_R2_BUCKET_NAME"]
    key = f"{asin}/slide_{slide_num:02d}_{uuid.uuid4().hex[:8]}.png"

    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=img_bytes,
        ContentType="image/png",
        CacheControl="public, max-age=31536000"
    )

    base_url = os.environ["CLOUDFLARE_R2_PUBLIC_URL"].rstrip("/")
    return f"{base_url}/{key}"

def upload_all(slides_bytes: list[bytes], asin: str) -> list[str]:
    """Upload parallelo di tutte le slide. Ritorna lista URL."""
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as ex:
        futures = {
            ex.submit(upload_image, b, asin, i + 1): i
            for i, b in enumerate(slides_bytes)
        }
        urls = [""] * len(slides_bytes)
        for future in concurrent.futures.as_completed(futures):
            idx = futures[future]
            urls[idx] = future.result()
    return urls
