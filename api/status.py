"""
GET /api/status?job_id=UUID
Returns: job status object
"""
import json
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from supabase import create_client


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        job_id = qs.get("job_id", [None])[0]

        if not job_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "job_id mancante"}).encode())
            return

        db  = create_client(
            os.environ["NEXT_PUBLIC_SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        )
        res = db.table("jobs").select("*").eq("id", job_id).execute()

        if not res.data:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Job non trovato"}).encode())
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(res.data[0]).encode())
