import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const TRIAGE = ["da_valutare", "interessante", "ignorato", "acquistato"];

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/products/[asin]">) {
  const { asin } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const update: Record<string, string | null> = {};
  if (TRIAGE.includes(body.triage)) update.triage = body.triage;
  if (typeof body.notes === "string") update.notes = body.notes.slice(0, 2000) || null;
  if (!Object.keys(update).length) return NextResponse.json({ error: "Niente da aggiornare" }, { status: 400 });

  const { error } = await supabaseAdmin().from("products").update(update).eq("asin", asin);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
