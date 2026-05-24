/**
 * Visual style presets selectable before generation.
 *
 * A preset does two things:
 *  - backend: nudges the background-plate prompt tone (passed as `style` to
 *    /api/generate-mariano and threaded into the image prompts).
 *  - frontend: sets a default overlay font `scale` so the text layer matches
 *    the chosen look (Bold = larger/punchier, Minimal = airier).
 */
export type StyleId = "bold" | "minimal" | "lifestyle" | "tech";

export interface StylePreset {
  id: StyleId;
  label: string;
  desc: string;
  scale: number;     // default overlay font scale
}

export const STYLE_PRESETS: StylePreset[] = [
  { id: "bold",      label: "Bold",      desc: "Colori pieni, testo grande, massimo impatto", scale: 1.05 },
  { id: "minimal",   label: "Minimal",   desc: "Tanto spazio, testo essenziale, elegante",    scale: 0.92 },
  { id: "lifestyle", label: "Lifestyle", desc: "Toni caldi, atmosfera morbida e naturale",    scale: 1.0  },
  { id: "tech",      label: "Tech",      desc: "Freddo, nitido, estetica tecnologica",         scale: 0.98 },
];

export const DEFAULT_STYLE: StyleId = "bold";

export function stylePreset(id: string | undefined | null): StylePreset {
  return STYLE_PRESETS.find((s) => s.id === id) ?? STYLE_PRESETS[0];
}
