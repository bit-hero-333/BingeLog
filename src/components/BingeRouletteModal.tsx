import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { TrackedItem, WatchProvider, POPULAR_STREAMING_PROVIDERS } from '@/types/media';
import { getTextScale, getHeaderScale, getButtonScale } from '@/utils/sizing';
import { TMDBService } from '@/services/tmdb';
import { getItemGenres } from '@/services/insightsEngine';

export type RouletteFormatFilter = 'all' | 'movie' | 'tv';
export type RouletteRuntimeFilter = 'any' | 'under_90' | 'under_120' | 'over_120';
export type RouletteStreamFilter = 'all' | 'subscribed' | number;

interface BingeRouletteModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectItem?: (item: TrackedItem) => void;
  initialFormat?: RouletteFormatFilter;
}

export function BingeRouletteModal({
  visible,
  onClose,
  onSelectItem,
  initialFormat = 'all',
}: BingeRouletteModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <BingeRouletteModalContent
        onClose={onClose}
        onSelectItem={onSelectItem}
        initialFormat={initialFormat}
      />
    </Modal>
  );
}

function BingeRouletteModalContent({
  onClose,
  onSelectItem,
  initialFormat,
}: {
  onClose: () => void;
  onSelectItem?: (item: TrackedItem) => void;
  initialFormat: RouletteFormatFilter;
}) {
  const { colors } = useAppTheme();
  const {
    trackedItems,
    saveItem,
    triggerHaptic,
    sizingConfig,
    mySubscribedProviders,
    selectedRegion,
    streamingRegionStrategy,
    customStreamingRegion,
  } = useMedia();
  const { height } = useWindowDimensions();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);
  const buttonScale = getButtonScale(sizingConfig?.buttonSize);
  const sheetHeight = Math.round(height * 0.90);
  const primaryColor: string = typeof colors.primary === 'string' ? colors.primary : '#3b82f6';

  // Filters
  const [formatFilter, setFormatFilter] = useState<RouletteFormatFilter>(initialFormat);
  const [runtimeFilter, setRuntimeFilter] = useState<RouletteRuntimeFilter>('any');
  const [streamFilter, setStreamFilter] = useState<RouletteStreamFilter>('all');
  const [includeOnHold, setIncludeOnHold] = useState(false);

  // Roll state
  const [isRolling, setIsRolling] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TrackedItem | null>(null);
  const [rollingCandidate, setRollingCandidate] = useState<TrackedItem | null>(null);
  const [rollHistory, setRollHistory] = useState<number[]>([]);
  const [statusUpdatedSuccess, setStatusUpdatedSuccess] = useState(false);

  // Animation values
  const [pulseAnim] = useState(() => new Animated.Value(1));

  // Active region for streaming
  const effectiveRegion = (streamingRegionStrategy === 'custom' ? customStreamingRegion : selectedRegion || 'US').toUpperCase();

  // Helper to extract streaming providers for an item
  const getItemStreamProviders = useCallback((item: TrackedItem): WatchProvider[] => {
    if (!item.watchProviders) return [];
    const reg =
      item.watchProviders[effectiveRegion] ||
      item.watchProviders[selectedRegion] ||
      item.watchProviders['US'];
    if (!reg) return [];
    const combined = [...(reg.flatrate || []), ...(reg.free || [])];
    const seen = new Set<number>();
    const unique: WatchProvider[] = [];
    for (const p of combined) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        unique.push(p);
      }
    }
    return unique;
  }, [effectiveRegion, selectedRegion]);

  // Helper to check if item is available on user's subscribed services
  const itemIsOnSubscribed = useCallback((item: TrackedItem): boolean => {
    if (mySubscribedProviders.length === 0) return true;
    const providers = getItemStreamProviders(item);
    return providers.some((p) => mySubscribedProviders.includes(p.id));
  }, [mySubscribedProviders, getItemStreamProviders]);

  // Total plan to watch items in entire library
  const totalPlanToWatchCount = useMemo(() => {
    return trackedItems.filter((i) => i.status === 'plan_to_watch').length;
  }, [trackedItems]);

  // Candidates matching active quick filters
  const candidateItems = useMemo(() => {
    return trackedItems.filter((item) => {
      // 1. Status Filter
      if (includeOnHold) {
        if (item.status !== 'plan_to_watch' && item.status !== 'on_hold') return false;
      } else {
        if (item.status !== 'plan_to_watch') return false;
      }

      // 2. Format Filter
      if (formatFilter === 'movie' && item.mediaType !== 'movie') return false;
      if (formatFilter === 'tv' && item.mediaType !== 'tv') return false;

      // 3. Runtime Filter
      if (runtimeFilter !== 'any') {
        const rt = item.runtimeMinutes && item.runtimeMinutes > 0
          ? item.runtimeMinutes
          : item.mediaType === 'movie' ? 105 : 42;

        if (runtimeFilter === 'under_90') {
          if (item.mediaType === 'movie' && rt > 90) return false;
          if (item.mediaType === 'tv' && rt > 35 && (item.totalEpisodes || 12) > 8) return false;
        } else if (runtimeFilter === 'under_120') {
          if (item.mediaType === 'movie' && rt > 120) return false;
          if (item.mediaType === 'tv' && rt > 60) return false;
        } else if (runtimeFilter === 'over_120') {
          if (item.mediaType === 'movie' && rt <= 120) return false;
          if (item.mediaType === 'tv' && (item.totalEpisodes || 12) < 12 && rt <= 50) return false;
        }
      }

      // 4. Streaming Service Filter
      if (streamFilter === 'subscribed') {
        if (!itemIsOnSubscribed(item)) return false;
      } else if (typeof streamFilter === 'number') {
        const providers = getItemStreamProviders(item);
        if (!providers.some((p) => p.id === streamFilter)) return false;
      }

      return true;
    });
  }, [trackedItems, includeOnHold, formatFilter, runtimeFilter, streamFilter, itemIsOnSubscribed, getItemStreamProviders]);

  // Handle dice roll action
  const handleRoll = () => {
    if (candidateItems.length === 0 || isRolling) return;

    triggerHaptic('selection');
    setIsRolling(true);
    setStatusUpdatedSuccess(false);

    // Filter candidates not yet seen in current session
    let unseen = candidateItems.filter((i) => !rollHistory.includes(i.id));
    if (unseen.length === 0) {
      unseen = candidateItems;
      setRollHistory([]);
    }

    // Pick a winner randomly from unseen
    const winner = unseen[Math.floor(Math.random() * unseen.length)];

    // Animate cycling through items for 600ms
    let iterations = 0;
    const maxIterations = 8;
    const interval = setInterval(() => {
      iterations++;
      const randomIdx = Math.floor(Math.random() * candidateItems.length);
      setRollingCandidate(candidateItems[randomIdx]);
      triggerHaptic('selection');

      if (iterations >= maxIterations) {
        clearInterval(interval);
        setSelectedItem(winner);
        setRollingCandidate(null);
        setRollHistory((prev) => [...prev, winner.id]);
        setIsRolling(false);
        triggerHaptic('success');

        // Play reveal pulse animation
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 120, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
      }
    }, 70);
  };

  // Active displayed item (during roll animation or settled)
  const settledItem = useMemo(() => {
    if (selectedItem && candidateItems.some((i) => i.id === selectedItem.id && i.mediaType === selectedItem.mediaType)) {
      return selectedItem;
    }
    return candidateItems[0] || null;
  }, [selectedItem, candidateItems]);

  const displayItem = isRolling ? rollingCandidate || settledItem : settledItem;

  // Handle "Start Watching" action
  const handleStartWatching = async () => {
    if (!displayItem) return;
    triggerHaptic('success');
    const updated: TrackedItem = {
      ...displayItem,
      status: 'watching',
      startedAt: displayItem.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveItem(updated);
    setSelectedItem(updated);
    setStatusUpdatedSuccess(true);
  };

  // Handle "View Details" action
  const handleViewDetails = () => {
    if (!displayItem) return;
    triggerHaptic('selection');
    onClose();
    if (onSelectItem) {
      onSelectItem(displayItem);
    }
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    triggerHaptic('selection');
    setFormatFilter('all');
    setRuntimeFilter('any');
    setStreamFilter('all');
    setIncludeOnHold(false);
  };

  // Stream providers for the active display item
  const displayProviders = displayItem ? getItemStreamProviders(displayItem) : [];
  const displayGenres = displayItem ? getItemGenres(displayItem) : [];

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            height: sheetHeight,
            borderColor: colors.cardBorder,
          },
        ]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconBadge, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="dice-outline" size={22 * headerScale} color={colors.primary} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={[styles.title, { color: colors.text, fontSize: 16 * headerScale }]}>
                What Should I Watch Next?
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                Binge Roulette • Pick from your watchlist
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Scrollable Body */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}>
          {/* Quick Filters Card */}
          <View style={[styles.filtersCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* Filter Section 1: Format */}
            <View style={styles.filterRowGroup}>
              <Text style={[styles.filterGroupTitle, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                FORMAT
              </Text>
              <View style={styles.chipsRow}>
                {(
                  [
                    { id: 'all', label: 'All Formats', icon: 'layers-outline' },
                    { id: 'movie', label: 'Movies', icon: 'film-outline' },
                    { id: 'tv', label: 'TV Shows', icon: 'tv-outline' },
                  ] as const
                ).map((f) => {
                  const isSelected = formatFilter === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      style={[
                        styles.filterChip,
                        { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                        isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                      ]}
                      onPress={() => {
                        triggerHaptic('selection');
                        setFormatFilter(f.id);
                      }}>
                      <Ionicons
                        name={f.icon}
                        size={12 * textScale}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: isSelected ? colors.primary : colors.text, fontSize: 11.5 * textScale },
                          isSelected && styles.filterChipTextBold,
                        ]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Filter Section 2: Desired Runtime */}
            <View style={styles.filterRowGroup}>
              <Text style={[styles.filterGroupTitle, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                DESIRED RUNTIME
              </Text>
              <View style={styles.chipsRow}>
                {(
                  [
                    { id: 'any', label: 'Any Length' },
                    { id: 'under_90', label: '< 90 mins' },
                    { id: 'under_120', label: '< 2 hours' },
                    { id: 'over_120', label: '2h+ Epic' },
                  ] as const
                ).map((r) => {
                  const isSelected = runtimeFilter === r.id;
                  return (
                    <Pressable
                      key={r.id}
                      style={[
                        styles.filterChip,
                        { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                        isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                      ]}
                      onPress={() => {
                        triggerHaptic('selection');
                        setRuntimeFilter(r.id);
                      }}>
                      <Ionicons
                        name="time-outline"
                        size={12 * textScale}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: isSelected ? colors.primary : colors.text, fontSize: 11.5 * textScale },
                          isSelected && styles.filterChipTextBold,
                        ]}>
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Filter Section 3: Streaming Service Availability */}
            <View style={styles.filterRowGroup}>
              <Text style={[styles.filterGroupTitle, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                STREAMING SERVICE
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.streamChipsScroll}>
                {/* All sources */}
                <Pressable
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                    streamFilter === 'all' && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setStreamFilter('all');
                  }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: streamFilter === 'all' ? colors.primary : colors.text, fontSize: 11.5 * textScale },
                      streamFilter === 'all' && styles.filterChipTextBold,
                    ]}>
                    All Sources
                  </Text>
                </Pressable>

                {/* Subscribed Services */}
                <Pressable
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                    streamFilter === 'subscribed' && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setStreamFilter('subscribed');
                  }}>
                  <Ionicons
                    name="wallet-outline"
                    size={12 * textScale}
                    color={streamFilter === 'subscribed' ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: streamFilter === 'subscribed' ? colors.primary : colors.text, fontSize: 11.5 * textScale },
                      streamFilter === 'subscribed' && styles.filterChipTextBold,
                    ]}>
                    My Subscriptions ({mySubscribedProviders.length})
                  </Text>
                </Pressable>

                {/* Popular Individual Streaming Providers */}
                {POPULAR_STREAMING_PROVIDERS.map((prov) => {
                  const isSelected = streamFilter === prov.id;
                  const isUserSubscribed = mySubscribedProviders.includes(prov.id);
                  const logoUrl = prov.logoPath ? TMDBService.getImageUrl(prov.logoPath, 'w92') : null;

                  return (
                    <Pressable
                      key={prov.id}
                      style={[
                        styles.filterChip,
                        { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                        isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                      ]}
                      onPress={() => {
                        triggerHaptic('selection');
                        setStreamFilter(isSelected ? 'all' : prov.id);
                      }}>
                      {logoUrl ? (
                        <Image source={{ uri: logoUrl }} style={styles.providerMiniLogo} contentFit="cover" />
                      ) : null}
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: isSelected ? colors.primary : colors.text, fontSize: 11.5 * textScale },
                          isSelected && styles.filterChipTextBold,
                        ]}>
                        {prov.name}
                      </Text>
                      {isUserSubscribed && (
                        <View style={[styles.subIndicator, { backgroundColor: colors.primary }]} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Candidate Matching Pill & Reset */}
            <View style={styles.poolInfoRow}>
              <View style={[styles.poolBadge, { backgroundColor: colors.primaryBg }]}>
                <Ionicons name="dice-outline" size={13} color={colors.primary} />
                <Text style={[styles.poolBadgeText, { color: colors.primary, fontSize: 11.5 * textScale }]}>
                  {candidateItems.length} {candidateItems.length === 1 ? 'title' : 'titles'} in candidate pool
                </Text>
              </View>

              {(formatFilter !== 'all' || runtimeFilter !== 'any' || streamFilter !== 'all') && (
                <Pressable onPress={handleResetFilters} hitSlop={8}>
                  <Text style={[styles.resetFiltersText, { color: colors.textSecondary, fontSize: 11.5 * textScale }]}>
                    Reset Filters
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Empty State: Zero candidates */}
          {candidateItems.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={[styles.emptyIconBadge, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="search-outline" size={28} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text, fontSize: 15 * headerScale }]}>
                {totalPlanToWatchCount === 0 ? 'Your Watchlist Is Empty' : 'No Titles Match These Filters'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                {totalPlanToWatchCount === 0
                  ? 'Add titles marked as "Plan to Watch" from Discover or Search to use Binge Roulette.'
                  : `You have ${totalPlanToWatchCount} titles on your watchlist, but none match the current runtime or streaming selection.`}
              </Text>
              {totalPlanToWatchCount > 0 ? (
                <Pressable
                  style={[styles.emptyResetBtn, { backgroundColor: colors.primary }]}
                  onPress={handleResetFilters}>
                  <Ionicons name="refresh-outline" size={15} color="#ffffff" />
                  <Text style={[styles.emptyResetBtnText, { fontSize: 12.5 * textScale }]}>
                    Reset Quick Filters
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : displayItem ? (
            /* Result Card */
            <Animated.View
              style={[
                styles.resultCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  transform: [{ scale: pulseAnim }],
                },
              ]}>
              {/* Card Header Tag */}
              <View style={styles.cardHeaderTagRow}>
                <View style={[styles.roulettePickPill, { backgroundColor: colors.primaryBg }]}>
                  <Ionicons name="sparkles" size={12} color={colors.primary} />
                  <Text style={[styles.roulettePickText, { color: colors.primary, fontSize: 11 * textScale }]}>
                    {isRolling ? 'ROLLING THE DICE...' : 'BINGE PICK RECOMMENDATION'}
                  </Text>
                </View>

                {displayItem.voteAverage && displayItem.voteAverage > 0 ? (
                  <View style={[styles.scoreBadge, { backgroundColor: colors.inputBg }]}>
                    <Ionicons name="star" size={11} color="#f59e0b" />
                    <Text style={[styles.scoreText, { color: colors.text, fontSize: 11.5 * textScale }]}>
                      {displayItem.voteAverage.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Poster and Primary Details Row */}
              <View style={styles.mediaDetailsRow}>
                {displayItem.posterPath ? (
                  <Image
                    source={{ uri: TMDBService.getImageUrl(displayItem.posterPath, 'w185') || undefined }}
                    style={styles.poster}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.posterPlaceholder, { backgroundColor: colors.inputBg }]}>
                    <Ionicons name="film-outline" size={24} color={colors.textSecondary} />
                  </View>
                )}

                <View style={styles.detailsCol}>
                  <Text
                    style={[styles.mediaTitle, { color: colors.text, fontSize: 16 * headerScale }]}
                    numberOfLines={2}>
                    {displayItem.title}
                  </Text>

                  {/* Badges: Format & Runtime */}
                  <View style={styles.badgeChipsRow}>
                    <View style={[styles.metaBadge, { backgroundColor: colors.inputBg }]}>
                      <Ionicons
                        name={displayItem.mediaType === 'tv' ? 'tv-outline' : 'film-outline'}
                        size={11}
                        color={colors.textSecondary}
                      />
                      <Text style={[styles.metaBadgeText, { color: colors.text, fontSize: 10.5 * textScale }]}>
                        {displayItem.mediaType === 'tv' ? 'TV Series' : 'Movie'}
                      </Text>
                    </View>

                    {displayItem.releaseYear ? (
                      <View style={[styles.metaBadge, { backgroundColor: colors.inputBg }]}>
                        <Text style={[styles.metaBadgeText, { color: colors.textSecondary, fontSize: 10.5 * textScale }]}>
                          {displayItem.releaseYear}
                        </Text>
                      </View>
                    ) : null}

                    {displayItem.runtimeMinutes && displayItem.runtimeMinutes > 0 ? (
                      <View style={[styles.metaBadge, { backgroundColor: colors.inputBg }]}>
                        <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
                        <Text style={[styles.metaBadgeText, { color: colors.text, fontSize: 10.5 * textScale }]}>
                          {displayItem.mediaType === 'movie'
                            ? `${displayItem.runtimeMinutes}m`
                            : `${displayItem.runtimeMinutes}m/ep`}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Genres */}
                  {displayGenres.length > 0 && (
                    <View style={styles.genreTagsRow}>
                      {displayGenres.slice(0, 3).map((genre, idx) => (
                        <View key={idx} style={[styles.genrePill, { backgroundColor: colors.cardSelected }]}>
                          <Text style={[styles.genrePillText, { color: colors.textSecondary, fontSize: 10 * textScale }]}>
                            {genre}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Streaming availability */}
                  {displayProviders.length > 0 && (
                    <View style={styles.providersInlineRow}>
                      <Text style={[styles.providersInlineLabel, { color: colors.textMuted, fontSize: 10 * textScale }]}>
                        Stream on:
                      </Text>
                      {displayProviders.slice(0, 4).map((p) => {
                        const logoUrl = p.logoPath ? TMDBService.getImageUrl(p.logoPath, 'w92') : null;
                        const isSub = mySubscribedProviders.includes(p.id);
                        return (
                          <View
                            key={p.id}
                            style={[
                              styles.providerInlineLogoBadge,
                              isSub && { borderColor: colors.primary, borderWidth: 1.5 },
                            ]}>
                            {logoUrl ? (
                              <Image source={{ uri: logoUrl }} style={styles.providerInlineLogo} contentFit="cover" />
                            ) : (
                              <Text style={[styles.providerInlineName, { color: colors.text, fontSize: 9 }]}>
                                {p.name.substring(0, 2)}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>

              {/* Tagline / Overview */}
              {(displayItem.tagline || displayItem.overview) && (
                <View style={[styles.overviewCard, { backgroundColor: colors.inputBg }]}>
                  {displayItem.tagline ? (
                    <Text
                      style={[styles.taglineText, { color: colors.primary, fontSize: 11.5 * textScale }]}
                      numberOfLines={1}>
                      &ldquo;{displayItem.tagline}&rdquo;
                    </Text>
                  ) : null}
                  {displayItem.overview ? (
                    <Text
                      style={[styles.overviewText, { color: colors.textSecondary, fontSize: 11.5 * textScale }]}
                      numberOfLines={3}>
                      {displayItem.overview}
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Success Banner if status changed to Watching */}
              {statusUpdatedSuccess && (
                <View style={[styles.successBanner, { backgroundColor: `${primaryColor}1A`, borderColor: colors.primary }]}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
                  <Text style={[styles.successBannerText, { color: colors.primary, fontSize: 11.5 * textScale }]}>
                    Added to currently Watching!
                  </Text>
                </View>
              )}

              {/* Primary Action Buttons */}
              <View style={styles.actionsRow}>
                {displayItem.status === 'watching' ? (
                  <View style={[styles.actionBtnPrimary, { backgroundColor: colors.cardSelected, borderColor: colors.cardBorder, borderWidth: 1 }]}>
                    <Ionicons name="checkmark-done" size={16 * textScale} color={colors.primary} />
                    <Text style={[styles.actionBtnPrimaryText, { color: colors.primary, fontSize: 12.5 * textScale }]}>
                      Already Watching
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.actionBtnPrimary, { backgroundColor: colors.primary }]}
                    onPress={handleStartWatching}
                    disabled={isRolling}>
                    <Ionicons name="play" size={15 * textScale} color="#ffffff" />
                    <Text style={[styles.actionBtnPrimaryText, { color: '#ffffff', fontSize: 12.5 * textScale }]}>
                      Start Watching
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={[styles.actionBtnSecondary, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
                  onPress={handleViewDetails}
                  disabled={isRolling}>
                  <Ionicons name="information-circle-outline" size={16 * textScale} color={colors.text} />
                  <Text style={[styles.actionBtnSecondaryText, { color: colors.text, fontSize: 12 * textScale }]}>
                    Details
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {/* Roll The Dice CTA Button */}
          {candidateItems.length > 0 && (
            <Pressable
              style={[
                styles.rollButton,
                {
                  backgroundColor: colors.primary,
                  minHeight: Math.max(48, Math.round(50 * buttonScale)),
                },
                isRolling && { opacity: 0.8 },
              ]}
              onPress={handleRoll}
              disabled={isRolling}>
              <Ionicons
                name={isRolling ? 'refresh-outline' : 'dice'}
                size={22 * headerScale}
                color="#ffffff"
              />
              <Text style={[styles.rollButtonText, { fontSize: 15 * headerScale }]}>
                {isRolling
                  ? 'Rolling The Dice...'
                  : selectedItem
                  ? 'Roll Again'
                  : 'Roll The Dice'}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  filtersCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  filterRowGroup: {
    gap: 6,
  },
  filterGroupTitle: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  streamChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontWeight: '500',
  },
  filterChipTextBold: {
    fontWeight: '700',
  },
  providerMiniLogo: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  subIndicator: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  poolInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  poolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  poolBadgeText: {
    fontWeight: '700',
  },
  resetFiltersText: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  emptyResetBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  cardHeaderTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roulettePickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roulettePickText: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scoreText: {
    fontWeight: '800',
  },
  mediaDetailsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  poster: {
    width: 80,
    height: 120,
    borderRadius: 10,
  },
  posterPlaceholder: {
    width: 80,
    height: 120,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCol: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  mediaTitle: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  badgeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaBadgeText: {
    fontWeight: '600',
  },
  genreTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  genrePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  genrePillText: {
    fontWeight: '500',
  },
  providersInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  providersInlineLabel: {
    fontWeight: '600',
  },
  providerInlineLogoBadge: {
    width: 22,
    height: 22,
    borderRadius: 5,
    overflow: 'hidden',
  },
  providerInlineLogo: {
    width: '100%',
    height: '100%',
  },
  providerInlineName: {
    fontWeight: '700',
    textAlign: 'center',
  },
  overviewCard: {
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  taglineText: {
    fontWeight: '700',
    fontStyle: 'italic',
  },
  overviewText: {
    lineHeight: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  successBannerText: {
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnPrimaryText: {
    fontWeight: '700',
  },
  actionBtnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnSecondaryText: {
    fontWeight: '600',
  },
  rollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  rollButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
