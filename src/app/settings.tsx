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

export default function SettingsScreen() {
  const {
    apiKey,
    setApiKey,
    removeApiKey,
    trackedItems,
    clearData,
    showMediaImages,
    setShowMediaImages,
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

      {/* Display & Media Preferences */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="images-outline" size={20} color="#38bdf8" />
          <Text style={styles.cardTitle}>Display Preferences</Text>
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>Show Episode & Season Images</Text>
            <Text style={styles.toggleSubText}>
              Display season posters and episode preview thumbnails in tracker details. Turn off for a minimalist look or lower data usage.
            </Text>
          </View>
          <Switch
            value={showMediaImages}
            onValueChange={(val) => {
              void setShowMediaImages(val);
            }}
            trackColor={{ false: '#334155', true: '#2563eb' }}
            thumbColor={showMediaImages ? '#ffffff' : '#94a3b8'}
          />
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
        <Text style={styles.infoVersion}>Version 1.0.3 • Expo SDK 57</Text>
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
