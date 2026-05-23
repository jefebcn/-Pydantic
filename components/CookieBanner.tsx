"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "cookie_consent_v1";

type Consent = "accepted" | "essential" | null;

/**
 * Bottom-of-screen cookie banner. Three states:
 *   - "accepted"  → all cookies allowed (analytics + functional + essential)
 *   - "essential" → only essential cookies (auth session, app preferences)
 *   - null        → not yet decided → banner visible
 *
 * Persisted in localStorage under "cookie_consent_v1".
 * Can be re-opened from the Footer link "Preferenze cookie" which dispatches
 * a CustomEvent("open-cookie-banner") and clears the stored value.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(CONSENT_KEY) as Consent;
      if (!v) setVisible(true);
    } catch { /* SSR or storage blocked */ }

    const onReopen = () => setVisible(true);
    document.addEventListener("open-cookie-banner", onReopen);
    return () => document.removeEventListener("open-cookie-banner", onReopen);
  }, []);

  const choose = (value: Exclude<Consent, null>) => {
    try { localStorage.setItem(CONSENT_KEY, value); } catch { /* no-op */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Preferenze cookie"
      className="fixed inset-x-0 bottom-0 z-[60] fade-up"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingLeft:   "max(0.75rem, env(safe-area-inset-left))",
        paddingRight:  "max(0.75rem, env(safe-area-inset-right))",
      }}
    >
      <div
        className="mx-auto max-w-3xl rounded-2xl p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
        style={{
          background: "rgba(15,15,30,0.96)",
          border: "1px solid rgba(30,63,217,0.35)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: "0 12px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(30,63,217,0.1)",
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            🍪 Cookie & Privacy
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Usiamo cookie essenziali per autenticazione e preferenze app. Con il tuo
            consenso, raccogliamo anche metriche anonime di utilizzo per migliorare il
            servizio. Puoi cambiare scelta in qualunque momento dal footer.
            {" "}
            <Link href="/cookies" className="underline" style={{ color: "var(--purple-400)" }}>
              Leggi la Cookie Policy
            </Link>.
          </p>
        </div>

        <div className="flex gap-2 sm:shrink-0">
          <button
            onClick={() => choose("essential")}
            className="flex-1 sm:flex-none text-xs font-semibold px-4 py-2.5 rounded-lg transition-all"
            style={{
              background: "rgba(30,63,217,0.04)",
              color: "var(--text-primary)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Solo essenziali
          </button>
          <button
            onClick={() => choose("accepted")}
            className="flex-1 sm:flex-none btn-primary text-xs"
            style={{ padding: "0.625rem 1.25rem" }}
          >
            Accetta tutti
          </button>
        </div>
      </div>
    </div>
  );
}
