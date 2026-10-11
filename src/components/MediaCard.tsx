import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { TMDBMediaItem, TrackedItem, STATUS_CONFIG, MediaType } from '@/types/media';
import { TMDBService } from '@/services/tmdb';

interface MediaCardProps {
  item: TMDBMediaItem | TrackedItem;
  trackedRecord?: TrackedItem;
  onPress: () => void;
  onQuickTrack?: () => void;
}

export function MediaCard({ item, trackedRecord, onPress, onQuickTrack }: MediaCardProps) {
  // Normalize fields between TMDBMediaItem and TrackedItem
  const isTrackedItem = 'status' in item;
  const title = ('title' in item && item.title) ? item.title : ('name' in item ? item.name : 'Untitled');
  const posterPath = isTrackedItem ? (item as TrackedItem).posterPath : (item as TMDBMediaItem).poster_path;
  const mediaType: MediaType = isTrackedItem
    ? (item as TrackedItem).mediaType
    : ((item as TMDBMediaItem).media_type || 'movie');

  const releaseDate = isTrackedItem
    ? (item as TrackedItem).releaseYear
    : ((item as TMDBMediaItem).release_date || (item as TMDBMediaItem).first_air_date);
  const releaseYear = releaseDate ? releaseDate.substring(0, 4) : '';

  const voteAverage = isTrackedItem
    ? (item as TrackedItem).voteAverage
    : (item as TMDBMediaItem).vote_average;

  const currentTracked = trackedRecord || (isTrackedItem ? (item as TrackedItem) : undefined);
  const posterUrl = TMDBService.getImageUrl(posterPath, 'w342');

  const statusConfig = currentTracked ? STATUS_CONFIG[currentTracked.status] : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.05)' }}>
      {/* Poster */}
      <View style={styles.posterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.poster}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Ionicons name="film-outline" size={32} color="#64748b" />
            <Text style={styles.noPosterText}>No Poster</Text>
          </View>
        )}

        {/* Media type badge */}
        <View style={styles.mediaTypeBadge}>
          <Text style={styles.mediaTypeText}>{mediaType.toUpperCase()}</Text>
        </View>

        {/* Status Indicator Stripe */}
        {statusConfig && (
          <View
            style={[
              styles.statusStripe,
              { backgroundColor: statusConfig.color },
            ]}
          />
        )}
      </View>

      {/* Content Info */}
      <View style={styles.infoContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>

        <View style={styles.metaRow}>
          {releaseYear ? (
            <Text style={styles.yearText}>{releaseYear}</Text>
          ) : null}

          {voteAverage ? (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={styles.ratingText}>{voteAverage.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        {/* Tracking status or Quick Add */}
        <View style={styles.bottomRow}>
          {currentTracked ? (
            <View style={styles.trackedInfo}>
              <View
                style={[
                  styles.statusTag,
                  { backgroundColor: statusConfig?.bgColor || 'rgba(59, 130, 246, 0.15)' },
                ]}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: statusConfig?.color || '#3b82f6' },
                  ]}
                />
                <Text
                  style={[
                    styles.statusTagText,
                    { color: statusConfig?.color || '#3b82f6' },
                  ]}>
                  {statusConfig?.shortLabel}
                </Text>
              </View>

              {currentTracked.userScore > 0 && (
                <View style={styles.userScoreTag}>
                  <Ionicons name="star" size={11} color="#fbbf24" />
                  <Text style={styles.userScoreText}>{currentTracked.userScore}/10</Text>
                </View>
              )}
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.trackButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (onQuickTrack) {
                  onQuickTrack();
                } else {
                  onPress();
                }
              }}>
              <Ionicons name="add" size={14} color="#ffffff" />
              <Text style={styles.trackButtonText}>Track</Text>
            </Pressable>
          )}

          {/* Quick Edit icon if already tracked */}
          {currentTracked && (
            <Pressable
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={onPress}>
              <Ionicons name="create-outline" size={16} color="#94a3b8" />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#161922',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#232838',
  },
  cardPressed: {
    opacity: 0.9,
  },
  posterContainer: {
    width: 90,
    height: 135,
    position: 'relative',
    backgroundColor: '#1e2433',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1b202c',
    gap: 4,
  },
  noPosterText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '500',
  },
  mediaTypeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mediaTypeText: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
  },
  infoContainer: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  headerRow: {
    marginBottom: 4,
  },
  title: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  yearText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1f2430',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  trackedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  userScoreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  userScoreText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  trackButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  editButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1f2432',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
