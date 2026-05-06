"use client";
import { useState, useEffect, useRef } from "react";

export type Lighting = "HERO_DRAMATIC" | "TECH_CLEAN" | "LIFESTYLE_NATURAL";
export type Ratio    = "1:1" | "16:9" | "4:5";

export interface CustomSlide {
  id:          string;
  name:        string;
  brief:       string;        // visual description sent to the image model
  lighting:    Lighting;
  ratio:       Ratio;
  textOverlay: string;        // optional compositor overlay
  createdAt:   string;
}

interface Props {
  open:    boolean;
  onClose: () => void;
  onSave:  (slide: CustomSlide) => void;
  initial?: CustomSlide | null;  // if set → edit mode
}

const LIGHTINGS: { id: Lighting; label: string; icon: string; desc: string }[] = [
  {
    id: "HERO_DRAMATIC",
    label: "Drammatica",
    icon: "✦",
    desc: "Three-point lighting, rim light, ombre marcate. Effetto lusso.",
  },
  {
    id: "TECH_CLEAN",
    label: "Tecnica",
    icon: "◈",
    desc: "Luce piatta overhead 5500K, sfondo neutro. Stile blueprint/editorial.",
  },
  {
    id: "LIFESTYLE_NATURAL",
    label: "Lifestyle",
    icon: "◎",
    desc: "Luce naturale da finestra, bokeh ambientale, stile candid.",
  },
];

const RATIOS: Ratio[] = ["1:1", "16:9", "4:5"];

const BRIEF_PLACEHOLDER = `Es: "Prodotto al centro su superficie in marmo bianco, un petalo di fiore sul lato sinistro, sfondo sfumato bianco ghiaccio. Lasciare spazio vuoto in alto a sinistra per headline."

Descrivi: sfondo, oggetti di scena, composizione, spazio per testo, mood generale.`;

export default function CustomSlideModal({ open, onClose, onSave, initial }: Props) {
  const [name,        setName]        = useState("");
  const [brief,       setBrief]       = useState("");
  const [lighting,    setLighting]    = useState<Lighting>("HERO_DRAMATIC");
  const [ratio,       setRatio]       = useState<Ratio>("1:1");
  const [textOverlay, setTextOverlay] = useState("");
  const [error,       setError]       = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);

  /* Populate form when editing */
  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setBrief(initial.brief);
      setLighting(initial.lighting);
      setRatio(initial.ratio);
      setTextOverlay(initial.textOverlay ?? "");
    } else {
      setName(""); setBrief(""); setLighting("HERO_DRAMATIC");
      setRatio("1:1"); setTextOverlay("");
    }
    setError("");
  }, [initial, open]);

  /* Escape to close */
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim())  { setError("Inserisci un nome per la slide."); return; }
    if (!brief.trim()) { setError("Inserisci un brief visivo — descrivi cosa vuoi nella slide."); return; }
    setError("");

    const slide: CustomSlide = {
      id:          initial?.id ?? `custom_${Date.now()}`,
      name:        name.trim(),
      brief:       brief.trim(),
      lighting,
      ratio,
      textOverlay: textOverlay.trim(),
      createdAt:   initial?.createdAt ?? new Date().toISOString(),
    };
    onSave(slide);
    onClose();
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl my-4"
        style={{
          background: "#111124",
          border: "1px solid rgba(34,211,153,0.3)",
          boxShadow: "0 0 80px rgba(34,211,153,0.1)",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(34,211,153,0.15)", color: "#34D399" }}>
                CUSTOM
              </span>
            </div>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {initial ? "Modifica slide custom" : "Nuova slide custom"}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Descrivi la slide che vuoi — l&apos;AI la genera insieme alle 7 standard.
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 text-sm"
            style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.06)" }}>
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">

          {error && (
            <div className="rounded-xl p-3 text-sm flex items-center gap-2"
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", color: "#F87171" }}>
              ⚠ {error}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
              Nome slide
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="Es. Packshot invernale, Bundle promozionale…"
              maxLength={60}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(34,211,153,0.5)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          {/* Brief visivo */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
              Brief visivo
              <span className="ml-1.5 font-normal" style={{ color: "var(--text-muted)" }}>
                — descrivi sfondo, oggetti, composizione, spazio per testo
              </span>
            </label>
            <textarea
              value={brief}
              onChange={(e) => { setBrief(e.target.value); setError(""); }}
              placeholder={BRIEF_PLACEHOLDER}
              rows={5}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                lineHeight: "1.6",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(34,211,153,0.5)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            <p className="text-xs mt-1 text-right" style={{ color: "var(--text-muted)" }}>
              {brief.length}/500
            </p>
          </div>

          {/* Stile illuminazione */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Stile illuminazione
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LIGHTINGS.map((l) => {
                const active = lighting === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLighting(l.id)}
                    className="rounded-xl p-3 text-left transition-all"
                    style={{
                      background: active ? "rgba(34,211,153,0.12)" : "rgba(255,255,255,0.03)",
                      border: active ? "1px solid rgba(34,211,153,0.45)" : "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm" style={{ color: active ? "#34D399" : "var(--text-muted)" }}>
                        {l.icon}
                      </span>
                      <span className="text-xs font-bold" style={{ color: active ? "#34D399" : "var(--text-primary)" }}>
                        {l.label}
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {l.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formato + Testo overlay */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                Formato
              </label>
              <div className="flex gap-1.5">
                {RATIOS.map((r) => {
                  const active = ratio === r;
                  return (
                    <button key={r} type="button" onClick={() => setRatio(r)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: active ? "rgba(34,211,153,0.15)" : "rgba(255,255,255,0.04)",
                        border: active ? "1px solid rgba(34,211,153,0.4)" : "1px solid var(--border)",
                        color: active ? "#34D399" : "var(--text-muted)",
                      }}>
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                Testo overlay
                <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>(opzionale)</span>
              </label>
              <input
                type="text"
                value={textOverlay}
                onChange={(e) => setTextOverlay(e.target.value)}
                placeholder="Es. Disponibile ora"
                maxLength={80}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(34,211,153,0.5)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>
          </div>

          {/* Preview chip */}
          <div className="rounded-xl p-3 flex flex-wrap gap-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Anteprima configurazione:</span>
            {[
              { label: ratio, color: "#34D399" },
              { label: LIGHTINGS.find((l) => l.id === lighting)?.label ?? lighting, color: "#A78BFA" },
              ...(textOverlay ? [{ label: `"${textOverlay}"`, color: "#FCD34D" }] : []),
            ].map((chip) => (
              <span key={chip.label} className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${chip.color}18`, color: chip.color, border: `1px solid ${chip.color}30` }}>
                {chip.label}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
              Annulla
            </button>
            <button type="button" onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: "linear-gradient(135deg, #059669, #34D399)",
                color: "#fff",
                boxShadow: "0 0 20px rgba(52,211,153,0.3)",
              }}>
              {initial ? "Salva modifiche" : "Crea slide custom"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
