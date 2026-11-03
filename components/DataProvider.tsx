"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Deal, InventoryInput, InventoryItem, ScannerStatus, Settings, Triage } from "@/lib/types";
import { amazonUrl, eur } from "@/lib/format";

const POLL_MS = 60_000;
const SEEN_KEY = "smh_seen_v1";

interface Ctx {
  deals: Deal[];
  settings: Settings | null;
  scanner: ScannerStatus;
  inventory: InventoryItem[];
  loading: boolean;
  error: string;
  updatedAt: Date | null;
  notifyOn: boolean;
  /** true dopo il login admin (o se il sito non ha password) */
  admin: boolean;
  logout: () => Promise<void>;
  enableNotifications: () => Promise<void>;
  refresh: () => Promise<void>;
  setTriage: (asin: string, triage: Triage) => Promise<void>;
  saveSettings: (s: Settings) => Promise<string | null>;
  addItem: (row: InventoryInput) => Promise<string | null>;
  updateItem: (id: number, row: InventoryInput) => Promise<string | null>;
  deleteItem: (id: number) => Promise<string | null>;
}

const DataCtx = createContext<Ctx | null>(null);

export function useData() {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData fuori da DataProvider");
  return c;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [scanner, setScanner] = useState<ScannerStatus>({ last_check: null });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [notifyOn, setNotifyOn] = useState(false);
  const [admin, setAdmin] = useState(false);
  const seenRef = useRef<Set<string> | null>(null);

  const notifyNew = useCallback((list: Deal[], s: Settings | null) => {
    if (!seenRef.current) seenRef.current = loadSeen();
    const seen = seenRef.current;
    const firstRun = seen.size === 0;
    const hot = list.filter(
      (d) =>
        d.active &&
        d.triage !== "ignorato" &&
        d.triage !== "acquistato" &&
        (d.margin_pct ?? 0) >= (s?.alert_margin_pct ?? 40) &&
        (d.profit_eur ?? 0) >= (s?.alert_profit_eur ?? 50) &&
        !seen.has(`${d.asin}:${d.used_price}`),
    );
    list.forEach((d) => seen.add(`${d.asin}:${d.used_price}`));
    saveSeen(seen);
    if (firstRun || !hot.length || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    beep();
    hot.slice(0, 5).forEach((d) => {
      const n = new Notification(`🔥 ${d.margin_pct?.toFixed(0)}% · +${eur(d.profit_eur, 0)}`, {
        body: `${(d.title || d.asin).slice(0, 90)}\nSeconda Mano ${eur(d.used_price)} → costo ${eur(d.your_cost)}`,
        icon: d.image_url || undefined,
        tag: d.asin,
      });
      n.onclick = () => window.open(amazonUrl(d.asin), "_blank");
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = await call<{ deals: Deal[]; settings: Settings; scanner: ScannerStatus; admin: boolean }>("/api/deals");
      // il magazzino è riservato: lo carica solo chi ha fatto l'accesso admin
      const inv = d.admin ? await call<{ items: InventoryItem[] }>("/api/inventory") : { items: [] };
      setDeals(d.deals ?? []);
      setSettings(d.settings);
      setScanner(d.scanner);
      setAdmin(!!d.admin);
      setInventory(inv.items ?? []);
      setError("");
      setUpdatedAt(new Date());
      notifyNew(d.deals ?? [], d.settings);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [notifyNew]);

  useEffect(() => {
    const first = setTimeout(() => {
      setNotifyOn(typeof Notification !== "undefined" && Notification.permission === "granted");
      refresh();
    }, 0);
    const t = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") return alert("Questo browser non supporta le notifiche.");
    const p = await Notification.requestPermission();
    setNotifyOn(p === "granted");
    if (p === "granted") new Notification("Notifiche attive ✅", { body: "Ti avviso quando arriva un'offerta sopra soglia." });
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  };

  const setTriage = async (asin: string, triage: Triage) => {
    setDeals((prev) => prev.map((d) => (d.asin === asin ? { ...d, triage } : d)));
    try {
      await call(`/api/products/${asin}`, { method: "PATCH", body: JSON.stringify({ triage }) });
    } catch (e) {
      setError((e as Error).message);
      refresh();
    }
  };

  const wrap = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };

  const saveSettings = (s: Settings) => wrap(() => call("/api/settings", { method: "POST", body: JSON.stringify(s) }));
  const addItem = (row: InventoryInput) => wrap(() => call("/api/inventory", { method: "POST", body: JSON.stringify(row) }));
  const updateItem = (id: number, row: InventoryInput) =>
    wrap(() => call(`/api/inventory/${id}`, { method: "PATCH", body: JSON.stringify(row) }));
  const deleteItem = (id: number) => wrap(() => call(`/api/inventory/${id}`, { method: "DELETE" }));

  return (
    <DataCtx.Provider
      value={{
        deals, settings, scanner, inventory, loading, error, updatedAt, notifyOn, admin, logout,
        enableNotifications, refresh, setTriage, saveSettings, addItem, updateItem, deleteItem,
      }}
    >
      {children}
    </DataCtx.Provider>
  );
}
