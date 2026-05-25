"use client";
/**
 * Client-side compositing of a transparent product cutout (PNG) onto the
 * generated Prestige background plates. Used when the user uploads the real
 * product cutout for an account so the packaging is pixel-identical.
 *
 * Fixed per-slide placement (center x/y as fraction of canvas, product height
 * as fraction of canvas height). Tunable here once, applies to all products.
 */

export interface ProductBox { cx: number; cy: number; h: number }

export const PRESTIGE_PRODUCT_BOX: Record<string, ProductBox> = {
  "01a": { cx: 0.50, cy: 0.50, h: 0.66 }, // MAIN — centered on white
  "02":  { cx: 0.50, cy: 0.56, h: 0.60 }, // Benefit & Lifestyle — center
  "03":  { cx: 0.63, cy: 0.55, h: 0.62 }, // Ingredienti — right
  "04":  { cx: 0.50, cy: 0.58, h: 0.54 }, // Doppio Assorbimento — center, smaller
  "05":  { cx: 0.64, cy: 0.56, h: 0.62 }, // Brand — right
};

const DEFAULT_BOX: ProductBox = { cx: 0.5, cy: 0.54, h: 0.6 };

/** Load a File/Blob/URL into an HTMLImageElement. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Immagine non caricabile"));
    img.src = src;
  });
}

/**
 * Composite the cutout onto a background plate (base64). Returns the final
 * image as base64 (no data: prefix), 2000×2000 PNG.
 */
export async function compositeCutout(
  plateB64: string,
  plateMime: string | null,
  cutout: HTMLImageElement,
  slideNumber: string,
  size = 2000,
): Promise<string> {
  const plate = await loadImage(`data:${plateMime ?? "image/png"};base64,${plateB64}`);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile");

  // Background plate: cover the square canvas
  drawCover(ctx, plate, size);

  // Product cutout
  const box = PRESTIGE_PRODUCT_BOX[slideNumber] ?? DEFAULT_BOX;
  const targetH = size * box.h;
  const ratio = cutout.width / cutout.height || 1;
  let drawH = targetH;
  let drawW = targetH * ratio;
  // clamp width so it never exceeds ~80% of canvas
  const maxW = size * 0.8;
  if (drawW > maxW) { drawW = maxW; drawH = maxW / ratio; }
  const x = size * box.cx - drawW / 2;
  const y = size * box.cy - drawH / 2;

  // soft drop shadow grounding the product
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = size * 0.025;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = size * 0.012;
  ctx.drawImage(cutout, x, y, drawW, drawH);
  ctx.restore();

  return canvas.toDataURL("image/png").split(",")[1];
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) {
  const ir = img.width / img.height;
  let w = size, h = size, ox = 0, oy = 0;
  if (ir > 1) { w = size * ir; ox = (size - w) / 2; }
  else { h = size / ir; oy = (size - h) / 2; }
  ctx.drawImage(img, ox, oy, w, h);
}
