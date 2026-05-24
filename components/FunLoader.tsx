"use client";
import { useEffect, useState } from "react";

/**
 * Friendly loading state with rotating playful messages + a simulated,
 * structured progress bar. Used while the backend does a single long call
 * (no real progress events), so the bar eases toward ~92% and snaps to
 * 100% only when the parent unmounts this component (i.e. data arrived).
 */

const MESSAGES: Record<"analysis" | "render", string[]> = {
  analysis: [
    "🔍 Sbirciamo ogni dettaglio del prodotto…",
    "🎨 Scegliamo palette e colori d'accento…",
    "🧠 L'AI studia materiali e finiture…",
    "✨ Decidiamo l'effetto visivo perfetto…",
    "📝 Scriviamo 10 prompt su misura…",
    "🪄 Quasi pronto, lucidiamo gli ultimi dettagli…",
  ],
  render: [
    "💡 Accendiamo i riflettori dello studio…",
    "📸 Il prodotto va in posa…",
    "🖌️ Pennellate di luce e ombra…",
    "🍌 Nano Banana fa la sua magia…",
    "🎭 Sistemiamo sfondi ed effetti…",
    "🧩 Componiamo le 10 infografiche…",
    "🚀 Ci siamo quasi, rifiniamo tutto…",
  ],
};

const PHASE_LABELS: Record<"analysis" | "render", string[]> = {
  analysis: ["Scraping", "Analisi AI", "Prompt"],
  render:   ["Studio", "Rendering", "Compositing"],
};

export default function FunLoader({ phase }: { phase: "analysis" | "render" }) {
  const messages = MESSAGES[phase];
  const labels   = PHASE_LABELS[phase];
  const [msgIdx, setMsgIdx] = useState(0);
  const [pct, setPct]       = useState(8);

  /* Rotate messages */
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
    }, 2600);
    return () => clearInterval(id);
  }, [messages.length]);

  /* Eased simulated progress toward ~92% */
  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => {
        if (p >= 92) return 92;
        // slow down as we approach the cap
        const remaining = 92 - p;
        return p + Math.max(0.4, remaining * 0.04);
      });
    }, 200);
    return () => clearInterval(id);
  }, []);

  /* Which structured phase pill is "active" — derived from the simulated
     progress so it feels like it's moving through stages. */
  const activePhase = pct > 75 ? 2 : pct > 40 ? 1 : 0;

  return (
    <div className="fade-up">
      {/* Rotating message */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="relative flex h-5 w-5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-30"
            style={{ background: "var(--brand)" }} />
          <span className="relative inline-flex rounded-full h-5 w-5 items-center justify-center">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--brand)" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
          </span>
        </span>
        <p key={msgIdx} className="text-sm font-semibold fade-up" style={{ color: "var(--text-primary)" }}>
          {messages[msgIdx]}
        </p>
      </div>

      {/* Structured progress bar */}
      <div className="mb-2">
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(30,63,217,0.10)" }}>
          <div
            className="h-full rounded-full transition-all duration-200 ease-out progress-shimmer"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Phase pills */}
      <div className="flex items-center gap-1.5 mb-5">
        {labels.map((label, i) => {
          const done = i < activePhase;
          const active = i === activePhase;
          return (
            <div key={label} className="flex items-center gap-1.5 flex-1 last:flex-none">
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap transition-all"
                style={{
                  background: done ? "rgba(22,163,74,0.12)" : active ? "rgba(30,63,217,0.14)" : "var(--bg-card-hover)",
                  color:      done ? "#15803D"             : active ? "var(--brand)"          : "var(--text-muted)",
                  border: `1px solid ${done ? "rgba(22,163,74,0.30)" : active ? "rgba(30,63,217,0.30)" : "var(--border)"}`,
                }}>
                {done ? "✓ " : ""}{label}
              </span>
              {i < labels.length - 1 && (
                <span className="flex-1 h-px" style={{ background: "var(--border)" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
