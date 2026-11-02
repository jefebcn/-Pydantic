import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cleanInventory } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("inventory_v")
    .select("*")
    .order("purchased_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const row = cleanInventory(await req.json().catch(() => ({})));
  if (!row.title || row.purchase_cost == null) {
    return NextResponse.json({ error: "Titolo e costo d'acquisto sono obbligatori" }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db.from("inventory").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (row.asin) await db.from("products").update({ triage: "acquistato" }).eq("asin", row.asin);
  return NextResponse.json({ item: data });
}
