"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { DealsByBand, DealsTable } from "@/components/DealsTable";
import { StatusBanner } from "@/components/StatusBanner";
import { Button, Empty, PageHeader, Tabs, inputCls } from "@/components/ui";
import type { Deal } from "@/lib/types";
import { shortCondition } from "@/lib/format";

type View = "attive" | "interessanti" | "tutte" | "ignorate";

const VIEWS: Record<View, (d: Deal) => boolean> = {
  attive: (d) => d.active && d.triage !== "ignorato" && d.triage !== "acquistato",
  interessanti: (d) => d.triage === "interessante",
  tutte: () => true,
  ignorate: (d) => d.triage === "ignorato",
};

export default function OffersPage() {
  const { deals, loading, refresh } = useData();
  const [view, setView] = useState<View>("attive");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [minMargin, setMinMargin] = useState(0);
  const [sort, setSort] = useState<"margin" | "profit" | "recent" | "price">("profit");
  const [bands, setBands] = useState(true);

  const categories = useMemo(() => [...new Set(deals.map((d) => d.category).filter(Boolean))].sort() as string[], [deals]);
  const conditions = useMemo(
    () => [...new Set(deals.map((d) => shortCondition(d.used_condition)).filter((c) => c !== "—"))].sort(),
    [deals],
  );

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = deals.filter(
      (d) =>
        VIEWS[view](d) &&
        (d.margin_pct ?? -999) >= minMargin &&
        (!category || d.category === category) &&
        (!condition || shortCondition(d.used_condition) === condition) &&
        (!s || (d.title || "").toLowerCase().includes(s) || d.asin.toLowerCase().includes(s)),
    );
    const by: Record<typeof sort, (a: Deal, b: Deal) => number> = {
      margin: (a, b) => (b.margin_pct ?? 0) - (a.margin_pct ?? 0),
      profit: (a, b) => (b.profit_eur ?? 0) - (a.profit_eur ?? 0),
      recent: (a, b) => +new Date(b.first_seen_at) - +new Date(a.first_seen_at),
      price: (a, b) => (b.used_price ?? 0) - (a.used_price ?? 0),
    };
    return out.sort(by[sort]);
  }, [deals, view, q, category, condition, minMargin, sort]);

  const count = (v: View) => deals.filter(VIEWS[v]).length;

  return (
    <>
      <PageHeader
        title="Offerte"
        subtitle="Amazon Seconda Mano vs prezzo nuovo · ☆ segna interessante · ✕ ignora · 🛒 registra l'acquisto"
        actions={<Button onClick={refresh}>↻ Aggiorna</Button>}
      />
      <StatusBanner />

      <Tabs
        value={view}
        onChange={setView}
        items={[
          { value: "attive", label: "Attive", count: count("attive") },
          { value: "interessanti", label: "★ Interessanti", count: count("interessanti") },
          { value: "tutte", label: "Tutte (7 gg)", count: count("tutte") },
          { value: "ignorate", label: "Ignorate", count: count("ignorate") },
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca titolo o ASIN" className={`${inputCls} col-span-2`} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
          <option value="">Tutte le categorie</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputCls}>
          <option value="">Tutte le condizioni</option>
          {conditions.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={inputCls}>
          <option value="margin">Ordina: margine %</option>
          <option value="profit">Ordina: guadagno €</option>
          <option value="recent">Ordina: più recenti</option>
          <option value="price">Ordina: prezzo</option>
        </select>
        <label className={`${inputCls} flex items-center gap-2`}>
          <span className="whitespace-nowrap text-zinc-500">Margine ≥</span>
          <input type="number" value={minMargin} onChange={(e) => setMinMargin(Number(e.target.value))} className="w-12 bg-transparent outline-none" />%
        </label>
        <label className={`${inputCls} flex cursor-pointer items-center gap-2`}>
          <input type="checkbox" checked={bands} onChange={(e) => setBands(e.target.checked)} className="accent-amber-400" />
          <span className="whitespace-nowrap">Per fascia di prezzo</span>
        </label>
      </div>

      <p className="mb-3 text-xs text-zinc-500">{list.length} offerte</p>
      {loading ? (
        <p className="text-zinc-500">Caricamento…</p>
      ) : !list.length ? (
        <Empty>Nessuna offerta con questi filtri.</Empty>
      ) : bands ? (
        <DealsByBand deals={list} />
      ) : (
        <DealsTable deals={list} />
      )}
    </>
  );
}
