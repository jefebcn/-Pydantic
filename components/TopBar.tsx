"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { LOGO_ICON_SRC } from "@/lib/brand";

/** Mariano run as returned by GET /api/mariano-runs */
interface MarianoRun {
  id: string;
  asin: string;
  cache_hit: boolean;
  num_images_ok: number;
  num_images_failed: number;
  duration_ms: number | null;
  cost_usd: number | null;
  accent_color: string | null;
  created_at: string;
}

const PAGE_LABELS: Record<string, string> = {
  "/":        "Dashboard",
  "/history": "Cronologia",
};


function relativeTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "adesso";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}


export default function TopBar() {
  const [query, setQuery]         = useState("");
  const [openPanel, setOpenPanel] = useState<"bell" | "settings" | "user" | null>(null);
  const { user, signOut } = useAuth();
  const initials = user?.user_metadata?.display_name
    ? (user.user_metadata.display_name as string).slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "AI";
  const [recentRuns, setRecentRuns]   = useState<MarianoRun[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const pageLabel = PAGE_LABELS[pathname] ?? "Dashboard";

  /* Close dropdown when clicking outside */
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  /* Fetch recent Mariano runs when bell is opened */
  const loadRecentRuns = useCallback(async () => {
    setRecentLoading(true);
    try {
      const res  = await fetch("/api/mariano-runs?limit=8");
      if (!res.ok) return;
      const data = await res.json();
      setRecentRuns(data.runs ?? []);
    } catch { /* no-op */ }
    finally { setRecentLoading(false); }
  }, []);

  const handleBellClick = () => {
    if (openPanel === "bell") { setOpenPanel(null); return; }
    setOpenPanel("bell");
    loadRecentRuns();
  };

  /* Search: ASIN or fragment → /history filtered */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    router.push(q ? `/history?asin=${encodeURIComponent(q)}` : "/history");
  };

  /* Sign out (if logged in) → close panel + go home */
  const handleSignOut = async () => {
    setSignOutBusy(true);
    try {
      await signOut();
      setOpenPanel(null);
      router.push("/");
    } finally {
      setSignOutBusy(false);
    }
  };

  /* Mobile menu open dispatcher (listened to by Sidebar) */
  const openMobileMenu = () => {
    document.dispatchEvent(new CustomEvent("toggle-sidebar"));
  };

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-3 md:gap-4 px-3 sm:px-4 md:px-6 py-2.5 md:py-3"
      style={{
        background: "rgba(250,243,243,0.85)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--border)",
        paddingTop: "max(0.625rem, env(safe-area-inset-top))",
      }}
    >
      {/* Hamburger (mobile only) */}
      <button
        onClick={openMobileMenu}
        className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ color: "var(--text-primary)", background: "var(--bg-card)", border: "1px solid var(--border)" }}
        title="Apri menu"
        aria-label="Apri menu"
      >
        <HamburgerIcon />
      </button>

      {/* Brand — PYDANTIC logo + wordmark */}
      <Link href="/" className="shrink-0 flex items-center gap-2.5 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_ICON_SRC} alt="" width={36} height={36}
          className="w-9 h-9 rounded-lg shrink-0"
          style={{
            border: "1px solid var(--border)",
            boxShadow: "0 2px 10px rgba(30,63,217,0.08)",
          }} />
        <div className="leading-tight">
          <p className="font-black tracking-[0.18em] text-base sm:text-lg"
            style={{ color: "var(--brand)" }}>
            PYDANTIC
          </p>
          <p className="text-[9px] sm:text-[10px] font-semibold tracking-widest uppercase -mt-0.5"
            style={{ color: "var(--text-muted)" }}>
            {pageLabel}
          </p>
        </div>
      </Link>

      {/* Search (desktop only — on mobile the bell already opens recent runs) */}
      <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-sm mx-auto relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
          <SearchIcon />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca ASIN o frammento…"
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none transition-all"
          style={{
            background: "rgba(30,63,217,0.05)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(30,63,217,0.5)")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </form>

      {/* Spacer for mobile (pushes actions to the right) */}
      <div className="flex-1 md:hidden" />

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0" ref={panelRef}>

        {/* Info / guida button + dropdown */}
        <div className="relative">
          <TopBarBtn
            title="Guida & info"
            active={openPanel === "settings"}
            onClick={() => setOpenPanel(openPanel === "settings" ? null : "settings")}
          >
            <InfoIcon />
          </TopBarBtn>

          {openPanel === "settings" && (
            <Dropdown align="right" width={300}>
              <DropdownHeader title="Come funziona" subtitle="Da ASIN a 10 infografiche in 3 passi" />

              {/* 3-step quick guide */}
              <div className="flex flex-col gap-2 p-3">
                {[
                  { n: "1", t: "Inserisci l'ASIN", d: "Incolla l'ASIN o l'URL del prodotto Amazon." },
                  { n: "2", t: "Genera i prompt", d: "L'AI analizza il prodotto e scrive 10 prompt." },
                  { n: "3", t: "Scarica le immagini", d: "Render automatico, poi download singolo o ZIP." },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-2.5 p-2.5 rounded-lg"
                    style={{ background: "rgba(30,63,217,0.03)", border: "1px solid rgba(30,63,217,0.06)" }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                      style={{ background: "rgba(30,63,217,0.15)", color: "var(--brand)" }}>
                      {s.n}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{s.t}</p>
                      <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cost hint */}
              <div className="px-3 pb-2">
                <div className="rounded-lg p-2.5 flex items-center gap-2"
                  style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)" }}>
                  <span className="text-base">💸</span>
                  <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
                    Costo indicativo <strong style={{ color: "#15803D" }}>~$0.85</strong> per 10 immagini
                    {" "}(~$0.82 se in cache).
                  </p>
                </div>
              </div>

              {/* Quick links */}
              <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                <Link href="/account" onClick={() => setOpenPanel(null)}
                  className="text-center text-xs py-2 rounded-lg font-semibold transition-all"
                  style={{ background: "rgba(30,63,217,0.10)", color: "var(--brand)", border: "1px solid rgba(30,63,217,0.2)" }}>
                  Spesa API
                </Link>
                <Link href="/history" onClick={() => setOpenPanel(null)}
                  className="text-center text-xs py-2 rounded-lg font-semibold transition-all"
                  style={{ background: "rgba(30,63,217,0.10)", color: "var(--brand)", border: "1px solid rgba(30,63,217,0.2)" }}>
                  Cronologia
                </Link>
              </div>

              {/* Legal footer */}
              <div className="px-3 pb-3 flex items-center justify-center gap-3 text-[10px]"
                style={{ borderTop: "1px solid var(--border)", paddingTop: "0.625rem" }}>
                <Link href="/privacy" onClick={() => setOpenPanel(null)} className="hover:underline" style={{ color: "var(--text-muted)" }}>Privacy</Link>
                <Link href="/cookies" onClick={() => setOpenPanel(null)} className="hover:underline" style={{ color: "var(--text-muted)" }}>Cookie</Link>
                <Link href="/terms"   onClick={() => setOpenPanel(null)} className="hover:underline" style={{ color: "var(--text-muted)" }}>Termini</Link>
              </div>
            </Dropdown>
          )}
        </div>

        {/* Bell button + dropdown — recent Mariano runs */}
        <div className="relative">
          <TopBarBtn title="Run recenti" active={openPanel === "bell"} onClick={handleBellClick}>
            <BellIcon />
          </TopBarBtn>

          {openPanel === "bell" && (
            <Dropdown align="right" width={340}>
              <DropdownHeader
                title="Run recenti"
                subtitle="Le ultime 8 generazioni"
                action={<Link href="/history" onClick={() => setOpenPanel(null)}
                  className="text-xs" style={{ color: "var(--purple-400)" }}>Vedi tutto</Link>}
              />
              {recentLoading && (
                <div className="flex flex-col gap-1.5 p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg skeleton-shimmer skeleton-pulse"
                      style={{ background: "rgba(30,63,217,0.03)", animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              )}
              {!recentLoading && recentRuns.length === 0 && (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  <p className="mb-1">Nessun run ancora</p>
                  <p className="text-xs opacity-70">Genera le tue prime 10 immagini dalla home</p>
                </div>
              )}
              {!recentLoading && recentRuns.length > 0 && (
                <div className="flex flex-col max-h-80 overflow-y-auto">
                  {recentRuns.map((run) => {
                    const accent = run.accent_color || "#A78BFA";
                    return (
                      <button
                        key={run.id}
                        onClick={() => {
                          setOpenPanel(null);
                          router.push(`/?asin=${run.asin}`);
                        }}
                        className="flex items-center gap-3 px-4 py-3 transition-all text-left"
                        style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,63,217,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div className="w-7 h-7 rounded-md shrink-0"
                          style={{ background: accent, boxShadow: `0 0 8px ${accent}66` }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-mono font-bold text-xs" style={{ color: "var(--text-primary)" }}>
                              {run.asin}
                            </span>
                            {run.cache_hit && (
                              <span className="text-[9px] font-mono px-1 rounded"
                                style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80" }}>
                                ⚡
                              </span>
                            )}
                          </div>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {run.num_images_ok}/{(run.num_images_ok ?? 0) + (run.num_images_failed ?? 0)} img
                            {run.cost_usd ? ` · $${run.cost_usd.toFixed(2)}` : ""}
                            {" · "}{relativeTime(run.created_at)}
                          </p>
                        </div>
                        <span className="shrink-0 opacity-40 text-xs" style={{ color: accent }}>→</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="p-3">
                <Link href="/history" onClick={() => setOpenPanel(null)}
                  className="block text-center text-xs py-2 rounded-lg font-semibold transition-all"
                  style={{ background: "rgba(30,63,217,0.05)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  Cronologia completa
                </Link>
              </div>
            </Dropdown>
          )}
        </div>

        {/* Logged out → prominent "Accedi" CTA. Logged in → avatar pill + dropdown */}
        {!user ? (
          <button
            onClick={() => document.dispatchEvent(new CustomEvent("open-auth-modal", { detail: "login" }))}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
            title="Accedi al tuo account"
          >
            <UserIcon />
            <span>Accedi</span>
          </button>
        ) : (
        <div className="relative">
          <button
            onClick={() => setOpenPanel(openPanel === "user" ? null : "user")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
            style={{
              background: openPanel === "user" ? "rgba(30,63,217,0.25)" : "rgba(30,63,217,0.15)",
              border: openPanel === "user" ? "1px solid rgba(30,63,217,0.4)" : "1px solid rgba(30,63,217,0.25)",
            }}
            title="Account utente"
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--brand-deep), var(--brand-soft))" }}
            >
              {initials}
            </div>
            <span className="text-xs font-semibold hidden sm:block" style={{ color: "var(--purple-400)" }}>
              {user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Account"}
            </span>
          </button>

          {openPanel === "user" && (
            <Dropdown align="right" width={260}>
              {user ? (
                <>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                          {(user.user_metadata?.display_name as string) ?? user.email?.split("@")[0] ?? "Account"}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <Link href="/account"
                      onClick={() => setOpenPanel(null)}
                      className="block px-3 py-2 rounded-lg text-sm transition-all"
                      style={{ color: "var(--text-primary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,63,217,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      Il mio account · spesa API
                    </Link>
                    <Link href="/history"
                      onClick={() => setOpenPanel(null)}
                      className="block px-3 py-2 rounded-lg text-sm transition-all"
                      style={{ color: "var(--text-primary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,63,217,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      Cronologia run
                    </Link>
                    <button
                      onClick={handleSignOut}
                      disabled={signOutBusy}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                      style={{ color: "#F87171" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      {signOutBusy ? "Disconnessione…" : "Esci"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Modalità ospite</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Accedi per sincronizzare i tuoi ASIN su più dispositivi.
                    </p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => { setOpenPanel(null); document.dispatchEvent(new CustomEvent("open-auth-modal", { detail: "login" })); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all font-semibold"
                      style={{ color: "var(--purple-400)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,63,217,0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      Accedi
                    </button>
                    <button
                      onClick={() => { setOpenPanel(null); document.dispatchEvent(new CustomEvent("open-auth-modal", { detail: "register" })); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                      style={{ color: "var(--text-primary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,63,217,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      Registrati
                    </button>
                  </div>
                </>
              )}
            </Dropdown>
          )}
        </div>
        )}
      </div>
    </header>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function Dropdown({ children, align = "right", width = 260 }: {
  children: React.ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  return (
    <div
      className="absolute top-full mt-2 rounded-xl shadow-2xl z-50 overflow-hidden"
      style={{
        width,
        [align === "right" ? "right" : "left"]: 0,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "0 20px 50px rgba(15,23,54,0.18), 0 0 0 1px rgba(30,63,217,0.06)",
      }}
    >
      {children}
    </div>
  );
}

function DropdownHeader({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}>
      <div>
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{title}</p>
        {subtitle && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function TopBarBtn({ children, title, active, onClick }: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
      style={{
        color: active ? "var(--purple-400)" : "var(--text-muted)",
        background: active ? "rgba(30,63,217,0.15)" : "transparent",
        border: active ? "1px solid rgba(30,63,217,0.3)" : "1px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
