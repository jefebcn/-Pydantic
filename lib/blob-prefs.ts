/**
 * Vercel Blob Store — user preferences (saved ASINs, display name, settings).
 * All read/write goes through /api/user/prefs to keep BLOB_READ_WRITE_TOKEN server-side.
 */

export interface UserPrefs {
  displayName?: string;
  savedAsins:   string[];          // starred ASINs
  updatedAt:    string;
}

const DEFAULT_PREFS: UserPrefs = { savedAsins: [], updatedAt: new Date().toISOString() };

export async function getPrefs(userId: string): Promise<UserPrefs> {
  try {
    const res = await fetch(`/api/user/prefs?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return DEFAULT_PREFS;
    return await res.json();
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(userId: string, prefs: Partial<UserPrefs>): Promise<void> {
  await fetch("/api/user/prefs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, prefs }),
  });
}

export async function toggleSavedAsin(
  userId: string,
  asin: string,
  currentPrefs: UserPrefs
): Promise<UserPrefs> {
  const already = currentPrefs.savedAsins.includes(asin);
  const savedAsins = already
    ? currentPrefs.savedAsins.filter((a) => a !== asin)
    : [asin, ...currentPrefs.savedAsins];

  const updated: UserPrefs = { ...currentPrefs, savedAsins, updatedAt: new Date().toISOString() };
  await savePrefs(userId, updated);
  return updated;
}
