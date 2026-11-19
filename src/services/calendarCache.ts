import { File, Paths } from 'expo-file-system';

const CALENDAR_CACHE_FILENAME = 'bingelog-calendar-episodes-cache.json';
const CALENDAR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

export interface CachedScheduleEpisode {
  episodeNumber: number;
  name: string;
  airDate: string;
}

interface CalendarSeasonEntry {
  cachedAt: number;
  episodes: CachedScheduleEpisode[];
}

type CalendarCacheMap = Record<string, CalendarSeasonEntry>;

let inMemoryCalendarCache: CalendarCacheMap | null = null;

function buildKey(tvId: number, seasonNumber: number): string {
  return `${tvId}_s${seasonNumber}`;
}

async function loadCacheFromDisk(): Promise<CalendarCacheMap> {
  if (inMemoryCalendarCache !== null) {
    return inMemoryCalendarCache;
  }

  try {
    const file = new File(Paths.cache, CALENDAR_CACHE_FILENAME);
    if (file.exists) {
      const content = await file.text();
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          inMemoryCalendarCache = parsed as CalendarCacheMap;
          return inMemoryCalendarCache;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to read calendar schedule cache from disk', e);
  }

  inMemoryCalendarCache = {};
  return inMemoryCalendarCache;
}

async function persistCacheToDisk(cache: CalendarCacheMap): Promise<void> {
  try {
    const file = new File(Paths.cache, CALENDAR_CACHE_FILENAME);
    if (!file.exists) {
      file.create();
    }
    file.write(JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to write calendar schedule cache to disk', e);
  }
}

export async function getCachedSeasonSchedule(
  tvId: number,
  seasonNumber: number
): Promise<CachedScheduleEpisode[] | null> {
  const cache = await loadCacheFromDisk();
  const key = buildKey(tvId, seasonNumber);
  const entry = cache[key];
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > CALENDAR_CACHE_TTL_MS) {
    delete cache[key];
    await persistCacheToDisk(cache);
    return null;
  }

  return Array.isArray(entry.episodes) ? entry.episodes : [];
}

export async function saveCachedSeasonSchedule(
  tvId: number,
  seasonNumber: number,
  episodes: CachedScheduleEpisode[]
): Promise<void> {
  const cache = await loadCacheFromDisk();
  const key = buildKey(tvId, seasonNumber);

  cache[key] = {
    cachedAt: Date.now(),
    episodes,
  };

  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    keys.sort((a, b) => (cache[a]?.cachedAt || 0) - (cache[b]?.cachedAt || 0));
    const excess = keys.length - MAX_CACHE_ENTRIES;
    for (let i = 0; i < excess; i++) {
      delete cache[keys[i]];
    }
  }

  inMemoryCalendarCache = cache;
  await persistCacheToDisk(cache);
}
