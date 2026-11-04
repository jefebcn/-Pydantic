"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/DataProvider";
import { DealsByBand, DealsTable } from "@/components/DealsTable";
import { StatusBanner } from "@/components/StatusBanner";
import { Button, Empty, PageHeader, Skeleton, Tabs, inputCls } from "@/components/ui";
import type { Deal } from "@/lib/types";
import { PRICE_BANDS, hunterScore, refIssue, shortCondition } from "@/lib/format";

type View = "attive" | "interessanti" | "tutte" | "ignorate";

const VIEWS: Record<View, (d: Deal) => boolean> = {
  attive: (d) => d.active && d.triage !== "ignorato" && d.triage !== "acquistato",
  interessanti: (d) => d.triage === "interessante",
  tutte: () => true,
  ignorate: (d) => d.triage === "ignorato",
};

type Sort = "score" | "margin" | "profit" | "recent" | "price";

function Offers() {
  const { deals, loading, refresh, admin } = useData();
  // i filtri stanno nell'indirizzo: tornando indietro da un'offerta restano, e si possono condividere
  const params = useSearchParams();
  const [view, setView] = useState<View>((params.get("vista") as View) in VIEWS ? (params.get("vista") as View) : "attive");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("cat") ?? "");
  const [condition, setCondition] = useState(params.get("stato") ?? "");
  const [minMargin, setMinMargin] = useState(Number(params.get("margine")) || 0);
  const [sort, setSort] = useState<Sort>((params.get("ordine") as Sort) || "score");
  const [bands, setBands] = useState(params.get("fasce") !== "0");
  const [verifiedOnly, setVerifiedOnly] = useState(params.get("verificate") === "1");
  const [budget, setBudget] = useState(Number(params.get("budget") ?? -1));

  useEffect(() => {
    const out = new URLSearchParams();
    if (view !== "attive") out.set("vista", view);
    if (q) out.set("q", q);
    if (category) out.set("cat", category);
    if (condition) out.set("stato", condition);
    if (minMargin) out.set("margine", String(minMargin));
    if (sort !== "score") out.set("ordine", sort);
    if (!bands) out.set("fasce", "0");
    if (verifiedOnly) out.set("verificate", "1");
    if (budget >= 0) out.set("budget", String(budget));
    const qs = out.toString();
    window.history.replaceState(null, "", qs ? `/offerte?${qs}` : "/offerte");
  }, [view, q, category, condition, minMargin, sort, bands, verifiedOnly, budget]);

  const categories = useMemo(() => [...new Set(deals.map((d) => d.category).filter(Boolean))].sort() as string[], [deals]);
  const conditions = useMemo(
    () => [...new Set(deals.map((d) => shortCondition(d.used_condition)).filter((c) => c !== "—"))].sort(),
    [deals],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return deals.filter(
      (d) =>
        VIEWS[view](d) &&
        (d.margin_pct ?? -999) >= minMargin &&
        (!category || d.category === category) &&
        (!condition || shortCondition(d.used_condition) === condition) &&
        (!verifiedOnly || !refIssue(d)) &&
        (!s || (d.title || "").toLowerCase().includes(s) || d.asin.toLowerCase().includes(s)),
    );
  }, [deals, view, q, category, condition, minMargin, verifiedOnly]);

  const inBand = (d: Deal, i: number) => (d.used_price ?? 0) >= PRICE_BANDS[i].min && (d.used_price ?? 0) < PRICE_BANDS[i].max;

  const list = useMemo(() => {
    const out = budget >= 0 && PRICE_BANDS[budget] ? filtered.filter((d) => inBand(d, budget)) : filtered.slice();
    const by: Record<Sort, (a: Deal, b: Deal) => number> = {
      score: (a, b) => hunterScore(b) - hunterScore(a),
      margin: (a, b) => (b.margin_pct ?? 0) - (a.margin_pct ?? 0),
      profit: (a, b) => (b.profit_eur ?? 0) - (a.profit_eur ?? 0),
      recent: (a, b) => +new Date(b.first_seen_at) - +new Date(a.first_seen_at),
      price: (a, b) => (b.used_price ?? 0) - (a.used_price ?? 0),
    };
    return out.sort(by[sort]);
  }, [filtered, budget, sort]);

  const count = (v: View) => deals.filter(VIEWS[v]).length;

  return (
    <>
      <PageHeader
        title="Offerte"
        subtitle={admin ? "Amazon Seconda Mano vs prezzo nuovo · ☆ segna interessante · ✕ ignora · carrello registra l'acquisto" : "Amazon Seconda Mano contro il prezzo del nuovo, dal voto più alto. Tocca un'offerta per l'analisi completa"}
        actions={<Button onClick={refresh}>↻ Aggiorna</Button>}
      />
      <StatusBanner />

      <Tabs
        value={view}
        onChange={setView}
        items={[
          { value: "attive", label: "Attive", count: count("attive") },
          ...(admin ? [{ value: "interessanti" as View, label: "★ Interessanti", count: count("interessanti") }] : []),
          { value: "tutte", label: "Tutte (7 gg)", count: count("tutte") },
          ...(admin ? [{ value: "ignorate" as View, label: "Ignorate", count: count("ignorate") }] : []),
        ]}
      />

      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {[{ label: "Ogni budget", i: -1, n: filtered.length }, ...PRICE_BANDS.map((b, i) => ({ label: b.label, i, n: filtered.filter((d) => inBand(d, i)).length }))]
          .filter((c) => c.n > 0 || c.i === budget || c.i === -1)
          .map((c) => (
            <button key={c.i} onClick={() => setBudget(c.i)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${budget === c.i ? "bg-sky text-ink" : "bg-soft text-muted hover:text-ink"}`}>
              {c.label} <span className="tabular-nums opacity-60">{c.n}</span>
            </button>
          ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca titolo o ASIN" className={`${inputCls} col-span-2`} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
          <option value="">Tutte le categorie</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputCls}>
          <option value="">Tutte le condizioni</option>
          {conditions.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={inputCls}>
          <option value="score">Ordina: Voto Hunter</option>
          <option value="margin">Ordina: margine %</option>
          <option value="profit">Ordina: guadagno €</option>
          <option value="recent">Ordina: più recenti</option>
          <option value="price">Ordina: prezzo</option>
        </select>
        <label className={`${inputCls} flex items-center gap-2`}>
          <span className="whitespace-nowrap text-muted">Margine ≥</span>
          <input type="number" value={minMargin} onChange={(e) => setMinMargin(Number(e.target.value))} className="w-12 bg-transparent outline-none" />%
        </label>
        <label className={`${inputCls} flex cursor-pointer items-center gap-2`}>
          <input type="checkbox" checked={bands} onChange={(e) => setBands(e.target.checked)} className="accent-ink" />
          <span className="whitespace-nowrap">Per fascia di prezzo</span>
        </label>
        <label className={`${inputCls} flex cursor-pointer items-center gap-2`} title="Nasconde le offerte col prezzo del nuovo da verificare">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="accent-ink" />
          <span className="whitespace-nowrap">Solo prezzo verificato</span>
        </label>
      </div>

      <p className="mb-3 text-xs text-muted">{list.length} offerte</p>
      {loading ? (
        <Skeleton className="h-64" />
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

export default function OffersPage() {
  return (
    <Suspense>
      <Offers />
    </Suspense>
  );
}
