import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMedia } from '@/context/MediaContext';
import { TMDBService } from '@/services/tmdb';
import {
  DensityPreset,
  ElementScale,
  SIZING_PRESETS,
} from '@/types/media';

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
    showSeasonEpisodeImages,
    setShowSeasonEpisodeImages,
    showActorImages,
    setShowActorImages,
    showAllCast,
    setShowAllCast,
    sizingConfig,
    setSizingConfig,
  } = useMedia();

  const [customKey, setCustomKey] = useState<string | null>(null);
  const inputKey = customKey !== null ? customKey : (apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

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
            Alert.alert('Cleared', 'All tracked media has been removed.');
          },
        },
      ]
    );
  };

  const handleStepSizing = (
    key: 'textSize' | 'castSize' | 'tagSize' | 'rowDensity',
    delta: number
  ) => {
    const currentIndex = SCALES.indexOf(sizingConfig[key]);
    const nextIndex = Math.max(0, Math.min(SCALES.length - 1, currentIndex + delta));
    void setSizingConfig({
      ...sizingConfig,
      [key]: SCALES[nextIndex],
      preset: 'default',
    });
  };

  const handleApplyPreset = (preset: DensityPreset) => {
    void setSizingConfig(SIZING_PRESETS[preset]);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}>
      {/* TMDB API Key Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="key" size={20} color="#38bdf8" />
          <Text style={styles.cardTitle}>TMDB API Configuration</Text>
        </View>

        <Text style={styles.cardDescription}>
          Enter your TMDB API Key (v3) or API Read Access Token (v4). It is saved locally on your device and never shared.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Paste your TMDB key or token here..."
            placeholderTextColor="#64748b"
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
              color="#94a3b8"
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

        <View style={styles.btnRow}>
          <Pressable
            style={[styles.saveBtn, isTesting && styles.btnDisabled]}
            onPress={handleSaveKey}
            disabled={isTesting}>
            {isTesting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color="#ffffff" />
                <Text style={styles.saveBtnText}>Save & Verify</Text>
              </>
            )}
          </Pressable>

          {apiKey && (
            <Pressable style={styles.removeKeyBtn} onPress={handleRemoveKey}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Display & Media Preferences Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="images-outline" size={20} color="#38bdf8" />
          <Text style={styles.cardTitle}>Display & Media Preferences</Text>
        </View>

        {/* Toggle 1: Season & Episode Images */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>Show Season & Episode Images</Text>
            <Text style={styles.toggleSubText}>
              Display season posters and episode preview stills. Turn off to save mobile data.
            </Text>
          </View>
          <Switch
            value={showSeasonEpisodeImages}
            onValueChange={(val) => {
              void setShowSeasonEpisodeImages(val);
            }}
            trackColor={{ false: '#334155', true: '#2563eb' }}
            thumbColor={showSeasonEpisodeImages ? '#ffffff' : '#94a3b8'}
          />
        </View>

        <View style={styles.cardDivider} />

        {/* Toggle 2: Actor & Cast Images (Separated!) */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>Show Actor & Cast Photos</Text>
            <Text style={styles.toggleSubText}>
              Display actor photo portraits in the cast carousel. Turning off replaces them with clean avatar icons.
            </Text>
          </View>
          <Switch
            value={showActorImages}
            onValueChange={(val) => {
              void setShowActorImages(val);
            }}
            trackColor={{ false: '#334155', true: '#2563eb' }}
            thumbColor={showActorImages ? '#ffffff' : '#94a3b8'}
          />
        </View>

        <View style={styles.cardDivider} />

        {/* Toggle 3: Cast Carousel: Full Cast Mode */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>Cast Carousel: Full Cast</Text>
            <Text style={styles.toggleSubText}>
              Display all cast members by default instead of only the top 10 actors.
            </Text>
          </View>
          <Switch
            value={showAllCast}
            onValueChange={(val) => {
              void setShowAllCast(val);
            }}
            trackColor={{ false: '#334155', true: '#2563eb' }}
            thumbColor={showAllCast ? '#ffffff' : '#94a3b8'}
          />
        </View>
      </View>

      {/* Granular Element Sizing & Density Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="resize-outline" size={20} color="#38bdf8" />
          <Text style={styles.cardTitle}>Granular Element Sizing</Text>
        </View>

        <Text style={styles.cardDescription}>
          Fine-tune element sizes without overlapping or breaking layouts. Choose a preset or adjust sliders below.
        </Text>

        {/* Master Preset Buttons */}
        <Text style={styles.subControlLabel}>MASTER DENSITY PRESETS</Text>
        <View style={styles.presetButtonsRow}>
          {(['compact', 'default', 'large'] as DensityPreset[]).map((p) => {
            const isSelected = sizingConfig.preset === p;
            return (
              <Pressable
                key={p}
                style={[
                  styles.presetBtn,
                  isSelected && styles.presetBtnActive,
                ]}
                onPress={() => handleApplyPreset(p)}>
                <Text
                  style={[
                    styles.presetBtnText,
                    isSelected && styles.presetBtnTextActive,
                  ]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.cardDivider} />

        {/* Slider 1: Synopsis & Description Text Size */}
        <View style={styles.sliderControlRow}>
          <View style={styles.sliderInfo}>
            <Text style={styles.sliderTitle}>Synopsis & Text Size</Text>
            <Text style={styles.sliderValueText}>
              {SCALE_LABELS[sizingConfig.textSize]}
            </Text>
          </View>
          <View style={styles.stepperBox}>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.textSize === 'small' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('textSize', -1)}
              disabled={sizingConfig.textSize === 'small'}>
              <Ionicons name="remove" size={16} color="#ffffff" />
            </Pressable>
            <View style={styles.stepLevelPipContainer}>
              {SCALES.map((scale, i) => (
                <View
                  key={scale}
                  style={[
                    styles.stepPip,
                    SCALES.indexOf(sizingConfig.textSize) >= i && styles.stepPipActive,
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
              <Ionicons name="add" size={16} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* Slider 2: Cast & Actor Cards Size */}
        <View style={styles.sliderControlRow}>
          <View style={styles.sliderInfo}>
            <Text style={styles.sliderTitle}>Cast Cards & Avatars</Text>
            <Text style={styles.sliderValueText}>
              {SCALE_LABELS[sizingConfig.castSize]}
            </Text>
          </View>
          <View style={styles.stepperBox}>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.castSize === 'small' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('castSize', -1)}
              disabled={sizingConfig.castSize === 'small'}>
              <Ionicons name="remove" size={16} color="#ffffff" />
            </Pressable>
            <View style={styles.stepLevelPipContainer}>
              {SCALES.map((scale, i) => (
                <View
                  key={scale}
                  style={[
                    styles.stepPip,
                    SCALES.indexOf(sizingConfig.castSize) >= i && styles.stepPipActive,
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
              <Ionicons name="add" size={16} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* Slider 3: Tags & Badge Chips Size */}
        <View style={styles.sliderControlRow}>
          <View style={styles.sliderInfo}>
            <Text style={styles.sliderTitle}>Tags & Badges</Text>
            <Text style={styles.sliderValueText}>
              {SCALE_LABELS[sizingConfig.tagSize]}
            </Text>
          </View>
          <View style={styles.stepperBox}>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.tagSize === 'small' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('tagSize', -1)}
              disabled={sizingConfig.tagSize === 'small'}>
              <Ionicons name="remove" size={16} color="#ffffff" />
            </Pressable>
            <View style={styles.stepLevelPipContainer}>
              {SCALES.map((scale, i) => (
                <View
                  key={scale}
                  style={[
                    styles.stepPip,
                    SCALES.indexOf(sizingConfig.tagSize) >= i && styles.stepPipActive,
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
              <Ionicons name="add" size={16} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* Slider 4: Episode Rows Density */}
        <View style={styles.sliderControlRow}>
          <View style={styles.sliderInfo}>
            <Text style={styles.sliderTitle}>Episode Rows & Padding</Text>
            <Text style={styles.sliderValueText}>
              {ROW_SCALE_LABELS[sizingConfig.rowDensity]}
            </Text>
          </View>
          <View style={styles.stepperBox}>
            <Pressable
              style={[
                styles.stepBtn,
                sizingConfig.rowDensity === 'small' && styles.stepBtnDisabled,
              ]}
              onPress={() => handleStepSizing('rowDensity', -1)}
              disabled={sizingConfig.rowDensity === 'small'}>
              <Ionicons name="remove" size={16} color="#ffffff" />
            </Pressable>
            <View style={styles.stepLevelPipContainer}>
              {SCALES.map((scale, i) => (
                <View
                  key={scale}
                  style={[
                    styles.stepPip,
                    SCALES.indexOf(sizingConfig.rowDensity) >= i && styles.stepPipActive,
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
              <Ionicons name="add" size={16} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* Live Interactive Preview Box */}
        <View style={styles.previewBox}>
          <Text style={styles.previewBoxTitle}>LIVE PREVIEW</Text>

          {/* Sample Tag Pill */}
          <View style={styles.previewTagRow}>
            <View
              style={[
                styles.sampleTag,
                {
                  paddingVertical: previewTagPadV,
                  paddingHorizontal: previewTagPadH,
                },
              ]}>
              <Text style={[styles.sampleTagText, { fontSize: previewTagFontSize }]}>
                Sci-Fi & Fantasy
              </Text>
              <Ionicons name="search" size={9} color="#94a3b8" />
            </View>
          </View>

          {/* Sample Synopsis */}
          <Text style={[styles.sampleSynopsis, { fontSize: previewTextSize }]}>
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
                },
              ]}>
              <Ionicons
                name="person"
                size={Math.max(14, previewAvatarSize * 0.4)}
                color="#64748b"
              />
            </View>
            <Text style={styles.sampleCastName}>Sample Actor</Text>
          </View>

          {/* Sample Episode Row */}
          <View
            style={[
              styles.sampleEpisodeRow,
              { paddingVertical: previewRowPadV },
            ]}>
            <View style={styles.sampleCheckbox}>
              <Ionicons name="checkmark" size={12} color="#ffffff" />
            </View>
            {showSeasonEpisodeImages && (
              <View style={styles.sampleStillThumb}>
                <Ionicons name="image-outline" size={12} color="#64748b" />
              </View>
            )}
            <Text style={styles.sampleEpisodeText}>1. Pilot Episode</Text>
            <View style={styles.sampleBadge}>
              <Text style={styles.sampleBadgeText}>Watched</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Guide: How to get TMDB Key */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="information-circle" size={20} color="#fbbf24" />
          <Text style={styles.cardTitle}>How to get a Free TMDB Key</Text>
        </View>

        <View style={styles.stepList}>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>
              Go to <Text style={styles.bold}>themoviedb.org</Text> and sign up for a free account.
            </Text>
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>
              Click your avatar at top right → <Text style={styles.bold}>Settings</Text> →{' '}
              <Text style={styles.bold}>API</Text>.
            </Text>
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>
              Click <Text style={styles.bold}>Create</Text> (choose Developer) and accept the terms.
            </Text>
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepText}>
              Copy the <Text style={styles.bold}>API Key (v3)</Text> or <Text style={styles.bold}>API Read Access Token</Text> and paste it above!
            </Text>
          </View>
        </View>
      </View>

      {/* Data Management Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="server" size={20} color="#a855f7" />
          <Text style={styles.cardTitle}>Storage & Data</Text>
        </View>

        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Saved Media Items:</Text>
          <Text style={styles.dataValue}>{trackedItems.length}</Text>
        </View>

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

      {/* App Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>PersonalMediaTracker</Text>
        <Text style={styles.infoSub}>
          MyAnimeList-inspired tracker for Movies & TV Shows.
        </Text>
        <Text style={styles.infoVersion}>Version 1.0.4 • Expo SDK 57</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0f15',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: '#161922',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#232838',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#232838',
    marginVertical: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0f15',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262d3d',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 44,
    color: '#ffffff',
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
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  testResultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  testResultText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  testResultSuccessText: {
    color: '#22c55e',
  },
  testResultErrorText: {
    color: '#ef4444',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 10,
    gap: 6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  removeKeyBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleSubText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  subControlLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#1f2432',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262d3d',
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  presetBtnText: {
    color: '#cbd5e1',
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
    borderBottomWidth: 1,
    borderBottomColor: '#1e2433',
  },
  sliderInfo: {
    flex: 1,
  },
  sliderTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  sliderValueText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1f2432',
    borderWidth: 1,
    borderColor: '#262d3d',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#334155',
  },
  stepPipActive: {
    backgroundColor: '#38bdf8',
  },
  previewBox: {
    backgroundColor: '#12151c',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#232838',
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  previewBoxTitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  previewTagRow: {
    flexDirection: 'row',
  },
  sampleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1f2b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262d3d',
  },
  sampleTagText: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  sampleSynopsis: {
    color: '#cbd5e1',
    lineHeight: 18,
  },
  sampleCastCard: {
    alignItems: 'flex-start',
  },
  sampleCastAvatar: {
    backgroundColor: '#1e2433',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sampleCastName: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  sampleEpisodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161922',
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#232838',
  },
  sampleCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sampleStillThumb: {
    width: 36,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#1e2433',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sampleEpisodeText: {
    color: '#ffffff',
    fontSize: 12,
    flex: 1,
  },
  sampleBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sampleBadgeText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '700',
  },
  stepList: {
    gap: 10,
    marginTop: 4,
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
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  stepText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
    color: '#ffffff',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#232838',
    marginBottom: 12,
  },
  dataLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  dataValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    height: 40,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  clearBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  infoCard: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  infoSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  infoVersion: {
    color: '#475569',
    fontSize: 11,
    marginTop: 6,
  },
});
