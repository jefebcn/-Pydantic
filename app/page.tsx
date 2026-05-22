"use client";
import { useState, useEffect } from "react";
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

interface MarianoResult {
  product_visual_description: string;
  categoria_effetto_01b: string;
  accent_color_hex: string;
  palette_sfondo_hex: string[];
  images: Array<{ number: string; name: string; prompt: string; logo_variant: string | null }>;
  negative_prompt: string;
  _cache_hit?: boolean;
}

interface GeneratedImage {
  number: string;
  name: string;
  image_b64: string | null;
  mime: string | null;
  model: string | null;
  error: string | null;
}

export default function HomePage() {
  /* Mariano Prompts.json generator */
  const [marianoAsin, setMarianoAsin]             = useState("");
  const [marianoLoading, setMarianoLoading]       = useState(false);
  const [marianoError, setMarianoError]           = useState<string | null>(null);
  const [marianoResult, setMarianoResult]         = useState<MarianoResult | null>(null);
  const [expandedImg, setExpandedImg]             = useState<string | null>(null);

  /* Image generation */
  const [imgGenLoading, setImgGenLoading]         = useState(false);
  const [imgGenError, setImgGenError]             = useState<string | null>(null);
  const [generatedImages, setGeneratedImages]     = useState<GeneratedImage[]>([]);

  /* Download all generated images as ZIP */
  const [zipLoading, setZipLoading]   = useState(false);
  const [zipError, setZipError]       = useState<string | null>(null);

  const handleDownloadZip = async () => {
    const valid = generatedImages.filter(i => i.image_b64);
    if (!valid.length || !marianoAsin) return;
    setZipLoading(true);
    setZipError(null);
    try {
      const res = await fetch("/api/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: marianoAsin, images: valid }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch { /* not json */ }
        setZipError(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${marianoAsin}_infografiche.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Errore di rete");
    } finally {
      setZipLoading(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!marianoResult || !marianoAsin) return;
    setImgGenLoading(true);
    setImgGenError(null);
    setGeneratedImages([]);
    try {
      const { _analysis: _, ...cleanJson } = marianoResult as MarianoResult & { _analysis?: unknown };
      const res = await fetch("/api/generate-mariano-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: marianoAsin, prompts_json: cleanJson }),
      });
      const data = await res.json();
      if (!res.ok) { setImgGenError(data.error || `HTTP ${res.status}`); return; }
      setGeneratedImages(data.images ?? []);
    } catch (err) {
      setImgGenError(err instanceof Error ? err.message : "Errore di rete");
    } finally {
      setImgGenLoading(false);
    }
  };

  const downloadImage = (img: GeneratedImage) => {
    if (!img.image_b64) return;
    const a = document.createElement("a");
    a.href = `data:${img.mime ?? "image/png"};base64,${img.image_b64}`;
    a.download = `${marianoAsin}_${img.number}_${img.name.replace(/\s+/g, "_")}.png`;
    a.click();
  };

  const handleMarianoGenerate = async (e: React.FormEvent, forceRefresh: boolean = false) => {
    e.preventDefault();
    if (!marianoAsin.match(/^[A-Z0-9]{10}$/)) {
      setMarianoError("ASIN deve essere 10 caratteri alfanumerici");
      return;
    }
    setMarianoLoading(true);
    setMarianoError(null);
    setMarianoResult(null);
    try {
      const res  = await fetch("/api/generate-mariano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: marianoAsin, force_refresh: forceRefresh }),
      });
      const data = await res.json();
      if (!res.ok) { setMarianoError(data.error || `HTTP ${res.status}`); return; }
      setMarianoResult(data as MarianoResult);
    } catch (err) {
      setMarianoError(err instanceof Error ? err.message : "Errore di rete");
    } finally {
      setMarianoLoading(false);
    }
  };

  const handleMarianoRefresh = () => handleMarianoGenerate(
    new Event("submit") as unknown as React.FormEvent, true
  );

  const downloadMarianoJson = () => {
    if (!marianoResult) return;
    const { _analysis: _, ...clean } = marianoResult as MarianoResult & { _analysis?: unknown };
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${marianoAsin}_prompts.json`; a.click();
    URL.revokeObjectURL(url);
  };

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

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">

      {/* ── Minimal header ─────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase mb-1"
          style={{ color: "var(--purple-400)" }}>
          Amazon Infographic Generator
        </p>
        <h1 className="text-3xl md:text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
          Genera <span className="gradient-text">10 infografiche</span> da un ASIN
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Inserisci un ASIN Amazon — analisi AI + 10 immagini professionali stile Mariano.
        </p>
      </div>

      {/* ── Mariano Prompts.json Generator ─────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Genera Prompts.json" badge="Mariano Style · 10 foto" />
        </div>

        {/* Input card */}
        <div className="card p-6 mb-4">
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Analizza un ASIN e genera automaticamente un <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "var(--purple-400)" }}>prompts.json</code> professionale
            in stile Mariano — 10 immagini, PHOTO EDITING task, prodotto intoccabile.
          </p>
          <form onSubmit={handleMarianoGenerate} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={marianoAsin}
                onChange={(e) => { setMarianoAsin(e.target.value.toUpperCase()); setMarianoError(null); }}
                placeholder="ASIN — es. B08N5WRWNW"
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl font-mono text-base tracking-widest outline-none transition-all"
                style={{
                  background: "rgba(11,11,24,0.6)",
                  border: marianoError ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(139,92,246,0.3)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => { if (!marianoError) e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.2)"; }}
                onBlur={(e)  => { e.currentTarget.style.boxShadow = "none"; }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono"
                style={{ color: marianoAsin.length === 10 ? "var(--purple-400)" : "var(--text-muted)" }}>
                {marianoAsin.length}/10
              </span>
            </div>
            <button
              type="submit"
              disabled={marianoLoading || marianoAsin.length !== 10}
              className="btn-primary whitespace-nowrap"
            >
              {marianoLoading
                ? <span className="flex items-center gap-2"><SpinnerIcon />Analisi AI...</span>
                : <span className="flex items-center gap-2"><JsonIcon />Genera JSON</span>
              }
            </button>
          </form>

          {marianoError && (
            <p className="mt-2 text-xs font-mono" style={{ color: "#F87171" }}>
              ✕ {marianoError}
            </p>
          )}

          {/* Steps explanation */}
          <div className="flex gap-3 flex-wrap mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {["Scraping Amazon", "Vision AI analisi", "Genera 10 prompt", "Download JSON"].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ background: "rgba(139,92,246,0.2)", color: "var(--purple-400)" }}>
                  {i + 1}
                </span>
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* Result */}
        {marianoResult && (
          <div className="card p-6 space-y-5">
            {/* Header bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full shrink-0" style={{
                  background: marianoResult.accent_color_hex,
                  boxShadow: `0 0 12px ${marianoResult.accent_color_hex}99`,
                }} />
                <div>
                  <p className="text-sm font-bold flex items-center gap-2 flex-wrap" style={{ color: "var(--text-primary)" }}>
                    prompts.json generato — {marianoAsin}
                    {marianoResult._cache_hit && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        title="Risultato servito da cache (Rainforest + Claude saltati)"
                        style={{ background: "rgba(74,222,128,0.18)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.35)" }}>
                        ⚡ CACHE
                      </span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Effetto: <span style={{ color: marianoResult.accent_color_hex }}>{marianoResult.categoria_effetto_01b}</span>
                    {" · "}Accent: <code className="font-mono">{marianoResult.accent_color_hex}</code>
                    {" · "}{marianoResult.images.length} immagini
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {marianoResult._cache_hit && (
                  <button onClick={handleMarianoRefresh}
                    disabled={marianoLoading}
                    title="Forza rigenerazione (Rainforest + Claude, nuovo costo)"
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg font-semibold transition-all"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      color: "var(--text-muted)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}>
                    Rigenera
                  </button>
                )}
                <button onClick={downloadMarianoJson}
                  className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg font-semibold transition-all"
                  style={{
                    background: "rgba(139,92,246,0.18)",
                    color: "var(--purple-400)",
                    border: "1px solid rgba(139,92,246,0.3)",
                  }}>
                  <DownloadIcon /> Download .json
                </button>
              </div>
            </div>

            {/* Color palette */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>PALETTE SFONDO</p>
              <div className="flex gap-2">
                {marianoResult.palette_sfondo_hex.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg border" style={{ background: c, borderColor: "rgba(255,255,255,0.1)" }} />
                    <code className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{c}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual description */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>DESCRIZIONE VISIVA PRODOTTO</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {marianoResult.product_visual_description}
              </p>
            </div>

            {/* 10 image cards */}
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                10 IMMAGINI GENERATE
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {marianoResult.images.map((img) => (
                  <button
                    key={img.number}
                    onClick={() => setExpandedImg(expandedImg === img.number ? null : img.number)}
                    className="text-left rounded-xl p-3 transition-all"
                    style={{
                      background: expandedImg === img.number ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)",
                      border: expandedImg === img.number
                        ? `1px solid ${marianoResult.accent_color_hex}66`
                        : "1px solid rgba(255,255,255,0.08)",
                    }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold" style={{ color: marianoResult.accent_color_hex }}>
                        {img.number}
                      </span>
                      {img.logo_variant && (
                        <span className="text-[10px] px-1 rounded" style={{ background: "rgba(252,211,77,0.15)", color: "#FCD34D" }}>
                          LOGO
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                      {img.name}
                    </p>
                    <p className="text-[10px] mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      {img.prompt.split("\n\n").slice(-1)[0]?.slice(0, 80)}…
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Expanded prompt viewer */}
            {expandedImg && (() => {
              const img = marianoResult.images.find((i) => i.number === expandedImg);
              if (!img) return null;
              return (
                <div className="rounded-xl p-4 relative"
                  style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${marianoResult.accent_color_hex}33` }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      Immagine {img.number} — {img.name}
                    </p>
                    <button onClick={() => setExpandedImg(null)}
                      className="text-xs w-6 h-6 rounded flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-muted)" }}>
                      ✕
                    </button>
                  </div>
                  <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words overflow-auto max-h-96"
                    style={{ color: "#A0A0C0" }}>
                    {img.prompt}
                  </pre>
                </div>
              );
            })()}

            {/* ── Generate Images CTA ─── */}
            <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    Genera le 10 immagini
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Gemini riceve le foto reference del prodotto + ogni prompt → genera le infografiche
                  </p>
                </div>
                <button
                  onClick={handleGenerateImages}
                  disabled={imgGenLoading}
                  className="btn-primary whitespace-nowrap"
                >
                  {imgGenLoading
                    ? <span className="flex items-center gap-2"><SpinnerIcon />Generazione ({generatedImages.length}/10)...</span>
                    : <span className="flex items-center gap-2"><ImageIcon />Genera 10 Immagini</span>
                  }
                </button>
              </div>
              {imgGenError && (
                <p className="mt-2 text-xs font-mono" style={{ color: "#F87171" }}>✕ {imgGenError}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Generated images grid ─── */}
        {generatedImages.length > 0 && (
          <div className="card p-6 mt-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {generatedImages.filter(i => i.image_b64).length}/{generatedImages.length} immagini generate
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Clicca un&apos;immagine per scaricarla singolarmente
                </p>
              </div>
              <button
                onClick={handleDownloadZip}
                disabled={zipLoading || generatedImages.filter(i => i.image_b64).length === 0}
                className="btn-primary whitespace-nowrap"
                title="Scarica tutte le immagini come archivio ZIP"
              >
                {zipLoading
                  ? <span className="flex items-center gap-2"><SpinnerIcon />Creazione ZIP...</span>
                  : <span className="flex items-center gap-2"><DownloadIcon />Scarica ZIP ({generatedImages.filter(i => i.image_b64).length})</span>
                }
              </button>
            </div>
            {zipError && (
              <p className="text-xs font-mono" style={{ color: "#F87171" }}>✕ {zipError}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {generatedImages.map((img) => (
                <div key={img.number} className="flex flex-col gap-1">
                  <div
                    className="aspect-square rounded-xl overflow-hidden relative transition-all"
                    style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {img.image_b64 ? (
                      <button
                        onClick={() => downloadImage(img)}
                        className="w-full h-full group relative"
                        title={`Scarica ${img.name}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:${img.mime ?? "image/png"};base64,${img.image_b64}`}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          style={{ background: "rgba(0,0,0,0.55)" }}>
                          <DownloadIcon />
                        </div>
                      </button>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2"
                        style={{ background: "rgba(248,113,113,0.08)" }}>
                        <span style={{ color: "#F87171" }}>✕</span>
                        <p className="text-[10px] text-center leading-tight" style={{ color: "#F87171" }}>
                          {img.error?.slice(0, 60)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono font-bold"
                      style={{ color: marianoResult?.accent_color_hex ?? "var(--purple-400)" }}>
                      {img.number}
                    </span>
                    <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                      {img.name}
                    </span>
                    {img.model && (
                      <span className="ml-auto text-[9px] px-1 rounded shrink-0"
                        style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                        {img.model}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </svg>
  );
}
function JsonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
