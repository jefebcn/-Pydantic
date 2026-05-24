"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SlideCanvas from "@/components/SlideCanvas";
import type { Overlay, OverlayEdits } from "@/lib/slideLayouts";

/**
 * WYSIWYG editor for a single slide's text overlay.
 * - Inline editing: click any text in the canvas and type.
 * - Side panel: font scale slider + text color theme.
 * Nothing is regenerated — edits are instant and saved on "Salva".
 */
export default function SlideEditor({
  number, name, imageB64, mime, overlay, accent, edits, onSave, onClose,
}: {
  number: string;
  name: string;
  imageB64: string | null;
  mime: string | null;
  overlay: Overlay;
  accent: string;
  edits?: OverlayEdits;
  onSave: (next: { overlay: Overlay; overlayEdits: OverlayEdits }) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Overlay>(overlay);
  const [draftEdits, setDraftEdits] = useState<OverlayEdits>(edits ?? { scale: 1, theme: "auto" });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const scale = draftEdits.scale ?? 1;
  const theme = draftEdits.theme ?? "auto";

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 md:p-8 fade-up"
      style={{ background: "rgba(15,23,54,0.55)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col md:flex-row"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxHeight: "92vh" }}>

        {/* Canvas */}
        <div className="flex-1 p-4 md:p-6 flex flex-col gap-3 min-w-0" style={{ background: "var(--bg-card-hover)" }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="font-mono font-bold" style={{ color: accent }}>{number}</span>
            <span className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{name}</span>
            <span className="ml-auto">Clicca il testo per modificarlo</span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <SlideCanvas
              imageB64={imageB64} mime={mime} overlay={draft} accent={accent}
              edits={draftEdits} editable onChange={setDraft}
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="w-full md:w-64 shrink-0 p-4 md:p-5 flex flex-col gap-5"
          style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Modifica testo</p>
            <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>✕</button>
          </div>

          {/* Font scale */}
          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text-muted)" }}>
              Dimensione testo · {Math.round(scale * 100)}%
            </label>
            <input type="range" min={0.7} max={1.4} step={0.05} value={scale}
              onChange={(e) => setDraftEdits((p) => ({ ...p, scale: parseFloat(e.target.value) }))}
              className="w-full" style={{ accentColor: accent }} />
          </div>

          {/* Text theme */}
          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text-muted)" }}>
              Colore testo
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["auto", "light", "dark"] as const).map((t) => (
                <button key={t} onClick={() => setDraftEdits((p) => ({ ...p, theme: t }))}
                  className="text-[11px] py-1.5 rounded-lg font-semibold capitalize transition-all"
                  style={{
                    background: theme === t ? accent : "var(--bg-card-hover)",
                    color: theme === t ? "#fff" : "var(--text-muted)",
                    border: `1px solid ${theme === t ? accent : "var(--border)"}`,
                  }}>
                  {t === "auto" ? "Auto" : t === "light" ? "Chiaro" : "Scuro"}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Le modifiche sono istantanee e non rigenerano l&apos;immagine. Vengono
            salvate sul tuo dispositivo e applicate al download.
          </div>

          <div className="mt-auto flex gap-2">
            <button onClick={onClose}
              className="flex-1 text-xs py-2.5 rounded-lg font-semibold"
              style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              Annulla
            </button>
            <button onClick={() => onSave({ overlay: draft, overlayEdits: draftEdits })}
              className="flex-1 btn-primary text-xs" style={{ padding: "0.625rem" }}>
              Salva
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
