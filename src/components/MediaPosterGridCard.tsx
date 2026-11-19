import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { TrackedItem, STATUS_CONFIG } from '@/types/media';
import { TMDBService } from '@/services/tmdb';
import { formatRuntime, getCountdownInfo } from '@/utils/date';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { getTextScale } from '@/utils/sizing';

interface MediaPosterGridCardProps {
  item: TrackedItem;
  width: number;
  onPress: () => void;
}

export function MediaPosterGridCard({ item, width, onPress }: MediaPosterGridCardProps) {
  const { colors } = useAppTheme();
  const { sizingConfig, triggerHaptic, remindersEnabled, selectedTimezone } = useMedia();

  const textScale = getTextScale(sizingConfig?.textSize);
  const posterHeight = Math.round(width * 1.5);
  const posterUrl = TMDBService.getImageUrl(item.posterPath, 'w342');
  const statusConfig = STATUS_CONFIG[item.status];
  const isDualStatus = Boolean(
    item.mediaType === 'tv' && item.status === 'completed' && item.isAlsoPlanned
  );

  const countdown = useMemo(() => {
    if (!remindersEnabled) return null;
    const dateStr =
      item.mediaType === 'movie'
        ? item.regionalReleaseDate || item.releaseDate
        : item.nextAirDate || item.nextEpisode?.airDate;
    if (!dateStr) return null;
    const info = getCountdownInfo(dateStr, selectedTimezone);
    return info.isUpcoming ? info : null;
  }, [
    remindersEnabled,
    item.mediaType,
    item.regionalReleaseDate,
    item.releaseDate,
    item.nextAirDate,
    item.nextEpisode?.airDate,
    selectedTimezone,
  ]);

  const progressText = useMemo(() => {
    if (countdown) {
      return countdown.formattedCountdown;
    }
    if (item.mediaType === 'tv') {
      const watched = item.currentProgress || 0;
      return item.totalEpisodes ? `Ep ${watched}/${item.totalEpisodes}` : `Ep ${watched}`;
    }
    if (item.runtimeMinutes) {
      return formatRuntime(item.runtimeMinutes);
    }
    return '';
  }, [countdown, item.mediaType, item.currentProgress, item.totalEpisodes, item.runtimeMinutes]);

  return (
    <Pressable
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      style={({ pressed }) => [
        styles.container,
        { width },
        pressed && { opacity: 0.85 },
      ]}>
      <View
        style={[
          styles.posterWrapper,
          {
            width,
            height: posterHeight,
            backgroundColor: colors.cardSelected,
            borderColor: colors.cardBorder,
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
            <Ionicons name="film-outline" size={26 * textScale} color={colors.textMuted} />
          </View>
        )}

        {/* Top-left media type badge */}
        <View style={styles.mediaTypeBadge}>
          <Text style={[styles.mediaTypeText, { fontSize: Math.max(8, Math.round(8.5 * textScale)) }]}>
            {item.mediaType.toUpperCase()}
          </Text>
        </View>

        {/* Top-right user score badge */}
        {item.userScore > 0 && (
          <View style={styles.scoreBadge}>
            <Ionicons name="star" size={Math.max(9, Math.round(9.5 * textScale))} color="#f59e0b" />
            <Text style={[styles.scoreBadgeText, { fontSize: Math.max(9, Math.round(9.5 * textScale)) }]}>
              {item.userScore}
            </Text>
          </View>
        )}

        {/* Bottom-left compact countdown or progress pill */}
        {progressText ? (
          <View
            style={[
              styles.progressBadge,
              countdown ? { backgroundColor: colors.primary } : null,
            ]}>
            <Text
              style={[styles.progressBadgeText, { fontSize: Math.max(8.5, Math.round(9 * textScale)) }]}
              numberOfLines={1}>
              {progressText}
            </Text>
          </View>
        ) : null}

        {/* Bottom 4px status color bar */}
        {isDualStatus ? (
          <View style={styles.dualStatusBar}>
            <View style={[styles.dualStatusHalf, { backgroundColor: '#3b82f6' }]} />
            <View style={[styles.dualStatusHalf, { backgroundColor: '#a855f7' }]} />
          </View>
        ) : (
          <View style={[styles.statusBar, { backgroundColor: statusConfig.color }]} />
        )}
      </View>

      <Text
        style={[
          styles.title,
          {
            color: colors.text,
            fontSize: Math.max(11, Math.round(12 * textScale)),
            lineHeight: Math.round(15 * textScale),
          },
        ]}
        numberOfLines={2}>
        {item.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  posterWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaTypeBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(13, 15, 21, 0.78)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mediaTypeText: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  scoreBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(13, 15, 21, 0.82)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  scoreBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  progressBadge: {
    position: 'absolute',
    bottom: 8,
    left: 5,
    maxWidth: '88%',
    backgroundColor: 'rgba(13, 15, 21, 0.84)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  progressBadgeText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  statusBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
  },
  dualStatusBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    flexDirection: 'row',
  },
  dualStatusHalf: {
    flex: 1,
    height: '100%',
  },
  title: {
    marginTop: 5,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
});
