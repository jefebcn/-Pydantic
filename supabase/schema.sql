-- ════════════════════════════════════════════════════════════════════
-- Amazon Seconda Mano Hunter — schema Supabase
-- Esegui tutto nel SQL Editor di Supabase (è idempotente).
-- ════════════════════════════════════════════════════════════════════

-- Impostazioni (una sola riga, id = 1)
CREATE TABLE IF NOT EXISTS settings (
  id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 22,   -- vostro sconto sui prodotti venduti da Amazon
  min_used_price  NUMERIC(10,2) NOT NULL DEFAULT 100, -- prezzo minimo seconda mano
  alert_margin_pct NUMERIC(5,2) NOT NULL DEFAULT 40,  -- soglia avviso: margine % minimo
  alert_profit_eur NUMERIC(10,2) NOT NULL DEFAULT 50, -- soglia avviso: guadagno minimo in €
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Prodotti visti almeno una volta
CREATE TABLE IF NOT EXISTS products (
  asin           TEXT PRIMARY KEY,
  title          TEXT,
  category       TEXT,          -- parola chiave/categoria con cui è stato trovato
  image_url      TEXT,
  first_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Storico prezzi: una riga per ogni controllo
CREATE TABLE IF NOT EXISTS price_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  asin            TEXT NOT NULL REFERENCES products(asin) ON DELETE CASCADE,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_price      NUMERIC(10,2),   -- miglior prezzo Amazon Seconda Mano (NULL = nessuna offerta)
  used_condition  TEXT,            -- es. "Usato - Come nuovo"
  new_price       NUMERIC(10,2),   -- prezzo nuovo venduto da Amazon (NULL = Amazon non lo vende)
  new_price_any   NUMERIC(10,2)    -- prezzo nuovo più basso di qualsiasi venditore
);
CREATE INDEX IF NOT EXISTS idx_snap_asin_time ON price_snapshots (asin, checked_at DESC);

-- Avvisi già inviati (per non mandare doppioni)
CREATE TABLE IF NOT EXISTS alerts (
  id          BIGSERIAL PRIMARY KEY,
  asin        TEXT NOT NULL REFERENCES products(asin) ON DELETE CASCADE,
  used_price  NUMERIC(10,2) NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_asin ON alerts (asin, sent_at DESC);

-- ── Vista offerte: ultimo controllo + media prezzo nuovo 90 giorni + margine ──
CREATE OR REPLACE VIEW deals_v WITH (security_invoker = true) AS
WITH latest AS (
  SELECT DISTINCT ON (asin) *
  FROM price_snapshots
  ORDER BY asin, checked_at DESC
),
hist AS (
  SELECT asin,
         AVG(COALESCE(new_price, new_price_any)) AS avg_new_90d,
         MIN(used_price)                          AS min_used_90d,
         COUNT(*)                                 AS n_checks
  FROM price_snapshots
  WHERE checked_at > NOW() - INTERVAL '90 days'
  GROUP BY asin
),
base AS (
  SELECT p.asin, p.title, p.category, p.image_url, p.first_seen_at, p.last_seen_at,
         l.checked_at, l.used_price, l.used_condition, l.new_price, l.new_price_any,
         ROUND(h.avg_new_90d, 2) AS avg_new_90d,
         h.min_used_90d, h.n_checks,
         -- riferimento: media 90gg del nuovo, ma mai sopra il nuovo attuale (evita prezzi gonfiati)
         ROUND(LEAST(
           COALESCE(h.avg_new_90d, COALESCE(l.new_price, l.new_price_any)),
           COALESCE(l.new_price, l.new_price_any, h.avg_new_90d)
         ), 2) AS ref_price,
         ROUND(l.used_price * (1 - s.discount_pct / 100), 2) AS your_cost
  FROM products p
  JOIN latest l ON l.asin = p.asin
  LEFT JOIN hist h ON h.asin = p.asin
  CROSS JOIN settings s
)
SELECT b.*,
       ROUND(b.ref_price - b.your_cost, 2)                        AS profit_eur,
       ROUND((1 - b.your_cost / NULLIF(b.ref_price, 0)) * 100, 1) AS margin_pct,
       ROUND((1 - b.used_price / NULLIF(b.ref_price, 0)) * 100, 1) AS used_vs_new_pct,
       -- attiva = l'offerta compariva nella ricerca Seconda Mano nelle ultime 3 ore
       (b.used_price IS NOT NULL AND b.last_seen_at > NOW() - INTERVAL '3 hours') AS active
FROM base b;

-- ── Sicurezza: niente accesso pubblico. Scraper e dashboard usano la service role key lato server. ──
ALTER TABLE settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts          ENABLE ROW LEVEL SECURITY;

-- Pulizia storico oltre 180 giorni (lanciala ogni tanto, o via cron di Supabase)
-- DELETE FROM price_snapshots WHERE checked_at < NOW() - INTERVAL '180 days';
