"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import StatCard from "@/components/StatCard";

const SLIDE_TYPES = [
  { num: "01", name: "Hero", desc: "Prodotto su sfondo neutro con illuminazione drammatica. Occupa il 55% del frame." },
  { num: "02", name: "Problem / Solution", desc: "Split 50/50: problema a sinistra (desaturato), soluzione a destra (vivo)." },
  { num: "03", name: "Key Features", desc: "Vista pulita con 3 settori vuoti per callout in compositing." },
  { num: "04", name: "Lifestyle", desc: "Prodotto nel contesto d'uso, bokeh creamy, luce naturale." },
  { num: "05", name: "Tech Specs", desc: "Vista blueprint: illuminazione piatta, spazio per dimensioni." },
  { num: "06", name: "Social Proof", desc: "Prodotto in accent, ampio spazio per rating e recensioni." },
  { num: "07", name: "Why Us", desc: "Prodotto in alto come trofeo, spazio per tabella comparativa." },
];

const AI_MODELS = [
  { dot: "#7C3AED", name: "Claude Haiku 4.5", role: "MVD + QC primario", tag: "Anthropic" },
  { dot: "#0EA5E9", name: "Gemini 2.5 Flash", role: "Generazione 7 slide", tag: "Google" },
  { dot: "#8B5CF6", name: "Claude Opus 4.7", role: "QC escalation (score < 65)", tag: "Anthropic" },
  { dot: "#22C55E", name: "GPT-Image-2", role: "Fallback prodotti con testo", tag: "OpenAI" },
];

const SETUP_KEYS = [
  { key: "ANTHROPIC_API_KEY", service: "Anthropic", desc: "MVD analysis + QC" },
  { key: "GOOGLE_AI_API_KEY", service: "Google AI Studio", desc: "Gemini image generation" },
  { key: "OPENAI_API_KEY", service: "OpenAI", desc: "GPT-Image-2 fallback" },
  { key: "RAINFOREST_API_KEY", service: "Rainforest API", desc: "Amazon scraping anti-bot" },
  { key: "CLOUDFLARE_R2_*", service: "Cloudflare R2", desc: "Storage immagini (egress gratis)" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", service: "Supabase", desc: "DB jobs + cache ASIN" },
];

export default function HomePage() {
  const [asin, setAsin]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asin.match(/^[A-Z0-9]{10}$/)) {
      setError("ASIN non valido — deve essere 10 caratteri alfanumerici");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asin: asin.toUpperCase() }),
    });

    const data = await res.json();
    if (data.job_id) {
      router.push(`/results/${data.job_id}`);
    } else {
      setError(data.error || "Errore sconosciuto");
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <p className="text-sm font-medium mb-1" style={{ color: "var(--purple-400)" }}>
          Dashboard
        </p>
        <h1 className="text-3xl md:text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
          Ciao!{" "}
          <span className="gradient-text">Cosa vuoi generare?</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Inserisci un ASIN Amazon e ottieni 7 slide infografiche professionali in ~90 secondi.
        </p>
      </div>

      {/* Hero input card */}
      <div id="generate" className="card-hero p-8 mb-8">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
          <div className="flex-1">
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              ASIN Amazon
            </label>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Trovi l&apos;ASIN nell&apos;URL del prodotto o nella sezione &quot;Informazioni prodotto&quot;
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={asin}
                  onChange={(e) => {
                    setAsin(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="Es. B08N5WRWNW"
                  maxLength={10}
                  className="w-full px-4 py-3 rounded-xl font-mono text-base tracking-widest outline-none transition-all"
                  style={{
                    background: "rgba(11,11,24,0.6)",
                    border: error
                      ? "1px solid rgba(239,68,68,0.5)"
                      : "1px solid rgba(139,92,246,0.3)",
                    color: "var(--text-primary)",
                    boxShadow: error ? "0 0 0 3px rgba(239,68,68,0.1)" : "none",
                  }}
                  onFocus={(e) => {
                    if (!error) e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.2)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono"
                  style={{ color: asin.length === 10 ? "var(--purple-400)" : "var(--text-muted)" }}
                >
                  {asin.length}/10
                </span>
              </div>
              <button
                type="submit"
                disabled={loading || asin.length !== 10}
                className="btn-primary whitespace-nowrap"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <SpinnerIcon />
                    Avvio pipeline...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <SparkleIcon />
                    Genera 7 Slide
                  </span>
                )}
              </button>
            </form>
            {error && (
              <p className="mt-2 text-xs" style={{ color: "#f87171" }}>
                ⚠ {error}
              </p>
            )}
          </div>

          {/* Pipeline preview */}
          <div
            className="hidden md:flex flex-col gap-2 text-xs shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            {[
              ["1", "Scraping Amazon"],
              ["2", "Analisi AI (MVD)"],
              ["3", "Generazione immagini"],
              ["4", "Quality Check"],
              ["5", "Compositing"],
              ["6", "Upload & Download"],
            ].map(([n, label]) => (
              <div key={n} className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "rgba(139,92,246,0.2)", color: "var(--purple-400)" }}
                >
                  {n}
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<SlideIcon />}
          value="—"
          label="Slide Generate"
          sub="Aggiungi le API keys per iniziare"
          accent
        />
        <StatCard
          icon={<AsinIcon />}
          value="—"
          label="ASIN Processati"
          sub="Cache attiva dopo il primo job"
        />
        <StatCard
          icon={<QcIcon />}
          value="—"
          label="Score QC Medio"
          sub="Target: > 85/100"
        />
      </div>

      {/* 7 Slide Templates */}
      <div className="mb-8">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            7 Template Slide
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "rgba(139,92,246,0.15)", color: "var(--purple-400)" }}>
            generati in parallelo
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SLIDE_TYPES.map((s) => (
            <div key={s.num} className="card p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-black font-mono"
                  style={{ color: "var(--purple-500)" }}
                >
                  {s.num}
                </span>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {s.name}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {s.desc}
              </p>
            </div>
          ))}
          {/* Placeholder card for the 8th slot */}
          <div className="card p-4 flex flex-col items-center justify-center gap-2 opacity-40"
            style={{ borderStyle: "dashed" }}>
            <span className="text-2xl" style={{ color: "var(--text-muted)" }}>+</span>
            <span className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
              Slide custom<br />in roadmap
            </span>
          </div>
        </div>
      </div>

      {/* AI Stack + Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

        {/* AI Stack */}
        <div className="card p-6">
          <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            AI Stack
          </h2>
          <div className="flex flex-col gap-3">
            {AI_MODELS.map((m) => (
              <div key={m.name} className="flex items-center gap-3">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: m.dot, boxShadow: `0 0 6px ${m.dot}` }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {m.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {m.role}
                  </p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium shrink-0"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}
                >
                  {m.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline come funziona */}
        <div className="card p-6">
          <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Come funziona la pipeline
          </h2>
          <div className="flex flex-col gap-4">
            {[
              { step: "01", title: "Scraping", desc: "Rainforest API estrae dati e immagini di riferimento dal prodotto Amazon.", color: "#7C3AED" },
              { step: "02", title: "MVD Analysis", desc: "Claude Haiku analizza le immagini e produce un Material Vision Document JSON.", color: "#8B5CF6" },
              { step: "03", title: "Generazione", desc: "Gemini Flash genera le 7 slide in parallelo con lighting PBR-accurate.", color: "#A855F7" },
              { step: "04", title: "QC + Export", desc: "Vision QC valuta la coerenza. Pillow composita i testi e carica su R2.", color: "#EC4899" },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <span
                  className="text-sm font-black font-mono shrink-0 mt-0.5"
                  style={{ color: item.color }}
                >
                  {item.step}
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </p>
                  <p className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Setup checklist */}
      <div className="card p-6">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
            Setup API Keys
          </h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Configura su Vercel → Settings → Environment Variables
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SETUP_KEYS.map((k) => (
            <div key={k.key} className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span
                className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                style={{ background: "var(--border)", outline: "1px solid var(--border-purple)" }}
              />
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold truncate" style={{ color: "var(--purple-400)" }}>
                  {k.key}
                </p>
                <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {k.service}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {k.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* Icons */
function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
    </svg>
  );
}
function SlideIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
function AsinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function QcIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
