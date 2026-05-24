"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth, supabaseBrowser } from "@/lib/auth-context";

interface Usage {
  email: string | null;
  totalRuns: number;
  totalSpend: number;
  last30Runs: number;
  last30Spend: number;
  cacheHits: number;
  byMonth: Array<{ month: string; spend: number; runs: number }>;
  recent: Array<{ asin: string; cost_usd: number; cache_hit: boolean; created_at: string }>;
}

function relativeTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "adesso";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

const MONTH_LABELS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_LABELS[parseInt(m, 10) - 1] ?? m} ${y.slice(2)}`;
}

export default function AccountPage() {
  const { user, loading, signOut } = useAuth();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy]   = useState(true);
  const [err, setErr]     = useState<string | null>(null);

  const authedFetch = useCallback(async (url: string) => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const sb: any = supabaseBrowser;
    const { data: { session } } = await sb.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
    const res = await fetch(url, { headers, credentials: "include" });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.error || msg; } catch { /* not json */ }
      throw new Error(msg);
    }
    return res.json();
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    setBusy(true);
    setErr(null);
    authedFetch("/api/account/usage")
      .then(setUsage)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  }, [loading, user, authedFetch]);

  /* Not logged in */
  if (!loading && !user) {
    return (
      <main className="px-5 md:px-8 pt-10 pb-16 max-w-3xl mx-auto">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--brand)" }}>
          Il tuo account
        </p>
        <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Accedi per vedere il tuo profilo
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Effettua l&apos;accesso per vedere consumo API, spesa stimata e cronologia delle tue generazioni.
        </p>
        <button
          onClick={() => document.dispatchEvent(new CustomEvent("open-auth-modal", { detail: "login" }))}
          className="btn-primary text-sm" style={{ padding: "0.625rem 1.25rem" }}>
          Accedi
        </button>
      </main>
    );
  }

  const initials = user?.user_metadata?.display_name
    ? (user.user_metadata.display_name as string).slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "AI";

  const maxMonth = usage ? Math.max(1, ...usage.byMonth.map((m) => m.spend)) : 1;

  return (
    <main className="px-5 md:px-8 pt-6 md:pt-10 pb-16 max-w-4xl mx-auto">
      {/* Profile header */}
      <header className="mb-8 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shrink-0"
          style={{ background: "linear-gradient(135deg, var(--brand-deep), var(--brand-soft))" }}>
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {(user?.user_metadata?.display_name as string) ?? user?.email?.split("@")[0] ?? "Account"}
          </h1>
          <p className="text-sm truncate" style={{ color: "var(--text-muted)" }}>{user?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="ml-auto text-xs px-3 py-2 rounded-lg font-semibold shrink-0"
          style={{ background: "var(--bg-card-hover)", color: "#B91C1C", border: "1px solid var(--border)" }}>
          Esci
        </button>
      </header>

      {busy && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl skeleton-shimmer skeleton-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      )}

      {err && (
        <div className="px-4 py-3 rounded-lg text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#B91C1C" }}>
          ✕ {err}
        </div>
      )}

      {!busy && !err && usage && (
        <div className="space-y-6">
          {/* Spend cards */}
          <section>
            <h2 className="text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: "var(--text-muted)" }}>
              Consumo API
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Spesa totale"   value={`$${usage.totalSpend.toFixed(2)}`} accent="var(--brand)" big />
              <Stat label="Ultimi 30 gg"   value={`$${usage.last30Spend.toFixed(2)}`} accent="#15803D" sub={`${usage.last30Runs} run`} />
              <Stat label="Generazioni"    value={String(usage.totalRuns)} accent="var(--text-primary)" />
              <Stat label="Cache hit"      value={`${usage.totalRuns ? Math.round((usage.cacheHits / usage.totalRuns) * 100) : 0}%`} accent="#FCD34D" sub={`${usage.cacheHits} run`} />
            </div>
            <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
              Stima basata sui modelli realmente usati ($0.10/Pro · $0.04/Flash · $0.08/OpenAI + $0.028 scraping&nbsp;+&nbsp;analisi quando non in cache). I costi reali sui dashboard dei provider possono variare.
            </p>
          </section>

          {/* Monthly bars */}
          {usage.byMonth.length > 0 && (
            <section className="card-step p-5">
              <h2 className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: "var(--text-muted)" }}>
                Spesa per mese
              </h2>
              <div className="flex items-end gap-2 h-40">
                {usage.byMonth.slice().reverse().map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                      ${m.spend.toFixed(2)}
                    </span>
                    <div className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${Math.max(4, (m.spend / maxMonth) * 120)}px`,
                        background: "linear-gradient(180deg, var(--brand-soft), var(--brand))",
                      }}
                      title={`${m.runs} run · $${m.spend.toFixed(2)}`} />
                    <span className="text-[9px] uppercase tracking-wide truncate w-full text-center"
                      style={{ color: "var(--text-muted)" }}>
                      {monthLabel(m.month)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent runs */}
          <section className="card-step p-5">
            <h2 className="text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: "var(--text-muted)" }}>
              Ultime generazioni
            </h2>
            {usage.recent.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Nessuna generazione registrata sul tuo account.{" "}
                <Link href="/" className="underline" style={{ color: "var(--brand)" }}>Inizia ora</Link>.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {usage.recent.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs py-1"
                    style={{ borderBottom: i < usage.recent.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <Link href={`/run/${r.asin}`} className="font-mono font-semibold hover:underline"
                      style={{ color: "var(--text-primary)" }}>{r.asin}</Link>
                    {r.cache_hit && (
                      <span className="text-[9px] px-1 rounded"
                        style={{ background: "rgba(22,163,74,0.12)", color: "#15803D" }}>⚡</span>
                    )}
                    <span className="ml-auto font-mono" style={{ color: "var(--text-muted)" }}>
                      ${r.cost_usd.toFixed(2)}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{relativeTime(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {usage.totalRuns === 0 && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Suggerimento: il consumo viene tracciato solo per le generazioni fatte mentre sei
              loggato. Se hai generato da ospite quei costi non compaiono qui.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, accent, sub, big }: { label: string; value: string; accent: string; sub?: string; big?: boolean }) {
  return (
    <div className="card-step p-4">
      <p className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className={`font-bold leading-none ${big ? "text-2xl md:text-3xl" : "text-xl"}`} style={{ color: accent }}>{value}</p>
      {sub && <p className="text-[10px] mt-1 font-mono" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}
