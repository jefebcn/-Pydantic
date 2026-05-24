import { toBlob } from "html-to-image";

/**
 * Flatten a rendered SlideCanvas node (background image + HTML text overlay)
 * into a single PNG Blob at the target resolution.
 *
 * The node is rendered at whatever CSS size it currently occupies; we pass a
 * pixelRatio so the output lands at ~`size` px on the longest side (default
 * 2000, the Amazon listing resolution).
 */
export async function flattenSlide(node: HTMLElement, size = 2000): Promise<Blob> {
  const rect = node.getBoundingClientRect();
  const side = Math.max(rect.width, rect.height) || 1000;
  const pixelRatio = Math.max(1, size / side);
  const blob = await toBlob(node, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: undefined,
    // skip elements explicitly marked as editor-only chrome
    filter: (el) => !(el instanceof HTMLElement && el.dataset?.exportIgnore === "true"),
  });
  if (!blob) throw new Error("Render fallito");
  return blob;
}

/** Ensure web fonts are ready before the first capture (avoids fallback font
 *  in the very first export). */
export async function ensureFontsReady(): Promise<void> {
  try {
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fonts?.ready) await fonts.ready;
  } catch { /* no-op */ }
}
