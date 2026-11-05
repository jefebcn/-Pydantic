/**
 * Accesso admin: il sito si consulta liberamente, la password (DASHBOARD_PASSWORD)
 * serve solo per magazzino, impostazioni e per modificare i dati.
 * Dopo il login il browser tiene un cookie con l'HMAC della password: cambiando la
 * password su Vercel tutti i login esistenti scadono.
 */
export const ADMIN_COOKIE = "smh_admin";
export const ADMIN_MAX_AGE = 60 * 60 * 24 * 30; // 30 giorni

const ADMIN_PAGES = ["/magazzino", "/impostazioni"];
// /api/telegram è il bot (api/telegram.py): si fa riconoscere con la parola segreta di Telegram
const PUBLIC_API = ["/api/telegram", "/api/login", "/api/logout"];

export async function adminToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("seconda-mano-hunter-admin"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Senza DASHBOARD_PASSWORD (es. in locale) tutti sono admin, come prima. */
export async function isAdmin(cookie: string | undefined): Promise<boolean> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return true;
  return !!cookie && cookie === (await adminToken(password));
}

/** Pagine e chiamate riservate: magazzino, impostazioni e qualsiasi modifica ai dati. */
export function needsAdmin(path: string, method: string): boolean {
  if (ADMIN_PAGES.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  if (path.startsWith("/api/inventory")) return true;
  return path.startsWith("/api/") && method !== "GET" && !PUBLIC_API.includes(path);
}
