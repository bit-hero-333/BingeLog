import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  EpisodeInfo,
  EpisodeDetailedInfo,
  EntitySelection,
} from '@/types/media';
import { TMDBService } from '@/services/tmdb';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';
import { formatDateDisplay } from '@/utils/date';

interface EpisodeDetailModalProps {
  visible: boolean;
  onClose: () => void;
  tvId: number;
  seasonNumber: number;
  episodeNumber: number;
  baseEpisodeInfo?: EpisodeInfo;
  isWatched: boolean;
  onToggleWatched: () => void;
  onSelectEntity: (entity: EntitySelection) => void;
}

interface EpisodeDetailContentProps {
  tvId: number;
  seasonNumber: number;
  episodeNumber: number;
  baseEpisodeInfo?: EpisodeInfo;
  isWatched: boolean;
  onClose: () => void;
  onToggleWatched: () => void;
  onSelectEntity: (entity: EntitySelection) => void;
}

function EpisodeDetailContent({
  tvId,
  seasonNumber,
  episodeNumber,
  baseEpisodeInfo,
  isWatched,
  onClose,
  onToggleWatched,
  onSelectEntity,
}: EpisodeDetailContentProps) {
  const { apiKey, showSeasonEpisodeImages, showActorImages, sizingConfig, dateFormat } = useMedia();
  const { colors } = useAppTheme();

  const [isLoading, setIsLoading] = useState(Boolean(apiKey));
  const [details, setDetails] = useState<EpisodeDetailedInfo | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (apiKey) {
      TMDBService.getEpisodeDetails(tvId, seasonNumber, episodeNumber, apiKey)
        .then((data) => {
          if (isMounted) {
            setDetails(data);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [tvId, seasonNumber, episodeNumber, apiKey]);

  const episodeName = details?.name || baseEpisodeInfo?.name || `Episode ${episodeNumber}`;
  const overview = details?.overview || baseEpisodeInfo?.overview || 'No overview available for this episode.';
  const airDate = details?.airDate || baseEpisodeInfo?.airDate;
  const runtime = details?.runtime || baseEpisodeInfo?.runtime;
  const stillPath = details?.stillPath || baseEpisodeInfo?.stillPath;
  const voteAverage = details?.voteAverage || baseEpisodeInfo?.voteAverage;

  const stillUrl = TMDBService.getImageUrl(stillPath, 'w500');

  // Granular sizing
  const textScaleMultiplier =
    sizingConfig.textSize === 'small' ? 0.88 :
    sizingConfig.textSize === 'large' ? 1.14 :
    sizingConfig.textSize === 'xlarge' ? 1.28 : 1.0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.cardBorder, backgroundColor: colors.headerBg }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerSub, { color: colors.primary }]}>
            SEASON {seasonNumber} • EPISODE {episodeNumber}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1} selectable={true}>
            {episodeName}
          </Text>
        </View>
        <Pressable
          style={[styles.closeBtn, { backgroundColor: colors.cardSelected }]}
          onPress={onClose}
          hitSlop={12}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Large 16:9 Still Preview */}
        {showSeasonEpisodeImages && stillUrl ? (
          <View style={[styles.stillWrapper, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
            <Image
              source={{ uri: stillUrl }}
              style={styles.stillImage}
              contentFit="cover"
              transition={200}
            />
          </View>
        ) : null}

        {/* Action Row: Watched Status & Quick Info */}
        <View style={styles.actionRow}>
          <Pressable
            style={[
              styles.watchButton,
              isWatched
                ? { backgroundColor: colors.success, borderColor: colors.success }
                : { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            onPress={onToggleWatched}>
            <Ionicons
              name={isWatched ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={isWatched ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.watchButtonText,
                { color: isWatched ? '#ffffff' : colors.text },
              ]}>
              {isWatched ? 'Watched' : 'Mark as Watched'}
            </Text>
          </Pressable>

          {/* Quick Badges */}
          <View style={styles.badgesRow}>
            {runtime ? (
              <View style={[styles.infoBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.infoBadgeText, { color: colors.textSecondary }]}>{runtime}m</Text>
              </View>
            ) : null}

            {voteAverage && voteAverage > 0 ? (
              <View style={[styles.infoBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Ionicons name="star" size={13} color="#eab308" />
                <Text style={[styles.infoBadgeText, { color: colors.textSecondary }]}>
                  {voteAverage.toFixed(1)}
                </Text>
              </View>
            ) : null}

            {airDate ? (
              <View style={[styles.infoBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.infoBadgeText, { color: colors.textSecondary }]}>
                  {formatDateDisplay(airDate, dateFormat)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Synopsis */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>SYNOPSIS</Text>
          <Text
            style={[
              styles.overviewText,
              { color: colors.text, fontSize: Math.round(14 * textScaleMultiplier) },
            ]}
            selectable={true}>
            {overview}
          </Text>
        </View>

        {/* Loading Indicator */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading guest actors & credits...
            </Text>
          </View>
        ) : null}

        {/* Crew (Directors & Writers) */}
        {!isLoading && details && ((details.directors && details.directors.length > 0) || (details.writers && details.writers.length > 0)) ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>DIRECTORS & WRITERS</Text>
            <View style={styles.crewWrap}>
              {(details.directors || []).map((dir) => (
                <Pressable
                  key={`dir-${dir.id}`}
                  style={[styles.entityChip, { backgroundColor: colors.cardSelected, borderColor: colors.primary }]}
                  onPress={() =>
                    onSelectEntity({
                      type: 'person',
                      id: dir.id,
                      name: dir.name,
                      role: 'Director',
                    })
                  }>
                  <Ionicons name="videocam-outline" size={13} color={colors.primary} />
                  <Text style={[styles.entityChipText, { color: colors.text }]} selectable={true}>{dir.name}</Text>
                  <Text style={[styles.entityChipRole, { color: colors.primary }]}>Dir</Text>
                </Pressable>
              ))}

              {(details.writers || []).map((writer) => (
                <Pressable
                  key={`writer-${writer.id}`}
                  style={[styles.entityChip, { backgroundColor: colors.cardSelected, borderColor: colors.cardBorder }]}
                  onPress={() =>
                    onSelectEntity({
                      type: 'person',
                      id: writer.id,
                      name: writer.name,
                      role: 'Writer',
                    })
                  }>
                  <Ionicons name="create-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.entityChipText, { color: colors.text }]} selectable={true}>{writer.name}</Text>
                  <Text style={[styles.entityChipRole, { color: colors.textSecondary }]}>Writer</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Guest Stars Carousel */}
        {!isLoading && details?.guestStars && details.guestStars.length > 0 ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                GUEST STARS ({details.guestStars.length})
              </Text>
              <Text style={[styles.hintSmall, { color: colors.textMuted }]}>Tap to view profile</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.castScroll}>
              {details.guestStars.map((actor) => {
                const profileUrl = TMDBService.getImageUrl(actor.profilePath, 'w185');
                return (
                  <Pressable
                    key={`guest-${actor.id}`}
                    style={[styles.actorCard, { backgroundColor: colors.cardSelected, borderColor: colors.cardBorder }]}
                    onPress={() =>
                      onSelectEntity({
                        type: 'person',
                        id: actor.id,
                        name: actor.name,
                        role: actor.character,
                        profilePath: actor.profilePath,
                      })
                    }>
                    {showActorImages && profileUrl ? (
                      <Image
                        source={{ uri: profileUrl }}
                        style={styles.actorPhoto}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.actorPhotoPlaceholder, { backgroundColor: colors.inputBg }]}>
                        <Ionicons name="person" size={24} color={colors.textMuted} />
                      </View>
                    )}
                    <Text style={[styles.actorName, { color: colors.text }]} numberOfLines={1} selectable={true}>
                      {actor.name}
                    </Text>
                    {actor.character ? (
                      <Text style={[styles.actorRole, { color: colors.textSecondary }]} numberOfLines={1} selectable={true}>
                        {actor.character}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

export function EpisodeDetailModal(props: EpisodeDetailModalProps) {
  if (!props.visible) return null;

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent
      onRequestClose={props.onClose}>
      <View style={styles.modalBackdrop}>
        <EpisodeDetailContent
          key={`${props.tvId}-${props.seasonNumber}-${props.episodeNumber}`}
          {...props}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  stillWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  stillImage: {
    width: '100%',
    height: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  watchButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  overviewText: {
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  crewWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  entityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  entityChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  entityChipRole: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  hintSmall: {
    fontSize: 11,
  },
  castScroll: {
    gap: 10,
    paddingRight: 8,
  },
  actorCard: {
    width: 96,
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  actorPhoto: {
    width: 80,
    height: 96,
    borderRadius: 8,
    marginBottom: 6,
  },
  actorPhotoPlaceholder: {
    width: 80,
    height: 96,
    borderRadius: 8,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actorName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  actorRole: {
    fontSize: 10,
    textAlign: 'center',
    width: '100%',
    marginTop: 2,
  },
});
