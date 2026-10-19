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
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import {
  AchievementStatsSummary,
  AchievementTier,
  EarnedTier,
  TIER_CONFIG,
  TIER_ORDER,
} from '@/types/achievements';
import { getTextScale, getHeaderScale } from '@/utils/sizing';

interface TierRoadmapModalProps {
  visible: boolean;
  statsSummary: AchievementStatsSummary | null;
  onClose: () => void;
}

export function TierTrophyIcon({
  tier,
  size = 28,
}: {
  tier: AchievementTier;
  size?: number;
}) {
  const cfg = TIER_CONFIG[tier];

  if (tier === 'locked') {
    return <Ionicons name="lock-closed" size={size} color="#64748b" />;
  }

  // Metallic tiers: Bronze, Silver, Gold, Platinum
  if (tier === 'bronze' || tier === 'silver' || tier === 'gold' || tier === 'platinum') {
    return <Ionicons name="trophy" size={size} color={cfg.color} />;
  }

  // Gemstone tiers: Ruby, Emerald, Diamond (Composite layered icon: Trophy base with shining gem)
  const gemSize = Math.round(size * 0.52);

  return (
    <View style={[styles.compositeWrapper, { width: size, height: size }]}>
      <Ionicons name="trophy" size={size} color="#94a3b8" />
      <View style={[styles.gemOverlay, { width: gemSize, height: gemSize }]}>
        <Ionicons name="diamond" size={gemSize} color={cfg.color} />
      </View>
    </View>
  );
}

export function TierRoadmapModal({
  visible,
  statsSummary,
  onClose,
}: TierRoadmapModalProps) {
  const { colors } = useAppTheme();
  const { triggerHaptic, sizingConfig } = useMedia();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);

  if (!visible || !statsSummary) return null;

  const total = statsSummary.totalAchievements || 50;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Full-screen backdrop touch target */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Modal Window Container */}
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
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
            {/* Header Title */}
            <View style={styles.headerInfo}>
              <View style={[styles.headerIconAura, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
                <Ionicons name="trophy" size={28 * headerScale} color="#FFD700" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text, fontSize: 19 * headerScale }]}>
                Tier Progression System
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                {statsSummary.unlockedCount} of {total} Unlocked • {statsSummary.completionScorePercent}% Total Progress
              </Text>
            </View>

            {/* Horizontal Tier Progression Roadmap */}
            <View style={[styles.roadmapSection, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <Text style={[styles.roadmapTitle, { color: colors.text, fontSize: 12.5 * textScale }]}>
                Trophy Evolution Roadmap
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roadmapScroll}>
                {TIER_ORDER.map((tier: EarnedTier, index: number) => {
                  const cfg = TIER_CONFIG[tier];
                  const count = statsSummary.tierCounts[tier] || 0;
                  const isLast = index === TIER_ORDER.length - 1;

                  return (
                    <React.Fragment key={tier}>
                      <View style={styles.roadmapStep}>
                        <View style={[styles.roadmapIconBubble, { backgroundColor: cfg.glow, borderColor: cfg.color }]}>
                          <TierTrophyIcon tier={tier} size={24} />
                        </View>
                        <Text style={[styles.roadmapTierName, { color: cfg.color, fontSize: 11 * textScale }]}>
                          {cfg.label}
                        </Text>
                        <Text style={[styles.roadmapTierCount, { color: colors.text, fontSize: 11 * textScale }]}>
                          {count}
                        </Text>
                      </View>

                      {!isLast && (
                        <View style={styles.roadmapArrowCol}>
                          <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
              </ScrollView>
            </View>

            {/* Tier Breakdown Roster */}
            <View style={styles.breakdownSection}>
              <Text style={[styles.sectionHeading, { color: colors.text, fontSize: 14 * headerScale }]}>
                Achievements by Tier
              </Text>

              <View style={[styles.breakdownCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                {/* 7 Earned Tiers in reverse order: Diamond down to Bronze */}
                {[...TIER_ORDER].reverse().map((tier: EarnedTier) => {
                  const cfg = TIER_CONFIG[tier];
                  const count = statsSummary.tierCounts[tier] || 0;
                  const percent = Math.round((count / total) * 100);

                  return (
                    <View key={tier} style={styles.breakdownRow}>
                      <View style={styles.breakdownLeft}>
                        <View style={[styles.breakdownIconWrap, { backgroundColor: cfg.glow }]}>
                          <TierTrophyIcon tier={tier} size={20} />
                        </View>
                        <View>
                          <Text style={[styles.breakdownTierLabel, { color: cfg.color, fontSize: 13 * textScale }]}>
                            {cfg.label}
                          </Text>
                          <Text style={[styles.breakdownSubtext, { color: colors.textSecondary, fontSize: 10.5 * textScale }]}>
                            Tier {cfg.order} Milestone
                          </Text>
                        </View>
                      </View>

                      <View style={styles.breakdownRight}>
                        <Text style={[styles.breakdownCountText, { color: colors.text, fontSize: 13 * textScale }]}>
                          {count} <Text style={{ color: colors.textSecondary, fontSize: 11 * textScale }}>({percent}%)</Text>
                        </Text>
                        <View style={[styles.breakdownBarTrack, { backgroundColor: colors.cardBorder }]}>
                          <View
                            style={[
                              styles.breakdownBarFill,
                              { width: `${percent}%`, backgroundColor: cfg.color },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* Locked / Unearned Tier */}
                <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 10 }]}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownIconWrap, { backgroundColor: 'rgba(71, 85, 105, 0.15)' }]}>
                      <Ionicons name="lock-closed" size={18} color="#64748b" />
                    </View>
                    <View>
                      <Text style={[styles.breakdownTierLabel, { color: '#94a3b8', fontSize: 13 * textScale }]}>
                        Locked (Unearned)
                      </Text>
                      <Text style={[styles.breakdownSubtext, { color: colors.textSecondary, fontSize: 10.5 * textScale }]}>
                        Awaiting initial progress
                      </Text>
                    </View>
                  </View>

                  <View style={styles.breakdownRight}>
                    <Text style={[styles.breakdownCountText, { color: '#94a3b8', fontSize: 13 * textScale }]}>
                      {statsSummary.tierCounts.locked || 0}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
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
  headerInfo: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  headerIconAura: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontWeight: '500',
    textAlign: 'center',
  },
  roadmapSection: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  roadmapTitle: {
    fontWeight: '700',
    marginBottom: 10,
  },
  roadmapScroll: {
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  roadmapStep: {
    alignItems: 'center',
    width: 58,
  },
  roadmapIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  roadmapTierName: {
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
  },
  roadmapTierCount: {
    fontWeight: '800',
  },
  roadmapArrowCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 18,
  },
  compositeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemOverlay: {
    position: 'absolute',
    top: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownSection: {
    marginBottom: 8,
  },
  sectionHeading: {
    fontWeight: '700',
    marginBottom: 8,
  },
  breakdownCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownTierLabel: {
    fontWeight: '700',
  },
  breakdownSubtext: {
    fontWeight: '500',
    marginTop: 1,
  },
  breakdownRight: {
    alignItems: 'flex-end',
    width: 100,
  },
  breakdownCountText: {
    fontWeight: '700',
    marginBottom: 4,
  },
  breakdownBarTrack: {
    width: '100%',
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
});
