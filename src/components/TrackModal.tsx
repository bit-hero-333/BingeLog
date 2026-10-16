import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Keyboard,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/context/ThemeContext';
import {
  TMDBMediaItem,
  TrackedItem,
  MediaStatus,
  STATUS_CONFIG,
  MAL_SCORES,
  MediaType,
  SeasonInfo,
  EpisodeInfo,
  DetailedMediaInfo,
  EntitySelection,
  ItemReminderConfig,
} from '@/types/media';
import { TMDBService } from '@/services/tmdb';
import { useMedia } from '@/context/MediaContext';
import {
  formatDate,
  formatDateDisplay,
  formatDateInput,
  parseFormattedDateToIso,
  getTodayFormatted,
  getRelativeTime,
  getDurationLabel,
  formatRuntime,
  getCountdownInfo,
} from '@/utils/date';
import { DatePickerModal } from '@/components/DatePickerModal';
import { EntityModal } from '@/components/EntityModal';
import { EpisodeDetailModal } from '@/components/EpisodeDetailModal';
import { ReleaseReminderModal } from '@/components/ReleaseReminderModal';

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
  const router = useRouter();
  const {
    apiKey,
    showSeasonEpisodeImages,
    showActorImages,
    showAllCast,
    showSeasonSpecials,
    sizingConfig,
    setActiveDiscoverFilter,
    triggerHaptic,
    dateFormat,
    selectedRegion,
    selectedTimezone,
    remindersEnabled,
    deviceNotificationsEnabled,
  } = useMedia();

  const [showReminderModal, setShowReminderModal] = useState(false);

  const { width, height: windowHeight } = useWindowDimensions();
  const isTablet = width >= 720;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const { colors } = useAppTheme();

  const [translateY] = useState(() => new Animated.Value(0));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 70 || gestureState.vy > 0.6) {
            triggerHaptic('selection');
            Animated.timing(translateY, {
              toValue: 600,
              duration: 160,
              useNativeDriver: true,
            }).start(() => {
              onClose();
              translateY.setValue(0);
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
      }),
    [onClose, triggerHaptic, translateY]
  );

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const [localShowSpecials, setLocalShowSpecials] = useState<boolean>(showSeasonSpecials);

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

  // Detailed TMDB media info state
  const [detailedInfo, setDetailedInfo] = useState<DetailedMediaInfo | null>(null);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [localShowAllCast, setLocalShowAllCast] = useState(showAllCast);

  // Selected Entity for Slide-up Sheet (Actors, Studios, Genres)
  const [selectedEntity, setSelectedEntity] = useState<EntitySelection | null>(null);

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
  const [isLoadingDetails, setIsLoadingDetails] = useState(Boolean(apiKey));

  // Granular episode tracking state: Set of "s{season}_e{episode}"
  const initialWatchedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (existingRecord?.watchedEpisodeKeys && existingRecord.watchedEpisodeKeys.length > 0) {
      existingRecord.watchedEpisodeKeys.forEach((k) => keys.add(k));
    } else if (existingRecord?.currentProgress && existingRecord.currentProgress > 0) {
      let remaining = existingRecord.currentProgress;
      const seasonList = (existingRecord.seasons || seasons).filter((s) => s.seasonNumber > 0);
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

  // User tracking inputs:
  // If untracked, status starts as null (no auto-assignment!)
  const [status, setStatus] = useState<MediaStatus | null>(
    existingRecord ? existingRecord.status : null
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

  // Dates:
  // If untracked, dates start EMPTY until user picks or selects status
  const addedAt = existingRecord?.addedAt || new Date().toISOString();
  const [startedAt, setStartedAt] = useState<string>(
    existingRecord?.startedAt
      ? formatDateInput(existingRecord.startedAt, dateFormat)
      : ''
  );
  const [finishedAt, setFinishedAt] = useState<string>(
    existingRecord?.finishedAt
      ? formatDateInput(existingRecord.finishedAt, dateFormat)
      : ''
  );
  const [showDatesSection, setShowDatesSection] = useState(false);

  // Date picker modal state
  const [datePickerTarget, setDatePickerTarget] = useState<'started' | 'finished' | null>(null);

  // Episode detail sheet state
  const [selectedEpisodeForDetail, setSelectedEpisodeForDetail] = useState<{
    sNum: number;
    epNum: number;
    detail?: EpisodeInfo;
    isWatched: boolean;
  } | null>(null);

  // Sync TMDB state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleSyncTMDB = async () => {
    if (!apiKey || isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const details = await TMDBService.getMediaDetails(id, mediaType, apiKey, selectedRegion);
      setDetailedInfo(details);
      if (mediaType === 'tv') {
        if (details.numberOfEpisodes) setTotalEpisodes(details.numberOfEpisodes);
        if (details.numberOfSeasons) setTotalSeasons(details.numberOfSeasons);
        if (details.seasons && details.seasons.length > 0) setSeasons(details.seasons);
      }
      if (mediaType === 'movie' && details.runtime) {
        setRuntimeMinutes(details.runtime);
      }
      setSyncFeedback('Synced with TMDB!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch {
      setSyncFeedback('Sync failed');
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Regular episodes count (seasons > 0)
  const regularEpisodesCount = useMemo(() => {
    let count = 0;
    watchedKeys.forEach((k) => {
      if (!k.startsWith('s0_')) count++;
    });
    return count;
  }, [watchedKeys]);

  // Specials watched count (season 0)
  const specialsEpisodesCount = useMemo(() => {
    let count = 0;
    watchedKeys.forEach((k) => {
      if (k.startsWith('s0_')) count++;
    });
    return count;
  }, [watchedKeys]);

  // Total canonical watched episodes count (excluding specials from progress totals)
  const watchedEpisodesCount = regularEpisodesCount;

  // Responsive UI Scales derived from sizingConfig
  const synopsisFontSize =
    sizingConfig.textSize === 'small'
      ? 11
      : sizingConfig.textSize === 'large'
      ? 14
      : sizingConfig.textSize === 'xlarge'
      ? 16
      : 12.5;

  const actorAvatarSize =
    sizingConfig.castSize === 'small'
      ? 38
      : sizingConfig.castSize === 'large'
      ? 56
      : sizingConfig.castSize === 'xlarge'
      ? 68
      : 46;
  const actorCardWidth = Math.max(76, actorAvatarSize + 32);
  const actorNameFontSize =
    sizingConfig.castSize === 'small'
      ? 9.5
      : sizingConfig.castSize === 'large'
      ? 11.5
      : sizingConfig.castSize === 'xlarge'
      ? 12.5
      : 10.5;

  const tagFontSize =
    sizingConfig.tagSize === 'small'
      ? 10
      : sizingConfig.tagSize === 'large'
      ? 12.5
      : sizingConfig.tagSize === 'xlarge'
      ? 14
      : 11;
  const tagPadV =
    sizingConfig.tagSize === 'small'
      ? 2
      : sizingConfig.tagSize === 'large'
      ? 5
      : sizingConfig.tagSize === 'xlarge'
      ? 7
      : 3;
  const tagPadH =
    sizingConfig.tagSize === 'small'
      ? 6
      : sizingConfig.tagSize === 'large'
      ? 10
      : sizingConfig.tagSize === 'xlarge'
      ? 12
      : 8;

  const epRowPadV =
    sizingConfig.rowDensity === 'small'
      ? 6
      : sizingConfig.rowDensity === 'large'
      ? 12
      : sizingConfig.rowDensity === 'xlarge'
      ? 15
      : 8;

  const seasonHeaderFontSize =
    sizingConfig.seasonEpisodeSize === 'small'
      ? 14
      : sizingConfig.seasonEpisodeSize === 'large'
      ? 18
      : sizingConfig.seasonEpisodeSize === 'xlarge'
      ? 20
      : 16;

  const episodeTitleFontSize =
    sizingConfig.seasonEpisodeSize === 'small'
      ? 13
      : sizingConfig.seasonEpisodeSize === 'large'
      ? 17
      : sizingConfig.seasonEpisodeSize === 'xlarge'
      ? 19
      : 15;

  const episodeStillWidth =
    sizingConfig.seasonEpisodeSize === 'small'
      ? 64
      : sizingConfig.seasonEpisodeSize === 'large'
      ? 100
      : sizingConfig.seasonEpisodeSize === 'xlarge'
      ? 120
      : 80;

  const episodeStillHeight = Math.round(episodeStillWidth * (9 / 16));

  const episodeCheckboxSize =
    sizingConfig.seasonEpisodeSize === 'small'
      ? 20
      : sizingConfig.seasonEpisodeSize === 'large'
      ? 28
      : sizingConfig.seasonEpisodeSize === 'xlarge'
      ? 32
      : 24;

  // Fetch full TV/Movie details from TMDB
  useEffect(() => {
    let isMounted = true;
    if (apiKey) {
      TMDBService.getMediaDetails(id, mediaType, apiKey, selectedRegion)
        .then((details) => {
          if (!isMounted) return;
          setDetailedInfo(details);
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
  }, [id, mediaType, apiKey, selectedRegion]);

  // Load episodes of a specific season when expanded
  const handleToggleSeasonExpand = (seasonNumber: number) => {
    triggerHaptic('selection');
    if (expandedSeason === seasonNumber) {
      setExpandedSeason(null);
      return;
    }
    setExpandedSeason(seasonNumber);

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
    triggerHaptic('impact');
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
        if (!finishedAt) setFinishedAt(getTodayFormatted(dateFormat));
      } else if (next.size > 0 && (!status || status === 'plan_to_watch')) {
        setStatus('watching');
        if (!startedAt) setStartedAt(getTodayFormatted(dateFormat));
      }

      return next;
    });
  };

  // Mark all episodes of a season as watched or clear
  const handleToggleWholeSeason = (seasonNum: number, episodeCount: number) => {
    triggerHaptic('impact');
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
        if (!finishedAt) setFinishedAt(getTodayFormatted(dateFormat));
      } else if (next.size > 0 && (!status || status === 'plan_to_watch')) {
        setStatus('watching');
        if (!startedAt) setStartedAt(getTodayFormatted(dateFormat));
      }

      return next;
    });
  };

  // Master episode counter: increment next unwatched episode
  const handleIncrementNextEpisode = () => {
    triggerHaptic('impact');
    const regularList = seasons.filter((s) => s.seasonNumber > 0);
    const targetSeasons = regularList.length > 0 ? regularList : (seasons.length > 0 ? seasons : [{ seasonNumber: 1, episodeCount: totalEpisodes || 999, name: 'Season 1' }]);
    setWatchedKeys((prev) => {
      const next = new Set(prev);
      for (const s of targetSeasons) {
        for (let e = 1; e <= s.episodeCount; e++) {
          const key = `s${s.seasonNumber}_e${e}`;
          if (!next.has(key)) {
            next.add(key);
            let regularWatched = 0;
            next.forEach((k) => {
              if (!k.startsWith('s0_')) regularWatched++;
            });
            if (totalEpisodes && regularWatched >= totalEpisodes && status !== 'completed') {
              setStatus('completed');
              if (!finishedAt) setFinishedAt(getTodayFormatted(dateFormat));
            } else if (!status || status === 'plan_to_watch') {
              setStatus('watching');
              if (!startedAt) setStartedAt(getTodayFormatted(dateFormat));
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
    triggerHaptic('selection');
    const regularList = seasons.filter((s) => s.seasonNumber > 0);
    const targetSeasons = regularList.length > 0 ? regularList : (seasons.length > 0 ? seasons : [{ seasonNumber: 1, episodeCount: totalEpisodes || 999, name: 'Season 1' }]);
    setWatchedKeys((prev) => {
      const next = new Set(prev);
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

  // Mark entire show as watched (regular seasons)
  const handleMarkEntireShowWatched = () => {
    triggerHaptic('success');
    const regularList = seasons.filter((s) => s.seasonNumber > 0);
    const targetSeasons = regularList.length > 0 ? regularList : (seasons.length > 0 ? seasons : [{ seasonNumber: 1, episodeCount: totalEpisodes || 999, name: 'Season 1' }]);
    const next = new Set<string>();
    // Preserve any existing specials that were already marked watched
    watchedKeys.forEach((k) => {
      if (k.startsWith('s0_')) next.add(k);
    });
    for (const s of targetSeasons) {
      for (let e = 1; e <= s.episodeCount; e++) {
        next.add(`s${s.seasonNumber}_e${e}`);
      }
    }
    setWatchedKeys(next);
    setStatus('completed');
    if (!finishedAt) setFinishedAt(getTodayFormatted(dateFormat));
  };

  // Reset all watched episodes
  const handleResetAllEpisodes = () => {
    triggerHaptic('warning');
    setWatchedKeys(new Set<string>());
    if (status === 'completed') {
      setStatus('watching');
      setFinishedAt('');
    }
  };

  // TV Show fresh rewatch flow
  const handleStartTvRewatch = () => {
    Alert.alert(
      'Start New Rewatch Run',
      `Starting a rewatch will increment your total rewatch count to ${rewatchCount + 1} and reset your current watched episodes to 0 so you can track your new run from Episode 1.\n\nYour score, reviews, and completion history are preserved. Ready to begin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Rewatch',
          style: 'default',
          onPress: () => {
            triggerHaptic('success');
            setRewatchCount((c) => c + 1);
            setStatus('watching');
            setWatchedKeys(new Set<string>());
            setStartedAt(getTodayFormatted(dateFormat));
            setFinishedAt('');
          },
        },
      ]
    );
  };

  // Movie fresh rewatch flow
  const handleStartMovieRewatch = () => {
    Alert.alert(
      'Start Movie Rewatch',
      `Starting a rewatch will increment your rewatch count to ${rewatchCount + 1} and reset watched minutes to 0m so you can track your rewatch run.\n\nYour score and review are preserved. Ready to begin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Rewatch',
          style: 'default',
          onPress: () => {
            triggerHaptic('success');
            setRewatchCount((c) => c + 1);
            setStatus('watching');
            setMinutesWatched(0);
            setStartedAt(getTodayFormatted(dateFormat));
            setFinishedAt('');
          },
        },
      ]
    );
  };

  // Status Change with Date and Progress Sync
  const handleStatusChange = (newStatus: MediaStatus) => {
    triggerHaptic('selection');
    setStatus(newStatus);

    if (newStatus === 'completed') {
      if (!finishedAt) setFinishedAt(getTodayFormatted(dateFormat));
      if (mediaType === 'tv') {
        handleMarkEntireShowWatched();
      } else if (mediaType === 'movie' && runtimeMinutes) {
        setMinutesWatched(runtimeMinutes);
      }
    } else if (newStatus === 'watching') {
      if (!startedAt) setStartedAt(getTodayFormatted(dateFormat));
      if (status === 'completed') setFinishedAt('');
    } else {
      if (status === 'completed') setFinishedAt('');
    }
  };

  // Movie minutes watched change
  const handleMinutesChange = (newVal: number) => {
    triggerHaptic('selection');
    const minVal = 0;
    const maxVal = runtimeMinutes && runtimeMinutes > 0 ? runtimeMinutes : 999;
    const clamped = Math.max(minVal, Math.min(newVal, maxVal));
    setMinutesWatched(clamped);

    if (runtimeMinutes && clamped >= runtimeMinutes && status !== 'completed') {
      setStatus('completed');
      if (!finishedAt) setFinishedAt(getTodayFormatted(dateFormat));
    } else if (clamped > 0 && (!status || status === 'plan_to_watch')) {
      setStatus('watching');
      if (!startedAt) setStartedAt(getTodayFormatted(dateFormat));
    }
  };

  const handleSave = () => {
    if (!status) {
      triggerHaptic('warning');
      Alert.alert(
        'Select a Status',
        'Please select a tracking status (such as Watching or Plan to Watch) before adding this item to your list.'
      );
      return;
    }

    const startedIso = parseFormattedDateToIso(startedAt, dateFormat);
    const finishedIso = parseFormattedDateToIso(finishedAt, dateFormat);

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
      rewatchCount: rewatchCount > 0 ? rewatchCount : undefined,

      // Rich metadata
      tagline: detailedInfo?.tagline || existingRecord?.tagline,
      genres: detailedInfo?.genres
        ? detailedInfo.genres.map((g) => g.name)
        : existingRecord?.genres,
      studios: detailedInfo?.studios
        ? detailedInfo.studios.map((s) => s.name)
        : existingRecord?.studios,
      creators: detailedInfo?.creators
        ? detailedInfo.creators.map((c) => c.name)
        : existingRecord?.creators,

      // Dates
      addedAt,
      startedAt: startedIso,
      finishedAt: finishedIso,
      lastWatchedAt: new Date().toISOString(),
      lastSyncedAt: existingRecord?.lastSyncedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Regional Release & Air Dates
      releaseDate:
        detailedInfo?.releaseDate ||
        (typeof releaseDate === 'string' ? releaseDate : undefined) ||
        existingRecord?.releaseDate,
      regionalReleaseDate:
        detailedInfo?.regionalReleaseDate || existingRecord?.regionalReleaseDate,
      regionalReleaseType:
        detailedInfo?.regionalReleaseType || existingRecord?.regionalReleaseType,
      nextAirDate: detailedInfo?.nextAirDate || existingRecord?.nextAirDate,
      nextEpisode: detailedInfo?.nextEpisode || existingRecord?.nextEpisode,

      notes: notes.trim(),
    };
    triggerHaptic('success');
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
            triggerHaptic('warning');
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
  const startedIsoForLabel = parseFormattedDateToIso(startedAt, dateFormat);
  const finishedIsoForLabel = parseFormattedDateToIso(finishedAt, dateFormat);
  const durationLabel = getDurationLabel(startedIsoForLabel, finishedIsoForLabel, status === 'completed');

  // Check if specials exist in seasons list
  const hasSpecials = useMemo(() => {
    return seasons.some((s) => s.seasonNumber === 0);
  }, [seasons]);

  // Display seasons (respecting local/global showSeasonSpecials toggle)
  const displaySeasons: SeasonInfo[] = useMemo(() => {
    if (seasons.length === 0) {
      return totalEpisodes
        ? [{ seasonNumber: 1, episodeCount: totalEpisodes, name: 'Season 1' }]
        : [];
    }
    return localShowSpecials ? seasons : seasons.filter((s) => s.seasonNumber > 0);
  }, [seasons, totalEpisodes, localShowSpecials]);

  const rawCastList = detailedInfo?.cast || [];
  const displayCast = localShowAllCast ? rawCastList : rawCastList.slice(0, 10);

  const effectiveMovieDate =
    detailedInfo?.regionalReleaseDate ||
    (existingRecord as TrackedItem)?.regionalReleaseDate ||
    detailedInfo?.releaseDate ||
    (existingRecord as TrackedItem)?.releaseDate ||
    (typeof releaseDate === 'string' ? releaseDate : undefined);

  const movieCountdown = useMemo(() => {
    if (!effectiveMovieDate || !remindersEnabled || mediaType !== 'movie') return null;
    const info = getCountdownInfo(effectiveMovieDate, selectedTimezone);
    return info.isUpcoming ? info : null;
  }, [effectiveMovieDate, remindersEnabled, mediaType, selectedTimezone]);

  const effectiveTvNextAirDate =
    detailedInfo?.nextAirDate ||
    (existingRecord as TrackedItem)?.nextAirDate ||
    detailedInfo?.nextEpisode?.airDate ||
    (existingRecord as TrackedItem)?.nextEpisode?.airDate;

  const tvNextEpisode =
    detailedInfo?.nextEpisode ||
    (existingRecord as TrackedItem)?.nextEpisode;

  const tvCountdown = useMemo(() => {
    if (!effectiveTvNextAirDate || !remindersEnabled || mediaType !== 'tv') return null;
    const info = getCountdownInfo(effectiveTvNextAirDate, selectedTimezone);
    return info.isUpcoming ? info : null;
  }, [effectiveTvNextAirDate, remindersEnabled, mediaType, selectedTimezone]);

  const isReminderActive = existingRecord?.reminder
    ? existingRecord.reminder.enabled
    : deviceNotificationsEnabled;

  const handleSaveReminder = (config: ItemReminderConfig) => {
    if (existingRecord) {
      const updated: TrackedItem = {
        ...existingRecord,
        reminder: config,
        updatedAt: new Date().toISOString(),
      };
      onSave(updated);
    } else {
      const record: TrackedItem = {
        id,
        mediaType,
        title,
        posterPath: posterPath || null,
        releaseYear: releaseYear || undefined,
        voteAverage: voteAverage || undefined,
        overview: ('overview' in item && item.overview) || detailedInfo?.tagline || '',
        status: 'plan_to_watch',
        userScore: 0,
        totalEpisodes: totalEpisodes || undefined,
        totalSeasons: totalSeasons || undefined,
        runtimeMinutes: runtimeMinutes || undefined,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        releaseDate: effectiveMovieDate,
        regionalReleaseDate: detailedInfo?.regionalReleaseDate,
        regionalReleaseType: detailedInfo?.regionalReleaseType,
        nextAirDate: effectiveTvNextAirDate,
        nextEpisode: tvNextEpisode,
        reminder: config,
      };
      onSave(record);
    }
  };

  const handleRemoveReminder = () => {
    if (existingRecord) {
      const updated: TrackedItem = {
        ...existingRecord,
        reminder: {
          enabled: false,
          timing: 'both',
          daysAhead: 1,
          hour: 9,
        },
        updatedAt: new Date().toISOString(),
      };
      onSave(updated);
    }
  };

  // 1. Media Summary Info
  const renderMediaSummary = () => (
    <>
          <View style={[styles.mediaSummary, { borderBottomColor: colors.divider }]}>
            <View style={[styles.posterWrapper, { backgroundColor: colors.cardBorder }]}>
              {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
              ) : (
                <View style={[styles.poster, styles.posterFallback]}>
                  <Ionicons name="film-outline" size={24} color={colors.textSecondary} />
                </View>
              )}
            </View>

            <View style={styles.summaryDetails}>
              <View style={styles.titleRow}>
                <Text style={[styles.mediaTitle, { color: colors.text }]} numberOfLines={2} selectable={true}>
                  {title}
                </Text>
                <View style={styles.headerActions}>
                  {syncFeedback ? (
                    <View style={[styles.syncFeedbackBadge, { backgroundColor: colors.primaryBg }]}>
                      <Text style={[styles.syncFeedbackText, { color: colors.primary }]}>{syncFeedback}</Text>
                    </View>
                  ) : null}
                  {apiKey ? (
                    <Pressable
                      onPress={handleSyncTMDB}
                      style={[styles.syncButton, { backgroundColor: colors.inputBg }]}
                      disabled={isSyncing}
                      hitSlop={8}>
                      {isSyncing ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="cloud-download-outline" size={19} color={colors.primary} />
                      )}
                    </Pressable>
                  ) : null}
                  <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.metaBadgeRow}>
                <View style={[styles.typeTag, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[styles.typeTagText, { color: colors.primary }]}>{mediaType.toUpperCase()}</Text>
                </View>

                {mediaType === 'tv' && (totalEpisodes || totalSeasons) ? (
                  <Text style={[styles.metaText, { color: colors.textSecondary }]} selectable={true}>
                    {totalEpisodes ? `${totalEpisodes} eps` : ''}
                    {totalEpisodes && totalSeasons ? ' • ' : ''}
                    {totalSeasons ? `${totalSeasons} season${totalSeasons > 1 ? 's' : ''}` : ''}
                  </Text>
                ) : null}

                {mediaType === 'movie' && runtimeMinutes ? (
                  <Text style={[styles.metaText, { color: colors.textSecondary }]} selectable={true}>
                    {formatRuntime(runtimeMinutes)}
                  </Text>
                ) : null}

                {releaseYear ? (
                  <Text style={[styles.metaText, { color: colors.textSecondary }]} selectable={true}>
                    ({releaseYear})
                  </Text>
                ) : null}

                {voteAverage ? (
                  <View style={styles.ratingTag}>
                    <Ionicons name="star" size={11} color="#f59e0b" />
                    <Text style={styles.ratingTagText} selectable={true}>
                      {voteAverage.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {movieCountdown && (
                <Pressable
                  style={({ pressed }) => [
                    styles.countdownBanner,
                    { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setShowReminderModal(true);
                  }}>
                  <View style={[styles.countdownIconWrap, { backgroundColor: colors.card }]}>
                    <Ionicons
                      name={isReminderActive ? 'notifications' : 'notifications-outline'}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.countdownBannerContent}>
                    <View style={styles.countdownBannerTop}>
                      <Text style={[styles.countdownBannerTitle, { color: colors.text }]} numberOfLines={1}>
                        {detailedInfo?.regionalReleaseType || 'Release'}: {formatDate(effectiveMovieDate, dateFormat)}
                      </Text>
                      <View style={[styles.countdownPill, { backgroundColor: colors.primary }]}>
                        <Text style={styles.countdownPillText}>{movieCountdown.formattedCountdown}</Text>
                      </View>
                    </View>
                    <View style={styles.countdownBannerSubRow}>
                      <Text style={[styles.countdownBannerSub, { color: colors.textSecondary }]}>
                        Tap to manage alert • Region: {selectedRegion}
                      </Text>
                      <View
                        style={[
                          styles.reminderStatusPill,
                          { backgroundColor: isReminderActive ? colors.primary : colors.cardBorder },
                        ]}>
                        <Text style={styles.reminderStatusPillText}>
                          {isReminderActive ? 'Alert On' : 'Alert Off'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              )}

              {tvCountdown && (
                <Pressable
                  style={({ pressed }) => [
                    styles.countdownBanner,
                    { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setShowReminderModal(true);
                  }}>
                  <View style={[styles.countdownIconWrap, { backgroundColor: colors.card }]}>
                    <Ionicons
                      name={isReminderActive ? 'notifications' : 'notifications-outline'}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.countdownBannerContent}>
                    <View style={styles.countdownBannerTop}>
                      <Text style={[styles.countdownBannerTitle, { color: colors.text }]} numberOfLines={1}>
                        {tvNextEpisode ? `S${tvNextEpisode.seasonNumber} E${tvNextEpisode.episodeNumber}` : 'Next Episode'}: {formatDate(effectiveTvNextAirDate, dateFormat)}
                      </Text>
                      <View style={[styles.countdownPill, { backgroundColor: colors.primary }]}>
                        <Text style={styles.countdownPillText}>{tvCountdown.formattedCountdown}</Text>
                      </View>
                    </View>
                    <View style={styles.countdownBannerSubRow}>
                      <Text style={[styles.countdownBannerSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        Tap to manage alert • {selectedTimezone.split('/').pop()?.replace(/_/g, ' ') || selectedTimezone}
                      </Text>
                      <View
                        style={[
                          styles.reminderStatusPill,
                          { backgroundColor: isReminderActive ? colors.primary : colors.cardBorder },
                        ]}>
                        <Text style={styles.reminderStatusPillText}>
                          {isReminderActive ? 'Alert On' : 'Alert Off'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              )}

              {isLoadingDetails && (
                <View style={styles.loadingDetailsRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.loadingDetailsText, { color: colors.primary }]}>Loading extra info...</Text>
                </View>
              )}
            </View>
          </View>

    </>
  );

  // 2. Rich Media Details (tagline, genres, synopsis, cast, creators)
  const renderRichInfo = () => (
    <>
          <View style={[styles.richInfoSection, { borderBottomColor: colors.divider }]}>
            {detailedInfo?.tagline ? (
              <Text style={[styles.taglineText, { color: colors.textSecondary }]} selectable={true}>
                &ldquo;{detailedInfo.tagline}&rdquo;
              </Text>
            ) : null}

            {detailedInfo?.genres && detailedInfo.genres.length > 0 ? (
              <View style={styles.genreChipsRow}>
                {detailedInfo.genres.map((g) => (
                  <Pressable
                    key={g.id}
                    style={[
                      styles.genreChip,
                      {
                        paddingVertical: tagPadV,
                        paddingHorizontal: tagPadH,
                        backgroundColor: colors.inputBg,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                    onPress={() =>
                      setSelectedEntity({
                        type: 'genre',
                        id: g.id,
                        name: g.name,
                      })
                    }>
                    <Text style={[styles.genreChipText, { fontSize: tagFontSize, color: colors.textSecondary }]}>
                      {g.name}
                    </Text>
                    <Ionicons name="search" size={9} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {overview ? (
              <View style={[styles.synopsisContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                <Text
                  style={[styles.synopsisText, { fontSize: synopsisFontSize, color: colors.text }]}
                  numberOfLines={overviewExpanded ? undefined : 3}
                  selectable={true}>
                  {overview}
                </Text>
                {overview.length > 140 ? (
                  <Pressable
                    onPress={() => setOverviewExpanded(!overviewExpanded)}
                    style={styles.expandOverviewBtn}>
                    <Text style={[styles.expandOverviewText, { color: colors.primary }]}>
                      {overviewExpanded ? 'Show less' : 'Read more...'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Top Cast Carousel (Clickable & Sizable) */}
            {rawCastList.length > 0 ? (
              <View style={styles.castSection}>
                <View style={styles.subSectionHeaderRow}>
                  <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>
                    {localShowAllCast ? `Full Cast (${rawCastList.length})` : `Top Cast (${Math.min(10, rawCastList.length)})`}
                  </Text>
                  {rawCastList.length > 10 ? (
                    <Pressable
                      style={[styles.toggleCastBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
                      onPress={() => setLocalShowAllCast(!localShowAllCast)}>
                      <Ionicons
                        name={localShowAllCast ? 'funnel-outline' : 'people-outline'}
                        size={12}
                        color={colors.primary}
                      />
                      <Text style={[styles.toggleCastBtnText, { color: colors.primary }]}>
                        {localShowAllCast ? 'Show Top 10' : `Show All (${rawCastList.length})`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.castCarousel}>
                  {displayCast.map((actor) => (
                    <Pressable
                      key={actor.id}
                      style={[styles.castCard, { width: actorCardWidth }]}
                      onPress={() =>
                        setSelectedEntity({
                          type: 'person',
                          id: actor.id,
                          name: actor.name,
                          profilePath: actor.profilePath,
                        })
                      }>
                      {showActorImages && actor.profilePath ? (
                        <Image
                          source={{
                            uri: TMDBService.getImageUrl(actor.profilePath, 'w185') || '',
                          }}
                          style={[
                            styles.castAvatar,
                            {
                              width: actorAvatarSize,
                              height: actorAvatarSize,
                              borderRadius: actorAvatarSize / 2,
                            },
                          ]}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.castAvatar,
                            styles.castAvatarFallback,
                            {
                              width: actorAvatarSize,
                              height: actorAvatarSize,
                              borderRadius: actorAvatarSize / 2,
                              backgroundColor: colors.cardBorder,
                            },
                          ]}>
                          <Ionicons
                            name="person"
                            size={Math.max(12, actorAvatarSize * 0.4)}
                            color={colors.textSecondary}
                          />
                        </View>
                      )}
                      <Text
                        style={[styles.castName, { fontSize: actorNameFontSize, color: colors.text }]}
                        numberOfLines={2}
                        selectable={true}>
                        {actor.name}
                      </Text>
                      <Text style={[styles.castCharacter, { color: colors.textMuted }]} numberOfLines={2} selectable={true}>
                        {actor.character}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Compact Production & Creators Box (Clickable chips) */}
            {(detailedInfo?.directors?.length ||
              detailedInfo?.creators?.length ||
              detailedInfo?.writers?.length ||
              detailedInfo?.studios?.length ||
              detailedInfo?.networks?.length) ? (
              <View style={[styles.metaInfoBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                {detailedInfo.directors && detailedInfo.directors.length > 0 ? (
                  <View style={styles.metaInfoRow}>
                    <Text style={[styles.metaInfoLabel, { color: colors.textSecondary }]}>Director:</Text>
                    <View style={styles.metaEntityPillsRow}>
                      {detailedInfo.directors.map((d) => (
                        <Pressable
                          key={`dir-${d.id}`}
                          style={[styles.metaClickableChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                          onPress={() =>
                            setSelectedEntity({
                              type: 'person',
                              id: d.id,
                              name: d.name,
                              role: 'Director',
                            })
                          }>
                          <Text style={[styles.metaClickableChipText, { color: colors.text }]}>{d.name}</Text>
                          <Ionicons name="chevron-forward" size={10} color={colors.primary} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                {detailedInfo.creators && detailedInfo.creators.length > 0 ? (
                  <View style={styles.metaInfoRow}>
                    <Text style={[styles.metaInfoLabel, { color: colors.textSecondary }]}>Created by:</Text>
                    <View style={styles.metaEntityPillsRow}>
                      {detailedInfo.creators.map((c) => (
                        <Pressable
                          key={`creator-${c.id}`}
                          style={[styles.metaClickableChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                          onPress={() =>
                            setSelectedEntity({
                              type: 'person',
                              id: c.id,
                              name: c.name,
                              role: 'Creator',
                            })
                          }>
                          <Text style={[styles.metaClickableChipText, { color: colors.text }]}>{c.name}</Text>
                          <Ionicons name="chevron-forward" size={10} color={colors.primary} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                {detailedInfo.writers && detailedInfo.writers.length > 0 ? (
                  <View style={styles.metaInfoRow}>
                    <Text style={[styles.metaInfoLabel, { color: colors.textSecondary }]}>Writers:</Text>
                    <View style={styles.metaEntityPillsRow}>
                      {detailedInfo.writers.map((w) => (
                        <Pressable
                          key={`writer-${w.id}`}
                          style={[styles.metaClickableChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                          onPress={() =>
                            setSelectedEntity({
                              type: 'person',
                              id: w.id,
                              name: w.name,
                              role: w.role || 'Writer',
                            })
                          }>
                          <Text style={[styles.metaClickableChipText, { color: colors.text }]}>{w.name}</Text>
                          <Ionicons name="chevron-forward" size={10} color={colors.primary} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                {detailedInfo.studios && detailedInfo.studios.length > 0 ? (
                  <View style={styles.metaInfoRow}>
                    <Text style={[styles.metaInfoLabel, { color: colors.textSecondary }]}>Studios:</Text>
                    <View style={styles.metaEntityPillsRow}>
                      {detailedInfo.studios.map((s) => (
                        <Pressable
                          key={`studio-${s.id}`}
                          style={[styles.metaClickableChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                          onPress={() =>
                            setSelectedEntity({
                              type: 'company',
                              id: s.id,
                              name: s.name,
                              logoPath: s.logoPath,
                            })
                          }>
                          <Text style={[styles.metaClickableChipText, { color: colors.text }]}>{s.name}</Text>
                          <Ionicons name="chevron-forward" size={10} color={colors.primary} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                {detailedInfo.networks && detailedInfo.networks.length > 0 ? (
                  <View style={styles.metaInfoRow}>
                    <Text style={[styles.metaInfoLabel, { color: colors.textSecondary }]}>Network:</Text>
                    <View style={styles.metaEntityPillsRow}>
                      {detailedInfo.networks.map((n) => (
                        <Pressable
                          key={`net-${n.id}`}
                          style={[styles.metaClickableChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                          onPress={() =>
                            setSelectedEntity({
                              type: 'network',
                              id: n.id,
                              name: n.name,
                              logoPath: n.logoPath,
                            })
                          }>
                          <Text style={[styles.metaClickableChipText, { color: colors.text }]}>{n.name}</Text>
                          <Ionicons name="chevron-forward" size={10} color={colors.primary} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

    </>
  );

  // 3. Status Selector
  const renderStatusSelector = () => (
    <>
          <View style={styles.statusHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
            {!status && (
              <Text style={styles.unselectedStatusHint}>Tap a status to begin tracking</Text>
            )}
          </View>

          <View style={styles.statusGrid}>
            {(Object.keys(STATUS_CONFIG) as MediaStatus[]).map((st) => {
              const config = STATUS_CONFIG[st];
              const isSelected = status === st;
              return (
                <Pressable
                  key={st}
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.cardBorder,
                    },
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
                      { color: colors.textSecondary },
                      isSelected && { color: config.color, fontWeight: '700' },
                    ]}>
                    {config.shortLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

    </>
  );

  // 4. TV Episodes & Seasons Breakdown
  const renderTvSection = () => (
    <>
            <View style={styles.tvSection}>
              {/* Master Counter Header */}
              <View style={[styles.progressCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                <View style={styles.progressHeaderRow}>
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Episodes Watched</Text>
                    <Text style={[styles.progressSubtitle, { color: colors.textSecondary }]}>
                      {totalEpisodes
                        ? `Overall: ${watchedEpisodesCount} of ${totalEpisodes} episodes${
                            specialsEpisodesCount > 0 ? ` (+${specialsEpisodesCount} specials)` : ''
                          }`
                        : `${watchedEpisodesCount} episodes watched`}
                    </Text>
                  </View>

                  {totalEpisodes ? (
                    <View style={[styles.fractionBadge, { backgroundColor: colors.primaryBg }]}>
                      <Text style={[styles.fractionBadgeText, { color: colors.primary }]}>
                        {watchedEpisodesCount} / {totalEpisodes}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Master Stepper */}
                <View style={styles.stepperContainer}>
                  <Pressable
                    style={[styles.stepperBtn, { backgroundColor: colors.primary }, watchedEpisodesCount <= 0 && styles.stepperDisabled]}
                    onPress={handleDecrementLastEpisode}
                    disabled={watchedEpisodesCount <= 0}>
                    <Ionicons name="remove" size={18} color="#ffffff" />
                  </Pressable>

                  <View style={styles.stepperValueContainer}>
                    <Text style={[styles.stepperValue, { color: colors.text }]} selectable={true}>{watchedEpisodesCount}</Text>
                    <Text style={[styles.stepperSubLabel, { color: colors.textSecondary }]}>
                      {totalEpisodes ? `of ${totalEpisodes}` : 'watched'}
                    </Text>
                  </View>

                  <Pressable
                    style={[
                      styles.stepperBtn,
                      { backgroundColor: colors.primary },
                      totalEpisodes !== null && watchedEpisodesCount >= totalEpisodes && styles.stepperDisabled,
                    ]}
                    onPress={handleIncrementNextEpisode}
                    disabled={totalEpisodes !== null && watchedEpisodesCount >= totalEpisodes}>
                    <Ionicons name="add" size={18} color="#ffffff" />
                  </Pressable>
                </View>

                {/* Master Quick Actions */}
                <View style={styles.quickActionsRow}>
                  <Pressable
                    style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                    onPress={handleIncrementNextEpisode}>
                    <Text style={[styles.quickPillText, { color: colors.textSecondary }]}>+1 Ep</Text>
                  </Pressable>
                  {totalEpisodes ? (
                    <Pressable
                      style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={handleMarkEntireShowWatched}>
                      <Text style={[styles.quickPillText, { color: colors.textSecondary }]}>All ({totalEpisodes})</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                    onPress={handleResetAllEpisodes}>
                    <Text style={[styles.quickPillText, { color: colors.textSecondary }]}>Reset (0)</Text>
                  </Pressable>
                </View>

                {/* TV Rewatch Counter */}
                <View style={[styles.rewatchRow, { borderTopColor: colors.divider }]}>
                  <View style={styles.rewatchInfo}>
                    <Ionicons name="repeat" size={16} color={colors.primary} />
                    <Text style={[styles.rewatchText, { color: colors.textSecondary }]}>Rewatched:</Text>
                    <Text style={[styles.rewatchCount, { color: colors.text }]}>
                      {rewatchCount > 0 ? `${rewatchCount}×` : '0 times'}
                    </Text>
                  </View>

                  <View style={styles.rewatchControlGroup}>
                    <Pressable
                      style={[styles.rewatchMiniBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }, rewatchCount <= 0 && styles.stepperDisabled]}
                      onPress={() => {
                        triggerHaptic('selection');
                        setRewatchCount((c) => Math.max(0, c - 1));
                      }}
                      disabled={rewatchCount <= 0}>
                      <Ionicons name="remove" size={14} color={colors.text} />
                    </Pressable>
                    <Pressable
                      style={[styles.rewatchMiniBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={() => {
                        triggerHaptic('selection');
                        setRewatchCount((c) => c + 1);
                      }}>
                      <Ionicons name="add" size={14} color={colors.text} />
                    </Pressable>
                    <Pressable
                      style={[styles.rewatchBtn, { backgroundColor: colors.primary }]}
                      onPress={handleStartTvRewatch}>
                      <Ionicons name="refresh" size={13} color="#ffffff" />
                      <Text style={styles.rewatchBtnText}>Start Rewatch</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Seasons & Episodes Breakdown Accordion */}
              <View style={styles.seasonsHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Seasons & Episodes</Text>
                  <Text style={[styles.sectionSubHelp, { color: colors.textSecondary }]}>
                    Tap any episode to mark as watched. Tap a season header to expand.
                  </Text>
                </View>

                {hasSpecials && (
                  <Pressable
                    style={[
                      styles.specialsToggleBtn,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      localShowSpecials && [styles.specialsToggleBtnActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
                    ]}
                    onPress={() => setLocalShowSpecials((v) => !v)}>
                    <Ionicons
                      name={localShowSpecials ? 'sparkles' : 'sparkles-outline'}
                      size={12}
                      color={localShowSpecials ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.specialsToggleBtnText,
                        { color: colors.textSecondary },
                        localShowSpecials && [styles.specialsToggleBtnTextActive, { color: colors.primary }],
                      ]}>
                      Specials {localShowSpecials ? 'On' : 'Off'}
                    </Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.seasonsAccordionContainer}>
                {displaySeasons.map((season) => {
                  const sNum = season.seasonNumber;
                  const epCount = season.episodeCount;
                  const isExpanded = expandedSeason === sNum;
                  const episodesList = episodesBySeason[sNum] || [];
                  const isLoadingSeason = loadingSeasonEpisodes[sNum];

                  let seasonWatched = 0;
                  for (let i = 1; i <= epCount; i++) {
                    if (watchedKeys.has(`s${sNum}_e${i}`)) seasonWatched++;
                  }
                  const isSeasonComplete = seasonWatched >= epCount && epCount > 0;

                  return (
                    <View key={`season-${sNum}`} style={[styles.seasonCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      {/* Season Header */}
                      <Pressable
                        style={styles.seasonHeader}
                        onPress={() => handleToggleSeasonExpand(sNum)}>
                        <View style={styles.seasonHeaderLeft}>
                          {showSeasonEpisodeImages && season.posterPath ? (
                            <Image
                              source={{
                                uri: TMDBService.getImageUrl(season.posterPath, 'w185') || '',
                              }}
                              style={styles.seasonPosterThumb}
                              contentFit="cover"
                            />
                          ) : (
                            <Ionicons
                              name={
                                isSeasonComplete
                                  ? 'checkmark-circle'
                                  : sNum === 0
                                  ? 'sparkles'
                                  : 'layers-outline'
                              }
                              size={18}
                              color={
                                isSeasonComplete
                                  ? '#22c55e'
                                  : sNum === 0
                                  ? '#fbbf24'
                                  : colors.primary
                              }
                            />
                          )}
                          <View style={styles.seasonTitleGroup}>
                            <View style={styles.seasonNameRow}>
                              <Text style={[styles.seasonNameText, { fontSize: seasonHeaderFontSize, color: colors.text }]} selectable={true}>
                                {sNum === 0
                                  ? (season.name || 'Specials')
                                  : (season.name || `Season ${sNum}`)}
                              </Text>
                              {sNum === 0 && (
                                <View style={styles.specialsBadge}>
                                  <Text style={styles.specialsBadgeText}>Special</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[styles.seasonMetaText, { color: colors.textSecondary }]} selectable={true}>
                              {seasonWatched} / {epCount} watched{sNum === 0 ? ' (Bonus)' : ''}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.seasonHeaderRight}>
                          <Pressable
                            style={[
                              styles.seasonCompleteBtn,
                              { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                              isSeasonComplete && styles.seasonCompleteBtnActive,
                            ]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleToggleWholeSeason(sNum, epCount);
                            }}>
                            <Text
                              style={[
                                styles.seasonCompleteBtnText,
                                { color: colors.primary },
                                isSeasonComplete && styles.seasonCompleteBtnTextActive,
                              ]}>
                              {isSeasonComplete ? 'Reset' : 'Complete'}
                            </Text>
                          </Pressable>

                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.textSecondary}
                          />
                        </View>
                      </Pressable>

                      {/* Expanded Episodes List */}
                      {isExpanded && (
                        <View style={[styles.episodesListContainer, { backgroundColor: colors.background, borderTopColor: colors.divider }]}>
                          {isLoadingSeason ? (
                            <View style={styles.episodesLoadingRow}>
                              <ActivityIndicator size="small" color={colors.primary} />
                              <Text style={[styles.episodesLoadingText, { color: colors.primary }]}>Loading episode details...</Text>
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
                                    { paddingVertical: epRowPadV, borderBottomColor: colors.divider },
                                    isWatched && styles.episodeRowWatched,
                                  ]}
                                  delayLongPress={350}
                                  onLongPress={() =>
                                    setSelectedEpisodeForDetail({
                                      sNum,
                                      epNum,
                                      detail,
                                      isWatched,
                                    })
                                  }
                                  onPress={() => handleToggleEpisode(sNum, epNum)}>
                                  <View style={styles.episodeLeft}>
                                    <View
                                      style={[
                                        styles.checkbox,
                                        {
                                          width: episodeCheckboxSize,
                                          height: episodeCheckboxSize,
                                          borderRadius: Math.round(episodeCheckboxSize / 4),
                                          borderColor: colors.cardBorder,
                                        },
                                        isWatched && styles.checkboxWatched,
                                      ]}>
                                      {isWatched && (
                                        <Ionicons
                                          name="checkmark"
                                          size={Math.max(12, episodeCheckboxSize - 10)}
                                          color="#ffffff"
                                        />
                                      )}
                                    </View>

                                    {/* Episode 16:9 thumbnail if setting enabled */}
                                    {showSeasonEpisodeImages && detail?.stillPath ? (
                                      <Image
                                        source={{
                                          uri:
                                            TMDBService.getImageUrl(detail.stillPath, 'w185') ||
                                            '',
                                        }}
                                        style={[
                                          styles.episodeStillThumb,
                                          { width: episodeStillWidth, height: episodeStillHeight },
                                        ]}
                                        contentFit="cover"
                                      />
                                    ) : null}

                                    <View style={styles.episodeTextContainer}>
                                      <Text
                                        style={[
                                          styles.episodeTitleText,
                                          { fontSize: episodeTitleFontSize, color: colors.text },
                                          isWatched && styles.episodeTitleTextWatched,
                                        ]}
                                        numberOfLines={1}
                                        selectable={true}>
                                        {epNum}. {detail?.name || `Episode ${epNum}`}
                                      </Text>

                                      {(detail?.runtime || detail?.airDate) ? (
                                        <Text style={[styles.episodeSubInfoText, { color: colors.textMuted }]} selectable={true}>
                                          {detail?.runtime ? `${detail.runtime}m` : ''}
                                          {detail?.runtime && detail?.airDate ? ' • ' : ''}
                                          {detail?.airDate ? formatDateDisplay(detail.airDate) : ''}
                                        </Text>
                                      ) : null}
                                    </View>
                                  </View>

                                  <View style={styles.episodeRight}>
                                    <View
                                      style={[
                                        styles.watchedBadge,
                                        { backgroundColor: colors.inputBg },
                                        isWatched && styles.watchedBadgeActive,
                                      ]}>
                                      <Text
                                        style={[
                                          styles.watchedBadgeText,
                                          { color: colors.textMuted },
                                          isWatched && styles.watchedBadgeTextActive,
                                        ]}>
                                        {isWatched ? 'Watched' : 'Unwatched'}
                                      </Text>
                                    </View>

                                    <Pressable
                                      style={styles.episodeInfoBtn}
                                      hitSlop={10}
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        setSelectedEpisodeForDetail({
                                          sNum,
                                          epNum,
                                          detail,
                                          isWatched,
                                        });
                                      }}>
                                      <Ionicons
                                        name="information-circle-outline"
                                        size={20}
                                        color={colors.textSecondary}
                                      />
                                    </Pressable>
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
    </>
  );

  // 5. Movie Viewing Progress
  const renderMovieSection = () => (
    <>
            <View style={[styles.progressCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <View style={styles.progressHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Movie Viewing Progress</Text>
                  <Text style={[styles.progressSubtitle, { color: colors.textSecondary }]}>
                    {runtimeMinutes
                      ? `Total Runtime: ${formatRuntime(runtimeMinutes)} (${runtimeMinutes} min)`
                      : 'Track viewing time'}
                  </Text>
                </View>

                {runtimeMinutes && minutesWatched > 0 ? (
                  <View style={[styles.fractionBadge, { backgroundColor: colors.primaryBg }]}>
                    <Text style={[styles.fractionBadgeText, { color: colors.primary }]}>
                      {minutesWatched} / {runtimeMinutes}m
                    </Text>
                  </View>
                ) : null}
              </View>

              {runtimeMinutes ? (
                <View style={styles.stepperContainer}>
                  <Pressable
                    style={[styles.stepperBtn, { backgroundColor: colors.primary }, minutesWatched <= 0 && styles.stepperDisabled]}
                    onPress={() => handleMinutesChange(minutesWatched - 15)}
                    disabled={minutesWatched <= 0}>
                    <Ionicons name="remove" size={18} color="#ffffff" />
                  </Pressable>

                  <View style={styles.stepperValueContainer}>
                    <Text style={[styles.stepperValue, { color: colors.text }]} selectable={true}>{minutesWatched}m</Text>
                    <Text style={[styles.stepperSubLabel, { color: colors.textSecondary }]}>watched</Text>
                  </View>

                  <Pressable
                    style={[
                      styles.stepperBtn,
                      { backgroundColor: colors.primary },
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
                      style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={() => handleMinutesChange(runtimeMinutes)}>
                      <Text style={[styles.quickPillText, { color: colors.textSecondary }]}>Watched Entire Movie</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={() => handleMinutesChange(minutesWatched + 30)}>
                      <Text style={[styles.quickPillText, { color: colors.textSecondary }]}>+30m</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>

              {/* Rewatch Counter */}
              <View style={[styles.rewatchRow, { borderTopColor: colors.divider }]}>
                <View style={styles.rewatchInfo}>
                  <Ionicons name="repeat" size={16} color={colors.primary} />
                  <Text style={[styles.rewatchText, { color: colors.textSecondary }]}>Rewatched:</Text>
                  <Text style={[styles.rewatchCount, { color: colors.text }]}>
                    {rewatchCount > 0 ? `${rewatchCount}×` : '0 times'}
                  </Text>
                </View>

                <View style={styles.rewatchControlGroup}>
                  <Pressable
                    style={[styles.rewatchMiniBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }, rewatchCount <= 0 && styles.stepperDisabled]}
                      onPress={() => {
                        triggerHaptic('selection');
                        setRewatchCount((c) => Math.max(0, c - 1));
                      }}
                    disabled={rewatchCount <= 0}>
                    <Ionicons name="remove" size={14} color={colors.text} />
                  </Pressable>
                  <Pressable
                    style={[styles.rewatchMiniBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={() => {
                        triggerHaptic('selection');
                        setRewatchCount((c) => c + 1);
                      }}>
                    <Ionicons name="add" size={14} color={colors.text} />
                  </Pressable>
                  <Pressable
                    style={[styles.rewatchBtn, { backgroundColor: colors.primary }]}
                    onPress={handleStartMovieRewatch}>
                    <Ionicons name="refresh" size={13} color="#ffffff" />
                    <Text style={styles.rewatchBtnText}>Start Rewatch</Text>
                  </Pressable>
                </View>
              </View>
            </View>
    </>
  );

  // 6. Score Selector
  const renderScoreSelector = () => (
    <>
          <View style={styles.scoreHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Score</Text>
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
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.cardBorder,
                    },
                    isSelected && [
                      styles.scorePillActive,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ],
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setScore(s);
                  }}>
                  <Text
                    style={[
                      styles.scorePillText,
                      { color: colors.textSecondary },
                      isSelected && [styles.scorePillTextActive, { color: '#ffffff' }],
                    ]}>
                    {s === 0 ? '-' : s}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

    </>
  );

  // 7. Dates & Timeline
  const renderDatesSection = () => (
    <>
          <View style={[styles.datesCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <Pressable
              style={styles.datesCardHeader}
              onPress={() => setShowDatesSection(!showDatesSection)}>
              <View style={styles.datesHeaderLeft}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
                <View>
                  <Text style={[styles.datesCardTitle, { color: colors.text }]}>Dates & Timeline ({dateFormat})</Text>
                  {durationLabel ? (
                    <Text style={[styles.durationSummaryText, { color: colors.primary }]}>{durationLabel}</Text>
                  ) : (
                    <Text style={[styles.datesSubText, { color: colors.textSecondary }]}>
                      {existingRecord ? `Added ${getRelativeTime(addedAt)}` : 'Set start & finish dates'}
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons
                name={showDatesSection ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>

            {showDatesSection && (
              <View style={[styles.datesExpandedContent, { borderTopColor: colors.divider }]}>
                {/* Date Added */}
                <View style={styles.dateRow}>
                  <View style={styles.dateLabelGroup}>
                    <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Date Added:</Text>
                    <Text style={[styles.dateRelativeText, { color: colors.textMuted }]}>
                      ({getRelativeTime(addedAt)})
                    </Text>
                  </View>
                  <Text style={[styles.dateStaticValue, { color: colors.text }]} selectable={true}>{formatDateDisplay(addedAt, dateFormat)}</Text>
                </View>

                {/* Started Watching Date Picker Button */}
                <View style={styles.dateRow}>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Started Watching:</Text>
                  <View style={styles.dateButtonGroup}>
                    <Pressable
                      style={[styles.datePickerTriggerBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={() => setDatePickerTarget('started')}>
                      <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                      <Text
                        style={[
                          styles.datePickerTriggerText,
                          { color: colors.text },
                          !startedAt && styles.datePickerTriggerPlaceholder,
                        ]}>
                        {startedAt || dateFormat}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.dateQuickBtn, { backgroundColor: colors.card }]}
                      onPress={() => setStartedAt(getTodayFormatted(dateFormat))}>
                      <Text style={[styles.dateQuickText, { color: colors.primary }]}>Today</Text>
                    </Pressable>

                    {startedAt ? (
                      <Pressable
                        style={styles.dateClearBtn}
                        onPress={() => setStartedAt('')}>
                        <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* Finished Watching Date Picker Button */}
                <View style={styles.dateRow}>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Finished Watching:</Text>
                  <View style={styles.dateButtonGroup}>
                    <Pressable
                      style={[styles.datePickerTriggerBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={() => setDatePickerTarget('finished')}>
                      <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                      <Text
                        style={[
                          styles.datePickerTriggerText,
                          { color: colors.text },
                          !finishedAt && styles.datePickerTriggerPlaceholder,
                        ]}>
                        {finishedAt || dateFormat}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.dateQuickBtn, { backgroundColor: colors.card }]}
                      onPress={() => setFinishedAt(getTodayFormatted(dateFormat))}>
                      <Text style={[styles.dateQuickText, { color: colors.primary }]}>Today</Text>
                    </Pressable>

                    {finishedAt ? (
                      <Pressable
                        style={styles.dateClearBtn}
                        onPress={() => setFinishedAt('')}>
                        <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* Duration Label */}
                {durationLabel && (
                  <View style={[styles.durationPillContainer, { backgroundColor: colors.primaryBg }]}>
                    <Ionicons name="time-outline" size={14} color={colors.primary} />
                    <Text style={[styles.durationPillText, { color: colors.primary }]}>{durationLabel}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

    </>
  );

  // 8. Personal Notes & Action Buttons
  const renderNotesAndActions = () => (
    <>
          {/* Notes Input (Keyboard avoiding & accessible) */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Notes</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, color: colors.text }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Favorite moments, thoughts, watched with..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
          />

          {/* Action Buttons */}
          <View style={styles.buttonStack}>
            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: colors.primary },
                !status && styles.saveButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSave}
              disabled={!status}>
              <Ionicons
                name={status ? 'checkmark-circle' : 'add-circle-outline'}
                size={18}
                color="#ffffff"
              />
              <Text style={styles.saveButtonText}>
                {existingRecord
                  ? 'Update Tracking'
                  : status
                  ? 'Save to My List'
                  : 'Select a Status to Track'}
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
    </>
  );

  return (
    <View style={[styles.overlay, isTablet && styles.tabletOverlay]}>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (keyboardHeight > 0) {
            Keyboard.dismiss();
          } else {
            onClose();
          }
        }}
      />

      <Animated.View
        style={[
          styles.sheetContainer,
          isTablet && styles.tabletSheetContainer,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            marginBottom: keyboardHeight,
            maxHeight:
              keyboardHeight > 0
                ? Math.max(300, windowHeight - keyboardHeight - (isTablet ? 60 : 30))
                : isTablet
                ? '90%'
                : '94%',
            transform: [{ translateY }],
          },
        ]}>
        {/* Header Handle / Bar */}
        {isTablet ? (
          <View style={[styles.tabletHeaderBar, { borderBottomColor: colors.divider }]} {...panResponder.panHandlers}>
            <View style={[styles.handle, { backgroundColor: colors.divider }]} />
            <Pressable onPress={onClose} style={styles.tabletCloseButton} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.sheetHeader, { borderBottomColor: colors.divider }]} {...panResponder.panHandlers}>
            <View style={[styles.handle, { backgroundColor: colors.divider }]} />
          </View>
        )}

        {isTablet ? (
          /* Tablet Split-Pane: Left Tracking Pane & Right Content/Episode Pane */
          <View style={styles.tabletBodyRow}>
            {/* Left Pane (Tracking, Scores, Dates, Notes, Actions) */}
            <ScrollView
              style={[styles.tabletLeftPane, { borderRightColor: colors.divider }]}
              contentContainerStyle={styles.tabletPaneContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={true}>
              {renderMediaSummary()}
              {renderStatusSelector()}
              {renderScoreSelector()}
              {mediaType === 'movie' && renderMovieSection()}
              {renderDatesSection()}
              {renderNotesAndActions()}
            </ScrollView>

            {/* Right Pane (Rich Info, Cast, TV Episodes Checklist) */}
            <ScrollView
              style={styles.tabletRightPane}
              contentContainerStyle={styles.tabletPaneContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={true}>
              {renderRichInfo()}
              {mediaType === 'tv' && renderTvSection()}
            </ScrollView>
          </View>
        ) : (
          /* Phone Single-Column Stack */
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: keyboardHeight > 0 ? 30 : 60 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}>
            {renderMediaSummary()}
            {renderRichInfo()}
            {renderStatusSelector()}
            {mediaType === 'tv' && renderTvSection()}
            {mediaType === 'movie' && renderMovieSection()}
            {renderScoreSelector()}
            {renderDatesSection()}
            {renderNotesAndActions()}
          </ScrollView>
        )}
      </Animated.View>

      {/* Interactive Visual DatePicker Modal */}
      <DatePickerModal
        visible={datePickerTarget !== null}
        title={datePickerTarget === 'started' ? 'Select Start Date' : 'Select Finish Date'}
        initialDate={datePickerTarget === 'started' ? startedAt : finishedAt}
        dateFormat={dateFormat}
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

      {/* Interactive Entity Detail Sheet (Clickable Actors, Studios, Genres) */}
      <EntityModal
        visible={selectedEntity !== null}
        entity={selectedEntity}
        onClose={() => setSelectedEntity(null)}
        onFilterInDiscover={(filter) => {
          setActiveDiscoverFilter(filter);
          setSelectedEntity(null);
          onClose();
          router.navigate('/');
        }}
        onSelectMedia={(_media) => {
          setSelectedEntity(null);
        }}
      />

      {/* Episode Detail Modal (Full synopsis, air dates, guest actors & crew with clickable links) */}
      {selectedEpisodeForDetail && (
        <EpisodeDetailModal
          visible={Boolean(selectedEpisodeForDetail)}
          tvId={id}
          seasonNumber={selectedEpisodeForDetail.sNum}
          episodeNumber={selectedEpisodeForDetail.epNum}
          baseEpisodeInfo={selectedEpisodeForDetail.detail}
          isWatched={watchedKeys.has(
            `s${selectedEpisodeForDetail.sNum}_e${selectedEpisodeForDetail.epNum}`
          )}
          onToggleWatched={() => {
            handleToggleEpisode(
              selectedEpisodeForDetail.sNum,
              selectedEpisodeForDetail.epNum
            );
          }}
          onSelectEntity={(entity) => {
            setSelectedEpisodeForDetail(null);
            setSelectedEntity(entity);
          }}
          onClose={() => setSelectedEpisodeForDetail(null)}
        />
      )}

      {/* Release Reminder Configuration Modal */}
      <ReleaseReminderModal
        visible={showReminderModal}
        item={item}
        existingRecord={existingRecord}
        targetDate={effectiveMovieDate || effectiveTvNextAirDate}
        dateLabel={
          mediaType === 'movie'
            ? detailedInfo?.regionalReleaseType || 'Release Date'
            : tvNextEpisode
            ? `S${tvNextEpisode.seasonNumber} E${tvNextEpisode.episodeNumber}`
            : 'Next Episode'
        }
        countdownText={movieCountdown?.formattedCountdown || tvCountdown?.formattedCountdown}
        onClose={() => setShowReminderModal(false)}
        onSaveReminder={handleSaveReminder}
        onRemoveReminder={handleRemoveReminder}
      />
    </View>
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
    paddingBottom: 140, // Prevents keyboard overlap on Android
  },
  mediaSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2433',
    marginBottom: 12,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncButton: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: '#161e2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncFeedbackBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  syncFeedbackText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
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
  richInfoSection: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2433',
    gap: 10,
  },
  taglineText: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  genreChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1f2b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262d3d',
  },
  genreChipText: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  synopsisContainer: {
    backgroundColor: '#161922',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#232838',
  },
  synopsisText: {
    color: '#cbd5e1',
    lineHeight: 18,
  },
  expandOverviewBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  expandOverviewText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  castSection: {
    marginTop: 4,
  },
  subSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subSectionTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleCastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1f2b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262d3d',
  },
  toggleCastBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
  castCarousel: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 4,
  },
  castCard: {
    alignItems: 'center',
  },
  castAvatar: {
    backgroundColor: '#1e2433',
    marginBottom: 4,
  },
  castAvatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  castName: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    lineHeight: 14,
  },
  castCharacter: {
    color: '#64748b',
    fontSize: 9,
    textAlign: 'center',
    width: '100%',
    marginTop: 2,
    lineHeight: 12,
  },
  metaInfoBox: {
    backgroundColor: '#161922',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#232838',
    gap: 8,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  metaInfoLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 70,
    paddingTop: 3,
  },
  metaEntityPillsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaClickableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1f2432',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2d3548',
  },
  metaClickableChipText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  unselectedStatusHint: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '600',
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
    padding: 10,
  },
  seasonHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  seasonPosterThumb: {
    width: 32,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#1e2433',
  },
  seasonTitleGroup: {
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
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2b',
  },
  episodeRowWatched: {
    backgroundColor: 'rgba(34, 197, 94, 0.04)',
  },
  episodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  episodeStillThumb: {
    width: 60,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#1e2433',
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
  episodeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  episodeInfoBtn: {
    padding: 3,
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
  rewatchControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewatchMiniBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1e2433',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2b3345',
  },
  rewatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  rewatchBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  seasonsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 4,
    gap: 8,
  },
  specialsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  specialsToggleBtnActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  specialsToggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  specialsToggleBtnTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  seasonNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specialsBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  specialsBadgeText: {
    color: '#fbbf24',
    fontSize: 10,
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
  saveButtonDisabled: {
    backgroundColor: '#1e293b',
    opacity: 0.6,
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
  tabletOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tabletSheetContainer: {
    width: '94%',
    maxWidth: 1120,
    maxHeight: '92%',
    height: '88%',
    borderRadius: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  tabletHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2433',
  },
  tabletCloseButton: {
    position: 'absolute',
    right: 16,
    top: 8,
    padding: 6,
  },
  tabletBodyRow: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletLeftPane: {
    flex: 0.42,
    borderRightWidth: 1,
    borderRightColor: '#1e2433',
  },
  tabletRightPane: {
    flex: 0.58,
  },
  tabletPaneContent: {
    padding: 20,
    paddingBottom: 60,
  },
  countdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  countdownBannerContent: {
    flex: 1,
  },
  countdownBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  countdownBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  countdownBannerSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  countdownPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countdownPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  countdownIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownBannerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    gap: 8,
  },
  reminderStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  reminderStatusPillText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '700',
  },
});

