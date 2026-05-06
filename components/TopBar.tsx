"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { Job } from "@/lib/types";

const PAGE_LABELS: Record<string, string> = {
  "/":        "Dashboard",
  "/history": "Cronologia",
};

const STATUS_COLOR: Record<string, string> = {
  queued: "#9CA3AF", scraping: "#38BDF8", mvd: "#A78BFA",
  generating: "#C084FC", qc: "#FCD34D", compositing: "#FB923C",
  done: "#34D399", error: "#F87171",
};
const STATUS_LABEL: Record<string, string> = {
  queued: "In coda", scraping: "Scraping", mvd: "Analisi AI",
  generating: "Generando", qc: "QC", compositing: "Compositing",
  done: "Completato", error: "Errore",
};

function relativeTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "adesso";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

const API_KEYS = [
  { key: "ANTHROPIC_API_KEY",        label: "Anthropic",        color: "#A78BFA" },
  { key: "GOOGLE_AI_API_KEY",        label: "Google AI Studio", color: "#38BDF8" },
  { key: "OPENAI_API_KEY",           label: "OpenAI",           color: "#34D399" },
  { key: "RAINFOREST_API_KEY",       label: "Rainforest API",   color: "#FCD34D" },
  { key: "CLOUDFLARE_R2_BUCKET_NAME",label: "Cloudflare R2",   color: "#FB923C" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase",         color: "#4ADE80" },
];

export default function TopBar() {
  const [query, setQuery]         = useState("");
  const [openPanel, setOpenPanel] = useState<"bell" | "settings" | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [activeCount, setActiveCount] = useState(0);
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

  /* Fetch recent jobs when bell is opened */
  const loadRecentJobs = useCallback(async () => {
    try {
      const res  = await fetch("/api/history?limit=8");
      if (!res.ok) return;
      const data = await res.json();
      const jobs: Job[] = data.jobs ?? [];
      setRecentJobs(jobs);
      setActiveCount(jobs.filter((j) => !["done", "error"].includes(j.status)).length);
    } catch { /* no-op */ }
  }, []);

  const handleBellClick = () => {
    if (openPanel === "bell") { setOpenPanel(null); return; }
    setOpenPanel("bell");
    loadRecentJobs();
  };

  /* Search: ASIN → results page, or navigate to history */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (q.length === 10 && /^[A-Z0-9]{10}$/.test(q)) {
      router.push(`/history?asin=${q}`);
    } else if (q) {
      router.push(`/history?asin=${q}`);
    }
  };

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3"
      style={{
        background: "rgba(14,14,28,0.90)",
        backdropFilter: "blur(14px)",
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
      <form onSubmit={handleSearch} className="flex-1 max-w-sm mx-auto relative">
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
      </form>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0" ref={panelRef}>

        {/* Settings button + dropdown */}
        <div className="relative">
          <TopBarBtn
            title="Impostazioni"
            active={openPanel === "settings"}
            onClick={() => setOpenPanel(openPanel === "settings" ? null : "settings")}
          >
            <SettingsIcon />
          </TopBarBtn>

          {openPanel === "settings" && (
            <Dropdown align="right" width={280}>
              <DropdownHeader title="Impostazioni" subtitle="Configura le API keys su Vercel" />
              <div className="flex flex-col gap-2 p-3">
                {API_KEYS.map((k) => (
                  <div key={k.key} className="flex items-center gap-2.5 p-2.5 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: k.color, boxShadow: `0 0 5px ${k.color}88` }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono truncate" style={{ color: k.color }}>{k.key}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{k.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 pb-3">
                <a
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs py-2 rounded-lg font-semibold transition-all"
                  style={{ background: "rgba(139,92,246,0.18)", color: "var(--purple-400)", border: "1px solid rgba(139,92,246,0.3)" }}
                >
                  Apri Vercel Dashboard →
                </a>
              </div>
            </Dropdown>
          )}
        </div>

        {/* Bell button + dropdown */}
        <div className="relative">
          <div className="relative">
            <TopBarBtn title="Notifiche" active={openPanel === "bell"} onClick={handleBellClick}>
              <BellIcon />
            </TopBarBtn>
            {activeCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                style={{ background: "#F87171" }}
              >
                {activeCount}
              </span>
            )}
          </div>

          {openPanel === "bell" && (
            <Dropdown align="right" width={320}>
              <DropdownHeader
                title="Notifiche"
                subtitle={`${activeCount} job attivi`}
                action={<Link href="/history" onClick={() => setOpenPanel(null)}
                  className="text-xs" style={{ color: "var(--purple-400)" }}>Vedi tutto</Link>}
              />
              {recentJobs.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Nessun job trovato
                </div>
              ) : (
                <div className="flex flex-col max-h-72 overflow-y-auto">
                  {recentJobs.map((job) => {
                    const color = STATUS_COLOR[job.status] ?? "#9CA3AF";
                    const isActive = !["done","error"].includes(job.status);
                    return (
                      <Link
                        key={job.id}
                        href={`/results/${job.id}`}
                        onClick={() => setOpenPanel(null)}
                        className="flex items-center gap-3 px-4 py-3 transition-all"
                        style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Status dot */}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "animate-pulse" : ""}`}
                          style={{ background: color }} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                              {job.asin}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                              style={{ background: `${color}18`, color }}>
                              {STATUS_LABEL[job.status] ?? job.status}
                            </span>
                          </div>
                          {isActive && job.current_step && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                              {job.current_step}
                            </p>
                          )}
                          {job.status === "done" && (
                            <p className="text-xs mt-0.5" style={{ color: "#34D399" }}>
                              {job.slide_urls?.length ?? 0} slide generate ✓
                            </p>
                          )}
                          {job.status === "error" && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: "#F87171" }}>
                              {job.error_message?.slice(0, 50)}
                            </p>
                          )}
                        </div>

                        <div className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                          {relativeTime(job.created_at)}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              <div className="p-3">
                <Link href="/history" onClick={() => setOpenPanel(null)}
                  className="block text-center text-xs py-2 rounded-lg font-semibold transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  Cronologia completa
                </Link>
              </div>
            </Dropdown>
          )}
        </div>

        {/* Avatar pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer"
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
        background: "#111124",
        border: "1px solid var(--border)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)",
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
        background: active ? "rgba(139,92,246,0.15)" : "transparent",
        border: active ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
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
