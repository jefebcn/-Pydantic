"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import StatCard from "@/components/StatCard";
import CustomSlideModal, { type CustomSlide } from "@/components/CustomSlideModal";

const CUSTOM_STORAGE_KEY = "custom_slides_v1";

const SLIDE_TYPES = [
  { num: "01", name: "Hero",             desc: "Prodotto su sfondo neutro, illuminazione drammatica tre-point." },
  { num: "02", name: "Problem / Solution", desc: "Split 50/50: problema desaturato a sx, soluzione vivida a dx." },
  { num: "03", name: "Key Features",     desc: "Vista pulita con 3 settori vuoti per callout in compositing." },
  { num: "04", name: "Lifestyle",        desc: "Prodotto nel contesto d'uso, bokeh creamy, luce naturale." },
  { num: "05", name: "Tech Specs",       desc: "Blueprint: illuminazione piatta, spazio per dimensioni." },
  { num: "06", name: "Social Proof",     desc: "Accent piccolo, ampio spazio per rating e recensioni." },
  { num: "07", name: "Why Us",           desc: "Prodotto trofeo in alto, spazio per tabella comparativa." },
];

const AI_MODELS = [
  { dot: "#A78BFA", name: "Claude Haiku 4.5",  role: "MVD analysis + QC primario",       tag: "Anthropic" },
  { dot: "#38BDF8", name: "Gemini 2.5 Flash",  role: "Generazione 7 slide in parallelo", tag: "Google"    },
  { dot: "#C084FC", name: "Claude Opus 4.7",   role: "QC escalation (score < 65)",        tag: "Anthropic" },
  { dot: "#34D399", name: "GPT-Image-2",        role: "Fallback prodotti con testo",       tag: "OpenAI"    },
];

const SETUP_KEYS = [
  { key: "ANTHROPIC_API_KEY",         service: "Anthropic",        desc: "MVD + QC",               color: "#A78BFA" },
  { key: "GOOGLE_AI_API_KEY",         service: "Google AI Studio", desc: "Generazione immagini",   color: "#38BDF8" },
  { key: "OPENAI_API_KEY",            service: "OpenAI",           desc: "GPT-Image-2 fallback",   color: "#34D399" },
  { key: "RAINFOREST_API_KEY",        service: "Rainforest API",   desc: "Amazon scraping",        color: "#FCD34D" },
  { key: "CLOUDFLARE_R2_*",           service: "Cloudflare R2",    desc: "Storage (egress gratis)", color: "#FB923C" },
  { key: "NEXT_PUBLIC_SUPABASE_URL",  service: "Supabase",         desc: "DB jobs + cache ASIN",   color: "#4ADE80" },
];

interface AppError {
  title: string;
  message: string;
  hint: string;
  status?: number;
}

function categorizeError(msg: string, status: number): AppError {
  const m = msg.toLowerCase();
  if (status === 0 || m.includes("failed to fetch") || m.includes("networkerror")) {
    return { title: "Errore di rete", message: msg, status,
      hint: "Controlla la connessione internet o se il server è in esecuzione." };
  }
  if (m.match(/api.?key|anthropic|openai|google.?ai|helicone/)) {
    return { title: "API key mancante o non valida", message: msg, status,
      hint: "Vai su Vercel → Settings → Environment Variables e aggiungi le chiavi mancanti." };
  }
  if (m.match(/supabase|postgres|database|relation|table|schema/)) {
    return { title: "Database non configurato", message: msg, status,
      hint: "Esegui supabase/schema.sql nel SQL Editor di Supabase e verifica NEXT_PUBLIC_SUPABASE_URL." };
  }
  if (m.match(/rainforest|scraping|asin.*(not found|invalid|error)/)) {
    return { title: "Errore scraping Amazon", message: msg, status,
      hint: "Controlla RAINFOREST_API_KEY e verifica che l'ASIN esista su Amazon.it." };
  }
  if (m.match(/r2|cloudflare|bucket|s3|storage/)) {
    return { title: "Errore storage R2", message: msg, status,
      hint: "Controlla le variabili CLOUDFLARE_R2_* e i permessi del bucket." };
  }
  if (status === 400) {
    return { title: "Richiesta non valida", message: msg, status,
      hint: "Verifica che l'ASIN sia esattamente 10 caratteri alfanumerici." };
  }
  if (status >= 500) {
    return { title: `Errore server (${status})`, message: msg, status,
      hint: "Controlla i log in tempo reale su Vercel Dashboard → Deployments → Functions." };
  }
  return { title: "Errore sconosciuto", message: msg, status,
    hint: "Controlla i log su Vercel Dashboard o apri la console del browser (F12)." };
}

export default function HomePage() {
  const [asin, setAsin]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [appError, setAppError] = useState<AppError | null>(null);
  const router = useRouter();

  /* Custom slides state — persisted in localStorage */
  const [customSlides, setCustomSlides] = useState<CustomSlide[]>([]);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editSlide, setEditSlide]       = useState<CustomSlide | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (saved) setCustomSlides(JSON.parse(saved));
    } catch { /* no-op */ }
  }, []);

  const persistSlides = (slides: CustomSlide[]) => {
    setCustomSlides(slides);
    try { localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(slides)); } catch { /* no-op */ }
  };

  const handleSaveCustom = (slide: CustomSlide) => {
    const existing = customSlides.findIndex((s) => s.id === slide.id);
    if (existing >= 0) {
      const updated = [...customSlides];
      updated[existing] = slide;
      persistSlides(updated);
    } else {
      persistSlides([...customSlides, slide]);
    }
  };

  const handleDeleteCustom = (id: string) => {
    persistSlides(customSlides.filter((s) => s.id !== id));
  };

  const openNew  = () => { setEditSlide(null); setModalOpen(true); };
  const openEdit = (slide: CustomSlide) => { setEditSlide(slide); setModalOpen(true); };

  const clearError = () => setAppError(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asin.match(/^[A-Z0-9]{10}$/)) {
      setAppError({ title: "ASIN non valido", status: 400,
        message: `"${asin}" non è un ASIN valido.`,
        hint: "Un ASIN è composto da esattamente 10 caratteri alfanumerici (es. B08N5WRWNW)." });
      return;
    }
    setLoading(true);
    setAppError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: asin.toUpperCase() }),
      });

      let data: Record<string, string> = {};
      try { data = await res.json(); } catch { /* body not JSON */ }

      if (res.ok && data.job_id) {
        router.push(`/results/${data.job_id}`);
        return;
      }

      const rawMsg = data.error || data.message || (res.ok ? "Nessun job_id ricevuto" : `HTTP ${res.status}`);
      setAppError(categorizeError(rawMsg, res.status));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore di rete sconosciuto";
      setAppError(categorizeError(msg, 0));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase mb-1"
          style={{ color: "var(--purple-400)" }}>
          Dashboard
        </p>
        <h1 className="text-3xl md:text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
          Hi,{" "}
          <span className="gradient-text">cosa vuoi generare?</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Inserisci un ASIN Amazon — 7 slide infografiche professionali in ~90 secondi.
        </p>
      </div>

      {/* ── Hero 2-column ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">

        {/* Input card — 3 cols */}
        <div id="generate" className="card-hero p-6 md:col-span-3 flex flex-col justify-between gap-6">
          <div>
            <label className="block text-sm font-semibold mb-1"
              style={{ color: "var(--text-primary)" }}>
              ASIN Amazon
            </label>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Trovi l&apos;ASIN nell&apos;URL del prodotto o in &quot;Informazioni prodotto&quot;
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={asin}
                  onChange={(e) => { setAsin(e.target.value.toUpperCase()); clearError(); }}
                  placeholder="Es. B08N5WRWNW"
                  maxLength={10}
                  className="w-full px-4 py-3 rounded-xl font-mono text-base tracking-widest outline-none transition-all"
                  style={{
                    background: "rgba(11,11,24,0.6)",
                    border: appError ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(139,92,246,0.3)",
                    color: "var(--text-primary)",
                    boxShadow: appError ? "0 0 0 3px rgba(239,68,68,0.1)" : "none",
                  }}
                  onFocus={(e) => { if (!appError) e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.2)"; }}
                  onBlur={(e)  => { e.currentTarget.style.boxShadow = "none"; }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono"
                  style={{ color: asin.length === 10 ? "var(--purple-400)" : "var(--text-muted)" }}>
                  {asin.length}/10
                </span>
              </div>
              <button
                type="submit"
                disabled={loading || asin.length !== 10}
                className="btn-primary whitespace-nowrap"
              >
                {loading ? (
                  <span className="flex items-center gap-2"><SpinnerIcon />Avvio...</span>
                ) : (
                  <span className="flex items-center gap-2"><SparkleIcon />Genera 7 Slide</span>
                )}
              </button>
            </form>
            {appError && (
              <div className="mt-3 rounded-xl p-4 relative"
                style={{
                  background: "rgba(248,113,113,0.07)",
                  border: "1px solid rgba(248,113,113,0.35)",
                  borderLeft: "3px solid #F87171",
                }}>
                {/* Dismiss */}
                <button onClick={clearError}
                  className="absolute top-3 right-3 w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                  style={{ color: "rgba(248,113,113,0.6)", background: "rgba(248,113,113,0.1)" }}>
                  ✕
                </button>

                <div className="flex items-start gap-3 pr-6">
                  <span className="shrink-0 mt-0.5" style={{ color: "#F87171" }}>
                    <ErrorIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* Title + status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: "#F87171" }}>
                        {appError.title}
                      </p>
                      {appError.status !== undefined && appError.status > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                          style={{ background: "rgba(248,113,113,0.15)", color: "#FCA5A5" }}>
                          {appError.status}
                        </span>
                      )}
                    </div>

                    {/* Raw message */}
                    <p className="text-xs mt-1.5 font-mono leading-relaxed break-all"
                      style={{ color: "#FCA5A5" }}>
                      {appError.message}
                    </p>

                    {/* Hint */}
                    <div className="flex items-start gap-1.5 mt-2.5 pt-2.5"
                      style={{ borderTop: "1px solid rgba(248,113,113,0.2)" }}>
                      <span className="text-xs shrink-0" style={{ color: "#FCD34D" }}>→</span>
                      <p className="text-xs leading-relaxed" style={{ color: "#FCD34D" }}>
                        {appError.hint}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mini pipeline steps */}
          <div className="flex flex-wrap gap-2">
            {["Scraping", "MVD", "Genera", "QC", "Compositing", "Upload"].map((step, i) => (
              <div key={step} className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--text-muted)" }}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ background: "rgba(139,92,246,0.2)", color: "var(--purple-400)" }}>
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>

        {/* Hero visual card — 2 cols */}
        <div className="md:col-span-2 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center p-6 min-h-[220px]"
          style={{
            background: "linear-gradient(135deg, #1a0533 0%, #0d1a3a 50%, #0a1628 100%)",
            border: "1px solid rgba(139,92,246,0.35)",
            boxShadow: "0 0 60px rgba(139,92,246,0.12)",
          }}>
          {/* Glow dots */}
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full" style={{ background: "#8B5CF6", boxShadow: "0 0 8px #8B5CF6" }} />
          <div className="absolute bottom-6 left-6 w-1.5 h-1.5 rounded-full" style={{ background: "#0EA5E9", boxShadow: "0 0 6px #0EA5E9" }} />
          <div className="absolute top-1/3 left-4 w-1 h-1 rounded-full" style={{ background: "#EC4899", boxShadow: "0 0 5px #EC4899" }} />

          {/* Blob */}
          <div className="blob-float relative mb-4">
            <div style={{
              width: 120, height: 120, borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%",
              background: "radial-gradient(circle at 35% 35%, #FF6B35 0%, #FF3CAC 45%, #7C3AED 80%)",
              boxShadow: "0 0 60px rgba(236,72,153,0.4), 0 0 30px rgba(124,58,237,0.3)",
              filter: "blur(1px)",
            }} />
            <div className="absolute inset-0" style={{
              borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%",
              background: "radial-gradient(circle at 70% 25%, rgba(255,255,255,0.2) 0%, transparent 50%)",
            }} />
          </div>

          {/* Text */}
          <p className="text-xl font-bold text-center" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: "#A78BFA" }}>7 Slide</span>{" "}
            <span style={{ color: "#EC4899" }}>Professionali</span>
          </p>
          <p className="text-xs text-center mt-1" style={{ color: "var(--text-muted)" }}>
            Generate con AI in meno di 90s
          </p>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<SlideIcon />}
          value="—"
          label="Slide Generate"
          sub="Aggiungi le API keys per iniziare"
          color="#8B5CF6"
          tag="Live"
        />
        <StatCard
          icon={<AsinIcon />}
          value="—"
          label="ASIN Processati"
          sub="Cache attiva dopo il primo job"
          color="#0EA5E9"
          tag="Cache"
        />
        <StatCard
          icon={<QcIcon />}
          value="—"
          label="Score QC Medio"
          sub="Target: > 85/100"
          color="#10B981"
          tag="QC"
        />
      </div>

      {/* ── Template Slide ─────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-2">
            <SectionHeader title="Template Slide" badge={`${7 + customSlides.length} totali`} />
          </div>
          <button onClick={openNew}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
            style={{
              background: "rgba(34,211,153,0.12)",
              color: "#34D399",
              border: "1px solid rgba(34,211,153,0.3)",
            }}>
            <span className="text-sm leading-none">+</span> Slide custom
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Standard 7 slides */}
          {SLIDE_TYPES.map((s, idx) => {
            const hue = SLIDE_COLORS[idx % SLIDE_COLORS.length];
            const [r, g, b] = hexToRgbArr(hue);
            return (
              <div
                key={s.num}
                className="relative overflow-hidden rounded-xl p-4 flex flex-col gap-2 transition-all"
                style={{
                  background: `linear-gradient(145deg, rgba(${r},${g},${b},0.10) 0%, #13132A 60%)`,
                  border: `1px solid rgba(${r},${g},${b},0.40)`,
                  borderTop: `2px solid ${hue}`,
                }}
              >
                <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full pointer-events-none"
                  style={{ background: `rgba(${r},${g},${b},0.18)`, filter: "blur(12px)" }} />
                <div className="flex items-center gap-2">
                  <span className="text-base font-black font-mono"
                    style={{ color: hue, textShadow: `0 0 10px rgba(${r},${g},${b},0.6)` }}>
                    {s.num}
                  </span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    {s.name}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#A0A0C0" }}>{s.desc}</p>
                <div className="mt-auto pt-1">
                  <div className="h-[2px] rounded-full"
                    style={{ background: `linear-gradient(90deg, ${hue}, transparent)`, width: "60%" }} />
                </div>
              </div>
            );
          })}

          {/* Custom slides */}
          {customSlides.map((cs, idx) => (
            <div
              key={cs.id}
              className="relative overflow-hidden rounded-xl p-4 flex flex-col gap-2 transition-all group"
              style={{
                background: "linear-gradient(145deg, rgba(34,211,153,0.08) 0%, #13132A 60%)",
                border: "1px solid rgba(34,211,153,0.35)",
                borderTop: "2px solid #34D399",
              }}
            >
              {/* corner glow */}
              <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full pointer-events-none"
                style={{ background: "rgba(34,211,153,0.15)", filter: "blur(12px)" }} />

              {/* Edit / Delete — shown on hover */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => openEdit(cs)}
                  className="w-6 h-6 rounded flex items-center justify-center text-xs"
                  style={{ background: "rgba(34,211,153,0.2)", color: "#34D399" }}
                  title="Modifica">
                  ✎
                </button>
                <button onClick={() => handleDeleteCustom(cs.id)}
                  className="w-6 h-6 rounded flex items-center justify-center text-xs"
                  style={{ background: "rgba(248,113,113,0.15)", color: "#F87171" }}
                  title="Elimina">
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-2 pr-14">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(34,211,153,0.18)", color: "#34D399" }}>
                  {String(8 + idx).padStart(2, "0")}
                </span>
                <span className="text-xs sm:text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                  {cs.name}
                </span>
              </div>

              <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "#A0A0C0" }}>
                {cs.brief}
              </p>

              {/* Config chips */}
              <div className="flex gap-1.5 flex-wrap mt-auto pt-1">
                {[cs.ratio, cs.lighting.replace("_", " ").toLowerCase()].map((chip) => (
                  <span key={chip} className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(34,211,153,0.1)", color: "#34D399" }}>
                    {chip}
                  </span>
                ))}
                {cs.textOverlay && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(252,211,77,0.1)", color: "#FCD34D" }}>
                    &ldquo;{cs.textOverlay.slice(0, 20)}&rdquo;
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Add new custom slide */}
          <button
            onClick={openNew}
            className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all"
            style={{
              border: "1px dashed rgba(34,211,153,0.25)",
              background: "rgba(34,211,153,0.03)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(34,211,153,0.5)";
              e.currentTarget.style.background = "rgba(34,211,153,0.07)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(34,211,153,0.25)";
              e.currentTarget.style.background = "rgba(34,211,153,0.03)";
            }}
          >
            <span className="text-2xl font-light" style={{ color: "#34D399", opacity: 0.7 }}>+</span>
            <span className="text-xs text-center font-medium" style={{ color: "#34D399", opacity: 0.7 }}>
              Nuova slide<br />custom
            </span>
          </button>
        </div>
      </div>

      <CustomSlideModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCustom}
        initial={editSlide}
      />

      {/* ── AI Stack + Pipeline ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

        {/* AI Stack */}
        <div className="card p-6">
          <SectionHeader title="AI Stack" />
          <div className="flex flex-col gap-3 mt-4">
            {AI_MODELS.map((m) => (
              <div key={m.name} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: m.dot, boxShadow: `0 0 8px ${m.dot}88` }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {m.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.role}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded font-medium shrink-0"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                  {m.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline */}
        <div className="card p-6">
          <SectionHeader title="Come funziona" />
          <div className="flex flex-col gap-4 mt-4">
            {[
              { n: "01", title: "Scraping",    desc: "Rainforest API estrae dati e immagini dal prodotto Amazon.",            color: "#8B5CF6" },
              { n: "02", title: "MVD",         desc: "Claude Haiku analizza e genera un Material Vision Document JSON.",        color: "#0EA5E9" },
              { n: "03", title: "Generazione", desc: "Gemini Flash genera le 7 slide in parallelo con lighting professionale.", color: "#A855F7" },
              { n: "04", title: "QC + Export", desc: "Vision QC valuta coerenza. Pillow composita i testi e carica su R2.",    color: "#EC4899" },
            ].map((item) => (
              <div key={item.n} className="flex gap-3">
                <span className="text-xs font-black font-mono shrink-0 mt-0.5" style={{ color: item.color }}>
                  {item.n}
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                  <p className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Setup API Keys ─────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-baseline gap-3 mb-4">
          <SectionHeader title="Setup API Keys" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Vercel → Settings → Environment Variables
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SETUP_KEYS.map((k) => (
            <div key={k.key} className="flex items-start gap-3 p-3 rounded-xl transition-all"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${k.color}22`,
              }}>
              <span className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                style={{ background: k.color, boxShadow: `0 0 6px ${k.color}88` }} />
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold truncate" style={{ color: k.color }}>
                  {k.key}
                </p>
                <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>
                  {k.service}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{k.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

const SLIDE_COLORS = ["#A78BFA", "#38BDF8", "#F472B6", "#34D399", "#FCD34D", "#FB923C", "#C084FC"];

function hexToRgbArr(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [139, 92, 246];
  return [parseInt(clean.slice(0,2),16), parseInt(clean.slice(2,4),16), parseInt(clean.slice(4,6),16)];
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: "rgba(139,92,246,0.15)", color: "var(--purple-400)" }}>
          {badge}
        </span>
      )}
    </div>
  );
}

/* Icons */
function ErrorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
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
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
function AsinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
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
