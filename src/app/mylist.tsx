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

type SortOption = 'updated' | 'score' | 'title';

export default function MyListScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  const { trackedItems, saveItem, saveItems, removeItem, stats, apiKey, triggerHaptic } = useMedia();
  const { colors } = useAppTheme();

  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');

  // Pull-to-refresh metadata sync state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshBanner, setRefreshBanner] = useState<string | null>(null);

  // Modal state
  const [activeItem, setActiveItem] = useState<TrackedItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Status counts for chips
  const statusCounts = useMemo<Record<FilterStatus, number>>(() => {
    const counts: Record<FilterStatus, number> = {
      all: trackedItems.length,
      watching: stats.watching,
      plan_to_watch: stats.planToWatch,
      completed: stats.completed,
      on_hold: stats.onHold,
      dropped: stats.dropped,
    };
    return counts;
  }, [trackedItems.length, stats]);

  // Filtered & sorted items
  const displayedItems = useMemo(() => {
    let result = [...trackedItems];

    // Filter by status
    if (selectedStatus !== 'all') {
      result = result.filter((i) => i.status === selectedStatus);
    }

    // Filter by query
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'score') {
        return (b.userScore || 0) - (a.userScore || 0);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      // 'updated'
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [trackedItems, selectedStatus, filterQuery, sortBy]);

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

  const cycleSort = () => {
    triggerHaptic('selection');
    if (sortBy === 'updated') setSortBy('score');
    else if (sortBy === 'score') setSortBy('title');
    else setSortBy('updated');
  };

  const getSortLabel = () => {
    switch (sortBy) {
      case 'score':
        return 'Score';
      case 'title':
        return 'A-Z';
      case 'updated':
      default:
        return 'Recent';
    }
  };

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
          onPress={cycleSort}>
          <Ionicons name="swap-vertical" size={14} color={colors.primary} />
          <Text style={[styles.sortButtonText, { color: colors.primary }]}>{getSortLabel()}</Text>
        </Pressable>
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
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {trackedItems.length === 0
                ? 'Your list is empty'
                : 'No matching titles found'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              {trackedItems.length === 0
                ? 'Explore trending movies & TV shows and add them to your tracker.'
                : 'Try changing your status filter or search keyword.'}
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
});
