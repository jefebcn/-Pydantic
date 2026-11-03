"use client";

import { useState } from "react";
import { Button, Field, Modal, inputCls } from "./ui";
import { useData } from "./DataProvider";
import { CHANNELS, STATUS_LABEL, STATUS_ORDER, type InventoryInput, type InventoryItem, type InventoryStatus } from "@/lib/types";
import { eur, todayISO } from "@/lib/format";

type Form = Record<string, string>;

const toForm = (v: InventoryInput | InventoryItem): Form => {
  const f: Form = {};
  for (const [k, val] of Object.entries(v)) f[k] = val == null ? "" : String(val);
  return f;
};

const num = (s: string | undefined) => (s && s.trim() !== "" && Number.isFinite(Number(s.replace(",", "."))) ? Number(s.replace(",", ".")) : null);

/** Modale per aggiungere o modificare un pezzo di magazzino. `item.id` presente = modifica. */
export function InventoryModal({ item, onClose }: { item: (InventoryInput & { id?: number }) | null; onClose: () => void }) {
  return item ? <Inner key={item.id ?? item.asin ?? "new"} item={item} onClose={onClose} /> : null;
}

function Inner({ item, onClose }: { item: InventoryInput & { id?: number }; onClose: () => void }) {
  const { addItem, updateItem, deleteItem } = useData();
  const editing = item.id != null;
  const [f, setF] = useState<Form>(() => toForm({ status: "ordinato", purchased_at: todayISO(), sale_fees: 0, ...item }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setF((p) => ({ ...p, [k]: v, ...(k === "status" && v === "venduto" && !p.sold_at ? { sold_at: todayISO() } : {}) }));
  };

  const cost = num(f.purchase_cost);
  const expected = cost != null && num(f.target_price) != null ? num(f.target_price)! - cost : null;
  const real = cost != null && num(f.sale_price) != null ? num(f.sale_price)! - (num(f.sale_fees) ?? 0) - cost : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title?.trim() || cost == null) return setErr("Servono almeno titolo e costo d'acquisto.");
    setBusy(true);
    const payload: Record<string, string | number | null> = {};
    for (const k of ["asin", "title", "image_url", "condition", "status", "purchased_at", "channel", "sold_at", "notes"]) payload[k] = f[k] ?? "";
    for (const k of ["list_price", "purchase_cost", "ref_price", "target_price", "sale_price", "sale_fees"]) payload[k] = num(f[k]);
    const e2 = editing ? await updateItem(item.id!, payload as InventoryInput) : await addItem(payload as InventoryInput);
    setBusy(false);
    if (e2) setErr(e2);
    else onClose();
  };

  const remove = async () => {
    if (!editing || !confirm("Eliminare questo pezzo dal magazzino?")) return;
    setBusy(true);
    const e2 = await deleteItem(item.id!);
    setBusy(false);
    if (e2) setErr(e2);
    else onClose();
  };

  return (
    <Modal open onClose={onClose} title={editing ? "Modifica pezzo" : "Nuovo acquisto"}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Prodotto" className="col-span-2">
          <input className={inputCls} value={f.title ?? ""} onChange={set("title")} placeholder="Es. MacBook Air M3 13''" />
        </Field>
        <Field label="ASIN">
          <input className={inputCls} value={f.asin ?? ""} onChange={set("asin")} placeholder="B0…" />
        </Field>
        <Field label="Condizione">
          <input className={inputCls} value={f.condition ?? ""} onChange={set("condition")} placeholder="Come nuovo / Ottime…" />
        </Field>
        <Field label="Stato">
          <select className={inputCls} value={f.status} onChange={set("status")}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s as InventoryStatus]}</option>)}
          </select>
        </Field>
        <Field label="Data acquisto">
          <input type="date" className={inputCls} value={f.purchased_at ?? ""} onChange={set("purchased_at")} />
        </Field>

        <div className="col-span-2 mt-1 text-[11px] font-semibold text-muted">Acquisto</div>
        <Field label="Prezzo Seconda Mano (€)">
          <input inputMode="decimal" className={inputCls} value={f.list_price ?? ""} onChange={set("list_price")} />
        </Field>
        <Field label="Costo reale pagato (€) *">
          <input inputMode="decimal" className={inputCls} value={f.purchase_cost ?? ""} onChange={set("purchase_cost")} />
        </Field>
        <Field label="Prezzo nuovo di riferimento (€)">
          <input inputMode="decimal" className={inputCls} value={f.ref_price ?? ""} onChange={set("ref_price")} />
        </Field>
        <Field label="Prezzo obiettivo rivendita (€)">
          <input inputMode="decimal" className={inputCls} value={f.target_price ?? ""} onChange={set("target_price")} />
        </Field>

        <div className="col-span-2 mt-1 text-[11px] font-semibold text-muted">Rivendita</div>
        <Field label="Canale">
          <select className={inputCls} value={f.channel ?? ""} onChange={set("channel")}>
            <option value="">—</option>
            {CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Data vendita">
          <input type="date" className={inputCls} value={f.sold_at ?? ""} onChange={set("sold_at")} />
        </Field>
        <Field label="Prezzo di vendita (€)">
          <input inputMode="decimal" className={inputCls} value={f.sale_price ?? ""} onChange={set("sale_price")} />
        </Field>
        <Field label="Commissioni + spedizione (€)">
          <input inputMode="decimal" className={inputCls} value={f.sale_fees ?? ""} onChange={set("sale_fees")} />
        </Field>
        <Field label="Note" className="col-span-2">
          <textarea className={`${inputCls} h-20 py-2`} value={f.notes ?? ""} onChange={set("notes")} />
        </Field>

        <div className="col-span-2 grid grid-cols-2 gap-3 rounded-xl bg-soft p-3 text-sm">
          <div>
            <div className="text-xs text-muted">Guadagno previsto</div>
            <div className="font-semibold tabular-nums">{eur(expected)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Guadagno reale</div>
            <div className={`font-semibold tabular-nums ${real == null ? "" : real >= 0 ? "text-gain" : "text-red-600"}`}>{eur(real)}</div>
          </div>
        </div>

        {err && <p className="col-span-2 text-sm text-red-600">{err}</p>}
        <div className="col-span-2 flex items-center justify-between gap-2 pt-1">
          {editing ? <Button type="button" variant="danger" onClick={remove} disabled={busy}>Elimina</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Salvo…" : "Salva"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
