import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import {
  AchievementsEngine,
} from '@/services/achievementsEngine';
import {
  AchievementCategory,
  AchievementProgress,
  AchievementStatsSummary,
  TIER_CONFIG,
  TIER_ORDER,
} from '@/types/achievements';
import { AchievementDetailModal } from '@/components/AchievementDetailModal';
import { TrackModal } from '@/components/TrackModal';
import { TrackedItem } from '@/types/media';
import { getTextScale, getHeaderScale } from '@/utils/sizing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORY_TABS: { id: AchievementCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'binge_time', label: 'Binge & Time' },
  { id: 'habits', label: 'Habits' },
  { id: 'ratings', label: 'Critic' },
  { id: 'genres', label: 'Genres' },
  { id: 'eras_cinema', label: 'Cinema Eras' },
  { id: 'curation', label: 'Curation' },
];

export default function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { trackedItems, triggerHaptic, sizingConfig, saveItem, removeItem } = useMedia();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);

  const [activeCategory, setActiveCategory] = useState<AchievementCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [progressList, setProgressList] = useState<AchievementProgress[]>([]);
  const [statsSummary, setStatsSummary] = useState<AchievementStatsSummary | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementProgress | null>(null);

  // TrackModal integration for contributing items
  const [selectedTrackItem, setSelectedTrackItem] = useState<TrackedItem | null>(null);
  const [trackModalVisible, setTrackModalVisible] = useState(false);

  const refreshAchievements = useCallback(() => {
    void AchievementsEngine.evaluateAll(trackedItems).then((result) => {
      setProgressList(result.progressList);
      setStatsSummary(result.summary);
    });
  }, [trackedItems]);

  useEffect(() => {
    let isCurrent = true;
    void AchievementsEngine.evaluateAll(trackedItems).then((result) => {
      if (isCurrent) {
        setProgressList(result.progressList);
        setStatsSummary(result.summary);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [trackedItems]);

  // Filtered achievements by category & search
  const filteredList = useMemo(() => {
    let list = progressList;

    if (activeCategory !== 'all') {
      list = list.filter((p) => p.definition.category === activeCategory);
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.definition.name.toLowerCase().includes(q) ||
          p.definition.description.toLowerCase().includes(q)
      );
    }

    return list;
  }, [progressList, activeCategory, searchQuery]);

  const handleOpenAchievement = (item: AchievementProgress) => {
    triggerHaptic('selection');
    setSelectedAchievement(item);
  };

  const handleSelectMediaFromDetail = (mediaId: number, mediaType: 'movie' | 'tv') => {
    const found = trackedItems.find((i) => i.id === mediaId && i.mediaType === mediaType);
    if (found) {
      setSelectedTrackItem(found);
      setTrackModalVisible(true);
    }
  };

  const renderAchievementCard = ({ item }: { item: AchievementProgress }) => {
    const { definition, currentTier, currentValue, nextTier, nextTierTarget, progressPercent, isMaxed, contributingSubtext } = item;
    const isLocked = currentTier === 'locked';
    const tierConfig = TIER_CONFIG[currentTier];
    const nextConfig = nextTier ? TIER_CONFIG[nextTier] : null;
    const targetColor = nextConfig ? nextConfig.color : tierConfig.color;

    return (
      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isLocked ? colors.cardBorder : `${tierConfig.color}40`,
          },
        ]}
        onPress={() => handleOpenAchievement(item)}>
        {/* Main Card Content */}
        <View style={styles.cardHeaderRow}>
          {/* Big Metallic / Locked Icon */}
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isLocked ? 'rgba(71, 85, 105, 0.15)' : tierConfig.glow,
                borderColor: isLocked ? '#475569' : tierConfig.color,
              },
            ]}>
            <Ionicons
              name={isLocked ? 'lock-closed' : (definition.iconName as any)}
              size={30 * headerScale}
              color={isLocked ? '#64748b' : tierConfig.color}
            />
          </View>

          {/* Title, Badge & 7-Pip Gem Ladder */}
          <View style={styles.cardInfoCol}>
            <View style={styles.cardTitleRow}>
              <Text
                numberOfLines={1}
                style={[styles.cardTitle, { color: colors.text, fontSize: 15 * headerScale }]}>
                {definition.name}
              </Text>

              {/* Current Tier Chip */}
              <View
                style={[
                  styles.tierChip,
                  {
                    backgroundColor: isLocked ? 'rgba(71, 85, 105, 0.2)' : tierConfig.glow,
                    borderColor: isLocked ? '#64748b' : tierConfig.color,
                  },
                ]}>
                <Text
                  style={[
                    styles.tierChipText,
                    { color: isLocked ? '#94a3b8' : tierConfig.color, fontSize: 10 * textScale },
                  ]}>
                  {tierConfig.label}
                </Text>
              </View>
            </View>

            {/* 7-Pip Progression Ladder */}
            <View style={styles.gemLadderRow}>
              {TIER_ORDER.map((tier) => {
                const cfg = TIER_CONFIG[tier];
                const isEarned = TIER_CONFIG[currentTier].order >= cfg.order;
                return (
                  <View
                    key={tier}
                    style={[
                      styles.gemPip,
                      {
                        backgroundColor: isEarned ? cfg.color : '#334155',
                        borderColor: isEarned ? cfg.color : '#475569',
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* Description */}
            <Text
              numberOfLines={2}
              style={[styles.cardDesc, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
              {definition.description}
            </Text>
          </View>
        </View>

        {/* Dynamic Target Status Bar */}
        <View style={styles.statusBarContainer}>
          <View style={styles.statusBarMetaRow}>
            <Text style={[styles.progressCurrentText, { color: colors.text, fontSize: 11 * textScale }]}>
              {contributingSubtext || `${currentValue.toLocaleString()} / ${nextTierTarget.toLocaleString()} ${definition.metricLabel}`}
            </Text>
            <Text style={[styles.progressPercentText, { color: targetColor, fontSize: 11 * textScale }]}>
              {isMaxed ? 'Diamond Mastered' : `${Math.round(progressPercent * 100)}%`}
            </Text>
          </View>

          <View style={[styles.statusBarTrack, { backgroundColor: colors.cardBorder }]}>
            <View
              style={[
                styles.statusBarFill,
                {
                  width: `${Math.round(progressPercent * 100)}%`,
                  backgroundColor: targetColor,
                },
              ]}
            />
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
      <View
        style={[
          styles.headerBar,
          {
            borderBottomColor: colors.cardBorder,
            paddingTop: insets.top > 0 ? insets.top + 6 : 14,
          },
        ]}>
        <Pressable
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => {
            triggerHaptic('selection');
            router.back();
          }}
          hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleCenter}>
          <Text style={[styles.screenTitle, { color: colors.text, fontSize: 18 * headerScale }]}>
            Achievements
          </Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
            {statsSummary?.unlockedCount || 0} of {statsSummary?.totalAchievements || 50} Unlocked
          </Text>
        </View>

        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Overview Trophies Banner */}
      {statsSummary && (
        <View style={[styles.trophyBanner, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.trophyBannerTop}>
            <Text style={[styles.bannerScoreTitle, { color: colors.text, fontSize: 12 * textScale }]}>
              Overall Progress
            </Text>
            <Text style={[styles.bannerScoreValue, { color: '#FFD700', fontSize: 13 * textScale }]}>
              {statsSummary.completionScorePercent}% Completed
            </Text>
          </View>

          {/* 7-Tier Counts Grid */}
          <View style={styles.trophyCountersRow}>
            {TIER_ORDER.map((tier) => {
              const cfg = TIER_CONFIG[tier];
              const count = statsSummary.tierCounts[tier] || 0;
              return (
                <View key={tier} style={styles.trophyCounterCol}>
                  <Text style={[styles.trophyCountNumber, { color: cfg.color, fontSize: 14 * headerScale }]}>
                    {count}
                  </Text>
                  <Text style={[styles.trophyCountLabel, { color: colors.textSecondary, fontSize: 9.5 * textScale }]}>
                    {cfg.label.substring(0, 4)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontSize: 13 * textScale }]}
            placeholder="Search achievements..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category Filter Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}>
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isActive ? colors.primary : colors.card,
                    borderColor: isActive ? colors.primary : colors.cardBorder,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setActiveCategory(tab.id);
                }}>
                <Text
                  style={[
                    styles.tabChipText,
                    {
                      color: isActive ? '#ffffff' : colors.textSecondary,
                      fontSize: 12 * textScale,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Achievements List */}
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.definition.id}
        renderItem={renderAchievementCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="trophy-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text, fontSize: 15 * headerScale }]}>
              No Achievements Found
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
              Try adjusting your search query or category filter.
            </Text>
          </View>
        }
      />

      {/* Interactive Detail Modal */}
      <AchievementDetailModal
        visible={selectedAchievement !== null}
        achievement={selectedAchievement}
        onClose={() => setSelectedAchievement(null)}
        onSelectMedia={handleSelectMediaFromDetail}
      />

      {/* TrackModal if opened from detail */}
      {selectedTrackItem && (
        <TrackModal
          visible={trackModalVisible}
          item={selectedTrackItem}
          existingRecord={selectedTrackItem}
          onClose={() => {
            setTrackModalVisible(false);
            setSelectedTrackItem(null);
            refreshAchievements();
          }}
          onSave={(record) => {
            void saveItem(record);
            refreshAchievements();
          }}
          onRemove={(id, mediaType) => {
            void removeItem(id, mediaType);
            refreshAchievements();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleCenter: {
    alignItems: 'center',
  },
  screenTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightPlaceholder: {
    width: 36,
  },
  trophyBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  trophyBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bannerScoreTitle: {
    fontWeight: '700',
  },
  bannerScoreValue: {
    fontWeight: '800',
  },
  trophyCountersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  trophyCounterCol: {
    alignItems: 'center',
    flex: 1,
  },
  trophyCountNumber: {
    fontWeight: '800',
  },
  trophyCountLabel: {
    fontWeight: '600',
    marginTop: 1,
  },
  searchSection: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
  },
  tabsContainer: {
    marginTop: 10,
    marginBottom: 4,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabChipText: {
    letterSpacing: 0.1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1.2,
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoCol: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontWeight: '700',
    flex: 1,
  },
  tierChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tierChipText: {
    fontWeight: '700',
  },
  gemLadderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    marginBottom: 6,
  },
  gemPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  cardDesc: {
    lineHeight: 16,
  },
  statusBarContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  statusBarMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  progressCurrentText: {
    fontWeight: '600',
  },
  progressPercentText: {
    fontWeight: '700',
  },
  statusBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  statusBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: {
    fontWeight: '700',
  },
  emptySub: {
    textAlign: 'center',
  },
});
