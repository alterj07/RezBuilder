/**
 * Content-hash cache of model labels, kept in chrome.storage.session so the
 * same segment is never sent to the model twice in a browser session and a
 * score never flickers between visits. Falls back to memory in tests.
 */
import { LABEL_CACHE_KEY, SegmentLabel } from './types';
import { LABELSET_VERSION } from './labelset';

export const LABEL_CACHE_MAX_ENTRIES = 2000;

type CacheMap = Record<string, SegmentLabel & { at: number }>;

let memory: CacheMap = {};

function area(): chrome.storage.StorageArea | null {
  const c = typeof chrome !== 'undefined' ? (chrome as any) : undefined;
  return c?.storage?.session || c?.storage?.local || null;
}

/** Stable, cheap, non-cryptographic 53-bit hash (cyrb53). */
export function hashText(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function normalizeForCache(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function cacheKey(text: string): string {
  return `${LABELSET_VERSION}:${hashText(normalizeForCache(text))}`;
}

async function readAll(): Promise<CacheMap> {
  const a = area();
  if (!a) return memory;
  try {
    const stored = await a.get([LABEL_CACHE_KEY]);
    const map = stored?.[LABEL_CACHE_KEY];
    return map && typeof map === 'object' ? (map as CacheMap) : {};
  } catch {
    return {};
  }
}

async function writeAll(map: CacheMap): Promise<void> {
  const a = area();
  if (!a) {
    memory = map;
    return;
  }
  await a.set({ [LABEL_CACHE_KEY]: map });
}

export async function getCachedLabels(texts: string[]): Promise<Map<string, SegmentLabel>> {
  const map = await readAll();
  const out = new Map<string, SegmentLabel>();
  for (const text of texts) {
    const hit = map[cacheKey(text)];
    if (hit) out.set(text, { kind: hit.kind, confidence: hit.confidence });
  }
  return out;
}

export async function putCachedLabels(entries: { text: string; label: SegmentLabel }[]): Promise<void> {
  if (entries.length === 0) return;
  const map = await readAll();
  const now = Date.now();
  for (const { text, label } of entries) map[cacheKey(text)] = { ...label, at: now };
  const keys = Object.keys(map);
  if (keys.length > LABEL_CACHE_MAX_ENTRIES) {
    keys
      .sort((a, b) => map[a].at - map[b].at)
      .slice(0, keys.length - LABEL_CACHE_MAX_ENTRIES)
      .forEach((k) => delete map[k]);
  }
  await writeAll(map);
}

export async function clearLabelCache(): Promise<void> {
  await writeAll({});
}

/** Test hook. */
export function _resetMemoryCache(): void {
  memory = {};
}
