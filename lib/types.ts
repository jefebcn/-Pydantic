export interface Deal {
  asin: string;
  title: string | null;
  category: string | null;
  image_url: string | null;
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
