import { supabaseAdmin } from "@/lib/supabase";
import { LIVE_MS } from "@/lib/format";
import type { Deal, PricePoint } from "@/lib/types";

export const isAsin = (s: string) => /^[A-Z0-9]{10}$/.test(s);

/** Una sola offerta. Il sito è pubblico: chi non è admin non vede le ignorate, le acquistate e le note. */
export async function fetchDeal(asin: string, admin: boolean): Promise<Deal | null> {
  const db = supabaseAdmin();
  const [row, snap, seen] = await Promise.all([
    db.from("deals_v").select("*").eq("asin", asin).maybeSingle(),
    db.from("price_snapshots").select("checked_at").order("checked_at", { ascending: false }).limit(1),
    db.from("products").select("last_seen_at").order("last_seen_at", { ascending: false }).limit(1),
  ]);
  if (row.error) throw row.error;
  if (!row.data || row.data.margin_pct == null) return null;
  const lastScan = Math.max(
    snap.data?.[0]?.checked_at ? +new Date(snap.data[0].checked_at) : 0,
    seen.data?.[0]?.last_seen_at ? +new Date(seen.data[0].last_seen_at) : 0,
  );
  const deal = { ...row.data, active: row.data.used_price != null && +new Date(row.data.last_seen_at) > lastScan - LIVE_MS } as Deal;
  if (admin) return deal;
  if (["ignorato", "acquistato"].includes(deal.triage)) return null;
  return { ...deal, triage: "da_valutare", notes: null };
}

/** Prezzi degli ultimi 90 giorni, dal più vecchio. */
export async function fetchHistory(asin: string): Promise<PricePoint[]> {
  const { data, error } = await supabaseAdmin()
    .from("price_snapshots")
    .select("checked_at,used_price,new_price,new_price_any")
    .eq("asin", asin)
    .gte("checked_at", new Date(Date.now() - 90 * 864e5).toISOString())
    .order("checked_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).reverse();
}
