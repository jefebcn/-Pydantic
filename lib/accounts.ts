"use client";
/**
 * Account / style presets selectable from the left sidebar dropdown.
 * "Generale" = the original 10-slide generic set (always first).
 * "Prestige" = the supplement-brand 5-slide preset.
 *
 * The choice is persisted in localStorage and broadcast via a CustomEvent so
 * the home page picks it up and sends it to /api/generate-mariano.
 * New accounts are added here as we onboard more clients.
 */
export interface AccountPreset {
  id: string;
  label: string;
  desc: string;
  slides: number;
}

export const ACCOUNTS: AccountPreset[] = [
  { id: "generale", label: "Generale", desc: "Set standard 10 slide",          slides: 10 },
  { id: "prestige", label: "Prestige", desc: "Integratori · 5 slide su misura", slides: 5  },
];

export const DEFAULT_ACCOUNT = "generale";
const KEY = "account_v1";
export const ACCOUNT_EVENT = "account-changed";

export function getAccount(): string {
  if (typeof window === "undefined") return DEFAULT_ACCOUNT;
  try {
    const v = localStorage.getItem(KEY);
    if (v && ACCOUNTS.some((a) => a.id === v)) return v;
  } catch { /* no-op */ }
  return DEFAULT_ACCOUNT;
}

export function setAccount(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* no-op */ }
  try { document.dispatchEvent(new CustomEvent(ACCOUNT_EVENT, { detail: id })); } catch { /* no-op */ }
}

export function accountPreset(id: string | undefined | null): AccountPreset {
  return ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS[0];
}
