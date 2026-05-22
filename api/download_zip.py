"""
POST /api/download-zip
Body: { "asin": "B0XXXXXXXX", "images": [ { "number": "01a", "name": "...", "image_b64": "...", "mime": "image/png" }, ... ] }
Returns: application/zip binary with the 10 images named "<asin>_<number>_<name>.png"
"""
import base64
import json
import re
import zipfile
from http.server import BaseHTTPRequestHandler
from io import BytesIO


_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def _safe_filename(asin: str, number: str, name: str, ext: str) -> str:
    """Sanitize filename: alphanumeric/dot/underscore/dash only."""
    base = f"{asin}_{number}_{name}".strip()
    base = _SAFE_NAME_RE.sub("_", base)[:120]
    return f"{base}.{ext}"


def _ext_from_mime(mime: str) -> str:
    if not mime:
        return "png"
    mime = mime.lower().strip()
    return {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
    }.get(mime, "png")


def _build_zip(asin: str, images: list[dict]) -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        used: set[str] = set()
        for img in images:
            b64 = img.get("image_b64")
            if not b64:
                continue
            try:
                raw = base64.b64decode(b64)
            except Exception:
                continue
            number = str(img.get("number", "")).strip() or "x"
            name = str(img.get("name", "")).strip() or "image"
            ext = _ext_from_mime(str(img.get("mime", "")))
            fname = _safe_filename(asin, number, name, ext)
            # de-duplicate names just in case
            dedup = fname
            i = 2
            while dedup in used:
                root = fname.rsplit(".", 1)[0]
                dedup = f"{root}_{i}.{ext}"
                i += 1
            used.add(dedup)
            zf.writestr(dedup, raw)
    return buf.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0 or length > 200 * 1024 * 1024:  # 200 MB hard cap
            self._json(400, {"error": "Payload mancante o troppo grande"})
            return
        try:
            body = json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            self._json(400, {"error": "JSON non valido"})
            return

        asin = str(body.get("asin", "")).strip().upper() or "infografiche"
        images = body.get("images") or []
        if not isinstance(images, list) or not images:
            self._json(400, {"error": "Nessuna immagine da zippare"})
            return

        valid = [i for i in images if isinstance(i, dict) and i.get("image_b64")]
        if not valid:
            self._json(400, {"error": "Nessuna immagine valida (image_b64 mancante)"})
            return

        try:
            data = _build_zip(asin, valid)
        except Exception as e:
            self._json(500, {"error": f"Errore creazione ZIP: {e}"})
            return

        filename = _safe_filename(asin, "infografiche", "10img", "zip")
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)
