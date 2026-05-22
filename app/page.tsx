"use client";
import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import JSZip from "jszip";
import ImageThumb from "@/components/ImageThumb";
import Lightbox from "@/components/Lightbox";
import { saveRun } from "@/lib/imageStore";

/* ────────────────────────────────────────────────────────────────────────────
 *  Types
 * ────────────────────────────────────────────────────────────────────────── */
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

type StepStatus = "locked" | "active" | "done";

const RECENT_KEY = "recent_asins_v1";
const MAX_RECENTS = 5;
const ASIN_RE = /^[A-Z0-9]{10}$/;

/**
 * Extract a clean 10-char ASIN from a user paste. Accepts:
 *   - bare ASIN: "B08N5WRWNW"
 *   - Amazon URL: ".../dp/B08N5WRWNW/...", ".../gp/product/B08N5WRWNW/..."
 *   - Anything else: returns the first 10 alphanumeric chars uppercased
 */
function extractAsin(raw: string): string {
  const trimmed = raw.trim();
  const urlMatch = trimmed.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i);
  if (urlMatch) return urlMatch[1].toUpperCase();
  const cleaned = trimmed.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return cleaned.slice(0, 10);
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Main page
 * ────────────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  /* Step 1 — ASIN + prompts.json */
  const searchParams = useSearchParams();
  const [asin, setAsin]                           = useState("");

  /* Pre-fill from ?asin=B0... (used by TopBar bell, search, /history clicks) */
  useEffect(() => {
    const q = (searchParams.get("asin") ?? "").trim().toUpperCase();
    if (ASIN_RE.test(q)) setAsin(q);
  }, [searchParams]);
  const [marianoLoading, setMarianoLoading]       = useState(false);
  const [marianoError, setMarianoError]           = useState<string | null>(null);
  const [marianoResult, setMarianoResult]         = useState<MarianoResult | null>(null);

  /* Step 2 — 10 image generation */
  const [imgGenLoading, setImgGenLoading]         = useState(false);
  const [imgGenError, setImgGenError]             = useState<string | null>(null);
  const [generatedImages, setGeneratedImages]     = useState<GeneratedImage[]>([]);

  /* Step 3 — ZIP download */
  const [zipLoading, setZipLoading]               = useState(false);
  const [zipError, setZipError]                   = useState<string | null>(null);

  /* UI */
  const [expandedImg, setExpandedImg]             = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx]             = useState<number | null>(null);
  const [recentAsins, setRecentAsins]             = useState<string[]>([]);

  /* Refs for smooth auto-scroll */
  const step2Ref = useRef<HTMLElement | null>(null);
  const step3Ref = useRef<HTMLElement | null>(null);

  const validImages = generatedImages.filter(i => i.image_b64);

  /* ── Load recents from localStorage ───────────────────────────────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setRecentAsins(arr.filter(x => typeof x === "string" && ASIN_RE.test(x)).slice(0, MAX_RECENTS));
      }
    } catch { /* no-op */ }
  }, []);

  const pushRecent = useCallback((value: string) => {
    if (!ASIN_RE.test(value)) return;
    setRecentAsins(prev => {
      const next = [value, ...prev.filter(x => x !== value)].slice(0, MAX_RECENTS);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* no-op */ }
      return next;
    });
  }, []);

  /* ── Smooth auto-scroll when a step unlocks ───────────────────────────── */
  const didScrollStep2 = useRef(false);
  const didScrollStep3 = useRef(false);
  useEffect(() => {
    if (marianoResult && !didScrollStep2.current && step2Ref.current) {
      didScrollStep2.current = true;
      step2Ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (!marianoResult) didScrollStep2.current = false;
  }, [marianoResult]);
  useEffect(() => {
    if (validImages.length > 0 && !didScrollStep3.current && step3Ref.current) {
      didScrollStep3.current = true;
      step3Ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (validImages.length === 0) didScrollStep3.current = false;
  }, [validImages.length]);

  /* ── Keyboard shortcuts (ESC closes overlays) ─────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxIdx !== null) { setLightboxIdx(null); return; }
        if (expandedImg) { setExpandedImg(null); return; }
      }
      if (lightboxIdx !== null) {
        if (e.key === "ArrowRight") setLightboxIdx(i => (i === null ? null : Math.min(validImages.length - 1, i + 1)));
        if (e.key === "ArrowLeft")  setLightboxIdx(i => (i === null ? null : Math.max(0, i - 1)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, expandedImg, validImages.length]);

  /* ── Step status ──────────────────────────────────────────────────────── */
  const s1: StepStatus = marianoResult ? "done" : (marianoLoading ? "active" : "active");
  const s2: StepStatus = marianoResult ? (validImages.length > 0 ? "done" : "active") : "locked";
  const s3: StepStatus = validImages.length > 0 ? "active" : "locked";

  /* ── Handlers ─────────────────────────────────────────────────────────── */
  const generatePrompts = async (forceRefresh: boolean = false) => {
    if (!asin.match(/^[A-Z0-9]{10}$/)) {
      setMarianoError("ASIN deve essere 10 caratteri alfanumerici");
      return;
    }
    setMarianoLoading(true);
    setMarianoError(null);
    setMarianoResult(null);
    setGeneratedImages([]);
    setExpandedImg(null);

    try {
      const res = await fetch("/api/generate-mariano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin, force_refresh: forceRefresh }),
      });
      const data = await res.json();
      if (!res.ok) { setMarianoError(data.error || `HTTP ${res.status}`); return; }
      setMarianoResult(data as MarianoResult);
      pushRecent(asin);
    } catch (err) {
      setMarianoError(err instanceof Error ? err.message : "Errore di rete");
    } finally {
      setMarianoLoading(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!marianoResult || !asin) return;
    setImgGenLoading(true);
    setImgGenError(null);
    setGeneratedImages([]);

    try {
      const { _analysis: _, ...cleanJson } =
        marianoResult as MarianoResult & { _analysis?: unknown };
      const res = await fetch("/api/generate-mariano-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin, prompts_json: cleanJson }),
      });
      const data = await res.json();
      if (!res.ok) { setImgGenError(data.error || `HTTP ${res.status}`); return; }
      const imgs = data.images ?? [];
      setGeneratedImages(imgs);

      /* Persist the run to IndexedDB so /run/[asin] and the history page
         can show the gallery later without re-running the pipeline. */
      saveRun(asin, imgs, {
        accent:      marianoResult.accent_color_hex,
        palette:     marianoResult.palette_sfondo_hex,
        categoria:   marianoResult.categoria_effetto_01b,
        description: marianoResult.product_visual_description,
      }).catch((e) => console.warn("[imageStore] saveRun failed:", e));
    } catch (err) {
      setImgGenError(err instanceof Error ? err.message : "Errore di rete");
    } finally {
      setImgGenLoading(false);
    }
  };

  /**
   * Build the ZIP entirely in the browser. We previously round-tripped the
   * base64 payload through /api/download-zip but Vercel's 4.5 MB body limit
   * returns HTTP 413 once you have 10 high-res images (~13 MB base64).
   * JSZip works directly on the existing base64 data already in memory.
   */
  const handleDownloadZip = async () => {
    if (!validImages.length || !asin) return;
    setZipLoading(true);
    setZipError(null);
    try {
      const zip = new JSZip();
      const used = new Set<string>();
      for (const img of validImages) {
        if (!img.image_b64) continue;
        const ext  = (img.mime ?? "image/png").split("/")[1]?.split(";")[0] || "png";
        const safe = `${asin}_${img.number}_${img.name}`
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .slice(0, 120);
        let name = `${safe}.${ext}`;
        let i = 2;
        while (used.has(name)) { name = `${safe}_${i}.${ext}`; i += 1; }
        used.add(name);
        zip.file(name, img.image_b64, { base64: true });
      }
      const blob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }
      );
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url; a.download = `${asin}_infografiche.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Errore creazione ZIP");
    } finally {
      setZipLoading(false);
    }
  };

  const downloadJson = () => {
    if (!marianoResult) return;
    const { _analysis: _, ...clean } =
      marianoResult as MarianoResult & { _analysis?: unknown };
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${asin}_prompts.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadOne = (img: GeneratedImage) => {
    if (!img.image_b64) return;
    const a = document.createElement("a");
    a.href = `data:${img.mime ?? "image/png"};base64,${img.image_b64}`;
    a.download = `${asin}_${img.number}_${img.name.replace(/\s+/g, "_")}.png`;
    a.click();
  };

  /* ── Cost estimate (display only) ─────────────────────────────────────── */
  const costEstimate = useMemo(() => {
    if (!marianoResult) return null;
    const cached = marianoResult._cache_hit;
    const rainforest = cached ? 0 : 0.003;
    const claude     = cached ? 0 : 0.025;
    const gemini     = 0.82;   // 7 Pro + 3 Flash
    return (rainforest + claude + gemini);
  }, [marianoResult]);

  /* ──────────────────────────────────────────────────────────────────── */
  return (
    <main id="generate" className="px-5 md:px-8 pt-6 md:pt-10 pb-16 max-w-5xl mx-auto">

        {/* Hero */}
        <header className="mb-8 md:mb-14">
          <p className="text-[10px] sm:text-xs font-semibold tracking-[0.18em] uppercase mb-2 sm:mb-3"
            style={{ color: "var(--purple-400)" }}>
            Amazon · Infografiche AI
          </p>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight"
            style={{ color: "var(--text-primary)" }}>
            Da ASIN a <span className="gradient-text">10 immagini pronte</span>
            <br className="hidden md:block" /> per il listing.
          </h1>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base max-w-2xl" style={{ color: "var(--text-muted)" }}>
            Analisi vision del prodotto, generazione dei 10 prompt in stile Mariano,
            poi rendering parallelo con Nano Banana Pro + Flash. Tutto in un flusso a 3 passi.
          </p>
        </header>

        {/* Stepper */}
        <Stepper s1={s1} s2={s2} s3={s3} />

        {/* ─────────────── STEP 1 ─────────────── */}
        <Step
          status={s1 === "done" ? "done" : "active"}
          num="01"
          title="Inserisci l'ASIN"
          subtitle="Un ASIN Amazon italiano (10 caratteri alfanumerici)"
        >
          <form
            onSubmit={(e) => { e.preventDefault(); generatePrompts(false); }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="flex-1 relative">
              <input
                type="text"
                value={asin}
                onChange={(e) => { setAsin(extractAsin(e.target.value)); setMarianoError(null); }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  const extracted = extractAsin(pasted);
                  if (extracted && extracted !== pasted.trim().toUpperCase()) {
                    e.preventDefault();
                    setAsin(extracted);
                    setMarianoError(null);
                  }
                }}
                placeholder="B08N5WRWNW  oppure  amazon.it/dp/B08N5WRWNW"
                maxLength={120}
                spellCheck={false}
                autoCapitalize="characters"
                className="w-full px-5 py-4 rounded-xl font-mono text-lg tracking-[0.18em] outline-none transition-all"
                style={{
                  background: "rgba(11,11,24,0.7)",
                  border: marianoError
                    ? "1px solid rgba(239,68,68,0.55)"
                    : asin.length === 10
                      ? "1px solid rgba(139,92,246,0.55)"
                      : "1px solid rgba(139,92,246,0.22)",
                  color: "var(--text-primary)",
                  boxShadow: asin.length === 10 && !marianoError
                    ? "0 0 0 4px rgba(139,92,246,0.12)"
                    : "none",
                }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono"
                style={{ color: asin.length === 10 ? "var(--purple-400)" : "var(--text-muted)" }}>
                {asin.length}/10
              </span>
            </div>
            <button
              type="submit"
              disabled={marianoLoading || asin.length !== 10}
              className="btn-primary whitespace-nowrap text-base"
              style={{ padding: "1rem 1.75rem" }}
            >
              {marianoLoading
                ? <span className="flex items-center gap-2"><SpinnerIcon />Analisi AI…</span>
                : <span className="flex items-center gap-2"><ArrowRightIcon />Analizza</span>}
            </button>
          </form>

          {recentAsins.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold tracking-wider uppercase shrink-0"
                style={{ color: "var(--text-muted)" }}>
                Recenti
              </span>
              {recentAsins.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setAsin(r); setMarianoError(null); }}
                  className="text-[11px] font-mono px-2.5 py-1 rounded-md transition-all hover:scale-[1.03]"
                  style={{
                    background: asin === r ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
                    border: asin === r ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: asin === r ? "var(--purple-400)" : "var(--text-muted)",
                  }}>
                  {r}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setRecentAsins([]);
                  try { localStorage.removeItem(RECENT_KEY); } catch { /* no-op */ }
                }}
                title="Cancella ASIN recenti"
                className="text-[10px] px-1.5 py-1 rounded-md opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>
          )}

          {marianoError && (
            <div className="mt-3 px-3 py-2 rounded-lg text-xs flex items-start gap-2 fade-up"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }}>
              <span className="font-mono">✕</span>
              <span>{marianoError}</span>
            </div>
          )}

          <div className="mt-5 pt-4 flex flex-wrap gap-x-5 gap-y-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {["Scraping Amazon", "Vision Claude", "10 prompt", "Pronti per render"].map((s, i) => {
              const reached = marianoLoading || marianoResult;
              return (
                <div key={s} className="flex items-center gap-1.5 text-xs"
                  style={{ color: reached ? "var(--text-primary)" : "var(--text-muted)" }}>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all"
                    style={{
                      background: reached ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.04)",
                      color: reached ? "var(--purple-400)" : "var(--text-muted)",
                    }}>
                    {i + 1}
                  </span>
                  {s}
                </div>
              );
            })}
          </div>
        </Step>

        {/* ─────────────── STEP 2 ─────────────── */}
        <Step
          status={s2}
          num="02"
          title="Verifica prompts.json"
          subtitle="Controlla effetto + palette, poi avvia il rendering delle 10 immagini"
          sectionRef={step2Ref}
        >
          {!marianoResult && !marianoLoading && (
            <EmptyHint text="Compila lo step 1 per generare i prompt." />
          )}

          {!marianoResult && marianoLoading && (
            <div className="fade-up">
              <div className="flex items-center gap-3 mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
                <SpinnerIcon /> Claude sta analizzando il prodotto…
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <SkeletonCard key={i} delay={i * 70} />
                ))}
              </div>
            </div>
          )}

          {marianoResult && (
            <div className="space-y-6 fade-up">
              {/* Result summary */}
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg shrink-0 mt-0.5" style={{
                    background: marianoResult.accent_color_hex,
                    boxShadow: `0 0 24px ${marianoResult.accent_color_hex}55`,
                  }} />
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1.5">
                      <h3 className="text-base md:text-lg font-bold"
                        style={{ color: "var(--text-primary)" }}>
                        prompts.json — {asin}
                      </h3>
                      {marianoResult._cache_hit && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                          title="Servito da cache Supabase: Rainforest + Claude saltati"
                          style={{
                            background: "rgba(74,222,128,0.15)",
                            color: "#4ADE80",
                            border: "1px solid rgba(74,222,128,0.35)",
                          }}>
                          ⚡ CACHE
                        </span>
                      )}
                      {costEstimate !== null && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                          title="Costo stimato totale per questa run (Claude + Gemini)"
                          style={{
                            background: "rgba(139,92,246,0.12)",
                            color: "var(--purple-400)",
                            border: "1px solid rgba(139,92,246,0.25)",
                          }}>
                          ≈ ${costEstimate.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      Effetto: <span style={{ color: marianoResult.accent_color_hex }}>
                        {marianoResult.categoria_effetto_01b}
                      </span>
                      <span className="mx-2 opacity-40">·</span>
                      Palette
                      <span className="inline-flex gap-1 ml-2 align-middle">
                        {marianoResult.palette_sfondo_hex.map((c) => (
                          <span key={c} className="inline-block w-3.5 h-3.5 rounded"
                            style={{ background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
                        ))}
                      </span>
                      <span className="mx-2 opacity-40">·</span>
                      {marianoResult.images.length} prompt
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {marianoResult._cache_hit && (
                    <button
                      onClick={() => generatePrompts(true)}
                      disabled={marianoLoading}
                      className="text-xs px-3 py-2 rounded-lg font-semibold transition-all"
                      title="Forza una nuova chiamata Rainforest + Claude (nuovo costo ~$0.028)"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--text-muted)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}>
                      <span className="flex items-center gap-1.5"><RefreshIcon />Rigenera</span>
                    </button>
                  )}
                  <button onClick={downloadJson}
                    className="text-xs px-3 py-2 rounded-lg font-semibold transition-all"
                    style={{
                      background: "rgba(139,92,246,0.15)",
                      color: "var(--purple-400)",
                      border: "1px solid rgba(139,92,246,0.3)",
                    }}>
                    <span className="flex items-center gap-1.5"><DownloadIcon />.json</span>
                  </button>
                </div>
              </div>

              {/* Description (collapsed by default — short version) */}
              <details className="rounded-lg group"
                style={{ background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <summary className="px-4 py-3 cursor-pointer text-xs font-semibold tracking-wider uppercase select-none flex items-center justify-between"
                  style={{ color: "var(--text-muted)" }}>
                  <span>Descrizione visiva prodotto</span>
                  <span className="text-[10px] opacity-60 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="px-4 pb-4 text-xs leading-relaxed"
                  style={{ color: "var(--text-primary)" }}>
                  {marianoResult.product_visual_description}
                </p>
              </details>

              {/* 10 prompt mini-cards */}
              <div>
                <p className="text-xs font-semibold tracking-wider uppercase mb-3"
                  style={{ color: "var(--text-muted)" }}>
                  10 prompt generati · click per ispezionare
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {marianoResult.images.map((img) => {
                    const active = expandedImg === img.number;
                    return (
                      <button
                        key={img.number}
                        onClick={() => setExpandedImg(active ? null : img.number)}
                        className="text-left rounded-xl p-3 transition-all"
                        style={{
                          background: active ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.03)",
                          border: active
                            ? `1px solid ${marianoResult.accent_color_hex}77`
                            : "1px solid rgba(255,255,255,0.07)",
                        }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold"
                            style={{ color: marianoResult.accent_color_hex }}>
                            {img.number}
                          </span>
                          {img.logo_variant && (
                            <span className="text-[9px] px-1 rounded"
                              style={{ background: "rgba(252,211,77,0.16)", color: "#FCD34D" }}>
                              LOGO
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold leading-tight"
                          style={{ color: "var(--text-primary)" }}>
                          {img.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {expandedImg && (() => {
                const img = marianoResult.images.find((i) => i.number === expandedImg);
                if (!img) return null;
                return (
                  <div className="rounded-xl p-4 fade-up"
                    style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${marianoResult.accent_color_hex}33` }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        Prompt {img.number} — {img.name}
                      </p>
                      <button onClick={() => setExpandedImg(null)}
                        className="text-xs w-7 h-7 rounded-md flex items-center justify-center transition-all"
                        style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                        ✕
                      </button>
                    </div>
                    <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words overflow-auto max-h-80"
                      style={{ color: "#A0A0C0" }}>
                      {img.prompt}
                    </pre>
                  </div>
                );
              })()}

              {/* CTA — Genera 10 immagini */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    {validImages.length > 0 ? "Le immagini sono qui sotto" : "Pronto al rendering"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    7 slide con testo → Nano Banana Pro · 3 slide senza testo → Flash
                  </p>
                </div>
                <button
                  onClick={handleGenerateImages}
                  disabled={imgGenLoading}
                  className="btn-primary whitespace-nowrap"
                >
                  {imgGenLoading
                    ? <span className="flex items-center gap-2"><SpinnerIcon />Generazione…</span>
                    : validImages.length > 0
                      ? <span className="flex items-center gap-2"><RefreshIcon />Rigenera 10 immagini</span>
                      : <span className="flex items-center gap-2"><SparkIcon />Genera 10 immagini</span>}
                </button>
              </div>

              {imgGenError && (
                <div className="px-3 py-2 rounded-lg text-xs flex items-start gap-2"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }}>
                  <span className="font-mono">✕</span>
                  <span>{imgGenError}</span>
                </div>
              )}
            </div>
          )}
        </Step>

        {/* ─────────────── STEP 3 ─────────────── */}
        <Step
          status={s3}
          num="03"
          title="Scarica le immagini"
          subtitle="Click su un'immagine per ingrandirla, ZIP per scaricarle tutte"
          sectionRef={step3Ref}
        >
          {validImages.length === 0 && !imgGenLoading && (
            <EmptyHint text="Completa lo step 2 per generare le 10 immagini." />
          )}

          {validImages.length === 0 && imgGenLoading && (
            <div className="fade-up">
              <div className="flex items-center gap-3 mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
                <SpinnerIcon /> Rendering in corso · Nano Banana sta generando 10 immagini in parallelo…
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <SkeletonThumb key={i} delay={i * 80} />
                ))}
              </div>
            </div>
          )}

          {validImages.length > 0 && (
            <div className="space-y-5 fade-up">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    {validImages.length}/{generatedImages.length} immagini pronte
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Hover su un&apos;immagine per download singolo · ZIP a destra
                  </p>
                </div>
                <button
                  onClick={handleDownloadZip}
                  disabled={zipLoading || validImages.length === 0}
                  className="btn-primary whitespace-nowrap"
                  title="Scarica tutte le immagini come archivio ZIP"
                >
                  {zipLoading
                    ? <span className="flex items-center gap-2"><SpinnerIcon />Creazione ZIP…</span>
                    : <span className="flex items-center gap-2"><DownloadIcon />Scarica ZIP ({validImages.length})</span>}
                </button>
              </div>

              {zipError && (
                <div className="px-3 py-2 rounded-lg text-xs flex items-start gap-2"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }}>
                  <span className="font-mono">✕</span>
                  <span>{zipError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {generatedImages.map((img, idx) => {
                  const validIdx = validImages.findIndex(v => v.number === img.number);
                  return (
                    <ImageThumb
                      key={img.number}
                      img={img}
                      accent={marianoResult?.accent_color_hex ?? "var(--purple-400)"}
                      onClick={() => {
                        if (img.image_b64 && validIdx >= 0) setLightboxIdx(validIdx);
                      }}
                      onDownload={() => downloadOne(img)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </Step>

        <footer className="mt-12 pt-6 text-xs text-center" style={{ color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          Claude Haiku 4.5 · Nano Banana Pro · Flash · GPT Image · Supabase cache
          <span className="block mt-1 opacity-60">
            <kbd className="px-1 py-0.5 rounded text-[9px]"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>ESC</kbd>
            {" "}chiude i pannelli — {" "}
            <kbd className="px-1 py-0.5 rounded text-[9px]"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>← →</kbd>
            {" "}navigano nelle immagini
          </span>
        </footer>

        {lightboxIdx !== null && validImages[lightboxIdx] && (
          <Lightbox
            img={validImages[lightboxIdx]}
            index={lightboxIdx}
            total={validImages.length}
            accent={marianoResult?.accent_color_hex ?? "#A78BFA"}
            onClose={() => setLightboxIdx(null)}
            onPrev={() => setLightboxIdx(i => (i === null ? null : Math.max(0, i - 1)))}
            onNext={() => setLightboxIdx(i => (i === null ? null : Math.min(validImages.length - 1, i + 1)))}
            onDownload={() => downloadOne(validImages[lightboxIdx])}
          />
        )}
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Building blocks
 * ────────────────────────────────────────────────────────────────────────── */

function Stepper({ s1, s2, s3 }: { s1: StepStatus; s2: StepStatus; s3: StepStatus }) {
  const Cls = (s: StepStatus) =>
    `step-dot ${s === "done" ? "done" : s === "active" ? "active" : "locked"}`;
  const Line = (a: StepStatus, b: StepStatus) => {
    if (a === "done" && b !== "locked") return "step-line done";
    if (a === "done" || a === "active") return "step-line active";
    return "step-line";
  };

  const labels = ["ASIN", "Prompts", "Immagini"];
  const statuses: StepStatus[] = [s1, s2, s3];

  return (
    <nav aria-label="Step progression" className="mb-8 md:mb-10">
      <div className="flex items-center gap-3">
        {statuses.map((status, i) => (
          <div key={i} className="flex items-center flex-1 gap-3 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={Cls(status)}>
                {status === "done" ? <CheckIcon /> : i + 1}
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold"
                style={{
                  color: status === "active" ? "var(--text-primary)" :
                         status === "done"   ? "#4ADE80" :
                                                "var(--text-muted)",
                }}>
                {labels[i]}
              </span>
            </div>
            {i < statuses.length - 1 && (
              <div className={Line(statuses[i], statuses[i + 1])} />
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

function Step({
  status,
  num,
  title,
  subtitle,
  children,
  sectionRef,
}: {
  status: StepStatus;
  num: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  sectionRef?: React.RefObject<HTMLElement | null>;
}) {
  const cls = `card-step p-6 md:p-8 mb-6 ${status === "active" ? "active" : status === "locked" ? "locked" : ""}`;
  return (
    <section ref={sectionRef} className={cls} style={{ scrollMarginTop: "5rem" }}>
      <div className="flex items-start gap-4 mb-5">
        <span className="text-2xl md:text-3xl font-mono font-black leading-none mt-0.5"
          style={{
            color: status === "done" ? "#4ADE80" :
                   status === "active" ? "var(--purple-400)" :
                                          "var(--text-muted)",
            opacity: status === "locked" ? 0.5 : 1,
          }}>
          {num}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <p className="text-xs md:text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="px-4 py-8 rounded-xl text-center"
      style={{
        background: "rgba(255,255,255,0.015)",
        border: "1px dashed rgba(255,255,255,0.08)",
        color: "var(--text-muted)",
      }}>
      <p className="text-xs">{text}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Skeleton loaders (used while AI generates content)
 * ────────────────────────────────────────────────────────────────────────── */
function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-xl p-3 skeleton-pulse"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.05)",
        animationDelay: `${delay}ms`,
      }}>
      <div className="h-3 w-8 rounded mb-2 skeleton-shimmer" />
      <div className="h-3 w-3/4 rounded mb-1.5 skeleton-shimmer" />
      <div className="h-2 w-1/2 rounded skeleton-shimmer" />
    </div>
  );
}

function SkeletonThumb({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="aspect-square rounded-xl skeleton-shimmer skeleton-pulse"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          animationDelay: `${delay}ms`,
        }}
      />
      <div className="flex items-center gap-1.5 px-0.5">
        <div className="h-2.5 w-6 rounded skeleton-shimmer" />
        <div className="h-2.5 w-16 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Icons
 * ────────────────────────────────────────────────────────────────────────── */
function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 3v4M21 5h-4" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
