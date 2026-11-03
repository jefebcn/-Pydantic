export type Triage = "da_valutare" | "interessante" | "ignorato" | "acquistato";

export interface Deal {
  asin: string;
  title: string | null;
  category: string | null;
  image_url: string | null;
  triage: Triage;
  notes: string | null;
  first_seen_at: string;
  last_seen_at: string;
  checked_at: string;
  used_price: number | null;
  used_condition: string | null;
  new_price: number | null;
  new_price_any: number | null;
  avg_new_90d: number | null;
  min_used_90d: number | null;
  n_checks: number;
  ref_price: number | null;
  your_cost: number | null;
  profit_eur: number | null;
  margin_pct: number | null;
  used_vs_new_pct: number | null;
  active: boolean;
}

export interface Settings {
  discount_pct: number;
  min_used_price: number;
  alert_margin_pct: number;
  alert_profit_eur: number;
}

export type InventoryStatus = "ordinato" | "ricevuto" | "in_vendita" | "venduto" | "reso";

export interface InventoryItem {
  id: number;
  asin: string | null;
  title: string;
  image_url: string | null;
  condition: string | null;
  status: InventoryStatus;
  purchased_at: string;
  list_price: number | null;
  purchase_cost: number;
  ref_price: number | null;
  target_price: number | null;
  channel: string | null;
  sale_price: number | null;
  sale_fees: number | null;
  sold_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profit_eur: number | null;
  roi_pct: number | null;
  expected_profit_eur: number | null;
  days_held: number;
}

export type InventoryInput = Partial<Omit<InventoryItem, "id" | "created_at" | "updated_at" | "profit_eur" | "roi_pct" | "expected_profit_eur" | "days_held">>;

export interface ScannerStatus {
  last_check: string | null;
  db?: string;
}

export const STATUS_LABEL: Record<InventoryStatus, string> = {
  ordinato: "Ordinato",
  ricevuto: "Ricevuto",
  in_vendita: "In vendita",
  venduto: "Venduto",
  reso: "Reso",
};

export const STATUS_ORDER: InventoryStatus[] = ["ordinato", "ricevuto", "in_vendita", "venduto", "reso"];

export const CHANNELS = ["eBay", "Subito", "Vinted", "Amazon", "Marketplace FB", "Privato", "Altro"];
