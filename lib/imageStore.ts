/**
 * Browser-local persistence for generated image sets.
 *
 * Why IndexedDB instead of Supabase / Cloud storage:
 *  - The base64 PNGs are already in memory after generation; uploading them
 *    elsewhere would require ~13 MB of bandwidth per run and a Cloudflare R2
 *    or Vercel Blob token (which the user may not have configured).
 *  - IndexedDB has a per-origin quota in the hundreds of MB on mobile,
 *    multiple GB on desktop — plenty for hundreds of runs.
 *  - It survives reloads but stays private to the device; the public
 *    `mariano_runs` table on Supabase already gives the "what was generated"
 *    history across devices, and this complements it with the actual pixels.
 *
 * If we ever want cross-device sync we can layer a Blob upload on top of the
 * same API surface (saveRun / getRun) without touching the call sites.
 */

const DB_NAME = "pydantic_v1";
const DB_VERSION = 1;
const STORE = "runs";

export interface StoredImage {
  number: string;
  name: string;
  image_b64: string | null;
  mime: string | null;
  model: string | null;
  error: string | null;
}

export interface RunMeta {
  accent: string;
  palette: string[];
  categoria: string;
  description?: string;
  bullets?: string[];          // bullet points reali dal listing Amazon
  title?: string;
  brand?: string;
}

export interface StoredRun {
  asin: string;
  savedAt: number;          // unix ms
  meta: RunMeta;
  images: StoredImage[];
}

export interface RunSummary {
  asin: string;
  savedAt: number;
  meta: RunMeta;
  okCount: number;
  totalCount: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB non disponibile in questo browser"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "asin" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    tx.onerror   = () => reject(tx.error);
    tx.onabort   = () => reject(tx.error);
    const store  = tx.objectStore(STORE);
    Promise.resolve(fn(store)).then(resolve).catch(reject);
  });
}

export async function saveRun(
  asin: string,
  images: StoredImage[],
  meta: RunMeta,
): Promise<void> {
  if (!asin || !images?.length) return;
  // Strip nothing — we want the full base64 so the gallery can re-render.
  const record: StoredRun = {
    asin,
    savedAt: Date.now(),
    meta,
    images,
  };
  await withStore("readwrite", (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  });
}

export async function getRun(asin: string): Promise<StoredRun | null> {
  if (!asin) return null;
  return withStore("readonly", (store) => {
    return new Promise<StoredRun | null>((resolve, reject) => {
      const req = store.get(asin);
      req.onsuccess = () => resolve((req.result as StoredRun) ?? null);
      req.onerror   = () => reject(req.error);
    });
  });
}

export async function listRuns(): Promise<RunSummary[]> {
  return withStore("readonly", (store) => {
    return new Promise<RunSummary[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result as StoredRun[]) ?? [];
        const summary: RunSummary[] = all.map((r) => ({
          asin: r.asin,
          savedAt: r.savedAt,
          meta: r.meta,
          okCount: r.images.filter((i) => i.image_b64).length,
          totalCount: r.images.length,
        }));
        summary.sort((a, b) => b.savedAt - a.savedAt);
        resolve(summary);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteRun(asin: string): Promise<void> {
  if (!asin) return;
  await withStore("readwrite", (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.delete(asin);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  });
}

export async function hasRun(asin: string): Promise<boolean> {
  const r = await getRun(asin);
  return r !== null && r.images.some((i) => i.image_b64);
}
