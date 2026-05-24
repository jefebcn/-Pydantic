"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AuthModal from "@/components/AuthModal";
import { LOGO_ICON_SRC } from "@/lib/brand";
import { APP_VERSION_LABEL } from "@/lib/version";

const navItems = [
  {
    section: "GENERALE",
    links: [
      { href: "/", label: "Dashboard", icon: IconDashboard },
      { href: "/history", label: "Cronologia", icon: IconHistory },
    ],
  },
  {
    section: "TOOLS",
    links: [
      { href: "/#generate", label: "Nuovo Job", icon: IconSparkles },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut, loading } = useAuth();
  const [authOpen, setAuthOpen]   = useState(false);
  const [authTab, setAuthTab]     = useState<"login" | "register">("login");
  const [mobileOpen, setMobileOpen] = useState(false);

  const openLogin    = () => { setAuthTab("login");    setAuthOpen(true); };
  const openRegister = () => { setAuthTab("register"); setAuthOpen(true); };

  /* Listen for "open-auth-modal" events from anywhere in the app
     (e.g. TopBar's user dropdown). */
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<"login" | "register">).detail;
      setAuthTab(detail === "register" ? "register" : "login");
      setAuthOpen(true);
    };
    document.addEventListener("open-auth-modal", onOpen);
    return () => document.removeEventListener("open-auth-modal", onOpen);
  }, []);

  /* Mobile drawer toggle from TopBar hamburger */
  useEffect(() => {
    const onToggle = () => setMobileOpen(v => !v);
    document.addEventListener("toggle-sidebar", onToggle);
    return () => document.removeEventListener("toggle-sidebar", onToggle);
  }, []);

  /* Close on route change */
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  /* ESC closes drawer */
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const initials = user?.user_metadata?.display_name
    ? (user.user_metadata.display_name as string).slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 fade-up"
          style={{ background: "rgba(5,5,12,0.7)", backdropFilter: "blur(6px)" }}
          aria-hidden="true"
        />
      )}

    <aside
      className={`flex flex-col w-[260px] md:w-[220px] min-h-screen shrink-0 transition-transform duration-300 ${
        mobileOpen ? "fixed inset-y-0 left-0 z-50 translate-x-0" : "fixed -translate-x-full md:translate-x-0 md:static md:z-auto"
      }`}
      style={{
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_ICON_SRC} alt="" width={40} height={40}
          className="w-10 h-10 rounded-lg shrink-0"
          style={{
            border: "1px solid var(--border)",
            boxShadow: "0 2px 10px rgba(30,63,217,0.10)",
          }} />
        <div className="min-w-0">
          <p className="text-base font-black leading-none tracking-[0.18em]"
            style={{ color: "var(--brand)" }}>
            PYDANTIC
          </p>
          <p className="text-[10px] mt-1 tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
            Amazon Infographics
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navItems.map((section) => (
          <div key={section.section}>
            <p
              className="text-xs font-semibold tracking-widest px-2 mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              {section.section}
            </p>
            <ul className="space-y-0.5">
              {section.links.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: active ? "rgba(30,63,217,0.15)" : "transparent",
                        color: active ? "var(--purple-400)" : "var(--text-muted)",
                        borderLeft: active ? "2px solid var(--purple-500)" : "2px solid transparent",
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Admin link — only rendered when the logged-in user's email is in
           NEXT_PUBLIC_ADMIN_EMAILS. The real gate is server-side; this is
           cosmetic so non-admins don't see a dead link. */}
        {isAdminUser(user?.email) && (
          <div>
            <p className="text-xs font-semibold tracking-widest px-2 mb-2"
              style={{ color: "var(--text-muted)" }}>
              ADMIN
            </p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: pathname === "/admin" ? "rgba(30,63,217,0.15)" : "transparent",
                    color: pathname === "/admin" ? "var(--purple-400)" : "var(--text-muted)",
                    borderLeft: pathname === "/admin" ? "2px solid var(--purple-500)" : "2px solid transparent",
                  }}>
                  <IconShield size={16} />
                  Dashboard admin
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* Auth section — always visible */}
      <div className="px-4 py-4 border-t" style={{ borderColor: "var(--border)" }}>
        {user ? (
          /* ── Logged in ── */
          <div>
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mb-2"
              style={{ background: "rgba(30,63,217,0.12)", border: "1px solid rgba(30,63,217,0.25)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {(user.user_metadata?.display_name as string) ?? user.email?.split("@")[0]}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full text-xs py-1.5 rounded-lg font-medium transition-all"
              style={{ color: "var(--text-muted)", background: "rgba(30,63,217,0.04)", border: "1px solid var(--border)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#F87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              Esci dall&apos;account
            </button>
          </div>
        ) : (
          /* ── Guest / loading ── */
          <div className="flex flex-col gap-2">
            <p className="text-[11px] px-1 font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
              Account
            </p>
            <button
              onClick={openLogin}
              disabled={loading}
              className="w-full text-xs py-2 rounded-lg font-bold transition-all"
              style={{
                background: "rgba(30,63,217,0.18)",
                color: loading ? "var(--text-muted)" : "var(--purple-400)",
                border: "1px solid rgba(30,63,217,0.3)",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Caricamento…" : "Accedi"}
            </button>
            <button
              onClick={openRegister}
              disabled={loading}
              className="w-full text-xs py-2 rounded-lg font-medium transition-all"
              style={{
                color: "var(--text-muted)",
                background: "rgba(30,63,217,0.04)",
                border: "1px solid var(--border)",
                opacity: loading ? 0.6 : 1,
              }}
            >
              Registrati gratis
            </button>
            <p className="text-[10px] text-center px-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
              Sync cronologia su ogni dispositivo
            </p>
          </div>
        )}
      </div>

      {/* Version */}
      <div className="px-5 pb-4">
        <div className="rounded-lg px-3 py-1.5 text-xs text-center"
          style={{ background: "rgba(30,63,217,0.08)", color: "var(--text-muted)" }}>
          {APP_VERSION_LABEL}
        </div>
      </div>

      {/* Close button — mobile only */}
      <button
        onClick={() => setMobileOpen(false)}
        className="md:hidden absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: "rgba(30,63,217,0.05)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        aria-label="Chiudi menu"
      >
        ✕
      </button>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
    </aside>
    </>
  );
}

/* Inline SVG icon components */
function IconDashboard({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconHistory({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function IconSparkles({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z" />
      <path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z" />
    </svg>
  );
}

function IconShield({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** Client-side admin check (cosmetic — the real gate is server-side). */
function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    .includes(email.toLowerCase());
}
