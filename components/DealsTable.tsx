"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Thumb } from "./ui";
import { IconArrowUpRight, IconCart, IconStar, IconUndo, IconX } from "./icons";
import { useData } from "./DataProvider";
import { InventoryModal } from "./InventoryModal";
import { ScoreBadge } from "./Score";
import type { Deal, InventoryInput } from "@/lib/types";
import { ago, byPriceBand, outUrl, eur, marginTone, refIssue, shortCondition } from "@/lib/format";

function TriageBadge({ d }: { d: Deal }) {
  if (d.triage === "interessante") return <Badge tone="amber">★ Interessante</Badge>;
  if (d.triage === "acquistato") return <Badge tone="green">✓ Acquistato</Badge>;
  if (d.triage === "ignorato") return <Badge>Ignorato</Badge>;
  return null;
}

/** Il prezzo del nuovo va verificato: il margine mostrato può essere più alto di quello reale. */
function RefBadge({ d }: { d: Deal }) {
  const issue = refIssue(d);
  if (!issue) return null;
  return <span title={`${issue}: il margine reale può essere più basso`}><Badge tone="amber">⚠ Da verificare</Badge></span>;
}

export function Actions({ d, onBuy, amazon = true }: { d: Deal; onBuy: () => void; amazon?: boolean }) {
  const { setTriage, admin } = useData();
  const starred = d.triage === "interessante";
  const ignored = d.triage === "ignorato";
  return (
    <div className="flex items-center justify-end gap-1">
      {admin && (
        <>
          <Button size="icon" variant="ghost" title={starred ? "Togli da interessanti" : "Segna interessante"} aria-label={starred ? "Togli da interessanti" : "Segna interessante"}
            onClick={() => setTriage(d.asin, starred ? "da_valutare" : "interessante")}
            className={starred ? "text-amber-500" : ""}>
            <IconStar size={16} filled={starred} />
          </Button>
          <Button size="icon" variant="ghost" title={ignored ? "Ripristina" : "Ignora (niente più avvisi)"} aria-label={ignored ? "Ripristina" : "Ignora"}
            onClick={() => setTriage(d.asin, ignored ? "da_valutare" : "ignorato")}>
            {ignored ? <IconUndo size={16} /> : <IconX size={16} />}
          </Button>
          <Button size="icon" variant="soft" onClick={onBuy} disabled={d.triage === "acquistato"} title="Registra l'acquisto in magazzino" aria-label="Registra l'acquisto in magazzino">
            <IconCart size={16} />
          </Button>
        </>
      )}
      {amazon && (
        <a href={outUrl(d.asin)} target="_blank" rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full bg-ink px-3 text-xs font-semibold text-white hover:bg-ink/85">
          Amazon <IconArrowUpRight size={13} />
        </a>
      )}
    </div>
  );
}

/** Dati con cui l'acquisto di un'offerta entra in magazzino. */
export const buyInput = (d: Deal): InventoryInput => ({
  asin: d.asin, title: d.title || d.asin, image_url: d.image_url, condition: shortCondition(d.used_condition),
  list_price: d.used_price, purchase_cost: d.your_cost ?? undefined, ref_price: d.ref_price, status: "ordinato",
});

export function DealsTable({ deals }: { deals: Deal[] }) {
  const { settings } = useData();
  const [buying, setBuying] = useState<InventoryInput | null>(null);
  const buy = (d: Deal) => setBuying(buyInput(d));
  const costLabel = `Con sconto ${settings?.discount_pct ?? 22}%`;

  return (
    <>
      {/* Desktop: tabella densa */}
      <div className="hidden overflow-hidden rounded-3xl border border-line bg-white md:block">
        <table className="w-full text-sm [&_td:not(:first-child)]:whitespace-nowrap">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 pb-2 pt-4 font-medium">Prodotto</th>
              <th className="px-4 pb-2 pt-4 text-right font-medium">Seconda Mano</th>
              <th className="px-4 pb-2 pt-4 text-right font-medium">{costLabel}</th>
              <th className="px-4 pb-2 pt-4 text-right font-medium">Nuovo rif.</th>
              <th className="px-4 pb-2 pt-4 text-right font-medium">Margine</th>
              <th className="px-4 pb-2 pt-4 text-right font-medium">Guadagno</th>
              <th className="px-4 pb-2 pt-4" />
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.asin} className={`group hover:bg-soft/70 ${!d.active || d.triage === "ignorato" ? "opacity-50" : ""}`}>
                <td className="min-w-[280px] border-t border-line px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Thumb src={d.image_url} />
                    <div className="min-w-0">
                      <Link href={`/offerte/${d.asin}`} className="line-clamp-1 max-w-[42ch] font-semibold hover:underline" title={d.title || ""}>
                        {d.title || d.asin}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                        <ScoreBadge d={d} />
                        <Badge>{d.category}</Badge>
                        <span>{shortCondition(d.used_condition)}</span>
                        <span>· {ago(d.first_seen_at)}</span>
                        {!d.active && <Badge tone="red">sparita</Badge>}
                        <RefBadge d={d} />
                        <TriageBadge d={d} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="border-t border-line px-4 py-3 text-right tabular-nums">{eur(d.used_price)}</td>
                <td className="border-t border-line px-4 py-3 text-right font-semibold tabular-nums">{eur(d.your_cost)}</td>
                <td className="border-t border-line px-4 py-3 text-right tabular-nums text-muted" title={`Media 90 gg ${eur(d.avg_new_90d)} · ${d.n_checks} controlli`}>
                  {eur(d.ref_price)}
                </td>
                <td className={`border-t border-line px-4 py-3 text-right text-base font-bold tabular-nums ${marginTone(d.margin_pct)}`}>{d.margin_pct?.toFixed(0)}%</td>
                <td className="border-t border-line px-4 py-3 text-right font-semibold tabular-nums text-gain">+{eur(d.profit_eur, 0)}</td>
                <td className="border-t border-line px-4 py-3"><Actions d={d} onBuy={() => buy(d)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card compatte */}
      <div className="grid gap-2 md:hidden">
        {deals.map((d) => (
          <div key={d.asin} className={`rounded-3xl border border-line bg-white p-3.5 ${!d.active || d.triage === "ignorato" ? "opacity-50" : ""}`}>
            <div className="flex gap-3">
              <Thumb src={d.image_url} size={56} />
              <div className="min-w-0 flex-1">
                <Link href={`/offerte/${d.asin}`} className="line-clamp-2 text-sm font-medium">{d.title || d.asin}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <ScoreBadge d={d} />
                  <span>{shortCondition(d.used_condition)}</span>
                  <RefBadge d={d} />
                  <TriageBadge d={d} />
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold tabular-nums ${marginTone(d.margin_pct)}`}>{d.margin_pct?.toFixed(0)}%</div>
                <div className="text-xs font-semibold tabular-nums text-gain">+{eur(d.profit_eur, 0)}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-muted">Usato</div><div className="tabular-nums">{eur(d.used_price)}</div></div>
              <div><div className="text-muted">{costLabel}</div><div className="font-semibold tabular-nums">{eur(d.your_cost)}</div></div>
              <div><div className="text-muted">Nuovo</div><div className="tabular-nums">{eur(d.ref_price)}</div></div>
            </div>
            <div className="mt-2.5 border-t border-line pt-2.5"><Actions d={d} onBuy={() => buy(d)} /></div>
          </div>
        ))}
      </div>

      <InventoryModal item={buying} onClose={() => setBuying(null)} />
    </>
  );
}

/** Offerte divise per fascia di prezzo usato; dentro ogni fascia resta l'ordine ricevuto. */
export function DealsByBand({ deals, limit }: { deals: Deal[]; limit?: number }) {
  return (
    <div className="grid gap-6">
      {byPriceBand(deals).map((g) => (
        <section key={g.label}>
          <h3 className="mb-2.5 flex items-baseline gap-2 text-base font-bold">
            {g.label}
            <span className="text-xs font-normal text-muted">
              {limit && g.items.length > limit ? `prime ${limit} di ${g.items.length}` : `${g.items.length} offerte`}
            </span>
          </h3>
          <DealsTable deals={limit ? g.items.slice(0, limit) : g.items} />
        </section>
      ))}
    </div>
  );
}
