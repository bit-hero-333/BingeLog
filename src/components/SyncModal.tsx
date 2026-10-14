import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import {
  generateSyncCode,
  normalizeSyncCode,
  buildSyncPayload,
  sendRelayPayload,
  fetchRelayPayload,
  compressPayloadForQr,
  decompressQrPayload,
  createQrChunks,
  formatChunkQrString,
  compareLibraries,
  mergeLibraries,
  SyncPayload,
  SyncDiffSummary,
  ChunkPayload,
} from '@/services/syncService';

interface SyncModalProps {
  visible: boolean;
  onClose: () => void;
  onSyncComplete?: (mergedCount: number) => void;
}

export function SyncModal({ visible, onClose, onSyncComplete }: SyncModalProps) {
  const { colors } = useAppTheme();
  const {
    trackedItems,
    saveItems,
    triggerHaptic,
    showSeasonEpisodeImages,
    showActorImages,
    showAllCast,
    showSeasonSpecials,
    sizingConfig,
    hapticIntensity,
    dateFormat,
  } = useMedia();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');

  // Send state
  const [sendMode, setSendMode] = useState<'relay' | 'offline'>('relay');
  const [syncCode, setSyncCode] = useState<string>(generateSyncCode());
  const [isRelayPublishing, setIsRelayPublishing] = useState<boolean>(false);
  const [relayPublished, setRelayPublished] = useState<boolean>(false);
  const [relayPublishError, setRelayPublishError] = useState<string | null>(null);

  // Offline QR chunks derived from current payload
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Receive state
  const [receiveInputCode, setReceiveInputCode] = useState<string>('');
  const [isRelayFetching, setIsRelayFetching] = useState<boolean>(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);

  // Camera scanner state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState<boolean>(false);

  // Chunk collector for offline animated QRs
  const [, setCollectedChunks] = useState<Map<number, string>>(new Map());
  const [chunkCollectionProgress, setChunkCollectionProgress] = useState<{
    total: number;
    collected: number;
  } | null>(null);

  // Diff & review state
  const [pendingPayload, setPendingPayload] = useState<SyncPayload | null>(null);
  const [diffSummary, setDiffSummary] = useState<SyncDiffSummary | null>(null);
  const [isApplyingSync, setIsApplyingSync] = useState<boolean>(false);

  // Prepare sync payload
  const currentPayload = useMemo(() => {
    return buildSyncPayload(trackedItems, {
      showSeasonEpisodeImages,
      showActorImages,
      showAllCast,
      showSeasonSpecials,
      sizingConfig,
      hapticIntensity,
      dateFormat,
    });
  }, [
    trackedItems,
    showSeasonEpisodeImages,
    showActorImages,
    showAllCast,
    showSeasonSpecials,
    sizingConfig,
    hapticIntensity,
    dateFormat,
  ]);

  // Compute offline QR chunks
  const qrChunks = useMemo<ChunkPayload[]>(() => {
    if (visible && activeTab === 'send' && sendMode === 'offline') {
      try {
        const compressed = compressPayloadForQr(currentPayload);
        return createQrChunks(compressed, 1300);
      } catch (err) {
        console.error('Failed to create QR chunks', err);
        return [];
      }
    }
    return [];
  }, [visible, activeTab, sendMode, currentPayload]);

  // Publish to relay when entering Send Relay mode or when sync code regenerates
  useEffect(() => {
    let isCancelled = false;

    if (visible && activeTab === 'send' && sendMode === 'relay') {
      const timer = setTimeout(() => {
        if (isCancelled) return;
        setIsRelayPublishing(true);
        setRelayPublished(false);
        setRelayPublishError(null);

        void sendRelayPayload(syncCode, currentPayload).then((res) => {
          if (isCancelled) return;
          setIsRelayPublishing(false);
          if (res.success) {
            setRelayPublished(true);
          } else {
            setRelayPublishError(res.error || 'Failed to connect to relay');
          }
        });
      }, 0);

      return () => {
        isCancelled = true;
        clearTimeout(timer);
      };
    }

    return () => {
      isCancelled = true;
    };
  }, [visible, activeTab, sendMode, syncCode, currentPayload]);

  // Cycle animated QR chunks if multi-frame
  useEffect(() => {
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    if (visible && activeTab === 'send' && sendMode === 'offline' && qrChunks.length > 1) {
      chunkTimerRef.current = setInterval(() => {
        setActiveChunkIndex((prev) => (prev + 1) % qrChunks.length);
      }, 350);
    }

    return () => {
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
      }
    };
  }, [visible, activeTab, sendMode, qrChunks]);

  // Handle regenerating pairing code
  const handleRegenerateCode = () => {
    triggerHaptic('selection');
    setSyncCode(generateSyncCode());
  };

  // Handle manual 6-digit code fetch
  const handleFetchByCode = async () => {
    const clean = normalizeSyncCode(receiveInputCode);
    if (clean.length < 5) {
      triggerHaptic('warning');
      setReceiveError('Please enter a valid 6-digit sync code.');
      return;
    }

    triggerHaptic('selection');
    setIsRelayFetching(true);
    setReceiveError(null);

    const res = await fetchRelayPayload(clean);
    setIsRelayFetching(false);

    if (res.success && res.payload) {
      triggerHaptic('success');
      handlePayloadReceived(res.payload);
    } else {
      triggerHaptic('error');
      setReceiveError(res.error || 'Could not fetch library. Check code and retry.');
    }
  };

  // Launch camera scanner
  const handleStartScanning = async () => {
    triggerHaptic('selection');
    if (!permission || !permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is needed to scan sync QR codes. You can also manually type the 6-digit code instead.'
        );
        return;
      }
    }
    setCollectedChunks(new Map());
    setChunkCollectionProgress(null);
    setIsScanning(true);
  };

  // Parse scanned barcode data
  const handleBarcodeScanned = async (scannedData: string) => {
    if (!scannedData || !isScanning) return;

    // 1. Instant Relay QR: bingelog-relay://<code>
    if (scannedData.startsWith('bingelog-relay://')) {
      const code = scannedData.replace('bingelog-relay://', '').trim();
      setIsScanning(false);
      triggerHaptic('selection');
      setIsRelayFetching(true);
      setReceiveError(null);

      const res = await fetchRelayPayload(code);
      setIsRelayFetching(false);
      if (res.success && res.payload) {
        triggerHaptic('success');
        handlePayloadReceived(res.payload);
      } else {
        triggerHaptic('error');
        setReceiveError(res.error || 'Failed to download sync data from scanned QR.');
      }
      return;
    }

    // 2. Offline Single-frame QR: bingelog-offline://<compressed>
    if (scannedData.startsWith('bingelog-offline://')) {
      const data = scannedData.replace('bingelog-offline://', '');
      const payload = decompressQrPayload(data);
      if (payload) {
        setIsScanning(false);
        triggerHaptic('success');
        handlePayloadReceived(payload);
      } else {
        triggerHaptic('error');
        setReceiveError('Scanned QR code could not be decompressed.');
      }
      return;
    }

    // 3. Offline Multi-frame Chunk: bingelog-chunk://<id>/<idx>/<total>/<data>
    if (scannedData.startsWith('bingelog-chunk://')) {
      const withoutPrefix = scannedData.replace('bingelog-chunk://', '');
      const parts = withoutPrefix.split('/');
      if (parts.length >= 4) {
        const idx = parseInt(parts[1], 10);
        const total = parseInt(parts[2], 10);
        const chunkData = parts.slice(3).join('/');

        setCollectedChunks((prev) => {
          const next = new Map(prev);
          next.set(idx, chunkData);

          setChunkCollectionProgress({
            total,
            collected: next.size,
          });

          // All chunks collected!
          if (next.size === total) {
            triggerHaptic('success');
            setIsScanning(false);

            let fullCompressed = '';
            for (let i = 1; i <= total; i++) {
              fullCompressed += next.get(i) || '';
            }

            const payload = decompressQrPayload(fullCompressed);
            if (payload) {
              handlePayloadReceived(payload);
            } else {
              setReceiveError('Multi-frame QR could not be reconstructed.');
            }
          } else {
            triggerHaptic('selection');
          }

          return next;
        });
      }
    }
  };

  // Inspect incoming payload and show diff
  const handlePayloadReceived = (payload: SyncPayload) => {
    setPendingPayload(payload);
    const diff = compareLibraries(trackedItems, payload.trackedItems);
    setDiffSummary(diff);
  };

  // Apply merge
  const handleConfirmMerge = async () => {
    if (!pendingPayload) return;
    setIsApplyingSync(true);
    triggerHaptic('impact');

    try {
      const merged = mergeLibraries(trackedItems, pendingPayload.trackedItems);
      await saveItems(merged);
      triggerHaptic('success');
      Alert.alert(
        'Sync Complete! 🍿',
        `Successfully merged ${pendingPayload.itemCount} items into your library. You now have ${merged.length} tracked items.`,
        [
          {
            text: 'Great',
            onPress: () => {
              if (onSyncComplete) onSyncComplete(merged.length);
              handleClose();
            },
          },
        ]
      );
    } catch (e) {
      console.error('Failed to merge sync items', e);
      triggerHaptic('error');
      Alert.alert('Merge Failed', 'An error occurred while saving the synced library.');
    } finally {
      setIsApplyingSync(false);
    }
  };

  // Replace entire library
  const handleConfirmReplace = async () => {
    if (!pendingPayload) return;
    Alert.alert(
      'Replace Entire Library?',
      `This will completely replace your current library (${trackedItems.length} items) with the incoming library (${pendingPayload.itemCount} items). This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace All',
          style: 'destructive',
          onPress: async () => {
            setIsApplyingSync(true);
            triggerHaptic('impact');
            try {
              await saveItems(pendingPayload.trackedItems);
              triggerHaptic('success');
              Alert.alert('Library Replaced', 'Your library has been overwritten with the synced items.', [
                {
                  text: 'OK',
                  onPress: () => {
                    if (onSyncComplete) onSyncComplete(pendingPayload.trackedItems.length);
                    handleClose();
                  },
                },
              ]);
            } catch {
              triggerHaptic('error');
              Alert.alert('Error', 'Failed to replace library.');
            } finally {
              setIsApplyingSync(false);
            }
          },
        },
      ]
    );
  };

  // Reset modal state
  const handleClose = () => {
    setIsScanning(false);
    setPendingPayload(null);
    setDiffSummary(null);
    setReceiveError(null);
    setCollectedChunks(new Map());
    setChunkCollectionProgress(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialogSheet, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.headerLeft}>
              <Ionicons name="sync-circle-outline" size={24} color={colors.primary} />
              <View>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Device-to-Device Sync</Text>
                <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
                  Sync watchlist between Phone & Tablet
                </Text>
              </View>
            </View>

            <Pressable style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Review Diff Modal Sub-view */}
          {pendingPayload && diffSummary ? (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.reviewHeaderRow}>
                  <Ionicons name="checkmark-done-circle" size={28} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.reviewTitle, { color: colors.text }]}>Library Received!</Text>
                    <Text style={[styles.reviewSub, { color: colors.textSecondary }]}>
                      From {pendingPayload.deviceLabel || 'Nearby Device'} • {pendingPayload.itemCount} items
                    </Text>
                  </View>
                </View>

                <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 12 }]} />

                {/* Diff Stats */}
                <View style={styles.diffStatsRow}>
                  <View style={[styles.diffStatBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.diffStatNumber, { color: colors.success }]}>
                      +{diffSummary.newItemsCount}
                    </Text>
                    <Text style={[styles.diffStatLabel, { color: colors.textSecondary }]}>New Titles</Text>
                  </View>

                  <View style={[styles.diffStatBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.diffStatNumber, { color: colors.primary }]}>
                      {diffSummary.updatedItemsCount}
                    </Text>
                    <Text style={[styles.diffStatLabel, { color: colors.textSecondary }]}>Updated</Text>
                  </View>

                  <View style={[styles.diffStatBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.diffStatNumber, { color: colors.textMuted }]}>
                      {diffSummary.unchangedItemsCount}
                    </Text>
                    <Text style={[styles.diffStatLabel, { color: colors.textSecondary }]}>Identical</Text>
                  </View>
                </View>

                {/* Sample diff items preview */}
                {diffSummary.newItemsTitles.length > 0 && (
                  <View style={styles.diffPreviewSection}>
                    <Text style={[styles.diffPreviewHeading, { color: colors.text }]}>New Items Being Added:</Text>
                    <Text style={[styles.diffPreviewList, { color: colors.textSecondary }]} numberOfLines={3}>
                      {diffSummary.newItemsTitles.slice(0, 6).join(', ')}
                      {diffSummary.newItemsTitles.length > 6 ? ` and ${diffSummary.newItemsTitles.length - 6} more...` : ''}
                    </Text>
                  </View>
                )}

                {diffSummary.updatedItemsTitles.length > 0 && (
                  <View style={styles.diffPreviewSection}>
                    <Text style={[styles.diffPreviewHeading, { color: colors.text }]}>Updated Progress:</Text>
                    <Text style={[styles.diffPreviewList, { color: colors.textSecondary }]} numberOfLines={3}>
                      {diffSummary.updatedItemsTitles.slice(0, 6).join(', ')}
                      {diffSummary.updatedItemsTitles.length > 6 ? ` and ${diffSummary.updatedItemsTitles.length - 6} more...` : ''}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionButtonsContainer}>
                  <Pressable
                    style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                    onPress={handleConfirmMerge}
                    disabled={isApplyingSync}>
                    {isApplyingSync ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="git-merge-outline" size={18} color="#ffffff" />
                        <Text style={styles.primaryActionBtnText}>Merge with My Library</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    style={[styles.secondaryActionBtn, { borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]}
                    onPress={handleConfirmReplace}
                    disabled={isApplyingSync}>
                    <Ionicons name="swap-horizontal-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>
                      Replace My Entire Library
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.cancelReviewBtn]}
                    onPress={() => {
                      setPendingPayload(null);
                      setDiffSummary(null);
                    }}>
                    <Text style={[styles.cancelReviewBtnText, { color: colors.textMuted }]}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          ) : isScanning ? (
            /* ============================================================== */
            /* CAMERA SCANNER SCREEN */
            /* ============================================================== */
            <View style={styles.scannerContainer}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torchOn}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={(result) => handleBarcodeScanned(result.data)}
              />

              {/* Reticle Overlay */}
              <View style={styles.reticleOverlay}>
                <View style={styles.reticleBox}>
                  <View style={[styles.corner, styles.cornerTL, { borderColor: colors.primary }]} />
                  <View style={[styles.corner, styles.cornerTR, { borderColor: colors.primary }]} />
                  <View style={[styles.corner, styles.cornerBL, { borderColor: colors.primary }]} />
                  <View style={[styles.corner, styles.cornerBR, { borderColor: colors.primary }]} />
                </View>

                {chunkCollectionProgress ? (
                  <View style={[styles.chunkProgressPill, { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: colors.primary }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.chunkProgressText, { color: '#ffffff' }]}>
                      Capturing offline frame {chunkCollectionProgress.collected} of {chunkCollectionProgress.total}...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.scannerInstructions}>
                    Point camera at other device&apos;s QR code
                  </Text>
                )}
              </View>

              {/* Bottom camera controls */}
              <View style={styles.scannerControlsRow}>
                <Pressable
                  style={[styles.scannerIconBtn, torchOn && { backgroundColor: colors.primary }]}
                  onPress={() => setTorchOn(!torchOn)}>
                  <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={20} color="#ffffff" />
                </Pressable>

                <Pressable style={styles.cancelScanBtn} onPress={() => setIsScanning(false)}>
                  <Text style={styles.cancelScanText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* ============================================================== */
            /* MAIN SEND / RECEIVE DASHBOARD */
            /* ============================================================== */
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Primary Send / Receive Toggle */}
              <View style={[styles.modeSegmentContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                <Pressable
                  style={[
                    styles.modeSegmentBtn,
                    activeTab === 'send' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setActiveTab('send');
                  }}>
                  <Ionicons
                    name="arrow-up-circle-outline"
                    size={16}
                    color={activeTab === 'send' ? '#ffffff' : colors.textSecondary}
                  />
                  <Text style={[styles.modeSegmentText, { color: activeTab === 'send' ? '#ffffff' : colors.text }]}>
                    Send Library
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.modeSegmentBtn,
                    activeTab === 'receive' && [styles.modeSegmentBtnActive, { backgroundColor: colors.primary }],
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setActiveTab('receive');
                  }}>
                  <Ionicons
                    name="arrow-down-circle-outline"
                    size={16}
                    color={activeTab === 'receive' ? '#ffffff' : colors.textSecondary}
                  />
                  <Text
                    style={[styles.modeSegmentText, { color: activeTab === 'receive' ? '#ffffff' : colors.text }]}>
                    Receive Library
                  </Text>
                </Pressable>
              </View>

              {activeTab === 'send' ? (
                /* ============================================================== */
                /* SEND VIEW */
                /* ============================================================== */
                <View style={styles.tabContent}>
                  {/* Mode Picker: Instant Relay vs Offline Air-Gapped */}
                  <View style={styles.sendModeRow}>
                    <Pressable
                      style={[
                        styles.sendModeOption,
                        {
                          backgroundColor: sendMode === 'relay' ? colors.cardSelected : colors.inputBg,
                          borderColor: sendMode === 'relay' ? colors.primary : colors.cardBorder,
                        },
                      ]}
                      onPress={() => {
                        triggerHaptic('selection');
                        setSendMode('relay');
                      }}>
                      <Text style={styles.sendModeEmoji}>🛜🔄</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sendModeTitle, { color: colors.text }]}>Instant Relay</Text>
                        <Text style={[styles.sendModeSubtitle, { color: colors.textSecondary }]}>
                          Fast 6-digit code or QR over Wi-Fi
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.sendModeOption,
                        {
                          backgroundColor: sendMode === 'offline' ? colors.cardSelected : colors.inputBg,
                          borderColor: sendMode === 'offline' ? colors.primary : colors.cardBorder,
                        },
                      ]}
                      onPress={() => {
                        triggerHaptic('selection');
                        setSendMode('offline');
                      }}>
                      <Text style={styles.sendModeEmoji}>🛜🚫</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sendModeTitle, { color: colors.text }]}>Offline QR</Text>
                        <Text style={[styles.sendModeSubtitle, { color: colors.textSecondary }]}>
                          Air-gapped on-screen visual transfer
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  {/* Relay Mode Display */}
                  {sendMode === 'relay' ? (
                    <View style={[styles.codeDisplayCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <Text style={[styles.pinLabel, { color: colors.textSecondary }]}>YOUR 6-DIGIT SYNC CODE</Text>
                      <View style={styles.pinRow}>
                        <Text style={[styles.pinText, { color: colors.primary }]}>{syncCode}</Text>
                        <Pressable style={styles.pinRefreshBtn} onPress={handleRegenerateCode}>
                          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                        </Pressable>
                      </View>

                      <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder, marginVertical: 10 }]} />

                      {/* QR Display */}
                      <View style={styles.qrWrapper}>
                        <QRCode
                          value={`bingelog-relay://${normalizeSyncCode(syncCode)}`}
                          size={180}
                          color="#000000"
                          backgroundColor="#ffffff"
                        />
                      </View>

                      <View style={styles.relayStatusRow}>
                        {isRelayPublishing ? (
                          <>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.relayStatusText, { color: colors.textSecondary }]}>
                              Connecting to pairing channel...
                            </Text>
                          </>
                        ) : relayPublished ? (
                          <>
                            <View style={[styles.pulseDot, { backgroundColor: colors.success }]} />
                            <Text style={[styles.relayStatusText, { color: colors.success }]}>
                              Ready! Scan QR or type code on your tablet.
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                            <Text style={[styles.relayStatusText, { color: '#ef4444' }]}>
                              {relayPublishError || 'Connection failed. Retrying...'}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  ) : (
                    /* Offline Air-Gapped Display */
                    <View style={[styles.codeDisplayCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <Text style={[styles.pinLabel, { color: colors.textSecondary }]}>
                        AIR-GAPPED OFFLINE QR (100% OFFLINE)
                      </Text>

                      <View style={styles.qrWrapper}>
                        {qrChunks.length > 0 ? (
                          <QRCode
                            key={`chunk-${activeChunkIndex}`}
                            value={formatChunkQrString(qrChunks[activeChunkIndex])}
                            size={200}
                            color="#000000"
                            backgroundColor="#ffffff"
                          />
                        ) : (
                          <ActivityIndicator size="large" color={colors.primary} />
                        )}
                      </View>

                      {qrChunks.length > 1 ? (
                        <View style={[styles.animatedFrameBadge, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                          <Ionicons name="sparkles" size={12} color={colors.primary} />
                          <Text style={[styles.animatedFrameText, { color: colors.primary }]}>
                            Frame {activeChunkIndex + 1} of {qrChunks.length} (Animated Flipbook)
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.offlineHint, { color: colors.textSecondary }]}>
                          Single high-density frame • Point receiver camera here
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                /* ============================================================== */
                /* RECEIVE VIEW */
                /* ============================================================== */
                <View style={styles.tabContent}>
                  {/* Choice 1: Type 6-Digit PIN */}
                  <View style={[styles.receiveCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.receiveCardHeading, { color: colors.text }]}>Enter 6-Digit Code</Text>
                    <Text style={[styles.receiveCardSub, { color: colors.textSecondary }]}>
                      Type the code displayed on your other device
                    </Text>

                    <View style={styles.pinInputRow}>
                      <TextInput
                        style={[
                          styles.pinInput,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: colors.cardBorder,
                            color: colors.text,
                          },
                        ]}
                        placeholder="e.g. 482-915"
                        placeholderTextColor={colors.textMuted}
                        value={receiveInputCode}
                        onChangeText={setReceiveInputCode}
                        autoCapitalize="characters"
                        maxLength={10}
                      />

                      <Pressable
                        style={[styles.connectBtn, { backgroundColor: colors.primary }, isRelayFetching && styles.btnDisabled]}
                        onPress={handleFetchByCode}
                        disabled={isRelayFetching}>
                        {isRelayFetching ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.connectBtnText}>Connect</Text>
                        )}
                      </Pressable>
                    </View>

                    {receiveError && (
                      <View style={styles.errorBanner}>
                        <Ionicons name="warning" size={14} color="#ef4444" />
                        <Text style={styles.errorBannerText}>{receiveError}</Text>
                      </View>
                    )}
                  </View>

                  {/* Choice 2: Scan QR Code */}
                  <View style={[styles.orDividerRow]}>
                    <View style={[styles.orDividerLine, { backgroundColor: colors.cardBorder }]} />
                    <Text style={[styles.orDividerText, { color: colors.textMuted }]}>OR</Text>
                    <View style={[styles.orDividerLine, { backgroundColor: colors.cardBorder }]} />
                  </View>

                  <Pressable
                    style={[styles.scanQrButton, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
                    onPress={handleStartScanning}>
                    <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={[styles.scanQrButtonTitle, { color: colors.primary }]}>Scan QR with Camera</Text>
                      <Text style={[styles.scanQrButtonSub, { color: colors.textSecondary }]}>
                        Works with both 🛜🔄 Instant & 🛜🚫 Offline QRs
                      </Text>
                    </View>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  dialogSheet: {
    maxHeight: '90%',
    minHeight: '65%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sheetSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  modeSegmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  modeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modeSegmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  modeSegmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabContent: {
    gap: 14,
  },
  sendModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sendModeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  sendModeEmoji: {
    fontSize: 22,
  },
  sendModeTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  sendModeSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  codeDisplayCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  pinLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  pinText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3,
  },
  pinRefreshBtn: {
    padding: 6,
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  cardDivider: {
    height: 1,
    width: '100%',
  },
  relayStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  relayStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  animatedFrameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  animatedFrameText: {
    fontSize: 12,
    fontWeight: '700',
  },
  offlineHint: {
    fontSize: 11,
    marginTop: 12,
  },
  receiveCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  receiveCardHeading: {
    fontSize: 15,
    fontWeight: '700',
  },
  receiveCardSub: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  pinInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pinInput: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  connectBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  errorBannerText: {
    color: '#ef4444',
    fontSize: 12,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 10,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
  },
  orDividerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scanQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  scanQrButtonTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  scanQrButtonSub: {
    fontSize: 11,
    marginTop: 2,
  },
  scannerContainer: {
    flex: 1,
    minHeight: 400,
    position: 'relative',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  reticleBox: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#ffffff',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scannerInstructions: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chunkProgressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chunkProgressText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scannerControlsRow: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scannerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelScanBtn: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  cancelScanText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  reviewSub: {
    fontSize: 12,
    marginTop: 2,
  },
  diffStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 4,
  },
  diffStatBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  diffStatNumber: {
    fontSize: 22,
    fontWeight: '900',
  },
  diffStatLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  diffPreviewSection: {
    marginTop: 12,
  },
  diffPreviewHeading: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  diffPreviewList: {
    fontSize: 12,
    lineHeight: 18,
  },
  actionButtonsContainer: {
    marginTop: 20,
    gap: 10,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cancelReviewBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelReviewBtnText: {
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
