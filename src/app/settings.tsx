import React, { useState, useCallback, useEffect } from 'react';
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
} from '@/constants/theme';
import {
  DensityPreset,
  ElementScale,
  SIZING_PRESETS,
  DATE_FORMAT_OPTIONS,
  POPULAR_REGIONS,
  POPULAR_TIMEZONES,
} from '@/types/media';
import { getTodayFormatted } from '@/utils/date';
import { SyncModal } from '@/components/SyncModal';


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
  } = useMedia();

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

  // Collapsible Accordion Sections State
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    appearance: false,
    sizing: false,
    haptics: false,
    dates: false,
    regional: false,
    api: false,
    storage: false,
    about: false,
  });

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
      haptics: next,
      dates: next,
      regional: next,
      api: next,
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

      if (!res.success && res.message) {
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
    key: 'textSize' | 'castSize' | 'tagSize' | 'rowDensity' | 'seasonEpisodeSize',
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
        <Text style={[styles.settingsOverviewText, { color: colors.textSecondary }]}>
          Preferences & Customization
        </Text>
        <Pressable
          style={[styles.toggleAllBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
          onPress={toggleAllSections}>
          <Ionicons
            name={allExpanded ? 'contract-outline' : 'expand-outline'}
            size={14}
            color={colors.primary}
          />
          <Text style={[styles.toggleAllBtnText, { color: colors.primary }]}>
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
            <Ionicons name="color-palette" size={20} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Appearance & Colors</Text>
              <Text style={[styles.accordionSubtitle, { color: colors.textSecondary }]}>
                {mode === 'dark' ? 'Dark Mode' : 'Light Mode'} • {preset === 'custom' ? 'Custom Accent' : (THEME_PRESET_METAS.find((p) => p.id === preset)?.label || 'Theme')}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.appearance ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.appearance && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Switch between Light and Dark mode, choose from AMOLED and curated nature presets, or pick your own custom accent colors.
            </Text>

        {/* Mode Selector: Dark vs Light */}
        <Text style={[styles.subControlLabel, { color: colors.textSecondary }]}>MODE</Text>
        <View style={[styles.modeSegmentContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <Pressable
            style={[
              styles.modeSegmentBtn,
              mode === 'dark' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setMode('dark')}>
            <Ionicons
              name="moon"
              size={15}
              color={mode === 'dark' ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.modeSegmentText,
                { color: mode === 'dark' ? '#ffffff' : colors.textSecondary },
              ]}>
              Dark Mode
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.modeSegmentBtn,
              mode === 'light' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setMode('light')}>
            <Ionicons
              name="sunny"
              size={16}
              color={mode === 'light' ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.modeSegmentText,
                { color: mode === 'light' ? '#ffffff' : colors.textSecondary },
              ]}>
              Light Mode
            </Text>
          </Pressable>
        </View>

        {/* Curated Presets Grid */}
        <Text style={[styles.subControlLabel, { color: colors.textSecondary, marginTop: 16 }]}>
          COLOR PRESETS
        </Text>
        <View style={styles.presetsGrid}>
          {THEME_PRESET_METAS.map((p) => {
            const isSelected = preset === p.id;
            return (
              <Pressable
                key={p.id}
                style={[
                  styles.presetChip,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  isSelected && { borderColor: colors.primary, backgroundColor: colors.cardSelected },
                ]}
                onPress={() => setPreset(p.id)}>
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
                  <Text
                    style={[
                      styles.presetChipLabel,
                      { color: isSelected ? colors.primary : colors.text },
                    ]}>
                    {p.label}
                  </Text>
                  <Text
                    style={[styles.presetChipDesc, { color: colors.textMuted }]}
                    numberOfLines={1}>
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
              colors.primary.toLowerCase() === item.hex.toLowerCase();

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
            <Ionicons name="resize" size={20} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Element Sizes & Density</Text>
              <Text style={[styles.accordionSubtitle, { color: colors.textSecondary }]}>
                Preset: {sizingConfig.preset?.toUpperCase() || 'CUSTOM'} • Text: {sizingConfig.textSize.toUpperCase()}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.sizing ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.sizing && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Fine-tune element sizes without overlapping or breaking layouts. Choose a preset or adjust sliders below.
            </Text>

        {/* Master Preset Buttons */}
        <Text style={[styles.subControlLabel, { color: colors.textSecondary }]}>MASTER DENSITY PRESETS</Text>
        <View style={styles.presetButtonsRow}>
          {(['compact', 'default', 'large'] as DensityPreset[]).map((p) => {
            const isSelected = sizingConfig.preset === p;
            return (
              <Pressable
                key={p}
                style={[
                  styles.presetBtn,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => handleApplyPreset(p)}>
                <Text
                  style={[
                    styles.presetBtnText,
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

        {/* Slider 1: Synopsis & Description Text Size */}
        <View style={styles.sliderControlRow}>
          <View style={styles.sliderInfo}>
            <Text style={[styles.sliderTitle, { color: colors.text }]}>Synopsis & Text Size</Text>
            <Text style={[styles.sliderValueText, { color: colors.primary }]}>
              {SCALE_LABELS[sizingConfig.textSize]}
            </Text>
          </View>
          <View style={[styles.stepperBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.textSize === 'small' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('textSize', -1)}
              disabled={sizingConfig.textSize === 'small'}>
              <Ionicons name="remove" size={16} color={colors.text} />
            </Pressable>
            <View style={styles.stepLevelPipContainer}>
              {SCALES.map((scale, i) => (
                <View
                  key={scale}
                  style={[
                    styles.stepPip,
                    { backgroundColor: colors.cardBorder },
                    SCALES.indexOf(sizingConfig.textSize) >= i && [styles.stepPipActive, { backgroundColor: colors.primary }],
                  ]}
                />
              ))}
            </View>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.textSize === 'xlarge' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('textSize', 1)}
              disabled={sizingConfig.textSize === 'xlarge'}>
              <Ionicons name="add" size={16} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Slider 2: Cast & Actor Cards Size */}
        <View style={styles.sliderControlRow}>
          <View style={styles.sliderInfo}>
            <Text style={[styles.sliderTitle, { color: colors.text }]}>Cast Cards & Avatars</Text>
            <Text style={[styles.sliderValueText, { color: colors.primary }]}>
              {SCALE_LABELS[sizingConfig.castSize]}
            </Text>
          </View>
          <View style={[styles.stepperBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.castSize === 'small' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('castSize', -1)}
              disabled={sizingConfig.castSize === 'small'}>
              <Ionicons name="remove" size={16} color={colors.text} />
            </Pressable>
            <View style={styles.stepLevelPipContainer}>
              {SCALES.map((scale, i) => (
                <View
                  key={scale}
                  style={[
                    styles.stepPip,
                    { backgroundColor: colors.cardBorder },
                    SCALES.indexOf(sizingConfig.castSize) >= i && [styles.stepPipActive, { backgroundColor: colors.primary }],
                  ]}
                />
              ))}
            </View>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.castSize === 'xlarge' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('castSize', 1)}
              disabled={sizingConfig.castSize === 'xlarge'}>
              <Ionicons name="add" size={16} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Slider 3: Tags & Badge Chips Size */}
        <View style={styles.sliderControlRow}>
          <View style={styles.sliderInfo}>
            <Text style={[styles.sliderTitle, { color: colors.text }]}>Tags & Badges</Text>
            <Text style={[styles.sliderValueText, { color: colors.primary }]}>
              {SCALE_LABELS[sizingConfig.tagSize]}
            </Text>
          </View>
          <View style={[styles.stepperBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.tagSize === 'small' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('tagSize', -1)}
              disabled={sizingConfig.tagSize === 'small'}>
              <Ionicons name="remove" size={16} color={colors.text} />
            </Pressable>
            <View style={styles.stepLevelPipContainer}>
              {SCALES.map((scale, i) => (
                <View
                  key={scale}
                  style={[
                    styles.stepPip,
                    { backgroundColor: colors.cardBorder },
                    SCALES.indexOf(sizingConfig.tagSize) >= i && [styles.stepPipActive, { backgroundColor: colors.primary }],
                  ]}
                />
              ))}
            </View>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.tagSize === 'xlarge' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('tagSize', 1)}
              disabled={sizingConfig.tagSize === 'xlarge'}>
              <Ionicons name="add" size={16} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Slider 4: Episode Rows Density */}
        <View style={styles.sliderControlRow}>
          <View style={styles.sliderInfo}>
            <Text style={[styles.sliderTitle, { color: colors.text }]}>Episode Rows Padding</Text>
            <Text style={[styles.sliderValueText, { color: colors.primary }]}>
              {ROW_SCALE_LABELS[sizingConfig.rowDensity]}
            </Text>
          </View>
          <View style={[styles.stepperBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.rowDensity === 'small' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('rowDensity', -1)}
              disabled={sizingConfig.rowDensity === 'small'}>
              <Ionicons name="remove" size={16} color={colors.text} />
            </Pressable>
            <View style={styles.stepLevelPipContainer}>
              {SCALES.map((scale, i) => (
                <View
                  key={scale}
                  style={[
                    styles.stepPip,
                    { backgroundColor: colors.cardBorder },
                    SCALES.indexOf(sizingConfig.rowDensity) >= i && [styles.stepPipActive, { backgroundColor: colors.primary }],
                  ]}
                />
              ))}
            </View>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.rowDensity === 'xlarge' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('rowDensity', 1)}
              disabled={sizingConfig.rowDensity === 'xlarge'}>
              <Ionicons name="add" size={16} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Slider 5: Season & Episode List Size (NEW) */}
        <View style={styles.sliderControlRow}>
          <View style={styles.sliderInfo}>
            <Text style={[styles.sliderTitle, { color: colors.text }]}>Season & Episode List Size</Text>
            <Text style={[styles.sliderValueText, { color: colors.primary }]}>
              {SCALE_LABELS[sizingConfig.seasonEpisodeSize || 'medium']}
            </Text>
          </View>
          <View style={[styles.stepperBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <Pressable
              style={[
                styles.stepBtn,
                (sizingConfig.seasonEpisodeSize || 'medium') === 'small' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('seasonEpisodeSize', -1)}
              disabled={(sizingConfig.seasonEpisodeSize || 'medium') === 'small'}>
              <Ionicons name="remove" size={16} color={colors.text} />
            </Pressable>
            <View style={styles.stepLevelPipContainer}>
              {SCALES.map((scale, i) => (
                <View
                  key={scale}
                  style={[
                    styles.stepPip,
                    { backgroundColor: colors.cardBorder },
                    SCALES.indexOf(sizingConfig.seasonEpisodeSize || 'medium') >= i && [
                      styles.stepPipActive,
                      { backgroundColor: colors.primary },
                    ],
                  ]}
                />
              ))}
            </View>
            <Pressable
              style={[
                styles.stepBtn,
                (sizingConfig.seasonEpisodeSize || 'medium') === 'xlarge' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('seasonEpisodeSize', 1)}
              disabled={(sizingConfig.seasonEpisodeSize || 'medium') === 'xlarge'}>
              <Ionicons name="add" size={16} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Live Interactive Sizing Preview Box */}
        <View style={[styles.previewBox, { backgroundColor: colors.cardSelected, borderColor: colors.cardBorder }]}>
          <Text style={[styles.previewBoxTitle, { color: colors.primary }]}>SIZING LIVE PREVIEW</Text>

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
      {/* 3. HAPTIC FEEDBACK & TACTILE RESPONSES */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('haptics')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="hardware-chip-outline" size={20} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Haptic Feedback</Text>
              <Text style={[styles.accordionSubtitle, { color: colors.textSecondary }]}>
                Intensity: {hapticIntensity === 'off' ? 'Off' : `${hapticIntensity.toUpperCase()} (${hapticIntensity === 'light' ? '•' : hapticIntensity === 'medium' ? '••' : '•••'})`}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.haptics ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.haptics && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Control tactile vibrations for button presses, status updates, episode checkmarks, and rewatch steppers. Tap any level to test.
            </Text>

            <Text style={[styles.subControlLabel, { color: colors.textSecondary }]}>FEEDBACK INTENSITY</Text>
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
                      isSelected && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                    ]}
                    onPress={() => {
                      void setHapticIntensity(opt.id);
                    }}>
                    {opt.dots === 0 ? (
                      <Ionicons
                        name="close-circle-outline"
                        size={14}
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
                        { color: isSelected ? '#ffffff' : colors.textSecondary },
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.hapticHintRow, { backgroundColor: colors.cardSelected, borderColor: colors.cardBorder }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.hapticHintText, { color: colors.textSecondary }]}>
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
      {/* 4. DATE DISPLAY FORMAT & REGIONAL PREFERENCES */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('dates')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Date Display Format</Text>
              <Text style={[styles.accordionSubtitle, { color: colors.textSecondary }]}>
                Format: {dateFormat} (e.g. {getTodayFormatted(dateFormat)})
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.dates ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.dates && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
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
                        <Text style={[styles.dateFormatName, { color: colors.text }]}>{opt.label}</Text>
                        <View style={[styles.dateFormatBadge, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                          <Text style={[styles.dateFormatBadgeText, { color: colors.primary }]}>
                            {opt.description}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.dateFormatSample, { color: colors.textSecondary }]}>
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
            <Ionicons name="globe-outline" size={20} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Region & Timezone</Text>
              <Text style={[styles.accordionSubtitle, { color: colors.textSecondary }]}>
                Region: {selectedRegion} ({regionMode}) | TZ: {selectedTimezone.split('/').pop()?.replace(/_/g, ' ') || selectedTimezone}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.regional ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.regional && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            {/* Upcoming Release Badges & Reminders Toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Release Countdowns & Badges</Text>
                <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
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
            <Text style={[styles.subControlLabel, { color: colors.textSecondary, marginTop: 16 }]}>
              RELEASE REGION (MOVIES)
            </Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
              Determines theatrical and digital premiere dates for movies so release countdowns match your location.
            </Text>
            <View style={[styles.modeSegmentContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <Pressable
                style={[
                  styles.modeSegmentBtn,
                  regionMode === 'auto' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void setRegionMode('auto');
                }}>
                <Ionicons
                  name="locate-outline"
                  size={15}
                  color={regionMode === 'auto' ? '#ffffff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeSegmentText,
                    { color: regionMode === 'auto' ? '#ffffff' : colors.textSecondary },
                  ]}>
                  Auto (System)
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modeSegmentBtn,
                  regionMode === 'manual' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void setRegionMode('manual');
                }}>
                <Ionicons
                  name="options-outline"
                  size={15}
                  color={regionMode === 'manual' ? '#ffffff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeSegmentText,
                    { color: regionMode === 'manual' ? '#ffffff' : colors.textSecondary },
                  ]}>
                  Manual Selection
                </Text>
              </Pressable>
            </View>

            {/* Popular Regions Selector */}
            {regionMode === 'manual' && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.cardDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
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
                            { color: isSelected ? colors.primary : colors.text },
                          ]}>
                          {reg.code}
                        </Text>
                        <Text
                          style={[
                            styles.regionChipName,
                            { color: isSelected ? colors.primary : colors.textSecondary },
                          ]}>
                          {reg.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Timezone Mode Toggle */}
            <Text style={[styles.subControlLabel, { color: colors.textSecondary, marginTop: 20 }]}>
              BROADCAST TIMEZONE (EPISODES & COUNTDOWNS)
            </Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
              Adjusts episode broadcast dates and today/tomorrow thresholds to your local clock.
            </Text>
            <View style={[styles.modeSegmentContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <Pressable
                style={[
                  styles.modeSegmentBtn,
                  timezoneMode === 'auto' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void setTimezoneMode('auto');
                }}>
                <Ionicons
                  name="time-outline"
                  size={15}
                  color={timezoneMode === 'auto' ? '#ffffff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeSegmentText,
                    { color: timezoneMode === 'auto' ? '#ffffff' : colors.textSecondary },
                  ]}>
                  Auto (System)
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modeSegmentBtn,
                  timezoneMode === 'manual' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  void setTimezoneMode('manual');
                }}>
                <Ionicons
                  name="options-outline"
                  size={15}
                  color={timezoneMode === 'manual' ? '#ffffff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeSegmentText,
                    { color: timezoneMode === 'manual' ? '#ffffff' : colors.textSecondary },
                  ]}>
                  Manual Selection
                </Text>
              </Pressable>
            </View>

            {/* Timezones Selector */}
            {timezoneMode === 'manual' && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.cardDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
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
                          <Text style={[styles.tzLabel, { color: isSelected ? colors.primary : colors.text }]}>
                            {tz.label}
                          </Text>
                          <Text style={[styles.tzId, { color: colors.textSecondary }]}>
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
      {/* 6. TMDB API KEY SECTION */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('api')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="key" size={20} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>TMDB API Configuration</Text>
              <Text style={[styles.accordionSubtitle, { color: colors.textSecondary }]}>
                Status: {apiKey ? 'Configured & Active' : 'API Key Missing'}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSections.api ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {expandedSections.api && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Enter your TMDB API Key (v3) or API Read Access Token (v4). It is saved locally on your device and never shared.
            </Text>

            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
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
                  size={18}
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
                  size={16}
                  color={testResult.valid ? '#22c55e' : '#ef4444'}
                />
                <Text
                  style={[
                    styles.testResultText,
                    testResult.valid ? styles.testResultSuccessText : styles.testResultErrorText,
                  ]}>
                  {testResult.message}
                </Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.saveBtn, { backgroundColor: colors.primary }, isTesting && styles.btnDisabled]}
                onPress={handleSaveKey}
                disabled={isTesting}>
                {isTesting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-sharp" size={16} color="#ffffff" />
                    <Text style={styles.saveBtnText}>Verify & Save Key</Text>
                  </>
                )}
              </Pressable>

              {apiKey && (
                <Pressable
                  style={styles.removeBtn}
                  onPress={handleRemoveKey}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={styles.removeBtnText}>Remove</Text>
                </Pressable>
              )}
            </View>

            {/* Guide: How to get TMDB Key */}
            <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 14 }]} />
            <Text style={[styles.subControlLabel, { color: colors.textSecondary }]}>HOW TO GET A FREE KEY</Text>
            <View style={styles.stepList}>
              <View style={styles.stepItem}>
                <Text style={[styles.stepNumber, { backgroundColor: colors.inputBg, color: colors.primary }]}>1</Text>
                <Text style={[styles.stepText, { color: colors.textSecondary }]}>
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
                <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                  Click your avatar in the top-right corner → <Text style={[styles.bold, { color: colors.text }]}>Settings</Text> →{' '}
                  <Text style={[styles.bold, { color: colors.text }]}>API</Text>.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <Text style={[styles.stepNumber, { backgroundColor: colors.inputBg, color: colors.primary }]}>3</Text>
                <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                  Click <Text style={[styles.bold, { color: colors.text }]}>Create</Text> (choose Developer) and accept the terms.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <Text style={[styles.stepNumber, { backgroundColor: colors.inputBg, color: colors.primary }]}>4</Text>
                <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                  Copy your <Text style={[styles.bold, { color: colors.text }]}>API Key (v3)</Text> or <Text style={[styles.bold, { color: colors.text }]}>API Read Access Token</Text> and paste it above.
                </Text>
              </View>
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
            <Ionicons name="server" size={20} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Storage & Data Management</Text>
              <Text style={[styles.accordionSubtitle, { color: colors.textSecondary }]}>
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
                <Ionicons name="refresh-outline" size={16} color={colors.primary} />
              )}
            </Pressable>
            <Ionicons
              name={expandedSections.storage ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </View>
        </Pressable>

        {expandedSections.storage && (
          <View style={[styles.accordionContent, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Inspect internal device capacity, local tracking database usage, and cached media assets.
            </Text>

        {/* Device Internal Storage Gauge */}
        <View style={[styles.deviceStorageBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <View style={styles.deviceStorageHeader}>
            <View style={styles.deviceStorageLabelRow}>
              <Ionicons name="phone-portrait-outline" size={16} color={colors.primary} />
              <Text style={[styles.deviceStorageTitle, { color: colors.text }]}>Internal Storage</Text>
            </View>
            <Text style={[styles.deviceStoragePercent, { color: colors.textSecondary }]}>
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
            <Text style={[styles.deviceStorageFootText, { color: colors.textSecondary }]}>
              {storageMetrics?.deviceTotalBytes
                ? `${formatBytes(storageMetrics.deviceUsedBytes)} used of ${formatBytes(storageMetrics.deviceTotalBytes)}`
                : 'Reading device storage...'}
            </Text>
            <Text style={[styles.deviceStorageFootText, { color: colors.primary, fontWeight: '700' }]}>
              {storageMetrics?.deviceFreeBytes
                ? `${formatBytes(storageMetrics.deviceFreeBytes)} free`
                : ''}
            </Text>
          </View>
        </View>

        {/* BingeLog Data Breakdown */}
        <Text style={[styles.subControlLabel, { color: colors.textSecondary, marginTop: 14 }]}>
          BINGELOG STORAGE BREAKDOWN
        </Text>

        <View style={[styles.breakdownContainer, { borderColor: colors.cardBorder }]}>
          {/* Saved Media Library */}
          <View style={[styles.breakdownRow, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.breakdownIconWrap}>
              <Ionicons name="film-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.breakdownTextWrap}>
              <Text style={[styles.breakdownTitle, { color: colors.text }]}>Tracked Library</Text>
              <Text style={[styles.breakdownSubtitle, { color: colors.textSecondary }]}>
                {trackedItems.length} {trackedItems.length === 1 ? 'item' : 'items'} saved with watch progress
              </Text>
            </View>
            <Text style={[styles.breakdownSize, { color: colors.text }]}>
              {formatBytes(storageMetrics?.librarySizeBytes || 0)}
            </Text>
          </View>

          {/* Preferences & Config */}
          <View style={[styles.breakdownRow, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.breakdownIconWrap}>
              <Ionicons name="options-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.breakdownTextWrap}>
              <Text style={[styles.breakdownTitle, { color: colors.text }]}>Settings & Themes</Text>
              <Text style={[styles.breakdownSubtitle, { color: colors.textSecondary }]}>
                UI scales, display toggles, custom theme
              </Text>
            </View>
            <Text style={[styles.breakdownSize, { color: colors.text }]}>
              {formatBytes(storageMetrics?.configSizeBytes || 0)}
            </Text>
          </View>

          {/* Image & Poster Cache */}
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownIconWrap}>
              <Ionicons name="image-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.breakdownTextWrap}>
              <Text style={[styles.breakdownTitle, { color: colors.text }]}>Image & Poster Cache</Text>
              <Text style={[styles.breakdownSubtitle, { color: colors.textSecondary }]}>
                Downloaded posters, backdrops, actor photos
              </Text>
            </View>
            <Text style={[styles.breakdownSize, { color: colors.text }]}>
              {formatBytes(storageMetrics?.imageCacheSizeBytes || 0)}
            </Text>
          </View>
        </View>

        {/* Clear Image Cache Button */}
        <Pressable
          style={[
            styles.clearCacheBtn,
            { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
            isClearingCache && styles.btnDisabled,
          ]}
          onPress={handleClearImageCache}
          disabled={isClearingCache}>
          {isClearingCache ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="brush-outline" size={16} color={colors.primary} />
          )}
          <Text style={[styles.clearCacheBtnText, { color: colors.primary }]}>
            Clear Image Cache
          </Text>
        </Pressable>

        <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 14 }]} />

        {/* Device-to-Device Sync */}
        <Text style={[styles.subControlLabel, { color: colors.textSecondary }]}>
          DEVICE SYNC & TRANSFER
        </Text>
        <Text style={[styles.backupDesc, { color: colors.textSecondary }]}>
          Sync your watchlist directly with your tablet or phone using Instant Relay (6-digit PIN) or Air-Gapped Offline QR.
        </Text>

        <Pressable
          style={[styles.syncDeviceBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
          onPress={() => {
            triggerHaptic('selection');
            setShowSyncModal(true);
          }}>
          <Ionicons name="sync-circle" size={24} color={colors.primary} />
          <View style={styles.syncDeviceBtnTextWrap}>
            <Text style={[styles.syncDeviceBtnTitle, { color: colors.primary }]}>Sync with Nearby Device</Text>
            <Text style={[styles.syncDeviceBtnSub, { color: colors.textSecondary }]}>
              Instant 6-digit relay • Offline camera QR
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>

        <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 14 }]} />

        {/* Backup & Restore Section */}
        <Text style={[styles.subControlLabel, { color: colors.textSecondary }]}>
          BACKUP & RESTORE
        </Text>
        <Text style={[styles.backupDesc, { color: colors.textSecondary }]}>
          Export your watchlist, ratings, reviews, and progress to an offline JSON file, or restore from a previous backup.
        </Text>

        <View style={styles.backupButtonsRow}>
          <Pressable
            style={[
              styles.backupBtn,
              { backgroundColor: colors.primaryBg, borderColor: colors.primary },
              (isExporting || trackedItems.length === 0) && styles.btnDisabled,
            ]}
            onPress={handleExportBackup}
            disabled={isExporting || trackedItems.length === 0}>
            {isExporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="share-outline" size={16} color={colors.primary} />
            )}
            <Text style={[styles.backupBtnText, { color: colors.primary }]}>Export Backup</Text>
          </Pressable>

          <Pressable
            style={[
              styles.backupBtn,
              { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              isImporting && styles.btnDisabled,
            ]}
            onPress={handleImportBackup}
            disabled={isImporting}>
            {isImporting ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name="folder-open-outline" size={16} color={colors.text} />
            )}
            <Text style={[styles.backupBtnText, { color: colors.text }]}>Import Backup</Text>
          </Pressable>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 14 }]} />

        {/* Danger Zone: Clear All Tracked Data */}
        <Text style={[styles.subControlLabel, { color: '#ef4444' }]}>DANGER ZONE</Text>
        <Pressable
          style={[
            styles.clearBtn,
            trackedItems.length === 0 && styles.btnDisabled,
          ]}
          onPress={handleClearAllData}
          disabled={trackedItems.length === 0}>
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
          <Text style={styles.clearBtnText}>Clear All Tracked Data</Text>
        </Pressable>
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* 7. ABOUT & LEGAL ATTRIBUTIONS SECTION */}
      {/* ============================================================== */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => toggleSection('about')}>
          <View style={styles.accordionLeft}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <View style={styles.accordionTextGroup}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>About & Disclaimers</Text>
              <Text style={[styles.accordionSubtitle, { color: colors.textSecondary }]}>
                Version 0.14.0 • TMDB & MAL Attributions
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
              Crafted with heavy AI assistance and vibe-coded with care as an independent personal tracking project.
            </Text>

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

            <Text selectable style={[styles.infoVersion, { color: colors.primary }]}>
              Version 0.14.0 • Build 17 • Expo SDK 57
            </Text>
          </View>
        )}
      </View>

      {/* Device-to-Device Sync Modal */}
      <SyncModal
        visible={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onSyncComplete={() => {
          void getStorageMetrics(trackedItems.length).then((metrics) => setStorageMetrics(metrics));
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
