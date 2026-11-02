"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Deal, Settings } from "@/lib/types";

const POLL_MS = 60_000;
const SEEN_KEY = "smh_seen_v1";

const eur = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ora";
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h fa` : `${Math.round(h / 24)} g fa`;
}

function shortCondition(c: string | null) {
  if (!c) return "—";
  return c.replace(/^usato\s*[-–]\s*/i, "").replace(/condizioni/i, "").trim() || c;
}

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveSeen(s: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-3000)));
  } catch {
    /* storage non disponibile */
  }
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* audio non disponibile */
  }
}

export default function Dashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [showAll, setShowAll] = useState(false);
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [minMargin, setMinMargin] = useState(20);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"margin" | "profit" | "recent">("margin");

  const [notifyOn, setNotifyOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const seenRef = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals${showAll ? "?all=1" : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      const list: Deal[] = data.deals ?? [];
      setDeals(list);
      setSettings(data.settings);
      setError("");
      setUpdatedAt(new Date());

      // notifiche browser per offerte nuove sopra soglia
      if (!seenRef.current) seenRef.current = loadSeen();
      const seen = seenRef.current;
      const firstRun = seen.size === 0;
      const s: Settings | null = data.settings;
      const hot = list.filter(
        (d) =>
          d.active &&
          (d.margin_pct ?? 0) >= (s?.alert_margin_pct ?? 40) &&
          (d.profit_eur ?? 0) >= (s?.alert_profit_eur ?? 50) &&
          !seen.has(`${d.asin}:${d.used_price}`),
      );
      list.forEach((d) => seen.add(`${d.asin}:${d.used_price}`));
      saveSeen(seen);
      if (!firstRun && hot.length && typeof Notification !== "undefined" && Notification.permission === "granted") {
        beep();
        hot.slice(0, 5).forEach((d) => {
          const n = new Notification(`🔥 ${d.margin_pct?.toFixed(0)}% · +${eur(d.profit_eur)}`, {
            body: `${(d.title || d.asin).slice(0, 90)}\nSeconda Mano ${eur(d.used_price)} → costo ${eur(d.your_cost)}`,
            icon: d.image_url || undefined,
            tag: d.asin,
          });
          n.onclick = () => window.open(`https://www.amazon.it/dp/${d.asin}`, "_blank");
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setNotifyOn(typeof Notification !== "undefined" && Notification.permission === "granted"), 0);
    return () => clearTimeout(t);
  }, []);

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") return alert("Questo browser non supporta le notifiche.");
    const p = await Notification.requestPermission();
    setNotifyOn(p === "granted");
    if (p === "granted") new Notification("Notifiche attive ✅", { body: "Ti avviso quando arriva un'offerta sopra soglia." });
  };

  const categories = useMemo(() => [...new Set(deals.map((d) => d.category).filter(Boolean))].sort() as string[], [deals]);
  const conditions = useMemo(
    () => [...new Set(deals.map((d) => shortCondition(d.used_condition)).filter((c) => c !== "—"))].sort(),
    [deals],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = deals.filter(
      (d) =>
        (d.margin_pct ?? -999) >= minMargin &&
        (!category || d.category === category) &&
        (!condition || shortCondition(d.used_condition) === condition) &&
        (!q || (d.title || "").toLowerCase().includes(q) || d.asin.toLowerCase().includes(q)),
    );
    if (sort === "profit") out.sort((a, b) => (b.profit_eur ?? 0) - (a.profit_eur ?? 0));
    else if (sort === "recent") out.sort((a, b) => +new Date(b.first_seen_at) - +new Date(a.first_seen_at));
    else out.sort((a, b) => (b.margin_pct ?? 0) - (a.margin_pct ?? 0));
    return out;
  }, [deals, minMargin, category, condition, query, sort]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seconda Mano Hunter</h1>
          <p className="text-sm text-neutral-400">
            Offerte Amazon Seconda Mano ≥ {eur(settings?.min_used_price ?? 100)} · costo calcolato con sconto{" "}
            {settings?.discount_pct ?? 22}% · riferimento = prezzo nuovo medio 90 gg
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={enableNotifications}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${notifyOn ? "bg-emerald-900/60 text-emerald-300" : "bg-amber-500 text-black hover:bg-amber-400"}`}
          >
            {notifyOn ? "🔔 Notifiche attive" : "🔔 Attiva notifiche"}
          </button>
          <button onClick={() => setShowSettings((v) => !v)} className="rounded-lg bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700">
            ⚙️ Soglie
          </button>
          <button onClick={load} className="rounded-lg bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700">
            ↻ Aggiorna
          </button>
        </div>
      </header>

      {showSettings && settings && <SettingsPanel settings={settings} onSaved={(s) => { setSettings(s); load(); }} />}

      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca titolo o ASIN"
          className="col-span-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
          <option value="">Tutte le categorie</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
          <option value="">Tutte le condizioni</option>
          {conditions.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
          <option value="margin">Ordina: margine %</option>
          <option value="profit">Ordina: guadagno €</option>
          <option value="recent">Ordina: più recenti</option>
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
          <span className="whitespace-nowrap text-neutral-400">Margine ≥</span>
          <input type="number" value={minMargin} onChange={(e) => setMinMargin(Number(e.target.value))} className="w-14 bg-transparent outline-none" />
          %
        </label>
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>
          {filtered.length} offerte {showAll ? "(incluse non più disponibili)" : "attive"}
          {updatedAt && ` · aggiornato ${updatedAt.toLocaleTimeString("it-IT")}`}
        </span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          mostra anche offerte sparite
        </label>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-950 p-3 text-sm text-red-300">Errore: {error}</p>}
      {loading && <p className="text-neutral-500">Caricamento…</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-neutral-500">
          Nessuna offerta con questi filtri. Lo scanner sul PC è acceso?
        </p>
      )}

      <div className="grid gap-3">
        {filtered.map((d) => <DealRow key={d.asin} d={d} />)}
      </div>
    </main>
  );
}

function marginColor(m: number | null) {
  if (m == null) return "text-neutral-400";
  if (m >= 40) return "text-emerald-400";
  if (m >= 25) return "text-amber-300";
  return "text-neutral-300";
}

function DealRow({ d }: { d: Deal }) {
  const url = `https://www.amazon.it/dp/${d.asin}`;
  const newRef = d.new_price != null ? "Amazon" : "altri venditori";
  return (
    <article className={`grid grid-cols-[64px_1fr] gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 sm:grid-cols-[80px_1fr_auto] ${d.active ? "" : "opacity-50"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={d.image_url || ""} alt="" className="h-16 w-16 rounded-lg bg-white object-contain sm:h-20 sm:w-20" />
      <div className="min-w-0">
        <a href={url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-medium hover:text-amber-400">
          {d.title || d.asin}
        </a>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-400">
          <span className="rounded bg-neutral-800 px-1.5 py-0.5">{d.category}</span>
          <span>{d.used_condition || "condizione ?"}</span>
          <span className="font-mono">{d.asin}</span>
          <span>visto {ago(d.first_seen_at)}</span>
          {!d.active && <span className="text-red-400">non più disponibile</span>}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs sm:max-w-lg">
          <div>
            <div className="text-neutral-500">Seconda Mano</div>
            <div className="text-sm font-semibold">{eur(d.used_price)}</div>
          </div>
          <div>
            <div className="text-neutral-500">Tuo costo</div>
            <div className="text-sm font-semibold text-amber-300">{eur(d.your_cost)}</div>
          </div>
          <div>
            <div className="text-neutral-500" title={`Media 90gg ${eur(d.avg_new_90d)} · ${d.n_checks} controlli · nuovo da ${newRef}`}>
              Nuovo (rif.)
            </div>
            <div className="text-sm font-semibold">{eur(d.ref_price)}</div>
          </div>
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-4 border-t border-neutral-800 pt-2 sm:col-span-1 sm:flex-col sm:items-end sm:justify-center sm:border-0 sm:pt-0">
        <div className={`text-2xl font-bold ${marginColor(d.margin_pct)}`}>{d.margin_pct?.toFixed(0)}%</div>
        <div className="text-sm text-neutral-300">+{eur(d.profit_eur)}</div>
        <a href={url} target="_blank" rel="noreferrer" className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400">
          Apri su Amazon
        </a>
      </div>
    </article>
  );
}

function SettingsPanel({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [form, setForm] = useState(settings);
  const [msg, setMsg] = useState("");
  const field = (k: keyof Settings, label: string, unit: string) => (
    <label className="text-sm">
      <span className="mb-1 block text-neutral-400">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
        <input
          type="number"
          value={form[k]}
          onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
          className="w-full bg-transparent outline-none"
        />
        <span className="text-neutral-500">{unit}</span>
      </div>
    </label>
  );
  const save = async () => {
    const res = await fetch("/api/settings", { method: "POST", body: JSON.stringify(form) });
    const data = await res.json();
    if (res.ok) {
      setMsg("Salvato ✅");
      onSaved(data.settings);
    } else setMsg(`Errore: ${data.error}`);
  };
  return (
    <section className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {field("discount_pct", "Vostro sconto", "%")}
        {field("min_used_price", "Prezzo minimo usato", "€")}
        {field("alert_margin_pct", "Avviso se margine ≥", "%")}
        {field("alert_profit_eur", "Avviso se guadagno ≥", "€")}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400">Salva</button>
        <span className="text-sm text-neutral-400">{msg}</span>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Valgono sia per la dashboard sia per gli avvisi Telegram. Il prezzo minimo usato nello scanner si cambia in scraper/.env (MIN_USED_PRICE).
      </p>
    </section>
  );
}
