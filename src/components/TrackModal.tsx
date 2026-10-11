import React, { useState, useEffect, useMemo } from 'react';
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
  ActivityIndicator,
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
  SeasonInfo,
  EpisodeInfo,
} from '@/types/media';
import { TMDBService } from '@/services/tmdb';
import { useMedia } from '@/context/MediaContext';
import {
  formatDateDisplay,
  formatDateDDMMYYYY,
  parseDDMMYYYYtoIso,
  getTodayDDMMYYYY,
  getRelativeTime,
  getDurationLabel,
  formatRuntime,
} from '@/utils/date';
import { DatePickerModal } from '@/components/DatePickerModal';

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
  const { apiKey } = useMedia();

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

  // Media metadata state (episodes, seasons, runtime)
  const [totalEpisodes, setTotalEpisodes] = useState<number | null>(
    existingRecord?.totalEpisodes ??
      (item as TMDBMediaItem).number_of_episodes ??
      null
  );
  const [totalSeasons, setTotalSeasons] = useState<number | null>(
    existingRecord?.totalSeasons ??
      (item as TMDBMediaItem).number_of_seasons ??
      null
  );
  const [seasons, setSeasons] = useState<SeasonInfo[]>(
    existingRecord?.seasons || []
  );
  const [runtimeMinutes, setRuntimeMinutes] = useState<number | null>(
    existingRecord?.runtimeMinutes ??
      (item as TMDBMediaItem).runtime ??
      null
  );
  const needsDetails = Boolean(apiKey && (totalEpisodes === null || (item as TMDBMediaItem).runtime === undefined));
  const [isLoadingDetails, setIsLoadingDetails] = useState(needsDetails);

  // Granular episode tracking state: Set of "s{season}_e{episode}"
  const initialWatchedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (existingRecord?.watchedEpisodeKeys && existingRecord.watchedEpisodeKeys.length > 0) {
      existingRecord.watchedEpisodeKeys.forEach((k) => keys.add(k));
    } else if (existingRecord?.currentProgress && existingRecord.currentProgress > 0) {
      // Synthesize initial keys from currentProgress
      let remaining = existingRecord.currentProgress;
      const seasonList = existingRecord.seasons || seasons;
      if (seasonList.length > 0) {
        for (const s of seasonList) {
          for (let e = 1; e <= s.episodeCount && remaining > 0; e++) {
            keys.add(`s${s.seasonNumber}_e${e}`);
            remaining--;
          }
        }
      } else {
        for (let e = 1; e <= remaining; e++) {
          keys.add(`s1_e${e}`);
        }
      }
    }
    return keys;
  }, [existingRecord, seasons]);

  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(initialWatchedKeys);

  // Season episodes cache: record of seasonNumber -> EpisodeInfo[]
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, EpisodeInfo[]>>({});
  const [loadingSeasonEpisodes, setLoadingSeasonEpisodes] = useState<Record<number, boolean>>({});
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);

  // User tracking inputs
  const [status, setStatus] = useState<MediaStatus>(
    existingRecord ? existingRecord.status : 'watching'
  );
  const [score, setScore] = useState<number>(
    existingRecord ? existingRecord.userScore || 0 : 0
  );
  const [minutesWatched, setMinutesWatched] = useState<number>(
    existingRecord ? existingRecord.minutesWatched || 0 : 0
  );
  const [rewatchCount, setRewatchCount] = useState<number>(
    existingRecord ? existingRecord.rewatchCount || 0 : 0
  );
  const [notes, setNotes] = useState<string>(
    existingRecord ? existingRecord.notes || '' : ''
  );

  // Dates in DD.MM.YYYY
  const addedAt = existingRecord?.addedAt || new Date().toISOString();
  const [startedAt, setStartedAt] = useState<string>(
    existingRecord?.startedAt
      ? formatDateDDMMYYYY(existingRecord.startedAt)
      : (status === 'watching' ? getTodayDDMMYYYY() : '')
  );
  const [finishedAt, setFinishedAt] = useState<string>(
    existingRecord?.finishedAt
      ? formatDateDDMMYYYY(existingRecord.finishedAt)
      : (status === 'completed' ? getTodayDDMMYYYY() : '')
  );
  const [showDatesSection, setShowDatesSection] = useState(false);

  // Date picker modal state
  const [datePickerTarget, setDatePickerTarget] = useState<'started' | 'finished' | null>(null);

  // Total watched episodes count derived from watchedKeys
  const watchedEpisodesCount = watchedKeys.size;

  // Fetch missing TV/Movie details from TMDB
  useEffect(() => {
    let isMounted = true;
    if (apiKey && (totalEpisodes === null || runtimeMinutes === null || seasons.length === 0)) {
      TMDBService.getMediaDetails(id, mediaType, apiKey)
        .then((details) => {
          if (!isMounted) return;
          if (details.numberOfEpisodes) setTotalEpisodes(details.numberOfEpisodes);
          if (details.numberOfSeasons) setTotalSeasons(details.numberOfSeasons);
          if (details.seasons && details.seasons.length > 0) setSeasons(details.seasons);
          if (details.runtime) setRuntimeMinutes(details.runtime);
        })
        .finally(() => {
          if (isMounted) setIsLoadingDetails(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [id, mediaType, apiKey, totalEpisodes, runtimeMinutes, seasons.length]);

  // Load episodes of a specific season when expanded
  const handleToggleSeasonExpand = (seasonNumber: number) => {
    if (expandedSeason === seasonNumber) {
      setExpandedSeason(null);
      return;
    }
    setExpandedSeason(seasonNumber);

    // If not already fetched, load episodes
    if (!episodesBySeason[seasonNumber] && apiKey && mediaType === 'tv') {
      setLoadingSeasonEpisodes((prev) => ({ ...prev, [seasonNumber]: true }));
      TMDBService.getSeasonEpisodes(id, seasonNumber, apiKey)
        .then((episodes) => {
          setEpisodesBySeason((prev) => ({ ...prev, [seasonNumber]: episodes }));
        })
        .finally(() => {
          setLoadingSeasonEpisodes((prev) => ({ ...prev, [seasonNumber]: false }));
        });
    }
  };

  // Toggle single episode watched
  const handleToggleEpisode = (seasonNum: number, episodeNum: number) => {
    const key = `s${seasonNum}_e${episodeNum}`;
    setWatchedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      // Check auto completion
      if (totalEpisodes && next.size >= totalEpisodes && status !== 'completed') {
        setStatus('completed');
        if (!finishedAt) setFinishedAt(getTodayDDMMYYYY());
      } else if (next.size > 0 && status === 'plan_to_watch') {
        setStatus('watching');
        if (!startedAt) setStartedAt(getTodayDDMMYYYY());
      }

      return next;
    });
  };

  // Mark all episodes of a season as watched or clear
  const handleToggleWholeSeason = (seasonNum: number, episodeCount: number) => {
    setWatchedKeys((prev) => {
      const next = new Set(prev);
      let allWatched = true;
      for (let i = 1; i <= episodeCount; i++) {
        if (!next.has(`s${seasonNum}_e${i}`)) {
          allWatched = false;
          break;
        }
      }

      for (let i = 1; i <= episodeCount; i++) {
        const key = `s${seasonNum}_e${i}`;
        if (allWatched) {
          next.delete(key);
        } else {
          next.add(key);
        }
      }

      // Auto completion
      if (totalEpisodes && next.size >= totalEpisodes && status !== 'completed') {
        setStatus('completed');
        if (!finishedAt) setFinishedAt(getTodayDDMMYYYY());
      }

      return next;
    });
  };

  // Master episode counter: increment next unwatched episode
  const handleIncrementNextEpisode = () => {
    const targetSeasons = seasons.length > 0 ? seasons : [{ seasonNumber: 1, episodeCount: totalEpisodes || 999, name: 'Season 1' }];
    setWatchedKeys((prev) => {
      const next = new Set(prev);
      for (const s of targetSeasons) {
        for (let e = 1; e <= s.episodeCount; e++) {
          const key = `s${s.seasonNumber}_e${e}`;
          if (!next.has(key)) {
            next.add(key);
            if (totalEpisodes && next.size >= totalEpisodes && status !== 'completed') {
              setStatus('completed');
              if (!finishedAt) setFinishedAt(getTodayDDMMYYYY());
            } else if (status === 'plan_to_watch') {
              setStatus('watching');
              if (!startedAt) setStartedAt(getTodayDDMMYYYY());
            }
            return next;
          }
        }
      }
      return next;
    });
  };

  // Master episode counter: decrement last watched episode
  const handleDecrementLastEpisode = () => {
    const targetSeasons = seasons.length > 0 ? seasons : [{ seasonNumber: 1, episodeCount: totalEpisodes || 999, name: 'Season 1' }];
    setWatchedKeys((prev) => {
      const next = new Set(prev);
      // Iterate backwards
      for (let si = targetSeasons.length - 1; si >= 0; si--) {
        const s = targetSeasons[si];
        for (let e = s.episodeCount; e >= 1; e--) {
          const key = `s${s.seasonNumber}_e${e}`;
          if (next.has(key)) {
            next.delete(key);
            return next;
          }
        }
      }
      return next;
    });
  };

  // Mark entire show as watched
  const handleMarkEntireShowWatched = () => {
    const targetSeasons = seasons.length > 0 ? seasons : [{ seasonNumber: 1, episodeCount: totalEpisodes || 999, name: 'Season 1' }];
    const next = new Set<string>();
    for (const s of targetSeasons) {
      for (let e = 1; e <= s.episodeCount; e++) {
        next.add(`s${s.seasonNumber}_e${e}`);
      }
    }
    setWatchedKeys(next);
    setStatus('completed');
    if (!finishedAt) setFinishedAt(getTodayDDMMYYYY());
  };

  // Reset all watched episodes
  const handleResetAllEpisodes = () => {
    setWatchedKeys(new Set<string>());
    if (status === 'completed') {
      setStatus('watching');
      setFinishedAt('');
    }
  };

  // Status Change with Date and Progress Sync
  const handleStatusChange = (newStatus: MediaStatus) => {
    setStatus(newStatus);

    if (newStatus === 'completed') {
      if (!finishedAt) setFinishedAt(getTodayDDMMYYYY());
      // Fill episodes
      if (mediaType === 'tv') {
        handleMarkEntireShowWatched();
      } else if (mediaType === 'movie' && runtimeMinutes) {
        setMinutesWatched(runtimeMinutes);
      }
    } else if (newStatus === 'watching') {
      if (!startedAt) setStartedAt(getTodayDDMMYYYY());
      if (status === 'completed') setFinishedAt('');
    } else {
      if (status === 'completed') setFinishedAt('');
    }
  };

  // Movie minutes watched change
  const handleMinutesChange = (newVal: number) => {
    const minVal = 0;
    const maxVal = runtimeMinutes && runtimeMinutes > 0 ? runtimeMinutes : 999;
    const clamped = Math.max(minVal, Math.min(newVal, maxVal));
    setMinutesWatched(clamped);

    if (runtimeMinutes && clamped >= runtimeMinutes && status !== 'completed') {
      setStatus('completed');
      if (!finishedAt) setFinishedAt(getTodayDDMMYYYY());
    }
  };

  const handleSave = () => {
    const startedIso = parseDDMMYYYYtoIso(startedAt);
    const finishedIso = parseDDMMYYYYtoIso(finishedAt);

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

      // TV
      currentProgress: mediaType === 'tv' ? watchedEpisodesCount : undefined,
      totalProgress: totalEpisodes || undefined,
      totalEpisodes,
      totalSeasons,
      seasons: seasons.length > 0 ? seasons : undefined,
      watchedEpisodeKeys: mediaType === 'tv' ? Array.from(watchedKeys) : undefined,

      // Movie
      runtimeMinutes,
      minutesWatched: mediaType === 'movie' ? minutesWatched : undefined,
      rewatchCount: mediaType === 'movie' ? rewatchCount : undefined,

      // Dates
      addedAt,
      startedAt: startedIso,
      finishedAt: finishedIso,
      lastWatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      notes: notes.trim(),
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
            if (onRemove) onRemove(id, mediaType);
            onClose();
          },
        },
      ]
    );
  };

  const posterUrl = TMDBService.getImageUrl(posterPath, 'w342');
  const currentScoreLabel =
    MAL_SCORES.find((s) => s.score === score)?.label || 'Select Score';
  const startedIsoForLabel = parseDDMMYYYYtoIso(startedAt);
  const finishedIsoForLabel = parseDDMMYYYYtoIso(finishedAt);
  const durationLabel = getDurationLabel(startedIsoForLabel, finishedIsoForLabel, status === 'completed');

  // Seasons list to display
  const displaySeasons: SeasonInfo[] =
    seasons.length > 0
      ? seasons
      : totalEpisodes
      ? [{ seasonNumber: 1, episodeCount: totalEpisodes, name: 'Season 1' }]
      : [];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheetContainer}>
        {/* Header Bar */}
        <View style={styles.sheetHeader}>
          <View style={styles.handle} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
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

                {mediaType === 'tv' && (totalEpisodes || totalSeasons) ? (
                  <Text style={styles.metaText}>
                    {totalEpisodes ? `${totalEpisodes} eps` : ''}
                    {totalEpisodes && totalSeasons ? ' • ' : ''}
                    {totalSeasons ? `${totalSeasons} season${totalSeasons > 1 ? 's' : ''}` : ''}
                  </Text>
                ) : null}

                {mediaType === 'movie' && runtimeMinutes ? (
                  <Text style={styles.metaText}>{formatRuntime(runtimeMinutes)}</Text>
                ) : null}

                {releaseYear ? (
                  <Text style={styles.metaText}>({releaseYear})</Text>
                ) : null}

                {voteAverage ? (
                  <View style={styles.ratingTag}>
                    <Ionicons name="star" size={11} color="#f59e0b" />
                    <Text style={styles.ratingTagText}>{voteAverage.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>

              {isLoadingDetails && (
                <View style={styles.loadingDetailsRow}>
                  <ActivityIndicator size="small" color="#38bdf8" />
                  <Text style={styles.loadingDetailsText}>Loading seasons info...</Text>
                </View>
              )}
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
                  onPress={() => handleStatusChange(st)}>
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

          {/* TV Shows: Master Counter + Seasons Breakdown */}
          {mediaType === 'tv' && (
            <View style={styles.tvSection}>
              {/* Master Counter Header */}
              <View style={styles.progressCard}>
                <View style={styles.progressHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Episodes Watched</Text>
                    <Text style={styles.progressSubtitle}>
                      {totalEpisodes
                        ? `Overall: ${watchedEpisodesCount} of ${totalEpisodes} episodes`
                        : `${watchedEpisodesCount} episodes watched`}
                    </Text>
                  </View>

                  {totalEpisodes ? (
                    <View style={styles.fractionBadge}>
                      <Text style={styles.fractionBadgeText}>
                        {watchedEpisodesCount} / {totalEpisodes}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Master Stepper */}
                <View style={styles.stepperContainer}>
                  <Pressable
                    style={[styles.stepperBtn, watchedEpisodesCount <= 0 && styles.stepperDisabled]}
                    onPress={handleDecrementLastEpisode}
                    disabled={watchedEpisodesCount <= 0}>
                    <Ionicons name="remove" size={18} color="#ffffff" />
                  </Pressable>

                  <View style={styles.stepperValueContainer}>
                    <Text style={styles.stepperValue}>{watchedEpisodesCount}</Text>
                    <Text style={styles.stepperSubLabel}>
                      {totalEpisodes ? `of ${totalEpisodes}` : 'watched'}
                    </Text>
                  </View>

                  <Pressable
                    style={[
                      styles.stepperBtn,
                      totalEpisodes !== null && watchedEpisodesCount >= totalEpisodes && styles.stepperDisabled,
                    ]}
                    onPress={handleIncrementNextEpisode}
                    disabled={totalEpisodes !== null && watchedEpisodesCount >= totalEpisodes}>
                    <Ionicons name="add" size={18} color="#ffffff" />
                  </Pressable>
                </View>

                {/* Master Quick Actions */}
                <View style={styles.quickActionsRow}>
                  <Pressable style={styles.quickPill} onPress={handleIncrementNextEpisode}>
                    <Text style={styles.quickPillText}>+1 Ep</Text>
                  </Pressable>
                  {totalEpisodes ? (
                    <Pressable style={styles.quickPill} onPress={handleMarkEntireShowWatched}>
                      <Text style={styles.quickPillText}>All ({totalEpisodes})</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.quickPill} onPress={handleResetAllEpisodes}>
                    <Text style={styles.quickPillText}>Reset (0)</Text>
                  </Pressable>
                </View>
              </View>

              {/* Seasons & Episodes Breakdown Accordion */}
              <Text style={styles.sectionTitle}>Seasons & Episodes</Text>
              <Text style={styles.sectionSubHelp}>
                Tap any episode to mark as watched or unwatched. Tap season to view details.
              </Text>

              <View style={styles.seasonsAccordionContainer}>
                {displaySeasons.map((season) => {
                  const sNum = season.seasonNumber;
                  const epCount = season.episodeCount;
                  const isExpanded = expandedSeason === sNum;
                  const episodesList = episodesBySeason[sNum] || [];
                  const isLoadingSeason = loadingSeasonEpisodes[sNum];

                  // Count watched in this season
                  let seasonWatched = 0;
                  for (let i = 1; i <= epCount; i++) {
                    if (watchedKeys.has(`s${sNum}_e${i}`)) seasonWatched++;
                  }
                  const isSeasonComplete = seasonWatched >= epCount && epCount > 0;

                  return (
                    <View key={`season-${sNum}`} style={styles.seasonCard}>
                      {/* Season Header */}
                      <Pressable
                        style={styles.seasonHeader}
                        onPress={() => handleToggleSeasonExpand(sNum)}>
                        <View style={styles.seasonHeaderLeft}>
                          <Ionicons
                            name={isSeasonComplete ? 'checkmark-circle' : 'layers-outline'}
                            size={18}
                            color={isSeasonComplete ? '#22c55e' : '#38bdf8'}
                          />
                          <View>
                            <Text style={styles.seasonNameText}>
                              {season.name || `Season ${sNum}`}
                            </Text>
                            <Text style={styles.seasonMetaText}>
                              {seasonWatched} / {epCount} watched
                            </Text>
                          </View>
                        </View>

                        <View style={styles.seasonHeaderRight}>
                          <Pressable
                            style={[
                              styles.seasonCompleteBtn,
                              isSeasonComplete && styles.seasonCompleteBtnActive,
                            ]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleToggleWholeSeason(sNum, epCount);
                            }}>
                            <Text
                              style={[
                                styles.seasonCompleteBtnText,
                                isSeasonComplete && styles.seasonCompleteBtnTextActive,
                              ]}>
                              {isSeasonComplete ? 'Reset' : 'Complete'}
                            </Text>
                          </Pressable>

                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#94a3b8"
                          />
                        </View>
                      </Pressable>

                      {/* Expanded Episodes List */}
                      {isExpanded && (
                        <View style={styles.episodesListContainer}>
                          {isLoadingSeason ? (
                            <View style={styles.episodesLoadingRow}>
                              <ActivityIndicator size="small" color="#38bdf8" />
                              <Text style={styles.episodesLoadingText}>Loading episode details...</Text>
                            </View>
                          ) : (
                            Array.from({ length: epCount }).map((_, idx) => {
                              const epNum = idx + 1;
                              const epKey = `s${sNum}_e${epNum}`;
                              const isWatched = watchedKeys.has(epKey);
                              const detail = episodesList.find((e) => e.episodeNumber === epNum);

                              return (
                                <Pressable
                                  key={epKey}
                                  style={[
                                    styles.episodeRow,
                                    isWatched && styles.episodeRowWatched,
                                  ]}
                                  onPress={() => handleToggleEpisode(sNum, epNum)}>
                                  <View style={styles.episodeLeft}>
                                    <View
                                      style={[
                                        styles.checkbox,
                                        isWatched && styles.checkboxWatched,
                                      ]}>
                                      {isWatched && (
                                        <Ionicons name="checkmark" size={14} color="#ffffff" />
                                      )}
                                    </View>

                                    <View style={styles.episodeTextContainer}>
                                      <Text
                                        style={[
                                          styles.episodeTitleText,
                                          isWatched && styles.episodeTitleTextWatched,
                                        ]}
                                        numberOfLines={1}>
                                        {epNum}. {detail?.name || `Episode ${epNum}`}
                                      </Text>

                                      {(detail?.runtime || detail?.airDate) ? (
                                        <Text style={styles.episodeSubInfoText}>
                                          {detail?.runtime ? `${detail.runtime}m` : ''}
                                          {detail?.runtime && detail?.airDate ? ' • ' : ''}
                                          {detail?.airDate ? formatDateDisplay(detail.airDate) : ''}
                                        </Text>
                                      ) : null}
                                    </View>
                                  </View>

                                  <View
                                    style={[
                                      styles.watchedBadge,
                                      isWatched && styles.watchedBadgeActive,
                                    ]}>
                                    <Text
                                      style={[
                                        styles.watchedBadgeText,
                                        isWatched && styles.watchedBadgeTextActive,
                                      ]}>
                                      {isWatched ? 'Watched' : 'Unwatched'}
                                    </Text>
                                  </View>
                                </Pressable>
                              );
                            })
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Movies Section: Viewing Progress & Rewatches (NO episode counter) */}
          {mediaType === 'movie' && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Movie Viewing Progress</Text>
                  <Text style={styles.progressSubtitle}>
                    {runtimeMinutes
                      ? `Total Runtime: ${formatRuntime(runtimeMinutes)} (${runtimeMinutes} min)`
                      : 'Track viewing time'}
                  </Text>
                </View>

                {runtimeMinutes && minutesWatched > 0 ? (
                  <View style={styles.fractionBadge}>
                    <Text style={styles.fractionBadgeText}>
                      {minutesWatched} / {runtimeMinutes}m
                    </Text>
                  </View>
                ) : null}
              </View>

              {runtimeMinutes ? (
                <View style={styles.stepperContainer}>
                  <Pressable
                    style={[styles.stepperBtn, minutesWatched <= 0 && styles.stepperDisabled]}
                    onPress={() => handleMinutesChange(minutesWatched - 15)}
                    disabled={minutesWatched <= 0}>
                    <Ionicons name="remove" size={18} color="#ffffff" />
                  </Pressable>

                  <View style={styles.stepperValueContainer}>
                    <Text style={styles.stepperValue}>{minutesWatched}m</Text>
                    <Text style={styles.stepperSubLabel}>watched</Text>
                  </View>

                  <Pressable
                    style={[
                      styles.stepperBtn,
                      minutesWatched >= runtimeMinutes && styles.stepperDisabled,
                    ]}
                    onPress={() => handleMinutesChange(minutesWatched + 15)}
                    disabled={minutesWatched >= runtimeMinutes}>
                    <Ionicons name="add" size={18} color="#ffffff" />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.quickActionsRow}>
                {runtimeMinutes ? (
                  <>
                    <Pressable
                      style={styles.quickPill}
                      onPress={() => handleMinutesChange(runtimeMinutes)}>
                      <Text style={styles.quickPillText}>Watched Entire Movie</Text>
                    </Pressable>
                    <Pressable
                      style={styles.quickPill}
                      onPress={() => handleMinutesChange(minutesWatched + 30)}>
                      <Text style={styles.quickPillText}>+30m</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>

              {/* Rewatch Counter */}
              <View style={styles.rewatchRow}>
                <View style={styles.rewatchInfo}>
                  <Ionicons name="repeat" size={16} color="#38bdf8" />
                  <Text style={styles.rewatchText}>Rewatched:</Text>
                  <Text style={styles.rewatchCount}>{rewatchCount} times</Text>
                </View>
                <Pressable
                  style={styles.rewatchBtn}
                  onPress={() => setRewatchCount((c) => c + 1)}>
                  <Ionicons name="add" size={14} color="#ffffff" />
                  <Text style={styles.rewatchBtnText}>Rewatch</Text>
                </Pressable>
              </View>
            </View>
          )}

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

          {/* Dates & Timeline Accordion with Dynamic DatePicker */}
          <View style={styles.datesCard}>
            <Pressable
              style={styles.datesCardHeader}
              onPress={() => setShowDatesSection(!showDatesSection)}>
              <View style={styles.datesHeaderLeft}>
                <Ionicons name="calendar" size={18} color="#38bdf8" />
                <View>
                  <Text style={styles.datesCardTitle}>Dates & Timeline (DD.MM.YYYY)</Text>
                  {durationLabel ? (
                    <Text style={styles.durationSummaryText}>{durationLabel}</Text>
                  ) : (
                    <Text style={styles.datesSubText}>Added {getRelativeTime(addedAt)}</Text>
                  )}
                </View>
              </View>
              <Ionicons
                name={showDatesSection ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#94a3b8"
              />
            </Pressable>

            {showDatesSection && (
              <View style={styles.datesExpandedContent}>
                {/* Date Added */}
                <View style={styles.dateRow}>
                  <View style={styles.dateLabelGroup}>
                    <Text style={styles.dateLabel}>Date Added:</Text>
                    <Text style={styles.dateRelativeText}>
                      ({getRelativeTime(addedAt)})
                    </Text>
                  </View>
                  <Text style={styles.dateStaticValue}>{formatDateDisplay(addedAt)}</Text>
                </View>

                {/* Started Watching Date Picker Button */}
                <View style={styles.dateRow}>
                  <Text style={styles.dateLabel}>Started Watching:</Text>
                  <View style={styles.dateButtonGroup}>
                    <Pressable
                      style={styles.datePickerTriggerBtn}
                      onPress={() => setDatePickerTarget('started')}>
                      <Ionicons name="calendar-outline" size={14} color="#38bdf8" />
                      <Text
                        style={[
                          styles.datePickerTriggerText,
                          !startedAt && styles.datePickerTriggerPlaceholder,
                        ]}>
                        {startedAt || 'DD.MM.YYYY'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.dateQuickBtn}
                      onPress={() => setStartedAt(getTodayDDMMYYYY())}>
                      <Text style={styles.dateQuickText}>Today</Text>
                    </Pressable>

                    {startedAt ? (
                      <Pressable
                        style={styles.dateClearBtn}
                        onPress={() => setStartedAt('')}>
                        <Ionicons name="close-circle" size={16} color="#64748b" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* Finished Watching Date Picker Button */}
                <View style={styles.dateRow}>
                  <Text style={styles.dateLabel}>Finished Watching:</Text>
                  <View style={styles.dateButtonGroup}>
                    <Pressable
                      style={styles.datePickerTriggerBtn}
                      onPress={() => setDatePickerTarget('finished')}>
                      <Ionicons name="calendar-outline" size={14} color="#38bdf8" />
                      <Text
                        style={[
                          styles.datePickerTriggerText,
                          !finishedAt && styles.datePickerTriggerPlaceholder,
                        ]}>
                        {finishedAt || 'DD.MM.YYYY'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.dateQuickBtn}
                      onPress={() => setFinishedAt(getTodayDDMMYYYY())}>
                      <Text style={styles.dateQuickText}>Today</Text>
                    </Pressable>

                    {finishedAt ? (
                      <Pressable
                        style={styles.dateClearBtn}
                        onPress={() => setFinishedAt('')}>
                        <Ionicons name="close-circle" size={16} color="#64748b" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* Duration Label */}
                {durationLabel && (
                  <View style={styles.durationPillContainer}>
                    <Ionicons name="time-outline" size={14} color="#38bdf8" />
                    <Text style={styles.durationPillText}>{durationLabel}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Notes Input (Keyboard avoiding & accessible) */}
          <Text style={styles.sectionTitle}>Personal Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Favorite moments, thoughts, watched with..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={4}
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

      {/* Interactive Visual DatePicker Modal */}
      <DatePickerModal
        visible={datePickerTarget !== null}
        title={datePickerTarget === 'started' ? 'Select Start Date' : 'Select Finish Date'}
        initialDate={datePickerTarget === 'started' ? startedAt : finishedAt}
        onClose={() => setDatePickerTarget(null)}
        onSelectDate={(newDate) => {
          if (datePickerTarget === 'started') setStartedAt(newDate);
          else if (datePickerTarget === 'finished') setFinishedAt(newDate);
          setDatePickerTarget(null);
        }}
        onClearDate={() => {
          if (datePickerTarget === 'started') setStartedAt('');
          else if (datePickerTarget === 'finished') setFinishedAt('');
          setDatePickerTarget(null);
        }}
      />
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    maxHeight: '94%',
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
    paddingBottom: 140, // Generous padding so text inputs are never covered by Android keyboard
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
    flexWrap: 'wrap',
    gap: 6,
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
  loadingDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  loadingDetailsText: {
    color: '#38bdf8',
    fontSize: 11,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionSubHelp: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 10,
    lineHeight: 15,
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
  tvSection: {
    marginBottom: 16,
  },
  progressCard: {
    backgroundColor: '#161922',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#232838',
    marginBottom: 16,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  progressSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  fractionBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fractionBadgeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 4,
  },
  stepperBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperDisabled: {
    backgroundColor: '#1e293b',
    opacity: 0.4,
  },
  stepperValueContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  stepperValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  stepperSubLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  quickPill: {
    backgroundColor: '#1f2432',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262d3d',
  },
  quickPillText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  seasonsAccordionContainer: {
    gap: 8,
    marginBottom: 16,
  },
  seasonCard: {
    backgroundColor: '#161922',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#232838',
    overflow: 'hidden',
  },
  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  seasonHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  seasonNameText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  seasonMetaText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  seasonHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  seasonCompleteBtn: {
    backgroundColor: '#1f2432',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262d3d',
  },
  seasonCompleteBtnActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22c55e',
  },
  seasonCompleteBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  seasonCompleteBtnTextActive: {
    color: '#22c55e',
  },
  episodesListContainer: {
    borderTopWidth: 1,
    borderTopColor: '#232838',
    backgroundColor: '#12151c',
    paddingVertical: 4,
  },
  episodesLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  episodesLoadingText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  episodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2b',
  },
  episodeRowWatched: {
    backgroundColor: 'rgba(34, 197, 94, 0.04)',
  },
  episodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxWatched: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  episodeTextContainer: {
    flex: 1,
  },
  episodeTitleText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  episodeTitleTextWatched: {
    color: '#cbd5e1',
  },
  episodeSubInfoText: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  watchedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#1a1f2b',
  },
  watchedBadgeActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  watchedBadgeText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  watchedBadgeTextActive: {
    color: '#22c55e',
  },
  rewatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#232838',
  },
  rewatchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewatchText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  rewatchCount: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  rewatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  rewatchBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
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
  datesCard: {
    backgroundColor: '#161922',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#232838',
    marginBottom: 20,
    overflow: 'hidden',
  },
  datesCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  datesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  datesCardTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  durationSummaryText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  datesSubText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  datesExpandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#232838',
    gap: 12,
    paddingTop: 12,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  dateRelativeText: {
    color: '#64748b',
    fontSize: 11,
  },
  dateStaticValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  dateButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  datePickerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0d0f15',
    borderWidth: 1,
    borderColor: '#262d3d',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  datePickerTriggerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  datePickerTriggerPlaceholder: {
    color: '#64748b',
    fontWeight: '500',
  },
  dateQuickBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dateQuickText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  dateClearBtn: {
    padding: 2,
  },
  durationPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  durationPillText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#232838',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    minHeight: 80,
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
