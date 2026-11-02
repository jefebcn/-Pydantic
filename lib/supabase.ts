import { createClient } from "@supabase/supabase-js";

/**
 * Client lato server (chiave segreta). Non importarlo mai in componenti client.
 * Accetta sia i nomi dell'integrazione Supabase di Vercel (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SECRET_KEY) sia quelli manuali (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Mancano SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY)");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
