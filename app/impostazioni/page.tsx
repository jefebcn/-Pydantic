"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { StatusBanner } from "@/components/StatusBanner";
import { Button, Card, Field, PageHeader, inputCls } from "@/components/ui";
import type { Settings } from "@/lib/types";
import { ago } from "@/lib/format";

function SettingsForm({ settings }: { settings: Settings }) {
  const { saveSettings } = useData();
  const [form, setForm] = useState(settings);
  const [msg, setMsg] = useState("");
  const field = (k: keyof Settings, label: string, unit: string) => (
    <Field label={label}>
      <div className={`${inputCls} flex items-center gap-2`}>
        <input type="number" value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} className="w-full bg-transparent outline-none" />
        <span className="text-muted">{unit}</span>
      </div>
    </Field>
  );
  const save = async () => {
    setMsg("Salvo…");
    const e = await saveSettings(form);
    setMsg(e ? `Errore: ${e}` : "Salvato ✅");
  };
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-bold">Calcolo e avvisi</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("discount_pct", "Vostro sconto sugli acquisti Amazon", "%")}
        {field("min_used_price", "Prezzo minimo usato (solo informativo)", "€")}
        {field("alert_margin_pct", "Avvisa se il margine è almeno", "%")}
        {field("alert_profit_eur", "…e il guadagno è almeno", "€")}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" onClick={save}>Salva</Button>
        <span className="text-sm text-muted">{msg}</span>
      </div>
      <p className="mt-3 text-xs text-muted">
        Valgono per la dashboard e per gli avvisi Telegram. Il prezzo minimo con cui lo scanner cerca si cambia in <code>scraper/.env</code> (MIN_USED_PRICE).
      </p>
    </Card>
  );
}

const STEPS = [
  ["Database", "Nuovo progetto su supabase.com → SQL Editor → incolla ed esegui supabase/schema.sql."],
  ["Vercel", "Settings → Environment Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e DASHBOARD_PASSWORD (la password admin: senza, chiunque può modificare) → Redeploy."],
  ["Telegram", "@BotFather → /newbot. Token e chat id vanno in scraper/.env sul PC."],
  ["Scanner", "Sul PC: copia scraper/.env.example in scraper/.env, compila, poi doppio click su avvia-scanner.bat."],
];

export default function SettingsPage() {
  const { settings, scanner, notifyOn, enableNotifications } = useData();
  return (
    <>
      <PageHeader title="Impostazioni" subtitle="Soglie, notifiche e stato del sistema" />
      <StatusBanner />
      <div className="grid gap-4 lg:grid-cols-2">
        {settings ? <SettingsForm key={JSON.stringify(settings)} settings={settings} /> : <Card className="p-5 text-sm text-muted">Impostazioni non disponibili finché il database non è collegato.</Card>}

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="mb-3 font-bold">Stato</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Ultimo controllo scanner</dt>
              <dd>{ago(scanner.last_check)}</dd>
              <dt className="text-muted">Database collegato</dt>
              <dd className="break-all font-mono text-xs leading-5" title="Deve coincidere con SUPABASE_URL in scraper/.env">
                {scanner.db ?? "—"}
              </dd>
              <dt className="text-muted">Notifiche browser</dt>
              <dd>
                {notifyOn ? "attive su questo dispositivo" : (
                  <button onClick={enableNotifications} className="text-ink underline hover:underline">attiva su questo dispositivo</button>
                )}
              </dd>
            </dl>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-bold">Setup in 4 passi</h2>
            <ol className="space-y-3 text-sm">
              {STEPS.map(([t, d], n) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream text-xs font-semibold text-ink">{n + 1}</span>
                  <span><b className="text-ink">{t}.</b> <span className="text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
