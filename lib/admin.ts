import { createClient, type User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Admin auth helpers (server only).
 *
 * The admin allow-list lives in the ADMIN_EMAILS env var (comma-separated).
 * For purely cosmetic checks (hiding the "Admin" link in the sidebar before
 * the user even tries to load /admin) the client uses
 * NEXT_PUBLIC_ADMIN_EMAILS — that one is visible to everyone, so it's not a
 * security boundary, just a UI nicety.
 *
 * The real gate is requireAdmin(): it validates the Supabase access token
 * carried by the request and checks the email against the server-side list.
 */

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  const list = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** Service-role Supabase client. Required for auth.admin.* + cross-table reads.
 *  Throws if envs are missing — callers should catch and return a 500. */
export function supabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface AdminGate {
  user: User;
  supabase: ReturnType<typeof supabaseServiceClient>;
}

/**
 * Validates the request comes from an authenticated admin. Returns either a
 * NextResponse to send back immediately, or an AdminGate with the resolved
 * user + a ready-to-use service-role Supabase client.
 *
 * Usage:
 *     const gate = await requireAdmin(req);
 *     if ("response" in gate) return gate.response;
 *     const { supabase, user } = gate;
 */
export async function requireAdmin(
  req: NextRequest,
): Promise<AdminGate | { response: NextResponse }> {
  let supabase;
  try { supabase = supabaseServiceClient(); }
  catch (e) {
    return { response: NextResponse.json(
      { error: "Supabase non configurato (manca SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 },
    ) };
  }

  // Accept either Authorization: Bearer <token> or the sb-* cookie
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const cookieToken = extractSbAccessToken(req);
  const token = bearer || cookieToken;
  if (!token) {
    return { response: NextResponse.json(
      { error: "Non autenticato" }, { status: 401 },
    ) };
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { response: NextResponse.json(
      { error: "Token non valido" }, { status: 401 },
    ) };
  }

  if (!isAdminEmail(user.email)) {
    return { response: NextResponse.json(
      { error: "Accesso negato — non sei admin" }, { status: 403 },
    ) };
  }

  return { user, supabase };
}

/**
 * Supabase stores the access token in a cookie named `sb-<project-ref>-auth-token`
 * (and a few variants). Pull whichever one we find and JSON-parse if needed —
 * the cookie value is either the raw token or a JSON envelope { access_token: ... }.
 */
function extractSbAccessToken(req: NextRequest): string {
  const all = req.cookies.getAll();
  for (const c of all) {
    if (!c.name.startsWith("sb-") || !c.name.endsWith("-auth-token")) continue;
    const raw = c.value;
    if (!raw) continue;
    // JSON envelope?
    if (raw.startsWith("[") || raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
        if (typeof parsed === "object" && parsed && "access_token" in parsed) {
          return (parsed as { access_token: string }).access_token;
        }
      } catch { /* fall through */ }
    }
    // base64-prefixed envelope (Supabase v2)
    if (raw.startsWith("base64-")) {
      try {
        const json = Buffer.from(raw.slice(7), "base64").toString("utf8");
        const parsed = JSON.parse(json);
        if (parsed?.access_token) return parsed.access_token as string;
      } catch { /* fall through */ }
    }
    // assume raw token
    return raw;
  }
  return "";
}
