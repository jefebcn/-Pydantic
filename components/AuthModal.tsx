"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
}

export default function AuthModal({ open, onClose, defaultTab = "login" }: Props) {
  const [tab, setTab]           = useState<"login" | "register">(defaultTab);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);
  const { signIn, signUp }      = useAuth();
  const backdropRef             = useRef<HTMLDivElement>(null);

  /* Reset on tab change */
  useEffect(() => { setError(null); setSuccess(null); }, [tab]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email e password obbligatorie."); return; }
    if (password.length < 6)  { setError("Password minimo 6 caratteri."); return; }

    setLoading(true);
    setError(null);

    const err = tab === "login"
      ? await signIn(email, password)
      : await signUp(email, password, name);

    setLoading(false);

    if (err) {
      setError(err);
    } else if (tab === "register") {
      setSuccess("Account creato! Controlla la tua email per la verifica, poi accedi.");
      setTab("login");
    } else {
      onClose();
    }
  };

  return (
    /* Backdrop */
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "#111124",
          border: "1px solid rgba(139,92,246,0.3)",
          boxShadow: "0 0 80px rgba(139,92,246,0.15)",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}>
                AI
              </div>
              <span className="text-xs font-semibold" style={{ color: "var(--purple-400)" }}>
                Amazon Infographic AI
              </span>
            </div>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {tab === "login" ? "Accedi al tuo account" : "Crea un account gratuito"}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {tab === "login"
                ? "I tuoi job e slide sincronizzati su ogni dispositivo."
                : "Salva la cronologia e accedi da qualsiasi dispositivo."}
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 mt-1"
            style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.06)" }}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex mx-6 mt-4 rounded-xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
          {(["login", "register"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 text-sm font-semibold transition-all rounded-xl"
              style={{
                background: tab === t ? "rgba(139,92,246,0.2)" : "transparent",
                color: tab === t ? "var(--purple-400)" : "var(--text-muted)",
              }}>
              {t === "login" ? "Accedi" : "Registrati"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">

          {success && (
            <div className="rounded-xl p-3 text-sm"
              style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34D399" }}>
              ✓ {success}
            </div>
          )}

          {error && (
            <div className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", color: "#F87171" }}>
              <span className="shrink-0 mt-0.5">⚠</span>
              <span className="text-sm">{error}</span>
            </div>
          )}

          {tab === "register" && (
            <AuthField label="Nome (opzionale)">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Il tuo nome" autoComplete="name" />
            </AuthField>
          )}

          <AuthField label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com" autoComplete="email" required />
          </AuthField>

          <AuthField label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 6 caratteri" autoComplete={tab === "login" ? "current-password" : "new-password"} required />
          </AuthField>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon /> {tab === "login" ? "Accesso in corso…" : "Creazione account…"}
              </span>
            ) : (
              tab === "login" ? "Accedi" : "Crea Account"
            )}
          </button>

          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            {tab === "login" ? "Non hai un account?" : "Hai già un account?"}{" "}
            <button type="button" onClick={() => setTab(tab === "login" ? "register" : "login")}
              className="font-semibold" style={{ color: "var(--purple-400)" }}>
              {tab === "login" ? "Registrati" : "Accedi"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 1rem",
  borderRadius: "0.75rem",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  fontSize: "0.875rem",
  outline: "none",
};

function AuthField({ label, children }: { label: string; children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>> }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
        {label}
      </label>
      <input
        {...(children.props as React.InputHTMLAttributes<HTMLInputElement>)}
        style={INPUT_STYLE}
        onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)")}
        onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
      />
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        strokeLinecap="round" />
    </svg>
  );
}
