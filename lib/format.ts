export const eur = (v: number | null | undefined, digits = 2) =>
  v == null || Number.isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: "always" });

export const pct = (v: number | null | undefined) => (v == null ? "—" : `${Number(v).toFixed(0)}%`);

export function ago(iso: string | null | undefined) {
  if (!iso) return "mai";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ora";
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h fa` : `${Math.round(h / 24)} g fa`;
}

export function shortCondition(c: string | null | undefined) {
  if (!c) return "—";
  return c.replace(/^usato\s*[-–]\s*/i, "").replace(/\s*condizioni\s*/i, "").trim() || c;
}

export const amazonUrl = (asin: string) => `https://www.amazon.it/dp/${asin}`;
/** Link ad Amazon dal sito: passa da /vai, che conta il clic. */
export const outUrl = (asin: string) => `/vai/${asin}?da=sito`;

export function marginTone(m: number | null | undefined) {
  if (m == null) return "text-muted";
  if (m >= 40) return "text-gain";
  if (m >= 25) return "text-amber-600";
  return "text-ink/70";
}

/** Sopra questo intervallo dall'ultimo giro lo scanner si considera fermo (a velocità lenta un ciclo dura 60 min + il giro). */
export const SCANNER_STALE_MS = 2 * 3600e3;

export function isScannerOn(lastCheck: string | null | undefined, now: number) {
  return !!lastCheck && now - new Date(lastCheck).getTime() < SCANNER_STALE_MS;
}

/** Sotto questa quota del prezzo Amazon un nuovo di altri venditori rende dubbio il riferimento (come scraper/notify.py). */
const CHEAPER_NEW = 0.95;

/** Perché il prezzo del nuovo va verificato: il margine reale può essere più basso. Null se è affidabile. */
export function refIssue(d: { new_price: number | null; new_price_any: number | null }) {
  if (d.new_price == null) return "Nuovo solo da altri venditori";
  if (d.new_price_any != null && Number(d.new_price_any) < Number(d.new_price) * CHEAPER_NEW)
    return `C'è un nuovo più economico a ${eur(d.new_price_any, 0)}`;
  return null;
}

/** Un'offerta è attiva se vista entro 6 ore dall'ultimo giro dello scanner (come LIVE_HOURS in scraper/bot.py). */
export const LIVE_MS = 6 * 3600e3;

export const CHANNEL_URL = "https://t.me/secondhandhunters";
const BOT = "https://t.me/SecondHandHunter_Bot";
/** Link al bot; `start` apre direttamente una schermata (vedi deep_link in scraper/bot.py). */
export const botLink = (start?: string) => (start ? `${BOT}?start=${start}` : BOT);

/** Miniatura Amazon (es. ..._AC_UY218_.jpg) → versione da 1000 px, come big_image in scraper/notify.py. */
export const bigImage = (url: string | null | undefined) =>
  url ? url.replace(/\._[^/]*_\.(jpg|jpeg|png|webp)$/i, "._AC_SL1000_.$1") : null;

const SCORE_CONDITIONS: [string, number][] = [["come nuovo", 20], ["ottime", 15], ["buone", 10], ["accettabil", 5]];

type Scored = {
  margin_pct: number | null; profit_eur: number | null; used_condition: string | null;
  new_price: number | null; new_price_any: number | null;
};

/**
 * Voto Hunter: un solo numero per confrontare le offerte, come hunter_score in scraper/notify.py.
 * Legge il margine di deals_v, non lo ricalcola. Da 0 a 100: margine fino a 50 punti (pieni dal 60%),
 * guadagno fino a 30 (pieni da 300 €), condizioni fino a 20. Con un prezzo del nuovo da verificare non supera 40.
 */
export function scoreParts(d: Scored) {
  const margin = (Math.max(0, Math.min(Number(d.margin_pct ?? 0), 60)) / 60) * 50;
  const profit = (Math.max(0, Math.min(Number(d.profit_eur ?? 0), 300)) / 300) * 30;
  const state = (d.used_condition ?? "").toLowerCase();
  const condition = SCORE_CONDITIONS.find(([word]) => state.includes(word))?.[1] ?? 8;
  const raw = Math.floor(margin + profit + condition + 0.5);
  const doubtful = !!refIssue(d);
  return { margin: Math.round(margin), profit: Math.round(profit), condition, doubtful, total: doubtful ? Math.min(raw, 40) : raw };
}

export const hunterScore = (d: Scored) => scoreParts(d).total;

export function scoreLabel(d: Scored) {
  const { total, doubtful } = scoreParts(d);
  if (doubtful) return "Da verificare";
  return total >= 80 ? "Affare top" : total >= 60 ? "Ottimo" : total >= 40 ? "Buono" : "Discreto";
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Fasce di prezzo Seconda Mano per raggruppare le offerte (estremo superiore escluso). */
export const PRICE_BANDS = [
  { label: "100 – 399 €", min: 0, max: 400 },
  { label: "400 – 649 €", min: 400, max: 650 },
  { label: "650 – 999 €", min: 650, max: 1000 },
  { label: "1.000 – 1.599 €", min: 1000, max: 1600 },
  { label: "1.600 – 3.000 €", min: 1600, max: 3000.01 },
  { label: "Oltre 3.000 €", min: 3000.01, max: Infinity },
];

/** Divide le offerte per fascia di prezzo usato, mantenendo l'ordine ricevuto; salta le fasce vuote. */
export function byPriceBand<T extends { used_price: number | null }>(items: T[]) {
  return PRICE_BANDS.map((b) => ({
    ...b,
    items: items.filter((d) => (d.used_price ?? 0) >= b.min && (d.used_price ?? 0) < b.max),
  })).filter((g) => g.items.length);
}
