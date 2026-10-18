import LZString from 'lz-string';
import { TrackedItem, SizingConfig, DateFormatOption } from '@/types/media';
import { HapticIntensity } from '@/services/haptics';

export interface SyncSettingsPayload {
  showSeasonEpisodeImages?: boolean;
  showActorImages?: boolean;
  showAllCast?: boolean;
  showSeasonSpecials?: boolean;
  sizingConfig?: SizingConfig;
  hapticIntensity?: HapticIntensity;
  dateFormat?: DateFormatOption;
}

export interface SyncPayload {
  app: 'BingeLog';
  version: string;
  timestamp: string;
  deviceLabel?: string;
  itemCount: number;
  trackedItems: TrackedItem[];
  settings?: SyncSettingsPayload;
}

export interface SyncDiffSummary {
  totalIncoming: number;
  newItemsCount: number;
  updatedItemsCount: number;
  unchangedItemsCount: number;
  newItemsTitles: string[];
  updatedItemsTitles: string[];
}

export interface ChunkPayload {
  id: string;
  idx: number;
  total: number;
  data: string;
}

const NTFY_BASE_URL = 'https://ntfy.sh';

/**
 * Generate a clean 6-digit sync PIN like "482-915"
 */
export function generateSyncCode(): string {
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(100 + Math.random() * 900);
  return `${part1}-${part2}`;
}

/**
 * Normalize sync code (removes dashes and spaces, uppercase)
 */
export function normalizeSyncCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Format topic name for ephemeral ntfy channel
 */
function getTopicName(code: string): string {
  const clean = normalizeSyncCode(code);
  return `bingelog_sync_${clean}`;
}

/**
 * Build the full sync payload from current state
 */
export function buildSyncPayload(
  trackedItems: TrackedItem[],
  settings?: SyncSettingsPayload,
  deviceLabel?: string
): SyncPayload {
  return {
    app: 'BingeLog',
    version: '0.1.12',
    timestamp: new Date().toISOString(),
    deviceLabel: deviceLabel || 'BingeLog Device',
    itemCount: trackedItems.length,
    trackedItems,
    settings,
  };
}

/**
 * Send payload through ephemeral relay (ntfy.sh)
 */
export async function sendRelayPayload(
  code: string,
  payload: SyncPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const topic = getTopicName(code);
    const jsonStr = JSON.stringify(payload);

    const response = await fetch(`${NTFY_BASE_URL}/${topic}`, {
      method: 'POST',
      headers: {
        Title: `BingeLog Sync (${payload.itemCount} items)`,
        Filename: 'bingelog-sync.json',
        Priority: 'high',
      },
      body: jsonStr,
    });

    if (!response.ok) {
      throw new Error(`Relay returned status ${response.status}`);
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to send relay payload', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown network relay error',
    };
  }
}

/**
 * Fetch payload from ephemeral relay (ntfy.sh)
 */
export async function fetchRelayPayload(
  code: string,
  timeoutMs = 15000
): Promise<{ success: boolean; payload?: SyncPayload; error?: string }> {
  try {
    const topic = getTopicName(code);
    const url = `${NTFY_BASE_URL}/${topic}/json?poll=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to connect to relay (HTTP ${res.status})`);
    }

    const rawText = await res.text();
    if (!rawText.trim()) {
      return { success: false, error: 'No data found for this sync code. Make sure the sender is waiting.' };
    }

    // ntfy /json endpoint returns newline-delimited JSON objects
    const lines = rawText.trim().split('\n');
    let targetMsg: any = null;

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(lines[i]);
        if (parsed.event === 'message') {
          targetMsg = parsed;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!targetMsg) {
      return { success: false, error: 'No sync message found on this channel.' };
    }

    // If message was uploaded as an attachment
    if (targetMsg.attachment?.url) {
      const attachRes = await fetch(targetMsg.attachment.url);
      if (!attachRes.ok) {
        throw new Error('Failed to download sync attachment.');
      }
      const attachData = await attachRes.json();
      return validateAndReturnPayload(attachData);
    }

    // Direct message body
    if (targetMsg.message) {
      try {
        const directData = JSON.parse(targetMsg.message);
        return validateAndReturnPayload(directData);
      } catch {
        return { success: false, error: 'Payload is not valid JSON.' };
      }
    }

    return { success: false, error: 'No usable sync payload in relay message.' };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Connection timed out. Please check the code and try again.' };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve sync data.',
    };
  }
}

function validateAndReturnPayload(data: any): { success: boolean; payload?: SyncPayload; error?: string } {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid sync payload structure.' };
  }
  if (!Array.isArray(data.trackedItems)) {
    return { success: false, error: 'Payload missing trackedItems array.' };
  }
  return { success: true, payload: data as SyncPayload };
}

/**
 * Compress payload for offline QR transfer
 */
export function compressPayloadForQr(payload: SyncPayload): string {
  // Minimize field overhead for QR density
  const minimal = {
    a: 'BL',
    t: payload.timestamp,
    d: payload.deviceLabel,
    i: payload.trackedItems.map((item) => ({
      id: item.id,
      m: item.mediaType,
      t: item.title,
      p: item.posterPath,
      y: item.releaseYear,
      v: item.voteAverage,
      o: item.overview,
      s: item.status,
      sc: item.userScore,
      cp: item.currentProgress,
      tp: item.totalProgress,
      te: item.totalEpisodes,
      ts: item.totalSeasons,
      wk: item.watchedEpisodeKeys,
      rm: item.runtimeMinutes,
      mw: item.minutesWatched,
      rc: item.rewatchCount,
      ad: item.addedAt,
      sa: item.startedAt,
      fa: item.finishedAt,
      lw: item.lastWatchedAt,
      ua: item.updatedAt,
      n: item.notes,
      iap: item.isAlsoPlanned ? 1 : 0,
    })),
    s: payload.settings,
  };

  const jsonStr = JSON.stringify(minimal);
  return LZString.compressToEncodedURIComponent(jsonStr);
}

/**
 * Decompress offline QR string back to SyncPayload
 */
export function decompressQrPayload(compressedStr: string): SyncPayload | null {
  try {
    const jsonStr = LZString.decompressFromEncodedURIComponent(compressedStr);
    if (!jsonStr) return null;
    const raw = JSON.parse(jsonStr);

    // If minimized format
    if (raw.a === 'BL' && Array.isArray(raw.i)) {
      const trackedItems: TrackedItem[] = raw.i.map((item: any) => ({
        id: item.id,
        mediaType: item.m,
        title: item.t,
        posterPath: item.p,
        releaseYear: item.y,
        voteAverage: item.v,
        overview: item.o,
        status: item.s,
        userScore: item.sc,
        currentProgress: item.cp,
        totalProgress: item.tp,
        totalEpisodes: item.te,
        totalSeasons: item.ts,
        watchedEpisodeKeys: item.wk,
        runtimeMinutes: item.rm,
        minutesWatched: item.mw,
        rewatchCount: item.rc,
        addedAt: item.ad || new Date().toISOString(),
        startedAt: item.sa,
        finishedAt: item.fa,
        lastWatchedAt: item.lw,
        updatedAt: item.ua || new Date().toISOString(),
        notes: item.n,
        isAlsoPlanned: (item as any).iap === 1,
      }));

      return {
        app: 'BingeLog',
        version: '0.1.12',
        timestamp: raw.t || new Date().toISOString(),
        deviceLabel: raw.d,
        itemCount: trackedItems.length,
        trackedItems,
        settings: raw.s,
      };
    }

    // Direct full SyncPayload
    if (raw.app === 'BingeLog' && Array.isArray(raw.trackedItems)) {
      return raw as SyncPayload;
    }

    return null;
  } catch (err) {
    console.error('Failed to decompress QR payload', err);
    return null;
  }
}

/**
 * Split large compressed QR strings into animated frames
 */
export function createQrChunks(compressed: string, maxChunkSize = 1400): ChunkPayload[] {
  if (compressed.length <= maxChunkSize) {
    return [{ id: 'single', idx: 0, total: 1, data: compressed }];
  }

  const chunkId = Math.random().toString(36).substring(2, 7);
  const total = Math.ceil(compressed.length / maxChunkSize);
  const chunks: ChunkPayload[] = [];

  for (let i = 0; i < total; i++) {
    const slice = compressed.substring(i * maxChunkSize, (i + 1) * maxChunkSize);
    chunks.push({
      id: chunkId,
      idx: i,
      total,
      data: slice,
    });
  }

  return chunks;
}

/**
 * Encode chunk into QR URL string format
 */
export function formatChunkQrString(chunk: ChunkPayload): string {
  if (chunk.total === 1) {
    return `bingelog-offline://${chunk.data}`;
  }
  return `bingelog-chunk://${chunk.id}/${chunk.idx + 1}/${chunk.total}/${chunk.data}`;
}

/**
 * Compare local and incoming items to give a clear user diff
 */
export function compareLibraries(
  localItems: TrackedItem[],
  incomingItems: TrackedItem[]
): SyncDiffSummary {
  const localMap = new Map<string, TrackedItem>();
  localItems.forEach((i) => localMap.set(`${i.mediaType}_${i.id}`, i));

  let newItemsCount = 0;
  let updatedItemsCount = 0;
  let unchangedItemsCount = 0;
  const newItemsTitles: string[] = [];
  const updatedItemsTitles: string[] = [];

  for (const inc of incomingItems) {
    const key = `${inc.mediaType}_${inc.id}`;
    const existing = localMap.get(key);

    if (!existing) {
      newItemsCount++;
      newItemsTitles.push(inc.title);
    } else {
      // Check if incoming has newer progress or dates
      const hasProgressDiff =
        (inc.currentProgress || 0) > (existing.currentProgress || 0) ||
        (inc.minutesWatched || 0) > (existing.minutesWatched || 0) ||
        (inc.rewatchCount || 0) > (existing.rewatchCount || 0);

      const isStatusChange = inc.status !== existing.status;
      const isScoreChange = inc.userScore !== existing.userScore;

      if (hasProgressDiff || isStatusChange || isScoreChange) {
        updatedItemsCount++;
        updatedItemsTitles.push(inc.title);
      } else {
        unchangedItemsCount++;
      }
    }
  }

  return {
    totalIncoming: incomingItems.length,
    newItemsCount,
    updatedItemsCount,
    unchangedItemsCount,
    newItemsTitles,
    updatedItemsTitles,
  };
}

/**
 * Merge incoming items into existing library with intelligent conflict resolution
 */
export function mergeLibraries(
  localItems: TrackedItem[],
  incomingItems: TrackedItem[]
): TrackedItem[] {
  const map = new Map<string, TrackedItem>();
  localItems.forEach((i) => map.set(`${i.mediaType}_${i.id}`, { ...i }));

  for (const inc of incomingItems) {
    const key = `${inc.mediaType}_${inc.id}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...inc, updatedAt: inc.updatedAt || new Date().toISOString() });
    } else {
      // Merge watched episode keys
      const mergedWatchedKeys = new Set<string>([
        ...(existing.watchedEpisodeKeys || []),
        ...(inc.watchedEpisodeKeys || []),
      ]);

      const progress = Math.max(
        existing.currentProgress || 0,
        inc.currentProgress || 0,
        mergedWatchedKeys.size
      );

      const rewatch = Math.max(existing.rewatchCount || 0, inc.rewatchCount || 0);
      const minutes = Math.max(existing.minutesWatched || 0, inc.minutesWatched || 0);

      // Keep latest non-empty score and notes if incoming has them
      const score = inc.userScore > 0 ? inc.userScore : existing.userScore;
      const notes = inc.notes && inc.notes.trim() ? inc.notes : existing.notes;

      // Status resolution
      let status = existing.status;
      if (inc.status === 'completed' || existing.status === 'completed') {
        status = 'completed';
      } else if (inc.status === 'watching' || existing.status === 'watching') {
        status = 'watching';
      } else {
        status = inc.status || existing.status;
      }

      map.set(key, {
        ...existing,
        ...inc,
        status,
        userScore: score,
        notes,
        currentProgress: progress > 0 ? progress : undefined,
        watchedEpisodeKeys: mergedWatchedKeys.size > 0 ? Array.from(mergedWatchedKeys) : undefined,
        minutesWatched: minutes > 0 ? minutes : undefined,
        rewatchCount: rewatch > 0 ? rewatch : undefined,
        startedAt: inc.startedAt || existing.startedAt,
        finishedAt: inc.finishedAt || existing.finishedAt,
        isAlsoPlanned: status === 'completed' ? Boolean(inc.isAlsoPlanned ?? existing.isAlsoPlanned) : undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return Array.from(map.values());
}
