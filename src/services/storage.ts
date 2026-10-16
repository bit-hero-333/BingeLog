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
} from '@/types/media';
import { ThemeMode, ThemePresetId } from '@/constants/theme';
import { HapticIntensity } from '@/services/haptics';

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
  NOTIFICATION_DAYS_AHEAD: '@pmt_notification_days_ahead',
  TIME_FORMAT: '@pmt_time_format',
  NOTIFICATION_TIMING: '@pmt_notification_timing',
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
      if (val === 'release_day' || val === 'advance' || val === 'both') return val;
      return 'both'; // Default: notify both in advance and on release day!
    } catch {
      return 'both';
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
