"use client";

import { useEffect } from "react";
import { UserControls } from "./Shell";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-3xl border border-line bg-white ${className}`}>{children}</div>;
}

/** Colori pastello delle card, come "Your Assets" del design di riferimento. */
export const PASTEL = { lilac: "bg-lilac", mint: "bg-mint", cream: "bg-cream", sky: "bg-sky", white: "bg-white border border-line" } as const;
export type Pastel = keyof typeof PASTEL;

export function Kpi({ label, value, hint, tone = "", color = "white" }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string; color?: Pastel;
}) {
  return (
    <div className={`rounded-3xl p-5 ${PASTEL[color]}`}>
      <div className="text-xs font-medium text-ink/60">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${tone}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink/55">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        <UserControls />
      </div>
      {(subtitle || actions) && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}

/** Titolo di sezione (es. "Portfolio", "Your Assets"). */
export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold tracking-tight">{children}</h2>
      {right}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" | "sky"; size?: "sm" | "md" | "icon" };
export function Button({ variant = "soft", size = "md", className = "", ...p }: BtnProps) {
  const v = {
    primary: "bg-ink text-white hover:bg-ink/85 font-semibold",
    sky: "bg-skybtn text-ink hover:bg-[#9fd1f4] font-semibold",
    soft: "border border-line bg-white text-ink hover:bg-soft",
    ghost: "text-muted hover:bg-soft hover:text-ink",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
  }[variant];
  const s = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", icon: "h-8 w-8 text-xs" }[size];
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${v} ${s} ${className}`}
    />
  );
}

export function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "amber" | "red" | "blue" | "violet" }) {
  const t = {
    zinc: "bg-soft text-muted",
    green: "bg-mint text-[#1f7a4a]",
    amber: "bg-cream text-[#8a6a12]",
    red: "bg-red-50 text-red-600",
    blue: "bg-sky text-[#2b5f93]",
    violet: "bg-lilac text-[#5b47a0]",
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}

export function Thumb({ src, size = 44, className = "" }: { src: string | null | undefined; size?: number; className?: string }) {
  return (
    <div className={`shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-line ${className}`} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-soft text-muted">📦</div>
      )}
    </div>
  );
}

export const inputCls =
  "h-10 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-ink/30";

/** Selettore a pillola (es. "24h ▾", "Top gainers ▾"). */
export function PillSelect<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <span className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 appearance-none rounded-full border border-line bg-white pl-3 pr-7 text-xs font-medium text-ink outline-none hover:bg-soft"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
    </span>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-soft" aria-label="Chiudi">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Segnaposto mentre i dati arrivano: evita di mostrare numeri a zero che sembrano veri. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-3xl bg-soft ${className}`} />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-dashed border-ink/10 bg-white p-10 text-center text-sm text-muted">{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
            value === it.value ? "bg-ink font-semibold text-white" : "border border-line bg-white text-muted hover:text-ink"
          }`}
        >
          {it.label}
          {it.count != null && <span className={`rounded-full px-1.5 text-[11px] ${value === it.value ? "bg-white/15" : "bg-soft"}`}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
