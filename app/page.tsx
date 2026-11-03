"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { DealsByBand } from "@/components/DealsTable";
import { StatusBanner } from "@/components/StatusBanner";
import { TrendChart, type Point } from "@/components/TrendChart";
import { IconArrowUpRight, IconFilter, IconSend, IconStar } from "@/components/icons";
import { Badge, Card, Empty, Kpi, PageHeader, PillSelect, SectionTitle, Thumb, type Pastel } from "@/components/ui";
import { STATUS_LABEL, STATUS_ORDER, type Deal } from "@/lib/types";
import { amazonUrl, eur, marginTone, pct } from "@/lib/format";

const BOT_URL = "https://t.me/SecondHandHunter_Bot";
const TOP_COLORS: Pastel[] = ["lilac", "mint", "cream"];

type Range = "24h" | "7g";
type Sort = "profit" | "margin" | "recent";

/** Nuove offerte trovate nel tempo: 12 fasce da 2 ore (24h) o 7 giorni. */
function trend(deals: Deal[], range: Range, now: number): Point[] {
  const step = range === "24h" ? 2 * 3600e3 : 864e5;
  const n = range === "24h" ? 12 : 7;
  const start = now - n * step;
  const counts = new Array(n).fill(0);
  for (const d of deals) {
    const i = Math.floor((new Date(d.first_seen_at).getTime() - start) / step);
    if (i >= 0 && i < n) counts[i]++;
  }
  return counts.map((value, i) => {
    const t = new Date(start + (i + 1) * step);
    const label = range === "24h"
      ? `alle ${t.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
      : new Date(start + i * step).toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });
    return { label, value };
  });
}

function TopCard({ d, color }: { d: Deal; color: Pastel }) {
  const bg = { lilac: "bg-lilac", mint: "bg-mint", cream: "bg-cream", sky: "bg-sky", white: "bg-white" }[color];
  return (
    <a href={amazonUrl(d.asin)} target="_blank" rel="noreferrer"
      className={`group flex min-h-[176px] w-[72%] shrink-0 snap-start flex-col rounded-3xl p-4 sm:w-auto transition-transform hover:-translate-y-0.5 ${bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xl font-extrabold tracking-tight tabular-nums">+{eur(d.profit_eur, 0)}</div>
        <IconArrowUpRight size={16} className="mt-1 text-ink/40 group-hover:text-ink" />
      </div>
      <div className="text-xs text-ink/60 tabular-nums">Seconda Mano {eur(d.used_price, 0)}</div>
      <div className="mt-2 line-clamp-2 text-xs font-medium text-ink/80">{d.title || d.asin}</div>
      <div className="mt-auto flex items-end justify-between pt-3">
        <Thumb src={d.image_url} size={44} className="ring-0" />
        <span className="text-xs font-semibold text-ink/70 tabular-nums">{pct(d.margin_pct)}</span>
      </div>
    </a>
  );
}

function MarketTable({ deals }: { deals: Deal[] }) {
  const { admin, setTriage } = useData();
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="pb-3 font-medium">Prodotto</th>
            <th className="pb-3 text-right font-medium">Prezzo</th>
            <th className="pb-3 text-right font-medium">Margine</th>
            <th className="hidden pb-3 text-right font-medium sm:table-cell">Nuovo rif.</th>
            <th className="pb-3 text-right font-medium">Guadagno</th>
            {admin && <th className="pb-3 text-right font-medium">Segui</th>}
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => {
            const starred = d.triage === "interessante";
            return (
              <tr key={d.asin}>
                <td className="py-2 pr-3">
                  <a href={amazonUrl(d.asin)} target="_blank" rel="noreferrer" className="flex items-center gap-3">
                    <Thumb src={d.image_url} size={40} />
                    <span className="min-w-0">
                      <span className="line-clamp-1 max-w-[30ch] font-semibold hover:underline">{d.title || d.asin}</span>
                      <span className="block text-[11px] text-muted">{d.category}</span>
                    </span>
                  </a>
                </td>
                <td className="whitespace-nowrap py-2 text-right tabular-nums">{eur(d.used_price)}</td>
                <td className={`whitespace-nowrap py-2 text-right font-semibold tabular-nums ${marginTone(d.margin_pct)}`}>+{pct(d.margin_pct)}</td>
                <td className="hidden whitespace-nowrap py-2 text-right tabular-nums text-muted sm:table-cell">{eur(d.ref_price, 0)}</td>
                <td className="whitespace-nowrap py-2 text-right font-semibold tabular-nums">{eur(d.profit_eur, 0)}</td>
                {admin && (
                  <td className="py-2 text-right">
                    <button
                      onClick={() => setTriage(d.asin, starred ? "da_valutare" : "interessante")}
                      title={starred ? "Togli da interessanti" : "Segna interessante"}
                      className={`inline-flex ${starred ? "text-amber-500" : "text-ink/25 hover:text-ink/60"}`}
                    >
                      <IconStar size={18} filled={starred} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TelegramCard() {
  return (
    <div className="relative pb-4">
      <div className="absolute inset-x-5 bottom-0 h-10 rounded-3xl bg-[#e4e6ec]" />
      <div className="absolute inset-x-2.5 bottom-2 h-10 rounded-3xl bg-[#cfd2da]" />
      <div className="relative overflow-hidden rounded-3xl bg-frame p-6 text-white sm:p-7">
        <h2 className="max-w-[16ch] text-2xl font-extrabold leading-snug tracking-tight">
          Ricevi le offerte{" "}
          <span className="inline-block -rotate-3 rounded-full border-2 border-white px-2.5 text-lg leading-7">live</span>{" "}
          su Telegram!
        </h2>
        <p className="mt-3 max-w-[30ch] text-sm text-white/70">
          Il bot Seconda Mano Hunter manda foto, margine e link appena compare un affare sopra soglia.
        </p>
        <a href={BOT_URL} target="_blank" rel="noreferrer"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-skybtn px-5 text-sm font-semibold text-ink shadow-[0_8px_20px_-6px_rgba(181,220,247,0.7)] hover:bg-[#9fd1f4]">
          <IconSend size={16} /> Apri il bot
        </a>
        {/* carte decorative a filo */}
        <svg className="pointer-events-none absolute -bottom-6 -right-4 w-44 text-white/40" viewBox="0 0 180 140" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
          <rect x="40" y="30" width="120" height="80" rx="10" transform="rotate(-14 100 70)" />
          <rect x="58" y="44" width="120" height="80" rx="10" transform="rotate(-14 118 84)" />
        </svg>
      </div>
    </div>
  );
}

function AdminSummary() {
  const { inventory } = useData();
  const k = useMemo(() => {
    const inStock = inventory.filter((i) => !["venduto", "reso"].includes(i.status));
    const sold = inventory.filter((i) => i.status === "venduto");
    const month = new Date().toISOString().slice(0, 7);
    const soldMonth = sold.filter((i) => (i.sold_at ?? "").startsWith(month));
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
    return {
      capital: sum(inStock.map((i) => i.purchase_cost)),
      expected: sum(inStock.map((i) => i.expected_profit_eur ?? 0)),
      inStockCount: inStock.length,
      profit: sum(sold.map((i) => i.profit_eur ?? 0)),
      profitMonth: sum(soldMonth.map((i) => i.profit_eur ?? 0)),
      soldMonth: soldMonth.length,
      byStatus: STATUS_ORDER.map((s) => ({ s, n: inventory.filter((i) => i.status === s).length })),
      lastSales: sold.slice().sort((a, b) => (b.sold_at ?? "").localeCompare(a.sold_at ?? "")).slice(0, 4),
    };
  }, [inventory]);

  return (
    <section className="mt-10">
      <SectionTitle right={<Link href="/magazzino" className="text-sm font-medium text-muted hover:text-ink">Apri magazzino →</Link>}>
        Magazzino
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi color="sky" label="Capitale in magazzino" value={eur(k.capital, 0)} hint={`${k.inStockCount} pezzi`} />
        <Kpi color="cream" label="Profitto previsto" value={eur(k.expected, 0)} hint="sui prezzi obiettivo" />
        <Kpi color="mint" label="Profitto realizzato" value={eur(k.profit, 0)} tone={k.profit < 0 ? "text-red-600" : ""} hint={`questo mese ${eur(k.profitMonth, 0)}`} />
        <Kpi color="lilac" label="Vendite del mese" value={k.soldMonth} hint={`${k.byStatus.find((b) => b.s === "in_vendita")?.n ?? 0} in vendita ora`} />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {k.byStatus.map(({ s, n }) => (
              <Link key={s} href={`/magazzino?stato=${s}`} className="rounded-2xl bg-soft px-1 py-2.5 hover:bg-line">
                <div className="text-lg font-bold tabular-nums">{n}</div>
                <div className="truncate text-[10px] text-muted">{STATUS_LABEL[s]}</div>
              </Link>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-bold">Ultime vendite</h3>
          {k.lastSales.length === 0 ? (
            <p className="text-sm text-muted">Ancora nessuna vendita registrata.</p>
          ) : (
            <ul className="divide-y divide-line">
              {k.lastSales.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="truncate">{i.title}</span>
                  <Badge tone={(i.profit_eur ?? 0) >= 0 ? "green" : "red"}>{eur(i.profit_eur, 0)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

export default function Overview() {
  const { deals, settings, loading, updatedAt, admin } = useData();
  const [range, setRange] = useState<Range>("24h");
  const [marketRange, setMarketRange] = useState<Range>("24h");
  const [sort, setSort] = useState<Sort>("profit");

  const k = useMemo(() => {
    const live = deals.filter((d) => d.active && d.triage !== "ignorato" && d.triage !== "acquistato");
    const hot = live.filter(
      (d) => (d.margin_pct ?? 0) >= (settings?.alert_margin_pct ?? 40) && (d.profit_eur ?? 0) >= (settings?.alert_profit_eur ?? 50),
    );
    return {
      live,
      hot,
      byProfit: live.slice().sort((a, b) => (b.profit_eur ?? 0) - (a.profit_eur ?? 0)),
      hotProfit: hot.reduce((s, d) => s + (d.profit_eur ?? 0), 0),
      best: live.reduce((m, d) => Math.max(m, d.margin_pct ?? 0), 0),
    };
  }, [deals, settings]);

  const now = updatedAt?.getTime() ?? 0;
  const points = useMemo(() => (now ? trend(deals, range, now) : []), [deals, range, now]);

  const market = useMemo(() => {
    const since = now - (marketRange === "24h" ? 864e5 : 7 * 864e5);
    const by: Record<Sort, (a: Deal, b: Deal) => number> = {
      profit: (a, b) => (b.profit_eur ?? 0) - (a.profit_eur ?? 0),
      margin: (a, b) => (b.margin_pct ?? 0) - (a.margin_pct ?? 0),
      recent: (a, b) => +new Date(b.first_seen_at) - +new Date(a.first_seen_at),
    };
    const list = k.live.filter((d) => new Date(d.first_seen_at).getTime() >= since);
    return { count: list.length, rows: list.sort(by[sort]).slice(0, 6) };
  }, [k.live, marketRange, sort, now]);

  return (
    <>
      <PageHeader title="Panoramica" />
      <StatusBanner />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section>
          <SectionTitle>Andamento</SectionTitle>
          <div className="rounded-3xl bg-sky p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[28px] font-extrabold tracking-tight tabular-nums">{eur(k.hotProfit, 0)}</div>
                <div className="text-xs text-ink/60">
                  Guadagno potenziale · {k.hot.length} offerte sopra soglia su {k.live.length}
                </div>
              </div>
              <Badge tone="green">migliore {pct(k.best)}</Badge>
            </div>
            <div className="mt-9">
              <TrendChart points={points} format={(v) => `${v} nuove`} />
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold">
              {(["24h", "7g"] as Range[]).map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`rounded-full px-2.5 py-1 uppercase ${range === r ? "bg-white text-ink shadow-sm" : "text-ink/50 hover:text-ink"}`}>
                  {r}
                </button>
              ))}
              <span className="ml-auto font-normal text-ink/50">
                {updatedAt ? `aggiornato alle ${updatedAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : "caricamento…"}
              </span>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle right={<Link href="/offerte" title="Tutte le offerte con filtri" className="text-muted hover:text-ink"><IconFilter /></Link>}>
            Le migliori ora
          </SectionTitle>
          {!loading && !k.byProfit.length ? (
            <Empty>Nessuna offerta attiva. Lo scanner sul PC è acceso?</Empty>
          ) : (
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
              {k.byProfit.slice(0, 3).map((d, i) => <TopCard key={d.asin} d={d} color={TOP_COLORS[i]} />)}
            </div>
          )}
        </section>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">
              {marketRange === "24h" ? "Oggi" : "In 7 giorni"} <span className="text-gain">{market.count} nuove offerte</span>
            </h2>
            <div className="flex gap-2">
              <PillSelect value={marketRange} onChange={setMarketRange} options={[{ value: "24h", label: "24h" }, { value: "7g", label: "7 giorni" }]} />
              <PillSelect value={sort} onChange={setSort} options={[
                { value: "profit", label: "Top guadagno" },
                { value: "margin", label: "Top margine" },
                { value: "recent", label: "Più recenti" },
              ]} />
            </div>
          </div>
          {market.rows.length ? <MarketTable deals={market.rows} /> : <Empty>Nessuna offerta nuova in questo periodo.</Empty>}
        </section>
        <aside>
          <TelegramCard />
        </aside>
      </div>

      {admin && <AdminSummary />}

      <section className="mt-10">
        <SectionTitle right={<Link href="/offerte" className="text-sm font-medium text-muted hover:text-ink">Tutte le offerte →</Link>}>
          Per fascia di prezzo
        </SectionTitle>
        {!loading && !k.live.length ? null : <DealsByBand deals={k.byProfit} limit={5} />}
      </section>
    </>
  );
}
