import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, ADMIN_MAX_AGE, adminToken } from "@/lib/auth";

/** Login admin: confronta la password con DASHBOARD_PASSWORD e lascia un cookie per 30 giorni. */
export async function POST(req: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return NextResponse.json({ ok: true });
  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || password !== expected) {
    await new Promise((r) => setTimeout(r, 800)); // rallenta i tentativi a raffica
    return NextResponse.json({ error: "Password sbagliata" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await adminToken(expected), {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  return res;
}
