import { File, Paths } from 'expo-file-system';
import { MediaTrailerInfo, MediaType } from '@/types/media';

const TRAILER_CACHE_FILENAME = 'bingelog-trailers-cache.json';
const TRAILER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 250;

interface TrailerCacheEntry {
  cachedAt: number;
  trailers: MediaTrailerInfo[];
}

type TrailerCacheMap = Record<string, TrailerCacheEntry>;

let inMemoryTrailerCache: TrailerCacheMap | null = null;

function buildKey(mediaType: MediaType, id: number): string {
  return `${mediaType}_${id}`;
}

async function loadCacheFromDisk(): Promise<TrailerCacheMap> {
  if (inMemoryTrailerCache !== null) {
    return inMemoryTrailerCache;
  }

  try {
    const file = new File(Paths.cache, TRAILER_CACHE_FILENAME);
    if (file.exists) {
      const content = await file.text();
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          inMemoryTrailerCache = parsed as TrailerCacheMap;
          return inMemoryTrailerCache;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to read trailer cache from disk', e);
  }

  inMemoryTrailerCache = {};
  return inMemoryTrailerCache;
}

async function persistCacheToDisk(cache: TrailerCacheMap): Promise<void> {
  try {
    const file = new File(Paths.cache, TRAILER_CACHE_FILENAME);
    if (!file.exists) {
      file.create();
    }
    file.write(JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to write trailer cache to disk', e);
  }
}

export async function getCachedTrailers(
  mediaType: MediaType,
  id: number
): Promise<MediaTrailerInfo[] | null> {
  const cache = await loadCacheFromDisk();
  const key = buildKey(mediaType, id);
  const entry = cache[key];
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > TRAILER_CACHE_TTL_MS) {
    delete cache[key];
    await persistCacheToDisk(cache);
    return null;
  }

  return Array.isArray(entry.trailers) ? entry.trailers : [];
}

export async function saveCachedTrailers(
  mediaType: MediaType,
  id: number,
  trailers: MediaTrailerInfo[]
): Promise<void> {
  const cache = await loadCacheFromDisk();
  const key = buildKey(mediaType, id);

  cache[key] = {
    cachedAt: Date.now(),
    trailers,
  };

  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    keys.sort((a, b) => (cache[a]?.cachedAt || 0) - (cache[b]?.cachedAt || 0));
    const excess = keys.length - MAX_CACHE_ENTRIES;
    for (let i = 0; i < excess; i++) {
      delete cache[keys[i]];
    }
  }

  inMemoryTrailerCache = cache;
  await persistCacheToDisk(cache);
}
