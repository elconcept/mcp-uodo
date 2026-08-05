const UODO_API = "https://orzeczenia.uodo.gov.pl/api";
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_SIZE = 200;

interface CacheEntry {
  data: unknown;
  ts: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key: string, data: unknown): void {
  if (cache.size >= CACHE_MAX_SIZE) {
    cache.delete(cache.keys().next().value!);
  }
  cache.set(key, { data, ts: Date.now() });
}

export async function uodoGet(path: string): Promise<unknown> {
  const url = `${UODO_API}${path}`;
  const cached = cacheGet(url);
  if (cached !== null) return cached;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`UODO API błąd ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  cacheSet(url, data);
  return data;
}

export async function uodoFetchText(path: string): Promise<string> {
  const url = `${UODO_API}${path}`;
  const cached = cacheGet(url);
  if (cached !== null) return cached as string;

  const response = await fetch(url, {
    headers: { Accept: "text/plain, text/markdown, text/html, */*" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`UODO API błąd ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  cacheSet(url, text);
  return text;
}
