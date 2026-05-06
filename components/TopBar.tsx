"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";

const PAGE_LABELS: Record<string, string> = {
  "/":        "Dashboard",
  "/history": "Cronologia",
};

export default function TopBar() {
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const pageLabel = PAGE_LABELS[pathname] ?? "Dashboard";

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3"
      style={{
        background: "rgba(16,16,31,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Brand */}
      <div className="shrink-0 hidden sm:block">
        <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--text-muted)" }}>
          Amazon Infographic AI
        </p>
        <p className="text-sm font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
          {pageLabel}
        </p>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-sm mx-auto relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
          <SearchIcon />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca ASIN o job ID…"
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <TopBarBtn title="Impostazioni"><SettingsIcon /></TopBarBtn>
        <TopBarBtn title="Notifiche"><BellIcon /></TopBarBtn>
        {/* Avatar pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
          style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)" }}
        >
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}
          >
            AI
          </div>
          <span className="text-xs font-semibold hidden sm:block" style={{ color: "var(--purple-400)" }}>
            Pro
          </span>
        </div>
      </div>
    </header>
  );
}

function TopBarBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button
      title={title}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
      style={{ color: "var(--text-muted)", background: "transparent" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
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
function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
