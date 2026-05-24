"use client";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import SlideCanvas from "@/components/SlideCanvas";
import { flattenSlide, ensureFontsReady } from "@/lib/exportImage";
import type { Overlay, OverlayEdits } from "@/lib/slideLayouts";

function base64ToBlob(b64: string, mime: string): Blob {
  const byteChars = atob(b64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Produce the FINAL PNG blob for a slide.
 * - With an overlay: render SlideCanvas off-screen and flatten image+text to PNG.
 * - Without overlay (01a/01b/07): decode the base64 directly (faster, identical).
 */
export async function compositeSlideToBlob(opts: {
  imageB64: string;
  mime?: string | null;
  overlay?: Overlay | null;
  accent: string;
  edits?: OverlayEdits;
  size?: number;
}): Promise<Blob> {
  const { imageB64, mime, overlay, accent, edits, size = 2000 } = opts;
  if (!overlay) return base64ToBlob(imageB64, mime ?? "image/png");

  await ensureFontsReady();
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-99999px;top:0;width:1000px;height:1000px;pointer-events:none;z-index:-1;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await new Promise<void>((resolve) => {
      root.render(createElement(SlideCanvas, { imageB64, mime, overlay, accent, edits }));
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const bg = host.querySelector("img");
    if (bg && !bg.complete) {
      await new Promise<void>((r) => { bg.onload = () => r(); bg.onerror = () => r(); });
    }
    const node = host.firstElementChild as HTMLElement;
    return await flattenSlide(node, size);
  } finally {
    root.unmount();
    host.remove();
  }
}
