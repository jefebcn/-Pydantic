"use client";
import React, { forwardRef } from "react";
import {
  type Overlay, type OverlayEdits,
  type BenefitOverlay, type SpecsOverlay, type Specs2Overlay,
  type UsageOverlay, type AnatomyOverlay, type ScenariosOverlay, type TrustOverlay,
  resolveTextColor, isLightPlate,
} from "@/lib/slideLayouts";

/**
 * Renders a generated slide = background image + client-side text overlay.
 * Used (static) in the grid/lightbox/export and (editable) in the editor.
 *
 * Layout uses cqw units (container-query width) so it scales identically at
 * any rendered size — thumbnail, lightbox, or 2000px off-screen export.
 */
export interface SlideCanvasProps {
  imageB64: string | null;
  mime?: string | null;
  overlay?: Overlay | null;
  accent: string;
  edits?: OverlayEdits;
  editable?: boolean;
  onChange?: (next: Overlay) => void;
  className?: string;
}

const SlideCanvas = forwardRef<HTMLDivElement, SlideCanvasProps>(function SlideCanvas(
  { imageB64, mime, overlay, accent, edits, editable = false, onChange, className }, ref,
) {
  const scale = edits?.scale ?? 1;
  const color = resolveTextColor(overlay ?? null, edits);
  const light = isLightPlate(overlay ?? null);
  const sub = accent;
  const muted = light ? "rgba(15,23,54,0.6)" : "rgba(255,255,255,0.7)";
  const panelBg = light ? "rgba(15,23,54,0.05)" : "rgba(255,255,255,0.08)";
  const panelBorder = light ? "rgba(15,23,54,0.12)" : "rgba(255,255,255,0.16)";

  const fz = (cqw: number) => `${(cqw * scale).toFixed(2)}cqw`;

  /* Editable text node. When editable, becomes contentEditable; on blur it
     reports the new text via `set`. */
  const T = (
    value: string,
    set: (v: string) => void,
    style: React.CSSProperties,
    key?: string,
  ) => (
    <div
      key={key}
      contentEditable={editable}
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={editable ? (e) => set(e.currentTarget.innerText.trim()) : undefined}
      style={{
        outline: "none",
        cursor: editable ? "text" : "default",
        borderRadius: editable ? "4px" : undefined,
        ...style,
      }}
      className={editable ? "ce-editable" : undefined}
    >
      {value}
    </div>
  );

  // Helper to emit an updated overlay (clone + patch).
  function patch<T extends Overlay>(next: Partial<T>) {
    if (!onChange || !overlay) return;
    onChange({ ...(overlay as T), ...next } as Overlay);
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", overflow: "hidden", background: light ? "#F5F5F2" : "#0A0A0F" }}
    >
      {imageB64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:${mime ?? "image/png"};base64,${imageB64}`}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {overlay && (
        <div style={{ position: "absolute", inset: 0, containerType: "size" as React.CSSProperties["containerType"], fontFamily: "var(--font-display), system-ui, sans-serif", color }}>
          {renderOverlay()}
        </div>
      )}
    </div>
  );

  function titleBlock(title: string, subtitle: string, setT: (v: string) => void, setS: (v: string) => void, align: "left" | "center" = "center", topPct = 5) {
    return (
      <div style={{ position: "absolute", top: `${topPct}%`, left: "6%", right: "6%", textAlign: align }}>
        {T(title, setT, { fontWeight: 900, fontSize: fz(6), lineHeight: 1.05, letterSpacing: "-0.02em", textTransform: "uppercase" }, "title")}
        {T(subtitle, setS, { fontWeight: 600, fontSize: fz(3), color: sub, marginTop: "1.2cqw" }, "sub")}
        <div style={{ height: "0.4cqw", width: align === "center" ? "26%" : "18%", margin: align === "center" ? "1.6cqw auto 0" : "1.6cqw 0 0", background: accent, borderRadius: 2 }} />
      </div>
    );
  }

  function renderOverlay() {
    if (!overlay) return null;
    switch (overlay.type) {
      case "benefit": {
        const o = overlay as BenefitOverlay;
        return (
          <div style={{ position: "absolute", top: "8%", bottom: "8%", left: "52%", right: "5%", display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.6cqw" }}>
            {T(o.headline, (v) => patch<BenefitOverlay>({ headline: v }), { fontWeight: 900, fontStyle: "italic", fontSize: fz(6.4), lineHeight: 1.04, textTransform: "uppercase" }, "h")}
            {T(o.subheading, (v) => patch<BenefitOverlay>({ subheading: v }), { fontWeight: 600, fontSize: fz(3), color: sub }, "s")}
            <div style={{ height: 1, background: accent, width: "85%", opacity: 0.6 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1cqw" }}>
              {o.benefits.map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "1.4cqw" }}>
                  <span style={{ color: accent, fontWeight: 900, fontSize: fz(3.6) }}>✓</span>
                  {T(b, (v) => patch<BenefitOverlay>({ benefits: o.benefits.map((x, j) => (j === i ? v : x)) }), { fontWeight: 700, fontSize: fz(3.4) }, `b${i}`)}
                </div>
              ))}
            </div>
            {T(o.pill, (v) => patch<BenefitOverlay>({ pill: v }), { marginTop: "0.8cqw", alignSelf: "flex-start", background: accent, color: "#fff", fontWeight: 700, fontSize: fz(2.5), padding: "1cqw 2cqw", borderRadius: "999px" }, "pill")}
          </div>
        );
      }
      case "specs": {
        const o = overlay as SpecsOverlay;
        return (
          <>
            {titleBlock(o.headline, o.title, (v) => patch<SpecsOverlay>({ headline: v }), (v) => patch<SpecsOverlay>({ title: v }), "center", 5)}
            <div style={{ position: "absolute", top: "24%", bottom: "12%", left: "47%", right: "5%", display: "flex", flexDirection: "column", justifyContent: "center", gap: "1cqw" }}>
              {o.rows.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "1.4cqw", background: panelBg, border: `1px solid ${panelBorder}`, borderLeft: `0.5cqw solid ${accent}`, borderRadius: "1cqw", padding: "1cqw 1.6cqw" }}>
                  {T(r.label, (v) => patch<SpecsOverlay>({ rows: o.rows.map((x, j) => (j === i ? { ...x, label: v } : x)) }), { color: sub, fontWeight: 700, fontSize: fz(2.3), textTransform: "uppercase", flex: "0 0 42%" }, `l${i}`)}
                  {T(r.value, (v) => patch<SpecsOverlay>({ rows: o.rows.map((x, j) => (j === i ? { ...x, value: v } : x)) }), { fontWeight: 800, fontSize: fz(3), flex: 1 }, `v${i}`)}
                </div>
              ))}
            </div>
            {T(o.bottom, (v) => patch<SpecsOverlay>({ bottom: v }), { position: "absolute", bottom: "5%", left: "6%", right: "6%", textAlign: "center", fontWeight: 700, fontSize: fz(2.8) }, "bottom")}
          </>
        );
      }
      case "specs2": {
        const o = overlay as Specs2Overlay;
        return (
          <>
            {titleBlock(o.title, o.subheading, (v) => patch<Specs2Overlay>({ title: v }), (v) => patch<Specs2Overlay>({ subheading: v }), "center", 4)}
            <div style={{ position: "absolute", top: "20%", left: "5%", right: "5%", display: "flex", gap: "3%" }}>
              {o.topCards.map((c, i) => (
                <div key={i} style={{ flex: 1, background: panelBg, border: `1px solid ${panelBorder}`, borderTop: `0.6cqw solid ${accent}`, borderRadius: "1.4cqw", padding: "2cqw", textAlign: "center" }}>
                  {T(c.label, (v) => patch<Specs2Overlay>({ topCards: o.topCards.map((x, j) => (j === i ? { ...x, label: v } : x)) }), { color: sub, fontWeight: 700, fontSize: fz(2.3), textTransform: "uppercase" }, `tl${i}`)}
                  {T(c.value, (v) => patch<Specs2Overlay>({ topCards: o.topCards.map((x, j) => (j === i ? { ...x, value: v } : x)) }), { fontWeight: 900, fontSize: fz(5) }, `tv${i}`)}
                  {c.subtext ? T(c.subtext, (v) => patch<Specs2Overlay>({ topCards: o.topCards.map((x, j) => (j === i ? { ...x, subtext: v } : x)) }), { color: muted, fontSize: fz(2) }, `ts${i}`) : null}
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", bottom: "10%", left: "5%", right: "5%", display: "flex", gap: "2.5%" }}>
              {o.bottomCards.map((c, i) => (
                <div key={i} style={{ flex: 1, background: panelBg, border: `1px solid ${panelBorder}`, borderLeft: `0.5cqw solid ${accent}`, borderRadius: "1.2cqw", padding: "1.4cqw" }}>
                  {T(c.label, (v) => patch<Specs2Overlay>({ bottomCards: o.bottomCards.map((x, j) => (j === i ? { ...x, label: v } : x)) }), { color: sub, fontWeight: 700, fontSize: fz(2.1), textTransform: "uppercase" }, `bl${i}`)}
                  {c.subtext ? T(c.subtext, (v) => patch<Specs2Overlay>({ bottomCards: o.bottomCards.map((x, j) => (j === i ? { ...x, subtext: v } : x)) }), { fontSize: fz(2), marginTop: "0.4cqw" }, `bs${i}`) : null}
                </div>
              ))}
            </div>
            {T(o.strip, (v) => patch<Specs2Overlay>({ strip: v }), { position: "absolute", bottom: "3.5%", left: "6%", right: "6%", textAlign: "center", color: muted, fontSize: fz(2.3) }, "strip")}
          </>
        );
      }
      case "usage": {
        const o = overlay as UsageOverlay;
        return (
          <>
            {titleBlock(o.title, o.subtitle, (v) => patch<UsageOverlay>({ title: v }), (v) => patch<UsageOverlay>({ subtitle: v }), "center", 5)}
            <div style={{ position: "absolute", top: "26%", left: "4%", right: "4%", display: "flex", gap: "2%" }}>
              {o.steps.map((s, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1cqw" }}>
                  <div style={{ width: "8cqw", height: "8cqw", borderRadius: "999px", background: accent, color: "#fff", fontWeight: 900, fontSize: fz(4), display: "flex", alignItems: "center", justifyContent: "center" }}>{s.num}</div>
                  {T(s.verb, (v) => patch<UsageOverlay>({ steps: o.steps.map((x, j) => (j === i ? { ...x, verb: v } : x)) }), { fontWeight: 900, fontSize: fz(3.2), textTransform: "uppercase" }, `sv${i}`)}
                  {T(s.subtext, (v) => patch<UsageOverlay>({ steps: o.steps.map((x, j) => (j === i ? { ...x, subtext: v } : x)) }), { color: muted, fontSize: fz(2.3), lineHeight: 1.25 }, `ss${i}`)}
                </div>
              ))}
            </div>
            {T(o.strip, (v) => patch<UsageOverlay>({ strip: v }), { position: "absolute", bottom: "4%", left: "10%", right: "10%", textAlign: "center", background: "#0D1B3E", color: "#fff", fontWeight: 600, fontSize: fz(2.5), padding: "1.4cqw", borderRadius: "1cqw" }, "strip")}
          </>
        );
      }
      case "anatomy": {
        const o = overlay as AnatomyOverlay;
        const left = o.parts.filter((_, i) => i % 2 === 0);
        const right = o.parts.filter((_, i) => i % 2 === 1);
        const sideStyle = (sideAccent: boolean): React.CSSProperties => ({
          position: "absolute", top: "26%", bottom: "14%", width: "26%",
          display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.4cqw",
          ...(sideAccent ? { left: "3%", alignItems: "flex-start", textAlign: "left" } : { right: "3%", alignItems: "flex-end", textAlign: "right" }),
        });
        const labelPill = (label: string, set: (v: string) => void, key: string) => (
          <div key={key} style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: "0.8cqw", padding: "0.9cqw 1.4cqw", maxWidth: "100%" }}>
            {T(label, set, { fontWeight: 700, fontSize: fz(2.5) }, key + "t")}
          </div>
        );
        return (
          <>
            {titleBlock(o.title, o.subtitle, (v) => patch<AnatomyOverlay>({ title: v }), (v) => patch<AnatomyOverlay>({ subtitle: v }), "center", 4)}
            <div style={sideStyle(true)}>
              {left.map((p, i) => labelPill(p.label, (v) => { const idx = i * 2; patch<AnatomyOverlay>({ parts: o.parts.map((x, j) => (j === idx ? { ...x, label: v } : x)) }); }, `pl${i}`))}
            </div>
            <div style={sideStyle(false)}>
              {right.map((p, i) => labelPill(p.label, (v) => { const idx = i * 2 + 1; patch<AnatomyOverlay>({ parts: o.parts.map((x, j) => (j === idx ? { ...x, label: v } : x)) }); }, `pr${i}`))}
            </div>
            {T(o.bottom, (v) => patch<AnatomyOverlay>({ bottom: v }), { position: "absolute", bottom: "4%", left: "6%", right: "6%", textAlign: "center", fontSize: fz(2.5) }, "bottom")}
          </>
        );
      }
      case "scenarios": {
        const o = overlay as ScenariosOverlay;
        return (
          <>
            {titleBlock(o.title, o.subtitle, (v) => patch<ScenariosOverlay>({ title: v }), (v) => patch<ScenariosOverlay>({ subtitle: v }), "center", 4)}
            <div style={{ position: "absolute", top: "22%", left: "5%", right: "5%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3%" }}>
              {o.scenarios.map((s, i) => (
                <div key={i} style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: "1.4cqw", padding: "1.8cqw", textAlign: "center" }}>
                  {T(s.title, (v) => patch<ScenariosOverlay>({ scenarios: o.scenarios.map((x, j) => (j === i ? { ...x, title: v } : x)) }), { fontWeight: 800, fontSize: fz(3), textTransform: "uppercase" }, `st${i}`)}
                  {T(s.subtext, (v) => patch<ScenariosOverlay>({ scenarios: o.scenarios.map((x, j) => (j === i ? { ...x, subtext: v } : x)) }), { color: muted, fontSize: fz(2.1), marginTop: "0.4cqw" }, `ss${i}`)}
                </div>
              ))}
            </div>
            {T(o.caption, (v) => patch<ScenariosOverlay>({ caption: v }), { position: "absolute", bottom: "3.5%", left: "6%", right: "6%", textAlign: "center", color: muted, fontSize: fz(2.3) }, "cap")}
          </>
        );
      }
      case "trust": {
        const o = overlay as TrustOverlay;
        return (
          <>
            {titleBlock(o.title, o.subtitle, (v) => patch<TrustOverlay>({ title: v }), (v) => patch<TrustOverlay>({ subtitle: v }), "center", 4)}
            <div style={{ position: "absolute", top: "22%", left: "5%", right: "5%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3%" }}>
              {o.badges.map((s, i) => (
                <div key={i} style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: "1.4cqw", padding: "1.8cqw", textAlign: "center" }}>
                  <div style={{ color: accent, fontWeight: 900, fontSize: fz(3) }}>✓</div>
                  {T(s.title, (v) => patch<TrustOverlay>({ badges: o.badges.map((x, j) => (j === i ? { ...x, title: v } : x)) }), { fontWeight: 800, fontSize: fz(2.7), textTransform: "uppercase", marginTop: "0.4cqw" }, `bt${i}`)}
                  {T(s.subtext, (v) => patch<TrustOverlay>({ badges: o.badges.map((x, j) => (j === i ? { ...x, subtext: v } : x)) }), { color: muted, fontSize: fz(2), marginTop: "0.4cqw" }, `bs${i}`)}
                </div>
              ))}
            </div>
            {T(o.tagline, (v) => patch<TrustOverlay>({ tagline: v }), { position: "absolute", bottom: "3.5%", left: "6%", right: "6%", textAlign: "center", fontStyle: "italic", fontWeight: 700, fontSize: fz(2.6) }, "tag")}
          </>
        );
      }
      default:
        return null;
    }
  }
});

export default SlideCanvas;
