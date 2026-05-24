"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import JSZip from "jszip";
import ImageThumb, { type ThumbImage } from "@/components/ImageThumb";
import Lightbox from "@/components/Lightbox";
import { getRun, deleteRun, type StoredRun } from "@/lib/imageStore";
import { compositeSlideToBlob } from "@/lib/renderSlide";

export default function RunPage() {
  const router = useRouter();
  const { asin: rawAsin } = useParams<{ asin: string }>();
  const asin = (rawAsin ?? "").toUpperCase();

  const [run, setRun]         = useState<StoredRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* Load the stored run */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getRun(asin)
      .then((r) => { if (alive) setRun(r); })
      .catch((e) => console.warn("[run] getRun failed:", e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [asin]);

  const validImages = run?.images.filter((i) => i.image_b64) ?? [];

  /* Keyboard: ESC closes lightbox, ← → navigates */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightboxIdx === null) return;
      if (e.key === "Escape")     setLightboxIdx(null);
      if (e.key === "ArrowRight") setLightboxIdx((i) => (i === null ? null : Math.min(validImages.length - 1, i + 1)));
      if (e.key === "ArrowLeft")  setLightboxIdx((i) => (i === null ? null : Math.max(0, i - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, validImages.length]);

  const accent = run?.meta.accent || "#1E3FD9";

  const downloadOne = useCallback(async (img: ThumbImage) => {
    if (!img.image_b64) return;
    const png = await compositeSlideToBlob({
      imageB64: img.image_b64, mime: img.mime, overlay: img.overlay, accent, edits: img.overlayEdits,
    });
    const url = URL.createObjectURL(png);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${asin}_${img.number}_${img.name.replace(/\s+/g, "_")}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [asin, accent]);

  const downloadZip = useCallback(async () => {
    if (!validImages.length) return;
    setZipBusy(true);
    setZipError(null);
    try {
      const zip = new JSZip();
      const used = new Set<string>();
      for (const img of validImages) {
        if (!img.image_b64) continue;
        const safe = `${asin}_${img.number}_${img.name}`
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .slice(0, 120);
        let name = `${safe}.png`;
        let i = 2;
        while (used.has(name)) { name = `${safe}_${i}.png`; i += 1; }
        used.add(name);
        const png = await compositeSlideToBlob({
          imageB64: img.image_b64, mime: img.mime, overlay: img.overlay, accent, edits: img.overlayEdits,
        });
        zip.file(name, png);
      }
      const blob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }
      );
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url; a.download = `${asin}_infografiche.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setZipError(e instanceof Error ? e.message : "Errore creazione ZIP");
    } finally {
      setZipBusy(false);
    }
  }, [validImages, asin, accent]);

  const handleDelete = async () => {
    await deleteRun(asin);
    router.push("/history");
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <main className="px-5 md:px-8 pt-6 md:pt-10 pb-16 max-w-5xl mx-auto">
        <div className="h-24 rounded-xl skeleton-shimmer skeleton-pulse mb-4"
          style={{ background: "rgba(30,63,217,0.03)" }} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl skeleton-shimmer skeleton-pulse"
              style={{ background: "rgba(30,63,217,0.04)", animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="px-5 md:px-8 pt-6 md:pt-10 pb-16 max-w-3xl mx-auto">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-2"
            style={{ color: "var(--purple-400)" }}>
            Cronologia · Run
          </p>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Nessuna immagine salvata per <span className="font-mono">{asin}</span>
          </h1>
        </header>

        <div className="px-6 py-10 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)" }}>
          <p className="text-sm mb-3" style={{ color: "var(--text-primary)" }}>
            Le immagini di questo ASIN non sono presenti sul tuo dispositivo.
          </p>
          <p className="text-xs leading-relaxed mb-5" style={{ color: "var(--text-muted)" }}>
            Lo storage delle immagini è locale al browser. Se hai generato questo run su un
            altro dispositivo o in incognito, devi rigenerarlo qui per averlo offline.
            Grazie alla cache Supabase dei prompt il costo è ridotto a ~$0.82 invece di ~$0.85.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/?asin=${asin}`}
              className="btn-primary text-sm" style={{ padding: "0.625rem 1.25rem" }}>
              Rigenera ora →
            </Link>
            <Link href="/history"
              className="text-sm px-4 py-2.5 rounded-lg font-semibold transition-all"
              style={{
                background: "rgba(30,63,217,0.04)",
                color: "var(--text-muted)",
                border: "1px solid rgba(30,63,217,0.08)",
              }}>
              Torna alla cronologia
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-5 md:px-8 pt-6 md:pt-10 pb-16 max-w-5xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Link href="/history" className="text-xs font-semibold"
            style={{ color: "var(--text-muted)" }}>
            ← Cronologia
          </Link>
        </div>
        <div className="flex items-start flex-wrap gap-4 justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl shrink-0"
              style={{ background: accent, boxShadow: `0 0 24px ${accent}55` }} />
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold font-mono tracking-tight"
                style={{ color: "var(--text-primary)" }}>
                {run.asin}
              </h1>
              <p className="text-xs mt-1 flex items-center gap-2 flex-wrap"
                style={{ color: "var(--text-muted)" }}>
                <span>Effetto <span style={{ color: accent }}>{run.meta.categoria}</span></span>
                <span className="opacity-40">·</span>
                <span className="inline-flex gap-1 items-center">
                  Palette
                  {run.meta.palette?.slice(0, 3).map((c, i) => (
                    <span key={i} className="inline-block w-3 h-3 rounded ml-0.5"
                      style={{ background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
                  ))}
                </span>
                <span className="opacity-40">·</span>
                <span>{validImages.length}/{run.images.length} immagini</span>
                <span className="opacity-40">·</span>
                <span title={new Date(run.savedAt).toLocaleString()}>
                  Salvato {new Date(run.savedAt).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={downloadZip}
              disabled={zipBusy || !validImages.length}
              className="btn-primary text-sm"
              style={{ padding: "0.625rem 1.25rem" }}
              title="Scarica tutte le immagini come ZIP"
            >
              {zipBusy ? "Creazione ZIP…" : `Scarica ZIP (${validImages.length})`}
            </button>
            <Link href={`/?asin=${run.asin}`}
              className="text-xs px-3 py-2 rounded-lg font-semibold transition-all"
              style={{
                background: "rgba(30,63,217,0.15)",
                color: "var(--purple-400)",
                border: "1px solid rgba(30,63,217,0.3)",
              }}>
              Rigenera
            </Link>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs px-3 py-2 rounded-lg font-semibold transition-all"
              style={{
                background: "rgba(248,113,113,0.10)",
                color: "#F87171",
                border: "1px solid rgba(248,113,113,0.30)",
              }}
              title="Rimuove la cartella locale (puoi sempre rigenerarla)">
              Elimina
            </button>
          </div>
        </div>
        {zipError && (
          <p className="mt-3 text-xs font-mono" style={{ color: "#F87171" }}>✕ {zipError}</p>
        )}
      </header>

      {/* Bullet points reali dal listing Amazon */}
      {run.meta.bullets && run.meta.bullets.length > 0 && (
        <div className="rounded-lg p-4 mb-6"
          style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <p className="text-xs font-semibold tracking-wider uppercase"
              style={{ color: "var(--brand)" }}>
              Bullet points prodotto
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {run.meta.bullets.length} dal listing Amazon
            </p>
          </div>
          <ul className="space-y-1.5">
            {run.meta.bullets.map((b, i) => (
              <li key={i} className="text-xs leading-relaxed pl-4 relative"
                style={{ color: "var(--text-primary)" }}>
                <span className="absolute left-0 top-[2px] font-mono font-bold"
                  style={{ color: "var(--brand)" }}>›</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Description, collapsed */}
      {run.meta.description && (
        <details className="rounded-lg mb-6 group"
          style={{ background: "rgba(0,0,0,0.18)", border: "1px solid rgba(30,63,217,0.05)" }}>
          <summary className="px-4 py-3 cursor-pointer text-xs font-semibold tracking-wider uppercase select-none flex items-center justify-between"
            style={{ color: "var(--text-muted)" }}>
            <span>Descrizione visiva prodotto</span>
            <span className="text-[10px] opacity-60 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <p className="px-4 pb-4 text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
            {run.meta.description}
          </p>
        </details>
      )}

      {/* Gallery */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {run.images.map((img) => {
          const validIdx = validImages.findIndex((v) => v.number === img.number);
          return (
            <ImageThumb
              key={img.number}
              img={img}
              accent={accent}
              onClick={() => { if (img.image_b64 && validIdx >= 0) setLightboxIdx(validIdx); }}
              onDownload={() => downloadOne(img)}
            />
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && validImages[lightboxIdx] && (
        <Lightbox
          img={validImages[lightboxIdx]}
          index={lightboxIdx}
          total={validImages.length}
          accent={accent}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx((i) => (i === null ? null : Math.max(0, i - 1)))}
          onNext={() => setLightboxIdx((i) => (i === null ? null : Math.min(validImages.length - 1, i + 1)))}
          onDownload={() => downloadOne(validImages[lightboxIdx])}
        />
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-5 fade-up"
          style={{ background: "rgba(5,5,12,0.7)", backdropFilter: "blur(8px)" }}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full rounded-2xl p-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              Eliminare la cartella?
            </p>
            <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>
              Le immagini per <span className="font-mono">{run.asin}</span> verranno rimosse
              dal tuo dispositivo. Potrai sempre rigenerarle dalla home (con cache attiva
              il costo è ridotto).
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-2 rounded-lg font-semibold"
                style={{
                  background: "rgba(30,63,217,0.04)",
                  color: "var(--text-muted)",
                  border: "1px solid rgba(30,63,217,0.08)",
                }}>
                Annulla
              </button>
              <button
                onClick={handleDelete}
                className="text-xs px-3 py-2 rounded-lg font-semibold"
                style={{
                  background: "rgba(248,113,113,0.18)",
                  color: "#F87171",
                  border: "1px solid rgba(248,113,113,0.35)",
                }}>
                Elimina cartella
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
