import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STATUS_CONFIG } from '@/types/media';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { getTextScale } from '@/utils/sizing';

interface StatsHeaderProps {
  total: number;
  watching: number;
  planToWatch: number;
  completed: number;
  onHold: number;
  dropped: number;
  meanScore: number;
}

export function StatsHeader({
  total,
  watching,
  planToWatch,
  completed,
  onHold,
  dropped,
  meanScore,
}: StatsHeaderProps) {
  const { colors } = useAppTheme();
  const { sizingConfig } = useMedia();
  const textScale = getTextScale(sizingConfig?.textSize);

  if (total === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {/* Top summary row */}
      <View style={styles.topRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: Math.round(11 * textScale) }]}>Total Entries</Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: Math.round(18 * textScale) }]}>{total}</Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />

        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: Math.round(11 * textScale) }]}>Mean Score</Text>
          <View style={styles.scoreRow}>
            <Ionicons name="star" size={Math.round(14 * textScale)} color="#f59e0b" />
            <Text style={[styles.statValue, { color: colors.text, fontSize: Math.round(18 * textScale) }]}>
              {meanScore > 0 ? meanScore.toFixed(1) : '-'}
            </Text>
          </View>
        </View>

        <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />

        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: Math.round(11 * textScale) }]}>Completed</Text>
          <Text style={[styles.statValue, { color: STATUS_CONFIG.completed.color, fontSize: Math.round(18 * textScale) }]}>
            {completed}
          </Text>
        </View>
      </View>

      {/* Segmented status breakdown bar */}
      <View style={[styles.segmentedBar, { backgroundColor: colors.cardSelected }]}>
        {watching > 0 && (
          <View
            style={{
              flex: watching,
              backgroundColor: STATUS_CONFIG.watching.color,
              height: '100%',
            }}
          />
        )}
        {completed > 0 && (
          <View
            style={{
              flex: completed,
              backgroundColor: STATUS_CONFIG.completed.color,
              height: '100%',
            }}
          />
        )}
        {planToWatch > 0 && (
          <View
            style={{
              flex: planToWatch,
              backgroundColor: STATUS_CONFIG.plan_to_watch.color,
              height: '100%',
            }}
          />
        )}
        {onHold > 0 && (
          <View
            style={{
              flex: onHold,
              backgroundColor: STATUS_CONFIG.on_hold.color,
              height: '100%',
            }}
          />
        )}
        {dropped > 0 && (
          <View
            style={{
              flex: dropped,
              backgroundColor: STATUS_CONFIG.dropped.color,
              height: '100%',
            }}
          />
        )}
      </View>

      {/* Detailed badge counts */}
      <View style={styles.badgesRow}>
        <View style={styles.badgeItem}>
          <View
            style={[styles.dot, { backgroundColor: STATUS_CONFIG.watching.color }]}
          />
          <Text style={[styles.badgeText, { color: colors.textSecondary, fontSize: Math.round(11 * textScale) }]}>Watching: {watching}</Text>
        </View>
        <View style={styles.badgeItem}>
          <View
            style={[styles.dot, { backgroundColor: STATUS_CONFIG.plan_to_watch.color }]}
          />
          <Text style={[styles.badgeText, { color: colors.textSecondary, fontSize: Math.round(11 * textScale) }]}>Plan: {planToWatch}</Text>
        </View>
        <View style={styles.badgeItem}>
          <View
            style={[styles.dot, { backgroundColor: STATUS_CONFIG.completed.color }]}
          />
          <Text style={[styles.badgeText, { color: colors.textSecondary, fontSize: Math.round(11 * textScale) }]}>Done: {completed}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  segmentedBar: {
    height: 6,
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
