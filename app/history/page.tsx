"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { listRuns, type RunSummary } from "@/lib/imageStore";

interface MarianoRun {
  id: string;
  asin: string;
  cache_hit: boolean;
  num_images_ok: number;
  num_images_failed: number;
  duration_ms: number | null;
  cost_usd: number | null;
  accent_color: string | null;
  palette_hex: string[] | null;
  categoria_effetto: string | null;
  models_used: string[] | null;
  created_at: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "adesso";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  return `${d}g fa`;
}

function HistoryPageInner() {
  const router = useRouter();
  const sp     = useSearchParams();
  const urlAsin = sp.get("asin") ?? "";

  const [runs, setRuns]       = useState<MarianoRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [reason, setReason]   = useState("");
  const [search, setSearch]   = useState(urlAsin);

  const fetchRuns = useCallback(async (asin = "") => {
    setLoading(true);
    setError("");
    setReason("");
    try {
      const qs  = asin ? `&asin=${encodeURIComponent(asin)}` : "";
      const res = await fetch(`/api/mariano-runs?limit=100${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRuns(data.runs ?? []);
      if (data.reason) setReason(data.reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRuns(urlAsin); }, [fetchRuns, urlAsin]);

  /* Local IndexedDB summaries — used to flag "📦 Salvato" rows and to
     surface runs that were generated in this browser but never reached
     Supabase (e.g. mariano_runs table not created yet). */
  const [localRuns, setLocalRuns] = useState<RunSummary[]>([]);
  useEffect(() => {
    listRuns().then(setLocalRuns).catch(() => setLocalRuns([]));
  }, []);
  const localAsins = new Set(localRuns.map(r => r.asin));

  /* Runs that ONLY exist locally (no row on Supabase yet) — show them on
     top with a small "locale" tag so the user can still open them. */
  const cloudAsins   = new Set(runs.map(r => r.asin));
  const orphanLocals = localRuns.filter(r => !cloudAsins.has(r.asin));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim().toUpperCase();
    fetchRuns(q);
  };

  /* Row click → /run/[asin] if we have the images locally, otherwise
     fall back to the dashboard pre-fill so the user can re-generate. */
  const openRun = (asin: string) => {
    if (localAsins.has(asin)) router.push(`/run/${asin}`);
    else                      router.push(`/?asin=${asin}`);
  };

  /* Legacy reference kept for stat-block compatibility (unused). */
  const _openInDashboard = (asin: string) => {
    router.push(`/?asin=${asin}`);
  };

  const totalCost = runs.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const cacheHits = runs.filter(r => r.cache_hit).length;
  const cacheRate = runs.length > 0 ? Math.round((cacheHits / runs.length) * 100) : 0;

  return (
    <main className="px-5 md:px-8 pt-6 md:pt-10 pb-16 max-w-5xl mx-auto">

      {/* Header */}
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-3"
          style={{ color: "var(--purple-400)" }}>
          Cronologia · Mariano runs
        </p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}>
          Tutti gli <span className="gradient-text">ASIN processati</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {runs.length === 0 && !loading
            ? "Nessun run ancora. Genera le tue prime 10 immagini dalla home."
            : `${runs.length} run totali · ${cacheHits} cache hit (${cacheRate}%) · ≈ $${totalCost.toFixed(2)} spesi`}
        </p>
      </header>

      {/* Stats strip */}
      {runs.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatBlock label="Runs" value={runs.length.toString()} accent="var(--purple-400)" />
          <StatBlock label="Cache hit" value={`${cacheRate}%`} accent="#4ADE80" sub={`${cacheHits}/${runs.length}`} />
          <StatBlock label="Spesa totale" value={`$${totalCost.toFixed(2)}`} accent="#FCD34D" />
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase().slice(0, 10))}
            placeholder="Filtra per ASIN…"
            className="w-full pl-4 pr-9 py-2.5 text-sm rounded-lg outline-none transition-all font-mono"
            style={{
              background: "rgba(11,11,24,0.6)",
              border: "1px solid rgba(139,92,246,0.22)",
              color: "var(--text-primary)",
            }}
          />
          {search && (
            <button type="button" onClick={() => { setSearch(""); fetchRuns(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-xs"
              style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)" }}>
              ✕
            </button>
          )}
        </div>
        <button type="submit"
          className="btn-primary text-sm"
          style={{ padding: "0.625rem 1.25rem" }}>
          Filtra
        </button>
      </form>

      {/* State */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl skeleton-shimmer skeleton-pulse"
              style={{ background: "rgba(255,255,255,0.03)", animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="px-4 py-3 rounded-lg text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }}>
          ✕ {error}
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="px-6 py-12 rounded-xl text-center"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(255,255,255,0.08)" }}>
          <p className="text-sm mb-2" style={{ color: "var(--text-primary)" }}>
            {search ? `Nessun run per "${search}"` : "Nessun run ancora"}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {reason
              ? <span title={reason}>Supabase: {reason.slice(0, 90)}</span>
              : <Link href="/" className="underline" style={{ color: "var(--purple-400)" }}>Vai alla home</Link>}
          </p>
        </div>
      )}

      {/* Local-only runs (saved on this device, not yet on Supabase) */}
      {!loading && orphanLocals.length > 0 && (
        <div className="space-y-2 mb-6">
          <p className="text-[10px] font-semibold tracking-wider uppercase pl-1"
            style={{ color: "var(--text-muted)" }}>
            Salvati solo su questo dispositivo · {orphanLocals.length}
          </p>
          {orphanLocals.map((r) => (
            <LocalRunRow key={r.asin} run={r} onOpen={() => router.push(`/run/${r.asin}`)} />
          ))}
        </div>
      )}

      {/* Cloud results */}
      {!loading && runs.length > 0 && (
        <div className="space-y-2">
          {runs.map((r) => (
            <RunRow
              key={r.id}
              run={r}
              hasLocal={localAsins.has(r.asin)}
              onOpen={() => openRun(r.asin)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={
      <main className="px-5 md:px-8 pt-6 pb-16 max-w-5xl mx-auto">
        <div className="h-20 rounded-xl skeleton-shimmer skeleton-pulse"
          style={{ background: "rgba(255,255,255,0.03)" }} />
      </main>
    }>
      <HistoryPageInner />
    </Suspense>
  );
}

/* ── Building blocks ─────────────────────────────────────────────────────── */

function StatBlock({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="card-step p-4">
      <p className="text-[10px] font-semibold tracking-wider uppercase mb-1"
        style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-xl font-bold leading-none" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-[10px] mt-1 font-mono" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function RunRow({ run, hasLocal, onOpen }: { run: MarianoRun; hasLocal: boolean; onOpen: () => void }) {
  const ok       = run.num_images_ok ?? 0;
  const failed   = run.num_images_failed ?? 0;
  const total    = ok + failed;
  const accent   = run.accent_color || "#A78BFA";
  const cost     = run.cost_usd ?? 0;
  const duration = run.duration_ms ? (run.duration_ms / 1000).toFixed(1) : null;

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-xl p-4 transition-all hover:scale-[1.005] flex items-center gap-4 group"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}55`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
    >
      {/* Color block */}
      <div className="w-12 h-12 rounded-lg shrink-0"
        style={{ background: accent, boxShadow: `0 0 18px ${accent}55` }} />

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-mono font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            {run.asin}
          </span>
          {run.cache_hit && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}>
              ⚡ CACHE
            </span>
          )}
          {hasLocal && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
              title="Le immagini sono salvate su questo dispositivo — clic per aprirle senza rigenerare"
              style={{ background: "rgba(167,139,250,0.15)", color: "var(--purple-400)", border: "1px solid rgba(167,139,250,0.3)" }}>
              📦 SALVATO
            </span>
          )}
          {run.categoria_effetto && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: `${accent}18`, color: accent }}>
              {run.categoria_effetto}
            </span>
          )}
          {failed > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(248,113,113,0.15)", color: "#F87171" }}>
              {failed} falliti
            </span>
          )}
        </div>
        <div className="text-xs flex items-center gap-3 flex-wrap" style={{ color: "var(--text-muted)" }}>
          <span>{ok}/{total} immagini</span>
          {duration && <span>· {duration}s</span>}
          {cost > 0 && <span>· ${cost.toFixed(3)}</span>}
          <span>· {relativeTime(run.created_at)}</span>
        </div>
      </div>

      {/* Palette swatches */}
      {run.palette_hex && run.palette_hex.length > 0 && (
        <div className="hidden sm:flex gap-1 shrink-0">
          {run.palette_hex.slice(0, 3).map((c, i) => (
            <div key={i} className="w-5 h-5 rounded"
              style={{ background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
          ))}
        </div>
      )}

      {/* Open arrow */}
      <div className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
        style={{ color: accent }}>
        →
      </div>
    </button>
  );
}

function LocalRunRow({ run, onOpen }: { run: RunSummary; onOpen: () => void }) {
  const accent = run.meta.accent || "#A78BFA";
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-xl p-4 transition-all hover:scale-[1.005] flex items-center gap-4 group"
      style={{
        background: "rgba(167,139,250,0.04)",
        border: "1px solid rgba(167,139,250,0.18)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}55`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.18)"; }}
    >
      <div className="w-12 h-12 rounded-lg shrink-0"
        style={{ background: accent, boxShadow: `0 0 18px ${accent}55` }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-mono font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            {run.asin}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(167,139,250,0.15)", color: "var(--purple-400)", border: "1px solid rgba(167,139,250,0.3)" }}>
            📦 LOCALE
          </span>
          {run.meta.categoria && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: `${accent}18`, color: accent }}>
              {run.meta.categoria}
            </span>
          )}
        </div>
        <div className="text-xs flex items-center gap-3 flex-wrap" style={{ color: "var(--text-muted)" }}>
          <span>{run.okCount}/{run.totalCount} immagini</span>
          <span>· salvato {new Date(run.savedAt).toLocaleDateString()}</span>
        </div>
      </div>
      {run.meta.palette && run.meta.palette.length > 0 && (
        <div className="hidden sm:flex gap-1 shrink-0">
          {run.meta.palette.slice(0, 3).map((c, i) => (
            <div key={i} className="w-5 h-5 rounded"
              style={{ background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
          ))}
        </div>
      )}
      <div className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
        style={{ color: accent }}>
        →
      </div>
    </button>
  );
}
