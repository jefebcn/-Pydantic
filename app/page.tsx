"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { DealsTable } from "@/components/DealsTable";
import { StatusBanner } from "@/components/StatusBanner";
import { Badge, Card, Empty, Kpi, PageHeader } from "@/components/ui";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/types";
import { eur, pct } from "@/lib/format";

export default function Overview() {
  const { deals, inventory, settings, loading, updatedAt } = useData();

  const k = useMemo(() => {
    const live = deals.filter((d) => d.active && d.triage !== "ignorato" && d.triage !== "acquistato");
    const hot = live.filter(
      (d) => (d.margin_pct ?? 0) >= (settings?.alert_margin_pct ?? 40) && (d.profit_eur ?? 0) >= (settings?.alert_profit_eur ?? 50),
    );
    const inStock = inventory.filter((i) => !["venduto", "reso"].includes(i.status));
    const sold = inventory.filter((i) => i.status === "venduto");
    const month = new Date().toISOString().slice(0, 7);
    const soldMonth = sold.filter((i) => (i.sold_at ?? "").startsWith(month));
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
    return {
      live,
      hot,
      best: live.reduce((m, d) => Math.max(m, d.margin_pct ?? 0), 0),
      capital: sum(inStock.map((i) => i.purchase_cost)),
      expected: sum(inStock.map((i) => i.expected_profit_eur ?? 0)),
      inStockCount: inStock.length,
      profit: sum(sold.map((i) => i.profit_eur ?? 0)),
      profitMonth: sum(soldMonth.map((i) => i.profit_eur ?? 0)),
      soldMonth: soldMonth.length,
      byStatus: STATUS_ORDER.map((s) => ({ s, n: inventory.filter((i) => i.status === s).length })),
      lastSales: sold.slice().sort((a, b) => (b.sold_at ?? "").localeCompare(a.sold_at ?? "")).slice(0, 5),
    };
  }, [deals, inventory, settings]);

  return (
    <>
      <PageHeader
        title="Panoramica"
        subtitle={updatedAt ? `Aggiornato alle ${updatedAt.toLocaleTimeString("it-IT")} · si aggiorna da solo ogni minuto` : "Caricamento…"}
      />
      <StatusBanner />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Offerte attive" value={k.live.length} hint={`${k.hot.length} sopra soglia`} />
        <Kpi label="Miglior margine ora" value={pct(k.best)} tone="text-emerald-400" hint={`soglia avviso ${settings?.alert_margin_pct ?? 40}%`} />
        <Kpi label="Capitale in magazzino" value={eur(k.capital, 0)} hint={`${k.inStockCount} pezzi · previsto +${eur(k.expected, 0)}`} />
        <Kpi label="Profitto realizzato" value={eur(k.profit, 0)} tone={k.profit >= 0 ? "text-emerald-400" : "text-red-400"} hint={`questo mese ${eur(k.profitMonth, 0)} · ${k.soldMonth} vendite`} />
      </div>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">🔥 Da prendere al volo</h2>
            <Link href="/offerte" className="text-sm text-amber-400 hover:underline">Tutte le offerte →</Link>
          </div>
          {!loading && k.hot.length === 0 && k.live.length === 0 ? (
            <Empty>Nessuna offerta attiva. Lo scanner sul PC è acceso?</Empty>
          ) : (
            <DealsTable deals={(k.hot.length ? k.hot : k.live).slice(0, 8)} />
          )}
        </section>

        <aside className="grid gap-4 sm:grid-cols-2 2xl:flex 2xl:flex-col">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Magazzino</h2>
              <Link href="/magazzino" className="text-xs text-amber-400 hover:underline">Apri →</Link>
            </div>
            <div className="grid grid-cols-5 gap-1 text-center">
              {k.byStatus.map(({ s, n }) => (
                <Link key={s} href={`/magazzino?stato=${s}`} className="rounded-lg bg-white/[0.04] px-1 py-2 hover:bg-white/[0.08]">
                  <div className="text-lg font-semibold tabular-nums">{n}</div>
                  <div className="truncate text-[10px] text-zinc-500">{STATUS_LABEL[s]}</div>
                </Link>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Ultime vendite</h2>
            {k.lastSales.length === 0 ? (
              <p className="text-sm text-zinc-500">Ancora nessuna vendita registrata.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {k.lastSales.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="truncate">{i.title}</span>
                    <Badge tone={(i.profit_eur ?? 0) >= 0 ? "green" : "red"}>{eur(i.profit_eur, 0)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
