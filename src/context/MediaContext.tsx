import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { StorageService } from '@/services/storage';
import { HapticsService, HapticIntensity } from '@/services/haptics';
import { NotificationService } from '@/services/notifications';
import {
  TrackedItem,
  MediaType,
  SizingConfig,
  DEFAULT_SIZING_CONFIG,
  DiscoverFilter,
  DateFormatOption,
  DEFAULT_DATE_FORMAT,
  AutoManualMode,
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

  // Haptic feedback
  hapticIntensity: HapticIntensity;
  setHapticIntensity: (intensity: HapticIntensity) => Promise<boolean>;
  triggerHaptic: (type?: 'selection' | 'impact' | 'success' | 'warning' | 'error') => void;

  // Date format preference
  dateFormat: DateFormatOption;
  setDateFormat: (format: DateFormatOption) => Promise<boolean>;

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
  notificationDaysAhead: number;
  setNotificationDaysAhead: (days: number) => Promise<boolean>;
  notificationPermissionStatus: 'granted' | 'denied' | 'undetermined';
  requestNotificationPermission: () => Promise<boolean>;
  sendTestNotification: () => Promise<boolean>;
  scheduledNotificationsCount: number;
  refreshScheduledNotifications: () => Promise<void>;

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
  const [hapticIntensity, setHapticIntensityState] = useState<HapticIntensity>('medium');
  const [dateFormat, setDateFormatState] = useState<DateFormatOption>(DEFAULT_DATE_FORMAT);
  const [regionMode, setRegionModeState] = useState<AutoManualMode>('auto');
  const [selectedRegion, setSelectedRegionState] = useState<string>('US');
  const [timezoneMode, setTimezoneModeState] = useState<AutoManualMode>('auto');
  const [selectedTimezone, setSelectedTimezoneState] = useState<string>('UTC');
  const [remindersEnabled, setRemindersEnabledState] = useState<boolean>(true);
  const [deviceNotificationsEnabled, setDeviceNotificationsEnabledState] = useState<boolean>(true);
  const [notificationHour, setNotificationHourState] = useState<number>(9);
  const [notificationDaysAhead, setNotificationDaysAheadState] = useState<number>(0);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<
    'granted' | 'denied' | 'undetermined'
  >('undetermined');
  const [scheduledNotificationsCount, setScheduledNotificationsCount] = useState<number>(0);
  const [activeDiscoverFilter, setActiveDiscoverFilter] = useState<DiscoverFilter | null>(null);
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
          savedRegionMode,
          savedSelectedRegion,
          savedTzMode,
          savedSelectedTz,
          savedReminders,
          savedDeviceNotifs,
          savedNotifHour,
          savedNotifDays,
          currentPerm,
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
          StorageService.getRegionMode(),
          StorageService.getSelectedRegion(),
          StorageService.getTimezoneMode(),
          StorageService.getSelectedTimezone(),
          StorageService.getRemindersEnabled(),
          StorageService.getDeviceNotificationsEnabled(),
          StorageService.getNotificationHour(),
          StorageService.getNotificationDaysAhead(),
          NotificationService.getPermissions(),
        ]);
        if (savedKey) setApiKeyState(savedKey);
        if (savedItems) setTrackedItems(savedItems);
        setShowSeasonEpisodeImagesState(savedSeasonEpImages);
        setShowActorImagesState(savedActorImages);
        setShowAllCastState(savedAllCast);
        setShowSeasonSpecialsState(savedSeasonSpecials);
        setSizingConfigState(savedSizing);
        setHapticIntensityState(savedHaptic);
        setDateFormatState(savedDateFormat);
        setRegionModeState(savedRegionMode);
        setSelectedRegionState(savedSelectedRegion);
        setTimezoneModeState(savedTzMode);
        setSelectedTimezoneState(savedSelectedTz);
        setRemindersEnabledState(savedReminders);
        setDeviceNotificationsEnabledState(savedDeviceNotifs);
        setNotificationHourState(savedNotifHour);
        setNotificationDaysAheadState(savedNotifDays);
        setNotificationPermissionStatus(currentPerm);
        HapticsService.setIntensity(savedHaptic);

        // Schedule all upcoming device notifications if enabled
        const count = await NotificationService.syncAll(savedItems || [], {
          enabled: savedDeviceNotifs,
          hour: savedNotifHour,
          daysAhead: savedNotifDays,
          timezone: savedSelectedTz,
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
        daysAhead: notificationDaysAhead,
        timezone: selectedTimezone,
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
        daysAhead: notificationDaysAhead,
        timezone: selectedTimezone,
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
        timezone: selectedTimezone,
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
          timezone: tz,
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
        timezone: selectedTimezone,
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
          daysAhead: notificationDaysAhead,
          timezone: selectedTimezone,
        });
        setScheduledNotificationsCount(count);
      }
    }
    return success;
  };

  const setNotificationDaysAhead = async (days: number): Promise<boolean> => {
    const success = await StorageService.saveNotificationDaysAhead(days);
    if (success) {
      setNotificationDaysAheadState(days);
      if (deviceNotificationsEnabled) {
        const count = await NotificationService.syncAll(trackedItems, {
          enabled: true,
          hour: notificationHour,
          daysAhead: days,
          timezone: selectedTimezone,
        });
        setScheduledNotificationsCount(count);
      }
    }
    return success;
  };

  const requestNotificationPermission = async (): Promise<boolean> => {
    const granted = await NotificationService.requestPermissions();
    setNotificationPermissionStatus(granted ? 'granted' : 'denied');
    if (granted && deviceNotificationsEnabled) {
      const count = await NotificationService.syncAll(trackedItems, {
        enabled: true,
        hour: notificationHour,
        daysAhead: notificationDaysAhead,
        timezone: selectedTimezone,
      });
      setScheduledNotificationsCount(count);
    }
    return granted;
  };

  const sendTestNotification = async (): Promise<boolean> => {
    const sent = await NotificationService.sendTest();
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
      daysAhead: notificationDaysAhead,
      timezone: selectedTimezone,
    });
    setScheduledNotificationsCount(count);
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
        notificationDaysAhead,
        setNotificationDaysAhead,
        notificationPermissionStatus,
        requestNotificationPermission,
        sendTestNotification,
        scheduledNotificationsCount,
        refreshScheduledNotifications,
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
