/**
 * App version, single source for the UI.
 *
 * Primary value comes from NEXT_PUBLIC_APP_VERSION, injected at build time
 * by next.config.ts from the git commit count (rises +0.0.1 per commit).
 * APP_VERSION_FALLBACK is used only when git history isn't available at
 * build time — bump it to match the latest released version as a safety net.
 */
export const APP_VERSION_FALLBACK = "0.1.0";

export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION && process.env.NEXT_PUBLIC_APP_VERSION.length > 0
    ? process.env.NEXT_PUBLIC_APP_VERSION
    : APP_VERSION_FALLBACK;

export const APP_VERSION_LABEL = `v${APP_VERSION} — Preview`;
