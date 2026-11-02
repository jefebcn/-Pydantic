import { createClient } from "@supabase/supabase-js";

/**
 * Riporta l'URL Supabase alla forma base https://<ref>.supabase.co, accettando anche:
 * - slash finale o percorsi incollati per sbaglio (/rest/v1/, /auth/v1 …)
 * - il link della dashboard (https://supabase.com/dashboard/project/<ref>/…)
 */
export function normalizeSupabaseUrl(raw: string): string {
  const s = raw.trim().replace(/^["']|["']$/g, "");
  const dash = s.match(/supabase\.com\/dashboard\/project\/([a-z0-9]{10,})/i);
  if (dash) return `https://${dash[1]}.supabase.co`;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return s.replace(/\/+$/, "");
  }
}

export function supabaseHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  try {
    return new URL(normalizeSupabaseUrl(url)).host;
  } catch {
    return "(URL non valido)";
  }
}

/**
 * Client lato server (chiave segreta). Non importarlo mai in componenti client.
 * Accetta sia i nomi dell'integrazione Supabase di Vercel (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SECRET_KEY) sia quelli manuali (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Mancano SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY)");
  }
  return createClient(normalizeSupabaseUrl(url), key, { auth: { persistSession: false } });
}
