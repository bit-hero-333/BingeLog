import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { StorageService } from '@/services/storage';
import { HapticsService, HapticIntensity } from '@/services/haptics';
import { NotificationService } from '@/services/notifications';
import { TMDBService } from '@/services/tmdb';
import {
  TrackedItem,
  MediaType,
  SizingConfig,
  DEFAULT_SIZING_CONFIG,
  DiscoverFilter,
  DateFormatOption,
  DEFAULT_DATE_FORMAT,
  AutoManualMode,
  TimeFormatOption,
  DEFAULT_TIME_FORMAT,
  NotificationTimingOption,
  ItemReminderConfig,
  ProviderDisplayStrategy,
  StreamingRegionStrategy,
} from '@/types/media';
import {
  InsightWidgetConfig,
  InsightWidgetId,
  InsightWidgetSize,
  DEFAULT_INSIGHTS_LAYOUT,
} from '@/types/insights';

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

  // Haptic feedback
  hapticIntensity: HapticIntensity;
  setHapticIntensity: (intensity: HapticIntensity) => Promise<boolean>;
  triggerHaptic: (type?: 'selection' | 'impact' | 'success' | 'warning' | 'error') => void;

  // Date & Time format preferences
  dateFormat: DateFormatOption;
  setDateFormat: (format: DateFormatOption) => Promise<boolean>;
  timeFormat: TimeFormatOption;
  setTimeFormat: (format: TimeFormatOption) => Promise<boolean>;

  // Regional release & timezone preferences
  regionMode: AutoManualMode;
  setRegionMode: (mode: AutoManualMode) => Promise<boolean>;
  selectedRegion: string;
  setSelectedRegion: (region: string) => Promise<boolean>;
  timezoneMode: AutoManualMode;
  setTimezoneMode: (mode: AutoManualMode) => Promise<boolean>;
  selectedTimezone: string;
  setSelectedTimezone: (tz: string) => Promise<boolean>;
  remindersEnabled: boolean;
  setRemindersEnabled: (enabled: boolean) => Promise<boolean>;

  // Device release notifications
  deviceNotificationsEnabled: boolean;
  setDeviceNotificationsEnabled: (enabled: boolean) => Promise<boolean>;
  notificationHour: number;
  setNotificationHour: (hour: number) => Promise<boolean>;
  notificationMinute: number;
  setNotificationMinute: (minute: number) => Promise<boolean>;
  setNotificationTime: (hour: number, minute: number) => Promise<boolean>;
  notificationDaysAhead: number;
  setNotificationDaysAhead: (days: number) => Promise<boolean>;
  notificationTiming: NotificationTimingOption;
  setNotificationTiming: (timing: NotificationTimingOption) => Promise<boolean>;
  notificationDayOffset: number;
  setNotificationDayOffset: (offset: number) => Promise<boolean>;
  updateItemReminder: (id: number, mediaType: MediaType, reminder?: ItemReminderConfig) => Promise<void>;
  notificationPermissionStatus: 'granted' | 'denied' | 'undetermined';
  requestNotificationPermission: () => Promise<boolean>;
  sendTestNotification: (delaySeconds?: number) => Promise<boolean>;
  scheduledNotificationsCount: number;
  refreshScheduledNotifications: () => Promise<void>;

  // Streaming & Watch Providers
  streamingDisplayStrategy: ProviderDisplayStrategy;
  setStreamingDisplayStrategy: (strategy: ProviderDisplayStrategy) => Promise<boolean>;
  mySubscribedProviders: number[];
  setMySubscribedProviders: (providers: number[]) => Promise<boolean>;
  toggleSubscribedProvider: (providerId: number) => Promise<boolean>;
  streamingRegionStrategy: StreamingRegionStrategy;
  setStreamingRegionStrategy: (strategy: StreamingRegionStrategy) => Promise<boolean>;
  customStreamingRegion: string;
  setCustomStreamingRegion: (region: string) => Promise<boolean>;

  // Active Discover filter
  activeDiscoverFilter: DiscoverFilter | null;
  setActiveDiscoverFilter: (filter: DiscoverFilter | null) => void;

  // Media Insights Layout
  insightsLayout: InsightWidgetConfig[];
  updateInsightsLayout: (layout: InsightWidgetConfig[]) => Promise<boolean>;
  toggleInsightWidget: (widgetId: InsightWidgetId, enabled?: boolean) => Promise<boolean>;
  setInsightWidgetSize: (widgetId: InsightWidgetId, size: InsightWidgetSize) => Promise<boolean>;
  reorderInsightWidget: (fromIndex: number, toIndex: number) => Promise<boolean>;
  resetInsightsLayout: () => Promise<boolean>;
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
  const [hapticIntensity, setHapticIntensityState] = useState<HapticIntensity>('medium');
  const [dateFormat, setDateFormatState] = useState<DateFormatOption>(DEFAULT_DATE_FORMAT);
  const [timeFormat, setTimeFormatState] = useState<TimeFormatOption>(DEFAULT_TIME_FORMAT);
  const [regionMode, setRegionModeState] = useState<AutoManualMode>('auto');
  const [selectedRegion, setSelectedRegionState] = useState<string>('US');
  const [timezoneMode, setTimezoneModeState] = useState<AutoManualMode>('auto');
  const [selectedTimezone, setSelectedTimezoneState] = useState<string>('UTC');
  const [remindersEnabled, setRemindersEnabledState] = useState<boolean>(true);
  const [deviceNotificationsEnabled, setDeviceNotificationsEnabledState] = useState<boolean>(true);
  const [notificationHour, setNotificationHourState] = useState<number>(9);
  const [notificationMinute, setNotificationMinuteState] = useState<number>(0);
  const [notificationDaysAhead, setNotificationDaysAheadState] = useState<number>(1);
  const [notificationTiming, setNotificationTimingState] = useState<NotificationTimingOption>('both');
  const [notificationDayOffset, setNotificationDayOffsetState] = useState<number>(0);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<
    'granted' | 'denied' | 'undetermined'
  >('undetermined');
  const [scheduledNotificationsCount, setScheduledNotificationsCount] = useState<number>(0);
  const [activeDiscoverFilter, setActiveDiscoverFilter] = useState<DiscoverFilter | null>(null);
  const [streamingDisplayStrategy, setStreamingDisplayStrategyState] = useState<ProviderDisplayStrategy>('all');
  const [mySubscribedProviders, setMySubscribedProvidersState] = useState<number[]>([]);
  const [streamingRegionStrategy, setStreamingRegionStrategyState] = useState<StreamingRegionStrategy>('match_region');
  const [customStreamingRegion, setCustomStreamingRegionState] = useState<string>('US');
  const [insightsLayout, setInsightsLayoutState] = useState<InsightWidgetConfig[]>(DEFAULT_INSIGHTS_LAYOUT);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);

  useEffect(() => {
    async function loadInitialData() {
      try {
        await NotificationService.init();

        const [
          savedKey,
          savedItems,
          savedSeasonEpImages,
          savedActorImages,
          savedAllCast,
          savedSeasonSpecials,
          savedSizing,
          savedHaptic,
          savedDateFormat,
          savedTimeFormat,
          savedRegionMode,
          savedSelectedRegion,
          savedTzMode,
          savedSelectedTz,
          savedReminders,
          savedDeviceNotifs,
          savedNotifHour,
          savedNotifMinute,
          savedNotifDays,
          savedNotifTiming,
          savedDayOffset,
          currentPerm,
          savedStreamingDisplay,
          savedSubscribedProviders,
          savedStreamingRegionStrategy,
          savedCustomStreamingRegion,
          savedInsightsLayout,
        ] = await Promise.all([
          StorageService.getApiKey(),
          StorageService.getTrackedItems(),
          StorageService.getShowSeasonEpisodeImages(),
          StorageService.getShowActorImages(),
          StorageService.getShowAllCast(),
          StorageService.getShowSeasonSpecials(),
          StorageService.getSizingConfig(),
          StorageService.getHapticIntensity(),
          StorageService.getDateFormat(),
          StorageService.getTimeFormat(),
          StorageService.getRegionMode(),
          StorageService.getSelectedRegion(),
          StorageService.getTimezoneMode(),
          StorageService.getSelectedTimezone(),
          StorageService.getRemindersEnabled(),
          StorageService.getDeviceNotificationsEnabled(),
          StorageService.getNotificationHour(),
          StorageService.getNotificationMinute(),
          StorageService.getNotificationDaysAhead(),
          StorageService.getNotificationTiming(),
          StorageService.getNotificationDayOffset(),
          NotificationService.getPermissions(),
          StorageService.getStreamingDisplayStrategy(),
          StorageService.getMySubscribedProviders(),
          StorageService.getStreamingRegionStrategy(),
          StorageService.getCustomStreamingRegion(),
          StorageService.getInsightsLayout(),
        ]);
        if (savedKey) setApiKeyState(savedKey);
        setShowSeasonEpisodeImagesState(savedSeasonEpImages);
        setShowActorImagesState(savedActorImages);
        setShowAllCastState(savedAllCast);
        setShowSeasonSpecialsState(savedSeasonSpecials);
        setSizingConfigState(savedSizing);
        setHapticIntensityState(savedHaptic);
        setDateFormatState(savedDateFormat);
        setTimeFormatState(savedTimeFormat);
        setRegionModeState(savedRegionMode);
        setSelectedRegionState(savedSelectedRegion);
        setTimezoneModeState(savedTzMode);
        setSelectedTimezoneState(savedSelectedTz);
        setRemindersEnabledState(savedReminders);
        setDeviceNotificationsEnabledState(savedDeviceNotifs);
        setNotificationHourState(savedNotifHour);
        setNotificationMinuteState(savedNotifMinute);
        setNotificationDaysAheadState(savedNotifDays);
        setNotificationTimingState(savedNotifTiming);
        setNotificationDayOffsetState(savedDayOffset);
        setNotificationPermissionStatus(currentPerm);
        setStreamingDisplayStrategyState(savedStreamingDisplay);
        setMySubscribedProvidersState(savedSubscribedProviders);
        setStreamingRegionStrategyState(savedStreamingRegionStrategy);
        setCustomStreamingRegionState(savedCustomStreamingRegion);
        if (savedInsightsLayout && savedInsightsLayout.length > 0) {
          const existingIds = new Set(savedInsightsLayout.map((w) => w.id));
          const missingWidgets = DEFAULT_INSIGHTS_LAYOUT.filter((w) => !existingIds.has(w.id));
          if (missingWidgets.length > 0) {
            const merged = [...savedInsightsLayout, ...missingWidgets];
            setInsightsLayoutState(merged);
            await StorageService.saveInsightsLayout(merged);
          } else {
            setInsightsLayoutState(savedInsightsLayout);
          }
        }
        HapticsService.setIntensity(savedHaptic);

        // Auto-refresh missing next air dates for active watchlist & dual-tracked TV shows
        let activeItems = savedItems || [];
        if (savedKey && activeItems.length > 0) {
          const missingAirDateCount = activeItems.filter(
            (i) =>
              (i.status === 'watching' ||
                i.status === 'plan_to_watch' ||
                (i.mediaType === 'tv' && i.status === 'completed' && i.isAlsoPlanned)) &&
              i.mediaType === 'tv' &&
              !i.nextAirDate
          ).length;

          if (missingAirDateCount > 0) {
            try {
              const updatedItems = [...activeItems];
              let changed = false;
              for (let i = 0; i < updatedItems.length; i++) {
                const item = updatedItems[i];
                if (
                  (item.status === 'watching' ||
                    item.status === 'plan_to_watch' ||
                    (item.mediaType === 'tv' && item.status === 'completed' && item.isAlsoPlanned)) &&
                  item.mediaType === 'tv' &&
                  !item.nextAirDate
                ) {
                  const details = await TMDBService.getMediaDetails(item.id, 'tv', savedKey);
                  if (details.nextAirDate) {
                    updatedItems[i] = {
                      ...item,
                      nextAirDate: details.nextAirDate,
                      nextEpisode: details.nextEpisode,
                      originCountry: details.originCountry || item.originCountry,
                      originCountries: details.originCountries || item.originCountries,
                    };
                    changed = true;
                  }
                }
              }
              if (changed) {
                activeItems = updatedItems;
                await StorageService.saveTrackedItems(updatedItems);
              }
            } catch {
              // Non-fatal background refresh
            }
          }

          // Auto-refresh missing genres for tracked library items
          const missingGenresCount = activeItems.filter(
            (i) => !i.genres || i.genres.length === 0
          ).length;

          if (missingGenresCount > 0) {
            try {
              const updatedItems = [...activeItems];
              let changed = false;
              for (let i = 0; i < updatedItems.length; i++) {
                const item = updatedItems[i];
                if (!item.genres || item.genres.length === 0) {
                  const details = await TMDBService.getMediaDetails(item.id, item.mediaType, savedKey);
                  if (details.genres && details.genres.length > 0) {
                    updatedItems[i] = {
                      ...item,
                      genres: details.genres.map((g) => g.name),
                      genre_ids: details.genres.map((g) => g.id),
                      studios: details.studios && details.studios.length > 0 ? details.studios.map((s) => s.name) : item.studios,
                      watchProviders: details.watchProviders || item.watchProviders,
                      originCountry: details.originCountry || item.originCountry,
                      originCountries: details.originCountries || item.originCountries,
                    };
                    changed = true;
                  }
                }
              }
              if (changed) {
                activeItems = updatedItems;
                await StorageService.saveTrackedItems(updatedItems);
              }
            } catch {
              // Non-fatal background refresh
            }
          }

          // Auto-refresh missing origin countries for tracked library items
          const missingOriginCount = activeItems.filter((i) => !i.originCountry).length;

          if (missingOriginCount > 0) {
            try {
              const updatedItems = [...activeItems];
              let changed = false;
              for (let i = 0; i < updatedItems.length; i++) {
                const item = updatedItems[i];
                if (!item.originCountry) {
                  try {
                    const details = await TMDBService.getMediaDetails(item.id, item.mediaType, savedKey);
                    if (details.originCountry) {
                      updatedItems[i] = {
                        ...item,
                        originCountry: details.originCountry,
                      };
                      changed = true;
                    }
                  } catch {
                    // Non-fatal per-item error
                  }
                }
              }
              if (changed) {
                activeItems = updatedItems;
                setTrackedItems(updatedItems);
                await StorageService.saveTrackedItems(updatedItems);
              }
            } catch {
              // Non-fatal background refresh
            }
          }
        }

        // Retroactive backfill for existing on-hold items missing onHoldStartedAt
        let holdBackfillChanged = false;
        activeItems = activeItems.map((item) => {
            if (item.status === 'on_hold' && !item.onHoldStartedAt) {
              holdBackfillChanged = true;
              return {
                ...item,
                onHoldStartedAt: item.lastWatchedAt || item.updatedAt || item.addedAt || new Date().toISOString(),
              };
            }
            return item;
          });
          if (holdBackfillChanged) {
            try {
              await StorageService.saveTrackedItems(activeItems);
            } catch {
              // Non-fatal
            }
          }

          setTrackedItems(activeItems);

        // Schedule all upcoming device notifications if enabled
        const count = await NotificationService.syncAll(activeItems, {
          enabled: savedDeviceNotifs,
          hour: savedNotifHour,
          minute: savedNotifMinute,
          daysAhead: savedNotifDays,
          timing: savedNotifTiming,
          timezone: savedSelectedTz,
          timeFormat: savedTimeFormat,
        });
        setScheduledNotificationsCount(count);
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

  const setNotificationDayOffset = async (offset: number): Promise<boolean> => {
    const success = await StorageService.saveNotificationDayOffset(offset);
    if (success) {
      setNotificationDayOffsetState(offset);
      if (deviceNotificationsEnabled) {
        const count = await NotificationService.syncAll(trackedItems, {
          enabled: true,
          hour: notificationHour,
          minute: notificationMinute,
          daysAhead: notificationDaysAhead,
          timing: notificationTiming,
          dayOffset: offset,
          timezone: selectedTimezone,
          timeFormat,
        });
        setScheduledNotificationsCount(count);
      }
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
    if (deviceNotificationsEnabled) {
      await NotificationService.scheduleRelease(item, {
        enabled: true,
        hour: notificationHour,
        minute: notificationMinute,
        daysAhead: notificationDaysAhead,
        timing: notificationTiming,
        timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
      });
      const count = await NotificationService.getScheduledCount();
      setScheduledNotificationsCount(count);
    }
  };

  const saveItems = async (items: TrackedItem[]): Promise<void> => {
    const updated = await StorageService.saveTrackedItems(items);
    setTrackedItems(updated);
    if (deviceNotificationsEnabled) {
      const count = await NotificationService.syncAll(updated, {
        enabled: true,
        hour: notificationHour,
        minute: notificationMinute,
        daysAhead: notificationDaysAhead,
        timing: notificationTiming,
        timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
      });
      setScheduledNotificationsCount(count);
    }
  };

  const removeItem = async (id: number, mediaType: MediaType): Promise<void> => {
    const updated = await StorageService.removeTrackedItem(id, mediaType);
    setTrackedItems(updated);
    await NotificationService.cancelRelease(mediaType, id);
    const count = await NotificationService.getScheduledCount();
    setScheduledNotificationsCount(count);
  };

  const getTrackedStatus = (id: number, mediaType: MediaType): TrackedItem | undefined => {
    return trackedItems.find((i) => i.id === id && i.mediaType === mediaType);
  };

  const clearData = async (): Promise<void> => {
    await StorageService.clearAllData();
    setTrackedItems([]);
    await NotificationService.cancelAll();
    setScheduledNotificationsCount(0);
  };

  const importTrackedItems = async (items: TrackedItem[], mode: 'merge' | 'replace'): Promise<number> => {
    const updated = await StorageService.importTrackedItems(items, mode);
    setTrackedItems(updated);
    if (deviceNotificationsEnabled) {
      const count = await NotificationService.syncAll(updated, {
        enabled: true,
        hour: notificationHour,
        daysAhead: notificationDaysAhead,
        timing: notificationTiming,
        timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
      });
      setScheduledNotificationsCount(count);
    }
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

  const setHapticIntensity = async (intensity: HapticIntensity): Promise<boolean> => {
    const success = await StorageService.saveHapticIntensity(intensity);
    if (success) {
      setHapticIntensityState(intensity);
      HapticsService.setIntensity(intensity);
      HapticsService.triggerTest(intensity);
    }
    return success;
  };

  const setDateFormat = async (format: DateFormatOption): Promise<boolean> => {
    const success = await StorageService.saveDateFormat(format);
    if (success) {
      setDateFormatState(format);
    }
    return success;
  };

  const setTimeFormat = async (format: TimeFormatOption): Promise<boolean> => {
    const success = await StorageService.saveTimeFormat(format);
    if (success) {
      setTimeFormatState(format);
    }
    return success;
  };

  const setRegionMode = async (mode: AutoManualMode): Promise<boolean> => {
    const success = await StorageService.saveRegionMode(mode);
    if (success) {
      setRegionModeState(mode);
      if (mode === 'auto') {
        const detected = await StorageService.getSelectedRegion();
        setSelectedRegionState(detected);
      }
    }
    return success;
  };

  const setSelectedRegion = async (region: string): Promise<boolean> => {
    const success = await StorageService.saveSelectedRegion(region);
    if (success) {
      setSelectedRegionState(region.toUpperCase());
    }
    return success;
  };

  const setTimezoneMode = async (mode: AutoManualMode): Promise<boolean> => {
    const success = await StorageService.saveTimezoneMode(mode);
    if (success) {
      setTimezoneModeState(mode);
      if (mode === 'auto') {
        const detected = await StorageService.getSelectedTimezone();
        setSelectedTimezoneState(detected);
      }
    }
    return success;
  };

  const setSelectedTimezone = async (tz: string): Promise<boolean> => {
    const success = await StorageService.saveSelectedTimezone(tz);
    if (success) {
      setSelectedTimezoneState(tz);
      if (deviceNotificationsEnabled) {
        const count = await NotificationService.syncAll(trackedItems, {
          enabled: true,
          hour: notificationHour,
          daysAhead: notificationDaysAhead,
          timing: notificationTiming,
          timezone: tz,
          timeFormat,
        });
        setScheduledNotificationsCount(count);
      }
    }
    return success;
  };

  const setRemindersEnabled = async (enabled: boolean): Promise<boolean> => {
    const success = await StorageService.saveRemindersEnabled(enabled);
    if (success) {
      setRemindersEnabledState(enabled);
    }
    return success;
  };

  const setDeviceNotificationsEnabled = async (enabled: boolean): Promise<boolean> => {
    const success = await StorageService.saveDeviceNotificationsEnabled(enabled);
    if (success) {
      setDeviceNotificationsEnabledState(enabled);
      if (enabled) {
        const perm = await NotificationService.getPermissions();
        if (perm !== 'granted') {
          const granted = await NotificationService.requestPermissions();
          setNotificationPermissionStatus(granted ? 'granted' : 'denied');
        }
      }
      const count = await NotificationService.syncAll(trackedItems, {
        enabled,
        hour: notificationHour,
        daysAhead: notificationDaysAhead,
        timing: notificationTiming,
        timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
      });
      setScheduledNotificationsCount(count);
    }
    return success;
  };

  const setNotificationHour = async (hour: number): Promise<boolean> => {
    const success = await StorageService.saveNotificationHour(hour);
    if (success) {
      setNotificationHourState(hour);
      if (deviceNotificationsEnabled) {
        const count = await NotificationService.syncAll(trackedItems, {
          enabled: true,
          hour,
          minute: notificationMinute,
          daysAhead: notificationDaysAhead,
          timing: notificationTiming,
          timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
        });
        setScheduledNotificationsCount(count);
      }
    }
    return success;
  };

  const setNotificationMinute = async (minute: number): Promise<boolean> => {
    const success = await StorageService.saveNotificationMinute(minute);
    if (success) {
      setNotificationMinuteState(minute);
      if (deviceNotificationsEnabled) {
        const count = await NotificationService.syncAll(trackedItems, {
          enabled: true,
          hour: notificationHour,
          minute,
          daysAhead: notificationDaysAhead,
          timing: notificationTiming,
          timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
        });
        setScheduledNotificationsCount(count);
      }
    }
    return success;
  };

  const setNotificationTime = async (hour: number, minute: number): Promise<boolean> => {
    const okHour = await StorageService.saveNotificationHour(hour);
    const okMin = await StorageService.saveNotificationMinute(minute);
    if (okHour && okMin) {
      setNotificationHourState(hour);
      setNotificationMinuteState(minute);
      if (deviceNotificationsEnabled) {
        const count = await NotificationService.syncAll(trackedItems, {
          enabled: true,
          hour,
          minute,
          daysAhead: notificationDaysAhead,
          timing: notificationTiming,
          timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
        });
        setScheduledNotificationsCount(count);
      }
      return true;
    }
    return false;
  };

  const setNotificationDaysAhead = async (days: number): Promise<boolean> => {
    const success = await StorageService.saveNotificationDaysAhead(days);
    if (success) {
      setNotificationDaysAheadState(days);
      if (deviceNotificationsEnabled) {
        const count = await NotificationService.syncAll(trackedItems, {
          enabled: true,
          hour: notificationHour,
          minute: notificationMinute,
          daysAhead: days,
          timing: notificationTiming,
          timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
        });
        setScheduledNotificationsCount(count);
      }
    }
    return success;
  };

  const setNotificationTiming = async (timing: NotificationTimingOption): Promise<boolean> => {
    const success = await StorageService.saveNotificationTiming(timing);
    if (success) {
      setNotificationTimingState(timing);
      if (deviceNotificationsEnabled) {
        const count = await NotificationService.syncAll(trackedItems, {
          enabled: true,
          hour: notificationHour,
          minute: notificationMinute,
          daysAhead: notificationDaysAhead,
          timing,
          timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
        });
        setScheduledNotificationsCount(count);
      }
    }
    return success;
  };

  const updateItemReminder = async (
    id: number,
    mediaType: MediaType,
    reminder?: ItemReminderConfig
  ): Promise<void> => {
    const existing = trackedItems.find((i) => i.id === id && i.mediaType === mediaType);
    if (existing) {
      const updated: TrackedItem = {
        ...existing,
        reminder,
        updatedAt: new Date().toISOString(),
      };
      await saveItem(updated);
    }
  };

  const requestNotificationPermission = async (): Promise<boolean> => {
    const granted = await NotificationService.requestPermissions();
    setNotificationPermissionStatus(granted ? 'granted' : 'denied');
    if (granted && deviceNotificationsEnabled) {
      const count = await NotificationService.syncAll(trackedItems, {
        enabled: true,
        hour: notificationHour,
        minute: notificationMinute,
        daysAhead: notificationDaysAhead,
        timing: notificationTiming,
        timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
      });
      setScheduledNotificationsCount(count);
    }
    return granted;
  };

  const sendTestNotification = async (delaySeconds = 10): Promise<boolean> => {
    const sent = await NotificationService.sendTest(delaySeconds);
    if (sent) {
      const perm = await NotificationService.getPermissions();
      setNotificationPermissionStatus(perm);
    }
    return sent;
  };

  const refreshScheduledNotifications = async (): Promise<void> => {
    const count = await NotificationService.syncAll(trackedItems, {
      enabled: deviceNotificationsEnabled,
      hour: notificationHour,
      minute: notificationMinute,
      daysAhead: notificationDaysAhead,
      timing: notificationTiming,
      timezone: selectedTimezone,
        timeFormat,
        dayOffset: notificationDayOffset,
    });
    setScheduledNotificationsCount(count);
  };

  const setStreamingDisplayStrategy = async (strategy: ProviderDisplayStrategy): Promise<boolean> => {
    const success = await StorageService.saveStreamingDisplayStrategy(strategy);
    if (success) {
      setStreamingDisplayStrategyState(strategy);
    }
    return success;
  };

  const setMySubscribedProviders = async (providers: number[]): Promise<boolean> => {
    const success = await StorageService.saveMySubscribedProviders(providers);
    if (success) {
      setMySubscribedProvidersState(providers);
    }
    return success;
  };

  const toggleSubscribedProvider = async (providerId: number): Promise<boolean> => {
    const next = mySubscribedProviders.includes(providerId)
      ? mySubscribedProviders.filter((id) => id !== providerId)
      : [...mySubscribedProviders, providerId];
    return setMySubscribedProviders(next);
  };

  const setStreamingRegionStrategy = async (strategy: StreamingRegionStrategy): Promise<boolean> => {
    const success = await StorageService.saveStreamingRegionStrategy(strategy);
    if (success) {
      setStreamingRegionStrategyState(strategy);
    }
    return success;
  };

  const setCustomStreamingRegion = async (region: string): Promise<boolean> => {
    const success = await StorageService.saveCustomStreamingRegion(region);
    if (success) {
      setCustomStreamingRegionState(region.toUpperCase());
    }
    return success;
  };

  const updateInsightsLayout = async (layout: InsightWidgetConfig[]): Promise<boolean> => {
    const success = await StorageService.saveInsightsLayout(layout);
    if (success) {
      setInsightsLayoutState(layout);
    }
    return success;
  };

  const toggleInsightWidget = async (widgetId: InsightWidgetId, enabled?: boolean): Promise<boolean> => {
    const next = insightsLayout.map((item) =>
      item.id === widgetId ? { ...item, enabled: enabled !== undefined ? enabled : !item.enabled } : item
    );
    return updateInsightsLayout(next);
  };

  const setInsightWidgetSize = async (widgetId: InsightWidgetId, size: InsightWidgetSize): Promise<boolean> => {
    const next = insightsLayout.map((item) =>
      item.id === widgetId ? { ...item, size } : item
    );
    return updateInsightsLayout(next);
  };

  const reorderInsightWidget = async (fromIndex: number, toIndex: number): Promise<boolean> => {
    if (fromIndex < 0 || fromIndex >= insightsLayout.length || toIndex < 0 || toIndex >= insightsLayout.length) {
      return false;
    }
    const copy = [...insightsLayout];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    const updated = copy.map((item, idx) => ({ ...item, order: idx }));
    return updateInsightsLayout(updated);
  };

  const resetInsightsLayout = async (): Promise<boolean> => {
    return updateInsightsLayout(DEFAULT_INSIGHTS_LAYOUT);
  };

  const triggerHaptic = (type: 'selection' | 'impact' | 'success' | 'warning' | 'error' = 'impact') => {
    HapticsService.trigger(type);
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
          if (item.mediaType === 'tv' && item.isAlsoPlanned) {
            planToWatch++;
          }
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
        hapticIntensity,
        setHapticIntensity,
        triggerHaptic,
        dateFormat,
        setDateFormat,
        timeFormat,
        setTimeFormat,
        regionMode,
        setRegionMode,
        selectedRegion,
        setSelectedRegion,
        timezoneMode,
        setTimezoneMode,
        selectedTimezone,
        setSelectedTimezone,
        remindersEnabled,
        setRemindersEnabled,
        deviceNotificationsEnabled,
        setDeviceNotificationsEnabled,
        notificationHour,
        setNotificationHour,
        notificationMinute,
        setNotificationMinute,
        setNotificationTime,
        notificationDaysAhead,
        setNotificationDaysAhead,
        notificationTiming,
        setNotificationTiming,
        notificationDayOffset,
        setNotificationDayOffset,
        updateItemReminder,
        notificationPermissionStatus,
        requestNotificationPermission,
        sendTestNotification,
        scheduledNotificationsCount,
        refreshScheduledNotifications,
        activeDiscoverFilter,
        setActiveDiscoverFilter,
        streamingDisplayStrategy,
        setStreamingDisplayStrategy,
        mySubscribedProviders,
        setMySubscribedProviders,
        toggleSubscribedProvider,
        streamingRegionStrategy,
        setStreamingRegionStrategy,
        customStreamingRegion,
        setCustomStreamingRegion,
        insightsLayout,
        updateInsightsLayout,
        toggleInsightWidget,
        setInsightWidgetSize,
        reorderInsightWidget,
        resetInsightsLayout,
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
