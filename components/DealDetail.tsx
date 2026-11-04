"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useData } from "./DataProvider";
import { Actions, buyInput } from "./DealsTable";
import { InventoryModal } from "./InventoryModal";
import { PriceChart } from "./PriceChart";
import { IconArrowUpRight, IconSend } from "./icons";
import { Badge, Button, Empty, PageHeader, Skeleton, inputCls } from "./ui";
import { ScoreBadge, ScoreRing } from "./Score";
import type { Deal, InventoryInput, PricePoint } from "@/lib/types";
import { ago, amazonUrl, bigImage, botLink, eur, hunterScore, pct, refIssue, scoreLabel, scoreParts, shortCondition } from "@/lib/format";

const RESALE_PRESETS = [0.9, 0.8, 0.7];

function ScoreCard({ d }: { d: Deal }) {
  const parts = scoreParts(d);
  const rows = [
    { label: "Margine", value: parts.margin, max: 50 },
    { label: "Guadagno", value: parts.profit, max: 30 },
    { label: "Condizioni", value: parts.condition, max: 20 },
  ];
  return (
    <div className="flex items-center gap-5 rounded-3xl bg-frame p-5 text-white">
      <ScoreRing score={parts.total} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold uppercase tracking-wider text-[#f5a623]">Voto Hunter</div>
        <div className="text-lg font-extrabold tracking-tight">{scoreLabel(d)}</div>
        <div className="mt-2.5 grid gap-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-[11px] text-white/60">
              <span className="w-[68px] shrink-0">{r.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-[#f5a623]" style={{ width: `${(r.value / r.max) * 100}%` }} />
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums">{r.value}/{r.max}</span>
            </div>
          ))}
        </div>
        {parts.doubtful && <p className="mt-2 text-[11px] text-white/60">Il prezzo del nuovo è da verificare: il voto non supera 40.</p>}
      </div>
    </div>
  );
}

/** Ipotesi di rivendita fatta da chi guarda: il margine ufficiale resta quello di deals_v. */
function ResaleCalculator({ d, discount }: { d: Deal; discount: number }) {
  const ref = Number(d.ref_price ?? 0);
  const [withDiscount, setWithDiscount] = useState(true);
  const [sale, setSale] = useState(Math.round(ref * 0.8));
  const [fees, setFees] = useState(10);
  const [shipping, setShipping] = useState(0);

  const cost = Number(withDiscount ? d.your_cost : d.used_price);
  const net = sale * (1 - fees / 100) - shipping;
  const profit = net - cost;
  const roi = cost > 0 ? (profit / cost) * 100 : 0;
  const breakEven = fees < 100 ? (cost + shipping) / (1 - fees / 100) : 0;

  return (
    <div className="rounded-3xl bg-cream p-5">
      <h3 className="text-base font-bold tracking-tight">Quanto ti resta davvero?</h3>
      <p className="mt-0.5 text-xs text-ink/60">Il guadagno sopra suppone di rivendere al prezzo del nuovo. Qui provi la tua ipotesi.</p>

      <div className="mt-4 flex gap-1 rounded-full bg-white/70 p-1 text-xs font-semibold">
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => setWithDiscount(v)}
            className={`flex-1 rounded-full px-3 py-1.5 ${withDiscount === v ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>
            {v ? `Con sconto ${discount}%` : "Senza sconto"}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-medium text-ink/60" htmlFor="sale">
        Rivendo a <b className="text-base font-extrabold tabular-nums text-ink">{eur(sale, 0)}</b>
      </label>
      <input id="sale" type="range" min={0} max={Math.max(Math.round(ref), 1)} step={1} value={sale}
        onChange={(e) => setSale(Number(e.target.value))} className="mt-1.5 w-full accent-ink" />
      <div className="mt-1.5 flex gap-1.5">
        {RESALE_PRESETS.map((p) => (
          <button key={p} onClick={() => setSale(Math.round(ref * p))}
            className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium hover:bg-white">{Math.round(p * 100)}% del nuovo</button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-ink/60">
          Commissioni %
          <input type="number" min={0} max={90} value={fees} onChange={(e) => setFees(Math.min(90, Math.max(0, Number(e.target.value))))} className={`${inputCls} mt-1`} />
        </label>
        <label className="text-xs font-medium text-ink/60">
          Spedizione €
          <input type="number" min={0} value={shipping} onChange={(e) => setShipping(Math.max(0, Number(e.target.value)))} className={`${inputCls} mt-1`} />
        </label>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 rounded-2xl bg-white p-4">
        <div>
          <div className="text-xs text-ink/60">Ti resta</div>
          <div className={`text-2xl font-extrabold tracking-tight tabular-nums ${profit < 0 ? "text-red-600" : "text-gain"}`}>
            {profit >= 0 ? "+" : ""}{eur(profit, 0)}
          </div>
        </div>
        <div className="text-right text-xs text-ink/60">
          <div>Ritorno <b className="tabular-nums text-ink">{pct(roi)}</b></div>
          <div>In pari a <b className="tabular-nums text-ink">{eur(breakEven, 0)}</b></div>
        </div>
      </div>
    </div>
  );
}

function Checklist({ d, history }: { d: Deal; history: PricePoint[] }) {
  const issue = refIssue(d);
  const atLow = history.length > 1 && d.min_used_90d != null && Number(d.used_price) <= Number(d.min_used_90d);
  const items = [
    { ok: !issue, text: issue ? `${issue}: controlla il margine` : "Prezzo del nuovo venduto da Amazon e in linea col mercato" },
    { ok: d.active, text: d.active ? `Prezzo controllato ${ago(d.checked_at)}` : `Non più vista nelle ricerche: ultimo controllo ${ago(d.checked_at)}` },
    { ok: true, text: `Condizioni: ${shortCondition(d.used_condition)}. Leggi la descrizione su Amazon` },
    ...(atLow ? [{ ok: true, text: "Il prezzo è al minimo degli ultimi 90 giorni" }] : []),
  ];
  return (
    <ul className="grid gap-2 text-sm">
      {items.map((it) => (
        <li key={it.text} className="flex gap-2">
          <span aria-hidden className={it.ok ? "text-gain" : "text-amber-600"}>{it.ok ? "✓" : "⚠"}</span>
          <span>{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

function ShareButton({ d }: { d: Deal }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) return await navigator.share({ title: d.title || d.asin, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* condivisione annullata */
    }
  };
  return <Button onClick={share} className="w-full">{copied ? "✓ Link copiato" : "Condividi"}</Button>;
}

function Related({ d }: { d: Deal }) {
  const { deals } = useData();
  const list = useMemo(
    () => deals
      .filter((o) => o.asin !== d.asin && o.active && o.category === d.category && !refIssue(o))
      .sort((a, b) => hunterScore(b) - hunterScore(a))
      .slice(0, 4),
    [deals, d],
  );
  if (!list.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold tracking-tight">Altre offerte in {d.category}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {list.map((o) => (
          <Link key={o.asin} href={`/offerte/${o.asin}`} className="group rounded-3xl border border-line p-3.5 transition-colors hover:bg-soft">
            <div className="flex h-24 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {o.image_url && <img src={o.image_url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />}
            </div>
            <div className="mt-2 line-clamp-2 text-xs font-medium">{o.title || o.asin}</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-sm font-bold tabular-nums text-gain">+{eur(o.profit_eur, 0)}</span>
              <ScoreBadge d={o} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function DealDetail({ asin }: { asin: string }) {
  const { deals, settings } = useData();
  const known = deals.find((d) => d.asin === asin) ?? null;
  const [fetched, setFetched] = useState<{ asin: string; deal: Deal | null; history: PricePoint[]; error: string } | null>(null);
  const [buying, setBuying] = useState<InventoryInput | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/deals/${asin}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!live) return;
        if (r.ok) setFetched({ asin, deal: data.deal, history: data.history ?? [], error: "" });
        else setFetched({ asin, deal: null, history: [], error: r.status === 404 ? "" : data.error || r.statusText });
      })
      .catch((e) => live && setFetched({ asin, deal: null, history: [], error: (e as Error).message }));
    return () => { live = false; };
  }, [asin]);

  const data = fetched?.asin === asin ? fetched : null;
  // l'elenco si aggiorna ogni minuto e riflette le scelte dell'admin: ha la precedenza sulla prima lettura
  const d = known ?? data?.deal ?? null;
  const back = <Link href="/offerte" className="text-sm font-medium text-muted hover:text-ink">← Tutte le offerte</Link>;

  if (!d) {
    return (
      <>
        <PageHeader title="Analisi offerta" subtitle={back} />
        {!data ? <Skeleton className="h-96" />
          : data.error ? <Empty>Non riesco a leggere questa offerta: {data.error}</Empty>
          : <Empty>Questa offerta non è più disponibile. Dai un&apos;occhiata alle altre.</Empty>}
      </>
    );
  }

  const discount = Number(settings?.discount_pct ?? 22);
  const image = bigImage(d.image_url);

  return (
    <>
      <PageHeader title="Analisi offerta" subtitle={back} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="flex flex-col rounded-3xl border border-line p-5">
          <div className="flex h-64 flex-1 items-center justify-center sm:h-80 lg:h-auto lg:min-h-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {image ? <img src={image} alt={d.title || ""} className="max-h-full max-w-full object-contain lg:max-h-[420px]" /> : <span className="text-4xl">📦</span>}
          </div>
          <div className="mt-4 grid gap-2">
            <a href={amazonUrl(d.asin)} target="_blank" rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-ink text-sm font-semibold text-white hover:bg-ink/85">
              Apri su Amazon <IconArrowUpRight size={15} />
            </a>
            <div className="grid grid-cols-2 gap-2">
              <a href={botLink(`w_${d.asin}`)} target="_blank" rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-skybtn text-sm font-semibold text-ink hover:bg-[#9fd1f4]">
                <IconSend size={15} /> Avvisami se scende
              </a>
              <ShareButton d={d} />
            </div>
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {d.category && <Badge>{d.category}</Badge>}
            <Badge tone="blue">Usato · {shortCondition(d.used_condition)}</Badge>
            {!d.active && <Badge tone="red">sparita dalle ricerche</Badge>}
            {refIssue(d) && <Badge tone="amber">⚠ Da verificare</Badge>}
          </div>
          <h2 className="text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">{d.title || d.asin}</h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-sky p-4">
              <div className="text-xs font-medium text-ink/60">Seconda Mano</div>
              <div className="mt-1 text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl">{eur(d.used_price)}</div>
              <div className="mt-0.5 text-xs text-ink/60 tabular-nums">con sconto {discount}%: <b>{eur(d.your_cost)}</b></div>
            </div>
            <div className="rounded-3xl bg-lilac p-4">
              <div className="text-xs font-medium text-ink/60">Prezzo del nuovo</div>
              <div className="mt-1 text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl">{eur(d.ref_price)}</div>
              <div className="mt-0.5 text-xs text-ink/60">media di 90 giorni, mai sopra l&apos;attuale</div>
            </div>
            <div className="col-span-2 flex items-center justify-between gap-3 rounded-3xl bg-mint p-4">
              <div>
                <div className="text-xs font-medium text-ink/60">Guadagno potenziale</div>
                <div className="text-3xl font-extrabold tracking-tight tabular-nums">+{eur(d.profit_eur, 0)}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold tabular-nums">{pct(d.margin_pct)}</div>
                <div className="text-xs text-ink/60">margine</div>
              </div>
            </div>
          </div>

          <div className="mt-3"><ScoreCard d={d} /></div>
          <div className="mt-3 flex justify-end empty:hidden"><AdminBar d={d} onBuy={() => setBuying(buyInput(d))} /></div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid content-start gap-6">
          <section className="rounded-3xl bg-sky p-5">
            <h3 className="mb-3 text-base font-bold tracking-tight">Andamento del prezzo</h3>
            {data ? <PriceChart history={data.history} /> : <Skeleton className="h-44 bg-white/60" />}
          </section>
          <section className="rounded-3xl border border-line p-5">
            <h3 className="mb-3 text-base font-bold tracking-tight">Prima di comprare</h3>
            <Checklist d={d} history={data?.history ?? []} />
          </section>
        </div>
        {d.ref_price != null && <ResaleCalculator key={d.asin} d={d} discount={discount} />}
      </div>

      <Related d={d} />
      <InventoryModal item={buying} onClose={() => setBuying(null)} />
    </>
  );
}

function AdminBar({ d, onBuy }: { d: Deal; onBuy: () => void }) {
  const { admin } = useData();
  return admin ? <Actions d={d} onBuy={onBuy} amazon={false} /> : null;
}
