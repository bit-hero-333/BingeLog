import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  BackHandler,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';
import { TMDBService } from '@/services/tmdb';
import {
  TMDBMediaItem,
  TrackedItem,
  MediaType,
  MultiDiscoverFilter,
  DEFAULT_MULTI_DISCOVER_FILTER,
  DiscoverReleaseWindow,
  ItemReminderConfig,
  POPULAR_STREAMING_PROVIDERS,
  PopularProviderOption,
} from '@/types/media';
import { MediaCard } from '@/components/MediaCard';
import { TrackModal } from '@/components/TrackModal';
import { DiscoverFilterModal } from '@/components/DiscoverFilterModal';
import { ReleaseReminderModal } from '@/components/ReleaseReminderModal';
import { getTextScale, getHeaderScale } from '@/utils/sizing';

type DiscoverFeedTab = 'upcoming' | 'trending';

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
    sizingConfig,
    selectedRegion,
    mySubscribedProviders,
    updateItemReminder,
  } = useMedia();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);

  // Active top feed tab: 'upcoming' drops vs 'trending' now
  const [feedTab, setFeedTab] = useState<DiscoverFeedTab>('upcoming');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [multiFilter, setMultiFilter] = useState<MultiDiscoverFilter>(DEFAULT_MULTI_DISCOVER_FILTER);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Results & Pagination
  const [items, setItems] = useState<TMDBMediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected item for TrackModal
  const [activeItem, setActiveItem] = useState<TMDBMediaItem | TrackedItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Selected item for quick ReleaseReminderModal
  const [selectedReminderItem, setSelectedReminderItem] = useState<TMDBMediaItem | null>(null);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);

  // Quick timing windows list
  const TIMING_PRESETS: { id: DiscoverReleaseWindow; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'upcoming_30', label: 'Next 30 Days', icon: 'calendar-outline' },
    { id: 'upcoming_60', label: 'Next 60 Days', icon: 'calendar-outline' },
    { id: 'upcoming_90', label: 'Next 90 Days', icon: 'calendar-outline' },
    { id: 'digital_premieres', label: 'Streaming Premieres', icon: 'tv-outline' },
    { id: 'in_theaters', label: 'In Theaters', icon: 'film-outline' },
    { id: 'all', label: 'All Releases', icon: 'infinite-outline' },
  ];

  // Calculate active filter count (excluding default values)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (multiFilter.releaseWindow !== 'upcoming_30') count++;
    if (multiFilter.providerScope !== 'none') {
      if (multiFilter.providerScope === 'subscribed') count++;
      else if (multiFilter.selectedProviders.length > 0) count++;
    }
    if (multiFilter.selectedGenres.length > 0) count++;
    if (multiFilter.minRating > 0) count++;
    if (multiFilter.selectedPeople.length > 0) count += multiFilter.selectedPeople.length;
    if (multiFilter.selectedCompanies.length > 0) count += multiFilter.selectedCompanies.length;
    if (multiFilter.sortBy !== 'primary_release_date.asc') count++;
    return count;
  }, [multiFilter]);

  const hasActiveCustomFilters =
    activeFilterCount > 0 || multiFilter.mediaType !== 'all' || feedTab === 'trending';

  // Android hardware back handler: dismisses local sheets/searches before bubbling to tab history
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (reminderModalVisible) {
          setReminderModalVisible(false);
          setSelectedReminderItem(null);
          return true;
        }
        if (filterModalVisible) {
          setFilterModalVisible(false);
          return true;
        }
        if (searchQuery.trim().length > 0) {
          setSearchQuery('');
          Keyboard.dismiss();
          return true;
        }
        if (activeDiscoverFilter) {
          setActiveDiscoverFilter(null);
          return true;
        }
        if (hasActiveCustomFilters) {
          setMultiFilter(DEFAULT_MULTI_DISCOVER_FILTER);
          setFeedTab('upcoming');
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [
      reminderModalVisible,
      filterModalVisible,
      searchQuery,
      activeDiscoverFilter,
      hasActiveCustomFilters,
      setActiveDiscoverFilter,
    ])
  );

  // Fetch media using advanced discover or trending
  const fetchMedia = useCallback(
    async (pageToLoad = 1, isAppend = false) => {
      if (!apiKey) return;
      if (isAppend) {
        setIsFetchingNextPage(true);
      } else {
        setIsLoading(true);
        setErrorMessage(null);
      }

      try {
        if (activeDiscoverFilter) {
          const results = await TMDBService.discoverByEntity(
            activeDiscoverFilter.type,
            activeDiscoverFilter.id,
            apiKey,
            pageToLoad,
            selectedRegion
          );
          setItems((prev) => (isAppend ? [...prev, ...results] : results));
          setPage(pageToLoad);
          setTotalPages(pageToLoad + 1);
          return;
        }

        // Search query mode
        if (searchQuery.trim()) {
          let results: TMDBMediaItem[] = [];
          if (multiFilter.mediaType === 'all') {
            results = await TMDBService.searchMulti(searchQuery, apiKey);
          } else {
            results = await TMDBService.searchByType(searchQuery, multiFilter.mediaType, apiKey);
          }
          setItems(results);
          setPage(1);
          setTotalPages(1);
          return;
        }

        // Trending Tab Mode
        if (feedTab === 'trending') {
          const trendingType = multiFilter.mediaType === 'all' ? 'all' : multiFilter.mediaType;
          const results = await TMDBService.getTrending(trendingType, apiKey, 'day');
          setItems(results);
          setPage(1);
          setTotalPages(1);
          return;
        }

        // Upcoming & Advanced Discover Mode
        const res = await TMDBService.advancedDiscover(
          multiFilter,
          apiKey,
          pageToLoad,
          selectedRegion,
          mySubscribedProviders
        );
        setItems((prev) => (isAppend ? [...prev, ...res.results] : res.results));
        setPage(pageToLoad);
        setTotalPages(res.totalPages || 1);
      } catch (e: unknown) {
        const err = e as Error;
        setErrorMessage(err.message || 'Failed to load media.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsFetchingNextPage(false);
      }
    },
    [
      apiKey,
      activeDiscoverFilter,
      selectedRegion,
      searchQuery,
      feedTab,
      multiFilter,
      mySubscribedProviders,
    ]
  );

  // Reload on query / filter / tab changes with debounce
  useEffect(() => {
    let isMounted = true;
    if (!apiKey) return;

    if (searchQuery.trim()) {
      const timer = setTimeout(() => {
        if (isMounted) fetchMedia(1, false);
      }, 400);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }

    const timer = setTimeout(() => {
      if (isMounted) fetchMedia(1, false);
    }, 20);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, feedTab, multiFilter, activeDiscoverFilter, apiKey, fetchMedia]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMedia(1, false);
  };

  const handleLoadMore = () => {
    if (isLoading || isFetchingNextPage || page >= totalPages || searchQuery.trim() || feedTab === 'trending') return;
    fetchMedia(page + 1, true);
  };

  const handleFormatChange = (mediaType: 'all' | 'movie' | 'tv') => {
    triggerHaptic('selection');
    setMultiFilter((prev) => ({ ...prev, mediaType }));
  };

  const handleTimingChange = (releaseWindow: DiscoverReleaseWindow) => {
    triggerHaptic('selection');
    setMultiFilter((prev) => ({ ...prev, releaseWindow }));
  };

  const handleSelectQuickProvider = (providerId: number | 'all' | 'subscribed') => {
    triggerHaptic('selection');
    if (providerId === 'all') {
      setMultiFilter((prev) => ({ ...prev, providerScope: 'none', selectedProviders: [] }));
    } else if (providerId === 'subscribed') {
      setMultiFilter((prev) => ({ ...prev, providerScope: 'subscribed', selectedProviders: [] }));
    } else {
      setMultiFilter((prev) => {
        const exists = prev.selectedProviders.includes(providerId);
        return {
          ...prev,
          providerScope: 'region',
          selectedProviders: exists
            ? prev.selectedProviders.filter((id) => id !== providerId)
            : [...prev.selectedProviders, providerId],
        };
      });
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const handleOpenTrackModal = (item: TMDBMediaItem) => {
    setActiveItem(item);
    setModalVisible(true);
  };

  const handleOpenReminderModal = (item: TMDBMediaItem) => {
    setSelectedReminderItem(item);
    setReminderModalVisible(true);
  };

  const selectedReminderExistingRecord = selectedReminderItem
    ? getTrackedStatus(
        selectedReminderItem.id,
        selectedReminderItem.media_type || 'movie'
      )
    : undefined;

  const handleSaveReminder = (item: TMDBMediaItem, config: ItemReminderConfig) => {
    const mediaType: MediaType = item.media_type || 'movie';
    const existing = getTrackedStatus(item.id, mediaType);

    if (existing) {
      updateItemReminder(item.id, mediaType, config);
    } else {
      const title = item.title || item.name || 'Untitled';
      const releaseDate = item.release_date || item.first_air_date;
      const newRecord: TrackedItem = {
        id: item.id,
        mediaType,
        title,
        posterPath: item.poster_path,
        releaseYear: releaseDate ? releaseDate.substring(0, 4) : undefined,
        releaseDate,
        voteAverage: item.vote_average,
        overview: item.overview,
        status: 'plan_to_watch',
        userScore: 0,
        rewatchCount: 0,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminder: config,
      };
      saveItem(newRecord);
    }
    setReminderModalVisible(false);
    setSelectedReminderItem(null);
  };

  const handleRemoveReminder = (item: TMDBMediaItem) => {
    const mediaType: MediaType = item.media_type || 'movie';
    updateItemReminder(item.id, mediaType, undefined);
    setReminderModalVisible(false);
    setSelectedReminderItem(null);
  };

  const activeExistingRecord = activeItem
    ? getTrackedStatus(
        activeItem.id,
        'status' in activeItem
          ? (activeItem as TrackedItem).mediaType
          : ((activeItem as TMDBMediaItem).media_type || 'movie')
      )
    : undefined;

  const getReleaseWindowLabel = (w: string) => {
    switch (w) {
      case 'upcoming_30':
        return 'Next 30 Days';
      case 'upcoming_60':
        return 'Next 60 Days';
      case 'upcoming_90':
        return 'Next 90 Days';
      case 'digital_premieres':
        return 'Streaming Premieres';
      case 'in_theaters':
        return 'In Theaters';
      default:
        return 'All Releases';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View
        style={[
          styles.searchSection,
          { backgroundColor: colors.background, borderBottomColor: colors.cardBorder },
        ]}>
        {/* Search Row */}
        <View style={styles.topSearchRow}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}>
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
              <Pressable onPress={handleClearSearch} style={styles.clearBtn} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Filter Modal Trigger Button */}
          <Pressable
            style={[
              styles.filterTriggerBtn,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              activeFilterCount > 0 && {
                backgroundColor: colors.primaryBg,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setFilterModalVisible(true);
            }}>
            <Ionicons
              name={activeFilterCount > 0 ? 'filter' : 'filter-outline'}
              size={18}
              color={activeFilterCount > 0 ? colors.primary : colors.textSecondary}
            />
            {activeFilterCount > 0 && (
              <View style={[styles.filterTriggerBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.filterTriggerBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Discover Feed Tabs: Upcoming Drops vs Trending Now */}
        <View style={styles.feedTabsRow}>
          <Pressable
            style={[
              styles.feedTabBtn,
              { borderColor: colors.cardBorder },
              feedTab === 'upcoming' && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setFeedTab('upcoming');
            }}>
            <Ionicons
              name="calendar"
              size={14 * textScale}
              color={feedTab === 'upcoming' ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.feedTabText,
                { color: feedTab === 'upcoming' ? '#ffffff' : colors.textSecondary, fontSize: 12.5 * textScale },
                feedTab === 'upcoming' && styles.feedTabTextActive,
              ]}>
              Upcoming Drops
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.feedTabBtn,
              { borderColor: colors.cardBorder },
              feedTab === 'trending' && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setFeedTab('trending');
            }}>
            <Ionicons
              name="flame"
              size={14 * textScale}
              color={feedTab === 'trending' ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.feedTabText,
                { color: feedTab === 'trending' ? '#ffffff' : colors.textSecondary, fontSize: 12.5 * textScale },
                feedTab === 'trending' && styles.feedTabTextActive,
              ]}>
              Trending Now
            </Text>
          </Pressable>
        </View>

        {/* Media Format Selector: All / Movies / TV */}
        <View style={styles.formatRow}>
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'movie', label: 'Movies' },
              { id: 'tv', label: 'TV Shows' },
            ] as const
          ).map((filter) => {
            const isSelected = multiFilter.mediaType === filter.id;
            return (
              <Pressable
                key={filter.id}
                style={[
                  styles.formatPill,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                ]}
                onPress={() => handleFormatChange(filter.id)}>
                <Text
                  style={[
                    styles.formatPillText,
                    { color: isSelected ? colors.primary : colors.textSecondary, fontSize: 12 * textScale },
                    isSelected && { fontWeight: '700' },
                  ]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Upcoming Drops Timing Sub-Bar (only in Upcoming feed) */}
        {feedTab === 'upcoming' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timingScroll}>
            {TIMING_PRESETS.map((t) => {
              const isSelected = multiFilter.releaseWindow === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.timingPill,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                  ]}
                  onPress={() => handleTimingChange(t.id)}>
                  <Ionicons
                    name={t.icon}
                    size={12 * textScale}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.timingPillText,
                      { color: isSelected ? colors.primary : colors.text, fontSize: 11.5 * textScale },
                      isSelected && { fontWeight: '700' },
                    ]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Streaming Providers Quick Bar */}
        {feedTab === 'upcoming' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.providersQuickScroll}>
            {/* All Providers option */}
            <Pressable
              style={[
                styles.quickProviderPill,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                multiFilter.providerScope === 'none' && {
                  backgroundColor: colors.primaryBg,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => handleSelectQuickProvider('all')}>
              <Text
                style={[
                  styles.quickProviderText,
                  {
                    color: multiFilter.providerScope === 'none' ? colors.primary : colors.text,
                    fontSize: 11 * textScale,
                  },
                  multiFilter.providerScope === 'none' && { fontWeight: '700' },
                ]}>
                All Providers
              </Text>
            </Pressable>

            {/* My Subscriptions option */}
            {mySubscribedProviders.length > 0 && (
              <Pressable
                style={[
                  styles.quickProviderPill,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  multiFilter.providerScope === 'subscribed' && {
                    backgroundColor: colors.primaryBg,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => handleSelectQuickProvider('subscribed')}>
                <Ionicons
                  name="checkmark-circle"
                  size={12 * textScale}
                  color={multiFilter.providerScope === 'subscribed' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.quickProviderText,
                    {
                      color: multiFilter.providerScope === 'subscribed' ? colors.primary : colors.text,
                      fontSize: 11 * textScale,
                    },
                    multiFilter.providerScope === 'subscribed' && { fontWeight: '700' },
                  ]}>
                  My Subscriptions
                </Text>
              </Pressable>
            )}

            {/* Popular Providers with logos */}
            {POPULAR_STREAMING_PROVIDERS.map((p: PopularProviderOption) => {
              const isSelected =
                multiFilter.providerScope !== 'none' &&
                multiFilter.providerScope !== 'subscribed' &&
                multiFilter.selectedProviders.includes(p.id);
              const logoUrl = TMDBService.getImageUrl(p.logoPath, 'w92');

              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.quickProviderPill,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    isSelected && {
                      backgroundColor: colors.primaryBg,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => handleSelectQuickProvider(p.id)}>
                  {logoUrl && (
                    <Image source={{ uri: logoUrl }} style={styles.quickProviderLogo} contentFit="cover" />
                  )}
                  <Text
                    style={[
                      styles.quickProviderText,
                      { color: isSelected ? colors.primary : colors.text, fontSize: 11 * textScale },
                      isSelected && { fontWeight: '700' },
                    ]}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Active Custom Filter Chips Bar */}
        {activeFilterCount > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeChipsScroll}>
            {multiFilter.releaseWindow !== 'upcoming_30' && (
              <Pressable
                style={[styles.activeFilterChip, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
                onPress={() => setMultiFilter((p) => ({ ...p, releaseWindow: 'upcoming_30' }))}>
                <Ionicons name="calendar-outline" size={11} color={colors.primary} />
                <Text style={[styles.activeFilterChipText, { color: colors.primary, fontSize: 11 * textScale }]}>
                  {getReleaseWindowLabel(multiFilter.releaseWindow)}
                </Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </Pressable>
            )}

            {multiFilter.selectedGenres.length > 0 && (
              <Pressable
                style={[styles.activeFilterChip, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
                onPress={() => setMultiFilter((p) => ({ ...p, selectedGenres: [] }))}>
                <Ionicons name="pricetag-outline" size={11} color={colors.primary} />
                <Text style={[styles.activeFilterChipText, { color: colors.primary, fontSize: 11 * textScale }]}>
                  {multiFilter.selectedGenres.length} Genres
                </Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </Pressable>
            )}

            {multiFilter.minRating > 0 && (
              <Pressable
                style={[styles.activeFilterChip, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
                onPress={() => setMultiFilter((p) => ({ ...p, minRating: 0 }))}>
                <Ionicons name="star" size={11} color="#fbbf24" />
                <Text style={[styles.activeFilterChipText, { color: colors.primary, fontSize: 11 * textScale }]}>
                  {multiFilter.minRating.toFixed(1)}+
                </Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </Pressable>
            )}

            {multiFilter.selectedCompanies.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.activeFilterChip, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
                onPress={() =>
                  setMultiFilter((p) => ({
                    ...p,
                    selectedCompanies: p.selectedCompanies.filter((item) => item.id !== c.id),
                  }))
                }>
                <Ionicons name="business-outline" size={11} color={colors.primary} />
                <Text style={[styles.activeFilterChipText, { color: colors.primary, fontSize: 11 * textScale }]}>
                  {c.name}
                </Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </Pressable>
            ))}

            {multiFilter.selectedPeople.map((peep) => (
              <Pressable
                key={peep.id}
                style={[styles.activeFilterChip, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
                onPress={() =>
                  setMultiFilter((p) => ({
                    ...p,
                    selectedPeople: p.selectedPeople.filter((item) => item.id !== peep.id),
                  }))
                }>
                <Ionicons name="person-outline" size={11} color={colors.primary} />
                <Text style={[styles.activeFilterChipText, { color: colors.primary, fontSize: 11 * textScale }]}>
                  {peep.name}
                </Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </Pressable>
            ))}

            <Pressable
              style={[styles.resetAllChip, { borderColor: colors.cardBorder }]}
              onPress={() => setMultiFilter(DEFAULT_MULTI_DISCOVER_FILTER)}>
              <Text style={[styles.resetAllChipText, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                Clear All
              </Text>
            </Pressable>
          </ScrollView>
        )}

        {/* Entity Filter Banner from external sheets */}
        {activeDiscoverFilter && (
          <View style={styles.activeFilterBanner}>
            <View style={styles.activeFilterBadge}>
              <Ionicons
                name={
                  activeDiscoverFilter.type === 'person'
                    ? 'person'
                    : activeDiscoverFilter.type === 'genre'
                    ? 'pricetag'
                    : activeDiscoverFilter.type === 'provider'
                    ? 'tv'
                    : 'business'
                }
                size={13 * textScale}
                color="#38bdf8"
              />
              <Text style={[styles.activeFilterText, { fontSize: 12 * textScale }]}>
                {activeDiscoverFilter.type === 'person'
                  ? 'Person:'
                  : activeDiscoverFilter.type === 'genre'
                  ? 'Genre:'
                  : activeDiscoverFilter.type === 'provider'
                  ? 'Streaming on:'
                  : 'Studio:'}{' '}
                <Text style={styles.activeFilterName}>{activeDiscoverFilter.name}</Text>
              </Text>
            </View>

            <Pressable style={styles.clearFilterBtn} onPress={() => setActiveDiscoverFilter(null)}>
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
              To search and discover streaming drops, enter your free TMDB API key in Settings.
            </Text>
          </View>
          <Pressable style={styles.settingsNavBtn} onPress={() => router.push('/settings')}>
            <Text style={styles.settingsNavBtnText}>Setup</Text>
            <Ionicons name="chevron-forward" size={14} color="#ffffff" />
          </Pressable>
        </View>
      )}

      {/* Media Results List */}
      {isLoading && !isRefreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {feedTab === 'upcoming' ? 'Finding upcoming releases...' : 'Fetching trending media...'}
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Unable to load titles</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{errorMessage}</Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={handleRefresh}>
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
                onSetReminder={() => handleOpenReminderModal(item)}
                style={numColumns > 1 ? styles.gridCard : undefined}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            apiKey && items.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={[styles.listHeaderTitle, { color: colors.text, fontSize: 13 * headerScale }]}>
                  {activeDiscoverFilter
                    ? `Filtered by ${activeDiscoverFilter.name} (${items.length})`
                    : searchQuery.trim()
                    ? `Results for "${searchQuery}" (${items.length})`
                    : feedTab === 'upcoming'
                    ? `Upcoming Releases: ${getReleaseWindowLabel(multiFilter.releaseWindow)} (${items.length})`
                    : `Trending Today (${items.length})`}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.footerLoaderText, { color: colors.textMuted, fontSize: 12 * textScale }]}>
                  Loading more titles...
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            apiKey ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No titles found</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  {hasActiveCustomFilters
                    ? 'Try selecting a different release window or resetting your filters'
                    : searchQuery.trim()
                    ? 'Try searching with a different keyword or media format'
                    : 'Pull down to refresh'}
                </Text>
                {hasActiveCustomFilters && (
                  <Pressable
                    style={[styles.emptyResetBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setMultiFilter(DEFAULT_MULTI_DISCOVER_FILTER);
                      setFeedTab('upcoming');
                    }}>
                    <Text style={styles.emptyResetBtnText}>Reset Filters</Text>
                  </Pressable>
                )}
              </View>
            ) : null
          }
        />
      )}

      {/* Multi-Attribute Discover Filter Modal */}
      <DiscoverFilterModal
        visible={filterModalVisible}
        filter={multiFilter}
        onClose={() => setFilterModalVisible(false)}
        onApply={(updated) => setMultiFilter(updated)}
        onReset={() => setMultiFilter(DEFAULT_MULTI_DISCOVER_FILTER)}
      />

      {/* Quick Release Reminder Modal */}
      {reminderModalVisible && selectedReminderItem && (
        <ReleaseReminderModal
          visible={reminderModalVisible}
          item={selectedReminderItem}
          existingRecord={selectedReminderExistingRecord}
          targetDate={selectedReminderItem.release_date || selectedReminderItem.first_air_date}
          onClose={() => {
            setReminderModalVisible(false);
            setSelectedReminderItem(null);
          }}
          onSaveReminder={(config) => handleSaveReminder(selectedReminderItem, config)}
          onRemoveReminder={() => handleRemoveReminder(selectedReminderItem)}
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
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  topSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  filterTriggerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTriggerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTriggerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  feedTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  feedTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  feedTabText: {
    fontWeight: '600',
  },
  feedTabTextActive: {
    fontWeight: '800',
  },
  formatRow: {
    flexDirection: 'row',
    gap: 6,
  },
  formatPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  formatPillText: {
    fontWeight: '600',
  },
  timingScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  timingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  timingPillText: {
    fontWeight: '600',
  },
  providersQuickScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  quickProviderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickProviderLogo: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  quickProviderText: {
    fontWeight: '600',
  },
  activeChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
  },
  activeFilterChipText: {
    fontWeight: '700',
  },
  resetAllChip: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
  },
  resetAllChipText: {
    fontWeight: '700',
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  activeFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  activeFilterText: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  activeFilterName: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 8,
  },
  clearFilterBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  listHeader: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listHeaderTitle: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  columnWrapper: {
    gap: 12,
    justifyContent: 'space-between',
  },
  gridCard: {
    flex: 1,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  footerLoaderText: {
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyResetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 8,
  },
  emptyResetBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  noApiKeyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    gap: 12,
  },
  noApiKeyContent: {
    flex: 1,
  },
  noApiKeyTitle: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  noApiKeySub: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  settingsNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  settingsNavBtnText: {
    color: '#0d0f15',
    fontSize: 12,
    fontWeight: '700',
  },
});
