import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * GET /api/mariano-runs?limit=50&asin=B0...
 * Returns: { runs: MarianoRun[] }
 *
 * Source: Supabase table `mariano_runs`, populated by
 * api/generate_mariano_images.py at the end of every successful generation.
 * Falls back to an empty list if Supabase isn't configured — never throws.
 */
export async function GET(req: NextRequest) {
  const url   = req.nextUrl;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
  const asin  = (url.searchParams.get("asin") || "").trim().toUpperCase();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
                   ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ runs: [], reason: "supabase_not_configured" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    let q = supabase
      .from("mariano_runs")
      .select("id,asin,cache_hit,num_images_ok,num_images_failed,duration_ms,cost_usd,accent_color,palette_hex,categoria_effetto,models_used,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (asin) q = q.ilike("asin", `%${asin}%`);

    const { data, error } = await q;
    if (error) {
      // Table missing → return empty list with reason (so UI can hint setup).
      return NextResponse.json({ runs: [], reason: error.message });
    }
    return NextResponse.json({ runs: data ?? [] });
  } catch (e) {
    return NextResponse.json({ runs: [], reason: String(e) });
  }
}
