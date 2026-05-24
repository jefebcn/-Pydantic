import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/**
 * App version shown in the sidebar ("v0.1.X — Preview").
 *
 * The patch number rises by 1 on every commit automatically: it's derived
 * from the total git commit count minus a base offset, so right after the
 * commit that introduced this it reads v0.1.0 and every subsequent commit
 * bumps it (+0.0.1).
 *
 * If git history isn't available at build time (e.g. a shallow CI clone),
 * we fall back to APP_VERSION_FALLBACK in lib/version.ts — keep that in
 * sync as a safety net.
 */
const VERSION_MAJOR = 0;
const VERSION_MINOR = 1;
const VERSION_BASE_COMMITS = 69; // commit count at which patch === 0

function computeVersion(): string {
  try {
    const count = parseInt(
      execSync("git rev-list --count HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      }).toString().trim(),
      10,
    );
    if (Number.isFinite(count) && count >= VERSION_BASE_COMMITS) {
      return `${VERSION_MAJOR}.${VERSION_MINOR}.${count - VERSION_BASE_COMMITS}`;
    }
  } catch {
    /* git unavailable — handled by lib/version.ts fallback */
  }
  return "";
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: computeVersion(),
  },
};

export default nextConfig;
