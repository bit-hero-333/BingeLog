import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
  useWindowDimensions,
  ScrollView,
  Modal,
  BackHandler,
  Keyboard,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';
import { TrackedItem, MediaType } from '@/types/media';
import { TMDBService } from '@/services/tmdb';
import { MediaCard } from '@/components/MediaCard';
import { StatsHeader } from '@/components/StatsHeader';
import { StatusFilterChips, FilterStatus } from '@/components/StatusFilterChips';
import { TrackModal } from '@/components/TrackModal';
import { BingeRouletteModal } from '@/components/BingeRouletteModal';
import { getCountdownInfo } from '@/utils/date';
import { getTextScale, getHeaderScale, getButtonScale } from '@/utils/sizing';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type MediaTypeFilter = 'all' | 'movie' | 'tv';

type SortOption =
  | 'updated'
  | 'added'
  | 'title_asc'
  | 'title_desc'
  | 'score_desc'
  | 'score_asc'
  | 'release_desc'
  | 'release_asc'
  | 'upcoming';

interface SortOptionConfig {
  id: SortOption;
  label: string;
  shortLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const SORT_OPTIONS: SortOptionConfig[] = [
  { id: 'updated', label: 'Recently Updated', shortLabel: 'Recent', icon: 'time-outline' },
  { id: 'added', label: 'Date Added (Newest)', shortLabel: 'Added', icon: 'calendar-outline' },
  { id: 'title_asc', label: 'Title (A → Z)', shortLabel: 'A → Z', icon: 'text-outline' },
  { id: 'title_desc', label: 'Title (Z → A)', shortLabel: 'Z → A', icon: 'text-outline' },
  { id: 'score_desc', label: 'User Score (Highest)', shortLabel: 'Score ↓', icon: 'star' },
  { id: 'score_asc', label: 'User Score (Lowest)', shortLabel: 'Score ↑', icon: 'star-outline' },
  { id: 'release_desc', label: 'Release Year (Newest)', shortLabel: 'Year ↓', icon: 'film-outline' },
  { id: 'release_asc', label: 'Release Year (Oldest)', shortLabel: 'Year ↑', icon: 'film-outline' },
  { id: 'upcoming', label: 'Upcoming Release (Earliest)', shortLabel: 'Upcoming', icon: 'calendar-outline' },
];

export default function MyListScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  const {
    trackedItems,
    saveItems,
    saveItem,
    removeItem,
    stats,
    apiKey,
    triggerHaptic,
    selectedRegion,
    selectedTimezone,
    sizingConfig,
  } = useMedia();
  const { colors } = useAppTheme();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);
  const buttonScale = getButtonScale(sizingConfig?.buttonSize);

  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter>('all');
  const [isMediaTypeDropdownOpen, setIsMediaTypeDropdownOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [filterUpcomingOnly, setFilterUpcomingOnly] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Pull-to-refresh metadata sync state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshBanner, setRefreshBanner] = useState<string | null>(null);

  // Modal state
  const [activeItem, setActiveItem] = useState<TrackedItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [rouletteVisible, setRouletteVisible] = useState(false);

  // Back gesture handler: dismisses local modals and search before tab navigation
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (sortModalVisible) {
          setSortModalVisible(false);
          return true;
        }
        if (isMediaTypeDropdownOpen) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsMediaTypeDropdownOpen(false);
          return true;
        }
        if (filterQuery.trim().length > 0) {
          setFilterQuery('');
          Keyboard.dismiss();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [sortModalVisible, isMediaTypeDropdownOpen, filterQuery])
  );

  // Movie vs TV counts
  const movieCount = useMemo(
    () => trackedItems.filter((i) => i.mediaType === 'movie').length,
    [trackedItems]
  );
  const tvCount = useMemo(
    () => trackedItems.filter((i) => i.mediaType === 'tv').length,
    [trackedItems]
  );

  // Live upcoming releases count across watchlist
  const upcomingCount = useMemo(() => {
    return trackedItems.filter((i) => {
      const dateStr =
        i.mediaType === 'movie'
          ? i.regionalReleaseDate || i.releaseDate
          : i.nextAirDate || i.nextEpisode?.airDate;
      if (!dateStr) return false;
      return getCountdownInfo(dateStr, selectedTimezone).isUpcoming;
    }).length;
  }, [trackedItems, selectedTimezone]);

  // Status counts dynamically tailored to selected mediaTypeFilter
  const statusCounts = useMemo<Record<FilterStatus, number>>(() => {
    const baseItems =
      mediaTypeFilter === 'all'
        ? trackedItems
        : trackedItems.filter((i) => i.mediaType === mediaTypeFilter);

    const counts: Record<FilterStatus, number> = {
      all: baseItems.length,
      watching: 0,
      plan_to_watch: 0,
      completed: 0,
      on_hold: 0,
      dropped: 0,
    };

    baseItems.forEach((i) => {
      if (counts[i.status] !== undefined) {
        counts[i.status]++;
      }
      if (i.mediaType === 'tv' && i.status === 'completed' && i.isAlsoPlanned) {
        counts.plan_to_watch++;
      }
    });

    return counts;
  }, [trackedItems, mediaTypeFilter]);

  // Unique genres in current library / media type selection
  const availableGenres = useMemo(() => {
    const baseItems =
      mediaTypeFilter === 'all'
        ? trackedItems
        : trackedItems.filter((i) => i.mediaType === mediaTypeFilter);

    const genreMap = new Map<string, number>();
    baseItems.forEach((item) => {
      item.genres?.forEach((g) => {
        genreMap.set(g, (genreMap.get(g) || 0) + 1);
      });
    });

    return Array.from(genreMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [trackedItems, mediaTypeFilter]);

  // Filtered & sorted items
  const displayedItems = useMemo(() => {
    let result = [...trackedItems];

    // Filter by Media Type
    if (mediaTypeFilter !== 'all') {
      result = result.filter((i) => i.mediaType === mediaTypeFilter);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'plan_to_watch') {
        result = result.filter(
          (i) => i.status === 'plan_to_watch' || (i.mediaType === 'tv' && i.status === 'completed' && Boolean(i.isAlsoPlanned))
        );
      } else {
        result = result.filter((i) => i.status === selectedStatus);
      }
    }

    // Filter by genre
    if (selectedGenre) {
      result = result.filter((i) => i.genres?.includes(selectedGenre));
    }

    // Filter by upcoming releases only
    if (filterUpcomingOnly) {
      result = result.filter((i) => {
        const dateStr =
          i.mediaType === 'movie'
            ? i.regionalReleaseDate || i.releaseDate
            : i.nextAirDate || i.nextEpisode?.airDate;
        if (!dateStr) return false;
        return getCountdownInfo(dateStr, selectedTimezone).isUpcoming;
      });
    }

    // Filter by query
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'upcoming': {
          const getDateMs = (i: TrackedItem) => {
            const d =
              i.mediaType === 'movie'
                ? i.regionalReleaseDate || i.releaseDate
                : i.nextAirDate || i.nextEpisode?.airDate;
            if (!d) return 9999999999999;
            const t = new Date(d).getTime();
            return isNaN(t) ? 9999999999999 : t;
          };
          return getDateMs(a) - getDateMs(b);
        }
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'title_desc':
          return b.title.localeCompare(a.title);
        case 'score_desc':
          return (b.userScore || 0) - (a.userScore || 0);
        case 'score_asc':
          return (a.userScore || 0) - (b.userScore || 0);
        case 'release_desc': {
          const yearA = parseInt(a.releaseYear || '0', 10);
          const yearB = parseInt(b.releaseYear || '0', 10);
          return yearB - yearA;
        }
        case 'release_asc': {
          const yearA = parseInt(a.releaseYear || '9999', 10);
          const yearB = parseInt(b.releaseYear || '9999', 10);
          return yearA - yearB;
        }
        case 'added':
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        case 'updated':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return result;
  }, [trackedItems, mediaTypeFilter, selectedStatus, selectedGenre, filterUpcomingOnly, filterQuery, sortBy, selectedTimezone]);

  const handleRefresh = async () => {
    if (!apiKey) {
      setRefreshBanner('Set TMDB API Key in Settings to sync');
      setTimeout(() => setRefreshBanner(null), 3500);
      return;
    }

    setIsRefreshing(true);
    setRefreshBanner(null);

    try {
      // Find active titles that need sync
      const activeTitles = trackedItems.filter(
        (i) => i.status === 'watching' || i.status === 'plan_to_watch'
      );

      if (activeTitles.length === 0) {
        setRefreshBanner('No active titles to sync');
        setTimeout(() => setRefreshBanner(null), 2500);
        return;
      }

      const updatedItems: TrackedItem[] = [];
      for (const item of activeTitles) {
        try {
          const details = await TMDBService.getMediaDetails(item.id, item.mediaType, apiKey, selectedRegion);
          const updated: TrackedItem = {
            ...item,
            totalEpisodes: details.numberOfEpisodes ?? item.totalEpisodes,
            totalSeasons: details.numberOfSeasons ?? item.totalSeasons,
            totalProgress: item.mediaType === 'tv' && details.numberOfEpisodes ? details.numberOfEpisodes : item.totalProgress,
            seasons: details.seasons && details.seasons.length > 0 ? details.seasons : item.seasons,
            tagline: details.tagline || item.tagline,
            releaseDate: details.releaseDate || item.releaseDate,
            regionalReleaseDate: details.regionalReleaseDate || item.regionalReleaseDate,
            regionalReleaseType: details.regionalReleaseType || item.regionalReleaseType,
            nextAirDate: details.nextAirDate || item.nextAirDate,
            nextEpisode: details.nextEpisode || item.nextEpisode,
            lastSyncedAt: new Date().toISOString(),
          };
          updatedItems.push(updated);
        } catch {
          // Skip silently on item error
        }
      }

      if (updatedItems.length > 0) {
        await saveItems(updatedItems);
        setRefreshBanner(`Synced ${updatedItems.length} active title${updatedItems.length > 1 ? 's' : ''}!`);
      } else {
        setRefreshBanner('Metadata is up to date');
      }
      setTimeout(() => setRefreshBanner(null), 3500);
    } catch (e) {
      console.warn('Failed to refresh list', e);
      setRefreshBanner('Sync failed');
      setTimeout(() => setRefreshBanner(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCardPress = (item: TrackedItem) => {
    triggerHaptic('selection');
    setActiveItem(item);
    setModalVisible(true);
  };

  const activeSortLabel = useMemo(() => {
    const found = SORT_OPTIONS.find((s) => s.id === sortBy);
    return found ? found.shortLabel : 'Recent';
  }, [sortBy]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Subheader / Search & Sort bar */}
      <View style={[styles.topControlSection, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, minHeight: Math.max(36, Math.round(38 * buttonScale)) }]}>
          <Ionicons name="search" size={Math.round(16 * textScale)} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontSize: Math.round(13 * textScale) }]}
            placeholder="Filter your list..."
            placeholderTextColor={colors.textMuted}
            value={filterQuery}
            onChangeText={setFilterQuery}
          />
          {filterQuery.length > 0 && (
            <Pressable onPress={() => setFilterQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={Math.round(16 * textScale)} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[
            styles.rouletteButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              minHeight: Math.max(36, Math.round(38 * buttonScale)),
              minWidth: Math.max(36, Math.round(38 * buttonScale)),
            },
          ]}
          onPress={() => {
            triggerHaptic('impact');
            setRouletteVisible(true);
          }}
          accessibilityLabel="What should I watch next roulette">
          <Ionicons name="dice-outline" size={Math.round(18 * textScale)} color={colors.primary} />
        </Pressable>

        <Pressable
          style={[styles.sortButton, { backgroundColor: colors.card, borderColor: colors.cardBorder, minHeight: Math.max(36, Math.round(38 * buttonScale)) }]}
          onPress={() => {
            triggerHaptic('selection');
            setSortModalVisible(true);
          }}>
          <Ionicons name="swap-vertical" size={Math.round(14 * textScale)} color={colors.primary} />
          <Text style={[styles.sortButtonText, { color: colors.primary, fontSize: Math.round(12 * textScale) }]}>{activeSortLabel}</Text>
        </Pressable>
      </View>

      {/* Media Type & Upcoming Filter Controls */}
      <View style={styles.mediaTypeSection}>
        <View style={styles.mediaTypeRow}>
          <Pressable
            style={[
              styles.mediaTypeDropdownBtn,
              { backgroundColor: colors.card, borderColor: colors.cardBorder, minHeight: Math.max(36, Math.round(38 * buttonScale)) },
              mediaTypeFilter !== 'all' && { borderColor: colors.primary, backgroundColor: colors.primaryBg },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setIsMediaTypeDropdownOpen((prev) => !prev);
            }}>
            <Ionicons
              name={
                mediaTypeFilter === 'movie'
                  ? 'film-outline'
                  : mediaTypeFilter === 'tv'
                  ? 'tv-outline'
                  : 'layers-outline'
              }
              size={Math.round(14 * textScale)}
              color={mediaTypeFilter !== 'all' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.mediaTypeDropdownText,
                { color: mediaTypeFilter !== 'all' ? colors.primary : colors.text, fontSize: Math.round(12.5 * textScale) },
              ]}
              numberOfLines={1}>
              {mediaTypeFilter === 'movie'
                ? `Movies (${movieCount})`
                : mediaTypeFilter === 'tv'
                ? `TV (${tvCount})`
                : `All (${trackedItems.length})`}
            </Text>
            <Ionicons
              name={isMediaTypeDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={Math.round(13 * textScale)}
              color={mediaTypeFilter !== 'all' ? colors.primary : colors.textSecondary}
            />
          </Pressable>

          <Pressable
            style={[
              styles.upcomingToggleBtn,
              {
                backgroundColor: filterUpcomingOnly ? colors.primaryBg : colors.card,
                borderColor: filterUpcomingOnly ? colors.primary : colors.cardBorder,
                minHeight: Math.max(36, Math.round(38 * buttonScale)),
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setFilterUpcomingOnly((prev) => !prev);
            }}>
            <Ionicons
              name="calendar-outline"
              size={Math.round(13 * textScale)}
              color={filterUpcomingOnly ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.upcomingToggleText,
                { color: filterUpcomingOnly ? colors.primary : colors.textSecondary, fontSize: Math.round(12 * textScale) },
              ]}>
              Upcoming ({upcomingCount})
            </Text>
          </Pressable>
        </View>

        {isMediaTypeDropdownOpen && (
          <View
            style={[
              styles.inlineMediaTypeDropdown,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}>
            {(
              [
                {
                  id: 'all' as const,
                  label: 'All Titles',
                  count: trackedItems.length,
                  icon: 'layers-outline' as const,
                },
                {
                  id: 'movie' as const,
                  label: 'Movies',
                  count: movieCount,
                  icon: 'film-outline' as const,
                },
                {
                  id: 'tv' as const,
                  label: 'TV Shows',
                  count: tvCount,
                  icon: 'tv-outline' as const,
                },
              ] as const
            ).map((opt, idx, arr) => {
              const isSelected = mediaTypeFilter === opt.id;
              const isLast = idx === arr.length - 1;
              return (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.inlineMediaTypeOption,
                    !isLast && { borderBottomWidth: 1, borderBottomColor: colors.divider },
                    isSelected && { backgroundColor: colors.primaryBg },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setMediaTypeFilter(opt.id);
                    setIsMediaTypeDropdownOpen(false);
                  }}>
                  <View style={styles.inlineMediaTypeOptionLeft}>
                    <Ionicons
                      name={opt.icon}
                      size={Math.round(16 * textScale)}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.inlineMediaTypeOptionLabel,
                        {
                          color: isSelected ? colors.primary : colors.text,
                          fontSize: Math.round(13 * textScale),
                        },
                        isSelected && { fontWeight: '700' },
                      ]}>
                      {opt.label}
                    </Text>
                    <Text
                      style={[
                        styles.inlineMediaTypeOptionCount,
                        {
                          color: isSelected ? colors.primary : colors.textSecondary,
                          fontSize: Math.round(12 * textScale),
                        },
                      ]}>
                      ({opt.count})
                    </Text>
                  </View>

                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={Math.round(18 * textScale)}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Sync Banner notification */}
      {refreshBanner ? (
        <View style={[styles.bannerContainer, { backgroundColor: colors.cardSelected, borderColor: colors.primary }]}>
          <Ionicons name="cloud-done-outline" size={14} color={colors.primary} />
          <Text style={[styles.bannerText, { color: colors.text }]}>{refreshBanner}</Text>
        </View>
      ) : null}

      {/* Status Filter Chips */}
      <View style={[styles.chipsSection, { borderBottomColor: colors.cardBorder }]}>
        <StatusFilterChips
          selectedStatus={selectedStatus}
          onSelect={setSelectedStatus}
          counts={statusCounts}
        />
      </View>

      {/* Optional Genre Filter Chips */}
      {availableGenres.length > 0 && (
        <View style={[styles.genreChipsRowContainer, { borderBottomColor: colors.divider }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreScrollContent}>
            <Pressable
              style={[
                styles.genreChip,
                { backgroundColor: selectedGenre === null ? colors.primaryBg : colors.card, borderColor: selectedGenre === null ? colors.primary : colors.cardBorder },
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setSelectedGenre(null);
              }}>
              <Text
                style={[
                  styles.genreChipText,
                  { color: selectedGenre === null ? colors.primary : colors.textSecondary, fontWeight: selectedGenre === null ? '700' : '500', fontSize: Math.round(12 * textScale) },
                ]}>
                All Genres
              </Text>
            </Pressable>

            {availableGenres.map(({ name, count }) => {
              const isSelected = selectedGenre === name;
              return (
                <Pressable
                  key={name}
                  style={[
                    styles.genreChip,
                    {
                      backgroundColor: isSelected ? colors.primaryBg : colors.card,
                      borderColor: isSelected ? colors.primary : colors.cardBorder,
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setSelectedGenre(isSelected ? null : name);
                  }}>
                  <Text
                    style={[
                      styles.genreChipText,
                      { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: isSelected ? '700' : '500', fontSize: Math.round(12 * textScale) },
                    ]}>
                    {name} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main List */}
      <FlatList
        key={`mylist-grid-${numColumns}`}
        data={displayedItems}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={(item) => `${item.mediaType}-${item.id}`}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            trackedRecord={item}
            onPress={() => handleCardPress(item)}
            style={numColumns > 1 ? styles.gridCard : undefined}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          trackedItems.length > 0 ? (
            <StatsHeader
              total={stats.total}
              watching={stats.watching}
              planToWatch={stats.planToWatch}
              completed={stats.completed}
              onHold={stats.onHold}
              dropped={stats.dropped}
              meanScore={stats.meanScore}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={52} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text, fontSize: Math.round(17 * headerScale) }]} selectable={true}>
              {trackedItems.length === 0
                ? 'Your list is empty'
                : 'No matching titles found'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary, fontSize: Math.round(13 * textScale) }]} selectable={true}>
              {trackedItems.length === 0
                ? 'Explore trending movies & TV shows and add them to your tracker.'
                : 'Try changing your filters, genre selection, or search keyword.'}
            </Text>

            {trackedItems.length === 0 && (
              <Pressable
                style={[styles.discoverBtn, { backgroundColor: colors.primary, minHeight: Math.max(38, Math.round(40 * buttonScale)) }]}
                onPress={() => router.push('/')}>
                <Ionicons name="compass-outline" size={Math.round(16 * textScale)} color="#ffffff" />
                <Text style={[styles.discoverBtnText, { fontSize: Math.round(14 * textScale) }]}>Explore Titles</Text>
              </Pressable>
            )}
          </View>
        }
      />

      {/* Sort Options Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}>
        <Pressable style={styles.sortModalBackdrop} onPress={() => setSortModalVisible(false)}>
          <Pressable
            style={[styles.sortModalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sortModalHeader, { borderBottomColor: colors.divider }]}>
              <View style={styles.sortModalHeaderTitleRow}>
                <Ionicons name="swap-vertical" size={Math.round(18 * headerScale)} color={colors.primary} />
                <Text style={[styles.sortModalTitle, { color: colors.text, fontSize: Math.round(16 * headerScale) }]} selectable={true}>Sort Watchlist</Text>
              </View>
              <Pressable
                onPress={() => setSortModalVisible(false)}
                hitSlop={8}
                style={styles.sortModalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.sortOptionsList} showsVerticalScrollIndicator={false}>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = sortBy === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.sortOptionRow,
                      { borderBottomColor: colors.divider },
                      isSelected && { backgroundColor: colors.primaryBg },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setSortBy(opt.id);
                      setSortModalVisible(false);
                    }}>
                    <View style={styles.sortOptionLeft}>
                      <Ionicons
                        name={opt.icon}
                        size={Math.round(17 * textScale)}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.sortOptionLabel,
                          { color: isSelected ? colors.primary : colors.text, fontSize: Math.round(13.5 * textScale) },
                          isSelected && { fontWeight: '700' },
                        ]}>
                        {opt.label}
                      </Text>
                    </View>

                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={19} color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Track / Edit Modal */}
      <TrackModal
        visible={modalVisible}
        item={activeItem}
        existingRecord={activeItem || undefined}
        onClose={() => {
          setModalVisible(false);
          setActiveItem(null);
        }}
        onSave={(record) => {
          saveItem(record);
        }}
        onRemove={(id, mediaType: MediaType) => {
          removeItem(id, mediaType);
        }}
      />

      {/* Binge Roulette Modal */}
      <BingeRouletteModal
        visible={rouletteVisible}
        onClose={() => setRouletteVisible(false)}
        onSelectItem={handleCardPress}
        initialFormat={mediaTypeFilter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topControlSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    marginLeft: 6,
    height: '100%',
  },
  clearBtn: {
    padding: 2,
  },
  rouletteButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mediaTypeSection: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  mediaTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaTypeDropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
  },
  mediaTypeDropdownText: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  upcomingToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
  },
  upcomingToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inlineMediaTypeDropdown: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inlineMediaTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inlineMediaTypeOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineMediaTypeOptionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  inlineMediaTypeOptionCount: {
    fontSize: 12,
    marginLeft: 2,
  },
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipsSection: {
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  genreChipsRowContainer: {
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  genreScrollContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  genreChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  genreChipText: {
    fontSize: 11,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  discoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  discoverBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  columnWrapper: {
    gap: 12,
  },
  gridCard: {
    flex: 1,
    marginBottom: 12,
  },
  sortModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sortModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sortModalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortModalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sortModalCloseBtn: {
    padding: 4,
  },
  sortOptionsList: {
    paddingVertical: 4,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sortOptionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
});
