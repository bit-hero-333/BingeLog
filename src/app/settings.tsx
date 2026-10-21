import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Linking,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';
import { TMDBService } from '@/services/tmdb';
import {
  getStorageMetrics,
  formatBytes,
  clearImageCache,
  exportWatchlistBackup,
  pickAndParseBackupFile,
  StorageMetrics,
} from '@/services/storageMetrics';
import {
  THEME_PRESET_METAS,
  QUICK_ACCENTS,
  isDynamicThemeSupported,
} from '@/constants/theme';
import {
  DensityPreset,
  ElementScale,
  SIZING_PRESETS,
  DATE_FORMAT_OPTIONS,
  POPULAR_REGIONS,
  POPULAR_TIMEZONES,
  POPULAR_STREAMING_PROVIDERS,
  ProviderDisplayStrategy,
  StreamingRegionStrategy,
  EntitySelection,
  WatchProvider,
  NOTIFICATION_TIMING_CONFIGS,
} from '@/types/media';
import {
  getTextScale,
  getHeaderScale,
  getButtonScale,
  getProviderScale,
} from '@/utils/sizing';
import { getTodayFormatted } from '@/utils/date';
import { SyncModal } from '@/components/SyncModal';
import { EntityModal } from '@/components/EntityModal';
import { CustomizeInsightsModal } from '@/components/insights/CustomizeInsightsModal';
import { INSIGHT_WIDGET_CATALOG } from '@/types/insights';
import { router } from 'expo-router';
import { AchievementsEngine } from '@/services/achievementsEngine';

const SCALES: ElementScale[] = ['small', 'medium', 'large', 'xlarge'];

const SCALE_LABELS: Record<ElementScale, string> = {
  small: 'Small',
  medium: 'Normal',
  large: 'Large',
  xlarge: 'Extra Large',
};

const ROW_SCALE_LABELS: Record<ElementScale, string> = {
  small: 'Compact',
  medium: 'Normal',
  large: 'Roomy',
  xlarge: 'Spacious',
};

export default function SettingsScreen() {
  const {
    apiKey,
    setApiKey,
    removeApiKey,
    trackedItems,
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
    notificationTiming,
    setNotificationTiming,
    notificationPermissionStatus,
    requestNotificationPermission,
    sendTestNotification,
    scheduledNotificationsCount,
    refreshScheduledNotifications,
    streamingDisplayStrategy,
    setStreamingDisplayStrategy,
    mySubscribedProviders,
    toggleSubscribedProvider,
    setMySubscribedProviders,
    streamingRegionStrategy,
    setStreamingRegionStrategy,
    customStreamingRegion,
    setCustomStreamingRegion,
    insightsLayout,
    resetInsightsLayout,
  } = useMedia();

  // Collapsible Accordion Sections State
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    appearance: false,
    sizing: false,
    streaming: false,
    haptics: false,
    dates: false,
    regional: false,
    notifications: false,
    api: false,
    insights: false,
    storage: false,
    about: false,
  });

  const [showInsightsCustomizer, setShowInsightsCustomizer] = useState(false);

  const {
    mode,
    isDark,
    preset,
    colors,
    customAccent,
    setMode,
    setPreset,
    setCustomAccent,
  } = useAppTheme();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);
  const buttonScale = getButtonScale(sizingConfig?.buttonSize);
  const providerScale = getProviderScale(sizingConfig?.providerSize);

  // Dynamic Typography & Scaling Styles for live preview in Settings
  const dynTypography = useMemo(
    () => ({
      cardTitle: { fontSize: Math.round(15.5 * headerScale) },
      accordionSubtitle: { fontSize: Math.round(11.5 * textScale) },
      cardDescription: { fontSize: Math.round(12.5 * textScale), lineHeight: Math.round(18 * textScale) },
      subControlLabel: { fontSize: Math.round(11 * textScale) },
      subControlSubtext: { fontSize: Math.round(11 * textScale) },
      sliderTitle: { fontSize: Math.round(13 * textScale) },
      sliderValueText: { fontSize: Math.round(11.5 * textScale) },
      settingsOverviewText: { fontSize: Math.round(13 * textScale) },
      toggleAllBtnText: { fontSize: Math.round(11 * buttonScale) },
      toggleAllBtn: {
        paddingVertical: Math.max(4, Math.round(6 * buttonScale)),
        paddingHorizontal: Math.max(8, Math.round(12 * buttonScale)),
      },
      presetBtn: { paddingVertical: Math.max(6, Math.round(9 * buttonScale)) },
      presetBtnText: { fontSize: Math.round(12 * buttonScale) },
      modeSegmentBtn: { paddingVertical: Math.max(6, Math.round(8 * buttonScale)) },
      modeSegmentText: { fontSize: Math.round(11.5 * buttonScale) },
      stepBtn: { width: Math.round(38 * buttonScale), height: Math.round(38 * buttonScale) },
      stepperBox: { minHeight: Math.round(38 * buttonScale) },
      smallActionBtn: {
        paddingVertical: Math.max(4, Math.round(6 * buttonScale)),
        paddingHorizontal: Math.max(8, Math.round(12 * buttonScale)),
      },
      smallActionBtnText: { fontSize: Math.round(10.5 * buttonScale) },
      providerGridLogo: {
        width: Math.round(32 * providerScale),
        height: Math.round(32 * providerScale),
      },
    }),
    [textScale, headerScale, buttonScale, providerScale]
  );

  const activeInsightsCount = useMemo(
    () => (insightsLayout || []).filter((w) => w.enabled).length,
    [insightsLayout]
  );

  // Streaming Provider Catalog State
  const [providerBrowseScope, setProviderBrowseScope] = useState<'set_region' | 'other_regions' | 'all_worldwide'>('set_region');
  const [providerBrowsedOtherRegion, setProviderBrowsedOtherRegion] = useState<string>(() => {
    if ((selectedRegion || 'US').toUpperCase() === 'US') return 'GB';
    return 'US';
  });
  const [providerSearchQuery, setProviderSearchQuery] = useState<string>('');
  const [fetchedProviders, setFetchedProviders] = useState<WatchProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState<boolean>(false);
  const [selectedEntityForModal, setSelectedEntityForModal] = useState<EntitySelection | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!expandedSections.streaming) return;

    const loadProviders = async () => {
      setIsLoadingProviders(true);
      try {
        let region: string | undefined;
        if (providerBrowseScope === 'set_region') {
          region = selectedRegion || 'US';
        } else if (providerBrowseScope === 'other_regions') {
          region = providerBrowsedOtherRegion;
        } else {
          region = undefined; // All worldwide
        }

        const list = await TMDBService.getWatchProvidersList(apiKey || '', region);
        if (isMounted) {
          setFetchedProviders(list);
        }
      } catch {
        if (isMounted) {
          setFetchedProviders(
            POPULAR_STREAMING_PROVIDERS.map((p) => ({
              id: p.id,
              name: p.name,
              logoPath: p.logoPath,
            }))
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingProviders(false);
        }
      }
    };

    void loadProviders();

    return () => {
      isMounted = false;
    };
  }, [
    expandedSections.streaming,
    providerBrowseScope,
    providerBrowsedOtherRegion,
    selectedRegion,
    apiKey,
  ]);

  const filteredCatalogProviders = useMemo(() => {
    const query = providerSearchQuery.trim().toLowerCase();
    if (!query) return fetchedProviders;
    return fetchedProviders.filter((p) => p.name.toLowerCase().includes(query));
  }, [fetchedProviders, providerSearchQuery]);

  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);
  const [showTimingStrategyModal, setShowTimingStrategyModal] = useState(false);
  const currentGlobalTimingConfig =
    NOTIFICATION_TIMING_CONFIGS.find((c) => c.id === (notificationTiming === 'both' ? 'release_and_advance' : notificationTiming)) ||
    NOTIFICATION_TIMING_CONFIGS[0];

  const handleSendTestNotification = async (delaySeconds = 10) => {
    triggerHaptic('selection');
    setIsSendingTestNotif(true);
    try {
      const ok = await sendTestNotification(delaySeconds);
      if (ok) {
        triggerHaptic('success');
        Alert.alert(
          'Test Notification Scheduled',
          `A test reminder will trigger in ${delaySeconds} seconds. Lock your screen or switch out of the app now to test background delivery, lock screen banners, and sound.`
        );
      } else {
        triggerHaptic('warning');
        Alert.alert(
          'Permission Needed',
          'Notification permissions are not enabled. Tap "Grant Permission" below or enable notifications in system settings.'
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to dispatch test notification.');
    } finally {
      setIsSendingTestNotif(false);
    }
  };

  const toggleSection = (key: string) => {
    triggerHaptic('selection');
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allExpanded = Object.values(expandedSections).every(Boolean);
  const toggleAllSections = () => {
    triggerHaptic('selection');
    const next = !allExpanded;
    setExpandedSections({
      appearance: next,
      sizing: next,
      streaming: next,
      haptics: next,
      dates: next,
      regional: next,
      notifications: next,
      api: next,
      insights: next,
      storage: next,
      about: next,
    });
  };

  const [customKey, setCustomKey] = useState<string | null>(null);
  const inputKey = customKey !== null ? customKey : (apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Storage Metrics & Backup State
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
  const [isLoadingStorageMetrics, setIsLoadingStorageMetrics] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Manual hex input state
  const [hexInput, setHexInput] = useState(customAccent || '');
  // Preview mode toggle within live preview card (allows previewing opposite mode)
  const [previewOppositeMode, setPreviewOppositeMode] = useState(false);

  const handleSaveKey = async () => {
    if (!inputKey.trim()) {
      Alert.alert('Empty Key', 'Please enter a valid TMDB API key or Access Token.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await TMDBService.testApiKey(inputKey.trim());
    setIsTesting(false);
    setTestResult(result);

    if (result.valid) {
      await setApiKey(inputKey.trim());
      Alert.alert('Success', 'TMDB API Key verified and saved successfully!');
    } else {
      Alert.alert('Verification Failed', result.message);
    }
  };

  const handleRemoveKey = () => {
    Alert.alert(
      'Remove API Key',
      'Are you sure you want to remove your TMDB API Key? Searching and posters will be disabled until a new key is added.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeApiKey();
            setCustomKey('');
            setTestResult(null);
          },
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Media',
      `Are you sure you want to delete all ${trackedItems.length} items from your list? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearData();
            void loadStorageMetrics();
            Alert.alert('Cleared', 'All tracked media has been removed.');
          },
        },
      ]
    );
  };

  const loadStorageMetrics = useCallback(async () => {
    setIsLoadingStorageMetrics(true);
    try {
      const metrics = await getStorageMetrics(trackedItems.length);
      setStorageMetrics(metrics);
    } catch (err) {
      console.warn('Failed to calculate storage metrics', err);
    } finally {
      setIsLoadingStorageMetrics(false);
    }
  }, [trackedItems.length]);

  useEffect(() => {
    void loadStorageMetrics();
  }, [loadStorageMetrics]);

  const handleClearImageCache = () => {
    Alert.alert(
      'Clear Image Cache',
      'This will remove all downloaded poster, backdrop, and actor images from device storage. Images will reload automatically when viewing items.\n\nYour tracked movies, TV shows, and watch progress will NOT be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setIsClearingCache(true);
            try {
              const res = await clearImageCache();
              await loadStorageMetrics();
              if (res.success) {
                Alert.alert(
                  'Cache Cleared',
                  `Successfully freed ${formatBytes(res.freedBytes)} of internal storage!`
                );
              } else {
                Alert.alert('Notice', 'Image cache was cleared.');
              }
            } catch {
              Alert.alert('Error', 'Failed to clear cache.');
            } finally {
              setIsClearingCache(false);
            }
          },
        },
      ]
    );
  };

  const handleExportBackup = async () => {
    if (trackedItems.length === 0) {
      Alert.alert('No Items to Export', 'You do not have any tracked media in your library yet.');
      return;
    }

    setIsExporting(true);
    try {
      const res = await exportWatchlistBackup(trackedItems, {
        showSeasonEpisodeImages,
        showActorImages,
        showAllCast,
        showSeasonSpecials,
        sizingConfig,
      });

      if (res.success) {
        void AchievementsEngine.recordExtraStat('backupCount');
      } else if (res.message) {
        Alert.alert('Export Notice', res.message);
      }
    } catch {
      Alert.alert('Export Failed', 'An error occurred while creating the backup.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async () => {
    setIsImporting(true);
    try {
      const res = await pickAndParseBackupFile();
      if (res.canceled) {
        return;
      }

      if (!res.success || !res.items) {
        Alert.alert('Import Failed', res.error || 'Could not parse backup file.');
        return;
      }

      const backupCount = res.items.length;
      Alert.alert(
        'Restore Watchlist Backup',
        `Found ${backupCount} media ${backupCount === 1 ? 'item' : 'items'} in the backup file.\n\nHow would you like to restore?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Merge with Library',
            onPress: async () => {
              const count = await importTrackedItems(res.items!, 'merge');
              await loadStorageMetrics();
              Alert.alert('Restore Complete', `Your library now contains ${count} items.`);
            },
          },
          {
            text: 'Replace Library',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Confirm Overwrite',
                `This will overwrite all ${trackedItems.length} current items with the ${backupCount} items from the backup file.\n\nAre you sure?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Replace All',
                    style: 'destructive',
                    onPress: async () => {
                      const count = await importTrackedItems(res.items!, 'replace');
                      await loadStorageMetrics();
                      Alert.alert('Library Replaced', `Successfully restored ${count} items.`);
                    },
                  },
                ]
              );
            },
          },
        ]
      );
    } catch {
      Alert.alert('Import Failed', 'Failed to import backup file.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleStepSizing = (
    key:
      | 'textSize'
      | 'castSize'
      | 'tagSize'
      | 'rowDensity'
      | 'seasonEpisodeSize'
      | 'posterSize'
      | 'buttonSize'
      | 'providerSize'
      | 'headerSize',
    delta: number
  ) => {
    const currentVal = sizingConfig[key] || 'medium';
    const currentIndex = SCALES.indexOf(currentVal);
    const nextIndex = Math.max(0, Math.min(SCALES.length - 1, currentIndex + delta));
    void setSizingConfig({
      ...sizingConfig,
      [key]: SCALES[nextIndex],
      preset: 'default',
    });
  };

  const handleApplyPreset = (densityPreset: DensityPreset) => {
    void setSizingConfig(SIZING_PRESETS[densityPreset]);
  };

  const renderSliderControlRow = (
    key:
      | 'textSize'
      | 'castSize'
      | 'tagSize'
      | 'rowDensity'
      | 'seasonEpisodeSize'
      | 'posterSize'
      | 'buttonSize'
      | 'providerSize'
      | 'headerSize',
    title: string,
    valueText: string
  ) => {
    const currentVal = (sizingConfig[key] || 'medium') as ElementScale;
    const isMin = currentVal === 'small';
    const isMax = currentVal === 'xlarge';

    return (
      <View key={key} style={styles.sliderControlRow}>
        <View style={styles.sliderInfo}>
          <Text style={[styles.sliderTitle, dynTypography.sliderTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.sliderValueText, dynTypography.sliderValueText, { color: colors.primary }]}>
            {valueText}
          </Text>
        </View>
        <View style={[styles.stepperBox, dynTypography.stepperBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <Pressable
            style={[styles.stepBtn, dynTypography.stepBtn, isMin && styles.stepBtnDisabled]}
            onPress={() => handleStepSizing(key, -1)}
            disabled={isMin}>
            <Ionicons name="remove" size={Math.max(13, Math.round(16 * buttonScale))} color={colors.text} />
          </Pressable>
          <View style={styles.stepLevelPipContainer}>
            {SCALES.map((scale, i) => (
              <View
                key={scale}
                style={[
                  styles.stepPip,
                  { backgroundColor: colors.cardBorder },
                  SCALES.indexOf(currentVal) >= i && [styles.stepPipActive, { backgroundColor: colors.primary }],
                ]}
              />
            ))}
          </View>
          <Pressable
            style={[styles.stepBtn, dynTypography.stepBtn, isMax && styles.stepBtnDisabled]}
            onPress={() => handleStepSizing(key, 1)}
            disabled={isMax}>
            <Ionicons name="add" size={Math.max(13, Math.round(16 * buttonScale))} color={colors.text} />
          </Pressable>
        </View>
      </View>
    );
  };

  // Preview sizing values
  const previewTextSize =
    sizingConfig.textSize === 'small'
      ? 11
      : sizingConfig.textSize === 'large'
      ? 14
      : sizingConfig.textSize === 'xlarge'
      ? 16
      : 12.5;

  const previewAvatarSize =
    sizingConfig.castSize === 'small'
      ? 36
      : sizingConfig.castSize === 'large'
      ? 54
      : sizingConfig.castSize === 'xlarge'
      ? 64
      : 44;

  const previewTagFontSize =
    sizingConfig.tagSize === 'small'
      ? 10
      : sizingConfig.tagSize === 'large'
      ? 12.5
      : sizingConfig.tagSize === 'xlarge'
      ? 14
      : 11;

  const previewTagPadV =
    sizingConfig.tagSize === 'small'
      ? 2
      : sizingConfig.tagSize === 'large'
      ? 5
      : sizingConfig.tagSize === 'xlarge'
      ? 7
      : 3;

  const previewTagPadH =
    sizingConfig.tagSize === 'small'
      ? 6
      : sizingConfig.tagSize === 'large'
      ? 10
      : sizingConfig.tagSize === 'xlarge'
      ? 12
      : 8;

  const previewRowPadV =
    sizingConfig.rowDensity === 'small'
      ? 6
      : sizingConfig.rowDensity === 'large'
      ? 12
      : sizingConfig.rowDensity === 'xlarge'
      ? 15
      : 8;

  const previewSeasonHeaderSize =
    sizingConfig.seasonEpisodeSize === 'small'
      ? 13
      : sizingConfig.seasonEpisodeSize === 'large'
      ? 17
      : sizingConfig.seasonEpisodeSize === 'xlarge'
      ? 19
      : 15;

  const previewEpisodeTitleSize =
    sizingConfig.seasonEpisodeSize === 'small'
      ? 12
      : sizingConfig.seasonEpisodeSize === 'large'
      ? 15.5
      : sizingConfig.seasonEpisodeSize === 'xlarge'
      ? 17.5
      : 14;

  const previewEpisodeStillWidth =
    sizingConfig.seasonEpisodeSize === 'small'
      ? 56
      : sizingConfig.seasonEpisodeSize === 'large'
      ? 84
      : sizingConfig.seasonEpisodeSize === 'xlarge'
      ? 104
      : 70;

  const previewEpisodeStillHeight = Math.round(previewEpisodeStillWidth * (9 / 16));

  const previewCheckboxSize =
    sizingConfig.seasonEpisodeSize === 'small'
      ? 18
      : sizingConfig.seasonEpisodeSize === 'large'
      ? 26
      : sizingConfig.seasonEpisodeSize === 'xlarge'
      ? 30
      : 22;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}>
      {/* Top Overview Bar */}
      <View style={styles.topActionsRow}>
        <Text style={[styles.settingsOverviewText, dynTypography.settingsOverviewText, { color: colors.textSecondary }]}>
          Preferences & Customization
        </Text>
        <Pressable
          style={[styles.toggleAllBtn, dynTypography.toggleAllBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
          onPress={toggleAllSections}>
          <Ionicons
            name={allExpanded ? 'contract-outline' : 'expand-outline'}
            size={Math.round(14 * buttonScale)}
            color={colors.primary}
          />
          <Text style={[styles.toggleAllBtnText, dynTypography.toggleAllBtnText, { color: colors.primary }]}>
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Text>
        </Pressable>
      </View>

      {/* ============================================================== */}
      {/* 1. THEME & COLOR CUSTOMIZATION SECTION */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('appearance')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="color-palette" size={Math.round(20 * headerScale)} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, dynTypography.cardTitle, { color: colors.text }]}>Appearance & Colors</Text>
              <Text style={[styles.accordionSubtitle, dynTypography.accordionSubtitle, { color: colors.textSecondary }]}>
                {mode === 'dark' ? 'Dark Mode' : 'Light Mode'} • {preset === 'custom' ? 'Custom Accent' : (THEME_PRESET_METAS.find((p) => p.id === preset)?.label || 'Theme')}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.appearance ? 'chevron-up' : 'chevron-down'}
            size={Math.round(18 * headerScale)}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.appearance && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary }]}>
              Switch between Light and Dark mode, choose from AMOLED and curated nature presets, or pick your own custom accent colors.
            </Text>

        {/* Mode Selector: Dark vs Light */}
        <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary }]}>MODE</Text>
        <View style={[styles.modeSegmentContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <Pressable
            style={[
              styles.modeSegmentBtn,
              dynTypography.modeSegmentBtn,
              mode === 'dark' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setMode('dark')}>
            <Ionicons
              name="moon"
              size={Math.round(15 * buttonScale)}
              color={mode === 'dark' ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.modeSegmentText,
                dynTypography.modeSegmentText,
                { color: mode === 'dark' ? '#ffffff' : colors.textSecondary },
              ]}>
              Dark Mode
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.modeSegmentBtn,
              dynTypography.modeSegmentBtn,
              mode === 'light' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setMode('light')}>
            <Ionicons
              name="sunny"
              size={Math.round(16 * buttonScale)}
              color={mode === 'light' ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.modeSegmentText,
                dynTypography.modeSegmentText,
                { color: mode === 'light' ? '#ffffff' : colors.textSecondary },
              ]}>
              Light Mode
            </Text>
          </Pressable>
        </View>

        {/* Curated Presets Grid */}
        <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary, marginTop: 16 }]}>
          COLOR PRESETS
        </Text>
        <View style={styles.presetsGrid}>
          {THEME_PRESET_METAS.map((p) => {
            const isSelected = preset === p.id;
            const isDynamicSupported = isDynamicThemeSupported();
            const isDynamic = p.id === 'dynamic';

            return (
              <Pressable
                key={p.id}
                style={[
                  styles.presetChip,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  isSelected && { borderColor: colors.primary, backgroundColor: colors.cardSelected },
                ]}
                onPress={() => {
                  if (isDynamic && !isDynamicSupported) {
                    Alert.alert(
                      'Android 12+ Required',
                      'Dynamic wallpaper color theming (Material You) requires Android 12 (API level 31) or newer.'
                    );
                    return;
                  }
                  triggerHaptic('selection');
                  setPreset(p.id);
                }}>
                <View style={styles.presetColorPreview}>
                  <View
                    style={[
                      styles.presetBgDot,
                      { backgroundColor: isDark ? p.darkBgPreview : p.lightBgPreview },
                    ]}
                  />
                  <View
                    style={[
                      styles.presetAccentDot,
                      { backgroundColor: p.accentPreview },
                    ]}
                  />
                </View>

                <View style={styles.presetChipContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={[
                        styles.presetChipLabel,
                        { color: isSelected ? colors.primary : colors.text },
                      ]}>
                      {p.label}
                    </Text>
                    {isDynamic && (
                      <View
                        style={{
                          backgroundColor: isDynamicSupported ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 6,
                        }}>
                        <Text
                          style={{
                            fontSize: 9.5,
                            fontWeight: '700',
                            color: isDynamicSupported ? '#22c55e' : '#ef4444',
                          }}>
                          {isDynamicSupported ? 'Monet' : '12+ Only'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.presetChipDesc, { color: colors.textMuted }]}>
                    {p.description}
                  </Text>
                </View>

                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Quick Accent Color Palette */}
        <Text style={[styles.subControlLabel, { color: colors.textSecondary, marginTop: 16 }]}>
          QUICK ACCENT COLORS
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accentPaletteScroll}>
          {QUICK_ACCENTS.map((item) => {
            const isChosen =
              (preset === 'custom' && customAccent?.toLowerCase() === item.hex.toLowerCase()) ||
              (typeof colors.primary === 'string' && colors.primary.toLowerCase() === item.hex.toLowerCase());

            return (
              <Pressable
                key={item.hex}
                style={[
                  styles.paletteCircle,
                  { backgroundColor: item.hex },
                  isChosen && styles.paletteCircleChosen,
                ]}
                onPress={() => {
                  setHexInput(item.hex);
                  void setCustomAccent(item.hex);
                }}>
                {isChosen && <Ionicons name="checkmark" size={16} color="#ffffff" />}
              </Pressable>
            );
          })}
          </ScrollView>

        {/* Manual Hex Input */}
        <View style={styles.hexInputRow}>
          <Text style={[styles.hexInputLabel, { color: colors.textSecondary }]}>Custom Hex:</Text>
          <View style={[styles.hexBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <TextInput
              style={[styles.hexTextInput, { color: colors.text }]}
              placeholder="#a855f7"
              placeholderTextColor={colors.textMuted}
              value={hexInput}
              onChangeText={setHexInput}
              autoCapitalize="none"
              maxLength={7}
            />
          </View>
          <Pressable
            style={[styles.hexApplyBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (hexInput.trim()) {
                void setCustomAccent(hexInput.trim());
              }
            }}>
            <Text style={styles.hexApplyBtnText}>Apply</Text>
          </Pressable>
        </View>

        {/* Theme Live Preview Card */}
        <View
          style={[
            styles.themeLivePreviewBox,
            {
              backgroundColor: previewOppositeMode ? (isDark ? '#f8fafc' : '#0d1017') : colors.cardSelected,
              borderColor: colors.cardBorder,
            },
          ]}>
          <View style={styles.previewHeaderRow}>
            <Text style={[styles.previewBoxTitle, { color: colors.primary }]}>
              THEME LIVE PREVIEW {previewOppositeMode ? (isDark ? '(LIGHT PREVIEW)' : '(DARK PREVIEW)') : `(${mode.toUpperCase()})`}
            </Text>
            <Pressable
              style={[styles.previewToggleModeBtn, { borderColor: colors.cardBorder }]}
              onPress={() => setPreviewOppositeMode(!previewOppositeMode)}>
              <Ionicons
                name={previewOppositeMode ? 'eye' : 'eye-outline'}
                size={13}
                color={colors.textSecondary}
              />
              <Text style={[styles.previewToggleModeText, { color: colors.textSecondary }]}>
                {previewOppositeMode ? 'Show Current' : `Preview ${isDark ? 'Light' : 'Dark'}`}
              </Text>
            </Pressable>
          </View>

          {/* Sample Interactive Component Preview */}
          <View style={styles.previewComponentsColumn}>
            {/* Sample Watchlist Card */}
            <View
              style={[
                styles.sampleMediaCardPreview,
                {
                  backgroundColor: previewOppositeMode ? (isDark ? '#ffffff' : '#161b26') : colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}>
              <View style={[styles.samplePosterThumb, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="film" size={16} color={colors.primary} />
              </View>
              <View style={styles.sampleMediaInfo}>
                <Text
                  style={[
                    styles.sampleMediaTitle,
                    { color: previewOppositeMode ? (isDark ? '#0f172a' : '#f8fafc') : colors.text },
                  ]}
                  numberOfLines={1}>
                  Sample Media Title (Preview)
                </Text>
                <View style={styles.sampleBadgesRow}>
                  <View style={[styles.sampleStatusPill, { backgroundColor: colors.primaryBg }]}>
                    <Text style={[styles.sampleStatusPillText, { color: colors.primary }]}>
                      Watching • 8/24
                    </Text>
                  </View>
                  <View style={styles.sampleRatingTag}>
                    <Ionicons name="star" size={11} color="#f59e0b" />
                    <Text style={[styles.sampleRatingText, { color: colors.textSecondary }]}>8.4</Text>
                  </View>
                </View>
              </View>
            </View>

                <View style={styles.sampleButtonsRow}>
                  <View style={[styles.samplePrimaryBtn, { backgroundColor: colors.primary }]}>
                    <Ionicons name="checkmark" size={14} color="#ffffff" />
                    <Text style={styles.samplePrimaryBtnText}>Save to List</Text>
                  </View>
                  <View style={[styles.sampleSecondaryBtn, { borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]}>
                    <Text style={[styles.sampleSecondaryBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* 2. GRANULAR SIZING & DISPLAY SETTINGS */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('sizing')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="resize" size={Math.round(20 * headerScale)} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, dynTypography.cardTitle, { color: colors.text }]}>Element Sizes & Density</Text>
              <Text style={[styles.accordionSubtitle, dynTypography.accordionSubtitle, { color: colors.textSecondary }]}>
                Preset: {sizingConfig.preset?.toUpperCase() || 'CUSTOM'} • Text: {sizingConfig.textSize.toUpperCase()}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.sizing ? 'chevron-up' : 'chevron-down'}
            size={Math.round(18 * headerScale)}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.sizing && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary }]}>
              Fine-tune element sizes without overlapping or breaking layouts. Choose a preset or adjust sliders below.
            </Text>

        {/* Master Preset Buttons */}
        <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary }]}>MASTER DENSITY PRESETS</Text>
        <View style={styles.presetButtonsRow}>
          {(['compact', 'default', 'large'] as DensityPreset[]).map((p) => {
            const isSelected = sizingConfig.preset === p;
            return (
              <Pressable
                key={p}
                style={[
                  styles.presetBtn,
                  dynTypography.presetBtn,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => handleApplyPreset(p)}>
                <Text
                  style={[
                    styles.presetBtnText,
                    dynTypography.presetBtnText,
                    { color: isSelected ? '#ffffff' : colors.textSecondary },
                    isSelected && styles.presetBtnTextActive,
                  ]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder }]} />

        {/* Sliders 1 - 9 using dynamic live scaling */}
        {renderSliderControlRow('textSize', 'Synopsis & Text Size', SCALE_LABELS[sizingConfig.textSize])}
        {renderSliderControlRow('castSize', 'Cast Cards & Avatars', SCALE_LABELS[sizingConfig.castSize])}
        {renderSliderControlRow('tagSize', 'Tags & Badges', SCALE_LABELS[sizingConfig.tagSize])}
        {renderSliderControlRow('rowDensity', 'Episode Rows Padding', ROW_SCALE_LABELS[sizingConfig.rowDensity])}
        {renderSliderControlRow('seasonEpisodeSize', 'Season & Episode List Size', SCALE_LABELS[sizingConfig.seasonEpisodeSize || 'medium'])}
        {renderSliderControlRow('posterSize', 'Poster & Artwork Scale', SCALE_LABELS[sizingConfig.posterSize || 'medium'])}
        {renderSliderControlRow('buttonSize', 'Buttons & Touch Targets', SCALE_LABELS[sizingConfig.buttonSize || 'medium'])}
        {renderSliderControlRow('providerSize', 'Watch Provider Chips', SCALE_LABELS[sizingConfig.providerSize || 'medium'])}
        {renderSliderControlRow('headerSize', 'Headers & Section Titles', SCALE_LABELS[sizingConfig.headerSize || 'medium'])}

        {/* Live Interactive Sizing Preview Box */}
        <View style={[styles.previewBox, { backgroundColor: colors.cardSelected, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewBoxTitle, { color: colors.primary, fontSize: Math.round(11 * headerScale) }]}>SIZING LIVE PREVIEW</Text>

          {/* Sample Tag Pill */}
          <View style={styles.previewTagRow}>
            <View
              style={[
                styles.sampleTag,
                {
                  paddingVertical: previewTagPadV,
                  paddingHorizontal: previewTagPadH,
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                },
              ]}>
              <Text style={[styles.sampleTagText, { fontSize: previewTagFontSize, color: colors.text }]}>
                Sci-Fi & Fantasy
              </Text>
              <Ionicons name="search" size={9} color={colors.textSecondary} />
            </View>
          </View>

          {/* Sample Synopsis */}
          <Text style={[styles.sampleSynopsis, { fontSize: previewTextSize, color: colors.textSecondary }]}>
            Sample synopsis text scaling dynamically with your chosen settings.
          </Text>

          {/* Sample Cast Avatar */}
          <View style={styles.sampleCastCard}>
            <View
              style={[
                styles.sampleCastAvatar,
                {
                  width: previewAvatarSize,
                  height: previewAvatarSize,
                  borderRadius: previewAvatarSize / 2,
                  backgroundColor: colors.inputBg,
                },
              ]}>
              <Ionicons
                name="person"
                size={Math.max(14, previewAvatarSize * 0.4)}
                color={colors.textMuted}
              />
            </View>
            <Text style={[styles.sampleCastName, { color: colors.text }]}>Sample Actor</Text>
          </View>

          {/* Sample Season Header Preview */}
          <View style={[styles.sampleSeasonHeader, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="layers-outline" size={16} color={colors.primary} />
            <Text style={[styles.sampleSeasonHeaderText, { fontSize: previewSeasonHeaderSize, color: colors.text }]}>
              Season 1 (Preview)
            </Text>
            <Text style={[styles.sampleSeasonMeta, { color: colors.textSecondary }]}>1 / 8 watched</Text>
          </View>

          {/* Sample Episode Row Preview */}
          <View
            style={[
              styles.sampleEpisodeRow,
              { paddingVertical: previewRowPadV, borderColor: colors.cardBorder },
            ]}>
            <View
              style={[
                styles.sampleCheckbox,
                {
                  width: previewCheckboxSize,
                  height: previewCheckboxSize,
                  borderRadius: Math.round(previewCheckboxSize / 4),
                  backgroundColor: colors.success,
                  borderColor: colors.success,
                },
              ]}>
              <Ionicons name="checkmark" size={Math.max(10, previewCheckboxSize - 10)} color="#ffffff" />
            </View>
            {showSeasonEpisodeImages && (
              <View
                style={[
                  styles.sampleStillThumb,
                  {
                    width: previewEpisodeStillWidth,
                    height: previewEpisodeStillHeight,
                    backgroundColor: colors.inputBg,
                  },
                ]}>
                <Ionicons name="image-outline" size={14} color={colors.textMuted} />
              </View>
            )}
            <Text
              style={[
                styles.sampleEpisodeText,
                { fontSize: previewEpisodeTitleSize, color: colors.text },
              ]}
              numberOfLines={1}>
              1. Pilot Episode
            </Text>
            <View style={[styles.sampleBadge, { backgroundColor: colors.primaryBg }]}>
              <Text style={[styles.sampleBadgeText, { color: colors.primary }]}>Watched</Text>
            </View>
          </View>
        </View>

        {/* Display Toggles */}
        <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder }]} />

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Season & Episode Images</Text>
            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
              Show 16:9 thumbnail previews for episodes and season posters.
            </Text>
          </View>
          <Switch
            value={showSeasonEpisodeImages}
            onValueChange={(val) => {
              void setShowSeasonEpisodeImages(val);
            }}
            trackColor={{ false: '#334155', true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Actor & Cast Profile Images</Text>
            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
              Show circular actor photos in the cast carousel and details sheet.
            </Text>
          </View>
          <Switch
            value={showActorImages}
            onValueChange={(val) => {
              void setShowActorImages(val);
            }}
            trackColor={{ false: '#334155', true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Full Cast Mode</Text>
            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
              Display all available actors in the cast carousel instead of only top 10.
            </Text>
          </View>
          <Switch
            value={showAllCast}
            onValueChange={(val) => {
              void setShowAllCast(val);
            }}
            trackColor={{ false: '#334155', true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Season Specials (Season 0)</Text>
            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
              Show specials and bonus episodes in the seasons list. Excludes them from regular completion counts.
            </Text>
          </View>
          <Switch
            value={showSeasonSpecials}
            onValueChange={(val) => {
              void setShowSeasonSpecials(val);
            }}
            trackColor={{ false: '#334155', true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* STREAMING & WATCH PROVIDERS */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('streaming')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="tv-outline" size={20} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: 15 * headerScale }]}>
                Streaming & Watch Providers
              </Text>
              <Text style={[styles.accordionSubtitle, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                {streamingDisplayStrategy === 'all'
                  ? 'All Providers'
                  : streamingDisplayStrategy === 'subscribed'
                  ? 'Subscribed Only'
                  : 'Hidden'}{' '}
                • {mySubscribedProviders.length} Subscribed
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.streaming ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.streaming && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, { color: colors.textSecondary, fontSize: 12.5 * textScale }]}>
              Configure streaming provider visibility and select the services you subscribe to. These are used to highlight availability and incorporate streaming logos onto release alert cards.
            </Text>

            {/* Strategy 1: Display Mode */}
            <Text style={[styles.subControlLabel, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
              STREAMING AVAILABILITY DISPLAY
            </Text>
            <View style={styles.providerStrategyRow}>
              {(
                [
                  { id: 'all', label: 'All Providers', desc: 'Show all, highlight subscribed' },
                  { id: 'subscribed', label: 'Subscribed Only', desc: 'Only show your services' },
                  { id: 'none', label: 'Hidden', desc: 'Hide availability cards' },
                ] as { id: ProviderDisplayStrategy; label: string; desc: string }[]
              ).map((opt) => {
                const isSelected = streamingDisplayStrategy === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.strategyBtn,
                      { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                      isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      void setStreamingDisplayStrategy(opt.id);
                    }}>
                    <View style={styles.strategyRadioRow}>
                      <View
                        style={[
                          styles.radioCircle,
                          { borderColor: colors.cardBorder },
                          isSelected && { borderColor: colors.primary },
                        ]}>
                        {isSelected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                      </View>
                      <Text
                        style={[
                          styles.strategyBtnTitle,
                          { color: isSelected ? colors.primary : colors.text, fontSize: 13 * textScale },
                        ]}>
                        {opt.label}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.strategyBtnDesc,
                        { color: colors.textSecondary, fontSize: 11 * textScale },
                      ]}>
                      {opt.desc}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder }]} />

            {/* Strategy 2: Streaming Region Preference */}
            <Text style={[styles.subControlLabel, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
              STREAMING REGION STRATEGY
            </Text>
            <View style={styles.streamingRegionOptionsRow}>
              {(
                [
                  { id: 'match_region', label: 'Follow App Region', desc: `Use ${selectedRegion}` },
                  { id: 'custom', label: 'Custom Region', desc: customStreamingRegion || 'US' },
                  { id: 'worldwide', label: 'Worldwide Overview', desc: 'All countries by default' },
                ] as { id: StreamingRegionStrategy; label: string; desc: string }[]
              ).map((opt) => {
                const isSelected = streamingRegionStrategy === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.regionStrategyPill,
                      { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      void setStreamingRegionStrategy(opt.id);
                    }}>
                    <Text
                      style={[
                        styles.regionStrategyPillText,
                        { color: isSelected ? '#ffffff' : colors.textSecondary, fontSize: 11 * textScale },
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {streamingRegionStrategy === 'custom' && (
              <View style={styles.customRegionContainer}>
                <Text style={[styles.customRegionLabel, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                  SELECT CUSTOM STREAMING REGION:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionPillsScroll}>
                  {POPULAR_REGIONS.map((r) => {
                    const isSelected = (customStreamingRegion || 'US').toUpperCase() === r.code;
                    return (
                      <Pressable
                        key={r.code}
                        style={[
                          styles.regionChip,
                          { backgroundColor: isSelected ? colors.primaryBg : colors.inputBg, borderColor: isSelected ? colors.primary : colors.cardBorder },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          void setCustomStreamingRegion(r.code);
                        }}>
                        <Text style={[styles.regionChipCode, { color: isSelected ? colors.primary : colors.text, fontSize: 12 * textScale }]}>
                          {r.code}
                        </Text>
                        <Text style={[styles.regionChipName, { color: colors.textSecondary, fontSize: 10 * textScale }]}>
                          {r.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder }]} />

            {/* Scope Tabs */}
            <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary }]}>
              CATALOG SCOPE & REGION
            </Text>
            <View style={styles.providerScopeTabsRow}>
              <Pressable
                style={[
                  styles.providerScopeTab,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  providerBrowseScope === 'set_region' && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setProviderBrowseScope('set_region');
                }}>
                <Ionicons
                  name="location"
                  size={12 * textScale}
                  color={providerBrowseScope === 'set_region' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.providerScopeTabText,
                    {
                      color: providerBrowseScope === 'set_region' ? colors.primary : colors.textSecondary,
                      fontSize: 11 * textScale,
                    },
                  ]}>
                  Set Region ({selectedRegion})
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.providerScopeTab,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  providerBrowseScope === 'other_regions' && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setProviderBrowseScope('other_regions');
                }}>
                <Ionicons
                  name="flag-outline"
                  size={12 * textScale}
                  color={providerBrowseScope === 'other_regions' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.providerScopeTabText,
                    {
                      color: providerBrowseScope === 'other_regions' ? colors.primary : colors.textSecondary,
                      fontSize: 11 * textScale,
                    },
                  ]}>
                  Other Regions ({providerBrowsedOtherRegion})
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.providerScopeTab,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  providerBrowseScope === 'all_worldwide' && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setProviderBrowseScope('all_worldwide');
                }}>
                <Ionicons
                  name="globe-outline"
                  size={12 * textScale}
                  color={providerBrowseScope === 'all_worldwide' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.providerScopeTabText,
                    {
                      color: providerBrowseScope === 'all_worldwide' ? colors.primary : colors.textSecondary,
                      fontSize: 11 * textScale,
                    },
                  ]}>
                  All Worldwide
                </Text>
              </Pressable>
            </View>

            {/* Other Region Selector Chips if in other_regions mode */}
            {providerBrowseScope === 'other_regions' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.customRegionLabel, { color: colors.textSecondary, fontSize: 11 * textScale, marginBottom: 6 }]}>
                  SELECT REGION TO BROWSE SERVICES:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionPillsScroll}>
                  {POPULAR_REGIONS.map((r) => {
                    const isSelected = providerBrowsedOtherRegion === r.code;
                    return (
                      <Pressable
                        key={`browse-other-${r.code}`}
                        style={[
                          styles.regionChip,
                          {
                            backgroundColor: isSelected ? colors.primaryBg : colors.inputBg,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          setProviderBrowsedOtherRegion(r.code);
                        }}>
                        <Text style={[styles.regionChipCode, { color: isSelected ? colors.primary : colors.text, fontSize: 12 * textScale }]}>
                          {r.code}
                        </Text>
                        <Text style={[styles.regionChipName, { color: colors.textSecondary, fontSize: 10 * textScale }]}>
                          {r.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Search Filter Bar */}
            <View style={[styles.providerSearchBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <Ionicons name="search" size={14 * textScale} color={colors.textSecondary} />
              <TextInput
                style={[styles.providerSearchInput, { color: colors.text, fontSize: 12 * textScale }]}
                placeholder="Filter providers by name..."
                placeholderTextColor={colors.textMuted}
                value={providerSearchQuery}
                onChangeText={setProviderSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {providerSearchQuery.length > 0 && (
                <Pressable onPress={() => setProviderSearchQuery('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={16 * textScale} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>

            {/* Subscriptions Header with Select All / Select None */}
            <View style={styles.subSectionHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary, marginBottom: 2 }]}>
                  MY SUBSCRIBED SERVICES ({mySubscribedProviders.length})
                </Text>
                <Text style={[styles.subControlSubtext, dynTypography.subControlSubtext, { color: colors.textMuted }]}>
                  Showing {filteredCatalogProviders.length} {providerBrowseScope === 'all_worldwide' ? 'worldwide' : `in ${providerBrowseScope === 'set_region' ? selectedRegion : providerBrowsedOtherRegion}`}
                </Text>
              </View>
              <View style={styles.quickSelectActions}>
                <Pressable
                  style={[styles.smallActionBtn, dynTypography.smallActionBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
                  onPress={() => {
                    triggerHaptic('selection');
                    const targetIds = filteredCatalogProviders.map((p) => p.id);
                    const combined = new Set([...mySubscribedProviders, ...targetIds]);
                    void setMySubscribedProviders(Array.from(combined));
                  }}>
                  <Text style={[styles.smallActionBtnText, dynTypography.smallActionBtnText, { color: colors.primary }]}>Select All</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallActionBtn, dynTypography.smallActionBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
                  onPress={() => {
                    triggerHaptic('selection');
                    const targetIds = new Set(filteredCatalogProviders.map((p) => p.id));
                    void setMySubscribedProviders(mySubscribedProviders.filter((id) => !targetIds.has(id)));
                  }}>
                  <Text style={[styles.smallActionBtnText, dynTypography.smallActionBtnText, { color: colors.textSecondary }]}>Select None</Text>
                </Pressable>
              </View>
            </View>

            {/* Provider Grid in Scrollable Container */}
            {isLoadingProviders ? (
              <View style={{ padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: 12 * textScale }}>Loading TMDB provider catalog...</Text>
              </View>
            ) : filteredCatalogProviders.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 * textScale, textAlign: 'center' }}>
                  No providers found matching &ldquo;{providerSearchQuery}&rdquo;
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 420 }}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingVertical: 4 }}>
                <View style={styles.providersGrid}>
                  {filteredCatalogProviders.map((prov) => {
                    const isSubscribed = mySubscribedProviders.includes(prov.id);
                    const logoUrl = TMDBService.getImageUrl(prov.logoPath, 'w92');

                    return (
                      <Pressable
                        key={`my-prov-${prov.id}`}
                        style={[
                          styles.providerSelectCard,
                          {
                            backgroundColor: isSubscribed ? colors.primaryBg : colors.inputBg,
                            borderColor: isSubscribed ? colors.primary : colors.cardBorder,
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          void toggleSubscribedProvider(prov.id);
                        }}
                        onLongPress={() => {
                          triggerHaptic('impact');
                          setSelectedEntityForModal({
                            type: 'provider',
                            id: prov.id,
                            name: prov.name,
                            profilePath: prov.logoPath,
                          });
                        }}>
                        <View style={styles.providerCardHeader}>
                          {logoUrl ? (
                            <Image source={{ uri: logoUrl }} style={[styles.providerGridLogo, dynTypography.providerGridLogo]} contentFit="cover" />
                          ) : (
                            <View style={[styles.providerGridLogo, dynTypography.providerGridLogo, { backgroundColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' }]}>
                              <Ionicons name="tv-outline" size={Math.round(16 * providerScale)} color={colors.textSecondary} />
                            </View>
                          )}
                          <View
                            style={[
                              styles.providerCheckbox,
                              {
                                backgroundColor: isSubscribed ? colors.primary : 'transparent',
                                borderColor: isSubscribed ? colors.primary : colors.cardBorder,
                              },
                            ]}>
                            {isSubscribed && <Ionicons name="checkmark" size={11} color="#ffffff" />}
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.providerGridName,
                            {
                              color: isSubscribed ? colors.primary : colors.text,
                              fontSize: Math.max(10, Math.round(11 * textScale)),
                            },
                          ]}
                          numberOfLines={2}>
                          {prov.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            <Text style={[styles.providerHoldHint, { color: colors.textMuted, fontSize: 10 * textScale }]}>
              Tap service card to checkmark subscription • Hold down to inspect service details & catalog
            </Text>
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* 3. HAPTIC FEEDBACK & TACTILE RESPONSES */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('haptics')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="hardware-chip-outline" size={Math.round(20 * headerScale)} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, dynTypography.cardTitle, { color: colors.text }]}>Haptic Feedback</Text>
              <Text style={[styles.accordionSubtitle, dynTypography.accordionSubtitle, { color: colors.textSecondary }]}>
                Intensity: {hapticIntensity === 'off' ? 'Off' : `${hapticIntensity.toUpperCase()} (${hapticIntensity === 'light' ? '•' : hapticIntensity === 'medium' ? '••' : '•••'})`}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.haptics ? 'chevron-up' : 'chevron-down'}
            size={Math.round(18 * headerScale)}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.haptics && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary }]}>
              Control tactile vibrations for button presses, status updates, episode checkmarks, and rewatch steppers. Tap any level to test.
            </Text>

            <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary }]}>FEEDBACK INTENSITY</Text>
            <View style={[styles.modeSegmentContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              {(
                [
                  { id: 'off', label: 'Off', dots: 0 },
                  { id: 'light', label: 'Light', dots: 1 },
                  { id: 'medium', label: 'Medium', dots: 2 },
                  { id: 'heavy', label: 'Heavy', dots: 3 },
                ] as const
              ).map((opt) => {
                const isSelected = hapticIntensity === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.modeSegmentBtn,
                      dynTypography.modeSegmentBtn,
                      isSelected && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                    ]}
                    onPress={() => {
                      void setHapticIntensity(opt.id);
                    }}>
                    {opt.dots === 0 ? (
                      <Ionicons
                        name="close-circle-outline"
                        size={Math.round(14 * buttonScale)}
                        color={isSelected ? '#ffffff' : colors.textSecondary}
                      />
                    ) : (
                      <View style={styles.hapticDotsRow}>
                        {Array.from({ length: opt.dots }).map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.hapticDot,
                              { backgroundColor: isSelected ? '#ffffff' : colors.textSecondary },
                            ]}
                          />
                        ))}
                      </View>
                    )}
                    <Text
                      style={[
                        styles.modeSegmentText,
                        dynTypography.modeSegmentText,
                        { color: isSelected ? '#ffffff' : colors.textSecondary },
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.hapticHintRow, { backgroundColor: colors.cardSelected, borderColor: colors.cardBorder }]}>
              <Ionicons name="information-circle-outline" size={Math.round(16 * textScale)} color={colors.primary} />
              <Text style={[styles.hapticHintText, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                {hapticIntensity === 'off'
                  ? 'Tactile feedback is completely disabled.'
                  : hapticIntensity === 'light'
                  ? 'Gentle subtle clicks on taps and toggles.'
                  : hapticIntensity === 'medium'
                  ? 'Standard balanced tactile feel for key interactions (Default).'
                  : 'Strong, distinct vibrations for maximum tactile response.'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* 4. DATE & TIME DISPLAY FORMAT PREFERENCES */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('dates')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="calendar-outline" size={Math.round(20 * headerScale)} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, dynTypography.cardTitle, { color: colors.text }]}>Date & Time Format</Text>
              <Text style={[styles.accordionSubtitle, dynTypography.accordionSubtitle, { color: colors.textSecondary }]}>
                {dateFormat} • {timeFormat === '24h' ? '24-Hour (21:00)' : '12-Hour (09:00 PM)'}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.dates ? 'chevron-up' : 'chevron-down'}
            size={Math.round(18 * headerScale)}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.dates && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary }]}>
              Choose your preferred format for dates displayed across BingeLog (started dates, completion dates, episode air dates, and timeline logs).
            </Text>

            <View style={styles.dateFormatList}>
              {DATE_FORMAT_OPTIONS.map((opt) => {
                const isSelected = dateFormat === opt.id;
                const liveSample = getTodayFormatted(opt.id);
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.dateFormatOptionRow,
                      {
                        backgroundColor: isSelected ? colors.cardSelected : colors.inputBg,
                        borderColor: isSelected ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      void setDateFormat(opt.id);
                    }}>
                    <View style={styles.dateFormatTextContainer}>
                      <View style={styles.dateFormatTitleRow}>
                        <Text style={[styles.dateFormatName, { color: colors.text, fontSize: 13.5 * textScale }]}>{opt.label}</Text>
                        <View style={[styles.dateFormatBadge, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                          <Text style={[styles.dateFormatBadgeText, { color: colors.primary, fontSize: 10.5 * textScale }]}>
                            {opt.description}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.dateFormatSample, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                        Today: <Text style={{ color: colors.primary, fontWeight: '700' }}>{liveSample}</Text>
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor: isSelected ? colors.primary : colors.cardBorder,
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                        },
                      ]}>
                      {isSelected && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Time / Clock Display Format Selector */}
            <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary, marginTop: 18 }]}>
              TIME DISPLAY FORMAT
            </Text>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
              Select 24-hour clock (e.g. 21:00) or 12-hour AM/PM format (e.g. 09:00 PM) for notification schedules and release countdowns.
            </Text>
            <View style={[styles.modeSegmentContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <Pressable
                style={[
                  styles.modeSegmentBtn,
                  dynTypography.modeSegmentBtn,
                  timeFormat === '24h' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void setTimeFormat('24h');
                }}>
                <Text
                  style={[
                    styles.modeSegmentText,
                    dynTypography.modeSegmentText,
                    { color: timeFormat === '24h' ? '#ffffff' : colors.textSecondary },
                  ]}>
                  24-Hour (21:00)
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modeSegmentBtn,
                  dynTypography.modeSegmentBtn,
                  timeFormat === '12h' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void setTimeFormat('12h');
                }}>
                <Text
                  style={[
                    styles.modeSegmentText,
                    dynTypography.modeSegmentText,
                    { color: timeFormat === '12h' ? '#ffffff' : colors.textSecondary },
                  ]}>
                  12-Hour (09:00 PM)
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* 5. REGION, TIMEZONE & RELEASE REMINDERS SECTION */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('regional')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="globe-outline" size={Math.round(20 * headerScale)} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, dynTypography.cardTitle, { color: colors.text }]}>Region & Timezone</Text>
              <Text style={[styles.accordionSubtitle, dynTypography.accordionSubtitle, { color: colors.textSecondary }]}>
                Region: {selectedRegion} ({regionMode}) | TZ: {selectedTimezone.split('/').pop()?.replace(/_/g, ' ') || selectedTimezone}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.regional ? 'chevron-up' : 'chevron-down'}
            size={Math.round(18 * headerScale)}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.regional && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            {/* Upcoming Release Badges & Reminders Toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, { color: colors.text, fontSize: 13.5 * textScale }]}>Release Countdowns & Badges</Text>
                <Text style={[styles.toggleDescription, dynTypography.cardDescription, { color: colors.textSecondary }]}>
                  Display countdown indicators (e.g. &ldquo;Today&rdquo;, &ldquo;Tomorrow&rdquo;, &ldquo;In 4 days&rdquo;) on unreleased movies and upcoming TV episodes across your watchlist.
                </Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={(val) => {
                  triggerHaptic('selection');
                  void setRemindersEnabled(val);
                }}
                trackColor={{ false: colors.cardBorder, true: colors.primary }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Region Mode Toggle */}
            <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary, marginTop: 16 }]}>
              RELEASE REGION (MOVIES)
            </Text>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
              Determines theatrical and digital premiere dates for movies so release countdowns match your location.
            </Text>
            <View style={[styles.modeSegmentContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <Pressable
                style={[
                  styles.modeSegmentBtn,
                  dynTypography.modeSegmentBtn,
                  regionMode === 'auto' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void setRegionMode('auto');
                }}>
                <Ionicons
                  name="locate-outline"
                  size={Math.round(15 * buttonScale)}
                  color={regionMode === 'auto' ? '#ffffff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeSegmentText,
                    dynTypography.modeSegmentText,
                    { color: regionMode === 'auto' ? '#ffffff' : colors.textSecondary },
                  ]}>
                  Auto (System)
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modeSegmentBtn,
                  dynTypography.modeSegmentBtn,
                  regionMode === 'manual' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void setRegionMode('manual');
                }}>
                <Ionicons
                  name="options-outline"
                  size={Math.round(15 * buttonScale)}
                  color={regionMode === 'manual' ? '#ffffff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeSegmentText,
                    dynTypography.modeSegmentText,
                    { color: regionMode === 'manual' ? '#ffffff' : colors.textSecondary },
                  ]}>
                  Manual Selection
                </Text>
              </Pressable>
            </View>

            {/* Popular Regions Selector */}
            {regionMode === 'manual' && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
                  Selected: <Text style={{ color: colors.primary, fontWeight: '700' }}>{selectedRegion}</Text> - {POPULAR_REGIONS.find((r) => r.code === selectedRegion)?.name || 'Custom'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {POPULAR_REGIONS.map((reg) => {
                    const isSelected = selectedRegion === reg.code;
                    return (
                      <Pressable
                        key={reg.code}
                        style={[
                          styles.regionChip,
                          {
                            backgroundColor: isSelected ? colors.primaryBg : colors.inputBg,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          void setSelectedRegion(reg.code);
                        }}>
                        <Text
                          style={[
                            styles.regionChipCode,
                            { color: isSelected ? colors.primary : colors.text, fontSize: 12 * textScale },
                          ]}>
                          {reg.code}
                        </Text>
                        <Text
                          style={[
                            styles.regionChipName,
                            { color: isSelected ? colors.primary : colors.textSecondary, fontSize: 10 * textScale },
                          ]}>
                          {reg.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={Math.round(14 * textScale)} color={colors.primary} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Timezone Mode Toggle */}
            <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary, marginTop: 20 }]}>
              BROADCAST TIMEZONE (EPISODES & COUNTDOWNS)
            </Text>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
              Adjusts episode broadcast dates and today/tomorrow thresholds to your local clock.
            </Text>
            <View style={[styles.modeSegmentContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <Pressable
                style={[
                  styles.modeSegmentBtn,
                  dynTypography.modeSegmentBtn,
                  timezoneMode === 'auto' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void setTimezoneMode('auto');
                }}>
                <Ionicons
                  name="time-outline"
                  size={Math.round(15 * buttonScale)}
                  color={timezoneMode === 'auto' ? '#ffffff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeSegmentText,
                    dynTypography.modeSegmentText,
                    { color: timezoneMode === 'auto' ? '#ffffff' : colors.textSecondary },
                  ]}>
                  Auto (System)
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modeSegmentBtn,
                  dynTypography.modeSegmentBtn,
                  timezoneMode === 'manual' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void setTimezoneMode('manual');
                }}>
                <Ionicons
                  name="options-outline"
                  size={Math.round(15 * buttonScale)}
                  color={timezoneMode === 'manual' ? '#ffffff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeSegmentText,
                    dynTypography.modeSegmentText,
                    { color: timezoneMode === 'manual' ? '#ffffff' : colors.textSecondary },
                  ]}>
                  Manual Selection
                </Text>
              </Pressable>
            </View>

            {/* Timezones Selector */}
            {timezoneMode === 'manual' && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
                  Active Timezone: <Text style={{ color: colors.primary, fontWeight: '700' }}>{selectedTimezone}</Text>
                </Text>
                <View style={{ gap: 6 }}>
                  {POPULAR_TIMEZONES.map((tz) => {
                    const isSelected = selectedTimezone === tz.id;
                    return (
                      <Pressable
                        key={tz.id}
                        style={[
                          styles.tzRow,
                          {
                            backgroundColor: isSelected ? colors.primaryBg : colors.inputBg,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          void setSelectedTimezone(tz.id);
                        }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.tzLabel, { color: isSelected ? colors.primary : colors.text, fontSize: 13 * textScale }]}>
                            {tz.label}
                          </Text>
                          <Text style={[styles.tzId, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                            {tz.id}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.radioCircle,
                            {
                              borderColor: isSelected ? colors.primary : colors.cardBorder,
                              backgroundColor: isSelected ? colors.primary : 'transparent',
                            },
                          ]}>
                          {isSelected && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* 6. DEVICE NOTIFICATIONS & REMINDERS SECTION */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('notifications')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="notifications-outline" size={Math.round(20 * headerScale)} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, dynTypography.cardTitle, { color: colors.text }]}>Device Notifications & Alerts</Text>
              <Text style={[styles.accordionSubtitle, dynTypography.accordionSubtitle, { color: colors.textSecondary }]}>
                {deviceNotificationsEnabled
                  ? `Active • ${scheduledNotificationsCount} ${scheduledNotificationsCount === 1 ? 'alert' : 'alerts'} scheduled`
                  : 'Disabled'}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.notifications ? 'chevron-up' : 'chevron-down'}
            size={Math.round(18 * headerScale)}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.notifications && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary }]}>
              Receive local device alerts on release days for unreleased movies and broadcast air days for upcoming TV episodes in your watchlist.
            </Text>

            {/* Master Toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, { color: colors.text, fontSize: 13.5 * textScale }]}>Device Release Alerts</Text>
                <Text style={[styles.toggleDescription, dynTypography.cardDescription, { color: colors.textSecondary }]}>
                  Schedule automatic offline notifications on your device when tracked titles premiere or air.
                </Text>
              </View>
              <Switch
                value={deviceNotificationsEnabled}
                onValueChange={(val) => {
                  triggerHaptic('selection');
                  void setDeviceNotificationsEnabled(val);
                }}
                trackColor={{ false: colors.cardBorder, true: colors.primary }}
                thumbColor="#ffffff"
              />
            </View>

            {deviceNotificationsEnabled && (
              <>
                {/* Permission status banner */}
                {notificationPermissionStatus === 'granted' ? (
                  <View style={[styles.notifPermBanner, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#22c55e" />
                    <View style={styles.notifPermTextWrap}>
                      <Text style={[styles.notifPermTitle, { color: colors.text, fontSize: 13 * textScale }]}>
                        Notification Permissions Active
                      </Text>
                      <Text style={[styles.notifPermDesc, { color: colors.textSecondary, fontSize: 11.5 * textScale }]}>
                        BingeLog is authorized to show release reminders on this device.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.notifPermBanner, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: '#f59e0b' }]}>
                    <Ionicons name="warning-outline" size={20} color="#f59e0b" />
                    <View style={styles.notifPermTextWrap}>
                      <Text style={[styles.notifPermTitle, { color: colors.text, fontSize: 13 * textScale }]}>
                        Notification Permission Needed
                      </Text>
                      <Text style={[styles.notifPermDesc, { color: colors.textSecondary, fontSize: 11.5 * textScale }]}>
                        Your device has not authorized alerts for BingeLog yet.
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.notifPermBtn, dynTypography.smallActionBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        triggerHaptic('selection');
                        void requestNotificationPermission();
                      }}>
                      <Text style={[styles.notifPermBtnText, dynTypography.smallActionBtnText]}>Authorize</Text>
                    </Pressable>
                  </View>
                )}

                {/* Scheduled Reminders Summary Card */}
                <View style={[styles.notifSummaryCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, marginTop: 12 }]}>
                  <View style={styles.notifSummaryHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="calendar-outline" size={Math.round(16 * textScale)} color={colors.primary} />
                      <Text style={[styles.notifSummaryTitle, { color: colors.text, fontSize: 13 * textScale }]}>
                        {scheduledNotificationsCount} {scheduledNotificationsCount === 1 ? 'Alert' : 'Alerts'} Scheduled
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.refreshRemindersBtn, dynTypography.smallActionBtn, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                      onPress={() => {
                        triggerHaptic('selection');
                        void refreshScheduledNotifications().then(() => {
                          triggerHaptic('success');
                        });
                      }}>
                      <Ionicons name="sync-outline" size={Math.round(13 * buttonScale)} color={colors.primary} />
                      <Text style={[styles.refreshRemindersBtnText, dynTypography.smallActionBtnText, { color: colors.primary }]}>Sync</Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.notifSummaryDesc, dynTypography.cardDescription, { color: colors.textSecondary }]}>
                    Alerts are configured individually per title or episode. Tap any upcoming media in details or an unreleased episode in its detail modal to set or manage its alert timing.
                  </Text>
                </View>

                {/* Default Alert Timing Strategy */}
                <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary, marginTop: 16 }]}>
                  DEFAULT ALERT STRATEGY
                </Text>
                <Pressable
                  style={[styles.dropdownTrigger, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setShowTimingStrategyModal(true);
                  }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.dropdownTriggerTitle, { color: colors.text, fontSize: 13.5 * textScale }]}>
                      {currentGlobalTimingConfig.label}
                    </Text>
                    <Text style={[styles.dropdownTriggerDesc, dynTypography.cardDescription, { color: colors.textSecondary }]}>
                      {currentGlobalTimingConfig.description}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={Math.round(18 * buttonScale)} color={colors.textSecondary} />
                </Pressable>

                {/* Test Notification Button */}
                <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary, marginTop: 16 }]}>
                  VERIFICATION & TESTING
                </Text>
                <Pressable
                  style={[
                    styles.testNotifBtn,
                    dynTypography.presetBtn,
                    { backgroundColor: colors.cardSelected, borderColor: colors.primary },
                  ]}
                  onPress={() => handleSendTestNotification(10)}
                  disabled={isSendingTestNotif}>
                  {isSendingTestNotif ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={Math.round(16 * buttonScale)} color={colors.primary} />
                      <Text style={[styles.testNotifBtnText, dynTypography.presetBtnText, { color: colors.primary }]}>
                        Send Test Notification (10s Delay)
                      </Text>
                    </>
                  )}
                </Pressable>
                <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textMuted, marginTop: 6 }]}>
                  Schedules a test alert 10 seconds from now. Tap this button and immediately lock your phone or switch to another app to verify background delivery, lock screen banners, and sound while BingeLog is closed.
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* 7. TMDB API KEY SECTION */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('api')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="key" size={Math.round(20 * headerScale)} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, dynTypography.cardTitle, { color: colors.text }]}>TMDB API Configuration</Text>
              <Text style={[styles.accordionSubtitle, dynTypography.accordionSubtitle, { color: colors.textSecondary }]}>
                Status: {apiKey ? 'Configured & Active' : 'API Key Missing'}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.api ? 'chevron-up' : 'chevron-down'}
            size={Math.round(18 * headerScale)}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.api && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary }]}>
              Enter your TMDB API Key (v3) or API Read Access Token (v4). It is saved locally on your device and never shared.
            </Text>

            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <TextInput
                style={[styles.input, { color: colors.text, fontSize: 13 * textScale }]}
                placeholder="Paste your TMDB key or token here..."
                placeholderTextColor={colors.textMuted}
                value={inputKey}
                onChangeText={(text) => {
                  setCustomKey(text);
                  setTestResult(null);
                }}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowKey(!showKey)}>
                <Ionicons
                  name={showKey ? 'eye-off-outline' : 'eye-outline'}
                  size={Math.round(18 * buttonScale)}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {testResult && (
              <View
                style={[
                  styles.testResultBox,
                  testResult.valid ? styles.testResultSuccess : styles.testResultError,
                ]}>
                <Ionicons
                  name={testResult.valid ? 'checkmark-circle' : 'alert-circle'}
                  size={Math.round(16 * textScale)}
                  color={testResult.valid ? '#22c55e' : '#ef4444'}
                />
                <Text
                  style={[
                    styles.testResultText,
                    { fontSize: 12 * textScale },
                    testResult.valid ? styles.testResultSuccessText : styles.testResultErrorText,
                  ]}>
                  {testResult.message}
                </Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.saveBtn, dynTypography.presetBtn, { backgroundColor: colors.primary }, isTesting && styles.btnDisabled]}
                onPress={handleSaveKey}
                disabled={isTesting}>
                {isTesting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-sharp" size={Math.round(16 * buttonScale)} color="#ffffff" />
                    <Text style={[styles.saveBtnText, dynTypography.presetBtnText]}>Verify & Save Key</Text>
                  </>
                )}
              </Pressable>

              {apiKey && (
                <Pressable
                  style={[styles.removeBtn, dynTypography.presetBtn]}
                  onPress={handleRemoveKey}>
                  <Ionicons name="trash-outline" size={Math.round(16 * buttonScale)} color="#ef4444" />
                  <Text style={[styles.removeBtnText, dynTypography.presetBtnText]}>Remove</Text>
                </Pressable>
              )}
            </View>

            {/* Guide: How to get TMDB Key */}
            <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 14 }]} />
            <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary }]}>HOW TO GET A FREE KEY</Text>
            <View style={styles.stepList}>
              <View style={styles.stepItem}>
                <Text style={[styles.stepNumber, { backgroundColor: colors.inputBg, color: colors.primary }]}>1</Text>
                <Text style={[styles.stepText, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                  Go to{' '}
                  <Text
                    style={[styles.bold, { color: colors.primary, textDecorationLine: 'underline' }]}
                    onPress={() => void Linking.openURL('https://www.themoviedb.org')}>
                    themoviedb.org
                  </Text>{' '}
                  and sign up for a free account.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <Text style={[styles.stepNumber, { backgroundColor: colors.inputBg, color: colors.primary }]}>2</Text>
                <Text style={[styles.stepText, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                  Click your avatar in the top-right corner → <Text style={[styles.bold, { color: colors.text }]}>Settings</Text> →{' '}
                  <Text style={[styles.bold, { color: colors.text }]}>API</Text>.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <Text style={[styles.stepNumber, { backgroundColor: colors.inputBg, color: colors.primary }]}>3</Text>
                <Text style={[styles.stepText, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                  Click <Text style={[styles.bold, { color: colors.text }]}>Create</Text> (choose Developer) and accept the terms.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <Text style={[styles.stepNumber, { backgroundColor: colors.inputBg, color: colors.primary }]}>4</Text>
                <Text style={[styles.stepText, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                  Copy your <Text style={[styles.bold, { color: colors.text }]}>API Key (v3)</Text> or <Text style={[styles.bold, { color: colors.text }]}>API Read Access Token</Text> and paste it above.
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* MEDIA INSIGHTS DASHBOARD SECTION */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('insights')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="stats-chart-outline" size={Math.round(20 * headerScale)} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, dynTypography.cardTitle, { color: colors.text }]}>Media Insights Dashboard</Text>
              <Text style={[styles.accordionSubtitle, dynTypography.accordionSubtitle, { color: colors.textSecondary }]}>
                {activeInsightsCount} of {INSIGHT_WIDGET_CATALOG.length} modules active
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.insights ? 'chevron-up' : 'chevron-down'}
            size={Math.round(18 * headerScale)}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.insights && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary }]}>
              Customize the statistics, deep analytics, and taste profiles rendered on your Media Insights screen. Rearrange module order, toggle visibility, and adjust card widths.
            </Text>

            <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
              <Pressable
                style={[
                  styles.backupBtn,
                  dynTypography.presetBtn,
                  { flex: 1, backgroundColor: colors.primaryBg, borderColor: colors.primary, paddingHorizontal: 10 },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setShowInsightsCustomizer(true);
                }}>
                <Ionicons name="options-outline" size={Math.round(16 * buttonScale)} color={colors.primary} />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[styles.backupBtnText, dynTypography.presetBtnText, { color: colors.primary, flexShrink: 1 }]}>
                  Customize Insights
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.backupBtn,
                  dynTypography.presetBtn,
                  { flex: 0, minWidth: 90, backgroundColor: colors.inputBg, borderColor: colors.cardBorder, paddingHorizontal: 16 },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void resetInsightsLayout();
                }}>
                <Ionicons name="refresh-outline" size={Math.round(16 * buttonScale)} color={colors.textSecondary} />
                <Text style={[styles.backupBtnText, dynTypography.presetBtnText, { color: colors.textSecondary }]}>
                  Reset
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Storage & Data Section */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('storage')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="server" size={Math.round(20 * headerScale)} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, dynTypography.cardTitle, { color: colors.text }]}>Storage & Data Management</Text>
              <Text style={[styles.accordionSubtitle, dynTypography.accordionSubtitle, { color: colors.textSecondary }]}>
                {storageMetrics ? `${formatBytes(storageMetrics.totalAppStorageBytes)} • ${trackedItems.length} items` : `${trackedItems.length} items`}
              </Text>
            </View>
          </View>
          <View style={styles.accordionRight}>
            <Pressable
              style={[styles.refreshStorageBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
              onPress={(e) => {
                e.stopPropagation();
                void loadStorageMetrics();
              }}
              disabled={isLoadingStorageMetrics}>
              {isLoadingStorageMetrics ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="refresh-outline" size={Math.round(16 * buttonScale)} color={colors.primary} />
              )}
            </Pressable>
            <Ionicons
              name={expandedSections.storage ? 'chevron-up' : 'chevron-down'}
              size={Math.round(18 * headerScale)}
              color={colors.textSecondary}
            />
          </View>
        </Pressable>

        {expandedSections.storage && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, dynTypography.cardDescription, { color: colors.textSecondary }]}>
              Inspect internal device capacity, local tracking database usage, and cached media assets.
            </Text>

            {/* Device Internal Storage Gauge */}
            <View style={[styles.deviceStorageBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <View style={styles.deviceStorageHeader}>
                <View style={styles.deviceStorageLabelRow}>
                  <Ionicons name="phone-portrait-outline" size={Math.round(16 * textScale)} color={colors.primary} />
                  <Text style={[styles.deviceStorageTitle, { color: colors.text, fontSize: 13 * textScale }]}>Internal Storage</Text>
                </View>
                <Text style={[styles.deviceStoragePercent, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                  {storageMetrics?.deviceTotalBytes ? `${storageMetrics.deviceUsedPercent}% used` : 'Calculating...'}
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={[styles.storageBarTrack, { backgroundColor: colors.cardBorder }]}>
                <View
                  style={[
                    styles.storageBarFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${Math.min(100, Math.max(2, storageMetrics?.deviceUsedPercent || 0))}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.deviceStorageFooter}>
                <Text style={[styles.deviceStorageFootText, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                  {storageMetrics?.deviceTotalBytes
                    ? `${formatBytes(storageMetrics.deviceUsedBytes)} used of ${formatBytes(storageMetrics.deviceTotalBytes)}`
                    : 'Reading device storage...'}
                </Text>
                <Text style={[styles.deviceStorageFootText, { color: colors.primary, fontWeight: '700', fontSize: 11 * textScale }]}>
                  {storageMetrics?.deviceFreeBytes
                    ? `${formatBytes(storageMetrics.deviceFreeBytes)} free`
                    : ''}
                </Text>
              </View>
            </View>

            {/* BingeLog Data Breakdown */}
            <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary, marginTop: 14 }]}>
              BINGELOG STORAGE BREAKDOWN
            </Text>

            <View style={[styles.breakdownContainer, { borderColor: colors.cardBorder }]}>
              {/* Saved Media Library */}
              <View style={[styles.breakdownRow, { borderBottomColor: colors.cardBorder }]}>
                <View style={styles.breakdownIconWrap}>
                  <Ionicons name="film-outline" size={Math.round(18 * textScale)} color={colors.primary} />
                </View>
                <View style={styles.breakdownTextWrap}>
                  <Text style={[styles.breakdownTitle, { color: colors.text, fontSize: 13 * textScale }]}>Tracked Library</Text>
                  <Text style={[styles.breakdownSubtitle, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                    {trackedItems.length} {trackedItems.length === 1 ? 'item' : 'items'} saved with watch progress
                  </Text>
                </View>
                <Text style={[styles.breakdownSize, { color: colors.text, fontSize: 12 * textScale }]}>
                  {formatBytes(storageMetrics?.librarySizeBytes || 0)}
                </Text>
              </View>

              {/* Preferences & Config */}
              <View style={[styles.breakdownRow, { borderBottomColor: colors.cardBorder }]}>
                <View style={styles.breakdownIconWrap}>
                  <Ionicons name="options-outline" size={Math.round(18 * textScale)} color={colors.primary} />
                </View>
                <View style={styles.breakdownTextWrap}>
                  <Text style={[styles.breakdownTitle, { color: colors.text, fontSize: 13 * textScale }]}>Settings & Themes</Text>
                  <Text style={[styles.breakdownSubtitle, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                    UI scales, display toggles, custom theme
                  </Text>
                </View>
                <Text style={[styles.breakdownSize, { color: colors.text, fontSize: 12 * textScale }]}>
                  {formatBytes(storageMetrics?.configSizeBytes || 0)}
                </Text>
              </View>

              {/* Image & Poster Cache */}
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownIconWrap}>
                  <Ionicons name="image-outline" size={Math.round(18 * textScale)} color={colors.primary} />
                </View>
                <View style={styles.breakdownTextWrap}>
                  <Text style={[styles.breakdownTitle, { color: colors.text, fontSize: 13 * textScale }]}>Image & Poster Cache</Text>
                  <Text style={[styles.breakdownSubtitle, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                    Downloaded posters, backdrops, actor photos
                  </Text>
                </View>
                <Text style={[styles.breakdownSize, { color: colors.text, fontSize: 12 * textScale }]}>
                  {formatBytes(storageMetrics?.imageCacheSizeBytes || 0)}
                </Text>
              </View>
            </View>

            {/* Clear Image Cache Button */}
            <Pressable
              style={[
                styles.clearCacheBtn,
                dynTypography.presetBtn,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                isClearingCache && styles.btnDisabled,
              ]}
              onPress={handleClearImageCache}
              disabled={isClearingCache}>
              {isClearingCache ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="brush-outline" size={Math.round(16 * buttonScale)} color={colors.primary} />
              )}
              <Text style={[styles.clearCacheBtnText, dynTypography.presetBtnText, { color: colors.primary }]}>
                Clear Image Cache
              </Text>
            </Pressable>

            <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 14 }]} />

            {/* Device-to-Device Sync */}
            <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary }]}>
              DEVICE SYNC & TRANSFER
            </Text>
            <Text style={[styles.backupDesc, dynTypography.cardDescription, { color: colors.textSecondary }]}>
              Sync your watchlist directly with your tablet or phone using Instant Relay (6-digit PIN) or Air-Gapped Offline QR.
            </Text>

            <Pressable
              style={[styles.syncDeviceBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
              onPress={() => {
                triggerHaptic('selection');
                setShowSyncModal(true);
              }}>
              <Ionicons name="sync-circle" size={Math.round(24 * buttonScale)} color={colors.primary} />
              <View style={styles.syncDeviceBtnTextWrap}>
                <Text style={[styles.syncDeviceBtnTitle, { color: colors.primary, fontSize: 14 * textScale }]}>Sync with Nearby Device</Text>
                <Text style={[styles.syncDeviceBtnSub, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                  Instant 6-digit relay • Offline camera QR
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={Math.round(16 * textScale)} color={colors.primary} />
            </Pressable>

            <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 14 }]} />

            {/* Backup & Restore Section */}
            <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: colors.textSecondary }]}>
              BACKUP & RESTORE
            </Text>
            <Text style={[styles.backupDesc, dynTypography.cardDescription, { color: colors.textSecondary }]}>
              Export your watchlist, ratings, reviews, and progress to an offline JSON file, or restore from a previous backup.
            </Text>

            <View style={styles.backupButtonsRow}>
              <Pressable
                style={[
                  styles.backupBtn,
                  dynTypography.presetBtn,
                  { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                  (isExporting || trackedItems.length === 0) && styles.btnDisabled,
                ]}
                onPress={handleExportBackup}
                disabled={isExporting || trackedItems.length === 0}>
                {isExporting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="share-outline" size={Math.round(16 * buttonScale)} color={colors.primary} />
                )}
                <Text style={[styles.backupBtnText, dynTypography.presetBtnText, { color: colors.primary }]}>Export Backup</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.backupBtn,
                  dynTypography.presetBtn,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  isImporting && styles.btnDisabled,
                ]}
                onPress={handleImportBackup}
                disabled={isImporting}>
                {isImporting ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Ionicons name="folder-open-outline" size={Math.round(16 * buttonScale)} color={colors.text} />
                )}
                <Text style={[styles.backupBtnText, dynTypography.presetBtnText, { color: colors.text }]}>Import Backup</Text>
              </Pressable>
            </View>

            <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 14 }]} />

            {/* Danger Zone: Clear All Tracked Data */}
            <Text style={[styles.subControlLabel, dynTypography.subControlLabel, { color: '#ef4444' }]}>DANGER ZONE</Text>
            <Pressable
              style={[
                styles.clearBtn,
                dynTypography.presetBtn,
                trackedItems.length === 0 && styles.btnDisabled,
              ]}
              onPress={handleClearAllData}
              disabled={trackedItems.length === 0}>
              <Ionicons name="trash-outline" size={Math.round(16 * buttonScale)} color="#ef4444" />
              <Text style={[styles.clearBtnText, dynTypography.presetBtnText]}>Clear All Tracked Data</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* 8. ABOUT & LEGAL ATTRIBUTIONS SECTION */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('about')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, dynTypography.cardTitle, { color: colors.text }]}>About & Disclaimers</Text>
              <Text style={[styles.accordionSubtitle, dynTypography.accordionSubtitle, { color: colors.textSecondary }]}>
                Version 0.23.1 • TMDB & MAL Attributions
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.about ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.about && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            {/* App Info & Vibe-Coded Badge */}
            <View style={styles.appTitleBadgeRow}>
              <Text selectable style={[styles.infoTitle, { color: colors.text }]}>BingeLog</Text>
              <View style={[styles.vibeBadge, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                <Ionicons name="sparkles" size={11} color={colors.primary} />
                <Text style={[styles.vibeBadgeText, { color: colors.primary }]}>Vibe-Coded</Text>
              </View>
            </View>

            <Text selectable style={[styles.infoSub, { color: colors.textSecondary }]}>
              Independent media tracker for Movies & TV Shows.
            </Text>

            <Text selectable style={[styles.infoAiCredit, { color: colors.textSecondary }]}>
              Crafted with Google DeepMind Antigravity & Gemini assistance and vibe-coded with care as an independent personal tracking project.
            </Text>

            {/* GitHub Project Link */}
            <Pressable
              style={({ pressed }) => [
                styles.githubButton,
                {
                  backgroundColor: colors.cardSelected,
                  borderColor: colors.cardBorder,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={() => void Linking.openURL('https://github.com/bit-hero-333/BingeLog')}>
              <View style={[styles.githubIconBadge, { backgroundColor: colors.card }]}>
                <Ionicons name="logo-github" size={18} color={colors.text} />
              </View>
              <View style={styles.githubButtonTextCol}>
                <Text style={[styles.githubButtonTitle, { color: colors.text }]}>
                  GitHub Repository
                </Text>
                <Text style={[styles.githubButtonSub, { color: colors.textSecondary }]}>
                  bit-hero-333/BingeLog • Source & Releases
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.primary} />
            </Pressable>

            <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 12 }]} />

            {/* TMDB Legal Attribution */}
            <View style={styles.tmdbAttributionHeader}>
              <Image
                source={require('@/assets/images/tmdb/tmdb-logo-short.png')}
                style={styles.tmdbLogoImage}
                contentFit="contain"
              />
            </View>

            <Text selectable style={[styles.tmdbLegalText, { color: colors.textSecondary }]}>
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </Text>

            <View style={styles.tmdbMetaRow}>
              <Ionicons name="film-outline" size={14} color={colors.primary} />
              <Text selectable style={[styles.tmdbMetaText, { color: colors.textMuted }]}>
                All movie and TV metadata, posters, backdrops, and cast information are provided courtesy of{' '}
                <Text
                  style={{ color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' }}
                  onPress={() => void Linking.openURL('https://www.themoviedb.org')}>
                  The Movie Database (TMDB)
                </Text>.
              </Text>
            </View>

            <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, width: '100%', marginVertical: 12 }]} />

            <Text selectable style={[styles.disclaimerText, { color: colors.textMuted }]}>
              Independent hobby project. Not affiliated with, endorsed by, or associated with{' '}
              <Text
                style={{ color: colors.primary, textDecorationLine: 'underline' }}
                onPress={() => void Linking.openURL('https://myanimelist.net')}>
                MyAnimeList (MAL)
              </Text>{' '}
              or{' '}
              <Text
                style={{ color: colors.primary, textDecorationLine: 'underline' }}
                onPress={() => void Linking.openURL('https://www.themoviedb.org')}>
                The Movie Database (TMDB)
              </Text>. All trademarks, logos, and copyrights belong to their respective owners.
            </Text>

            <Text selectable style={[styles.infoVersion, { color: colors.primary, fontSize: 11 * textScale }]}>
              Version 0.23.1 • Build 48 • Expo SDK 57
            </Text>
          </View>
        )}
      </View>

      {/* Device-to-Device Sync Modal */}
      <SyncModal
        visible={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onSyncComplete={() => {
          void AchievementsEngine.recordExtraStat('syncCount');
          void getStorageMetrics(trackedItems.length).then((metrics) => setStorageMetrics(metrics));
        }}
      />

      {/* Provider Details Sheet */}
      <EntityModal
        visible={!!selectedEntityForModal}
        entity={selectedEntityForModal}
        onClose={() => setSelectedEntityForModal(null)}
        onFilterInDiscover={(filter) => {
          setSelectedEntityForModal(null);
          router.push({
            pathname: '/(tabs)/discover',
            params: {
              filterType: filter.type,
              filterId: String(filter.id),
              filterName: filter.name,
            },
          });
        }}
      />

      {/* Media Insights Customizer Modal */}
      <CustomizeInsightsModal
        visible={showInsightsCustomizer}
        onClose={() => setShowInsightsCustomizer(false)}
      />

      {/* Global Strategy Selection Modal */}
      <Modal
        visible={showTimingStrategyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimingStrategyModal(false)}>
        <View style={styles.dialogOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setShowTimingStrategyModal(false)} />
          <View style={[styles.strategySheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.strategyHeader, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.strategyHeaderTitle, { color: colors.text }]}>Default Alert Strategy</Text>
              <Pressable onPress={() => setShowTimingStrategyModal(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.strategyScroll} showsVerticalScrollIndicator={false}>
              {NOTIFICATION_TIMING_CONFIGS.map((config) => {
                const isSelected = currentGlobalTimingConfig.id === config.id;
                return (
                  <Pressable
                    key={config.id}
                    style={[
                      styles.strategyOptionItem,
                      { borderBottomColor: colors.divider },
                      isSelected && { backgroundColor: colors.cardSelected },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      void setNotificationTiming(config.id);
                      setShowTimingStrategyModal(false);
                    }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={[styles.strategyOptionTitle, { color: isSelected ? colors.primary : colors.text }]}>
                        {config.label}
                      </Text>
                      <Text style={[styles.strategyOptionDesc, { color: colors.textSecondary }]}>
                        {config.description}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={20} color={colors.cardBorder} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  dropdownTriggerTitle: {
    fontWeight: '700',
  },
  dropdownTriggerDesc: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  strategyHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  strategySheet: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  strategyScroll: {
    maxHeight: 460,
  },
  strategyOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  strategyOptionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  strategyOptionDesc: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },

  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  settingsOverviewText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  toggleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  toggleAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  accordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accordionTextGroup: {
    flex: 1,
  },
  accordionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  accordionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionContent: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  cardDivider: {
    height: 1,
    marginVertical: 14,
  },
  subControlLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  modeSegmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 6,
  },
  modeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modeSegmentBtnActive: {},
  modeSegmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  presetsGrid: {
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  presetColorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 32,
    height: 32,
    position: 'relative',
    justifyContent: 'center',
  },
  presetBgDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  presetAccentDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  presetChipContent: {
    flex: 1,
  },
  presetChipLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  presetChipDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  accentPaletteScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
  },
  paletteCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteCircleChosen: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  hexInputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  hexBox: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  hexTextInput: {
    fontSize: 13,
    fontWeight: '700',
  },
  hexApplyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  hexApplyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  themeLivePreviewBox: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  previewToggleModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  previewToggleModeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  previewComponentsColumn: {
    gap: 10,
  },
  sampleMediaCardPreview: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    alignItems: 'center',
  },
  samplePosterThumb: {
    width: 36,
    height: 50,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleMediaInfo: {
    flex: 1,
  },
  sampleMediaTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  sampleBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sampleStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sampleStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sampleRatingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sampleRatingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sampleButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  samplePrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  samplePrimaryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sampleSecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  sampleSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resetThemeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
  },
  resetThemeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  presetButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  presetBtnActive: {},
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  presetBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  sliderControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  sliderInfo: {
    flex: 1,
    marginRight: 12,
  },
  sliderTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  sliderValueText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 6,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.3,
  },
  stepLevelPipContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
  },
  stepPip: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepPipActive: {},
  previewBox: {
    marginTop: 14,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  previewBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  previewTagRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  sampleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  sampleTagText: {
    fontWeight: '600',
  },
  sampleSynopsis: {
    lineHeight: 18,
    marginBottom: 10,
  },
  sampleCastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sampleCastAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleCastName: {
    fontSize: 11,
    fontWeight: '600',
  },
  sampleSeasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  sampleSeasonHeaderText: {
    fontWeight: '700',
    flex: 1,
  },
  sampleSeasonMeta: {
    fontSize: 11,
  },
  sampleEpisodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  sampleCheckbox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  sampleStillThumb: {
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleEpisodeText: {
    flex: 1,
    fontWeight: '600',
  },
  sampleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sampleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 13,
  },
  eyeBtn: {
    padding: 6,
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  testResultSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  testResultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  testResultText: {
    fontSize: 12,
    flex: 1,
  },
  testResultSuccessText: {
    color: '#22c55e',
  },
  testResultErrorText: {
    color: '#ef4444',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  removeBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  stepList: {
    gap: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 11,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  dataLabel: {
    fontSize: 14,
  },
  dataValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  clearBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  refreshStorageBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceStorageBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 4,
  },
  deviceStorageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceStorageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceStorageTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  deviceStoragePercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  storageBarTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 8,
  },
  storageBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  deviceStorageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceStorageFootText: {
    fontSize: 11,
  },
  breakdownContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  breakdownIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  breakdownTextWrap: {
    flex: 1,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  breakdownSize: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  clearCacheBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  clearCacheBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  backupDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 10,
  },
  backupButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  backupBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  tmdbAttributionHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginBottom: 6,
  },
  tmdbLogoImage: {
    width: 140,
    height: 24,
  },
  tmdbLegalText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  tmdbMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  tmdbMetaText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  appTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  vibeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  vibeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  infoSub: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  infoAiCredit: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  disclaimerText: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  infoVersion: {
    fontSize: 11,
    marginTop: 10,
    fontWeight: '700',
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  githubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
  },
  githubIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  githubButtonTextCol: {
    flex: 1,
  },
  githubButtonTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  githubButtonSub: {
    fontSize: 11,
    marginTop: 1,
  },
  hapticDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 14,
  },
  hapticDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  hapticHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  hapticHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  dateFormatList: {
    gap: 8,
    marginTop: 6,
  },
  dateFormatOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateFormatTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  dateFormatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  dateFormatName: {
    fontSize: 14,
    fontWeight: '700',
  },
  dateFormatBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  dateFormatBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dateFormatSample: {
    fontSize: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  syncDeviceBtnTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  syncDeviceBtnTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  syncDeviceBtnSub: {
    fontSize: 11,
    marginTop: 2,
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  regionChipCode: {
    fontSize: 12,
    fontWeight: '700',
  },
  regionChipName: {
    fontSize: 12,
  },
  tzRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  tzLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tzId: {
    fontSize: 11,
    marginTop: 2,
  },
  notifPermBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    gap: 10,
  },
  notifPermTextWrap: {
    flex: 1,
  },
  notifPermTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  notifPermDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  notifPermBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  notifPermBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  notifSummaryCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
    gap: 6,
  },
  notifSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  notifSummaryDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  refreshRemindersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  refreshRemindersBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  testNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  testNotifBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  notifAdvanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  notifAdvanceChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  notifAdvanceChipActive: {
    borderWidth: 1.5,
  },
  notifAdvanceChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  notifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  notifHourChip: {
    width: '31%',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  notifHourChipActive: {
    borderWidth: 1.5,
  },
  notifHourChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  notifHourChipSub: {
    fontSize: 9.5,
    marginTop: 2,
  },
  notifStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  notifStepperLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  notifStepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifStepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifStepperDisplay: {
    minWidth: 70,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notifStepperText: {
    fontSize: 13,
    fontWeight: '700',
  },
  settingsCustomTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  settingsCustomTimeCardActive: {
    borderWidth: 1.5,
  },
  settingsCustomTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  settingsCustomTimeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  settingsCustomTimeSub: {
    fontSize: 11,
    marginTop: 1,
  },
  settingsTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  settingsTimeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dialogOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  customDaysDialog: {
    width: '84%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  customDaysTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  customDaysDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  customDaysInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dialogBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  providerStrategyRow: {
    gap: 8,
    marginBottom: 8,
  },
  strategyBtn: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  strategyRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  strategyBtnTitle: {
    fontWeight: '700',
  },
  strategyBtnDesc: {
    paddingLeft: 26,
  },
  streamingRegionOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  regionStrategyPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  regionStrategyPillText: {
    fontWeight: '700',
  },
  customRegionContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  customRegionLabel: {
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  regionPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  subSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subControlSubtext: {
    marginTop: 2,
  },
  quickSelectActions: {
    flexDirection: 'row',
    gap: 6,
  },
  smallActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  smallActionBtnText: {
    fontWeight: '700',
  },
  providersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  providerSelectCard: {
    width: '31%',
    flexGrow: 1,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  providerCardHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  providerGridLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  providerCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerGridName: {
    fontWeight: '600',
    textAlign: 'center',
  },
  providerScopeTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  providerScopeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  providerScopeTabText: {
    fontWeight: '700',
  },
  providerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  providerSearchInput: {
    flex: 1,
    padding: 0,
  },
  providerHoldHint: {
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});


