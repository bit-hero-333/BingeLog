import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackedItem } from '@/types/media';

export interface StorageMetrics {
  deviceTotalBytes: number;
  deviceFreeBytes: number;
  deviceUsedBytes: number;
  deviceUsedPercent: number;
  librarySizeBytes: number;
  configSizeBytes: number;
  totalAppStorageBytes: number;
  imageCacheSizeBytes: number;
  trackedItemCount: number;
}

export interface BackupData {
  app: string;
  version: string;
  exportedAt: string;
  itemCount: number;
  trackedItems: TrackedItem[];
  settings?: {
    showSeasonEpisodeImages?: boolean;
    showActorImages?: boolean;
    showAllCast?: boolean;
    showSeasonSpecials?: boolean;
    sizingConfig?: unknown;
    themeConfig?: unknown;
  };
}

/**
 * Format bytes into human-readable string (e.g., "14.2 MB", "128.4 GB").
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return `${bytes} B`;
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

/**
 * Recursively calculate directory size in bytes.
 */
function calculateDirectorySize(dir: Directory): number {
  let total = 0;
  try {
    if (!dir || !dir.exists) return 0;
    const items = dir.list();
    for (const item of items) {
      if (item instanceof Directory) {
        total += calculateDirectorySize(item);
      } else if (item instanceof File) {
        total += item.size ?? 0;
      }
    }
  } catch {
    // Suppress permission or transient file errors
  }
  return total;
}

/**
 * Calculate comprehensive storage metrics for device and app data.
 */
export async function getStorageMetrics(trackedItemCount: number): Promise<StorageMetrics> {
  let librarySizeBytes = 0;
  let totalAsyncStorageBytes = 0;

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet(allKeys);
    for (const [key, val] of pairs) {
      const entryBytes = (key ? key.length : 0) + (val ? val.length : 0);
      totalAsyncStorageBytes += entryBytes;
      if (key === '@pmt_tracked_items') {
        librarySizeBytes = val ? val.length : 0;
      }
    }
  } catch (e) {
    console.warn('Failed to calculate AsyncStorage size', e);
  }

  let imageCacheSizeBytes = 0;
  try {
    const cacheDir = new Directory(Paths.cache);
    imageCacheSizeBytes = calculateDirectorySize(cacheDir);
  } catch (e) {
    console.warn('Failed to calculate cache directory size', e);
  }

  const deviceTotalBytes =
    typeof Paths?.totalDiskSpace === 'number' && Paths.totalDiskSpace > 0
      ? Paths.totalDiskSpace
      : 0;

  const deviceFreeBytes =
    typeof Paths?.availableDiskSpace === 'number' && Paths.availableDiskSpace > 0
      ? Paths.availableDiskSpace
      : 0;

  const deviceUsedBytes =
    deviceTotalBytes > 0 ? Math.max(0, deviceTotalBytes - deviceFreeBytes) : 0;

  const deviceUsedPercent =
    deviceTotalBytes > 0 ? Math.round((deviceUsedBytes / deviceTotalBytes) * 100) : 0;

  const configSizeBytes = Math.max(0, totalAsyncStorageBytes - librarySizeBytes);
  const totalAppStorageBytes = totalAsyncStorageBytes + imageCacheSizeBytes;

  return {
    deviceTotalBytes,
    deviceFreeBytes,
    deviceUsedBytes,
    deviceUsedPercent,
    librarySizeBytes,
    configSizeBytes,
    totalAppStorageBytes,
    imageCacheSizeBytes,
    trackedItemCount,
  };
}

/**
 * Clear Expo Image disk and memory caches.
 */
export async function clearImageCache(): Promise<{ success: boolean; freedBytes: number }> {
  let beforeBytes = 0;
  try {
    beforeBytes = calculateDirectorySize(new Directory(Paths.cache));
  } catch {
    beforeBytes = 0;
  }

  try {
    await Image.clearDiskCache();
    await Image.clearMemoryCache();

    let afterBytes = 0;
    try {
      afterBytes = calculateDirectorySize(new Directory(Paths.cache));
    } catch {
      afterBytes = 0;
    }

    const freedBytes = Math.max(0, beforeBytes - afterBytes);
    return { success: true, freedBytes };
  } catch (err) {
    console.error('Error clearing image cache', err);
    return { success: false, freedBytes: 0 };
  }
}

/**
 * Export watchlist as a standardized JSON backup file and open native share sheet.
 */
export async function exportWatchlistBackup(
  trackedItems: TrackedItem[],
  settings?: BackupData['settings']
): Promise<{ success: boolean; message?: string }> {
  try {
    const backup: BackupData = {
      app: 'BingeLog',
      version: '0.14.0',
      exportedAt: new Date().toISOString(),
      itemCount: trackedItems.length,
      trackedItems,
      settings,
    };

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `bingelog-backup-${dateStr}.json`;
    const file = new File(Paths.cache, fileName);

    if (file.exists) {
      file.delete();
    }

    file.create();
    file.write(JSON.stringify(backup, null, 2));

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return {
        success: false,
        message: 'System sharing is not available on this device.',
      };
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export BingeLog Backup',
      UTI: 'public.json',
    });

    return { success: true };
  } catch (err) {
    console.error('Failed to export backup', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unknown export error occurred.',
    };
  }
}

/**
 * Open document picker to select a backup JSON file and validate its content.
 */
export async function pickAndParseBackupFile(): Promise<{
  canceled?: boolean;
  success: boolean;
  items?: TrackedItem[];
  settings?: BackupData['settings'];
  error?: string;
}> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { canceled: true, success: false };
    }

    const asset = result.assets[0];
    const file = new File(asset.uri);
    const content = await file.text();

    if (!content || !content.trim()) {
      return { success: false, error: 'The selected backup file is empty.' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { success: false, error: 'File is not valid JSON.' };
    }

    let items: TrackedItem[] = [];
    let settings: BackupData['settings'] | undefined;

    if (Array.isArray(parsed)) {
      items = parsed as TrackedItem[];
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.trackedItems)) {
        items = obj.trackedItems as TrackedItem[];
      }
      if (obj.settings && typeof obj.settings === 'object') {
        settings = obj.settings as BackupData['settings'];
      }
    }

    // Validate that items array contains recognized TrackedItem shapes
    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        error: 'No valid media tracking items found in this backup file.',
      };
    }

    // Sanitize items: ensure id and mediaType exist
    const validItems = items.filter(
      (it) => it && typeof it.id === 'number' && (it.mediaType === 'movie' || it.mediaType === 'tv')
    );

    if (validItems.length === 0) {
      return {
        success: false,
        error: 'Found items, but none matched valid movie or TV show structures.',
      };
    }

    return {
      success: true,
      items: validItems,
      settings,
    };
  } catch (err) {
    console.error('Failed to pick or parse backup file', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to read backup file.',
    };
  }
}
