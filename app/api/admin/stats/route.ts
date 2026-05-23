import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stats
 * Returns: { totalUsers, totalRuns, totalSpend, cacheHitRate, last7Days, topAsins }
 * Admin-gated via requireAdmin.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;
  const { supabase } = gate;

  // Total registered users (auth.users via service role)
  let totalUsers = 0;
  try {
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    totalUsers = users.length;
  } catch { /* ignore */ }

  // Aggregate run stats
  let totalRuns = 0;
  let totalSpend = 0;
  let cacheHits = 0;
  let last7Days = 0;
  const asinCounts = new Map<string, { count: number; spend: number }>();
  try {
    const { data, error } = await supabase
      .from("mariano_runs")
      .select("asin,cache_hit,cost_usd,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!error && data) {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      for (const r of data) {
        totalRuns += 1;
        const cost = Number(r.cost_usd ?? 0);
        totalSpend += cost;
        if (r.cache_hit) cacheHits += 1;
        if (new Date(r.created_at).getTime() >= sevenDaysAgo) last7Days += 1;
        const a = String(r.asin ?? "").toUpperCase();
        if (a) {
          const cur = asinCounts.get(a) ?? { count: 0, spend: 0 };
          cur.count += 1;
          cur.spend += cost;
          asinCounts.set(a, cur);
        }
      }
    }
  } catch { /* ignore — fresh DB */ }

  const cacheHitRate = totalRuns > 0 ? Math.round((cacheHits / totalRuns) * 100) : 0;

  const topAsins = [...asinCounts.entries()]
    .map(([asin, v]) => ({ asin, count: v.count, spend: Math.round(v.spend * 100) / 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    totalUsers,
    totalRuns,
    totalSpend: Math.round(totalSpend * 100) / 100,
    cacheHitRate,
    last7Days,
    topAsins,
  });
}
