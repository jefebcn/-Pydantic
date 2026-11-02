"use client";

import { useEffect } from "react";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl border border-white/[0.06] bg-zinc-900/60 ${className}`}>{children}</div>;
}

export function Kpi({ label, value, hint, tone = "" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft"; size?: "sm" | "md" };
export function Button({ variant = "soft", size = "md", className = "", ...p }: BtnProps) {
  const v = {
    primary: "bg-amber-400 text-zinc-950 hover:bg-amber-300 font-semibold",
    soft: "bg-white/[0.06] text-zinc-200 hover:bg-white/[0.1]",
    ghost: "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100",
    danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
  }[variant];
  const s = size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm";
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${v} ${s} ${className}`}
    />
  );
}

export function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "amber" | "red" | "blue" | "violet" }) {
  const t = {
    zinc: "bg-white/[0.06] text-zinc-300",
    green: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-400/15 text-amber-300",
    red: "bg-red-500/15 text-red-300",
    blue: "bg-sky-500/15 text-sky-300",
    violet: "bg-violet-500/15 text-violet-300",
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}

export function Thumb({ src, size = 44 }: { src: string | null | undefined; size?: number }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-lg bg-white" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-zinc-500">📦</div>
      )}
    </div>
  );
}

export const inputCls =
  "h-9 w-full rounded-lg border border-white/[0.08] bg-zinc-950/70 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-400/60";

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-white/[0.08] bg-zinc-900 p-5 sm:max-w-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06]" aria-label="Chiudi">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center text-sm text-zinc-500">{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
            value === it.value ? "bg-amber-400 font-semibold text-zinc-950" : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
          }`}
        >
          {it.label}
          {it.count != null && <span className={`rounded px-1 text-[11px] ${value === it.value ? "bg-black/15" : "bg-white/[0.08]"}`}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
