import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';
import { TrackedItem, MediaType } from '@/types/media';
import { TMDBService } from '@/services/tmdb';
import { MediaCard } from '@/components/MediaCard';
import { StatsHeader } from '@/components/StatsHeader';
import { StatusFilterChips, FilterStatus } from '@/components/StatusFilterChips';
import { TrackModal } from '@/components/TrackModal';

type MediaTypeFilter = 'all' | 'movie' | 'tv';

type SortOption =
  | 'updated'
  | 'added'
  | 'title_asc'
  | 'title_desc'
  | 'score_desc'
  | 'score_asc'
  | 'release_desc'
  | 'release_asc';

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
];

export default function MyListScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  const { trackedItems, saveItems, saveItem, removeItem, stats, apiKey, triggerHaptic } = useMedia();
  const { colors } = useAppTheme();

  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter>('all');
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Pull-to-refresh metadata sync state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshBanner, setRefreshBanner] = useState<string | null>(null);

  // Modal state
  const [activeItem, setActiveItem] = useState<TrackedItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Movie vs TV counts
  const movieCount = useMemo(
    () => trackedItems.filter((i) => i.mediaType === 'movie').length,
    [trackedItems]
  );
  const tvCount = useMemo(
    () => trackedItems.filter((i) => i.mediaType === 'tv').length,
    [trackedItems]
  );

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
      result = result.filter((i) => i.status === selectedStatus);
    }

    // Filter by genre
    if (selectedGenre) {
      result = result.filter((i) => i.genres?.includes(selectedGenre));
    }

    // Filter by query
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
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
  }, [trackedItems, mediaTypeFilter, selectedStatus, selectedGenre, filterQuery, sortBy]);

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
          const details = await TMDBService.getMediaDetails(item.id, item.mediaType, apiKey);
          const updated: TrackedItem = {
            ...item,
            totalEpisodes: details.numberOfEpisodes ?? item.totalEpisodes,
            totalSeasons: details.numberOfSeasons ?? item.totalSeasons,
            totalProgress: item.mediaType === 'tv' && details.numberOfEpisodes ? details.numberOfEpisodes : item.totalProgress,
            seasons: details.seasons && details.seasons.length > 0 ? details.seasons : item.seasons,
            tagline: details.tagline || item.tagline,
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
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Filter your list..."
            placeholderTextColor={colors.textMuted}
            value={filterQuery}
            onChangeText={setFilterQuery}
          />
          {filterQuery.length > 0 && (
            <Pressable onPress={() => setFilterQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.sortButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => {
            triggerHaptic('selection');
            setSortModalVisible(true);
          }}>
          <Ionicons name="swap-vertical" size={14} color={colors.primary} />
          <Text style={[styles.sortButtonText, { color: colors.primary }]}>{activeSortLabel}</Text>
        </Pressable>
      </View>

      {/* Media Type Segmented Pills (All | Movies | TV Shows) */}
      <View style={styles.mediaTypeSection}>
        <View style={[styles.mediaTypeSegmentContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Pressable
            style={[
              styles.mediaTypePill,
              mediaTypeFilter === 'all' && [styles.mediaTypePillActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setMediaTypeFilter('all');
            }}>
            <Ionicons
              name="layers-outline"
              size={13}
              color={mediaTypeFilter === 'all' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.mediaTypePillText,
                { color: mediaTypeFilter === 'all' ? colors.primary : colors.textSecondary },
              ]}>
              All ({trackedItems.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.mediaTypePill,
              mediaTypeFilter === 'movie' && [styles.mediaTypePillActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setMediaTypeFilter('movie');
            }}>
            <Ionicons
              name="film-outline"
              size={13}
              color={mediaTypeFilter === 'movie' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.mediaTypePillText,
                { color: mediaTypeFilter === 'movie' ? colors.primary : colors.textSecondary },
              ]}>
              Movies ({movieCount})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.mediaTypePill,
              mediaTypeFilter === 'tv' && [styles.mediaTypePillActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setMediaTypeFilter('tv');
            }}>
            <Ionicons
              name="tv-outline"
              size={13}
              color={mediaTypeFilter === 'tv' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.mediaTypePillText,
                { color: mediaTypeFilter === 'tv' ? colors.primary : colors.textSecondary },
              ]}>
              TV Shows ({tvCount})
            </Text>
          </Pressable>
        </View>
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
                  { color: selectedGenre === null ? colors.primary : colors.textSecondary, fontWeight: selectedGenre === null ? '700' : '500' },
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
                      { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: isSelected ? '700' : '500' },
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
            <Text style={[styles.emptyTitle, { color: colors.text }]} selectable={true}>
              {trackedItems.length === 0
                ? 'Your list is empty'
                : 'No matching titles found'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]} selectable={true}>
              {trackedItems.length === 0
                ? 'Explore trending movies & TV shows and add them to your tracker.'
                : 'Try changing your filters, genre selection, or search keyword.'}
            </Text>

            {trackedItems.length === 0 && (
              <Pressable
                style={[styles.discoverBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/')}>
                <Ionicons name="compass-outline" size={16} color="#ffffff" />
                <Text style={styles.discoverBtnText}>Explore Titles</Text>
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
                <Ionicons name="swap-vertical" size={18} color={colors.primary} />
                <Text style={[styles.sortModalTitle, { color: colors.text }]} selectable={true}>Sort Watchlist</Text>
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
                        size={17}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.sortOptionLabel,
                          { color: isSelected ? colors.primary : colors.text },
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
  mediaTypeSegmentContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  mediaTypePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mediaTypePillActive: {
    borderRadius: 7,
  },
  mediaTypePillText: {
    fontSize: 12,
    fontWeight: '600',
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
