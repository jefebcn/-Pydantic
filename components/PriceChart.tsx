"use client";

import { useState } from "react";
import type { PricePoint } from "@/lib/types";
import { eur } from "@/lib/format";

const W = 600;
const H = 170;

const newOf = (p: PricePoint) => p.new_price ?? p.new_price_any;

/** Storico dei prezzi: Seconda Mano e nuovo sullo stesso grafico (SVG, senza librerie). */
export function PriceChart({ history }: { history: PricePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = history.filter((p) => p.used_price != null);
  if (points.length < 2) {
    return (
      <p className="rounded-2xl bg-white/70 p-4 text-sm text-ink/70">
        L&apos;ho controllato una sola volta finora: il grafico si riempie ai prossimi controlli.
      </p>
    );
  }

  const times = points.map((p) => +new Date(p.checked_at));
  const values = points.flatMap((p) => [Number(p.used_price), Number(newOf(p) ?? p.used_price)]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = Math.max((high - low) * 0.12, 5);
  const span = times[times.length - 1] - times[0] || 1;
  const x = (t: number) => ((t - times[0]) / span) * W;
  const y = (v: number) => H - 6 - ((v - (low - pad)) / (high - low + 2 * pad)) * (H - 12);
  const path = (get: (p: PricePoint) => number | null | undefined) =>
    points
      .map((p, i) => ({ v: get(p), t: times[i] }))
      .filter((p) => p.v != null)
      .map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(Number(p.v)).toFixed(1)}`)
      .join(" ");

  const sel = hover ?? points.length - 1;
  const left = `${(x(times[sel]) / W) * 100}%`;
  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const at = times[0] + ((clientX - r.left) / r.width) * span;
    setHover(times.reduce((best, t, i) => (Math.abs(t - at) < Math.abs(times[best] - at) ? i : best), 0));
  };
  const when = new Date(times[sel]).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex gap-3 font-medium text-ink/70">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#4c9be8]" />Seconda Mano</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-ink/40" />Nuovo</span>
        </div>
        <div className="tabular-nums text-ink/70">
          {when}: <b className="text-ink">{eur(points[sel].used_price)}</b> · nuovo {eur(newOf(points[sel]))}
        </div>
      </div>
      <div
        className="relative touch-none select-none"
        style={{ height: H }}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-label="Andamento del prezzo">
          <path d={path(newOf)} fill="none" stroke="#17171c" strokeOpacity="0.35" strokeWidth="1.6" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          <path d={path((p) => p.used_price)} fill="none" stroke="#4c9be8" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="pointer-events-none absolute inset-y-0 border-l border-dashed border-[#4c9be8]/60" style={{ left }} />
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#4c9be8] shadow"
          style={{ left, top: `${(y(Number(points[sel].used_price)) / H) * 100}%` }}
        />
      </div>
    </div>
  );
}
