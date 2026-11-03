import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdmin } from "@/lib/auth";
import { supabaseAdmin, supabaseHost } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Offerte viste negli ultimi 7 giorni (attive e non), più impostazioni e stato scanner. */
export async function GET(req: NextRequest) {
  try {
    const db = supabaseAdmin();
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const [deals, settings, last, admin] = await Promise.all([
      db
        .from("deals_v")
        .select("*")
        .not("margin_pct", "is", null)
        .gte("last_seen_at", since)
        .order("margin_pct", { ascending: false })
        .limit(1000),
      db.from("settings").select("*").eq("id", 1).single(),
      db.from("price_snapshots").select("checked_at").order("checked_at", { ascending: false }).limit(1),
      isAdmin(req.cookies.get(ADMIN_COOKIE)?.value),
    ]);
    if (deals.error) throw deals.error;
    return NextResponse.json({
      deals: deals.data,
      settings: settings.data,
      admin,
      // il nome host (non segreto) mostra in Impostazioni a quale progetto Supabase è collegato il sito
      scanner: { last_check: last.data?.[0]?.checked_at ?? null, db: supabaseHost() },
    });
  } catch (e) {
    // il nome host (non segreto) aiuta a capire se punta al progetto Supabase giusto
    return NextResponse.json({ error: `${(e as Error).message} [db: ${supabaseHost()}]` }, { status: 500 });
  }
}
