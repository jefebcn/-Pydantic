/**
 * Centralized brand assets — single source of truth.
 *
 * To replace the placeholder logo with the real PYDANTIC artwork:
 *
 *   1. Drop the file into /public (any of these formats works, all paths are
 *      relative to the site root):
 *        - public/logo.png   (recommended, ~512×512 transparent or matching bg)
 *        - public/logo.svg
 *        - public/logo.webp
 *   2. Change LOGO_ICON_SRC below to point at it, e.g. "/logo.png".
 *
 * Nothing else needs to change — TopBar, Sidebar, Footer, the home hero,
 * the favicon, the PWA manifest icon and the iOS apple-touch-icon all read
 * from this constant (via the metadata in app/layout.tsx + a single <img>
 * in each branded component).
 *
 * For the favicon shown in the browser tab, the file at /public/favicon.svg
 * still wins (Next.js convention). Replace that file too if you want the
 * raster icon there as well.
 */
export const LOGO_ICON_SRC = "/logo.png";

/** Long-form mark, currently unused in the hero — kept for future
 *  "About / press" pages where a wide wordmark makes sense. */
export const LOGO_WORDMARK_SRC = "/logo.png";

export const BRAND = {
  name: "PYDANTIC",
  tagline: "Amazon Infographics AI",
  blue: "#1E3FD9",
  blueDeep: "#1632B5",
  blueSoft: "#3E5FE8",
  bg: "#FAF3F3",
} as const;
