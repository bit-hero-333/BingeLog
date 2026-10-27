import AsyncStorage from '@react-native-async-storage/async-storage';
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
  ProviderDisplayStrategy,
  StreamingRegionStrategy,
} from '@/types/media';
import { ThemeMode, ThemePresetId } from '@/constants/theme';
import { HapticIntensity } from '@/services/haptics';
import { InsightWidgetConfig, DEFAULT_INSIGHTS_LAYOUT } from '@/types/insights';
import { JellyfinConfig } from './jellyfin';

export interface SavedThemeConfig {
  mode: ThemeMode;
  preset: ThemePresetId;
  customAccent?: string;
  customCardColor?: string;
}

const STORAGE_KEYS = {
  API_KEY: '@pmt_tmdb_api_key',
  TRACKED_ITEMS: '@pmt_tracked_items',
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
  STREAMING_DISPLAY_STRATEGY: '@pmt_streaming_display_strategy',
  MY_SUBSCRIBED_PROVIDERS: '@pmt_my_subscribed_providers',
  STREAMING_REGION_STRATEGY: '@pmt_streaming_region_strategy',
  CUSTOM_STREAMING_REGION: '@pmt_custom_streaming_region',
  INSIGHTS_LAYOUT: '@pmt_insights_layout',
  JELLYFIN_CONFIG: '@pmt_jellyfin_config',
};

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
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TRACKED_ITEMS);
      if (!data) return [];
      return JSON.parse(data) as TrackedItem[];
    } catch (e) {
      console.error('Failed to load tracked items', e);
      return [];
    }
  },

  async saveTrackedItem(item: TrackedItem): Promise<TrackedItem[]> {
    try {
      const existing = await this.getTrackedItems();
      const index = existing.findIndex(
        (i) => i.id === item.id && i.mediaType === item.mediaType
      );

      let updated: TrackedItem[];
      if (index >= 0) {
        updated = [...existing];
        updated[index] = { ...item, updatedAt: new Date().toISOString() };
      } else {
        updated = [{ ...item, updatedAt: new Date().toISOString() }, ...existing];
      }

      await AsyncStorage.setItem(STORAGE_KEYS.TRACKED_ITEMS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to save tracked item', e);
      throw e;
    }
  },

  async saveTrackedItems(items: TrackedItem[]): Promise<TrackedItem[]> {
    try {
      const existing = await this.getTrackedItems();
      const updatedMap = new Map<string, TrackedItem>();
      existing.forEach((i) => updatedMap.set(`${i.mediaType}_${i.id}`, i));
      items.forEach((i) => {
        updatedMap.set(`${i.mediaType}_${i.id}`, { ...i, updatedAt: new Date().toISOString() });
      });
      const updated = Array.from(updatedMap.values());
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKED_ITEMS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to save tracked items batch', e);
      throw e;
    }
  },

  async removeTrackedItem(id: number, mediaType: 'movie' | 'tv'): Promise<TrackedItem[]> {
    try {
      const existing = await this.getTrackedItems();
      const filtered = existing.filter(
        (i) => !(i.id === id && i.mediaType === mediaType)
      );
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKED_ITEMS, JSON.stringify(filtered));
      return filtered;
    } catch (e) {
      console.error('Failed to remove tracked item', e);
      throw e;
    }
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

      await AsyncStorage.setItem(STORAGE_KEYS.TRACKED_ITEMS, JSON.stringify(finalItems));
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

  async getJellyfinConfig(): Promise<JellyfinConfig | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.JELLYFIN_CONFIG);
      if (!data) return null;
      return JSON.parse(data) as JellyfinConfig;
    } catch (e) {
      console.error('Failed to get Jellyfin config from storage', e);
      return null;
    }
  },

  async saveJellyfinConfig(config: JellyfinConfig): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.JELLYFIN_CONFIG, JSON.stringify(config));
      return true;
    } catch (e) {
      console.error('Failed to save Jellyfin config to storage', e);
      return false;
    }
  },

  async removeJellyfinConfig(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.JELLYFIN_CONFIG);
      return true;
    } catch (e) {
      console.error('Failed to remove Jellyfin config from storage', e);
      return false;
    }
  },

  async clearAllData(): Promise<boolean> {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.TRACKED_ITEMS]);
      return true;
    } catch (e) {
      console.error('Failed to clear storage', e);
      return false;
    }
  },
};
