import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const FIELDS = ["discount_pct", "min_used_price", "alert_margin_pct", "alert_profit_eur"] as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const update: Record<string, number> = {};
  for (const f of FIELDS) {
    const v = Number(body[f]);
    if (Number.isFinite(v) && v >= 0) update[f] = v;
  }
  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "Nessun valore valido" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin()
    .from("settings")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
