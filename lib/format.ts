export const eur = (v: number | null | undefined, digits = 2) =>
  v == null || Number.isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });

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

export function marginTone(m: number | null | undefined) {
  if (m == null) return "text-zinc-400";
  if (m >= 40) return "text-emerald-400";
  if (m >= 25) return "text-amber-300";
  return "text-zinc-300";
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
