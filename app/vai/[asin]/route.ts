import { NextResponse, type NextRequest } from "next/server";
import { isAsin } from "@/lib/deal";
import { amazonUrl } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SOURCES = ["canale", "bot", "avviso", "gruppo", "riepilogo", "sito"];
const NOT_A_PERSON = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|discord/i;

/**
 * Porta ad Amazon e conta il clic: quante persone aprono le offerte e da dove.
 * Nessun dato personale. Se il conteggio non riesce (tabella non ancora creata) il link funziona lo stesso.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ asin: string }> }) {
  const { asin } = await params;
  if (!isAsin(asin)) return NextResponse.redirect("https://www.amazon.it/");
  const source = req.nextUrl.searchParams.get("da") ?? "";
  if (SOURCES.includes(source) && !NOT_A_PERSON.test(req.headers.get("user-agent") ?? "")) {
    try {
      await supabaseAdmin().from("clicks").insert({ asin, source });
    } catch {
      /* il clic non contato non deve fermare chi sta andando su Amazon */
    }
  }
  return NextResponse.redirect(amazonUrl(asin));
}
