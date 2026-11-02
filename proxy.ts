import { NextResponse, type NextRequest } from "next/server";

/**
 * Protezione con password (Basic Auth) per tutta la dashboard.
 * Attiva impostando DASHBOARD_PASSWORD su Vercel. Utente: qualsiasi.
 */
export function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse("Accesso riservato", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Seconda Mano Hunter"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
