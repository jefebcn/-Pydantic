import type { Metadata } from "next";
import { DealDetail } from "@/components/DealDetail";
import { fetchDeal, isAsin } from "@/lib/deal";
import { bigImage, eur, hunterScore, pct } from "@/lib/format";

type Props = { params: Promise<{ asin: string }> };

/** Titolo e foto dell'anteprima quando il link viene condiviso (Telegram, WhatsApp…). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { asin } = await params;
  const deal = isAsin(asin) ? await fetchDeal(asin, false).catch(() => null) : null;
  if (!deal) return { title: "Offerta" };
  const title = deal.title || asin;
  const description = `Seconda Mano ${eur(deal.used_price)} · nuovo ${eur(deal.ref_price, 0)} · margine ${pct(deal.margin_pct)} · Voto Hunter ${hunterScore(deal)}/100`;
  const image = bigImage(deal.image_url);
  return { title, description, openGraph: { title, description, images: image ? [image] : undefined } };
}

export default async function DealPage({ params }: Props) {
  const { asin } = await params;
  return <DealDetail asin={asin} />;
}
