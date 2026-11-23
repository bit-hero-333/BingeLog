import React, { useState, useMemo, useEffect } from 'react';
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
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { TrackedItem, MediaStatus, STATUS_CONFIG } from '@/types/media';
import { TMDBService } from '@/services/tmdb';
import { formatDate } from '@/utils/date';
import { getTextScale, getHeaderScale } from '@/utils/sizing';
import {
  getCachedSeasonSchedule,
  saveCachedSeasonSchedule,
} from '@/services/calendarCache';

interface ReleaseCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectItem: (item: TrackedItem) => void;
}

type CalendarViewMode = 'day' | 'week' | 'month' | 'year';

interface CalendarEpisodeItem {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string;
}

interface CalendarEntry {
  key: string;
  item: TrackedItem;
  dateKey: string;
  subtitle: string;
  statusColor: string;
  isDualStatus: boolean;
}

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const FULL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const STATUS_FILTERS: { id: 'all' | MediaStatus; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'watching', label: 'Watching', color: STATUS_CONFIG.watching.color },
  { id: 'plan_to_watch', label: 'Plan', color: STATUS_CONFIG.plan_to_watch.color },
  { id: 'completed', label: 'Completed', color: STATUS_CONFIG.completed.color },
  { id: 'on_hold', label: 'On Hold', color: STATUS_CONFIG.on_hold.color },
  { id: 'dropped', label: 'Dropped', color: STATUS_CONFIG.dropped.color },
];

function getTodayDateKey(timezone?: string): string {
  try {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value || '2026';
    const m = parts.find((p) => p.type === 'month')?.value || '01';
    const d = parts.find((p) => p.type === 'day')?.value || '01';
    return `${y}-${m}-${d}`;
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

function normalizeDateKey(raw?: string | null): string | null {
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return match ? match[1] : null;
}

function parseDateKeyToUtc(dateKey: string): Date {
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = parseInt(yStr, 10) || 2026;
  const m = (parseInt(mStr, 10) || 1) - 1;
  const d = parseInt(dStr, 10) || 1;
  return new Date(Date.UTC(y, m, d));
}

function formatUtcToDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const dt = parseDateKeyToUtc(dateKey);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return formatUtcToDateKey(dt);
}

function addMonthsToDateKey(dateKey: string, deltaMonths: number): string {
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = parseInt(yStr, 10) || 2026;
  const m = (parseInt(mStr, 10) || 1) - 1;
  const d = parseInt(dStr, 10) || 1;
  const targetFirst = new Date(Date.UTC(y, m + deltaMonths, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  return formatUtcToDateKey(
    new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), clampedDay))
  );
}

function addYearsToDateKey(dateKey: string, deltaYears: number): string {
  return addMonthsToDateKey(dateKey, deltaYears * 12);
}

function getMondayOfWeek(dateKey: string): string {
  const dt = parseDateKeyToUtc(dateKey);
  const mondayOffset = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - mondayOffset);
  return formatUtcToDateKey(dt);
}

function formatAgendaDateHeading(dateKey: string, dateFormat: string): string {
  const dt = parseDateKeyToUtc(dateKey);
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = weekdayNames[dt.getUTCDay()] || '';
  const formatted = formatDate(
    new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 12, 0, 0),
    dateFormat as any
  );
  return `${weekday}, ${formatted}`;
}

export function ReleaseCalendarModal({
  visible,
  onClose,
  onSelectItem,
}: ReleaseCalendarModalProps) {
  const { colors } = useAppTheme();
  const { trackedItems, apiKey, dateFormat, selectedTimezone, sizingConfig, triggerHaptic } =
    useMedia();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);

  const todayKey = useMemo(() => getTodayDateKey(selectedTimezone), [selectedTimezone]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getTodayDateKey(selectedTimezone));
  const [statusFilter, setStatusFilter] = useState<'all' | MediaStatus>('all');
  const [weekFilterSelectedDay, setWeekFilterSelectedDay] = useState<boolean>(false);
  const [seasonScheduleMap, setSeasonScheduleMap] = useState<Record<number, CalendarEpisodeItem[]>>({});
  const [isSyncingSchedule, setIsSyncingSchedule] = useState<boolean>(false);

  // Hydrate cached & upcoming TV season schedules whenever the calendar opens
  useEffect(() => {
    if (!visible) return;
    let isMounted = true;

    async function hydrateTvSchedules() {
      const candidateShows = trackedItems.filter((item) => {
        if (item.mediaType !== 'tv') return false;
        const isPriorityStatus =
          item.status === 'watching' ||
          item.status === 'plan_to_watch' ||
          item.status === 'on_hold' ||
          Boolean(item.isAlsoPlanned);
        return isPriorityStatus || Boolean(item.nextAirDate || item.nextEpisode?.airDate);
      });

      if (candidateShows.length === 0) return;

      const resolvedMap: Record<number, CalendarEpisodeItem[]> = {};
      const missingFetches: { item: TrackedItem; seasonNumber: number }[] = [];

      for (const show of candidateShows) {
        let targetSeason = show.nextEpisode?.seasonNumber;
        if (targetSeason === undefined && show.seasons && show.seasons.length > 0) {
          const regularSeasons = show.seasons.filter((s) => s.seasonNumber > 0);
          if (regularSeasons.length > 0) {
            targetSeason = regularSeasons[regularSeasons.length - 1].seasonNumber;
          }
        }
        if (targetSeason === undefined || targetSeason < 0) continue;

        const cached = await getCachedSeasonSchedule(show.id, targetSeason);
        if (cached !== null) {
          resolvedMap[show.id] = cached.map((ep) => ({
            seasonNumber: targetSeason!,
            episodeNumber: ep.episodeNumber,
            name: ep.name,
            airDate: ep.airDate,
          }));
        } else if (apiKey) {
          missingFetches.push({ item: show, seasonNumber: targetSeason });
        }
      }

      if (!isMounted) return;
      if (Object.keys(resolvedMap).length > 0) {
        setSeasonScheduleMap((prev) => ({ ...prev, ...resolvedMap }));
      }

      if (missingFetches.length === 0 || !apiKey) return;

      setIsSyncingSchedule(true);
      try {
        const BATCH_SIZE = 3;
        for (let i = 0; i < missingFetches.length; i += BATCH_SIZE) {
          if (!isMounted) break;
          const batch = missingFetches.slice(i, i + BATCH_SIZE);
          const batchResults: Record<number, CalendarEpisodeItem[]> = {};

          await Promise.all(
            batch.map(async ({ item, seasonNumber }) => {
              const rawEps = await TMDBService.getSeasonEpisodes(item.id, seasonNumber, apiKey);
              const datedEps = rawEps
                .map((ep) => {
                  const key = normalizeDateKey(ep.airDate);
                  if (!key) return null;
                  return {
                    episodeNumber: ep.episodeNumber,
                    name: ep.name || `Episode ${ep.episodeNumber}`,
                    airDate: key,
                  };
                })
                .filter((x): x is { episodeNumber: number; name: string; airDate: string } => x !== null);

              await saveCachedSeasonSchedule(item.id, seasonNumber, datedEps);
              batchResults[item.id] = datedEps.map((ep) => ({
                seasonNumber,
                episodeNumber: ep.episodeNumber,
                name: ep.name,
                airDate: ep.airDate,
              }));
            })
          );

          if (isMounted && Object.keys(batchResults).length > 0) {
            setSeasonScheduleMap((prev) => ({ ...prev, ...batchResults }));
          }
        }
      } finally {
        if (isMounted) {
          setIsSyncingSchedule(false);
        }
      }
    }

    void hydrateTvSchedules();

    return () => {
      isMounted = false;
    };
  }, [visible, trackedItems, apiKey]);

  // Aggregate all calendar entries across tracked items matching statusFilter
  const entriesByDate = useMemo<Record<string, CalendarEntry[]>>(() => {
    const map: Record<string, CalendarEntry[]> = {};
    const seenKeys = new Set<string>();

    const pushEntry = (entry: CalendarEntry) => {
      if (seenKeys.has(entry.key)) return;
      seenKeys.add(entry.key);
      if (!map[entry.dateKey]) {
        map[entry.dateKey] = [];
      }
      map[entry.dateKey].push(entry);
    };

    for (const item of trackedItems) {
      const isDualStatus = Boolean(item.status === 'completed' && item.isAlsoPlanned);

      if (statusFilter !== 'all') {
        const matches =
          item.status === statusFilter ||
          (statusFilter === 'plan_to_watch' && isDualStatus);
        if (!matches) continue;
      }

      const statusColor = STATUS_CONFIG[item.status]?.color || colors.primary;

      if (item.mediaType === 'movie') {
        const movieKey = normalizeDateKey(item.regionalReleaseDate || item.releaseDate);
        if (movieKey) {
          pushEntry({
            key: `movie_${item.id}_${movieKey}`,
            item,
            dateKey: movieKey,
            subtitle: item.regionalReleaseType
              ? `${item.regionalReleaseType} Release`
              : 'Movie Release',
            statusColor: String(statusColor),
            isDualStatus,
          });
        }
      } else {
        // 1. Add all cached/fetched season episodes with air dates
        const seasonEps = seasonScheduleMap[item.id] || [];
        for (const ep of seasonEps) {
          pushEntry({
            key: `tv_${item.id}_${ep.airDate}_s${ep.seasonNumber}_e${ep.episodeNumber}`,
            item,
            dateKey: ep.airDate,
            subtitle: `S${ep.seasonNumber} E${ep.episodeNumber} • ${ep.name}`,
            statusColor: String(statusColor),
            isDualStatus,
          });
        }

        // 2. Also add explicit nextEpisode / nextAirDate if not already present from season schedule
        const nextKey = normalizeDateKey(item.nextAirDate || item.nextEpisode?.airDate);
        if (nextKey) {
          const epCode = item.nextEpisode
            ? `S${item.nextEpisode.seasonNumber} E${item.nextEpisode.episodeNumber}`
            : 'Next Episode';
          const epName = item.nextEpisode?.name ? ` • ${item.nextEpisode.name}` : '';
          const dedupeKey = item.nextEpisode
            ? `tv_${item.id}_${nextKey}_s${item.nextEpisode.seasonNumber}_e${item.nextEpisode.episodeNumber}`
            : `tv_${item.id}_${nextKey}_next`;

          const alreadyHasDate =
            item.nextEpisode === undefined &&
            Boolean(map[nextKey]?.some((e) => e.item.id === item.id && e.item.mediaType === 'tv'));

          if (!alreadyHasDate) {
            pushEntry({
              key: dedupeKey,
              item,
              dateKey: nextKey,
              subtitle: `${epCode}${epName}`,
              statusColor: String(statusColor),
              isDualStatus,
            });
          }
        }
      }
    }

    return map;
  }, [trackedItems, statusFilter, seasonScheduleMap, colors.primary]);

  const upcomingTotalCount = useMemo(() => {
    let total = 0;
    for (const [dKey, list] of Object.entries(entriesByDate)) {
      if (dKey >= todayKey) {
        total += list.length;
      }
    }
    return total;
  }, [entriesByDate, todayKey]);

  // Period metadata derived from selectedDateKey
  const selectedUtc = useMemo(() => parseDateKeyToUtc(selectedDateKey), [selectedDateKey]);
  const selectedYear = selectedUtc.getUTCFullYear();
  const selectedMonth = selectedUtc.getUTCMonth(); // 0..11

  const weekDays = useMemo(() => {
    const monday = getMondayOfWeek(selectedDateKey);
    return Array.from({ length: 7 }).map((_, idx) => addDaysToDateKey(monday, idx));
  }, [selectedDateKey]);

  const periodTitle = useMemo(() => {
    if (viewMode === 'day') {
      return formatAgendaDateHeading(selectedDateKey, dateFormat);
    }
    if (viewMode === 'week') {
      const startDt = parseDateKeyToUtc(weekDays[0]);
      const endDt = parseDateKeyToUtc(weekDays[6]);
      const startLbl = `${SHORT_MONTH_NAMES[startDt.getUTCMonth()]} ${startDt.getUTCDate()}`;
      const endLbl = `${SHORT_MONTH_NAMES[endDt.getUTCMonth()]} ${endDt.getUTCDate()}, ${endDt.getUTCFullYear()}`;
      return `${startLbl} - ${endLbl}`;
    }
    if (viewMode === 'month') {
      return `${FULL_MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    }
    return String(selectedYear);
  }, [viewMode, selectedDateKey, dateFormat, weekDays, selectedMonth, selectedYear]);

  const handleStepPeriod = (direction: -1 | 1) => {
    triggerHaptic('selection');
    setWeekFilterSelectedDay(false);
    if (viewMode === 'day') {
      setSelectedDateKey((prev) => addDaysToDateKey(prev, direction));
    } else if (viewMode === 'week') {
      setSelectedDateKey((prev) => addDaysToDateKey(prev, direction * 7));
    } else if (viewMode === 'month') {
      setSelectedDateKey((prev) => addMonthsToDateKey(prev, direction));
    } else {
      setSelectedDateKey((prev) => addYearsToDateKey(prev, direction));
    }
  };

  // Month grid cells
  const monthGridCells = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(selectedYear, selectedMonth, 1));
    const leadingEmpty = (firstOfMonth.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0)).getUTCDate();
    const cells: ({ type: 'empty'; key: string } | { type: 'day'; key: string; day: number; dateKey: string })[] = [];

    for (let i = 0; i < leadingEmpty; i++) {
      cells.push({ type: 'empty', key: `empty-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(selectedMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateKey = `${selectedYear}-${mStr}-${dStr}`;
      cells.push({ type: 'day', key: dateKey, day, dateKey });
    }
    return cells;
  }, [selectedYear, selectedMonth]);

  // Year view month summaries
  const yearMonthsSummary = useMemo(() => {
    const yearPrefix = `${selectedYear}-`;
    return FULL_MONTH_NAMES.map((fullName, mIdx) => {
      const monthPrefix = `${yearPrefix}${String(mIdx + 1).padStart(2, '0')}-`;
      let entryCount = 0;
      let firstEntryDateKey: string | null = null;
      const dotColorSet = new Set<string>();

      const sortedDates = Object.keys(entriesByDate)
        .filter((k) => k.startsWith(monthPrefix))
        .sort();

      for (const dk of sortedDates) {
        if (!firstEntryDateKey) firstEntryDateKey = dk;
        const list = entriesByDate[dk] || [];
        entryCount += list.length;
        for (const e of list) {
          dotColorSet.add(e.statusColor);
        }
      }

      return {
        monthIndex: mIdx,
        shortName: SHORT_MONTH_NAMES[mIdx],
        entryCount,
        firstEntryDateKey,
        dotColors: Array.from(dotColorSet).slice(0, 4),
      };
    });
  }, [selectedYear, entriesByDate]);

  const renderAgendaCard = (entry: CalendarEntry) => {
    const posterUrl = TMDBService.getImageUrl(entry.item.posterPath, 'w154');
    const statusConf = STATUS_CONFIG[entry.item.status];
    return (
      <Pressable
        key={entry.key}
        onPress={() => {
          triggerHaptic('selection');
          onSelectItem(entry.item);
        }}
        style={({ pressed }) => [
          styles.agendaCard,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.cardBorder,
          },
          pressed && { opacity: 0.8 },
        ]}>
        {/* Left status color accent stripe */}
        {entry.isDualStatus ? (
          <View style={styles.agendaDualStripe}>
            <View style={{ flex: 1, backgroundColor: '#3b82f6' }} />
            <View style={{ flex: 1, backgroundColor: '#a855f7' }} />
          </View>
        ) : (
          <View style={[styles.agendaStripe, { backgroundColor: entry.statusColor }]} />
        )}

        <View style={[styles.agendaPosterWrap, { backgroundColor: colors.card }]}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.agendaPoster} contentFit="cover" />
          ) : (
            <Ionicons name="film-outline" size={18} color={colors.textMuted} />
          )}
        </View>

        <View style={styles.agendaInfo}>
          <View style={styles.agendaTopRow}>
            <Text
              style={[styles.agendaTitle, { color: colors.text, fontSize: Math.round(13.5 * textScale) }]}
              numberOfLines={1}>
              {entry.item.title}
            </Text>
            <View style={[styles.agendaTypePill, { backgroundColor: colors.primaryBg }]}>
              <Text style={[styles.agendaTypeText, { color: colors.primary }]}>
                {entry.item.mediaType.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text
            style={[styles.agendaSubtitle, { color: colors.textSecondary, fontSize: Math.round(12 * textScale) }]}
            numberOfLines={2}>
            {entry.subtitle}
          </Text>

          <View style={styles.agendaStatusRow}>
            <View style={[styles.agendaStatusDot, { backgroundColor: entry.statusColor }]} />
            <Text
              style={[
                styles.agendaStatusText,
                { color: entry.statusColor, fontSize: Math.round(10.5 * textScale) },
              ]}>
              {entry.isDualStatus ? 'Completed + Plan' : statusConf.shortLabel}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
    );
  };

  const renderDateSection = (dateKey: string) => {
    const entries = entriesByDate[dateKey] || [];
    if (entries.length === 0) return null;
    const isToday = dateKey === todayKey;

    return (
      <View key={`sec-${dateKey}`} style={styles.dayGroupBlock}>
        <View style={styles.dayGroupHeader}>
          <Text
            style={[
              styles.dayGroupHeadingText,
              { color: isToday ? colors.primary : colors.textSecondary, fontSize: Math.round(12 * textScale) },
            ]}>
            {formatAgendaDateHeading(dateKey, dateFormat)}
            {isToday ? ' (Today)' : ''}
          </Text>
          <Text style={[styles.dayGroupCount, { color: colors.textMuted, fontSize: Math.round(11 * textScale) }]}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>
        <View style={styles.agendaList}>{entries.map(renderAgendaCard)}</View>
      </View>
    );
  };

  if (!visible) return null;

  const selectedDayEntries = entriesByDate[selectedDateKey] || [];
  const weekDaysToRender = weekFilterSelectedDay ? [selectedDateKey] : weekDays;
  const weekEntriesCount = weekDaysToRender.reduce(
    (sum, dk) => sum + (entriesByDate[dk]?.length || 0),
    0
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Modal Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconBadge, { backgroundColor: colors.primaryBg }]}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: colors.text, fontSize: Math.round(16 * headerScale) }]}>
                  Release Calendar
                </Text>
                <View style={styles.headerSubRow}>
                  <Text style={[styles.headerSubtitle, { color: colors.textSecondary, fontSize: Math.round(11.5 * textScale) }]}>
                    {upcomingTotalCount} upcoming {upcomingTotalCount === 1 ? 'release' : 'releases'}
                  </Text>
                  {isSyncingSchedule && (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
                  )}
                </View>
              </View>
            </View>

            <View style={styles.headerRightActions}>
              <Pressable
                style={[styles.todayPill, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
                onPress={() => {
                  triggerHaptic('selection');
                  setSelectedDateKey(todayKey);
                  setWeekFilterSelectedDay(false);
                }}>
                <Text style={[styles.todayPillText, { color: colors.primary }]}>Today</Text>
              </Pressable>

              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* 4-Mode Switcher: Day | Week | Month | Year */}
          <View style={styles.controlsBlock}>
            <View style={[styles.viewSwitcherRow, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              {(['day', 'week', 'month', 'year'] as CalendarViewMode[]).map((mode) => {
                const isActive = viewMode === mode;
                const label = mode.charAt(0).toUpperCase() + mode.slice(1);
                return (
                  <Pressable
                    key={mode}
                    style={[
                      styles.viewSwitchBtn,
                      isActive && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setViewMode(mode);
                      setWeekFilterSelectedDay(false);
                    }}>
                    <Text
                      style={[
                        styles.viewSwitchText,
                        { color: isActive ? '#ffffff' : colors.textSecondary, fontSize: Math.round(12 * textScale) },
                      ]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Status Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusFilterScroll}>
              {STATUS_FILTERS.map((sf) => {
                const isSelected = statusFilter === sf.id;
                const activeColor = sf.color || colors.primary;
                return (
                  <Pressable
                    key={sf.id}
                    style={[
                      styles.statusFilterChip,
                      { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                      isSelected && {
                        borderColor: activeColor,
                        backgroundColor: sf.color ? `${sf.color}20` : colors.primaryBg,
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setStatusFilter(sf.id);
                    }}>
                    {sf.color && (
                      <View style={[styles.statusFilterDot, { backgroundColor: sf.color }]} />
                    )}
                    <Text
                      style={[
                        styles.statusFilterText,
                        { color: isSelected ? activeColor : colors.textSecondary, fontSize: Math.round(11.5 * textScale) },
                      ]}>
                      {sf.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Period Navigation Row */}
            <View style={[styles.periodNavRow, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <Pressable style={styles.periodNavBtn} onPress={() => handleStepPeriod(-1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>
              <Text
                style={[styles.periodNavTitle, { color: colors.text, fontSize: Math.round(13.5 * textScale) }]}
                numberOfLines={1}>
                {periodTitle}
              </Text>
              <Pressable style={styles.periodNavBtn} onPress={() => handleStepPeriod(1)} hitSlop={8}>
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Body Content */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyScrollContent}
            showsVerticalScrollIndicator={false}>
            {/* VIEW 1: DAY */}
            {viewMode === 'day' && (
              <>
                {selectedDayEntries.length > 0 ? (
                  <View style={styles.agendaList}>{selectedDayEntries.map(renderAgendaCard)}</View>
                ) : (
                  <View style={styles.emptyBox}>
                    <Ionicons name="calendar-clear-outline" size={40} color={colors.textMuted} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      No releases scheduled
                    </Text>
                    <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                      Nothing in your filtered watchlist drops on {formatAgendaDateHeading(selectedDateKey, dateFormat)}.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* VIEW 2: WEEK */}
            {viewMode === 'week' && (
              <>
                <View style={[styles.weekStripCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                  {weekDays.map((dk, idx) => {
                    const dt = parseDateKeyToUtc(dk);
                    const dayNum = dt.getUTCDate();
                    const isSelected = dk === selectedDateKey;
                    const isToday = dk === todayKey;
                    const dayEntries = entriesByDate[dk] || [];
                    const dotColors = Array.from(new Set(dayEntries.map((e) => e.statusColor))).slice(0, 3);

                    return (
                      <Pressable
                        key={dk}
                        style={[
                          styles.weekDayCell,
                          isSelected && { backgroundColor: colors.primary },
                          !isSelected && isToday && { borderWidth: 1, borderColor: colors.primary },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          if (dk === selectedDateKey) {
                            setWeekFilterSelectedDay((prev) => !prev);
                          } else {
                            setSelectedDateKey(dk);
                            setWeekFilterSelectedDay(true);
                          }
                        }}>
                        <Text
                          style={[
                            styles.weekDayLabel,
                            { color: isSelected ? '#ffffff' : colors.textMuted },
                          ]}>
                          {WEEKDAY_LABELS[idx]}
                        </Text>
                        <Text
                          style={[
                            styles.weekDayNum,
                            { color: isSelected ? '#ffffff' : colors.text },
                          ]}>
                          {dayNum}
                        </Text>
                        <View style={styles.dotsRow}>
                          {dotColors.map((c, dIdx) => (
                            <View
                              key={`wd-${dIdx}`}
                              style={[
                                styles.cellDot,
                                { backgroundColor: isSelected ? '#ffffff' : c },
                              ]}
                            />
                          ))}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {weekFilterSelectedDay && (
                  <Pressable
                    style={[styles.weekShowAllPill, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setWeekFilterSelectedDay(false);
                    }}>
                    <Text style={[styles.weekShowAllText, { color: colors.primary }]}>
                      Showing selected day • Tap to show full week
                    </Text>
                  </Pressable>
                )}

                {weekEntriesCount > 0 ? (
                  <View style={styles.weekAgendaGroups}>
                    {weekDaysToRender.map((dk) => renderDateSection(dk))}
                  </View>
                ) : (
                  <View style={styles.emptyBox}>
                    <Ionicons name="calendar-clear-outline" size={38} color={colors.textMuted} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      No releases this {weekFilterSelectedDay ? 'day' : 'week'}
                    </Text>
                    <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                      Try switching status filters or navigating to another week.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* VIEW 3: MONTH */}
            {viewMode === 'month' && (
              <>
                <View style={[styles.monthGridCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                  <View style={styles.monthWeekdaysRow}>
                    {WEEKDAY_LABELS.map((w) => (
                      <Text key={w} style={[styles.monthWeekdayHeader, { color: colors.textMuted }]}>
                        {w}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.monthDaysGrid}>
                    {monthGridCells.map((cell) => {
                      if (cell.type === 'empty') {
                        return <View key={cell.key} style={styles.monthDayCell} />;
                      }
                      const isSelected = cell.dateKey === selectedDateKey;
                      const isToday = cell.dateKey === todayKey;
                      const dayEntries = entriesByDate[cell.dateKey] || [];
                      const dotColors = Array.from(new Set(dayEntries.map((e) => e.statusColor))).slice(0, 3);

                      return (
                        <Pressable
                          key={cell.key}
                          style={[
                            styles.monthDayCell,
                            isSelected && { backgroundColor: colors.primary },
                            !isSelected && isToday && { borderWidth: 1, borderColor: colors.primary },
                          ]}
                          onPress={() => {
                            triggerHaptic('selection');
                            setSelectedDateKey(cell.dateKey);
                          }}>
                          <Text
                            style={[
                              styles.monthDayText,
                              { color: isSelected ? '#ffffff' : colors.text },
                              isSelected && { fontWeight: '800' },
                            ]}>
                            {cell.day}
                          </Text>
                          <View style={styles.dotsRow}>
                            {dotColors.map((c, idx) => (
                              <View
                                key={`md-${idx}`}
                                style={[
                                  styles.cellDot,
                                  { backgroundColor: isSelected ? '#ffffff' : c },
                                ]}
                              />
                            ))}
                            {dayEntries.length > 3 && (
                              <Text
                                style={[
                                  styles.moreDotText,
                                  { color: isSelected ? '#ffffff' : colors.textSecondary },
                                ]}>
                                +
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.monthSelectedSection}>
                  <View style={styles.dayGroupHeader}>
                    <Text style={[styles.dayGroupHeadingText, { color: colors.textSecondary, fontSize: Math.round(12 * textScale) }]}>
                      {formatAgendaDateHeading(selectedDateKey, dateFormat)}
                      {selectedDateKey === todayKey ? ' (Today)' : ''}
                    </Text>
                    <Text style={[styles.dayGroupCount, { color: colors.textMuted, fontSize: Math.round(11 * textScale) }]}>
                      {selectedDayEntries.length} {selectedDayEntries.length === 1 ? 'entry' : 'entries'}
                    </Text>
                  </View>

                  {selectedDayEntries.length > 0 ? (
                    <View style={styles.agendaList}>{selectedDayEntries.map(renderAgendaCard)}</View>
                  ) : (
                    <View style={[styles.inlineEmptyCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                      <Text style={[styles.inlineEmptyText, { color: colors.textMuted }]}>
                        No releases on {formatAgendaDateHeading(selectedDateKey, dateFormat)}.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* VIEW 4: YEAR */}
            {viewMode === 'year' && (
              <View style={styles.yearGrid}>
                {yearMonthsSummary.map((m) => {
                  const isCurrentMonth = m.monthIndex === selectedMonth;
                  const hasEntries = m.entryCount > 0;
                  return (
                    <Pressable
                      key={`yr-${m.monthIndex}`}
                      style={({ pressed }) => [
                        styles.yearMonthCard,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: isCurrentMonth ? colors.primary : colors.cardBorder,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => {
                        triggerHaptic('selection');
                        const targetKey =
                          m.firstEntryDateKey ||
                          `${selectedYear}-${String(m.monthIndex + 1).padStart(2, '0')}-01`;
                        setSelectedDateKey(targetKey);
                        setViewMode('month');
                      }}>
                      <View style={styles.yearMonthTop}>
                        <Text
                          style={[
                            styles.yearMonthName,
                            { color: isCurrentMonth ? colors.primary : colors.text },
                          ]}>
                          {m.shortName}
                        </Text>
                        <View
                          style={[
                            styles.yearCountBadge,
                            { backgroundColor: hasEntries ? colors.primaryBg : colors.card },
                          ]}>
                          <Text
                            style={[
                              styles.yearCountText,
                              { color: hasEntries ? colors.primary : colors.textMuted },
                            ]}>
                            {m.entryCount}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.yearDotsRow}>
                        {m.dotColors.length > 0 ? (
                          m.dotColors.map((c, idx) => (
                            <View key={`ym-${idx}`} style={[styles.yearStatusDot, { backgroundColor: c }]} />
                          ))
                        ) : (
                          <Text style={[styles.yearNoneText, { color: colors.textMuted }]}>--</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    height: '88%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontWeight: '800',
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  todayPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    includeFontPadding: false,
  },
  closeBtn: {
    padding: 4,
  },
  controlsBlock: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 10,
  },
  viewSwitcherRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  viewSwitchBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewSwitchText: {
    fontWeight: '700',
    includeFontPadding: false,
  },
  statusFilterScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  statusFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusFilterDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusFilterText: {
    fontWeight: '600',
    includeFontPadding: false,
  },
  periodNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  periodNavBtn: {
    padding: 4,
  },
  periodNavTitle: {
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  bodyScroll: {
    flex: 1,
  },
  bodyScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 36,
  },
  weekStripCard: {
    flexDirection: 'row',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 3,
  },
  weekDayLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  weekDayNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  weekShowAllPill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  weekShowAllText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  weekAgendaGroups: {
    gap: 12,
  },
  monthGridCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 14,
  },
  monthWeekdaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  monthWeekdayHeader: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  monthDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthDayCell: {
    width: '14.28%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginVertical: 1,
    gap: 2,
  },
  monthDayText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2.5,
    height: 8,
  },
  cellDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  moreDotText: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 9,
  },
  monthSelectedSection: {
    gap: 8,
  },
  dayGroupBlock: {
    gap: 6,
  },
  dayGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayGroupHeadingText: {
    fontWeight: '700',
  },
  dayGroupCount: {
    fontWeight: '600',
  },
  agendaList: {
    gap: 8,
  },
  agendaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 10,
  },
  agendaStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  agendaDualStripe: {
    width: 4,
    alignSelf: 'stretch',
    flexDirection: 'column',
  },
  agendaPosterWrap: {
    width: 42,
    height: 62,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaPoster: {
    width: '100%',
    height: '100%',
  },
  agendaInfo: {
    flex: 1,
    gap: 3,
  },
  agendaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agendaTitle: {
    fontWeight: '700',
    flex: 1,
  },
  agendaTypePill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  agendaTypeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  agendaSubtitle: {
    fontWeight: '500',
  },
  agendaStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  agendaStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  agendaStatusText: {
    fontWeight: '700',
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  yearMonthCard: {
    width: '31.5%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  yearMonthTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearMonthName: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  yearCountBadge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  yearDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 10,
  },
  yearStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  yearNoneText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  inlineEmptyCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  inlineEmptyText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
