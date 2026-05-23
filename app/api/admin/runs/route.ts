import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/runs?limit=200
 * Returns the full mariano_runs table (most recent first). Admin-gated.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;
  const { supabase } = gate;

  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") || "200", 10) || 200,
    1000,
  );

  try {
    const { data, error } = await supabase
      .from("mariano_runs")
      .select("id,asin,cache_hit,num_images_ok,num_images_failed,duration_ms,cost_usd,accent_color,categoria_effetto,models_used,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ runs: [], reason: error.message });
    return NextResponse.json({ runs: data ?? [] });
  } catch (e) {
    return NextResponse.json({ runs: [], reason: String(e) });
  }
}
