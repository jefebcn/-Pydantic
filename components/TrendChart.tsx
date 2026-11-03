"use client";

import { useState } from "react";

export interface Point {
  label: string;
  value: number;
}

const W = 600;
const H = 150;

/**
 * Grafico ad area leggero (SVG, senza librerie). Il punto evidenziato è il massimo,
 * oppure quello sotto il mouse/dito; il fumetto scuro mostra il valore.
 */
export function TrendChart({ points, format }: { points: Point[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div style={{ height: H }} />;

  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 8 - (v / max) * (H - 30);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), points.length - 1);
  const sel = hover ?? peak;
  const left = `${(sel / (points.length - 1)) * 100}%`;
  const top = `${(y(points[sel].value) / H) * 100}%`;

  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setHover(Math.round(((clientX - r.left) / r.width) * (points.length - 1)));
  };

  return (
    <div
      className="relative touch-none select-none"
      style={{ height: H }}
      onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4c9be8" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#4c9be8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke="#4c9be8" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      {/* linea tratteggiata, punto e fumetto in HTML: non si deformano con la larghezza */}
      <div className="pointer-events-none absolute bottom-0 border-l border-dashed border-[#4c9be8]/60" style={{ left, top }} />
      <div className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#4c9be8] shadow" style={{ left, top }} />
      <div
        className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
        style={{ left: `clamp(48px, ${left}, calc(100% - 48px))`, top: `calc(${top} - 44px)` }}
      >
        {format(points[sel].value)}
        <span className="ml-1.5 font-normal text-white/60">{points[sel].label}</span>
      </div>
    </div>
  );
}
