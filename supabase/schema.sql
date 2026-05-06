-- Tabella prodotti: cache PTS/MVD per ASIN
CREATE TABLE IF NOT EXISTS products (
  asin            TEXT PRIMARY KEY,
  title           TEXT,
  pts_json        JSONB NOT NULL,
  mvd_text        TEXT NOT NULL,
  ref_image_urls  TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella job: stato elaborazione per polling frontend
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asin            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued',
  -- status: queued | scraping | mvd | generating | qc | compositing | done | error
  progress        INTEGER DEFAULT 0,     -- 0-100
  current_step    TEXT DEFAULT '',
  slide_urls      TEXT[] DEFAULT '{}',   -- URL R2 delle 7 slide completate
  qc_scores       JSONB DEFAULT '{}',    -- score QC per slide
  error_message   TEXT,
  cost_usd        NUMERIC(10,4),
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella runs: log storico per analytics
CREATE TABLE IF NOT EXISTS runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID REFERENCES jobs(id),
  asin            TEXT NOT NULL,
  cache_hit       BOOLEAN DEFAULT FALSE,
  total_cost_usd  NUMERIC(10,4),
  duration_ms     INTEGER,
  avg_qc_score    NUMERIC(5,2),
  retry_count     INTEGER DEFAULT 0,
  slide_urls      TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index per query frequenti
CREATE INDEX IF NOT EXISTS idx_jobs_asin    ON jobs(asin);
CREATE INDEX IF NOT EXISTS idx_jobs_status  ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_runs_asin    ON runs(asin);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
