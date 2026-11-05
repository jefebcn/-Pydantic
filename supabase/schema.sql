-- ════════════════════════════════════════════════════════════════════
-- Seconda Mano Hunter × Sander Chill House — SETUP COMPLETO SUPABASE
--
-- Come si usa: nel nuovo progetto Supabase apri "SQL Editor" → "New query",
-- incolla TUTTO questo file e premi "Run". Puoi rilanciarlo senza problemi
-- (non cancella i dati: crea solo ciò che manca e aggiorna le viste).
-- ════════════════════════════════════════════════════════════════════


-- ── 1. IMPOSTAZIONI (una sola riga, id = 1) ─────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id               INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  discount_pct     NUMERIC(5,2)  NOT NULL DEFAULT 22,  -- vostro sconto sui prodotti venduti da Amazon
  min_used_price   NUMERIC(10,2) NOT NULL DEFAULT 100, -- prezzo minimo seconda mano
  alert_margin_pct NUMERIC(5,2)  NOT NULL DEFAULT 40,  -- soglia avviso: margine % minimo
  alert_profit_eur NUMERIC(10,2) NOT NULL DEFAULT 50,  -- soglia avviso: guadagno minimo in €
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- ── 2. PRODOTTI trovati dallo scanner ───────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  asin           TEXT PRIMARY KEY,
  title          TEXT,
  category       TEXT,             -- categoria della ricerca che l'ha trovato
  image_url      TEXT,
  triage         TEXT NOT NULL DEFAULT 'da_valutare'
                 CHECK (triage IN ('da_valutare', 'interessante', 'ignorato', 'acquistato')),
  notes          TEXT,
  first_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at   TIMESTAMPTZ DEFAULT NOW()
);
-- (se la tabella esisteva già da una versione precedente)
ALTER TABLE products ADD COLUMN IF NOT EXISTS triage TEXT NOT NULL DEFAULT 'da_valutare';
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes  TEXT;


-- ── 3. STORICO PREZZI: una riga per ogni controllo ──────────────────
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
CREATE INDEX IF NOT EXISTS idx_snap_time      ON price_snapshots (checked_at DESC);


-- ── 4. AVVISI già inviati (per non mandare doppioni su Telegram) ────
CREATE TABLE IF NOT EXISTS alerts (
  id          BIGSERIAL PRIMARY KEY,
  asin        TEXT NOT NULL REFERENCES products(asin) ON DELETE CASCADE,
  used_price  NUMERIC(10,2) NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_asin ON alerts (asin, sent_at DESC);


-- ── 5. MAGAZZINO: acquisti e rivendite ──────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id             BIGSERIAL PRIMARY KEY,
  asin           TEXT REFERENCES products(asin) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  image_url      TEXT,
  condition      TEXT,
  status         TEXT NOT NULL DEFAULT 'ordinato'
                 CHECK (status IN ('ordinato', 'ricevuto', 'in_vendita', 'venduto', 'reso')),
  purchased_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  list_price     NUMERIC(10,2),          -- prezzo Seconda Mano su Amazon (prima dello sconto)
  purchase_cost  NUMERIC(10,2) NOT NULL, -- quanto avete pagato davvero
  ref_price      NUMERIC(10,2),          -- prezzo nuovo di riferimento al momento dell'acquisto
  target_price   NUMERIC(10,2),          -- prezzo a cui volete rivendere
  channel        TEXT,                   -- eBay, Subito, Vinted, Amazon, privato…
  sale_price     NUMERIC(10,2),
  sale_fees      NUMERIC(10,2) DEFAULT 0, -- commissioni + spedizione
  sold_at        DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory (status);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_inventory_updated ON inventory;
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 6. VISTA OFFERTE: ultimo controllo + media nuovo 90 gg + margine ─
-- Unico punto in cui si calcola il margine (scanner e dashboard la leggono).
DROP VIEW IF EXISTS deals_v;
CREATE VIEW deals_v WITH (security_invoker = true) AS
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
  SELECT p.asin, p.title, p.category, p.image_url, p.triage, p.notes,
         p.first_seen_at, p.last_seen_at,
         l.checked_at, l.used_price, l.used_condition, l.new_price, l.new_price_any,
         ROUND(h.avg_new_90d, 2) AS avg_new_90d,
         h.min_used_90d, h.n_checks,
         -- riferimento: media 90 gg del nuovo, ma mai sopra il nuovo attuale (evita prezzi gonfiati)
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
       ROUND(b.ref_price - b.your_cost, 2)                         AS profit_eur,
       ROUND((1 - b.your_cost  / NULLIF(b.ref_price, 0)) * 100, 1) AS margin_pct,
       ROUND((1 - b.used_price / NULLIF(b.ref_price, 0)) * 100, 1) AS used_vs_new_pct,
       -- attiva = l'offerta compariva nella ricerca Seconda Mano nelle ultime 3 ore
       (b.used_price IS NOT NULL AND b.last_seen_at > NOW() - INTERVAL '3 hours') AS active
FROM base b;


-- ── 7. VISTA MAGAZZINO: profitto per pezzo ──────────────────────────
DROP VIEW IF EXISTS inventory_v;
CREATE VIEW inventory_v WITH (security_invoker = true) AS
SELECT i.*,
       CASE WHEN i.status = 'venduto' AND i.sale_price IS NOT NULL
            THEN ROUND(i.sale_price - COALESCE(i.sale_fees, 0) - i.purchase_cost, 2) END AS profit_eur,
       CASE WHEN i.status = 'venduto' AND i.sale_price IS NOT NULL AND i.purchase_cost > 0
            THEN ROUND((i.sale_price - COALESCE(i.sale_fees, 0) - i.purchase_cost) / i.purchase_cost * 100, 1) END AS roi_pct,
       CASE WHEN i.target_price IS NOT NULL
            THEN ROUND(i.target_price - i.purchase_cost, 2) END AS expected_profit_eur,
       (COALESCE(i.sold_at, CURRENT_DATE) - i.purchased_at) AS days_held
FROM inventory i;


-- ── 7b. CLIC verso Amazon: quante persone aprono le offerte e da dove ─
-- Nessun dato personale: solo prodotto, provenienza e ora.
CREATE TABLE IF NOT EXISTS clicks (
  id          BIGSERIAL PRIMARY KEY,
  asin        TEXT NOT NULL,
  source      TEXT NOT NULL,
  clicked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clicks_time ON clicks (clicked_at DESC);


-- ── 7c. BOT ONLINE: chi usa il bot e stato dello scanner, letti anche a PC spento ─
CREATE TABLE IF NOT EXISTS bot_users (
  chat_id     TEXT PRIMARY KEY,
  prefs       JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS app_state (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ── 8. SICUREZZA ────────────────────────────────────────────────────
-- Nessun accesso pubblico: scanner e dashboard usano la service role key lato server.
ALTER TABLE settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state       ENABLE ROW LEVEL SECURITY;


-- ── 9. MANUTENZIONE (facoltativa, da lanciare a mano ogni tanto) ────
-- Cancella lo storico prezzi più vecchio di 180 giorni:
-- DELETE FROM price_snapshots WHERE checked_at < NOW() - INTERVAL '180 days';
