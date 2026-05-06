"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Job } from "@/lib/types";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  queued:       { label: "In coda",     color: "#9CA3AF", bg: "rgba(156,163,175,0.12)" },
  scraping:     { label: "Scraping",    color: "#38BDF8", bg: "rgba(56,189,248,0.12)"  },
  mvd:          { label: "Analisi AI",  color: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
  generating:   { label: "Generando",  color: "#C084FC", bg: "rgba(192,132,252,0.12)" },
  qc:           { label: "QC",          color: "#FCD34D", bg: "rgba(252,211,77,0.12)"  },
  compositing:  { label: "Compositing",color: "#FB923C", bg: "rgba(251,146,60,0.12)"  },
  done:         { label: "Completato", color: "#34D399", bg: "rgba(52,211,153,0.12)"  },
  error:        { label: "Errore",     color: "#F87171", bg: "rgba(248,113,113,0.12)" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "adesso";
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ore fa`;
  const d = Math.floor(h / 24);
  return `${d} giorni fa`;
}

function avgQC(scores: Job["qc_scores"]): number | null {
  const vals = Object.values(scores ?? {}).map((s) => s.avg).filter(Boolean);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export default function HistoryPage() {
  const [jobs, setJobs]       = useState<Job[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");

  const fetchHistory = useCallback(async (asin = "") => {
    setLoading(true);
    setError("");
    try {
      const qs  = asin ? `&asin=${encodeURIComponent(asin)}` : "";
      const res = await fetch(`/api/history?limit=100${qs}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory(search);
  };

  const displayed = filter === "all"
    ? jobs
    : jobs.filter((j) => j.status === filter);

  const statuses = ["all", "done", "error", "generating", "scraping", "queued"];

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase mb-1"
          style={{ color: "var(--purple-400)" }}>
          Cronologia
        </p>
        <h1 className="text-3xl md:text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
          Tutti gli{" "}
          <span className="gradient-text">ASIN cercati</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {total > 0 ? `${total} job totali` : "Nessun job ancora — genera il tuo primo set di slide dalla Dashboard."}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
              <SearchIcon />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              placeholder="Filtra per ASIN…"
              maxLength={10}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl font-mono outline-none"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>
          <button type="submit" className="btn-primary text-sm px-4 py-2">
            Cerca
          </button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); fetchHistory(); }}
              className="text-sm px-3 py-2 rounded-xl transition-all"
              style={{ color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              ✕
            </button>
          )}
        </form>

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {statuses.map((s) => {
            const meta = STATUS_META[s];
            const active = filter === s;
            return (
              <button key={s} onClick={() => setFilter(s)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                style={{
                  background: active ? (meta?.bg ?? "rgba(139,92,246,0.2)") : "var(--bg-card)",
                  color: active ? (meta?.color ?? "var(--purple-400)") : "var(--text-muted)",
                  border: `1px solid ${active ? (meta?.color ?? "var(--purple-500)") + "55" : "var(--border)"}`,
                }}>
                {s === "all" ? "Tutti" : (meta?.label ?? s)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Refresh */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {displayed.length} risultati
        </span>
        <button onClick={() => fetchHistory(search)}
          className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
          style={{ color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <RefreshIcon /> Aggiorna
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--purple-500)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Caricamento…</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl p-4 mb-4 text-sm"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#F87171" }}>
          Errore: {error}
        </div>
      )}

      {!loading && !error && displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(139,92,246,0.12)", color: "var(--purple-400)" }}>
            <EmptyIcon />
          </div>
          <div className="text-center">
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Nessun job trovato</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {filter !== "all" ? "Prova a cambiare il filtro." : "Genera il tuo primo set di slide dalla Dashboard."}
            </p>
          </div>
          <Link href="/" className="btn-primary text-sm">
            Vai alla Dashboard
          </Link>
        </div>
      )}

      {!loading && displayed.length > 0 && (
        <div className="flex flex-col gap-3">
          {displayed.map((job) => {
            const meta   = STATUS_META[job.status] ?? STATUS_META.queued;
            const qc     = avgQC(job.qc_scores);
            const slides = job.slide_urls?.length ?? 0;
            const dur    = job.duration_ms ? `${(job.duration_ms / 1000).toFixed(1)}s` : null;
            const isActive = !["done","error"].includes(job.status);

            return (
              <div key={job.id}
                className="relative overflow-hidden rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-all group"
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid var(--border)`,
                  borderLeft: `3px solid ${meta.color}`,
                }}>

                {/* ASIN + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black font-mono text-lg" style={{ color: "var(--text-primary)" }}>
                      {job.asin}
                    </span>
                    {/* Status chip */}
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1"
                      style={{ background: meta.bg, color: meta.color }}>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
                          style={{ background: meta.color }} />
                      )}
                      {meta.label}
                    </span>
                    {job.status === "error" && (
                      <span className="text-xs" style={{ color: "#F87171" }}>
                        — {job.error_message?.slice(0, 60)}
                      </span>
                    )}
                  </div>

                  {/* Progress bar (only if active) */}
                  {isActive && job.progress > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full overflow-hidden"
                        style={{ background: "var(--border)" }}>
                        <div className="h-full rounded-full progress-shimmer transition-all"
                          style={{ width: `${job.progress}%` }} />
                      </div>
                      <span className="text-xs font-mono" style={{ color: meta.color }}>
                        {job.progress}%
                      </span>
                    </div>
                  )}

                  {/* Current step */}
                  {isActive && job.current_step && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {job.current_step}
                    </p>
                  )}

                  {/* Thumbnail strip */}
                  {slides > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {job.slide_urls.slice(0, 5).map((url, i) => (
                        <div key={i}
                          className="w-8 h-8 rounded overflow-hidden shrink-0"
                          style={{ border: "1px solid var(--border)" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`slide ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {slides > 5 && (
                        <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                          style={{ background: "rgba(139,92,246,0.15)", color: "var(--purple-400)", border: "1px solid var(--border-purple)" }}>
                          +{slides - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right side: stats */}
                <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 shrink-0 flex-wrap">
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0.5 text-xs"
                    style={{ color: "var(--text-muted)" }}>
                    {slides > 0 && (
                      <span className="font-semibold" style={{ color: "#34D399" }}>
                        {slides}/7 slide
                      </span>
                    )}
                    {qc !== null && (
                      <span style={{ color: qc >= 85 ? "#34D399" : qc >= 70 ? "#FCD34D" : "#F87171" }}>
                        QC {qc}/100
                      </span>
                    )}
                    {dur && <span>{dur}</span>}
                    <span>{relativeTime(job.created_at)}</span>
                  </div>

                  {job.status === "done" ? (
                    <Link href={`/results/${job.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap"
                      style={{
                        background: "rgba(167,139,250,0.15)",
                        color: "var(--purple-400)",
                        border: "1px solid rgba(167,139,250,0.3)",
                      }}>
                      Vedi slide →
                    </Link>
                  ) : isActive ? (
                    <Link href={`/results/${job.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap"
                      style={{
                        background: meta.bg,
                        color: meta.color,
                        border: `1px solid ${meta.color}44`,
                      }}>
                      Monitora →
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function EmptyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" />
    </svg>
  );
}
