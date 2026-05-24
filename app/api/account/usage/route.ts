import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/usage
 * Auth: any logged-in user (Bearer token or sb-* cookie).
 * Returns the caller's own API spend, computed from mariano_runs rows whose
 * user_id matches the authenticated user.
 *
 * {
 *   totalRuns, totalSpend, last30Spend, last30Runs, cacheHits,
 *   byMonth: [{ month: "2026-05", spend, runs }],
 *   recent:  [{ asin, cost_usd, created_at, cache_hit }]
 * }
 */
export async function GET(req: NextRequest) {
  const gate = await requireUser(req);
  if ("response" in gate) return gate.response;
  const { user, supabase } = gate;

  let rows: Array<{ asin: string; cost_usd: number | null; cache_hit: boolean; created_at: string }> = [];
  try {
    const { data, error } = await supabase
      .from("mariano_runs")
      .select("asin,cost_usd,cache_hit,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (!error && data) rows = data;
  } catch { /* fresh DB / missing column → empty usage */ }

  const now = Date.now();
  const THIRTY = 30 * 24 * 60 * 60 * 1000;

  let totalRuns = 0, totalSpend = 0, last30Runs = 0, last30Spend = 0, cacheHits = 0;
  const monthMap = new Map<string, { spend: number; runs: number }>();

  for (const r of rows) {
    const cost = Number(r.cost_usd ?? 0);
    totalRuns += 1;
    totalSpend += cost;
    if (r.cache_hit) cacheHits += 1;
    const ts = new Date(r.created_at).getTime();
    if (now - ts <= THIRTY) { last30Runs += 1; last30Spend += cost; }
    const month = r.created_at.slice(0, 7); // YYYY-MM
    const cur = monthMap.get(month) ?? { spend: 0, runs: 0 };
    cur.spend += cost; cur.runs += 1;
    monthMap.set(month, cur);
  }

  const byMonth = [...monthMap.entries()]
    .map(([month, v]) => ({ month, spend: Math.round(v.spend * 100) / 100, runs: v.runs }))
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .slice(0, 12);

  return NextResponse.json({
    email: user.email,
    totalRuns,
    totalSpend: Math.round(totalSpend * 100) / 100,
    last30Runs,
    last30Spend: Math.round(last30Spend * 100) / 100,
    cacheHits,
    byMonth,
    recent: rows.slice(0, 10).map((r) => ({
      asin: r.asin,
      cost_usd: Number(r.cost_usd ?? 0),
      cache_hit: r.cache_hit,
      created_at: r.created_at,
    })),
  });
}
