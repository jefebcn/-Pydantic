"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "./DataProvider";
import { ago } from "@/lib/format";

const NAV = [
  { href: "/", label: "Panoramica", icon: "◧" },
  { href: "/offerte", label: "Offerte", icon: "⚡" },
  { href: "/magazzino", label: "Magazzino", icon: "▤" },
  { href: "/impostazioni", label: "Impostazioni", icon: "⚙" },
];

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="11" fill="#fbbf24" />
      <path d="M12 22.5a8 8 0 0 1 13.7-5.6M28 17.5a8 8 0 0 1-13.7 5.6" fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" />
      <path d="M26.6 12.6v4.6H22M13.4 27.4v-4.6H18" fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScannerPill({ compact = false }: { compact?: boolean }) {
  const { scanner, loading, updatedAt } = useData();
  if (loading) return null;
  const last = scanner.last_check ? new Date(scanner.last_check).getTime() : 0;
  // confronto con l'ora dell'ultimo aggiornamento dati (si rinnova ogni minuto)
  const on = last > 0 && (updatedAt?.getTime() ?? 0) - last < 45 * 60_000;
  return (
    <div className={`flex items-center gap-2 text-xs ${compact ? "" : "rounded-xl bg-white/[0.04] px-3 py-2"}`}>
      <span className={`relative flex h-2 w-2`}>
        {on && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-red-400"}`} />
      </span>
      <span className="text-zinc-300">{on ? "Scanner attivo" : "Scanner fermo"}</span>
      {!compact && <span className="ml-auto text-zinc-500">{ago(scanner.last_check)}</span>}
    </div>
  );
}

function NotifyButton() {
  const { notifyOn, enableNotifications } = useData();
  return (
    <button
      onClick={enableNotifications}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition-colors ${
        notifyOn ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-400/15 text-amber-300 hover:bg-amber-400/25"
      }`}
    >
      🔔 {notifyOn ? "Notifiche browser attive" : "Attiva notifiche browser"}
    </button>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/[0.06] bg-zinc-950 px-4 py-5 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-3 px-1">
          <Logo />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Seconda Mano Hunter</div>
            <div className="text-[11px] text-zinc-500">× Sander Chill House</div>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive(n.href) ? "bg-white/[0.08] font-medium text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
              }`}
            >
              <span className={`w-4 text-center ${isActive(n.href) ? "text-amber-400" : ""}`}>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <NotifyButton />
          <ScannerPill />
          <p className="px-1 pt-2 text-[10px] leading-relaxed text-zinc-600">
            Gestionale arbitraggio Amazon Seconda Mano
            <br />in collaborazione con <span className="text-zinc-400">Sander Chill House</span>
          </p>
        </div>
      </aside>

      {/* Top bar mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-zinc-950/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Seconda Mano Hunter</div>
            <div className="text-[10px] text-zinc-500">× Sander Chill House</div>
          </div>
        </Link>
        <ScannerPill compact />
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">{children}</main>

      {/* Tab bar mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/[0.06] bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${isActive(n.href) ? "text-amber-400" : "text-zinc-500"}`}
          >
            <span className="text-base leading-none">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
