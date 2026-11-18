import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import {
  TrackedItem,
  SizingConfig,
  DEFAULT_SIZING_CONFIG,
  DateFormatOption,
  DEFAULT_DATE_FORMAT,
  AutoManualMode,
  TimeFormatOption,
  DEFAULT_TIME_FORMAT,
  NotificationTimingOption,
  NotificationStatusConfig,
  DEFAULT_NOTIFICATION_STATUSES,
  ProviderDisplayStrategy,
  StreamingRegionStrategy,
} from '@/types/media';
import { ThemeMode, ThemePresetId } from '@/constants/theme';
import { HapticIntensity } from '@/services/haptics';
import { InsightWidgetConfig, DEFAULT_INSIGHTS_LAYOUT } from '@/types/insights';

export interface SavedThemeConfig {
  mode: ThemeMode;
  preset: ThemePresetId;
  customAccent?: string;
  customCardColor?: string;
}

export interface AutoBackupInfo {
  latestExists: boolean;
  latestItemCount: number;
  latestSavedAt: string | null;
  latestSizeBytes: number;
  prevExists: boolean;
  prevItemCount: number;
  prevSavedAt: string | null;
  prevSizeBytes: number;
}

interface ChunkManifest {
  version: number;
  chunkCount: number;
  itemCount: number;
  updatedAt: string;
}

const STORAGE_KEYS = {
  API_KEY: '@pmt_tmdb_api_key',
  TRACKED_ITEMS: '@pmt_tracked_items',
  TRACKED_ITEMS_MANIFEST: '@pmt_tracked_items_manifest',
  TRACKED_ITEMS_CHUNK_PREFIX: '@pmt_tracked_items_chunk_',
  INTENTIONALLY_CLEARED: '@pmt_intentionally_cleared',
  SHOW_MEDIA_IMAGES: '@pmt_show_media_images',
  SHOW_SEASON_EPISODE_IMAGES: '@pmt_show_season_episode_images',
  SHOW_ACTOR_IMAGES: '@pmt_show_actor_images',
  SHOW_ALL_CAST: '@pmt_show_all_cast',
  SHOW_SEASON_SPECIALS: '@pmt_show_season_specials',
  SIZING_CONFIG: '@pmt_sizing_config',
  THEME_CONFIG: '@pmt_theme_config',
  HAPTIC_INTENSITY: '@pmt_haptic_intensity',
  DATE_FORMAT: '@pmt_date_format',
  REGION_MODE: '@pmt_region_mode',
  SELECTED_REGION: '@pmt_selected_region',
  TIMEZONE_MODE: '@pmt_timezone_mode',
  SELECTED_TIMEZONE: '@pmt_selected_timezone',
  REMINDERS_ENABLED: '@pmt_reminders_enabled',
  DEVICE_NOTIFICATIONS_ENABLED: '@pmt_device_notifications_enabled',
  NOTIFICATION_HOUR: '@pmt_notification_hour',
  NOTIFICATION_MINUTE: '@pmt_notification_minute',
  NOTIFICATION_DAYS_AHEAD: '@pmt_notification_days_ahead',
  TIME_FORMAT: '@pmt_time_format',
  NOTIFICATION_TIMING: '@pmt_notification_timing',
  NOTIFICATION_DAY_OFFSET: '@pmt_notification_day_offset',
  NOTIFICATION_STATUSES: '@pmt_notification_statuses',
  STREAMING_DISPLAY_STRATEGY: '@pmt_streaming_display_strategy',
  MY_SUBSCRIBED_PROVIDERS: '@pmt_my_subscribed_providers',
  STREAMING_REGION_STRATEGY: '@pmt_streaming_region_strategy',
  CUSTOM_STREAMING_REGION: '@pmt_custom_streaming_region',
  INSIGHTS_LAYOUT: '@pmt_insights_layout',
};

const CHUNK_ITEMS_SIZE = 25;
const SAFE_MONOLITH_BYTE_LIMIT = 900_000; // ~900 KB, well under Android 2 MB CursorWindow limit
const AUTO_BACKUP_LATEST_FILENAME = 'bingelog-auto-backup-latest.json';
const AUTO_BACKUP_PREV_FILENAME = 'bingelog-auto-backup-prev.json';

let inMemoryItemsCache: TrackedItem[] | null = null;
let lastReadFailed = false;

function sanitizeTrackedItemsArray(raw: unknown): TrackedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (it): it is TrackedItem =>
      Boolean(it) &&
      typeof it === 'object' &&
      typeof (it as TrackedItem).id === 'number' &&
      ((it as TrackedItem).mediaType === 'movie' || (it as TrackedItem).mediaType === 'tv')
  );
}

async function readAutoBackupFile(fileName: string): Promise<{
  items: TrackedItem[];
  savedAt: string | null;
  sizeBytes: number;
} | null> {
  try {
    const file = new File(Paths.document, fileName);
    if (!file.exists) return null;
    const sizeBytes = file.size ?? 0;
    const text = await file.text();
    if (!text || !text.trim()) return null;
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const items = sanitizeTrackedItemsArray(parsed);
      return { items, savedAt: null, sizeBytes };
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const items = sanitizeTrackedItemsArray(obj.trackedItems);
      const savedAt = typeof obj.exportedAt === 'string' ? obj.exportedAt : null;
      return { items, savedAt, sizeBytes };
    }
    return null;
  } catch (e) {
    console.warn(`Failed to read auto-backup file ${fileName}`, e);
    return null;
  }
}

async function writeAutoBackupMirror(items: TrackedItem[]): Promise<void> {
  try {
    const latestFile = new File(Paths.document, AUTO_BACKUP_LATEST_FILENAME);
    const prevFile = new File(Paths.document, AUTO_BACKUP_PREV_FILENAME);

    // Roll existing latest -> prev if latest has items
    if (latestFile.exists) {
      try {
        const existingLatest = await readAutoBackupFile(AUTO_BACKUP_LATEST_FILENAME);
        if (existingLatest && existingLatest.items.length > 0) {
          const existingText = await latestFile.text();
          if (existingText && existingText.trim()) {
            if (prevFile.exists) {
              prevFile.delete();
            }
            prevFile.create();
            prevFile.write(existingText);
          }
        }
      } catch (rollErr) {
        console.warn('Non-fatal error rolling auto-backup file', rollErr);
      }
    }

    // Write new latest file if items > 0
    if (items.length > 0) {
      const payload = {
        app: 'BingeLog',
        version: '0.25.0',
        exportedAt: new Date().toISOString(),
        itemCount: items.length,
        trackedItems: items,
      };
      if (latestFile.exists) {
        latestFile.delete();
      }
      latestFile.create();
      latestFile.write(JSON.stringify(payload));
    }
  } catch (e) {
    console.warn('Failed to write auto-backup mirror to document directory', e);
  }
}

async function persistTrackedItemsMultiLayer(items: TrackedItem[]): Promise<void> {
  inMemoryItemsCache = items;
  lastReadFailed = false;

  // 1. Write chunked keys in AsyncStorage (immune to Android 2 MB CursorWindow limit)
  const chunks: TrackedItem[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_ITEMS_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_ITEMS_SIZE));
  }

  let oldChunkCount = 0;
  try {
    const oldManifestRaw = await AsyncStorage.getItem(STORAGE_KEYS.TRACKED_ITEMS_MANIFEST);
    if (oldManifestRaw) {
      const parsedManifest = JSON.parse(oldManifestRaw) as ChunkManifest;
      if (typeof parsedManifest?.chunkCount === 'number') {
        oldChunkCount = parsedManifest.chunkCount;
      }
    }
  } catch {
    // Ignore old manifest read error
  }

  const pairsToSet: [string, string][] = chunks.map((chunk, idx) => [
    `${STORAGE_KEYS.TRACKED_ITEMS_CHUNK_PREFIX}${idx}`,
    JSON.stringify(chunk),
  ]);

  const manifest: ChunkManifest = {
    version: 2,
    chunkCount: chunks.length,
    itemCount: items.length,
    updatedAt: new Date().toISOString(),
  };
  pairsToSet.push([STORAGE_KEYS.TRACKED_ITEMS_MANIFEST, JSON.stringify(manifest)]);
  pairsToSet.push([STORAGE_KEYS.INTENTIONALLY_CLEARED, 'false']);

  await AsyncStorage.multiSet(pairsToSet);

  // Clean up any leftover chunk keys from when library had more chunks
  if (oldChunkCount > chunks.length) {
    const keysToRemove: string[] = [];
    for (let idx = chunks.length; idx < oldChunkCount; idx++) {
      keysToRemove.push(`${STORAGE_KEYS.TRACKED_ITEMS_CHUNK_PREFIX}${idx}`);
    }
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove).catch(() => {});
    }
  }

  // 2. Write legacy single key ONLY if well below Android's 2MB CursorWindow limit; otherwise remove monolithic key
  try {
    const fullSerialized = JSON.stringify(items);
    if (fullSerialized.length < SAFE_MONOLITH_BYTE_LIMIT) {
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKED_ITEMS, fullSerialized);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.TRACKED_ITEMS);
    }
  } catch (e) {
    console.warn('Non-fatal legacy key update warning', e);
  }

  // 3. Mirror to persistent FileSystem auto-backup
  await writeAutoBackupMirror(items);
}

export const StorageService = {
  async getApiKey(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.API_KEY);
    } catch (e) {
      console.error('Failed to get TMDB API key from storage', e);
      return null;
    }
  },

  async saveApiKey(key: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.API_KEY, key.trim());
      return true;
    } catch (e) {
      console.error('Failed to save TMDB API key to storage', e);
      return false;
    }
  },

  async removeApiKey(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.API_KEY);
      return true;
    } catch (e) {
      console.error('Failed to remove TMDB API key', e);
      return false;
    }
  },

  async getTrackedItems(): Promise<TrackedItem[]> {
    let intentionallyCleared = false;
    try {
      const clearedFlag = await AsyncStorage.getItem(STORAGE_KEYS.INTENTIONALLY_CLEARED);
      intentionallyCleared = clearedFlag === 'true';
    } catch {
      // Ignore
    }

    // Layer 1: Try reading chunked AsyncStorage first
    try {
      const manifestRaw = await AsyncStorage.getItem(STORAGE_KEYS.TRACKED_ITEMS_MANIFEST);
      if (manifestRaw) {
        const manifest = JSON.parse(manifestRaw) as ChunkManifest;
        if (manifest && typeof manifest.chunkCount === 'number') {
          if (manifest.chunkCount === 0 && intentionallyCleared) {
            inMemoryItemsCache = [];
            lastReadFailed = false;
            return [];
          }
          if (manifest.chunkCount > 0) {
            const chunkKeys: string[] = [];
            for (let i = 0; i < manifest.chunkCount; i++) {
              chunkKeys.push(`${STORAGE_KEYS.TRACKED_ITEMS_CHUNK_PREFIX}${i}`);
            }
            const chunkPairs = await AsyncStorage.multiGet(chunkKeys);
            const loadedItems: TrackedItem[] = [];
            let allChunksValid = true;

            for (const [, chunkVal] of chunkPairs) {
              if (!chunkVal) {
                allChunksValid = false;
                break;
              }
              const parsedChunk = sanitizeTrackedItemsArray(JSON.parse(chunkVal));
              loadedItems.push(...parsedChunk);
            }

            if (allChunksValid && loadedItems.length > 0) {
              inMemoryItemsCache = loadedItems;
              lastReadFailed = false;
              // Ensure FileSystem mirror exists in the background
              void readAutoBackupFile(AUTO_BACKUP_LATEST_FILENAME).then((existingMirror) => {
                if (!existingMirror || existingMirror.items.length === 0) {
                  void writeAutoBackupMirror(loadedItems);
                }
              });
              return loadedItems;
            }
          }
        }
      }
    } catch (chunkErr) {
      console.warn('Chunked storage read failed, falling back to legacy/mirror storage', chunkErr);
      lastReadFailed = true;
    }

    // Layer 2: Try reading legacy monolithic key (@pmt_tracked_items)
    try {
      const legacyData = await AsyncStorage.getItem(STORAGE_KEYS.TRACKED_ITEMS);
      if (legacyData) {
        const parsedLegacy = sanitizeTrackedItemsArray(JSON.parse(legacyData));
        if (parsedLegacy.length > 0) {
          inMemoryItemsCache = parsedLegacy;
          lastReadFailed = false;
          // Migrate legacy monolithic data to multi-layer chunked + filesystem mirror
          void persistTrackedItemsMultiLayer(parsedLegacy).catch(() => {});
          return parsedLegacy;
        }
      }
    } catch (legacyErr) {
      console.error('Legacy @pmt_tracked_items read failed (possible Android CursorWindow limit)', legacyErr);
      lastReadFailed = true;
    }

    // Layer 3: Self-Heal from FileSystem Auto-Backup Mirror if not intentionally cleared
    if (!intentionallyCleared) {
      const latestMirror = await readAutoBackupFile(AUTO_BACKUP_LATEST_FILENAME);
      if (latestMirror && latestMirror.items.length > 0) {
        console.warn(`Self-healing ${latestMirror.items.length} items from latest auto-backup mirror`);
        inMemoryItemsCache = latestMirror.items;
        lastReadFailed = false;
        void persistTrackedItemsMultiLayer(latestMirror.items).catch(() => {});
        return latestMirror.items;
      }

      const prevMirror = await readAutoBackupFile(AUTO_BACKUP_PREV_FILENAME);
      if (prevMirror && prevMirror.items.length > 0) {
        console.warn(`Self-healing ${prevMirror.items.length} items from previous auto-backup mirror`);
        inMemoryItemsCache = prevMirror.items;
        lastReadFailed = false;
        void persistTrackedItemsMultiLayer(prevMirror.items).catch(() => {});
        return prevMirror.items;
      }
    }

    // Layer 4: Fallback to in-memory cache if a transient read failure happened mid-session
    if (inMemoryItemsCache && inMemoryItemsCache.length > 0 && !intentionallyCleared) {
      return inMemoryItemsCache;
    }

    return [];
  },

  async saveTrackedItem(item: TrackedItem): Promise<TrackedItem[]> {
    try {
      const existing =
        inMemoryItemsCache !== null ? inMemoryItemsCache : await this.getTrackedItems();

      // Anti-wipe guard: if a storage read failed and existing is empty, try mirror before saving
      let baseList = existing;
      if (baseList.length === 0 && lastReadFailed) {
        const recovered =
          (await readAutoBackupFile(AUTO_BACKUP_LATEST_FILENAME)) ||
          (await readAutoBackupFile(AUTO_BACKUP_PREV_FILENAME));
        if (recovered && recovered.items.length > 0) {
          baseList = recovered.items;
        }
      }

      const index = baseList.findIndex(
        (i) => i.id === item.id && i.mediaType === item.mediaType
      );

      let updated: TrackedItem[];
      if (index >= 0) {
        updated = [...baseList];
        updated[index] = { ...item, updatedAt: new Date().toISOString() };
      } else {
        updated = [{ ...item, updatedAt: new Date().toISOString() }, ...baseList];
      }

      await persistTrackedItemsMultiLayer(updated);
      return updated;
    } catch (e) {
      console.error('Failed to save tracked item', e);
      throw e;
    }
  },

  async saveTrackedItems(items: TrackedItem[]): Promise<TrackedItem[]> {
    try {
      const existing =
        inMemoryItemsCache !== null ? inMemoryItemsCache : await this.getTrackedItems();

      let baseList = existing;
      if (baseList.length === 0 && lastReadFailed) {
        const recovered =
          (await readAutoBackupFile(AUTO_BACKUP_LATEST_FILENAME)) ||
          (await readAutoBackupFile(AUTO_BACKUP_PREV_FILENAME));
        if (recovered && recovered.items.length > 0) {
          baseList = recovered.items;
        }
      }

      const updatedMap = new Map<string, TrackedItem>();
      baseList.forEach((i) => updatedMap.set(`${i.mediaType}_${i.id}`, i));
      items.forEach((i) => {
        updatedMap.set(`${i.mediaType}_${i.id}`, { ...i, updatedAt: new Date().toISOString() });
      });
      const updated = Array.from(updatedMap.values());
      await persistTrackedItemsMultiLayer(updated);
      return updated;
    } catch (e) {
      console.error('Failed to save tracked items batch', e);
      throw e;
    }
  },

  async removeTrackedItem(id: number, mediaType: 'movie' | 'tv'): Promise<TrackedItem[]> {
    try {
      const existing =
        inMemoryItemsCache !== null ? inMemoryItemsCache : await this.getTrackedItems();
      const filtered = existing.filter(
        (i) => !(i.id === id && i.mediaType === mediaType)
      );
      await persistTrackedItemsMultiLayer(filtered);
      return filtered;
    } catch (e) {
      console.error('Failed to remove tracked item', e);
      throw e;
    }
  },

  async getAutoBackupInfo(): Promise<AutoBackupInfo> {
    const latest = await readAutoBackupFile(AUTO_BACKUP_LATEST_FILENAME);
    const prev = await readAutoBackupFile(AUTO_BACKUP_PREV_FILENAME);
    return {
      latestExists: Boolean(latest && latest.items.length > 0),
      latestItemCount: latest ? latest.items.length : 0,
      latestSavedAt: latest ? latest.savedAt : null,
      latestSizeBytes: latest ? latest.sizeBytes : 0,
      prevExists: Boolean(prev && prev.items.length > 0),
      prevItemCount: prev ? prev.items.length : 0,
      prevSavedAt: prev ? prev.savedAt : null,
      prevSizeBytes: prev ? prev.sizeBytes : 0,
    };
  },

  async restoreFromAutoBackup(source: 'latest' | 'prev' = 'latest'): Promise<TrackedItem[] | null> {
    const primaryFile =
      source === 'latest' ? AUTO_BACKUP_LATEST_FILENAME : AUTO_BACKUP_PREV_FILENAME;
    const fallbackFile =
      source === 'latest' ? AUTO_BACKUP_PREV_FILENAME : AUTO_BACKUP_LATEST_FILENAME;

    const target =
      (await readAutoBackupFile(primaryFile)) || (await readAutoBackupFile(fallbackFile));
    if (!target || target.items.length === 0) {
      return null;
    }

    await persistTrackedItemsMultiLayer(target.items);
    return target.items;
  },

  async getShowMediaImages(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.SHOW_MEDIA_IMAGES);
      if (val === null) return true;
      return val === 'true';
    } catch (e) {
      console.error('Failed to get show media images setting', e);
      return true;
    }
  },

  async saveShowMediaImages(enabled: boolean): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHOW_MEDIA_IMAGES, enabled ? 'true' : 'false');
      return true;
    } catch (e) {
      console.error('Failed to save show media images setting', e);
      return false;
    }
  },

  async getShowSeasonEpisodeImages(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.SHOW_SEASON_EPISODE_IMAGES);
      if (val === null) {
        // Fallback to legacy SHOW_MEDIA_IMAGES or true
        return await this.getShowMediaImages();
      }
      return val === 'true';
    } catch (e) {
      console.error('Failed to get show season/episode images setting', e);
      return true;
    }
  },

  async saveShowSeasonEpisodeImages(enabled: boolean): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHOW_SEASON_EPISODE_IMAGES, enabled ? 'true' : 'false');
      return true;
    } catch (e) {
      console.error('Failed to save show season/episode images setting', e);
      return false;
    }
  },

  async getShowActorImages(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.SHOW_ACTOR_IMAGES);
      if (val === null) return true;
      return val === 'true';
    } catch (e) {
      console.error('Failed to get show actor images setting', e);
      return true;
    }
  },

  async saveShowActorImages(enabled: boolean): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHOW_ACTOR_IMAGES, enabled ? 'true' : 'false');
      return true;
    } catch (e) {
      console.error('Failed to save show actor images setting', e);
      return false;
    }
  },

  async getShowAllCast(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.SHOW_ALL_CAST);
      if (val === null) return false;
      return val === 'true';
    } catch (e) {
      console.error('Failed to get show all cast setting', e);
      return false;
    }
  },

  async saveShowAllCast(enabled: boolean): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHOW_ALL_CAST, enabled ? 'true' : 'false');
      return true;
    } catch (e) {
      console.error('Failed to save show all cast setting', e);
      return false;
    }
  },

  async getShowSeasonSpecials(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.SHOW_SEASON_SPECIALS);
      if (val === null) return false;
      return val === 'true';
    } catch (e) {
      console.error('Failed to get show season specials setting', e);
      return false;
    }
  },

  async saveShowSeasonSpecials(enabled: boolean): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHOW_SEASON_SPECIALS, enabled ? 'true' : 'false');
      return true;
    } catch (e) {
      console.error('Failed to save show season specials setting', e);
      return false;
    }
  },

  async getSizingConfig(): Promise<SizingConfig> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.SIZING_CONFIG);
      if (!val) return DEFAULT_SIZING_CONFIG;
      return { ...DEFAULT_SIZING_CONFIG, ...JSON.parse(val) };
    } catch (e) {
      console.error('Failed to get sizing config', e);
      return DEFAULT_SIZING_CONFIG;
    }
  },

  async saveSizingConfig(config: SizingConfig): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SIZING_CONFIG, JSON.stringify(config));
      return true;
    } catch (e) {
      console.error('Failed to save sizing config', e);
      return false;
    }
  },

  async getThemeConfig(): Promise<SavedThemeConfig | null> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.THEME_CONFIG);
      if (!val) return null;
      return JSON.parse(val) as SavedThemeConfig;
    } catch (e) {
      console.error('Failed to get theme config', e);
      return null;
    }
  },

  async saveThemeConfig(config: SavedThemeConfig): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME_CONFIG, JSON.stringify(config));
      return true;
    } catch (e) {
      console.error('Failed to save theme config', e);
      return false;
    }
  },

  async getHapticIntensity(): Promise<HapticIntensity> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.HAPTIC_INTENSITY);
      if (val === 'off' || val === 'light' || val === 'medium' || val === 'heavy') {
        return val;
      }
      return 'medium';
    } catch (e) {
      console.error('Failed to get haptic intensity', e);
      return 'medium';
    }
  },

  async saveHapticIntensity(intensity: HapticIntensity): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HAPTIC_INTENSITY, intensity);
      return true;
    } catch (e) {
      console.error('Failed to save haptic intensity', e);
      return false;
    }
  },

  async getDateFormat(): Promise<DateFormatOption> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.DATE_FORMAT);
      if (
        val === 'DD.MM.YYYY' ||
        val === 'MM/DD/YYYY' ||
        val === 'YYYY-MM-DD' ||
        val === 'DD/MM/YYYY' ||
        val === 'MMM D, YYYY' ||
        val === 'D MMM YYYY'
      ) {
        return val as DateFormatOption;
      }
      return DEFAULT_DATE_FORMAT;
    } catch (e) {
      console.error('Failed to get date format preference', e);
      return DEFAULT_DATE_FORMAT;
    }
  },

  async saveDateFormat(format: DateFormatOption): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DATE_FORMAT, format);
      return true;
    } catch (e) {
      console.error('Failed to save date format preference', e);
      return false;
    }
  },

  async importTrackedItems(items: TrackedItem[], mode: 'merge' | 'replace'): Promise<TrackedItem[]> {
    try {
      let finalItems: TrackedItem[] = [];
      if (mode === 'replace') {
        finalItems = items.map((item) => ({
          ...item,
          updatedAt: item.updatedAt || new Date().toISOString(),
        }));
      } else {
        const existing = await this.getTrackedItems();
        const map = new Map<string, TrackedItem>();
        existing.forEach((i) => map.set(`${i.mediaType}_${i.id}`, i));
        items.forEach((i) => {
          const key = `${i.mediaType}_${i.id}`;
          const current = map.get(key);
          if (current) {
            map.set(key, {
              ...current,
              ...i,
              rewatchCount: Math.max(current.rewatchCount || 0, i.rewatchCount || 0) || undefined,
              updatedAt: new Date().toISOString(),
            });
          } else {
            map.set(key, { ...i, updatedAt: i.updatedAt || new Date().toISOString() });
          }
        });
        finalItems = Array.from(map.values());
      }

      await persistTrackedItemsMultiLayer(finalItems);
      return finalItems;
    } catch (e) {
      console.error('Failed to import tracked items', e);
      throw e;
    }
  },

  async getRegionMode(): Promise<AutoManualMode> {
    try {
      const mode = await AsyncStorage.getItem(STORAGE_KEYS.REGION_MODE);
      return mode === 'manual' ? 'manual' : 'auto';
    } catch {
      return 'auto';
    }
  },

  async saveRegionMode(mode: AutoManualMode): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REGION_MODE, mode);
      return true;
    } catch {
      return false;
    }
  },

  async getSelectedRegion(): Promise<string> {
    try {
      const region = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_REGION);
      if (region) return region;
      const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
      const parts = locale.split('-');
      return parts.length > 1 ? parts[1].toUpperCase() : 'US';
    } catch {
      return 'US';
    }
  },

  async saveSelectedRegion(region: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_REGION, region.toUpperCase());
      return true;
    } catch {
      return false;
    }
  },

  async getTimezoneMode(): Promise<AutoManualMode> {
    try {
      const mode = await AsyncStorage.getItem(STORAGE_KEYS.TIMEZONE_MODE);
      return mode === 'manual' ? 'manual' : 'auto';
    } catch {
      return 'auto';
    }
  },

  async saveTimezoneMode(mode: AutoManualMode): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TIMEZONE_MODE, mode);
      return true;
    } catch {
      return false;
    }
  },

  async getSelectedTimezone(): Promise<string> {
    try {
      const tz = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TIMEZONE);
      if (tz) return tz;
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  },

  async saveSelectedTimezone(tz: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_TIMEZONE, tz);
      return true;
    } catch {
      return false;
    }
  },

  async getRemindersEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.REMINDERS_ENABLED);
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  },

  async saveRemindersEnabled(enabled: boolean): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REMINDERS_ENABLED, String(enabled));
      return true;
    } catch {
      return false;
    }
  },

  async getDeviceNotificationsEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_NOTIFICATIONS_ENABLED);
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  },

  async saveDeviceNotificationsEnabled(enabled: boolean): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_NOTIFICATIONS_ENABLED, String(enabled));
      return true;
    } catch {
      return false;
    }
  },

  async getNotificationHour(): Promise<number> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_HOUR);
      if (val === null) return 9; // Default 9:00 AM
      const num = parseInt(val, 10);
      return isNaN(num) ? 9 : num;
    } catch {
      return 9;
    }
  },

  async saveNotificationHour(hour: number): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_HOUR, String(hour));
      return true;
    } catch {
      return false;
    }
  },

  async getNotificationMinute(): Promise<number> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_MINUTE);
      if (val === null) return 0;
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : Math.max(0, Math.min(59, num));
    } catch {
      return 0;
    }
  },

  async saveNotificationMinute(minute: number): Promise<boolean> {
    try {
      const clamped = Math.max(0, Math.min(59, Math.floor(minute)));
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_MINUTE, String(clamped));
      return true;
    } catch {
      return false;
    }
  },

  async getNotificationDaysAhead(): Promise<number> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_DAYS_AHEAD);
      if (val === null) return 0; // Default on release day
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : num;
    } catch {
      return 0;
    }
  },

  async saveNotificationDaysAhead(days: number): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_DAYS_AHEAD, String(days));
      return true;
    } catch {
      return false;
    }
  },

  async getTimeFormat(): Promise<TimeFormatOption> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.TIME_FORMAT);
      if (val === '12h' || val === '24h') return val;
      return DEFAULT_TIME_FORMAT;
    } catch {
      return DEFAULT_TIME_FORMAT;
    }
  },

  async saveTimeFormat(format: TimeFormatOption): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TIME_FORMAT, format);
      return true;
    } catch {
      return false;
    }
  },

  async getNotificationTiming(): Promise<NotificationTimingOption> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_TIMING);
      if (val === 'release_day' || val === 'next_day' || val === 'advance' || val === 'release_and_advance' || val === 'next_day_and_advance' || val === 'release_and_next_day' || val === 'all_three') return val;
      if (val === 'both') return 'release_and_advance';
      return 'release_and_advance';
    } catch {
      return 'release_and_advance';
    }
  },

  async saveNotificationTiming(timing: NotificationTimingOption): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_TIMING, timing);
      return true;
    } catch {
      return false;
    }
  },

  async getNotificationDayOffset(): Promise<number> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_DAY_OFFSET);
      if (val !== null) {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  async saveNotificationDayOffset(offset: number): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_DAY_OFFSET, String(offset));
      return true;
    } catch {
      return false;
    }
  },

  async getNotificationStatuses(): Promise<NotificationStatusConfig> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_STATUSES);
      if (!val) return { ...DEFAULT_NOTIFICATION_STATUSES };
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === 'object') {
        return {
          watching: Boolean(parsed.watching ?? DEFAULT_NOTIFICATION_STATUSES.watching),
          plan_to_watch: Boolean(parsed.plan_to_watch ?? DEFAULT_NOTIFICATION_STATUSES.plan_to_watch),
          completed: Boolean(parsed.completed ?? DEFAULT_NOTIFICATION_STATUSES.completed),
          on_hold: Boolean(parsed.on_hold ?? DEFAULT_NOTIFICATION_STATUSES.on_hold),
          dropped: Boolean(parsed.dropped ?? DEFAULT_NOTIFICATION_STATUSES.dropped),
        };
      }
      return { ...DEFAULT_NOTIFICATION_STATUSES };
    } catch {
      return { ...DEFAULT_NOTIFICATION_STATUSES };
    }
  },

  async saveNotificationStatuses(statuses: NotificationStatusConfig): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_STATUSES, JSON.stringify(statuses));
      return true;
    } catch {
      return false;
    }
  },

  async getStreamingDisplayStrategy(): Promise<ProviderDisplayStrategy> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.STREAMING_DISPLAY_STRATEGY);
      if (val === 'all' || val === 'subscribed' || val === 'none') return val;
      return 'all';
    } catch {
      return 'all';
    }
  },

  async saveStreamingDisplayStrategy(strategy: ProviderDisplayStrategy): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STREAMING_DISPLAY_STRATEGY, strategy);
      return true;
    } catch {
      return false;
    }
  },

  async getMySubscribedProviders(): Promise<number[]> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.MY_SUBSCRIBED_PROVIDERS);
      if (!val) return [8, 9, 337, 350, 1899, 283]; // Default popular streaming services
      return JSON.parse(val) as number[];
    } catch {
      return [8, 9, 337, 350, 1899, 283];
    }
  },

  async saveMySubscribedProviders(providers: number[]): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MY_SUBSCRIBED_PROVIDERS, JSON.stringify(providers));
      return true;
    } catch {
      return false;
    }
  },

  async getStreamingRegionStrategy(): Promise<StreamingRegionStrategy> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.STREAMING_REGION_STRATEGY);
      if (val === 'match_region' || val === 'custom' || val === 'worldwide') return val;
      return 'match_region';
    } catch {
      return 'match_region';
    }
  },

  async saveStreamingRegionStrategy(strategy: StreamingRegionStrategy): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STREAMING_REGION_STRATEGY, strategy);
      return true;
    } catch {
      return false;
    }
  },

  async getCustomStreamingRegion(): Promise<string> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_STREAMING_REGION);
      return val || 'US';
    } catch {
      return 'US';
    }
  },

  async saveCustomStreamingRegion(region: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_STREAMING_REGION, region);
      return true;
    } catch {
      return false;
    }
  },

  async getInsightsLayout(): Promise<InsightWidgetConfig[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.INSIGHTS_LAYOUT);
      if (!data) return DEFAULT_INSIGHTS_LAYOUT;
      const parsed: InsightWidgetConfig[] = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_INSIGHTS_LAYOUT;

      // Merge with default layout to ensure newly introduced widgets exist
      const existingMap = new Map(parsed.map((item) => [item.id, item]));
      const merged: InsightWidgetConfig[] = [];

      for (const def of DEFAULT_INSIGHTS_LAYOUT) {
        if (existingMap.has(def.id)) {
          merged.push(existingMap.get(def.id)!);
          existingMap.delete(def.id);
        } else {
          merged.push(def);
        }
      }

      // Append any legacy custom configs if any
      for (const remaining of existingMap.values()) {
        merged.push(remaining);
      }

      // Sort by order
      merged.sort((a, b) => a.order - b.order);
      return merged;
    } catch (e) {
      console.error('Failed to load insights layout from storage', e);
      return DEFAULT_INSIGHTS_LAYOUT;
    }
  },

  async saveInsightsLayout(layout: InsightWidgetConfig[]): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INSIGHTS_LAYOUT, JSON.stringify(layout));
      return true;
    } catch (e) {
      console.error('Failed to save insights layout to storage', e);
      return false;
    }
  },

  async clearAllData(): Promise<boolean> {
    try {
      // Preserve a last-resort snapshot in prev auto-backup before clearing
      try {
        const latestFile = new File(Paths.document, AUTO_BACKUP_LATEST_FILENAME);
        const prevFile = new File(Paths.document, AUTO_BACKUP_PREV_FILENAME);
        if (latestFile.exists) {
          const text = await latestFile.text();
          if (text && text.trim()) {
            if (prevFile.exists) {
              prevFile.delete();
            }
            prevFile.create();
            prevFile.write(text);
          }
          latestFile.delete();
        }
      } catch {
        // Non-fatal
      }

      const allKeys = await AsyncStorage.getAllKeys();
      const chunkKeys = allKeys.filter((k) => k.startsWith(STORAGE_KEYS.TRACKED_ITEMS_CHUNK_PREFIX));
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TRACKED_ITEMS,
        STORAGE_KEYS.TRACKED_ITEMS_MANIFEST,
        ...chunkKeys,
      ]);
      await AsyncStorage.setItem(STORAGE_KEYS.INTENTIONALLY_CLEARED, 'true');
      inMemoryItemsCache = [];
      lastReadFailed = false;
      return true;
    } catch (e) {
      console.error('Failed to clear storage', e);
      return false;
    }
  },
};
