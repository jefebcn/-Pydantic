import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get("limit")  || "50"), 200);
  const offset = parseInt(searchParams.get("offset") || "0");
  const asin   = searchParams.get("asin")?.trim().toUpperCase() || "";

  let query = supabase
    .from("jobs")
    .select("id,asin,status,progress,current_step,slide_urls,qc_scores,error_message,cost_usd,duration_ms,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (asin) query = query.ilike("asin", `%${asin}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: data ?? [], total: count ?? 0 });
}
