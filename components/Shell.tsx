"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useData } from "./DataProvider";
import { IconBell, IconBox, IconChevronDown, IconGrid, IconLock, IconLogout, IconSliders, IconTag } from "./icons";
import { CHANNEL_URL, ago, botLink, isScannerOn } from "@/lib/format";

const NAV = [
  { href: "/", label: "Panoramica", Icon: IconGrid, admin: false },
  { href: "/offerte", label: "Offerte", Icon: IconTag, admin: false },
  { href: "/magazzino", label: "Magazzino", Icon: IconBox, admin: true },
  { href: "/impostazioni", label: "Impostazioni", Icon: IconSliders, admin: true },
];

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="12" fill="#f6edcd" />
      <path d="M12 22.5a8 8 0 0 1 13.7-5.6M28 17.5a8 8 0 0 1-13.7 5.6" fill="none" stroke="#17171c" strokeWidth="3" strokeLinecap="round" />
      <path d="M26.6 12.6v4.6H22M13.4 27.4v-4.6H18" fill="none" stroke="#17171c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScannerPill() {
  const { scanner, loading, updatedAt } = useData();
  if (loading) return null;
  // confronto con l'ora dell'ultimo aggiornamento dati (si rinnova ogni minuto)
  const on = isScannerOn(scanner.last_check, updatedAt?.getTime() ?? 0);
  return (
    <div className="hidden h-10 items-center gap-2 rounded-full border border-line px-3.5 text-xs md:flex" title={`Ultimo controllo: ${ago(scanner.last_check)}`}>
      <span className="relative flex h-2 w-2">
        {on && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-50" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${on ? "bg-gain" : "bg-red-500"}`} />
      </span>
      <span className="font-medium">{on ? "Scanner attivo" : "Scanner fermo"}</span>
      <span className="text-muted">{ago(scanner.last_check)}</span>
    </div>
  );
}

function NotifyBell() {
  const { notifyOn, enableNotifications } = useData();
  return (
    <button
      onClick={enableNotifications}
      title={notifyOn ? "Notifiche del browser attive su questo dispositivo" : "Attiva le notifiche del browser"}
      aria-label={notifyOn ? "Notifiche del browser attive" : "Attiva le notifiche del browser"}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line hover:bg-soft"
    >
      <IconBell size={18} />
      {!notifyOn && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
    </button>
  );
}

function ProfilePill() {
  const { admin, logout, loading } = useData();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  if (loading) return <div className="h-10 w-28 rounded-full bg-soft" />;
  if (!admin) {
    return (
      <Link href={`/accedi?next=${encodeURIComponent(path)}`} className="flex h-10 items-center gap-2 rounded-full bg-soft px-4 text-sm font-medium hover:bg-line">
        <IconLock size={16} /> Accedi
      </Link>
    );
  }
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex h-10 items-center gap-2 rounded-full bg-soft py-1 pl-1 pr-3 text-sm font-semibold hover:bg-line">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-xs font-bold">SC</span>
        Admin
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-48 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
          <div className="px-3 py-2 text-xs text-muted">Sander Chill House</div>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-soft">
            <IconLogout size={16} /> Esci
          </button>
        </div>
      )}
    </div>
  );
}

/** Icone in alto a destra di ogni pagina: stato scanner, notifiche, profilo. */
export function UserControls() {
  return (
    <div className="flex items-center gap-2">
      <ScannerPill />
      <NotifyBell />
      <ProfilePill />
    </div>
  );
}

function Footer() {
  const { settings } = useData();
  return (
    <footer className="mt-12 border-t border-line pt-5 text-xs leading-relaxed text-muted">
      <p className="max-w-[80ch]">
        Guadagni e margini sono stime: suppongono di comprare con lo sconto del {settings?.discount_pct ?? 22}% e rivendere al prezzo del nuovo,
        prima delle spese. I prezzi cambiano in fretta, controlla sempre su Amazon prima di comprare.
        Sito indipendente, non collegato ad Amazon.
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-medium">
        <a href={CHANNEL_URL} target="_blank" rel="noreferrer" className="hover:text-ink">Canale Telegram</a>
        <a href={botLink()} target="_blank" rel="noreferrer" className="hover:text-ink">Bot Telegram</a>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { admin, logout } = useData();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const nav = NAV.filter((n) => !n.admin || admin);

  return (
    <div className="min-h-dvh lg:p-6">
      <div className="mx-auto flex max-w-[1500px] lg:min-h-[calc(100dvh-3rem)] lg:rounded-[36px] lg:bg-frame lg:p-3 lg:shadow-[0_40px_80px_-40px_rgba(23,23,28,0.45)]">
        {/* Barra laterale scura, solo icone */}
        <aside className="sticky top-6 hidden h-[calc(100dvh-4.5rem)] w-[76px] shrink-0 flex-col items-center py-4 lg:flex">
          <Link href="/" title="Seconda Mano Hunter × Sander Chill House"><Logo /></Link>
          <nav className="mt-12 flex w-full flex-col items-center gap-3">
            {nav.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                aria-current={isActive(href) ? "page" : undefined}
                className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                  isActive(href) ? "bg-white/10 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {isActive(href) && <span className="absolute -left-[16px] h-6 w-[3px] rounded-r-full bg-white" />}
                <Icon />
              </Link>
            ))}
          </nav>
          <div className="mt-auto">
            {admin ? (
              <button onClick={logout} title="Esci dall'area admin" aria-label="Esci dall'area admin" className="flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
                <IconLogout />
              </button>
            ) : (
              <Link href="/accedi" title="Accedi come admin" aria-label="Accedi come admin" className="flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
                <IconLock />
              </Link>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 bg-white lg:rounded-[28px]">
          {/* Marchio su mobile */}
          <header className="flex items-center gap-2.5 px-4 pt-4 lg:hidden">
            <Logo size={32} />
            <div className="leading-tight">
              <div className="text-sm font-bold">Seconda Mano Hunter</div>
              <div className="text-[11px] text-muted">× Sander Chill House</div>
            </div>
          </header>
          <main className="px-4 pb-28 pt-5 sm:px-6 lg:px-9 lg:pb-9 lg:pt-8">{children}<Footer /></main>
        </div>
      </div>

      {/* Barra in basso su mobile */}
      <nav
        className="fixed inset-x-3 bottom-3 z-30 grid rounded-[26px] bg-frame p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-xl lg:hidden"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 rounded-[20px] py-2 text-[11px] ${isActive(href) ? "bg-white/10 text-white" : "text-zinc-500"}`}
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
