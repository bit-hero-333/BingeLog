import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  TMDBMediaItem,
  TrackedItem,
  MediaStatus,
  STATUS_CONFIG,
  MAL_SCORES,
  MediaType,
} from '@/types/media';
import { TMDBService } from '@/services/tmdb';

interface TrackModalProps {
  visible: boolean;
  item: TMDBMediaItem | TrackedItem | null;
  existingRecord?: TrackedItem;
  onClose: () => void;
  onSave: (record: TrackedItem) => void;
  onRemove?: (id: number, mediaType: MediaType) => void;
}

interface FormContentProps {
  item: TMDBMediaItem | TrackedItem;
  existingRecord?: TrackedItem;
  onClose: () => void;
  onSave: (record: TrackedItem) => void;
  onRemove?: (id: number, mediaType: MediaType) => void;
}

function TrackModalFormContent({
  item,
  existingRecord,
  onClose,
  onSave,
  onRemove,
}: FormContentProps) {
  const isTracked = 'status' in item;
  const id = item.id;
  const mediaType: MediaType = isTracked
    ? (item as TrackedItem).mediaType
    : ((item as TMDBMediaItem).media_type || 'movie');
  const title: string =
    ('title' in item && item.title)
      ? item.title
      : ('name' in item && item.name ? item.name : 'Untitled');
  const posterPath = isTracked
    ? (item as TrackedItem).posterPath
    : (item as TMDBMediaItem).poster_path;
  const releaseDate = isTracked
    ? (item as TrackedItem).releaseYear
    : ((item as TMDBMediaItem).release_date || (item as TMDBMediaItem).first_air_date);
  const releaseYear = releaseDate ? releaseDate.substring(0, 4) : '';
  const voteAverage = isTracked
    ? (item as TrackedItem).voteAverage
    : (item as TMDBMediaItem).vote_average;
  const overview = item.overview || '';

  const [status, setStatus] = useState<MediaStatus>(
    existingRecord ? existingRecord.status : 'watching'
  );
  const [score, setScore] = useState<number>(
    existingRecord ? existingRecord.userScore || 0 : 0
  );
  const [progress, setProgress] = useState<number>(
    existingRecord ? existingRecord.currentProgress || 0 : 0
  );
  const [notes, setNotes] = useState<string>(
    existingRecord ? existingRecord.notes || '' : ''
  );

  const handleSave = () => {
    const record: TrackedItem = {
      id,
      mediaType,
      title,
      posterPath,
      releaseYear,
      voteAverage,
      overview,
      status,
      userScore: score,
      currentProgress: progress,
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    onSave(record);
    onClose();
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove from List',
      `Are you sure you want to remove "${title}" from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (onRemove) {
              onRemove(id, mediaType);
            }
            onClose();
          },
        },
      ]
    );
  };

  const posterUrl = TMDBService.getImageUrl(posterPath, 'w342');
  const currentScoreLabel =
    MAL_SCORES.find((s) => s.score === score)?.label || 'Select Score';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheetContainer}>
        {/* Header Bar */}
        <View style={styles.sheetHeader}>
          <View style={styles.handle} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Media Summary Info */}
          <View style={styles.mediaSummary}>
            <View style={styles.posterWrapper}>
              {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
              ) : (
                <View style={[styles.poster, styles.posterFallback]}>
                  <Ionicons name="film-outline" size={24} color="#64748b" />
                </View>
              )}
            </View>

            <View style={styles.summaryDetails}>
              <View style={styles.titleRow}>
                <Text style={styles.mediaTitle} numberOfLines={2}>
                  {title}
                </Text>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color="#94a3b8" />
                </Pressable>
              </View>

              <View style={styles.metaBadgeRow}>
                <View style={styles.typeTag}>
                  <Text style={styles.typeTagText}>{mediaType.toUpperCase()}</Text>
                </View>
                {releaseYear ? (
                  <Text style={styles.metaText}>{releaseYear}</Text>
                ) : null}
                {voteAverage ? (
                  <View style={styles.ratingTag}>
                    <Ionicons name="star" size={12} color="#f59e0b" />
                    <Text style={styles.ratingTagText}>{voteAverage.toFixed(1)} TMDB</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Status Selector */}
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusGrid}>
            {(Object.keys(STATUS_CONFIG) as MediaStatus[]).map((st) => {
              const config = STATUS_CONFIG[st];
              const isSelected = status === st;
              return (
                <Pressable
                  key={st}
                  style={[
                    styles.statusButton,
                    isSelected && {
                      backgroundColor: config.bgColor,
                      borderColor: config.color,
                      borderWidth: 1.5,
                    },
                  ]}
                  onPress={() => setStatus(st)}>
                  <View
                    style={[
                      styles.statusColorPip,
                      { backgroundColor: config.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusButtonText,
                      isSelected && { color: config.color, fontWeight: '700' },
                    ]}>
                    {config.shortLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Score Selector (0-10) */}
          <View style={styles.scoreHeaderRow}>
            <Text style={styles.sectionTitle}>Your Score</Text>
            <Text style={styles.scoreActiveLabel}>{currentScoreLabel}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scoreSelectorRow}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => {
              const isSelected = score === s;
              return (
                <Pressable
                  key={s}
                  style={[
                    styles.scorePill,
                    isSelected && styles.scorePillActive,
                  ]}
                  onPress={() => setScore(s)}>
                  <Text
                    style={[
                      styles.scorePillText,
                      isSelected && styles.scorePillTextActive,
                    ]}>
                    {s === 0 ? '-' : s}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Progress Stepper */}
          <View style={styles.progressRow}>
            <View>
              <Text style={styles.sectionTitle}>
                {mediaType === 'tv' ? 'Episodes Watched' : 'Progress'}
              </Text>
              <Text style={styles.progressSubtitle}>
                Track your current progress
              </Text>
            </View>

            <View style={styles.stepperContainer}>
              <Pressable
                style={[styles.stepperBtn, progress <= 0 && styles.stepperDisabled]}
                onPress={() => setProgress((p) => Math.max(0, p - 1))}
                disabled={progress <= 0}>
                <Ionicons name="remove" size={18} color="#ffffff" />
              </Pressable>

              <Text style={styles.stepperValue}>{progress}</Text>

              <Pressable
                style={styles.stepperBtn}
                onPress={() => setProgress((p) => p + 1)}>
                <Ionicons name="add" size={18} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          {/* Notes Input */}
          <Text style={styles.sectionTitle}>Personal Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Recommended by Alex, favorite episode 4..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={3}
          />

          {/* Action Buttons */}
          <View style={styles.buttonStack}>
            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSave}>
              <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {existingRecord ? 'Update Tracking' : 'Save to My List'}
              </Text>
            </Pressable>

            {existingRecord && onRemove && (
              <Pressable
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleRemove}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={styles.removeButtonText}>Remove from List</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

export function TrackModal({
  visible,
  item,
  existingRecord,
  onClose,
  onSave,
  onRemove,
}: TrackModalProps) {
  if (!visible || !item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <TrackModalFormContent
        key={`${item.id}-${existingRecord?.updatedAt || 'new'}`}
        item={item}
        existingRecord={existingRecord}
        onClose={onClose}
        onSave={onSave}
        onRemove={onRemove}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#12151c',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#232838',
    maxHeight: '90%',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  mediaSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2433',
    marginBottom: 16,
  },
  posterWrapper: {
    width: 60,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1e2433',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryDetails: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mediaTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  typeTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeTagText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  ratingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingTagText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f2b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#262d3d',
  },
  statusColorPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500',
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreActiveLabel: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  scoreSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 20,
  },
  scorePill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1a1f2b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262d3d',
  },
  scorePillActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  scorePillText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  scorePillTextActive: {
    color: '#000000',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#161922',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#232838',
  },
  progressSubtitle: {
    color: '#64748b',
    fontSize: 12,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperDisabled: {
    backgroundColor: '#1e293b',
    opacity: 0.5,
  },
  stepperValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#232838',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  buttonStack: {
    gap: 10,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  removeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
