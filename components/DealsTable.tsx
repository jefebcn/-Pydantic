"use client";

import { useState } from "react";
import { Badge, Button, Thumb } from "./ui";
import { useData } from "./DataProvider";
import { InventoryModal } from "./InventoryModal";
import type { Deal, InventoryInput } from "@/lib/types";
import { ago, amazonUrl, byPriceBand, eur, marginTone, shortCondition } from "@/lib/format";

function TriageBadge({ d }: { d: Deal }) {
  if (d.triage === "interessante") return <Badge tone="amber">★ Interessante</Badge>;
  if (d.triage === "acquistato") return <Badge tone="green">✓ Acquistato</Badge>;
  if (d.triage === "ignorato") return <Badge>Ignorato</Badge>;
  return null;
}

function Actions({ d, onBuy }: { d: Deal; onBuy: () => void }) {
  const { setTriage } = useData();
  const starred = d.triage === "interessante";
  const ignored = d.triage === "ignorato";
  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant="ghost" title={starred ? "Togli da interessanti" : "Segna interessante"}
        onClick={() => setTriage(d.asin, starred ? "da_valutare" : "interessante")}
        className={starred ? "text-amber-400" : ""}>
        {starred ? "★" : "☆"}
      </Button>
      <Button size="sm" variant="ghost" title={ignored ? "Ripristina" : "Ignora (niente più avvisi)"}
        onClick={() => setTriage(d.asin, ignored ? "da_valutare" : "ignorato")}>
        {ignored ? "↺" : "✕"}
      </Button>
      <Button size="sm" variant="soft" onClick={onBuy} disabled={d.triage === "acquistato"} title="Registra l'acquisto in magazzino">
        🛒 <span className="hidden 2xl:inline">Comprato</span>
      </Button>
      <a href={amazonUrl(d.asin)} target="_blank" rel="noreferrer"
        className="inline-flex h-8 items-center whitespace-nowrap rounded-lg bg-amber-400 px-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300">
        Amazon ↗
      </a>
    </div>
  );
}

export function DealsTable({ deals }: { deals: Deal[] }) {
  const [buying, setBuying] = useState<InventoryInput | null>(null);
  const buy = (d: Deal) =>
    setBuying({
      asin: d.asin, title: d.title || d.asin, image_url: d.image_url, condition: shortCondition(d.used_condition),
      list_price: d.used_price, purchase_cost: d.your_cost ?? undefined, ref_price: d.ref_price, status: "ordinato",
    });

  return (
    <>
      {/* Desktop: tabella densa */}
      <div className="hidden overflow-hidden rounded-2xl border border-white/[0.06] md:block">
        <table className="w-full text-sm [&_td:not(:first-child)]:whitespace-nowrap">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Prodotto</th>
              <th className="px-3 py-2.5 text-right font-medium">Seconda Mano</th>
              <th className="px-3 py-2.5 text-right font-medium">Tuo costo</th>
              <th className="px-3 py-2.5 text-right font-medium">Nuovo rif.</th>
              <th className="px-3 py-2.5 text-right font-medium">Margine</th>
              <th className="px-3 py-2.5 text-right font-medium">Guadagno</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {deals.map((d) => (
              <tr key={d.asin} className={`group hover:bg-white/[0.02] ${!d.active || d.triage === "ignorato" ? "opacity-50" : ""}`}>
                <td className="min-w-[280px] px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Thumb src={d.image_url} />
                    <div className="min-w-0">
                      <a href={amazonUrl(d.asin)} target="_blank" rel="noreferrer" className="line-clamp-1 max-w-[42ch] font-medium hover:text-amber-300" title={d.title || ""}>
                        {d.title || d.asin}
                      </a>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                        <Badge>{d.category}</Badge>
                        <span>{shortCondition(d.used_condition)}</span>
                        <span>· {ago(d.first_seen_at)}</span>
                        {!d.active && <Badge tone="red">sparita</Badge>}
                        <TriageBadge d={d} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{eur(d.used_price)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-amber-300">{eur(d.your_cost)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-400" title={`Media 90 gg ${eur(d.avg_new_90d)} · ${d.n_checks} controlli`}>
                  {eur(d.ref_price)}
                </td>
                <td className={`px-3 py-2.5 text-right text-base font-bold tabular-nums ${marginTone(d.margin_pct)}`}>{d.margin_pct?.toFixed(0)}%</td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{eur(d.profit_eur, 0)}</td>
                <td className="px-3 py-2.5"><Actions d={d} onBuy={() => buy(d)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card compatte */}
      <div className="grid gap-2 md:hidden">
        {deals.map((d) => (
          <div key={d.asin} className={`rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-3 ${!d.active || d.triage === "ignorato" ? "opacity-50" : ""}`}>
            <div className="flex gap-3">
              <Thumb src={d.image_url} size={56} />
              <div className="min-w-0 flex-1">
                <a href={amazonUrl(d.asin)} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-medium">{d.title || d.asin}</a>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
                  <span>{shortCondition(d.used_condition)}</span>
                  <TriageBadge d={d} />
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold tabular-nums ${marginTone(d.margin_pct)}`}>{d.margin_pct?.toFixed(0)}%</div>
                <div className="text-xs tabular-nums text-zinc-400">{eur(d.profit_eur, 0)}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-zinc-500">Usato</div><div className="tabular-nums">{eur(d.used_price)}</div></div>
              <div><div className="text-zinc-500">Tuo costo</div><div className="font-semibold tabular-nums text-amber-300">{eur(d.your_cost)}</div></div>
              <div><div className="text-zinc-500">Nuovo</div><div className="tabular-nums">{eur(d.ref_price)}</div></div>
            </div>
            <div className="mt-2 border-t border-white/[0.05] pt-2"><Actions d={d} onBuy={() => buy(d)} /></div>
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
          <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-zinc-200">
            {g.label}
            <span className="text-xs font-normal text-zinc-500">
              {limit && g.items.length > limit ? `prime ${limit} di ${g.items.length}` : `${g.items.length} offerte`}
            </span>
          </h3>
          <DealsTable deals={limit ? g.items.slice(0, limit) : g.items} />
        </section>
      ))}
    </div>
  );
}
