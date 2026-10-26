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
  SeasonInfo,
  TrackedItem,
  TMDBMediaItem,
} from '@/types/media';
import { TMDBService } from '@/services/tmdb';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';
import {
  formatDateDisplay,
  formatDateInput,
  formatTimeWithSeconds,
  getTodayFormatted,
  updateIsoDate,
  updateIsoTime,
} from '@/utils/date';
import { DatePickerModal } from '@/components/DatePickerModal';
import { MaterialTimePickerModal } from '@/components/MaterialTimePickerModal';

interface SeasonDetailModalProps {
  visible: boolean;
  onClose: () => void;
  tvId: number;
  seasonNumber: number;
  seasonInfo?: SeasonInfo;
  isWatched: boolean;
  completedAt?: string | null;
  onUpdateCompletedAt?: (newIso: string | null) => void;
  onToggleWatched: () => void;
  onSelectEpisode?: (episodeNumber: number, baseEpisodeInfo?: EpisodeInfo) => void;
  item?: TrackedItem | TMDBMediaItem | null;
  existingRecord?: TrackedItem;
  watchedEpisodeKeys?: Set<string>;
  onToggleEpisodeWatched?: (episodeNumber: number) => void;
}

type SeasonDetailContentProps = Omit<SeasonDetailModalProps, 'visible'>;

function SeasonDetailContent({
  tvId,
  seasonNumber,
  seasonInfo,
  isWatched,
  completedAt,
  onUpdateCompletedAt,
  onClose,
  onToggleWatched,
  onSelectEpisode,
  item,
  existingRecord,
  watchedEpisodeKeys,
  onToggleEpisodeWatched,
}: SeasonDetailContentProps) {
  const {
    apiKey,
    showSeasonEpisodeImages,
    sizingConfig,
    dateFormat,
    timeFormat,
    triggerHaptic,
  } = useMedia();
  const { colors } = useAppTheme();

  const [isLoading, setIsLoading] = useState(Boolean(apiKey));
  const [details, setDetails] = useState<{
    seasonNumber: number;
    name: string;
    overview?: string;
    posterPath?: string | null;
    airDate?: string | null;
    episodes: EpisodeInfo[];
  } | null>(null);

  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (apiKey) {
      TMDBService.getSeasonDetails(tvId, seasonNumber, apiKey)
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
  }, [tvId, seasonNumber, apiKey]);

  const seasonName =
    details?.name ||
    seasonInfo?.name ||
    (seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`);
  const overview =
    details?.overview ||
    (seasonNumber === 0
      ? 'Special bonus episodes, behind-the-scenes content, and standalone extras.'
      : 'No overview available for this season.');
  const airDate = details?.airDate || seasonInfo?.airDate;
  const posterPath = details?.posterPath || seasonInfo?.posterPath || existingRecord?.posterPath || (item as any)?.poster_path;
  const episodesList = details?.episodes || [];
  const episodeCount = seasonInfo?.episodeCount || episodesList.length || 0;

  const posterUrl = TMDBService.getImageUrl(posterPath, 'w500');

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
            {seasonNumber === 0 ? 'BONUS CONTENT' : `SEASON ${seasonNumber}`}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {seasonName}
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
        {/* Season Poster Preview */}
        {showSeasonEpisodeImages && posterUrl ? (
          <View style={styles.posterContainer}>
            <View style={[styles.posterWrapper, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
              <Image
                source={{ uri: posterUrl }}
                style={styles.posterImage}
                contentFit="contain"
                transition={200}
              />
            </View>
          </View>
        ) : null}

        {/* Action Row: Watched Status & Season Meta Badges */}
        <View style={styles.actionRow}>
          <Pressable
            style={[
              styles.watchButton,
              isWatched
                ? { backgroundColor: colors.success, borderColor: colors.success }
                : { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            onPress={() => {
              triggerHaptic('impact');
              onToggleWatched();
            }}>
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
              {isWatched ? 'Season Completed' : 'Mark Season Completed'}
            </Text>
          </Pressable>

          <View style={styles.badgesRow}>
            {episodeCount > 0 ? (
              <View style={[styles.infoBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Ionicons name="film-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.infoBadgeText, { color: colors.textSecondary }]}>
                  {episodeCount} Episodes
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

        {/* Granular Completion Timestamp Card */}
        {isWatched && (
          <View
            style={[
              styles.completionCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}>
            <View style={styles.completionHeaderRow}>
              <View style={styles.completionTitleRow}>
                <Ionicons name="time" size={14} color={colors.primary} />
                <Text style={[styles.completionCardTitle, { color: colors.textSecondary }]}>
                  SEASON COMPLETION TIMESTAMP
                </Text>
              </View>
              {completedAt ? (
                <Pressable
                  style={styles.clearTimestampBtn}
                  hitSlop={8}
                  onPress={() => {
                    triggerHaptic('warning');
                    onUpdateCompletedAt?.(null);
                  }}>
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>

            {completedAt ? (
              <View style={styles.timestampValuesRow}>
                <Pressable
                  style={[
                    styles.timestampChip,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setShowDatePicker(true);
                  }}>
                  <Text style={[styles.timestampChipText, { color: colors.text }]}>
                    {formatDateDisplay(completedAt, dateFormat)}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.timestampChip,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setShowTimePicker(true);
                  }}>
                  <Text style={[styles.timestampChipText, { color: colors.text }]}>
                    {formatTimeWithSeconds(completedAt, timeFormat)}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.nowBtn,
                    { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    onUpdateCompletedAt?.(new Date().toISOString());
                  }}>
                  <Text style={[styles.nowBtnText, { color: colors.primary }]}>Now</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.unrecordedRow}>
                <Text style={[styles.unrecordedText, { color: colors.textMuted }]}>
                  Date & time not recorded yet
                </Text>
                <Pressable
                  style={[styles.setNowBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    triggerHaptic('selection');
                    onUpdateCompletedAt?.(new Date().toISOString());
                  }}>
                  <Ionicons name="time" size={14} color="#ffffff" style={{ marginRight: 5 }} />
                  <Text style={styles.setNowBtnText}>Set to Now</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

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

        {/* Episodes in this Season */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              EPISODES ({episodesList.length || episodeCount})
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading season episodes...
              </Text>
            </View>
          ) : episodesList.length === 0 ? (
            <Text style={[styles.emptyEpisodesText, { color: colors.textMuted }]}>
              No episodes listed for this season.
            </Text>
          ) : (
            episodesList.map((ep) => {
              const epKey = `s${seasonNumber}_e${ep.episodeNumber}`;
              const isEpWatched = watchedEpisodeKeys ? watchedEpisodeKeys.has(epKey) : false;

              return (
                <Pressable
                  key={`ep-row-${ep.episodeNumber}`}
                  style={[
                    styles.episodeRow,
                    { borderBottomColor: colors.divider },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    onSelectEpisode?.(ep.episodeNumber, ep);
                  }}>
                  <Pressable
                    style={styles.episodeCheckWrap}
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      triggerHaptic('impact');
                      onToggleEpisodeWatched?.(ep.episodeNumber);
                    }}>
                    <Ionicons
                      name={isEpWatched ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={isEpWatched ? colors.success : colors.textSecondary}
                    />
                  </Pressable>

                  <View style={styles.episodeInfoCol}>
                    <Text
                      style={[
                        styles.episodeTitle,
                        { color: colors.text, fontSize: Math.round(13 * textScaleMultiplier) },
                      ]}
                      numberOfLines={1}>
                      {ep.episodeNumber}. {ep.name || `Episode ${ep.episodeNumber}`}
                    </Text>
                    <View style={styles.episodeSubRow}>
                      {ep.airDate ? (
                        <Text style={[styles.episodeMeta, { color: colors.textSecondary }]}>
                          {formatDateDisplay(ep.airDate, dateFormat)}
                        </Text>
                      ) : null}
                      {ep.runtime ? (
                        <Text style={[styles.episodeMeta, { color: colors.textSecondary }]}>
                          {ep.airDate ? ' • ' : ''}{ep.runtime}m
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Date and Time Pickers */}
      <DatePickerModal
        visible={showDatePicker}
        title="Season Completion Date"
        initialDate={
          completedAt
            ? formatDateInput(completedAt, dateFormat)
            : getTodayFormatted(dateFormat)
        }
        dateFormat={dateFormat}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(newDate) => {
          const nextIso = updateIsoDate(completedAt, newDate, dateFormat);
          onUpdateCompletedAt?.(nextIso);
          setShowDatePicker(false);
        }}
        onClearDate={() => {
          onUpdateCompletedAt?.(null);
          setShowDatePicker(false);
        }}
      />

      <MaterialTimePickerModal
        visible={showTimePicker}
        initialHour={completedAt ? new Date(completedAt).getHours() : new Date().getHours()}
        initialMinute={completedAt ? new Date(completedAt).getMinutes() : new Date().getMinutes()}
        timeFormat={timeFormat}
        onClose={() => setShowTimePicker(false)}
        onConfirm={(hour, minute) => {
          const nextIso = updateIsoTime(completedAt, hour, minute, 0);
          onUpdateCompletedAt?.(nextIso);
          setShowTimePicker(false);
        }}
      />
    </View>
  );
}

export function SeasonDetailModal(props: SeasonDetailModalProps) {
  if (!props.visible) return null;

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent
      onRequestClose={props.onClose}>
      <View style={styles.modalBackdrop}>
        <SeasonDetailContent
          key={`${props.tvId}-${props.seasonNumber}`}
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
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  posterContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  posterWrapper: {
    width: 200,
    aspectRatio: 2 / 3,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  actionRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 16,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  watchButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completionCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  completionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  completionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completionCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  clearTimestampBtn: {
    padding: 4,
  },
  timestampValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  timestampChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  timestampChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nowBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  nowBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  unrecordedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unrecordedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  setNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  setNowBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  overviewText: {
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyEpisodesText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  episodeCheckWrap: {
    paddingRight: 10,
  },
  episodeInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  episodeTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  episodeSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  episodeMeta: {
    fontSize: 11,
  },
});
