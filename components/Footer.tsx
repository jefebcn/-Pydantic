"use client";
import Link from "next/link";
import { useCallback } from "react";
import { LOGO_ICON_SRC } from "@/lib/brand";

const LEGAL_LINKS = [
  { href: "/privacy",  label: "Privacy Policy" },
  { href: "/cookies",  label: "Cookie Policy"  },
  { href: "/terms",    label: "Termini di Servizio" },
];

export default function Footer() {
  /** Re-open the cookie banner (the banner removes itself when accepted,
   *  this lets the user revoke their choice). */
  const openCookieSettings = useCallback(() => {
    try { localStorage.removeItem("cookie_consent_v1"); } catch { /* no-op */ }
    document.dispatchEvent(new CustomEvent("open-cookie-banner"));
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto px-4 sm:px-6 md:px-10 py-6 md:py-8"
      style={{
        background: "rgba(255,255,255,0.6)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-col gap-5">
        {/* Top: brand + nav */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_ICON_SRC} alt="" width={36} height={36}
              className="w-9 h-9 rounded-md shrink-0"
              style={{ border: "1px solid var(--border)" }} />
            <div className="leading-tight">
              <p className="font-black tracking-[0.18em] text-sm"
                style={{ color: "var(--brand)" }}>PYDANTIC</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Amazon Infographics AI
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href}
                className="text-xs transition-colors hover:opacity-100"
                style={{ color: "var(--text-muted)" }}>
                {l.label}
              </Link>
            ))}
            <button onClick={openCookieSettings}
              className="text-xs transition-colors hover:opacity-100"
              style={{ color: "var(--text-muted)" }}>
              Preferenze cookie
            </button>
          </nav>
        </div>

        {/* Bottom: legal small print */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 pt-4"
          style={{ borderTop: "1px solid rgba(30,63,217,0.05)" }}>
          <div className="space-y-2">
            <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              © {year} <span className="font-semibold" style={{ color: "var(--text-primary)" }}>LILLOFIND</span>
              {" "}· Tutti i diritti riservati.
              <span className="block sm:inline sm:ml-2 opacity-70">
                Amazon, ASIN e i relativi loghi sono marchi di Amazon.com, Inc. — questo
                servizio non è affiliato con Amazon.
              </span>
            </p>
            <ul className="text-[9px] font-mono uppercase tracking-wider space-y-0.5 opacity-80"
              style={{ color: "var(--text-muted)" }}>
              <li>LILLOFIND S.R.L.</li>
              <li>P.IVA IT 12874930963</li>
              <li>REA MI — 2714501</li>
              <li>CAP. SOC. €10.000 i.v.</li>
              <li>TOWER A, THE WALK — JBR, DUBAI, UAE</li>
            </ul>
          </div>
          <p className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
            Built with Claude Haiku · Nano Banana · Next.js
          </p>
        </div>
      </div>
    </footer>
  );
}
