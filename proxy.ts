import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdmin, needsAdmin } from "@/lib/auth";

/**
 * Panoramica e offerte sono pubbliche. Magazzino, impostazioni e ogni modifica
 * chiedono l'accesso admin (password DASHBOARD_PASSWORD, pagina /accedi).
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!needsAdmin(pathname, req.method) || (await isAdmin(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Serve l'accesso admin" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/accedi";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
