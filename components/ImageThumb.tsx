"use client";
import SlideCanvas from "@/components/SlideCanvas";
import type { Overlay, OverlayEdits } from "@/lib/slideLayouts";

export interface ThumbImage {
  number: string;
  name: string;
  image_b64: string | null;
  mime: string | null;
  model: string | null;
  error: string | null;
  overlay?: Overlay | null;
  overlayEdits?: OverlayEdits;
}

/**
 * Single 1:1 thumbnail used both on the home page and the saved-run page.
 * The main click opens the lightbox; the small floating icon in the corner
 * triggers the direct download. Errors get a red placeholder.
 */
export default function ImageThumb({
  img, accent, onClick, onDownload, onEdit, onRegenerate, regenerating,
}: {
  img: ThumbImage;
  accent: string;
  onClick: () => void;
  onDownload: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="aspect-square rounded-xl overflow-hidden relative"
        style={{ border: "1px solid rgba(30,63,217,0.08)" }}>
        {img.image_b64 ? (
          <button
            onClick={onClick}
            className="w-full h-full group relative"
            title={`Ingrandisci ${img.name}`}
          >
            {img.overlay ? (
              <div className="w-full h-full transition-transform duration-300 group-hover:scale-[1.04]">
                <SlideCanvas imageB64={img.image_b64} mime={img.mime} overlay={img.overlay} accent={accent} edits={img.overlayEdits} />
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`data:${img.mime ?? "image/png"};base64,${img.image_b64}`}
                alt={img.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{ background: "rgba(0,0,0,0.55)" }}>
              <div className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold"
                style={{ background: "rgba(255,255,255,0.14)", color: "white", backdropFilter: "blur(6px)" }}>
                <ExpandIcon /> Apri
              </div>
            </div>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              {onEdit && img.overlay && (
                <span role="button" tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", color: "white" }}
                  title="Modifica testo">
                  <PencilIcon />
                </span>
              )}
              {onRegenerate && (
                <span role="button" tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); if (!regenerating) onRegenerate(); }}
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", color: "white" }}
                  title="Rigenera questa slide">
                  <span className={regenerating ? "animate-spin inline-flex" : "inline-flex"}><RefreshIcon /></span>
                </span>
              )}
              <span role="button" tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onDownload(); }}
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", color: "white" }}
                title="Scarica questa immagine">
                <DownloadIcon />
              </span>
            </div>
          </button>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2"
            style={{ background: "rgba(248,113,113,0.06)" }}>
            <span style={{ color: "#F87171" }}>✕</span>
            <p className="text-[10px] text-center leading-tight" style={{ color: "#F87171" }}>
              {img.error?.slice(0, 60)}
            </p>
          </div>
        )}
        {regenerating && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(10,10,15,0.55)" }}>
            <span className="animate-spin" style={{ color: "white" }}><RefreshIcon /></span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-0.5">
        <span className="text-[10px] font-mono font-bold" style={{ color: accent }}>
          {img.number}
        </span>
        <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
          {img.name}
        </span>
        {img.model && (
          <span className="ml-auto text-[9px] px-1 rounded shrink-0"
            style={{
              background: img.model.includes("pro") ? "rgba(30,63,217,0.18)"
                       : img.model.includes("flash") ? "rgba(56,189,248,0.18)"
                       : "rgba(30,63,217,0.06)",
              color: img.model.includes("pro") ? "var(--purple-400)"
                       : img.model.includes("flash") ? "#38BDF8"
                       : "var(--text-muted)",
            }}>
            {img.model.replace("gemini-", "")}
          </span>
        )}
      </div>
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
function ExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3"  x2="14" y2="10" />
      <line x1="3"  y1="21" x2="10" y2="14" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
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
