/** Normalizza il body in arrivo per inventory (solo campi ammessi, tipi corretti). */
const NUM = ["list_price", "purchase_cost", "ref_price", "target_price", "sale_price", "sale_fees"] as const;
const TXT = ["asin", "title", "image_url", "condition", "channel", "notes"] as const;
const DATE = ["purchased_at", "sold_at"] as const;
const STATUS = ["ordinato", "ricevuto", "in_vendita", "venduto", "reso"];

export function cleanInventory(body: Record<string, unknown>) {
  const out: Record<string, string | number | null> = {};
  for (const k of NUM) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === "" || v === null) out[k] = null;
    else if (Number.isFinite(Number(v))) out[k] = Math.round(Number(v) * 100) / 100;
  }
  for (const k of TXT) {
    if (!(k in body)) continue;
    const v = body[k];
    out[k] = typeof v === "string" && v.trim() ? v.trim().slice(0, 2000) : null;
  }
  for (const k of DATE) {
    if (!(k in body)) continue;
    const v = body[k];
    out[k] = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }
  if (typeof body.status === "string" && STATUS.includes(body.status)) out.status = body.status;
  return out;
}
