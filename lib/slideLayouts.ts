/**
 * Overlay model for the client-side text layer.
 *
 * The Python backend (mariano_prompts_generator.py) now generates each
 * text-heavy slide as a CLEAN background plate and attaches a typed `overlay`
 * object describing the copy. The frontend renders that copy as an HTML layer
 * on top of the image (SlideCanvas), which makes the text always crisp and
 * fully editable. Slides 01a/01b/07 have no overlay (pure imagery).
 *
 * Font sizes use `cqw` (container-query width) units so the same layout scales
 * identically in the thumbnail, the lightbox, the editor, and the 2000px export.
 */

export type OverlayType =
  | "benefit" | "specs" | "specs2" | "usage" | "anatomy" | "scenarios" | "trust";

export interface BenefitOverlay {
  type: "benefit";
  headline: string;
  subheading: string;
  benefits: string[];
  pill: string;
}
export interface SpecsOverlay {
  type: "specs";
  headline: string;
  title: string;
  rows: { label: string; value: string }[];
  bottom: string;
}
export interface Specs2Overlay {
  type: "specs2";
  title: string;
  subheading: string;
  topCards: { icon?: string; label: string; value: string; subtext?: string }[];
  bottomCards: { icon?: string; label: string; subtext?: string }[];
  strip: string;
}
export interface UsageOverlay {
  type: "usage";
  title: string;
  subtitle: string;
  steps: { num: number; verb: string; subtext: string; icon?: string }[];
  strip: string;
  light?: boolean;
}
export interface AnatomyOverlay {
  type: "anatomy";
  title: string;
  subtitle: string;
  parts: { label: string; location: string }[];
  bottom: string;
}
export interface ScenariosOverlay {
  type: "scenarios";
  title: string;
  subtitle: string;
  scenarios: { icon?: string; title: string; subtext: string }[];
  left: string;
  right: string;
  caption: string;
}
export interface TrustOverlay {
  type: "trust";
  title: string;
  subtitle: string;
  badges: { icon?: string; title: string; subtext: string }[];
  left: string;
  right: string;
  tagline: string;
}

export type Overlay =
  | BenefitOverlay | SpecsOverlay | Specs2Overlay | UsageOverlay
  | AnatomyOverlay | ScenariosOverlay | TrustOverlay;

/** Per-slide editor overrides (font scale + text theme). Persisted per run. */
export interface OverlayEdits {
  scale?: number;            // multiplier on all font sizes (0.7–1.4), default 1
  theme?: "auto" | "light" | "dark"; // text color theme; auto = per-slide default
}

/** Slides rendered on a LIGHT plate need dark text by default. */
export function isLightPlate(o: Overlay | undefined | null): boolean {
  return !!o && o.type === "usage" && (o as UsageOverlay).light === true;
}

/** Default text color for a slide, before any theme override. */
export function defaultTextColor(o: Overlay | undefined | null): string {
  return isLightPlate(o) ? "#0F1736" : "#FFFFFF";
}

/** Resolve the effective text color given edits. */
export function resolveTextColor(o: Overlay | undefined | null, edits?: OverlayEdits): string {
  const theme = edits?.theme ?? "auto";
  if (theme === "light") return "#FFFFFF";
  if (theme === "dark") return "#0F1736";
  return defaultTextColor(o);
}
