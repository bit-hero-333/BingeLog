import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';
import { TMDBService } from '@/services/tmdb';
import { TMDBMediaItem, TrackedItem, MediaType } from '@/types/media';
import { MediaCard } from '@/components/MediaCard';
import { TrackModal } from '@/components/TrackModal';

type MediaFilter = 'all' | 'movie' | 'tv';

export default function DiscoverScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  const { colors } = useAppTheme();
  const {
    apiKey,
    saveItem,
    removeItem,
    getTrackedStatus,
    isLoadingStorage,
    activeDiscoverFilter,
    setActiveDiscoverFilter,
    triggerHaptic,
  } = useMedia();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<MediaFilter>('all');
  const [items, setItems] = useState<TMDBMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected item for TrackModal
  const [activeItem, setActiveItem] = useState<TMDBMediaItem | TrackedItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchFilteredMedia = useCallback(async () => {
    if (!apiKey || !activeDiscoverFilter) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const results = await TMDBService.discoverByEntity(
        activeDiscoverFilter.type,
        activeDiscoverFilter.id,
        apiKey
      );
      setItems(results);
    } catch (e: unknown) {
      const err = e as Error;
      setErrorMessage(err.message || 'Failed to load media for this filter.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiKey, activeDiscoverFilter]);

  const fetchDefaultMedia = useCallback(async () => {
    if (!apiKey) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let results: TMDBMediaItem[] = [];
      if (selectedFilter === 'all') {
        results = await TMDBService.getTrending('all', apiKey, 'day');
      } else {
        results = await TMDBService.getTrending(selectedFilter, apiKey, 'day');
      }
      setItems(results);
    } catch (e: unknown) {
      const err = e as Error;
      setErrorMessage(err.message || 'Failed to load trending media.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiKey, selectedFilter]);

  const performSearch = useCallback(
    async (query: string, filter: MediaFilter) => {
      if (!apiKey) return;
      if (!query.trim()) {
        fetchDefaultMedia();
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        let results: TMDBMediaItem[] = [];
        if (filter === 'all') {
          results = await TMDBService.searchMulti(query, apiKey);
        } else {
          results = await TMDBService.searchByType(query, filter, apiKey);
        }
        setItems(results);
      } catch (e: unknown) {
        const err = e as Error;
        setErrorMessage(err.message || 'Search failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, fetchDefaultMedia]
  );

  useEffect(() => {
    let isMounted = true;
    if (!apiKey) return;

    if (activeDiscoverFilter) {
      const timer = setTimeout(() => {
        if (isMounted) {
          fetchFilteredMedia();
        }
      }, 10);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }

    if (searchQuery.trim()) {
      const timer = setTimeout(() => {
        if (isMounted) {
          performSearch(searchQuery, selectedFilter);
        }
      }, 400);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      const timer = setTimeout(() => {
        if (isMounted) {
          fetchDefaultMedia();
        }
      }, 10);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [
    searchQuery,
    selectedFilter,
    apiKey,
    activeDiscoverFilter,
    performSearch,
    fetchDefaultMedia,
    fetchFilteredMedia,
  ]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (activeDiscoverFilter) {
      fetchFilteredMedia();
    } else if (searchQuery.trim()) {
      performSearch(searchQuery, selectedFilter);
    } else {
      fetchDefaultMedia();
    }
  };

  const handleFilterChange = (filter: MediaFilter) => {
    triggerHaptic('selection');
    setSelectedFilter(filter);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const handleOpenTrackModal = (item: TMDBMediaItem) => {
    setActiveItem(item);
    setModalVisible(true);
  };

  const activeExistingRecord = activeItem
    ? getTrackedStatus(
        activeItem.id,
        'status' in activeItem
          ? (activeItem as TrackedItem).mediaType
          : ((activeItem as TMDBMediaItem).media_type || 'movie')
      )
    : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View style={[styles.searchSection, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search anime, movies, series..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={handleClearSearch} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Filter Pills: All / Movies / TV */}
        <View style={styles.filterRow}>
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'movie', label: 'Movies' },
              { id: 'tv', label: 'TV Shows' },
            ] as const
          ).map((filter) => {
            const isSelected = selectedFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                style={[
                  styles.filterPill,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => handleFilterChange(filter.id)}>
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isSelected ? '#ffffff' : colors.textSecondary },
                    isSelected && styles.filterPillTextSelected,
                  ]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Active Entity Filter Banner */}
        {activeDiscoverFilter && (
          <View style={styles.activeFilterBanner}>
            <View style={styles.activeFilterBadge}>
              <Ionicons
                name={
                  activeDiscoverFilter.type === 'person'
                    ? 'person'
                    : activeDiscoverFilter.type === 'genre'
                    ? 'pricetag'
                    : 'business'
                }
                size={13}
                color="#38bdf8"
              />
              <Text style={styles.activeFilterText}>
                {activeDiscoverFilter.type === 'person'
                  ? 'Person:'
                  : activeDiscoverFilter.type === 'genre'
                  ? 'Genre:'
                  : 'Studio:'}{' '}
                <Text style={styles.activeFilterName}>{activeDiscoverFilter.name}</Text>
              </Text>
            </View>

            <Pressable
              style={styles.clearFilterBtn}
              onPress={() => setActiveDiscoverFilter(null)}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
              <Text style={styles.clearFilterBtnText}>Clear</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* No API Key Notice */}
      {!apiKey && !isLoadingStorage && (
        <View style={styles.noApiKeyCard}>
          <Ionicons name="key-outline" size={28} color="#38bdf8" />
          <View style={styles.noApiKeyContent}>
            <Text style={styles.noApiKeyTitle}>TMDB API Key Required</Text>
            <Text style={styles.noApiKeySub}>
              To search and fetch poster artwork, please enter your free TMDB API key in Settings.
            </Text>
          </View>
          <Pressable
            style={styles.settingsNavBtn}
            onPress={() => router.push('/settings')}>
            <Text style={styles.settingsNavBtnText}>Setup</Text>
            <Ionicons name="chevron-forward" size={14} color="#ffffff" />
          </Pressable>
        </View>
      )}

      {/* Media Results List */}
      {isLoading && !isRefreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Fetching from TMDB...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          key={`discover-grid-${numColumns}`}
          data={items}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => `${item.media_type || 'm'}-${item.id}`}
          renderItem={({ item }) => {
            const mediaType: MediaType = item.media_type || 'movie';
            const trackedRecord = getTrackedStatus(item.id, mediaType);
            return (
              <MediaCard
                item={item}
                trackedRecord={trackedRecord}
                onPress={() => handleOpenTrackModal(item)}
                onQuickTrack={() => handleOpenTrackModal(item)}
                style={numColumns > 1 ? styles.gridCard : undefined}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#38bdf8"
              colors={['#38bdf8']}
            />
          }
          ListHeaderComponent={
            apiKey && items.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderTitle}>
                  {activeDiscoverFilter
                    ? `Filtered by ${activeDiscoverFilter.name} (${items.length})`
                    : searchQuery.trim()
                    ? `Results for "${searchQuery}" (${items.length})`
                    : '🔥 Trending Today'}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            apiKey ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#334155" />
                <Text style={styles.emptyTitle}>
                  {activeDiscoverFilter
                    ? `No titles found for ${activeDiscoverFilter.name}`
                    : searchQuery.trim()
                    ? 'No matches found'
                    : 'No titles available'}
                </Text>
                <Text style={styles.emptySub}>
                  {activeDiscoverFilter
                    ? 'Try clearing the filter or searching by keyword'
                    : searchQuery.trim()
                    ? 'Try searching with a different title or keyword'
                    : 'Pull down to refresh trending titles'}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Track / Edit Modal */}
      <TrackModal
        visible={modalVisible}
        item={activeItem}
        existingRecord={activeExistingRecord}
        onClose={() => {
          setModalVisible(false);
          setActiveItem(null);
        }}
        onSave={(record) => {
          saveItem(record);
        }}
        onRemove={(id, mediaType) => {
          removeItem(id, mediaType);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0f15',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#0d0f15',
    borderBottomWidth: 1,
    borderBottomColor: '#161922',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161922',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#232838',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 8,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#232838',
  },
  filterPillSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterPillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  activeFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  activeFilterText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  activeFilterName: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  clearFilterBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  noApiKeyCard: {
    margin: 16,
    padding: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noApiKeyContent: {
    flex: 1,
  },
  noApiKeyTitle: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  noApiKeySub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  settingsNavBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  settingsNavBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  listHeader: {
    marginBottom: 12,
  },
  listHeaderTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 12,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#1f2430',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  columnWrapper: {
    gap: 12,
  },
  gridCard: {
    flex: 1,
    marginBottom: 12,
  },
});
