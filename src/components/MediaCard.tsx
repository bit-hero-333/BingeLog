import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { TMDBMediaItem, TrackedItem, STATUS_CONFIG, MediaType } from '@/types/media';
import { TMDBService } from '@/services/tmdb';
import { formatDateDisplay, getRelativeTime, formatRuntime, getCountdownInfo } from '@/utils/date';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { getTextScale, getHeaderScale, getPosterScale } from '@/utils/sizing';

interface MediaCardProps {
  item: TMDBMediaItem | TrackedItem;
  trackedRecord?: TrackedItem;
  onPress: () => void;
  onQuickTrack?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function MediaCard({ item, trackedRecord, onPress, onQuickTrack, style }: MediaCardProps) {
  const { colors } = useAppTheme();
  const { triggerHaptic, dateFormat, selectedTimezone, remindersEnabled, sizingConfig } = useMedia();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);
  const posterScale = getPosterScale(sizingConfig?.posterSize);
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

  // Determine date summary label
  const getDateLabel = () => {
    if (!currentTracked) return null;
    if (currentTracked.status === 'completed' && currentTracked.finishedAt) {
      return `Finished ${formatDateDisplay(currentTracked.finishedAt, dateFormat)}`;
    }
    if (currentTracked.status === 'watching' && currentTracked.startedAt) {
      return `Started ${getRelativeTime(currentTracked.startedAt)}`;
    }
    if (currentTracked.addedAt) {
      return `Added ${getRelativeTime(currentTracked.addedAt)}`;
    }
    return null;
  };
  const dateLabel = getDateLabel();

  // Upcoming release countdown for unreleased movies & broadcast episodes
  const countdownTarget = useMemo(() => {
    if (!remindersEnabled) return null;
    let dateStr: string | undefined;
    if (currentTracked) {
      if (mediaType === 'movie') {
        dateStr = currentTracked.regionalReleaseDate || currentTracked.releaseDate;
      } else {
        dateStr = currentTracked.nextAirDate || currentTracked.nextEpisode?.airDate;
      }
    } else if ('release_date' in item || 'first_air_date' in item) {
      dateStr = (item as TMDBMediaItem).release_date || (item as TMDBMediaItem).first_air_date;
    }
    if (!dateStr) return null;
    const info = getCountdownInfo(dateStr, selectedTimezone);
    return info.isUpcoming ? info : null;
  }, [remindersEnabled, currentTracked, mediaType, item, selectedTimezone]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          minHeight: Math.round(140 * posterScale),
        },
        style,
        pressed && styles.cardPressed,
      ]}
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.05)' }}>
      {/* Poster */}
      <View
        style={[
          styles.posterContainer,
          {
            width: Math.round(90 * posterScale),
            height: Math.round(140 * posterScale),
            backgroundColor: colors.cardSelected,
          },
        ]}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.poster}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.poster, styles.posterFallback, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="film-outline" size={32 * textScale} color={colors.textMuted} />
            <Text style={[styles.noPosterText, { color: colors.textMuted, fontSize: 10 * textScale }]}>No Poster</Text>
          </View>
        )}

        {/* Media type badge */}
        <View style={styles.mediaTypeBadge}>
          <Text style={[styles.mediaTypeText, { fontSize: 9 * textScale }]}>{mediaType.toUpperCase()}</Text>
        </View>

        {/* Countdown Badge on Poster */}
        {countdownTarget && (
          <View style={[styles.countdownBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="calendar-outline" size={9 * textScale} color="#ffffff" />
            <Text style={[styles.countdownBadgeText, { fontSize: 9 * textScale }]}>{countdownTarget.formattedCountdown}</Text>
          </View>
        )}

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
          <Text
            style={[styles.title, { color: colors.text, fontSize: Math.round(15 * headerScale) }]}
            numberOfLines={2}
            selectable={true}>
            {title}
          </Text>
        </View>

        <View style={styles.metaRow}>
          {releaseYear ? (
            <Text style={[styles.yearText, { color: colors.textSecondary, fontSize: 12 * textScale }]}>{releaseYear}</Text>
          ) : null}

          {/* Countdown indicator chip in meta row */}
          {countdownTarget && (
            <View style={[styles.countdownMetaChip, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
              <Ionicons name="time-outline" size={10 * textScale} color={colors.primary} />
              <Text style={[styles.countdownMetaText, { color: colors.primary, fontSize: 10 * textScale }]}>
                {countdownTarget.formattedCountdown}
              </Text>
            </View>
          )}

          {/* TV Episodes / Movie Runtime info */}
          {currentTracked ? (
            mediaType === 'tv' ? (
              <View style={[styles.progressChip, { backgroundColor: colors.primaryBg }]}>
                <Ionicons name="tv-outline" size={11 * textScale} color={colors.primary} />
                <Text style={[styles.progressChipText, { color: colors.primary, fontSize: 11 * textScale }]}>
                  Ep {currentTracked.currentProgress || 0}
                  {currentTracked.totalEpisodes ? `/${currentTracked.totalEpisodes}` : ''}
                </Text>
              </View>
            ) : currentTracked.runtimeMinutes ? (
              <View style={[styles.progressChip, { backgroundColor: colors.primaryBg }]}>
                <Ionicons name="time-outline" size={11 * textScale} color={colors.primary} />
                <Text style={[styles.progressChipText, { color: colors.primary, fontSize: 11 * textScale }]}>
                  {formatRuntime(currentTracked.runtimeMinutes)}
                </Text>
              </View>
            ) : null
          ) : null}

          {voteAverage ? (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={11 * textScale} color="#f59e0b" />
              <Text style={[styles.ratingText, { fontSize: 11 * textScale }]}>{voteAverage.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        {/* Date Info Row */}
        {dateLabel && (
          <View style={styles.dateInfoRow}>
            <Ionicons name="calendar-outline" size={11 * textScale} color="#64748b" />
            <Text style={[styles.dateInfoText, { fontSize: 11 * textScale }]}>{dateLabel}</Text>
          </View>
        )}

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
                    { color: statusConfig?.color || '#3b82f6', fontSize: 11 * textScale },
                  ]}>
                  {statusConfig?.shortLabel}
                </Text>
              </View>

              {currentTracked.userScore > 0 && (
                <View style={styles.userScoreTag}>
                  <Ionicons name="star" size={11 * textScale} color="#fbbf24" />
                  <Text style={[styles.userScoreText, { fontSize: 11 * textScale }]}>{currentTracked.userScore}/10</Text>
                </View>
              )}

              {Boolean(currentTracked.rewatchCount && currentTracked.rewatchCount > 0) && (
                <View style={[styles.rewatchChip, { backgroundColor: colors.primaryBg }]}>
                  <Ionicons name="repeat" size={11 * textScale} color={colors.primary} />
                  <Text style={[styles.rewatchChipText, { color: colors.primary, fontSize: 11 * textScale }]}>
                    {currentTracked.rewatchCount}×
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.trackButton,
                { backgroundColor: colors.primary },
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
              <Ionicons name="add" size={14 * textScale} color="#ffffff" />
              <Text style={[styles.trackButtonText, { fontSize: 12 * textScale }]}>Track</Text>
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
              <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
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
    height: 140,
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
    marginBottom: 2,
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
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  yearText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  progressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  progressChipText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
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
  dateInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  dateInfoText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
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
  rewatchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rewatchChipText: {
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
  countdownBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 8,
    zIndex: 2,
  },
  countdownBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '700',
  },
  countdownMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  countdownMetaText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
