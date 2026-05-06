"""
Run once to apply supabase/schema.sql to your Supabase project.
Usage: python scripts/setup_db.py

Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
"""
import os
import sys
from pathlib import Path

# Load .env.local
env_file = Path(__file__).parent.parent / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

try:
    from supabase import create_client
except ImportError:
    print("Install deps first: pip install supabase")
    sys.exit(1)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)

sql_path = Path(__file__).parent.parent / "supabase" / "schema.sql"
sql = sql_path.read_text()

db = create_client(url, key)

# Execute each statement separately
statements = [s.strip() for s in sql.split(";") if s.strip()]
ok = 0
for stmt in statements:
    try:
        db.rpc("exec_sql", {"query": stmt + ";"}).execute()
        ok += 1
    except Exception as e:
        # Supabase JS client doesn't expose raw SQL — use postgrest workaround
        pass

# Alternative: use psycopg2 with direct connection
try:
    import psycopg2
    db_url = os.environ.get("DATABASE_URL") or url.replace("https://", "postgresql://postgres:").replace(".supabase.co", ".supabase.co:5432/postgres")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    conn.close()
    print("Schema applied via direct connection.")
except ImportError:
    print("Tip: pip install psycopg2-binary for direct connection support.")
    print(f"Manual alternative: paste supabase/schema.sql into Supabase SQL Editor at {url}")
except Exception as e:
    print(f"Direct connection failed: {e}")
    print(f"Manual alternative: paste supabase/schema.sql into Supabase SQL Editor at {url}")
