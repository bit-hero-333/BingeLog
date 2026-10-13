import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { StorageService } from '@/services/storage';
import {
  TrackedItem,
  MediaType,
  SizingConfig,
  DEFAULT_SIZING_CONFIG,
  DiscoverFilter,
} from '@/types/media';

interface MediaStats {
  total: number;
  watching: number;
  planToWatch: number;
  completed: number;
  onHold: number;
  dropped: number;
  meanScore: number;
}

interface MediaContextType {
  apiKey: string | null;
  setApiKey: (key: string) => Promise<boolean>;
  removeApiKey: () => Promise<boolean>;
  trackedItems: TrackedItem[];
  isLoadingStorage: boolean;
  saveItem: (item: TrackedItem) => Promise<void>;
  saveItems: (items: TrackedItem[]) => Promise<void>;
  removeItem: (id: number, mediaType: MediaType) => Promise<void>;
  getTrackedStatus: (id: number, mediaType: MediaType) => TrackedItem | undefined;
  stats: MediaStats;
  clearData: () => Promise<void>;
  importTrackedItems: (items: TrackedItem[], mode: 'merge' | 'replace') => Promise<number>;

  // Display toggles
  showSeasonEpisodeImages: boolean;
  setShowSeasonEpisodeImages: (enabled: boolean) => Promise<boolean>;
  showActorImages: boolean;
  setShowActorImages: (enabled: boolean) => Promise<boolean>;
  showAllCast: boolean;
  setShowAllCast: (enabled: boolean) => Promise<boolean>;
  showSeasonSpecials: boolean;
  setShowSeasonSpecials: (enabled: boolean) => Promise<boolean>;

  // Granular sizing
  sizingConfig: SizingConfig;
  setSizingConfig: (config: SizingConfig) => Promise<boolean>;

  // Active Discover filter
  activeDiscoverFilter: DiscoverFilter | null;
  setActiveDiscoverFilter: (filter: DiscoverFilter | null) => void;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export function MediaProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [trackedItems, setTrackedItems] = useState<TrackedItem[]>([]);
  const [showSeasonEpisodeImages, setShowSeasonEpisodeImagesState] = useState(true);
  const [showActorImages, setShowActorImagesState] = useState(true);
  const [showAllCast, setShowAllCastState] = useState(false);
  const [showSeasonSpecials, setShowSeasonSpecialsState] = useState(false);
  const [sizingConfig, setSizingConfigState] = useState<SizingConfig>(DEFAULT_SIZING_CONFIG);
  const [activeDiscoverFilter, setActiveDiscoverFilter] = useState<DiscoverFilter | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [
          savedKey,
          savedItems,
          savedSeasonEpImages,
          savedActorImages,
          savedAllCast,
          savedSeasonSpecials,
          savedSizing,
        ] = await Promise.all([
          StorageService.getApiKey(),
          StorageService.getTrackedItems(),
          StorageService.getShowSeasonEpisodeImages(),
          StorageService.getShowActorImages(),
          StorageService.getShowAllCast(),
          StorageService.getShowSeasonSpecials(),
          StorageService.getSizingConfig(),
        ]);
        if (savedKey) setApiKeyState(savedKey);
        if (savedItems) setTrackedItems(savedItems);
        setShowSeasonEpisodeImagesState(savedSeasonEpImages);
        setShowActorImagesState(savedActorImages);
        setShowAllCastState(savedAllCast);
        setShowSeasonSpecialsState(savedSeasonSpecials);
        setSizingConfigState(savedSizing);
      } catch (e) {
        console.error('Failed to load initial data', e);
      } finally {
        setIsLoadingStorage(false);
      }
    }
    loadInitialData();
  }, []);

  const setApiKey = async (key: string): Promise<boolean> => {
    const success = await StorageService.saveApiKey(key);
    if (success) {
      setApiKeyState(key.trim());
    }
    return success;
  };

  const removeApiKey = async (): Promise<boolean> => {
    const success = await StorageService.removeApiKey();
    if (success) {
      setApiKeyState(null);
    }
    return success;
  };

  const saveItem = async (item: TrackedItem): Promise<void> => {
    const updated = await StorageService.saveTrackedItem(item);
    setTrackedItems(updated);
  };

  const saveItems = async (items: TrackedItem[]): Promise<void> => {
    const updated = await StorageService.saveTrackedItems(items);
    setTrackedItems(updated);
  };

  const removeItem = async (id: number, mediaType: MediaType): Promise<void> => {
    const updated = await StorageService.removeTrackedItem(id, mediaType);
    setTrackedItems(updated);
  };

  const getTrackedStatus = (id: number, mediaType: MediaType): TrackedItem | undefined => {
    return trackedItems.find((i) => i.id === id && i.mediaType === mediaType);
  };

  const clearData = async (): Promise<void> => {
    await StorageService.clearAllData();
    setTrackedItems([]);
  };

  const importTrackedItems = async (items: TrackedItem[], mode: 'merge' | 'replace'): Promise<number> => {
    const updated = await StorageService.importTrackedItems(items, mode);
    setTrackedItems(updated);
    return updated.length;
  };

  const setShowSeasonEpisodeImages = async (enabled: boolean): Promise<boolean> => {
    const success = await StorageService.saveShowSeasonEpisodeImages(enabled);
    if (success) {
      setShowSeasonEpisodeImagesState(enabled);
    }
    return success;
  };

  const setShowActorImages = async (enabled: boolean): Promise<boolean> => {
    const success = await StorageService.saveShowActorImages(enabled);
    if (success) {
      setShowActorImagesState(enabled);
    }
    return success;
  };

  const setShowAllCast = async (enabled: boolean): Promise<boolean> => {
    const success = await StorageService.saveShowAllCast(enabled);
    if (success) {
      setShowAllCastState(enabled);
    }
    return success;
  };

  const setShowSeasonSpecials = async (enabled: boolean): Promise<boolean> => {
    const success = await StorageService.saveShowSeasonSpecials(enabled);
    if (success) {
      setShowSeasonSpecialsState(enabled);
    }
    return success;
  };

  const setSizingConfig = async (config: SizingConfig): Promise<boolean> => {
    const success = await StorageService.saveSizingConfig(config);
    if (success) {
      setSizingConfigState(config);
    }
    return success;
  };

  const stats = useMemo<MediaStats>(() => {
    let watching = 0;
    let planToWatch = 0;
    let completed = 0;
    let onHold = 0;
    let dropped = 0;
    let scoreSum = 0;
    let scoredCount = 0;

    for (const item of trackedItems) {
      switch (item.status) {
        case 'watching':
          watching++;
          break;
        case 'plan_to_watch':
          planToWatch++;
          break;
        case 'completed':
          completed++;
          break;
        case 'on_hold':
          onHold++;
          break;
        case 'dropped':
          dropped++;
          break;
      }

      if (item.userScore > 0) {
        scoreSum += item.userScore;
        scoredCount++;
      }
    }

    const meanScore = scoredCount > 0 ? Number((scoreSum / scoredCount).toFixed(2)) : 0;

    return {
      total: trackedItems.length,
      watching,
      planToWatch,
      completed,
      onHold,
      dropped,
      meanScore,
    };
  }, [trackedItems]);

  return (
    <MediaContext.Provider
      value={{
        apiKey,
        setApiKey,
        removeApiKey,
        trackedItems,
        isLoadingStorage,
        saveItem,
        saveItems,
        removeItem,
        getTrackedStatus,
        stats,
        clearData,
        importTrackedItems,
        showSeasonEpisodeImages,
        setShowSeasonEpisodeImages,
        showActorImages,
        setShowActorImages,
        showAllCast,
        setShowAllCast,
        showSeasonSpecials,
        setShowSeasonSpecials,
        sizingConfig,
        setSizingConfig,
        activeDiscoverFilter,
        setActiveDiscoverFilter,
      }}>
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia(): MediaContextType {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
}
