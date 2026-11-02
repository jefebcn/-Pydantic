import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cleanInventory } from "@/lib/inventory";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/inventory/[id]">) {
  const { id } = await ctx.params;
  const row = cleanInventory(await req.json().catch(() => ({})));
  if ("title" in row && !row.title) delete row.title;
  if ("purchase_cost" in row && row.purchase_cost == null) delete row.purchase_cost;
  if (!Object.keys(row).length) return NextResponse.json({ error: "Niente da aggiornare" }, { status: 400 });
  const { data, error } = await supabaseAdmin().from("inventory").update(row).eq("id", Number(id)).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/inventory/[id]">) {
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin().from("inventory").delete().eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
