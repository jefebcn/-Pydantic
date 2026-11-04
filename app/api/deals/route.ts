import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdmin } from "@/lib/auth";
import { LIVE_MS } from "@/lib/format";
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
    const rows = deals.data ?? [];
    const lastCheck = last.data?.[0]?.checked_at ?? null;
    const lastScan = Math.max(lastCheck ? +new Date(lastCheck) : 0, ...rows.map((d) => +new Date(d.last_seen_at)));
    const fresh = rows.map((d) => ({ ...d, active: d.used_price != null && +new Date(d.last_seen_at) > lastScan - LIVE_MS }));
    return NextResponse.json({
      // il sito è pubblico: note e scelte dell'admin (ignorate, acquistate) restano riservate
      deals: admin
        ? fresh
        : fresh.filter((d) => !["ignorato", "acquistato"].includes(d.triage)).map((d) => ({ ...d, triage: "da_valutare", notes: null })),
      settings: settings.data,
      admin,
      scanner: {
        last_check: lastScan ? new Date(lastScan).toISOString() : null,
        // il nome host mostra in Impostazioni a quale progetto Supabase è collegato il sito
        ...(admin ? { db: supabaseHost() } : {}),
      },
    });
  } catch (e) {
    // il nome host (non segreto) aiuta a capire se punta al progetto Supabase giusto
    return NextResponse.json({ error: `${(e as Error).message} [db: ${supabaseHost()}]` }, { status: 500 });
  }
}
