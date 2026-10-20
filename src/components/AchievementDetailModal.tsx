import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { MetallicAchievementBadge } from '@/components/MetallicAchievementBadge';
import {
  AchievementProgress,
  TIER_CONFIG,
  TIER_ORDER,
  EarnedTier,
} from '@/types/achievements';
import { TMDBService } from '@/services/tmdb';
import { getTextScale, getHeaderScale } from '@/utils/sizing';

interface AchievementDetailModalProps {
  visible: boolean;
  achievement: AchievementProgress | null;
  onClose: () => void;
  onSelectMedia?: (mediaId: number, mediaType: 'movie' | 'tv') => void;
}

export function AchievementDetailModal({
  visible,
  achievement,
  onClose,
  onSelectMedia,
}: AchievementDetailModalProps) {
  const { colors } = useAppTheme();
  const { triggerHaptic, dateFormat, sizingConfig } = useMedia();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);


  if (!achievement) return null;

  const { definition, currentTier, currentValue, nextTier, progressPercent, unlockedAt, contributingItems, contributingSubtext } = achievement;
  const currentTierConfig = TIER_CONFIG[currentTier];
  const nextTierConfig = nextTier ? TIER_CONFIG[nextTier] : null;
  const isLocked = currentTier === 'locked';

  const formatUnlockDate = (isoStr?: string) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr.substring(0, 10);
      return d.toLocaleDateString(dateFormat === 'DD.MM.YYYY' ? 'de-DE' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoStr.substring(0, 10);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Full-screen backdrop touch dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Modal Window Container (View, not Pressable, to ensure smooth scrolling) */}
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.card, borderColor: isLocked ? colors.cardBorder : currentTierConfig.color },
          ]}>
          {/* Top Close Button */}
          <Pressable
            style={[styles.closeBtn, { backgroundColor: colors.inputBg }]}
            onPress={() => {
              triggerHaptic('selection');
              onClose();
            }}
            hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollBody}>
            {/* Main Trophy Icon Centerpiece with Breathing Glow and Metallic Coating */}
            <View style={styles.iconContainer}>
              <MetallicAchievementBadge
                tier={currentTier}
                iconName={definition.iconName}
                size={Math.round(152 * headerScale)}
                showGlow={true}
                animateGlow={visible}
                scale={headerScale}
              />
            </View>

            {/* Title & Tier Banner */}
            <View style={styles.headerInfo}>
              <Text style={[styles.achievementTitle, { color: colors.text, fontSize: 20 * headerScale }]}>
                {definition.name}
              </Text>

              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.tierBadge,
                    {
                      backgroundColor: isLocked ? 'rgba(71, 85, 105, 0.2)' : currentTierConfig.glow,
                      borderColor: isLocked ? '#64748b' : currentTierConfig.color,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.tierBadgeText,
                      { color: isLocked ? '#94a3b8' : currentTierConfig.color, fontSize: 11 * textScale },
                    ]}>
                    {isLocked ? 'Locked' : `${currentTierConfig.label} Tier`}
                  </Text>
                </View>

                <View style={[styles.categoryBadge, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.categoryBadgeText, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                    {definition.category.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={[styles.achievementDesc, { color: colors.textSecondary, fontSize: 13 * textScale }]}>
                {definition.description}
              </Text>
            </View>

            {/* Target Status Bar (Cleaned without cramped Next tag) */}
            <View style={[styles.progressSection, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <View style={styles.progressHeaderRow}>
                <Text
                  style={[styles.progressMetricText, { color: colors.text, fontSize: 12 * textScale }]}
                  numberOfLines={2}>
                  {contributingSubtext || `${currentValue.toLocaleString()} ${definition.metricLabel}`}
                </Text>
                <Text
                  style={[
                    styles.progressPercentBadge,
                    { color: nextTierConfig ? nextTierConfig.color : currentTierConfig.color, fontSize: 12 * textScale },
                  ]}>
                  {achievement.isMaxed ? 'Diamond Mastered' : `${Math.round(progressPercent * 100)}%`}
                </Text>
              </View>

              <View style={[styles.progressBarTrack, { backgroundColor: colors.cardBorder }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.round(progressPercent * 100)}%`,
                      backgroundColor: nextTierConfig ? nextTierConfig.color : currentTierConfig.color,
                    },
                  ]}
                />
              </View>
            </View>

            {/* 7-Tier Milestone Ladder */}
            <View style={styles.ladderSection}>
              <Text style={[styles.sectionHeading, { color: colors.text, fontSize: 14 * headerScale }]}>
                Milestone Tiers
              </Text>

              <View style={[styles.ladderCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                {TIER_ORDER.map((tier: EarnedTier) => {
                  const cfg = TIER_CONFIG[tier];
                  const threshold = definition.thresholds[tier];
                  const isEarned = TIER_CONFIG[currentTier].order >= cfg.order;
                  const isNext = nextTier === tier;
                  const unlockDate = formatUnlockDate(unlockedAt[tier]);

                  return (
                    <View
                      key={tier}
                      style={[
                        styles.ladderRow,
                        isNext && { backgroundColor: `${cfg.color}15`, borderRadius: 8 },
                      ]}>
                      {/* Left Tier Indicator */}
                      <View style={styles.ladderLeft}>
                        <View
                          style={[
                            styles.ladderDot,
                            {
                              backgroundColor: isEarned ? cfg.color : '#334155',
                              borderColor: isEarned ? cfg.color : '#475569',
                            },
                          ]}>
                          {isEarned && (
                            <Ionicons name="checkmark" size={10} color="#0f172a" />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.ladderTierLabel,
                            {
                              color: isEarned ? cfg.color : isNext ? colors.text : colors.textMuted,
                              fontWeight: isEarned || isNext ? '700' : '500',
                              fontSize: 12.5 * textScale,
                            },
                          ]}>
                          {cfg.label}
                        </Text>
                      </View>

                      {/* Right Requirements & Date */}
                      <View style={styles.ladderRight}>
                        <Text
                          style={[
                            styles.ladderThreshold,
                            {
                              color: isEarned ? colors.text : colors.textSecondary,
                              fontSize: 12 * textScale,
                            },
                          ]}>
                          {threshold.toLocaleString()} {definition.metricLabel}
                        </Text>
                        {unlockDate && (
                          <Text style={[styles.ladderUnlockDate, { color: cfg.color, fontSize: 10 * textScale }]}>
                            {unlockDate}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Contributing Media Gallery */}
            {contributingItems && contributingItems.length > 0 && (
              <View style={styles.gallerySection}>
                <View style={styles.galleryHeader}>
                  <Text style={[styles.sectionHeading, { color: colors.text, fontSize: 14 * headerScale }]}>
                    Contributing Media ({contributingItems.length})
                  </Text>
                  <Text style={[styles.gallerySub, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                    Tracked titles advancing this achievement
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.galleryScroll}>
                  {contributingItems.map((item) => {
                    const posterUrl = TMDBService.getImageUrl(item.posterPath, 'w185');

                    return (
                      <Pressable
                        key={`${item.mediaType}_${item.id}`}
                        style={[styles.contributingCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
                        onPress={() => {
                          if (onSelectMedia) {
                            triggerHaptic('selection');
                            onClose();
                            onSelectMedia(item.id, item.mediaType);
                          }
                        }}>
                        {posterUrl ? (
                          <Image
                            source={{ uri: posterUrl }}
                            style={styles.contributingPoster}
                            contentFit="cover"
                            transition={150}
                          />
                        ) : (
                          <View style={[styles.contributingPosterPlaceholder, { backgroundColor: colors.card }]}>
                            <Ionicons name="film-outline" size={24} color={colors.textSecondary} />
                          </View>
                        )}
                        <Text
                          numberOfLines={1}
                          style={[styles.contributingTitle, { color: colors.text, fontSize: 11 * textScale }]}>
                          {item.title}
                        </Text>
                        {item.detailText ? (
                          <Text
                            numberOfLines={1}
                            style={[styles.contributingDetail, { color: currentTierConfig.color, fontSize: 10 * textScale }]}>
                            {item.detailText}
                          </Text>
                        ) : item.userScore ? (
                          <Text style={[styles.contributingScore, { color: '#FFD700', fontSize: 10 * textScale }]}>
                            ★ {item.userScore}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: Math.min(width - 32, 480),
    maxHeight: height * 0.85,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingBottom: 16,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  headerInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  achievementTitle: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontWeight: '700',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  achievementDesc: {
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  progressSection: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 18,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  progressMetricText: {
    fontWeight: '700',
    flex: 1,
  },
  progressPercentBadge: {
    fontWeight: '800',
    textAlign: 'right',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  ladderSection: {
    marginBottom: 18,
  },
  sectionHeading: {
    fontWeight: '700',
    marginBottom: 8,
  },
  ladderCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
  },
  ladderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  ladderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ladderDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ladderTierLabel: {
    letterSpacing: -0.2,
  },
  ladderRight: {
    alignItems: 'flex-end',
  },
  ladderThreshold: {
    fontWeight: '600',
  },
  ladderUnlockDate: {
    fontWeight: '700',
    marginTop: 1,
  },
  gallerySection: {
    marginTop: 4,
  },
  galleryHeader: {
    marginBottom: 8,
  },
  gallerySub: {
    marginTop: 1,
  },
  galleryScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  contributingCard: {
    width: 86,
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    alignItems: 'center',
  },
  contributingPoster: {
    width: 76,
    height: 110,
    borderRadius: 6,
    marginBottom: 4,
  },
  contributingPosterPlaceholder: {
    width: 76,
    height: 110,
    borderRadius: 6,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contributingTitle: {
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  contributingDetail: {
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 1,
  },
  contributingScore: {
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 1,
  },
});
