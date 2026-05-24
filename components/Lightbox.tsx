"use client";
import type { ThumbImage } from "@/components/ImageThumb";
import SlideCanvas from "@/components/SlideCanvas";

export default function Lightbox({
  img, index, total, accent, onClose, onPrev, onNext, onDownload,
}: {
  img: ThumbImage;
  index: number;
  total: number;
  accent: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDownload: () => void;
}) {
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 fade-up"
      style={{
        background: "rgba(5,5,12,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>

      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-mono font-bold shrink-0" style={{ color: accent }}>
            {img.number}
          </span>
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {img.name}
          </p>
          <span className="text-xs font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
            {index + 1} / {total}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDownload}
            className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
            style={{
              background: "rgba(30,63,217,0.18)",
              color: "var(--purple-400)",
              border: "1px solid rgba(30,63,217,0.3)",
            }}>
            <DownloadIcon /> Scarica
          </button>
          <button
            onClick={onClose}
            title="Chiudi (ESC)"
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: "rgba(30,63,217,0.06)",
              color: "var(--text-primary)",
              border: "1px solid rgba(30,63,217,0.08)",
            }}>
            ✕
          </button>
        </div>
      </div>

      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          title="Precedente (←)"
          className="absolute left-3 md:left-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{
            background: "rgba(30,63,217,0.06)",
            color: "var(--text-primary)",
            border: "1px solid rgba(30,63,217,0.08)",
            backdropFilter: "blur(6px)",
          }}>
          <ChevronLeftIcon />
        </button>
      )}

      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          title="Successiva (→)"
          className="absolute right-3 md:right-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{
            background: "rgba(30,63,217,0.06)",
            color: "var(--text-primary)",
            border: "1px solid rgba(30,63,217,0.08)",
            backdropFilter: "blur(6px)",
          }}>
          <ChevronRightIcon />
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[min(90vw,85vh)] max-w-[900px] rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${accent}33`, boxShadow: `0 20px 80px ${accent}22` }}>
        {img.overlay ? (
          <SlideCanvas imageB64={img.image_b64} mime={img.mime} overlay={img.overlay} accent={accent} edits={img.overlayEdits} />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`data:${img.mime ?? "image/png"};base64,${img.image_b64}`}
            alt={img.name}
            className="block w-full h-auto max-h-[85vh] object-contain"
          />
        )}
      </div>

      {img.model && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono px-2 py-1 rounded-md"
          style={{
            background: "rgba(30,63,217,0.06)",
            color: "var(--text-muted)",
            border: "1px solid rgba(30,63,217,0.08)",
          }}>
          generato con {img.model}
        </div>
      )}
    </div>
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
function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
