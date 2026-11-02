import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseHost } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Offerte viste negli ultimi 7 giorni (attive e non), più impostazioni e stato scanner. */
export async function GET() {
  try {
    const db = supabaseAdmin();
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const [deals, settings, last] = await Promise.all([
      db
        .from("deals_v")
        .select("*")
        .not("margin_pct", "is", null)
        .gte("last_seen_at", since)
        .order("margin_pct", { ascending: false })
        .limit(1000),
      db.from("settings").select("*").eq("id", 1).single(),
      db.from("price_snapshots").select("checked_at").order("checked_at", { ascending: false }).limit(1),
    ]);
    if (deals.error) throw deals.error;
    return NextResponse.json({
      deals: deals.data,
      settings: settings.data,
      scanner: { last_check: last.data?.[0]?.checked_at ?? null },
    });
  } catch (e) {
    // il nome host (non segreto) aiuta a capire se punta al progetto Supabase giusto
    return NextResponse.json({ error: `${(e as Error).message} [db: ${supabaseHost()}]` }, { status: 500 });
  }
}
