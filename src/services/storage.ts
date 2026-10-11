import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackedItem } from '@/types/media';

const STORAGE_KEYS = {
  API_KEY: '@pmt_tmdb_api_key',
  TRACKED_ITEMS: '@pmt_tracked_items',
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
