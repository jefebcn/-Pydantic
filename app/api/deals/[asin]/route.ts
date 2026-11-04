import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdmin } from "@/lib/auth";
import { fetchDeal, fetchHistory, isAsin } from "@/lib/deal";

export const dynamic = "force-dynamic";

/** Una sola offerta con lo storico dei prezzi, per la pagina di analisi. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ asin: string }> }) {
  const { asin } = await params;
  if (!isAsin(asin)) return NextResponse.json({ error: "Codice prodotto non valido" }, { status: 400 });
  try {
    const admin = await isAdmin(req.cookies.get(ADMIN_COOKIE)?.value);
    const deal = await fetchDeal(asin, admin);
    if (!deal) return NextResponse.json({ error: "Offerta non trovata" }, { status: 404 });
    return NextResponse.json({ deal, history: await fetchHistory(asin) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
