import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  try {
    const db = supabaseAdmin();
    let q = db
      .from("deals_v")
      .select("*")
      .not("margin_pct", "is", null)
      .order("margin_pct", { ascending: false })
      .limit(500);
    if (!all) q = q.eq("active", true);
    const [deals, settings] = await Promise.all([
      q,
      db.from("settings").select("*").eq("id", 1).single(),
    ]);
    if (deals.error) throw deals.error;
    return NextResponse.json({ deals: deals.data, settings: settings.data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
