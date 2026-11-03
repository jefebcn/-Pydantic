"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/DataProvider";
import { InventoryModal } from "@/components/InventoryModal";
import { StatusBanner } from "@/components/StatusBanner";
import { Badge, Button, Empty, Kpi, PageHeader, Tabs, Thumb, inputCls } from "@/components/ui";
import { STATUS_LABEL, STATUS_ORDER, type InventoryInput, type InventoryItem, type InventoryStatus } from "@/lib/types";
import { amazonUrl, eur, todayISO } from "@/lib/format";

type Filter = "tutti" | "in_stock" | InventoryStatus;

const STATUS_TONE: Record<InventoryStatus, "blue" | "violet" | "amber" | "green" | "red"> = {
  ordinato: "blue",
  ricevuto: "violet",
  in_vendita: "amber",
  venduto: "green",
  reso: "red",
};

function exportCsv(items: InventoryItem[]) {
  const cols: (keyof InventoryItem)[] = [
    "id", "asin", "title", "condition", "status", "purchased_at", "list_price", "purchase_cost", "ref_price",
    "target_price", "channel", "sale_price", "sale_fees", "sold_at", "profit_eur", "roi_pct", "days_held", "notes",
  ];
  const esc = (v: unknown) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`);
  const csv = [cols.join(";"), ...items.map((i) => cols.map((c) => esc(i[c])).join(";"))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `magazzino-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Inventory() {
  const { inventory, loading, updateItem } = useData();
  const params = useSearchParams();
  const initial = (params.get("stato") as Filter) || "in_stock";
  const [filter, setFilter] = useState<Filter>(initial);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<(InventoryInput & { id?: number }) | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inventory.filter(
      (i) =>
        (filter === "tutti" ||
          (filter === "in_stock" ? !["venduto", "reso"].includes(i.status) : i.status === filter)) &&
        (!s || i.title.toLowerCase().includes(s) || (i.asin ?? "").toLowerCase().includes(s) || (i.channel ?? "").toLowerCase().includes(s)),
    );
  }, [inventory, filter, q]);

  const totals = useMemo(() => {
    const sum = (a: (number | null)[]) => a.reduce<number>((s, v) => s + (v ?? 0), 0);
    const sold = list.filter((i) => i.status === "venduto");
    return {
      cost: sum(list.map((i) => i.purchase_cost)),
      revenue: sum(sold.map((i) => i.sale_price)),
      profit: sum(sold.map((i) => i.profit_eur)),
      expected: sum(list.filter((i) => i.status !== "venduto").map((i) => i.expected_profit_eur)),
    };
  }, [list]);

  const changeStatus = (i: InventoryItem, status: InventoryStatus) =>
    updateItem(i.id, { status, ...(status === "venduto" && !i.sold_at ? { sold_at: todayISO() } : {}) }).then((e) => e && alert(e));

  const count = (f: Filter) =>
    inventory.filter((i) => (f === "tutti" ? true : f === "in_stock" ? !["venduto", "reso"].includes(i.status) : i.status === f)).length;

  return (
    <>
      <PageHeader
        title="Magazzino"
        subtitle="Acquisti, rivendite e profitto per pezzo"
        actions={
          <>
            <Button onClick={() => exportCsv(list)} disabled={!list.length}>⇩ CSV</Button>
            <Button variant="primary" onClick={() => setEditing({})}>＋ Nuovo acquisto</Button>
          </>
        }
      />
      <StatusBanner />

      <Tabs
        value={filter}
        onChange={setFilter}
        items={[
          { value: "in_stock", label: "In giacenza", count: count("in_stock") },
          ...STATUS_ORDER.map((s) => ({ value: s as Filter, label: STATUS_LABEL[s], count: count(s) })),
          { value: "tutti", label: "Tutti", count: count("tutti") },
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi color="sky" label="Costo pezzi" value={eur(totals.cost, 0)} />
        <Kpi color="cream" label="Profitto previsto" value={eur(totals.expected, 0)} hint="su prezzo obiettivo" />
        <Kpi color="lilac" label="Incassato" value={eur(totals.revenue, 0)} />
        <Kpi color="mint" label="Profitto reale" value={eur(totals.profit, 0)} tone={totals.profit >= 0 ? "" : "text-red-600"} />
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca prodotto, ASIN o canale" className={`${inputCls} mb-3 max-w-sm`} />

      {loading ? (
        <p className="text-muted">Caricamento…</p>
      ) : !list.length ? (
        <Empty>
          Nessun pezzo qui. Dalle <b>Offerte</b> premi il carrello su un prodotto comprato, oppure “Nuovo acquisto”.
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-soft text-left text-[11px] text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Prodotto</th>
                <th className="px-3 py-2.5 font-medium">Stato</th>
                <th className="px-3 py-2.5 text-right font-medium">Costo</th>
                <th className="px-3 py-2.5 text-right font-medium">Obiettivo</th>
                <th className="px-3 py-2.5 text-right font-medium">Venduto a</th>
                <th className="px-3 py-2.5 text-right font-medium">Profitto</th>
                <th className="px-3 py-2.5 text-right font-medium">Giorni</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((i) => (
                <tr key={i.id} className="hover:bg-soft/70">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Thumb src={i.image_url} size={40} />
                      <div className="min-w-0">
                        <button onClick={() => setEditing(i)} className="line-clamp-1 max-w-[38ch] text-left font-medium hover:underline" title={i.title}>
                          {i.title}
                        </button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                          <span>{new Date(i.purchased_at).toLocaleDateString("it-IT")}</span>
                          {i.condition && <span>· {i.condition}</span>}
                          {i.channel && <Badge>{i.channel}</Badge>}
                          {i.asin && <a href={amazonUrl(i.asin)} target="_blank" rel="noreferrer" className="font-mono hover:underline">{i.asin}</a>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[i.status]}>●</Badge>
                      <select
                        value={i.status}
                        onChange={(e) => changeStatus(i, e.target.value as InventoryStatus)}
                        className="rounded-full border border-line bg-white px-2 py-1 text-xs outline-none focus:border-ink/30"
                      >
                        {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{eur(i.purchase_cost)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{eur(i.target_price)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{eur(i.sale_price)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {i.profit_eur != null ? (
                      <span className={i.profit_eur >= 0 ? "text-gain" : "text-red-600"}>
                        {eur(i.profit_eur)} <span className="text-[11px] font-normal text-muted">({i.roi_pct?.toFixed(0)}%)</span>
                      </span>
                    ) : i.expected_profit_eur != null ? (
                      <span className="text-amber-600" title="previsto">~{eur(i.expected_profit_eur)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{i.days_held}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>Modifica</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InventoryModal item={editing} onClose={() => setEditing(null)} />
    </>
  );
}

export default function InventoryPage() {
  return (
    <Suspense>
      <Inventory />
    </Suspense>
  );
}
