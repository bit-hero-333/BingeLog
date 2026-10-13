import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackedItem, SizingConfig, DEFAULT_SIZING_CONFIG } from '@/types/media';
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
