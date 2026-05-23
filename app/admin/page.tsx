"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, supabaseBrowser } from "@/lib/auth-context";

interface Stats {
  totalUsers: number;
  totalRuns: number;
  totalSpend: number;
  cacheHitRate: number;
  last7Days: number;
  topAsins: Array<{ asin: string; count: number; spend: number }>;
}

interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  run_count: number;
  total_spend: number;
}

interface RunRow {
  id: string;
  asin: string;
  cache_hit: boolean;
  num_images_ok: number;
  num_images_failed: number;
  duration_ms: number | null;
  cost_usd: number | null;
  accent_color: string | null;
  categoria_effetto: string | null;
  created_at: string;
}

function isAdminEmailClient(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    .includes(email.toLowerCase());
}

function relativeTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "adesso";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [stats, setStats]   = useState<Stats | null>(null);
  const [users, setUsers]   = useState<UserRow[]>([]);
  const [runs,  setRuns]    = useState<RunRow[]>([]);
  const [err,   setErr]     = useState<string | null>(null);
  const [busy,  setBusy]    = useState(true);
  const [tab,   setTab]     = useState<"overview" | "users" | "runs">("overview");

  /* Client-side allow check (UI gate only — real gate is server-side) */
  const allowed = !loading && isAdminEmailClient(user?.email);

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
    if (!allowed) return;
    setBusy(true);
    setErr(null);
    Promise.all([
      authedFetch("/api/admin/stats"),
      authedFetch("/api/admin/users"),
      authedFetch("/api/admin/runs?limit=200"),
    ])
      .then(([s, u, r]) => {
        setStats(s);
        setUsers(u.users ?? []);
        setRuns(r.runs ?? []);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  }, [allowed, authedFetch]);

  /* Loading auth */
  if (loading) {
    return (
      <main className="px-5 md:px-8 pt-10 pb-16 max-w-5xl mx-auto">
        <div className="h-24 rounded-xl skeleton-shimmer skeleton-pulse" />
      </main>
    );
  }

  /* Not allowed */
  if (!allowed) {
    return (
      <main className="px-5 md:px-8 pt-10 pb-16 max-w-3xl mx-auto">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-3"
          style={{ color: "var(--brand)" }}>
          Area riservata
        </p>
        <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Accesso amministratore richiesto
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          {user
            ? <>L&apos;account <span className="font-mono">{user.email}</span> non ha permessi di amministrazione.</>
            : "Devi essere autenticato come amministratore per vedere questa pagina."}
        </p>
        <div className="flex gap-2 flex-wrap">
          {!user && (
            <button
              onClick={() => document.dispatchEvent(new CustomEvent("open-auth-modal", { detail: "login" }))}
              className="btn-primary text-sm" style={{ padding: "0.625rem 1.25rem" }}>
              Accedi
            </button>
          )}
          <Link href="/" className="text-sm px-4 py-2.5 rounded-lg font-semibold"
            style={{
              background: "var(--bg-card-hover)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}>
            Torna alla home
          </Link>
        </div>
        <details className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
          <summary className="cursor-pointer">Come abilitare un nuovo admin?</summary>
          <p className="mt-2 leading-relaxed">
            Su Vercel → Settings → Environment Variables aggiungi (o aggiorna)
            <code className="px-1 py-0.5 rounded mx-1"
              style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)" }}>
              ADMIN_EMAILS
            </code>
            con l&apos;elenco email separato da virgola.
            Aggiungi anche
            <code className="px-1 py-0.5 rounded mx-1"
              style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)" }}>
              NEXT_PUBLIC_ADMIN_EMAILS
            </code>
            con lo stesso valore (lo usa il client per mostrare il link sidebar).
          </p>
        </details>
      </main>
    );
  }

  return (
    <main className="px-5 md:px-8 pt-6 md:pt-10 pb-16 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-3"
          style={{ color: "var(--brand)" }}>
          PYDANTIC · Pannello admin
        </p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}>
          Dashboard <span className="gradient-text">amministratore</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {user?.email} · accesso completo a utenti, run e statistiche.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["overview", "users", "runs"] as const).map((t) => (
          <button key={t}
            onClick={() => setTab(t)}
            className="text-xs px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap"
            style={{
              background: tab === t ? "var(--brand)" : "var(--bg-card-hover)",
              color: tab === t ? "white" : "var(--text-muted)",
              border: tab === t ? "1px solid var(--brand)" : "1px solid var(--border)",
            }}>
            {t === "overview" ? "Overview" : t === "users" ? `Utenti (${users.length})` : `Run (${runs.length})`}
          </button>
        ))}
      </div>

      {busy && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl skeleton-shimmer skeleton-pulse"
              style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      )}

      {err && (
        <div className="px-4 py-3 rounded-lg text-sm mb-4"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#B91C1C" }}>
          ✕ {err}
        </div>
      )}

      {!busy && !err && stats && tab === "overview" && (
        <OverviewView stats={stats} runs={runs} users={users} />
      )}
      {!busy && !err && tab === "users" && (
        <UsersTable rows={users} />
      )}
      {!busy && !err && tab === "runs" && (
        <RunsTable rows={runs} />
      )}
    </main>
  );
}

/* ── Tabs ──────────────────────────────────────────────────────────────── */

function OverviewView({ stats, runs, users }: { stats: Stats; runs: RunRow[]; users: UserRow[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Utenti registrati" value={String(stats.totalUsers)} accent="var(--brand)" />
        <Stat label="Run totali" value={String(stats.totalRuns)} accent="var(--brand-deep, var(--brand))" sub={`${stats.last7Days} ultimi 7gg`} />
        <Stat label="Spesa totale" value={`$${stats.totalSpend.toFixed(2)}`} accent="#15803D" />
        <Stat label="Cache hit rate" value={`${stats.cacheHitRate}%`} accent="#FCD34D" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Top 10 ASIN per generazioni">
          {stats.topAsins.length === 0
            ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nessun dato.</p>
            : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    <th className="text-left pb-2">ASIN</th>
                    <th className="text-right pb-2">Run</th>
                    <th className="text-right pb-2">$</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topAsins.map((a) => (
                    <tr key={a.asin} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="py-2 font-mono font-semibold" style={{ color: "var(--text-primary)" }}>{a.asin}</td>
                      <td className="py-2 text-right">{a.count}</td>
                      <td className="py-2 text-right font-mono">${a.spend.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>

        <Card title="Ultime 5 run">
          {runs.length === 0
            ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nessun dato.</p>
            : (
              <ul className="space-y-2">
                {runs.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full"
                      style={{ background: r.accent_color ?? "var(--brand)" }} />
                    <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>{r.asin}</span>
                    <span style={{ color: "var(--text-muted)" }}>{r.num_images_ok}/{(r.num_images_ok ?? 0) + (r.num_images_failed ?? 0)} img</span>
                    <span className="ml-auto" style={{ color: "var(--text-muted)" }}>{relativeTime(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <Card title="Ultimi 5 iscritti">
        {users.length === 0
          ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nessun utente.</p>
          : (
            <ul className="space-y-2">
              {users.slice(0, 5).map((u) => (
                <li key={u.id} className="flex items-center gap-2 text-xs">
                  <span className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black text-white"
                    style={{ background: "var(--brand)" }}>
                    {(u.display_name ?? u.email ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {u.display_name ?? u.email ?? u.id}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {u.email} · iscritto {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </Card>
    </div>
  );
}

function UsersTable({ rows }: { rows: UserRow[] }) {
  if (rows.length === 0) return <Card title="Utenti"><p className="text-xs" style={{ color: "var(--text-muted)" }}>Nessun utente registrato.</p></Card>;
  return (
    <Card title={`Utenti registrati · ${rows.length}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              <th className="text-left pb-2">Email</th>
              <th className="text-left pb-2 hidden sm:table-cell">Nome</th>
              <th className="text-left pb-2 hidden md:table-cell">Iscritto</th>
              <th className="text-left pb-2 hidden md:table-cell">Ultimo login</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="py-2 font-mono" style={{ color: "var(--text-primary)" }}>{u.email}</td>
                <td className="py-2 hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>{u.display_name ?? "—"}</td>
                <td className="py-2 hidden md:table-cell" style={{ color: "var(--text-muted)" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="py-2 hidden md:table-cell" style={{ color: "var(--text-muted)" }}>{u.last_sign_in_at ? relativeTime(u.last_sign_in_at) : "mai"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RunsTable({ rows }: { rows: RunRow[] }) {
  if (rows.length === 0) return <Card title="Run"><p className="text-xs" style={{ color: "var(--text-muted)" }}>Nessuna run registrata.</p></Card>;
  return (
    <Card title={`Tutte le run · ${rows.length}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              <th className="text-left pb-2">ASIN</th>
              <th className="text-left pb-2 hidden sm:table-cell">Effetto</th>
              <th className="text-right pb-2">Img</th>
              <th className="text-right pb-2 hidden sm:table-cell">Dur</th>
              <th className="text-right pb-2">$</th>
              <th className="text-left pb-2">Cache</th>
              <th className="text-right pb-2">Quando</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ok     = r.num_images_ok ?? 0;
              const total  = ok + (r.num_images_failed ?? 0);
              const dur    = r.duration_ms ? (r.duration_ms / 1000).toFixed(1) + "s" : "—";
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="py-2 font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                    <Link href={`/run/${r.asin}`} className="hover:underline">{r.asin}</Link>
                  </td>
                  <td className="py-2 hidden sm:table-cell" style={{ color: r.accent_color ?? "var(--text-muted)" }}>
                    {r.categoria_effetto ?? "—"}
                  </td>
                  <td className="py-2 text-right" style={{ color: ok === total ? "var(--text-primary)" : "#B91C1C" }}>
                    {ok}/{total}
                  </td>
                  <td className="py-2 text-right hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>{dur}</td>
                  <td className="py-2 text-right font-mono" style={{ color: "var(--text-muted)" }}>
                    ${(r.cost_usd ?? 0).toFixed(2)}
                  </td>
                  <td className="py-2">
                    {r.cache_hit
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(22,163,74,0.12)", color: "#15803D" }}>⚡</span>
                      : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td className="py-2 text-right" style={{ color: "var(--text-muted)" }}>
                    {relativeTime(r.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Bits ──────────────────────────────────────────────────────────────── */

function Stat({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="card-step p-4">
      <p className="text-[10px] font-semibold tracking-wider uppercase mb-1"
        style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-xl md:text-2xl font-bold leading-none" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-[10px] mt-1 font-mono" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-step p-4 md:p-5">
      <p className="text-xs font-semibold tracking-wider uppercase mb-3"
        style={{ color: "var(--text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}
